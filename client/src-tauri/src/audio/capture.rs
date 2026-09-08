use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use log::{error, info, warn};
use parking_lot::Mutex;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::resampler::{AudioResampler, TARGET_SAMPLE_RATE};

/// Base64 alphabet, no padding needed for the frontend's `atob` (we pad).
fn base64(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        out.push(T[(n >> 18 & 63) as usize] as char);
        out.push(T[(n >> 12 & 63) as usize] as char);
        out.push(if chunk.len() > 1 { T[(n >> 6 & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(n & 63) as usize] as char } else { '=' });
    }
    out
}

#[derive(Serialize, Default)]
pub struct MeetingChunk {
    /// base64 WAV, empty when there is nothing worth sending.
    pub wav: String,
    pub seconds: f32,
    pub peak: f32,
    pub device: String,
    pub running: bool,
}

/// ~25 s of 16 kHz mono audio — the cap if the frontend stops draining.
const MAX_SAMPLES: usize = TARGET_SAMPLE_RATE * 25;
/// Don't hand back a chunk shorter than this (~0.5 s).
const MIN_CHUNK_SAMPLES: usize = TARGET_SAMPLE_RATE / 2;
/// A chunk whose peak is below this is treated as silence and dropped.
const SILENCE_PEAK: f32 = 0.0025;

pub struct AudioCaptureService {
    is_running: Arc<AtomicBool>,
    /// The system-loopback stream — what is playing out of the speakers,
    /// i.e. the other people on the call. The local microphone is never captured.
    loopback_stream: Option<Stream>,
    /// Resampled 16 kHz mono PCM waiting to be transcribed.
    meeting_pcm: Arc<Mutex<Vec<f32>>>,
    loopback_rms: Arc<Mutex<f32>>,
    device_name: String,
}

// Safety: the cpal Stream handle lives behind the AppState mutex and is only
// touched from command handlers on the main thread.
unsafe impl Send for AudioCaptureService {}
unsafe impl Sync for AudioCaptureService {}

impl AudioCaptureService {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            loopback_stream: None,
            meeting_pcm: Arc::new(Mutex::new(Vec::with_capacity(MAX_SAMPLES))),
            loopback_rms: Arc::new(Mutex::new(0.0)),
            device_name: String::new(),
        }
    }

    /// (mic, loopback) — mic is always 0, the app does not open the microphone.
    pub fn get_audio_levels(&self) -> (f32, f32) {
        (0.0, *self.loopback_rms.lock())
    }

    /// Drain the buffered call audio. `wav` is empty when there isn't enough
    /// yet or it's silent; `peak` / `device` / `running` help the UI explain why.
    pub fn take_chunk(&self) -> MeetingChunk {
        let running = self.is_running.load(Ordering::SeqCst);
        let mut buf = self.meeting_pcm.lock();
        let seconds = buf.len() as f32 / TARGET_SAMPLE_RATE as f32;

        if buf.len() < MIN_CHUNK_SAMPLES {
            return MeetingChunk {
                seconds,
                peak: *self.loopback_rms.lock(),
                device: self.device_name.clone(),
                running,
                ..Default::default()
            };
        }
        let samples = std::mem::take(&mut *buf);
        drop(buf);

        let peak = samples.iter().fold(0f32, |m, &s| m.max(s.abs()));
        let mut chunk = MeetingChunk {
            seconds: samples.len() as f32 / TARGET_SAMPLE_RATE as f32,
            peak,
            device: self.device_name.clone(),
            running,
            ..Default::default()
        };
        if peak >= SILENCE_PEAK {
            chunk.wav = base64(&encode_wav(&samples, TARGET_SAMPLE_RATE as u32));
            info!("meeting chunk: {:.1}s peak={:.4} -> {} b64 bytes", chunk.seconds, peak, chunk.wav.len());
        } else {
            info!("meeting chunk: {:.1}s peak={:.4} (below {SILENCE_PEAK}, not sent)", chunk.seconds, peak);
        }
        chunk
    }

    pub fn start_capture(&mut self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.meeting_pcm.lock().clear();

        let host = cpal::default_host();

        if let Ok(devs) = host.output_devices() {
            let names: Vec<String> = devs.filter_map(|d| d.name().ok()).collect();
            info!("Output devices: {names:?}");
        }

        // Capture the default *output* device in loopback mode. On Windows cpal
        // adds AUDCLNT_STREAMFLAGS_LOOPBACK automatically for render endpoints.
        let output_dev = host
            .default_output_device()
            .ok_or_else(|| "No default output device — is anything playing sound?".to_string())?;

        self.device_name = output_dev.name().unwrap_or_default();
        info!("Default output (loopback target): '{}'", self.device_name);

        match self.build_loopback_stream(&output_dev) {
            Ok(stream) => {
                stream
                    .play()
                    .map_err(|e| format!("Failed to start loopback capture: {e:?}"))?;
                info!("Loopback capture started on '{}'.", self.device_name);
                self.loopback_stream = Some(stream);
            }
            Err(e) => {
                warn!("Loopback capture unavailable: {e}");
                return Err(e);
            }
        }

        self.is_running.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop_capture(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.loopback_stream = None;
        self.meeting_pcm.lock().clear();
        *self.loopback_rms.lock() = 0.0;
        info!("Loopback capture stopped.");
    }

    fn build_loopback_stream(&self, device: &Device) -> Result<Stream, String> {
        let supported = device
            .default_input_config()
            .or_else(|_| device.default_output_config())
            .map_err(|e| format!("cannot query device format: {e:?}"))?;

        let sample_format = supported.sample_format();
        let config: StreamConfig = supported.into();
        let sample_rate = config.sample_rate.0 as usize;
        let channels = config.channels as usize;

        let err_fn = |err| error!("loopback stream error: {err:?}");

        let stream = match sample_format {
            SampleFormat::F32 => {
                let pcm = self.meeting_pcm.clone();
                let rms = self.loopback_rms.clone();
                let mut resampler = AudioResampler::new(sample_rate, channels);
                device
                    .build_input_stream(
                        &config,
                        move |data: &[f32], _: &_| ingest(data, &mut resampler, &pcm, &rms),
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build f32 loopback stream: {e:?}"))?
            }
            SampleFormat::I16 => {
                let pcm = self.meeting_pcm.clone();
                let rms = self.loopback_rms.clone();
                let mut resampler = AudioResampler::new(sample_rate, channels);
                device
                    .build_input_stream(
                        &config,
                        move |data: &[i16], _: &_| {
                            let f: Vec<f32> =
                                data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                            ingest(&f, &mut resampler, &pcm, &rms);
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build i16 loopback stream: {e:?}"))?
            }
            other => return Err(format!("unsupported sample format {other:?}")),
        };

        Ok(stream)
    }
}

fn ingest(
    interleaved: &[f32],
    resampler: &mut AudioResampler,
    pcm: &Mutex<Vec<f32>>,
    rms: &Mutex<f32>,
) {
    if interleaved.is_empty() {
        return;
    }
    let sum: f32 = interleaved.iter().map(|&s| s * s).sum();
    *rms.lock() = (sum / interleaved.len() as f32).sqrt();

    let resampled = resampler.process(interleaved);
    if resampled.is_empty() {
        return;
    }
    let mut buf = pcm.lock();
    buf.extend_from_slice(&resampled);
    if buf.len() > MAX_SAMPLES {
        let overflow = buf.len() - MAX_SAMPLES;
        buf.drain(0..overflow);
    }
}

/// Minimal 16-bit mono PCM WAV container. No external crate needed.
fn encode_wav(samples: &[f32], sample_rate: u32) -> Vec<u8> {
    let bytes_per_sample = 2u32;
    let data_len = samples.len() as u32 * bytes_per_sample;
    let mut w = Vec::with_capacity(44 + data_len as usize);
    w.extend_from_slice(b"RIFF");
    w.extend_from_slice(&(36 + data_len).to_le_bytes());
    w.extend_from_slice(b"WAVE");
    w.extend_from_slice(b"fmt ");
    w.extend_from_slice(&16u32.to_le_bytes());
    w.extend_from_slice(&1u16.to_le_bytes()); // PCM
    w.extend_from_slice(&1u16.to_le_bytes()); // mono
    w.extend_from_slice(&sample_rate.to_le_bytes());
    w.extend_from_slice(&(sample_rate * bytes_per_sample).to_le_bytes());
    w.extend_from_slice(&(bytes_per_sample as u16).to_le_bytes());
    w.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    w.extend_from_slice(b"data");
    w.extend_from_slice(&data_len.to_le_bytes());
    for &s in samples {
        let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        w.extend_from_slice(&v.to_le_bytes());
    }
    w
}
