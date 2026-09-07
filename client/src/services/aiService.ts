import type { AppSettings, Answer, IntentCategory, ModelProvider } from '../types';

const SYSTEM_PROMPT = `You are WhisperAI, a real-time interview copilot. Answer the interviewer's question so the candidate can speak immediately.

Reply with pure JSON only (no markdown fences):
{
  "intent": "BEHAVIORAL" | "CODING_ALGORITHM" | "SYSTEM_DESIGN" | "TECHNICAL_KNOWLEDGE" | "GENERAL",
  "headline": "one or two sentences the candidate can say out loud right now",
  "points": ["supporting detail with precise terminology", "key trade-off or metric", "..."],
  "code": { "language": "Python", "content": "clean, correct solution", "complexity": "Time: O(n) | Space: O(1)" }
}
Set "code" to null unless it is a coding question. Keep "points" to 3-5 items.`;

export function classifyIntent(question: string): IntentCategory {
  const q = question.toLowerCase();
  if (/tell me about a time|conflict|disagreement|proudest|failed|leadership|pressure/.test(q)) return 'BEHAVIORAL';
  if (/algorithm|leetcode|time complexity|implement|binary tree|linked list|\barray\b|lru|two sum|dynamic programming|\bgraph\b|write a function/.test(q))
    return 'CODING_ALGORITHM';
  if (/design|architect|scale|microservice|distributed|rate limiter|\bcache\b|throughput|websocket|kafka|pub\/?sub/.test(q))
    return 'SYSTEM_DESIGN';
  return 'TECHNICAL_KNOWLEDGE';
}

/* ------------------------------------------------------------------ *
 * Live model discovery — nothing about models is hard-coded.
 * ------------------------------------------------------------------ */

interface ProviderApi {
  base: (settings: AppSettings) => string;
  authHeaders: (key: string) => Record<string, string>;
  /** models list endpoint (relative to base or absolute) */
  modelsUrl: (settings: AppSettings) => string;
  /** pull model ids out of the list response */
  parseModels: (json: any) => string[];
  /** true for chat/text models we can actually use */
  isChatModel: (id: string) => boolean;
  /** chat-completions endpoint */
  chatUrl: (settings: AppSettings) => string;
  /** request body for a streaming chat call */
  chatBody: (model: string, messages: any[], prompt: string) => Record<string, unknown>;
  /** extract a text delta from one parsed SSE frame */
  delta: (json: any) => string | undefined;
}

const openaiDelta = (j: any) => j.choices?.[0]?.delta?.content as string | undefined;
const notChat = /whisper|tts|embed|guard|moderation|rerank|distil-whisper|audio|speech|dall-e|image/i;

const PROVIDERS: Record<ModelProvider, ProviderApi> = {
  groq: {
    base: () => 'https://api.groq.com/openai/v1',
    authHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
    modelsUrl: (s) => `${PROVIDERS.groq.base(s)}/models`,
    parseModels: (j) => (j?.data ?? []).map((m: any) => m.id),
    isChatModel: (id) => !notChat.test(id),
    chatUrl: (s) => `${PROVIDERS.groq.base(s)}/chat/completions`,
    chatBody: (model, messages) => ({
      model,
      messages,
      stream: true,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    delta: openaiDelta,
  },
  openai: {
    base: () => 'https://api.openai.com/v1',
    authHeaders: (k) => ({ Authorization: `Bearer ${k}` }),
    modelsUrl: (s) => `${PROVIDERS.openai.base(s)}/models`,
    parseModels: (j) => (j?.data ?? []).map((m: any) => m.id),
    isChatModel: (id) => /^(gpt-|o[0-9]|chatgpt)/.test(id) && !notChat.test(id) && !/realtime|transcribe|search/.test(id),
    chatUrl: (s) => `${PROVIDERS.openai.base(s)}/chat/completions`,
    chatBody: (model, messages) => ({
      model,
      messages,
      stream: true,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    delta: openaiDelta,
  },
  openrouter: {
    base: () => 'https://openrouter.ai/api/v1',
    authHeaders: (k) => {
      const h: Record<string, string> = {};
      if (k) h.Authorization = `Bearer ${k}`;
      return h;
    },
    modelsUrl: (s) => `${PROVIDERS.openrouter.base(s)}/models`,
    parseModels: (j) => (j?.data ?? []).map((m: any) => m.id),
    isChatModel: (id) => !notChat.test(id),
    chatUrl: (s) => `${PROVIDERS.openrouter.base(s)}/chat/completions`,
    chatBody: (model, messages) => ({ model, messages, stream: true, temperature: 0.2 }),
    delta: openaiDelta,
  },
  anthropic: {
    base: () => 'https://api.anthropic.com/v1',
    authHeaders: (k) => ({
      'x-api-key': k,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    modelsUrl: (s) => `${PROVIDERS.anthropic.base(s)}/models`,
    parseModels: (j) => (j?.data ?? []).map((m: any) => m.id),
    isChatModel: (id) => id.startsWith('claude-'),
    chatUrl: (s) => `${PROVIDERS.anthropic.base(s)}/messages`,
    chatBody: (model, _messages, prompt) => ({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    }),
    delta: (j) => (j.type === 'content_block_delta' ? (j.delta?.text as string | undefined) : undefined),
  },
  local: {
    base: (s) => (s.localModelUrl || 'http://localhost:11434').replace(/\/$/, ''),
    authHeaders: () => ({}),
    modelsUrl: (s) => `${PROVIDERS.local.base(s)}/api/tags`,
    parseModels: (j) => (j?.models ?? []).map((m: any) => m.name),
    isChatModel: () => true,
    chatUrl: (s) => `${PROVIDERS.local.base(s)}/v1/chat/completions`,
    chatBody: (model, messages) => ({ model, messages, stream: true, temperature: 0.2 }),
    delta: openaiDelta,
  },
};

type ModelQuery = Pick<AppSettings, 'provider' | 'apiKey' | 'localModelUrl'>;

/** Fetch the provider's live model list. Throws on auth/network error. */
export async function listModels(q: ModelQuery): Promise<string[]> {
  const api = PROVIDERS[q.provider];
  const settings = q as AppSettings;
  const res = await fetch(api.modelsUrl(settings), {
    headers: { ...api.authHeaders(q.apiKey.trim()) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ''}`);
  }
  const json = await res.json();
  const ids: string[] = api.parseModels(json).filter((id: string) => id && api.isChatModel(id));
  return [...new Set(ids)].sort();
}

const DEFAULT_PREFERENCE: Record<ModelProvider, RegExp[]> = {
  groq: [/gpt-oss-20b/, /8b.*instant|instant.*8b/, /8b/, /gpt-oss/, /llama.*3\.[13]/],
  openai: [/^gpt-4o-mini$/, /^gpt-4\.1-mini$/, /mini/, /^gpt-4o$/, /^gpt-4\.1$/],
  anthropic: [/haiku/, /sonnet/],
  openrouter: [/llama-3\.3-70b-instruct(:free)?/, /:free$/, /llama-3\.[13].*instruct/, /gpt-oss/],
  local: [/instruct/, /llama/],
};

/** Choose a sensible fast default from a live list. */
export function pickDefaultModel(provider: ModelProvider, ids: string[]): string {
  if (!ids.length) return '';
  for (const rx of DEFAULT_PREFERENCE[provider]) {
    const hit = ids.find((id) => rx.test(id));
    if (hit) return hit;
  }
  return ids[0];
}

/* ------------------------------------------------------------------ */

interface Endpoint {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  delta: (json: any) => string | undefined;
}

function resolveEndpoint(model: string, prompt: string, settings: AppSettings): Endpoint {
  const api = PROVIDERS[settings.provider];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
  return {
    url: api.chatUrl(settings),
    headers: { 'Content-Type': 'application/json', ...api.authHeaders(settings.apiKey.trim()) },
    body: api.chatBody(model, messages, prompt),
    delta: api.delta,
  };
}

class ModelNotFound extends Error {}

async function streamText(ep: Endpoint, onChunk: (raw: string) => void): Promise<void> {
  const res = await fetch(ep.url, { method: 'POST', headers: ep.headers, body: JSON.stringify(ep.body) });
  if (!res.ok || !res.body) {
    const body = res.body ? await res.text().catch(() => '') : '';
    if (res.status === 404 || /model_not_found|does not exist|decommissioned|not supported/i.test(body)) {
      throw new ModelNotFound(body || `${res.status}`);
    }
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 180)}` : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const text = ep.delta(JSON.parse(payload));
        if (text) onChunk(text);
      } catch {
        /* partial frame */
      }
    }
  }
}

function parsePartial(raw: string): { headline?: string; points?: string[] } {
  const out: { headline?: string; points?: string[] } = {};
  const h = raw.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (h) out.headline = h[1].replace(/\\"/g, '"').replace(/\\n/g, ' ');
  const p = raw.match(/"points"\s*:\s*\[([\s\S]*?)(\]|$)/);
  if (p) {
    const items = [...p[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
    if (items.length) out.points = items;
  }
  return out;
}

function parseFinal(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
    return {};
  }
}

const PROVIDER_LABEL: Record<ModelProvider, string> = {
  groq: 'Groq',
  anthropic: 'Claude',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  local: 'Local',
};

export interface AskOptions {
  onPartial: (patch: Partial<Answer>) => void;
  /** Called when the stored model was invalid and we auto-picked a working one. */
  onModelResolved?: (model: string) => void;
}

export async function generateAnswer(question: string, settings: AppSettings, opts: AskOptions): Promise<Answer> {
  const started = performance.now();
  const intent = classifyIntent(question);
  const providerName = settings.provider;
  const answer: Answer = {
    id: `a-${started.toFixed(0)}-${Math.random().toString(36).slice(2, 6)}`,
    question,
    intent,
    headline: '',
    points: [],
    createdAt: Date.now(),
    streaming: true,
  };

  if (PROVIDERS[providerName] && providerName !== 'local' && !settings.apiKey.trim()) {
    return {
      ...answer,
      streaming: false,
      error: true,
      headline: 'Add an API key in Settings to get live answers.',
      points: ['Pick a provider, paste its key, and WhisperAI will load that provider\'s models for you.'],
      latencyMs: Math.round(performance.now() - started),
    };
  }

  const context = settings.resumeContext.trim() ? `Candidate background:\n${settings.resumeContext.trim()}\n\n` : '';
  const prompt = `${context}Interviewer question: "${question}"`;

  const run = async (model: string): Promise<void> => {
    let raw = '';
    await streamText(resolveEndpoint(model, prompt, settings), (chunk) => {
      raw += chunk;
      const { headline, points } = parsePartial(raw);
      if (headline !== undefined) answer.headline = headline;
      if (points) answer.points = points;
      opts.onPartial({ headline: answer.headline, points: answer.points });
    });
    const final = parseFinal(raw);
    answer.headline = (final.headline || answer.headline || '').trim();
    answer.points = Array.isArray(final.points) ? final.points : answer.points;
    answer.intent = final.intent || intent;
    if (final.code?.content) {
      answer.code = { language: final.code.language || 'text', content: final.code.content, complexity: final.code.complexity };
    }
  };

  try {
    let model = settings.model.trim();

    // No model chosen yet, or a stale/removed one — discover a live one first.
    if (!model) {
      const ids = await listModels(settings).catch(() => [] as string[]);
      model = pickDefaultModel(providerName, ids);
      if (model) opts.onModelResolved?.(model);
    }
    if (!model) throw new Error('No model available for this provider.');

    try {
      await run(model);
    } catch (err) {
      if (!(err instanceof ModelNotFound)) throw err;
      // Stored model is gone. Re-fetch the live list, pick a working one, retry once.
      const ids = await listModels(settings);
      const fixed = pickDefaultModel(providerName, ids);
      if (!fixed || fixed === model) throw new Error(`"${model}" is unavailable and no replacement was found.`);
      answer.headline = '';
      answer.points = [];
      await run(fixed);
      model = fixed;
      opts.onModelResolved?.(fixed);
    }

    answer.model = `${PROVIDER_LABEL[providerName]} · ${model.split('/').pop()}`;
    answer.streaming = false;
    answer.latencyMs = Math.round(performance.now() - started);
    if (!answer.headline && !answer.points.length) {
      answer.error = true;
      answer.headline = 'The model returned an empty response. Try again.';
    }
    return answer;
  } catch (err) {
    return {
      ...answer,
      streaming: false,
      error: true,
      headline: `Request failed — ${(err as Error).message}`,
      points:
        providerName === 'local'
          ? ['Is Ollama running? Start it with OLLAMA_ORIGINS="*" so the overlay can reach it.']
          : ['Open Settings to check the provider and key, then reload the model list.'],
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
