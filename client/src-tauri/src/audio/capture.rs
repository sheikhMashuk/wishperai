use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use log::{error, info, warn};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::resampler::{AudioResampler, TARGET_SAMPLE_RATE};

const SR: usize = TARGET_SAMPLE_RATE; // 16_000

/* ---- voice-activity segmentation ---------------------------------- *
 * Instead of slicing the audio on a timer (which cuts words in half and
 * makes Whisper hallucinate), we wait for a natural pause and hand the
 * whole utterance over as one clip.
 * ------------------------------------------------------------------- */
const SPEECH_ON: f32 = 0.012; // rms to start an utterance
const SPEECH_OFF: f32 = 0.007; // rms that counts as silence
const HANGOVER: usize = SR * 700 / 1000; // silence that ends an utterance
const PREROLL: usize = SR * 300 / 1000; // keep this much lead-in
const TRAIL: usize = SR * 250 / 1000; // keep this much tail
const MIN_UTTER: usize = SR * 350 / 1000; // discard anything shorter
const MAX_UTTER: usize = SR * 22; // force-flush a monologue
const MAX_READY: usize = 6; // cap the pending queue

#[derive(Default)]
struct Vad {
    preroll: VecDeque<f32>,
    current: Vec<f32>,
    in_speech: bool,
    hangover: usize,
    ready: VecDeque<Vec<f32>>,
    rms: f32, // smoothed, for the meter
}

impl Vad {
    fn feed(&mut self, block: &[f32]) {
        if block.is_empty() {
            return;
        }
        let energy = (block.iter().map(|&s| s * s).sum::<f32>() / block.len() as f32).sqrt();
        self.rms = self.rms * 0.6 + energy * 0.4;

        if !self.in_speech {
            self.preroll.extend(block.iter().copied());
            while self.preroll.len() > PREROLL {
                self.preroll.pop_front();
            }
            if energy > SPEECH_ON {
                self.in_speech = true;
                self.hangover = 0;
                self.current = self.preroll.drain(..).collect();
            }
            return;
        }

        self.current.extend_from_slice(block);
        if energy < SPEECH_OFF {
            self.hangover += block.len();
        } else {
            self.hangover = 0;
        }

        if self.hangover >= HANGOVER || self.current.len() >= MAX_UTTER {
            self.finish();
        }
    }

    fn finish(&mut self) {
        // trim the trailing silence down to TRAIL
        let keep = self.current.len().saturating_sub(self.hangover) + TRAIL;
        self.current.truncate(keep.min(self.current.len()));

        let peak = self.current.iter().fold(0f32, |m, &s| m.max(s.abs()));
        if self.current.len() >= MIN_UTTER && peak > SPEECH_ON {
            self.ready.push_back(std::mem::take(&mut self.current));
            while self.ready.len() > MAX_READY {
                self.ready.pop_front();
            }
        }
        self.current.clear();
        self.in_speech = false;
        self.hangover = 0;
        self.preroll.clear();
    }

    fn reset(&mut self) {
        *self = Vad::default();
    }
}

#[derive(Serialize, Default)]
pub struct MeetingChunk {
    /// base64 WAV of one complete utterance, empty when none is ready.
    pub wav: String,
    pub seconds: f32,
    pub peak: f32,
    pub device: String,
    pub running: bool,
    /// true while someone is mid-sentence (nothing to send yet).
    pub speaking: bool,
    pub queued: usize,
}

fn base64(bytes: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = (b[0] as u32) << 16 | (b[1] as u32) << 8 | b[2] as u32;
        out.push(T[(n >> 18 & 63) as usize] as char);
        out.push(T[(n >> 12 & 63) as usize] as char);
        out.push(if chunk.len() > 1 { T[(n >> 6 & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(n & 63) as usize] as char } else { '=' });
    }
    out
}

pub struct AudioCaptureService {
    is_running: Arc<AtomicBool>,
    loopback_stream: Option<Stream>,
    vad: Arc<Mutex<Vad>>,
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
            vad: Arc::new(Mutex::new(Vad::default())),
            device_name: String::new(),
        }
    }

    /// (mic, loopback) — mic is always 0, the app does not open the microphone.
    pub fn get_audio_levels(&self) -> (f32, f32) {
        (0.0, self.vad.lock().rms)
    }

    /// Pop the next complete utterance as a WAV. Empty `wav` = nothing ready.
    pub fn take_chunk(&self) -> MeetingChunk {
        let running = self.is_running.load(Ordering::SeqCst);
        let mut vad = self.vad.lock();
        let base = MeetingChunk {
            peak: vad.rms,
            device: self.device_name.clone(),
            running,
            speaking: vad.in_speech,
            queued: vad.ready.len(),
            ..Default::default()
        };

        let Some(samples) = vad.ready.pop_front() else {
            return base;
        };
        drop(vad);

        let peak = samples.iter().fold(0f32, |m, &s| m.max(s.abs()));
        let seconds = samples.len() as f32 / SR as f32;
        info!("utterance: {seconds:.1}s peak={peak:.4}");
        MeetingChunk {
            wav: base64(&encode_wav(&samples, SR as u32)),
            seconds,
            peak,
            ..base
        }
    }

    pub fn start_capture(&mut self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.vad.lock().reset();

        let host = cpal::default_host();
        if let Ok(devs) = host.output_devices() {
            let names: Vec<String> = devs.filter_map(|d| d.name().ok()).collect();
            info!("Output devices: {names:?}");
        }

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
        self.vad.lock().reset();
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
                let vad = self.vad.clone();
                let mut resampler = AudioResampler::new(sample_rate, channels);
                device
                    .build_input_stream(
                        &config,
                        move |data: &[f32], _: &_| {
                            let mono = resampler.process(data);
                            if !mono.is_empty() {
                                vad.lock().feed(&mono);
                            }
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build f32 loopback stream: {e:?}"))?
            }
            SampleFormat::I16 => {
                let vad = self.vad.clone();
                let mut resampler = AudioResampler::new(sample_rate, channels);
                device
                    .build_input_stream(
                        &config,
                        move |data: &[i16], _: &_| {
                            let f: Vec<f32> = data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();
                            let mono = resampler.process(&f);
                            if !mono.is_empty() {
                                vad.lock().feed(&mono);
                            }
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
