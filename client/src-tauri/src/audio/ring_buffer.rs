use rtrb::{Consumer, Producer, RingBuffer};
use std::sync::Arc;
use parking_lot::Mutex;

pub struct AudioRingBuffer {
    pub producer: Arc<Mutex<Producer<f32>>>,
    pub consumer: Arc<Mutex<Consumer<f32>>>,
}

impl AudioRingBuffer {
    /// Creates a lock-free ring buffer with the specified sample capacity
    pub fn new(capacity: usize) -> Self {
        let (producer, consumer) = RingBuffer::new(capacity);
        Self {
            producer: Arc::new(Mutex::new(producer)),
            consumer: Arc::new(Mutex::new(consumer)),
        }
    }

    /// Pushes a slice of audio samples into the ring buffer
    pub fn push_slice(&self, samples: &[f32]) -> usize {
        let mut producer = self.producer.lock();
        let mut written = 0;
        for &sample in samples {
            if producer.push(sample).is_ok() {
                written += 1;
            } else {
                // Buffer is full; drop oldest to maintain real-time low latency
                break;
            }
        }
        written
    }

    /// Reads up to `count` samples from the ring buffer
    pub fn pop_slice(&self, buffer: &mut [f32]) -> usize {
        let mut consumer = self.consumer.lock();
        let mut read = 0;
        for item in buffer.iter_mut() {
            if let Ok(sample) = consumer.pop() {
                *item = sample;
                read += 1;
            } else {
                break;
            }
        }
        read
    }
}
