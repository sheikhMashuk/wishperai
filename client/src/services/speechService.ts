import { invoke } from '@tauri-apps/api/core';
import type { TranscriptSegment } from '../types';

export type SpeechCallback = (segment: TranscriptSegment) => void;
export type InterimCallback = (interimText: string) => void;
export type QuestionDetectedCallback = (questionText: string) => void;

// Declare Web Speech API window interface
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class SpeechService {
  private recognition: any = null;
  private isListening = false;
  private onSegmentCallback: SpeechCallback | null = null;
  private onInterimCallback: InterimCallback | null = null;
  private onQuestionDetected: QuestionDetectedCallback | null = null;
  private silenceTimer: any = null;
  private accumulatedSpeech = '';
  private currentLanguage = 'en-US';

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.currentLanguage;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript && this.onInterimCallback) {
          this.onInterimCallback(interimTranscript.trim());
        }

        if (finalTranscript.trim()) {
          const cleanText = finalTranscript.trim();
          this.accumulatedSpeech = (this.accumulatedSpeech + ' ' + cleanText).trim();

          const segment: TranscriptSegment = {
            id: `tr-${Date.now()}`,
            speaker: 'interviewer',
            text: cleanText,
            timestamp: Date.now(),
            isFinal: true,
          };

          if (this.onSegmentCallback) {
            this.onSegmentCallback(segment);
          }

          // Debounce / Check if question is finished
          this.handlePotentialQuestion(this.accumulatedSpeech);
        }
      };

      this.recognition.onerror = (event: any) => {
        // Ignore expected non-fatal network/silence events
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition status:', event.error);
        }
      };

      this.recognition.onend = () => {
        // Automatically restart speech recognition while user has capture active
        if (this.isListening) {
          try {
            this.recognition.start();
          } catch {
            // Already started or restarting
          }
        }
      };
    } else {
      console.warn('Web Speech API is not supported in this environment.');
    }
  }

  private handlePotentialQuestion(text: string) {
    clearTimeout(this.silenceTimer);

    // If silence is detected after substantial speech, evaluate question
    this.silenceTimer = setTimeout(() => {
      if (text.length > 10 && this.isLikelyQuestion(text)) {
        if (this.onQuestionDetected) {
          this.onQuestionDetected(text);
        }
        this.accumulatedSpeech = '';
      }
    }, 1200);
  }

  private isLikelyQuestion(text: string): boolean {
    const q = text.toLowerCase();
    if (q.endsWith('?')) return true;
    const questionStarters = [
      'how',
      'what',
      'why',
      'when',
      'where',
      'who',
      'can you',
      'could you',
      'tell me about',
      'explain',
      'describe',
      'implement',
      'write a',
      'design a',
      'difference between',
    ];
    return questionStarters.some((starter) => q.startsWith(starter) || q.includes(` ${starter} `));
  }

  public setLanguage(lang: string) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public onSegment(cb: SpeechCallback) {
    this.onSegmentCallback = cb;
  }

  public onInterim(cb: InterimCallback) {
    this.onInterimCallback = cb;
  }

  public onQuestion(cb: QuestionDetectedCallback) {
    this.onQuestionDetected = cb;
  }

  public async start(): Promise<void> {
    this.isListening = true;
    this.accumulatedSpeech = '';

    // 1. Start native OS audio capture / WASAPI loopback via Tauri
    try {
      await invoke('start_audio_capture');
    } catch {
      // Running in standard web context or fallback
    }

    // 2. Start Web Speech Recognition pipeline
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch {
        // Recognition already active
      }
    }
  }

  public async stop(): Promise<void> {
    this.isListening = false;
    clearTimeout(this.silenceTimer);
    this.accumulatedSpeech = '';

    // 1. Stop native OS audio capture
    try {
      await invoke('stop_audio_capture');
    } catch {
      // Fallback
    }

    // 2. Stop Web Speech Recognition
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Fallback
      }
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
