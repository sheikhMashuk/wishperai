import { invoke } from '@tauri-apps/api/core';

type TextCb = (text: string) => void;
type StatusCb = (status: ListenStatus) => void;

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

export type ListenStatus =
  | { kind: 'waiting' }
  | { kind: 'silent'; device: string }
  | { kind: 'transcribing' }
  | { kind: 'heard'; text: string }
  | { kind: 'error'; detail: string };

interface MeetingChunk {
  wav: string; // base64, empty when nothing
  seconds: number;
  peak: number;
  device: string;
  running: boolean;
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
  'mm-hmm', 'uh', 'um', 'yeah', 'the', '.', '. .', 'i', "i'm sorry", 'silence', '[silence]',
  'transcribed by', 'amara.org', 'www.amara.org',
]);

/** Tried in order; whichever the account can actually use is kept. */
function transcriptionTarget(provider: string, key: string, langIsEnglish: boolean) {
  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/audio/transcriptions',
      models: ['gpt-4o-mini-transcribe', 'whisper-1'],
      key,
    };
  }
  // large-v3 is enabled for every Groq account; turbo is faster but some orgs block it.
  const groq = ['whisper-large-v3', 'whisper-large-v3-turbo'];
  if (langIsEnglish) groq.push('distil-whisper-large-v3-en');
  return { url: 'https://api.groq.com/openai/v1/audio/transcriptions', models: groq, key };
}

/** A 4xx that means "this model, not this request" — move to the next model. */
function isModelBlocked(status: number, body: string): boolean {
  if (status === 404) return true;
  const b = body.toLowerCase();
  return (
    (status === 403 || status === 400) &&
    /blocked|not exist|does not exist|not found|no access|decommission|unavailable|terminated|not supported/.test(b)
  );
}

function b64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: 'audio/wav' });
}

class MeetingListener {
  private listening = false;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private silenceTimer: ReturnType<typeof setTimeout> | undefined;
  private accumulated = '';
  private language = 'en';
  private silentTicks = 0;
  private target: ReturnType<typeof transcriptionTarget> | null = null;
  private modelIdx = 0;

  private onSegmentCb: TextCb | null = null;
  private onInterimCb: TextCb | null = null;
  private onQuestionCb: TextCb | null = null;
  private onStatusCb: StatusCb | null = null;

  onSegment(cb: TextCb) { this.onSegmentCb = cb; }
  onInterim(cb: TextCb) { this.onInterimCb = cb; }
  onQuestion(cb: TextCb) { this.onQuestionCb = cb; }
  onStatus(cb: StatusCb) { this.onStatusCb = cb; }

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

    this.setLanguage(opts.language);
    this.target = transcriptionTarget(opts.provider, opts.apiKey.trim(), this.language === 'en');
    this.modelIdx = 0;
    this.accumulated = '';
    this.silentTicks = 0;

    try {
      await invoke('start_audio_capture');
    } catch (e) {
      return { ok: false, reason: `Could not capture call audio — ${String(e)}` };
    }

    this.listening = true;
    this.onStatusCb?.({ kind: 'waiting' });
    this.timer = setInterval(() => void this.tick(), 1600);
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

    let chunk: MeetingChunk;
    try {
      chunk = await invoke<MeetingChunk>('take_meeting_audio');
    } catch (e) {
      this.onStatusCb?.({ kind: 'error', detail: `audio bridge: ${String(e)}` });
      return;
    }

    if (!chunk.wav) {
      // nothing to transcribe — say why
      if (chunk.peak < 0.0025) {
        this.silentTicks++;
        if (this.silentTicks >= 3) {
          this.onStatusCb?.({ kind: 'silent', device: chunk.device || 'default output' });
        }
      } else {
        this.silentTicks = 0;
        this.onStatusCb?.({ kind: 'waiting' });
      }
      return;
    }
    this.silentTicks = 0;

    this.busy = true;
    this.onStatusCb?.({ kind: 'transcribing' });
    try {
      const text = await this.transcribe(b64ToBlob(chunk.wav));
      if (text) this.ingest(text);
    } catch (e) {
      this.onStatusCb?.({ kind: 'error', detail: String((e as Error).message || e) });
      console.warn('transcription error:', e);
    } finally {
      this.busy = false;
    }
  }

  private async transcribe(wav: Blob): Promise<string> {
    const t = this.target!;

    // Try the current model; if the account can't use it, fall through to the next.
    for (; this.modelIdx < t.models.length; this.modelIdx++) {
      const model = t.models[this.modelIdx];
      const form = new FormData();
      form.append('file', wav, 'call.wav');
      form.append('model', model);
      form.append('response_format', 'json');
      form.append('temperature', '0');
      if (this.language) form.append('language', this.language);

      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(t.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${t.key}` },
          body: form,
          signal: ctrl.signal,
        });
      } catch (e) {
        throw new Error(
          (e as Error).name === 'AbortError' ? 'request timed out' : `network — ${(e as Error).message}`,
        );
      } finally {
        clearTimeout(kill);
      }

      if (res.ok) {
        const json = await res.json();
        return String(json.text ?? '').trim();
      }

      const body = (await res.text().catch(() => '')).slice(0, 220);
      if (isModelBlocked(res.status, body) && this.modelIdx < t.models.length - 1) {
        console.warn(`transcription model "${model}" unavailable, trying next`);
        continue;
      }
      throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
    }
    throw new Error('no usable transcription model for this account');
  }

  private ingest(raw: string) {
    const clean = raw.replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase().replace(/[.!?,]+$/g, '').trim();
    if (clean.length < 3 || HALLUCINATIONS.has(key)) return;

    this.onStatusCb?.({ kind: 'heard', text: clean });
    this.onInterimCb?.(clean);
    this.accumulated = `${this.accumulated} ${clean}`.trim();
    this.onSegmentCb?.(clean);
    this.scheduleQuestionCheck();
  }

  private scheduleQuestionCheck() {
    clearTimeout(this.silenceTimer);
    const delay = looksLikeQuestion(this.accumulated) ? 500 : 1500;
    this.silenceTimer = setTimeout(() => {
      const text = this.accumulated.trim();
      if (text.length > 10 && looksLikeQuestion(text)) {
        this.onQuestionCb?.(text);
        this.accumulated = '';
      } else if (text.length > 240) {
        this.accumulated = text.slice(-140);
      }
    }, delay);
  }
}

export const speechService = new MeetingListener();
