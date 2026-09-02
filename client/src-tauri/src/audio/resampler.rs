use rubato::{FastFixedIn, PolynomialDegree, Resampler};
use log::{error, info};

pub const TARGET_SAMPLE_RATE: usize = 16000;

pub struct AudioResampler {
    resampler: Option<FastFixedIn<f32>>,
    channels: usize,
}

impl AudioResampler {
    pub fn new(input_sample_rate: usize, channels: usize) -> Self {
        let resampler = if input_sample_rate != TARGET_SAMPLE_RATE {
            let resample_ratio = TARGET_SAMPLE_RATE as f64 / input_sample_rate as f64;
            match FastFixedIn::<f32>::new(
                resample_ratio,
                1.5,
                PolynomialDegree::Linear,
                1024,
                1,
            ) {
                Ok(r) => Some(r),
                Err(e) => {
                    error!("Failed to create Rubato resampler: {:?}", e);
                    None
                }
            }
        } else {
            None
        };

        info!(
            "Initialized AudioResampler: {}Hz ({} channels) -> {}Hz mono",
            input_sample_rate, channels, TARGET_SAMPLE_RATE
        );

        Self {
            resampler,
            channels,
        }
    }

    /// Downmixes interleaved multi-channel PCM to mono and resamples to 16,000 Hz
    pub fn process(&mut self, interleaved_input: &[f32]) -> Vec<f32> {
        if interleaved_input.is_empty() {
            return Vec::new();
        }

        // 1. Downmix interleaved channels to mono
        let mono_input: Vec<f32> = if self.channels > 1 {
            interleaved_input
                .chunks(self.channels)
                .map(|chunk| chunk.iter().sum::<f32>() / self.channels as f32)
                .collect()
        } else {
            interleaved_input.to_vec()
        };

        // 2. Resample if necessary
        if let Some(ref mut resampler) = self.resampler {
            let input_frames = resampler.input_frames_next();
            let mut output_samples = Vec::new();

            for chunk in mono_input.chunks(input_frames) {
                let mut channel_data = vec![chunk.to_vec()];
                // Pad if smaller than input_frames_next
                if channel_data[0].len() < input_frames {
                    channel_data[0].resize(input_frames, 0.0);
                }

                if let Ok(resampled) = resampler.process(&channel_data, None) {
                    if !resampled.is_empty() && !resampled[0].is_empty() {
                        output_samples.extend_from_slice(&resampled[0]);
                    }
                }
            }
            output_samples
        } else {
            mono_input
        }
    }
}
