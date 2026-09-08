import { invoke } from '@tauri-apps/api/core';

type TextCb = (text: string) => void;

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface ListenOptions {
  provider: string;
  apiKey: string;
  language: string; // e.g. "en-US"
}

export interface ListenResult {
  ok: boolean;
  reason?: string;
}

/* ---- question heuristics ---- */
const QUESTION_STARTERS = [
  'how', 'what', 'why', 'when', 'where', 'who', 'can you', 'could you', 'would you',
  'tell me about', 'explain', 'describe', 'walk me through', 'implement', 'write a', 'design a',
  'difference between', 'how would you', 'what is', "what's", 'give me', 'let us', "let's",
];
function looksLikeQuestion(text: string): boolean {
  const q = text.toLowerCase().trim();
  if (q.endsWith('?')) return true;
  return QUESTION_STARTERS.some((s) => q.startsWith(s) || q.includes(` ${s} `));
}

/* Whisper on a near-silent or very short clip tends to invent these. */
const HALLUCINATIONS = new Set([
  'you', 'thank you', 'thank you.', 'thanks', 'thanks for watching', 'thank you very much',
  'please subscribe', 'subscribe', 'bye', 'bye.', 'okay', 'ok', 'so', 'so.', 'mm', 'mmm',
  'mm-hmm', 'uh', 'um', 'yeah', 'the', '.', '. .', 'i', "i'm sorry",
]);

function transcriptionTarget(provider: string, key: string) {
  if (provider === 'openai') {
    return { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1', key };
  }
  // groq — also the sensible default for any groq-shaped key
  return { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3-turbo', key };
}

class MeetingListener {
  private listening = false;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private accumulated = '';
  private language = 'en';
  private target: ReturnType<typeof transcriptionTarget> | null = null;

  private onSegmentCb: TextCb | null = null;
  private onInterimCb: TextCb | null = null;
  private onQuestionCb: TextCb | null = null;

  onSegment(cb: TextCb) { this.onSegmentCb = cb; }
  onInterim(cb: TextCb) { this.onInterimCb = cb; }
  onQuestion(cb: TextCb) { this.onQuestionCb = cb; }

  setLanguage(lang: string) {
    this.language = (lang || 'en-US').slice(0, 2).toLowerCase();
  }

  get isListening() {
    return this.listening;
  }

  async start(opts: ListenOptions): Promise<ListenResult> {
    if (!IN_TAURI) {
      return { ok: false, reason: 'Listening only works in the desktop app.' };
    }
    if (opts.provider !== 'groq' && opts.provider !== 'openai') {
      return { ok: false, reason: 'Listening needs a Groq or OpenAI key for transcription. Type the question instead.' };
    }
    if (!opts.apiKey.trim()) {
      return { ok: false, reason: 'Add your API key in Settings first.' };
    }

    this.target = transcriptionTarget(opts.provider, opts.apiKey.trim());
    this.setLanguage(opts.language);
    this.accumulated = '';

    try {
      await invoke('start_audio_capture');
    } catch (e) {
      return { ok: false, reason: `Could not capture call audio — ${String(e)}` };
    }

    this.listening = true;
    this.timer = setInterval(() => void this.tick(), 1800);
    return { ok: true };
  }

  async stop() {
    this.listening = false;
    clearInterval(this.timer);
    clearTimeout(this.silenceTimer);
    this.accumulated = '';
    invoke('stop_audio_capture').catch(() => {});
  }

  private async tick() {
    if (this.busy || !this.listening || !this.target) return;

    let wav: ArrayBuffer;
    try {
      wav = await invoke<ArrayBuffer>('take_meeting_audio');
    } catch {
      return;
    }
    if (!wav || wav.byteLength < 2000) return; // nothing buffered, or silence

    this.busy = true;
    try {
      const text = await this.transcribe(wav);
      if (text) this.ingest(text);
    } catch (e) {
      console.warn('transcription error:', e);
    } finally {
      this.busy = false;
    }
  }

  private async transcribe(wav: ArrayBuffer): Promise<string> {
    const t = this.target!;
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'call.wav');
    form.append('model', t.model);
    form.append('response_format', 'json');
    form.append('temperature', '0');
    if (this.language) form.append('language', this.language);

    const res = await fetch(t.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.key}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${(await res.text().catch(() => '')).slice(0, 140)}`);
    }
    const json = await res.json();
    return String(json.text ?? '').trim();
  }

  private ingest(raw: string) {
    const clean = raw.replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase().replace(/[.!?,]+$/g, '').trim();
    if (clean.length < 3 || HALLUCINATIONS.has(key)) return;

    this.onInterimCb?.(clean);
    this.accumulated = `${this.accumulated} ${clean}`.trim();
    this.onSegmentCb?.(clean);
    this.scheduleQuestionCheck();
  }

  private scheduleQuestionCheck() {
    clearTimeout(this.silenceTimer);
    const delay = looksLikeQuestion(this.accumulated) ? 500 : 1600;
    this.silenceTimer = setTimeout(() => {
      const text = this.accumulated.trim();
      if (text.length > 10 && looksLikeQuestion(text)) {
        this.onQuestionCb?.(text);
        this.accumulated = '';
      } else if (text.length > 220) {
        // don't let a long monologue with no '?' accumulate forever
        this.accumulated = text.slice(-120);
      }
    }, delay);
  }
}

export const speechService = new MeetingListener();
