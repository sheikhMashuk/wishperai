use log::{error, info};
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

pub const TARGET_SAMPLE_RATE: usize = 16000;

/// Downmixes interleaved audio to mono and resamples it to 16 kHz for Whisper.
///
/// The resampler consumes a fixed block size. Anything left over is carried to
/// the next call — padding a short block with zeros (as an earlier version did)
/// injects silence into the middle of the stream and destroys the speech.
pub struct AudioResampler {
    resampler: Option<SincFixedIn<f32>>,
    channels: usize,
    pending: Vec<f32>,
    block: usize,
}

impl AudioResampler {
    pub fn new(input_sample_rate: usize, channels: usize) -> Self {
        let mut block = 0usize;
        let resampler = if input_sample_rate != TARGET_SAMPLE_RATE {
            let ratio = TARGET_SAMPLE_RATE as f64 / input_sample_rate as f64;
            // sinc interpolation gives us the anti-alias filter that a linear
            // polynomial does not — essential when decimating 48k -> 16k.
            let params = SincInterpolationParameters {
                sinc_len: 128,
                f_cutoff: 0.95,
                interpolation: SincInterpolationType::Linear,
                oversampling_factor: 128,
                window: WindowFunction::BlackmanHarris2,
            };
            match SincFixedIn::<f32>::new(ratio, 1.0, params, 1024, 1) {
                Ok(r) => {
                    block = r.input_frames_next();
                    Some(r)
                }
                Err(e) => {
                    error!("resampler init failed: {e:?}");
                    None
                }
            }
        } else {
            None
        };

        info!(
            "AudioResampler: {input_sample_rate} Hz ({channels} ch) -> {TARGET_SAMPLE_RATE} Hz mono, block {block}"
        );

        Self {
            resampler,
            channels,
            pending: Vec::with_capacity(4096),
            block,
        }
    }

    pub fn process(&mut self, interleaved: &[f32]) -> Vec<f32> {
        if interleaved.is_empty() {
            return Vec::new();
        }

        let mono: Vec<f32> = if self.channels > 1 {
            interleaved
                .chunks(self.channels)
                .map(|c| c.iter().sum::<f32>() / self.channels as f32)
                .collect()
        } else {
            interleaved.to_vec()
        };

        let Some(resampler) = self.resampler.as_mut() else {
            return mono;
        };

        self.pending.extend_from_slice(&mono);

        let mut out = Vec::with_capacity(self.pending.len() / 2);
        while self.block > 0 && self.pending.len() >= self.block {
            let head: Vec<f32> = self.pending.drain(..self.block).collect();
            match resampler.process(&[head], None) {
                Ok(res) => {
                    if let Some(ch) = res.first() {
                        out.extend_from_slice(ch);
                    }
                }
                Err(e) => error!("resample error: {e:?}"),
            }
            self.block = resampler.input_frames_next();
        }
        out
    }
}
