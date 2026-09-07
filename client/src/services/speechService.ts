import { invoke } from '@tauri-apps/api/core';

type SegmentCb = (text: string) => void;
type InterimCb = (text: string) => void;
type QuestionCb = (text: string) => void;

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const QUESTION_STARTERS = [
  'how', 'what', 'why', 'when', 'where', 'who', 'can you', 'could you', 'would you',
  'tell me about', 'explain', 'describe', 'walk me through', 'implement', 'write a', 'design a',
  'difference between', 'how would you', 'what is', "what's",
];

function looksLikeQuestion(text: string): boolean {
  const q = text.toLowerCase().trim();
  if (q.endsWith('?')) return true;
  return QUESTION_STARTERS.some((s) => q.startsWith(s) || q.includes(` ${s} `));
}

class SpeechService {
  private recognition: any = null;
  private listening = false;
  private accumulated = '';
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private language = 'en-US';

  private onSegmentCb: SegmentCb | null = null;
  private onInterimCb: InterimCb | null = null;
  private onQuestionCb: QuestionCb | null = null;

  constructor() {
    const Ctor = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Ctor) {
      console.warn('Web Speech API unavailable in this webview.');
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = this.language;

    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (interim) this.onInterimCb?.(interim.trim());
      if (final.trim()) {
        const clean = final.trim();
        this.accumulated = `${this.accumulated} ${clean}`.trim();
        this.onSegmentCb?.(clean);
        this.scheduleQuestionCheck();
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('Speech recognition:', e.error);
    };

    rec.onend = () => {
      if (this.listening) {
        try {
          rec.start();
        } catch {
          /* already restarting */
        }
      }
    };

    this.recognition = rec;
  }

  private scheduleQuestionCheck() {
    clearTimeout(this.silenceTimer);
    const delay = looksLikeQuestion(this.accumulated) ? 400 : 1200;
    this.silenceTimer = setTimeout(() => {
      const text = this.accumulated.trim();
      if (text.length > 8 && looksLikeQuestion(text)) {
        this.onQuestionCb?.(text);
        this.accumulated = '';
      }
    }, delay);
  }

  onSegment(cb: SegmentCb) {
    this.onSegmentCb = cb;
  }
  onInterim(cb: InterimCb) {
    this.onInterimCb = cb;
  }
  onQuestion(cb: QuestionCb) {
    this.onQuestionCb = cb;
  }

  setLanguage(lang: string) {
    this.language = lang;
    if (this.recognition) this.recognition.lang = lang;
  }

  get isListening() {
    return this.listening;
  }

  async start() {
    this.listening = true;
    this.accumulated = '';
    invoke('start_audio_capture').catch(() => {});
    try {
      this.recognition?.start();
    } catch {
      /* already running */
    }
  }

  async stop() {
    this.listening = false;
    clearTimeout(this.silenceTimer);
    this.accumulated = '';
    invoke('stop_audio_capture').catch(() => {});
    try {
      this.recognition?.stop();
    } catch {
      /* already stopped */
    }
  }
}

export const speechService = new SpeechService();
