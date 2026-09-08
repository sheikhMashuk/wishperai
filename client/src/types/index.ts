export type IntentCategory =
  | 'BEHAVIORAL'
  | 'CODING_ALGORITHM'
  | 'SYSTEM_DESIGN'
  | 'TECHNICAL_KNOWLEDGE'
  | 'GENERAL';

export type ModelProvider = 'groq' | 'anthropic' | 'openai' | 'openrouter' | 'local';

export interface Answer {
  id: string;
  question: string;
  intent: IntentCategory;
  /** One-line spoken answer, streamed first. */
  headline: string;
  /** Supporting talking points, streamed as they parse. */
  points: string[];
  code?: {
    language: string;
    content: string;
    complexity?: string;
  };
  createdAt: number;
  latencyMs?: number;
  model?: string;
  streaming?: boolean;
  error?: boolean;
}

export interface AppSettings {
  provider: ModelProvider;
  /** API key for the active provider (swap when you change providers). */
  apiKey: string;
  /** Chosen model id — always picked from the provider's live model list, never hard-coded. */
  model: string;
  /** Base URL for a local OpenAI-compatible / Ollama server. */
  localModelUrl: string;
  /** Optional OpenAI key used only for Listen's transcription, when the main
   *  provider can't run Whisper. Stored alongside the main key in the keychain. */
  transcriptionKey: string;
  resumeContext: string;
  speechLanguage: string;
  opacity: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'groq',
  apiKey: '',
  model: '',
  localModelUrl: 'http://localhost:11434',
  transcriptionKey: '',
  resumeContext: '',
  speechLanguage: 'en-US',
  opacity: 1,
};

export const PROVIDER_META: Record<
  ModelProvider,
  { name: string; note: string; keyHint: string; keyUrl: string; needsKey: boolean }
> = {
  groq: { name: 'Groq', note: 'Fastest, free tier', keyHint: 'gsk_…', keyUrl: 'https://console.groq.com/keys', needsKey: true },
  openrouter: { name: 'OpenRouter', note: 'Any model, free tiers', keyHint: 'sk-or-…', keyUrl: 'https://openrouter.ai/keys', needsKey: true },
  anthropic: { name: 'Claude', note: 'Best reasoning', keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys', needsKey: true },
  openai: { name: 'OpenAI', note: 'GPT models', keyHint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true },
  local: { name: 'Local (Ollama)', note: 'Offline, private', keyHint: '', keyUrl: '', needsKey: false },
};
