use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, Stream, StreamConfig};
use log::{error, info, warn};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use super::resampler::AudioResampler;
use super::ring_buffer::AudioRingBuffer;

pub struct AudioDeviceDescriptor {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

pub struct AudioCaptureService {
    is_running: Arc<AtomicBool>,
    mic_stream: Option<Stream>,
    loopback_stream: Option<Stream>,
    ring_buffer: Arc<AudioRingBuffer>,
    current_mic_rms: Arc<Mutex<f32>>,
    current_loopback_rms: Arc<Mutex<f32>>,
}

// Safety: cpal::Stream handles are protected inside AudioCaptureService Mutex
unsafe impl Send for AudioCaptureService {}
unsafe impl Sync for AudioCaptureService {}

impl AudioCaptureService {
    pub fn new() -> Self {
        // 16000 samples/sec * 10 seconds capacity = 160,000 samples buffer
        let ring_buffer = Arc::new(AudioRingBuffer::new(160000));
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            mic_stream: None,
            loopback_stream: None,
            ring_buffer,
            current_mic_rms: Arc::new(Mutex::new(0.0)),
            current_loopback_rms: Arc::new(Mutex::new(0.0)),
        }
    }

    pub fn get_ring_buffer(&self) -> Arc<AudioRingBuffer> {
        self.ring_buffer.clone()
    }

    pub fn get_audio_levels(&self) -> (f32, f32) {
        let mic = *self.current_mic_rms.lock();
        let loopback = *self.current_loopback_rms.lock();
        (mic, loopback)
    }

    pub fn list_input_devices() -> Vec<AudioDeviceDescriptor> {
        let host = cpal::default_host();
        let mut result = Vec::new();

        let default_name = host
            .default_input_device()
            .and_then(|d| d.name().ok())
            .unwrap_or_default();

        if let Ok(devices) = host.input_devices() {
            for (index, dev) in devices.enumerate() {
                if let Ok(name) = dev.name() {
                    let is_default = name == default_name;
                    result.push(AudioDeviceDescriptor {
                        id: format!("input-{}", index),
                        name,
                        is_default,
                    });
                }
            }
        }
        result
    }

    pub fn start_capture(&mut self) -> Result<(), String> {
        if self.is_running.load(Ordering::SeqCst) {
            return Ok(());
        }

        let host = cpal::default_host();

        // 1. Microphone Input Capture
        if let Some(mic_dev) = host.default_input_device() {
            match self.build_input_stream(&mic_dev, false) {
                Ok(stream) => {
                    if let Err(e) = stream.play() {
                        warn!("Failed to start microphone stream: {:?}", e);
                    } else {
                        info!("Microphone capture stream started.");
                        self.mic_stream = Some(stream);
                    }
                }
                Err(e) => warn!("Microphone stream initialization error: {}", e),
            }
        }

        // 2. System Loopback Audio Capture (Windows WASAPI)
        #[cfg(target_os = "windows")]
        {
            if let Some(output_dev) = host.default_output_device() {
                match self.build_input_stream(&output_dev, true) {
                    Ok(stream) => {
                        if let Err(e) = stream.play() {
                            warn!("Failed to start loopback stream: {:?}", e);
                        } else {
                            info!("WASAPI Loopback capture stream started.");
                            self.loopback_stream = Some(stream);
                        }
                    }
                    Err(e) => warn!("WASAPI Loopback stream initialization error: {}", e),
                }
            }
        }

        self.is_running.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn stop_capture(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.mic_stream = None;
        self.loopback_stream = None;
        info!("Audio capture stopped.");
    }

    fn build_input_stream(&self, device: &Device, is_loopback: bool) -> Result<Stream, String> {
        let supported_config = device
            .default_input_config()
            .map_err(|e| format!("Failed to query default config: {:?}", e))?;

        let sample_format = supported_config.sample_format();
        let config: StreamConfig = supported_config.into();

        let sample_rate = config.sample_rate.0 as usize;
        let channels = config.channels as usize;

        let ring_buffer = self.ring_buffer.clone();
        let rms_meter = if is_loopback {
            self.current_loopback_rms.clone()
        } else {
            self.current_mic_rms.clone()
        };

        let mut resampler = AudioResampler::new(sample_rate, channels);

        let err_fn = move |err| {
            error!("Audio capture stream error: {:?}", err);
        };

        let stream = match sample_format {
            SampleFormat::F32 => device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _: &_| {
                        // Calculate RMS level
                        let sum: f32 = data.iter().map(|&s| s * s).sum();
                        let rms = (sum / (data.len().max(1) as f32)).sqrt();
                        *rms_meter.lock() = rms;

                        // Resample to 16kHz mono and push to ring buffer
                        let resampled = resampler.process(data);
                        ring_buffer.push_slice(&resampled);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Build F32 input stream error: {:?}", e))?,

            SampleFormat::I16 => device
                .build_input_stream(
                    &config,
                    move |data: &[i16], _: &_| {
                        // Convert i16 to f32 (-1.0 to 1.0)
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s as f32 / i16::MAX as f32).collect();

                        let sum: f32 = float_data.iter().map(|&s| s * s).sum();
                        let rms = (sum / (float_data.len().max(1) as f32)).sqrt();
                        *rms_meter.lock() = rms;

                        let resampled = resampler.process(&float_data);
                        ring_buffer.push_slice(&resampled);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("Build I16 input stream error: {:?}", e))?,

            _ => return Err("Unsupported audio sample format".into()),
        };

        Ok(stream)
    }
}
