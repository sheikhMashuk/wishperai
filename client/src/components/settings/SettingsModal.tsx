import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, RefreshCw, X } from 'lucide-react';
import type { AppSettings, ModelProvider } from '../../types';
import { PROVIDER_META } from '../../types';
import { listModels, pickDefaultModel } from '../../services/aiService';

interface Props {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

const LANGS = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['en-IN', 'English (India)'],
  ['es-ES', 'Spanish'],
  ['fr-FR', 'French'],
  ['de-DE', 'German'],
  ['hi-IN', 'Hindi'],
];

const field =
  'w-full rounded-lg border border-[var(--line)] bg-black/30 px-3 py-2 text-[12.5px] text-[var(--text)] focus:border-[var(--accent)]/50 focus:outline-none';
const label = 'mb-1.5 block text-[12px] font-medium text-[var(--text-dim)]';

const PROVIDER_IDS = Object.keys(PROVIDER_META) as ModelProvider[];

export function SettingsModal({ settings, onChange, onClose }: Props) {
  // `live.provider` records which provider `live.models` was fetched for, so a stale
  // list is never used to pick a model for a different provider.
  const [live, setLive] = useState<{ provider: ModelProvider | null; models: string[] }>({
    provider: null,
    models: [],
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tick, setTick] = useState(0);
  const meta = PROVIDER_META[settings.provider];
  const { provider, apiKey, localModelUrl, model } = settings;

  // Groq / OpenAI / Anthropic need a key even to list models; OpenRouter's list is public.
  const listNeedsKey = meta.needsKey && provider !== 'openrouter';
  const models = live.provider === provider ? live.models : [];

  // fetch the live model list whenever the provider / key / url changes
  useEffect(() => {
    let ignore = false;
    if (listNeedsKey && !apiKey.trim()) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError('');
    (async () => {
      try {
        const list = await listModels({ provider, apiKey, localModelUrl });
        if (ignore) return;
        if (!list.length) {
          setStatus('error');
          setError('provider returned no chat models');
          return;
        }
        setLive({ provider, models: list });
        setStatus('ok');
      } catch (e) {
        if (ignore) return;
        setStatus('error');
        setError((e as Error).message);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [provider, apiKey, localModelUrl, listNeedsKey, tick]);

  // once a list for THIS provider is in hand, replace a missing / retired model with a default
  useEffect(() => {
    if (live.provider === provider && models.length && !models.includes(model)) {
      onChange({ model: pickDefaultModel(provider, models) });
    }
  }, [live, provider, models, model, onChange]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = query
    ? models.filter((m) => m.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
    : models.slice(0, 60);

  return (
    <div
      className="no-drag fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="fade-in flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-solid)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Settings</h2>
          <button onClick={onClose} className="rounded-md p-1 text-[var(--text-faint)] hover:bg-white/[0.08] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="scroll-thin space-y-5 overflow-y-auto p-4">
          {/* provider */}
          <div>
            <span className={label}>Provider</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDER_IDS.map((id) => {
                const m = PROVIDER_META[id];
                return (
                  <button
                    key={id}
                    onClick={() => onChange({ provider: id, model: '' })}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      settings.provider === id
                        ? 'border-[var(--accent)]/60 bg-[var(--accent-soft)]'
                        : 'border-[var(--line)] bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="text-[12.5px] font-medium text-[var(--text)]">{m.name}</div>
                    <div className="text-[10.5px] text-[var(--text-faint)]">{m.note}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* local url */}
          {settings.provider === 'local' && (
            <div>
              <span className={label}>Ollama URL</span>
              <input
                className={field}
                value={settings.localModelUrl}
                onChange={(e) => onChange({ localModelUrl: e.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          )}

          {/* api key */}
          {meta.needsKey && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--text-dim)]">API key</span>
                <a
                  href={meta.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10.5px] text-[var(--accent)] hover:underline"
                >
                  get a key <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <input
                type="password"
                className={field}
                value={settings.apiKey}
                onChange={(e) => onChange({ apiKey: e.target.value })}
                placeholder={meta.keyHint}
              />
              <p className="mt-1 text-[10.5px] text-[var(--text-faint)]">Stored in the OS keychain, never on disk.</p>
            </div>
          )}

          {/* model — always from the live list */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--text-dim)]">
                Model{models.length ? ` · ${models.length} available` : ''}
              </span>
              <button
                onClick={() => void refresh()}
                disabled={status === 'loading'}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-[var(--text-faint)] hover:bg-white/[0.08] hover:text-[var(--text)] disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${status === 'loading' ? 'animate-spin' : ''}`} /> reload
              </button>
            </div>

            <input
              className={field}
              list="wa-models"
              value={settings.model}
              onChange={(e) => {
                setQuery(e.target.value);
                onChange({ model: e.target.value });
              }}
              placeholder={
                status === 'loading'
                  ? 'loading models…'
                  : listNeedsKey && !apiKey.trim()
                    ? 'enter your API key first'
                    : 'pick a model'
              }
            />
            <datalist id="wa-models">
              {filtered.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <p className="mt-1 flex items-center gap-1 text-[10.5px]">
              {status === 'ok' && (
                <span className="flex items-center gap-1 text-emerald-400/90">
                  <Check className="h-3 w-3" /> live list loaded — models are never hard-coded
                </span>
              )}
              {status === 'error' && <span className="text-[var(--danger)]">Couldn’t load models: {error}</span>}
              {status === 'idle' && listNeedsKey && (
                <span className="text-[var(--text-faint)]">Add a key to load {meta.name}’s models.</span>
              )}
            </p>
          </div>

          {/* transcription key */}
          <div>
            <span className={label}>Transcription key (optional)</span>
            <input
              type="password"
              className={field}
              value={settings.transcriptionKey}
              onChange={(e) => onChange({ transcriptionKey: e.target.value })}
              placeholder="sk-… (OpenAI)"
            />
            <p className="mt-1 text-[10.5px] text-[var(--text-faint)]">
              Only for <b>Listen</b>. Use this if your main provider can't run Whisper — e.g. a Groq account
              with the audio models blocked. An OpenAI key works here.
            </p>
          </div>

          {/* resume */}
          <div>
            <span className={label}>Résumé / background context</span>
            <textarea
              rows={4}
              className={`${field} resize-none font-mono text-[11px] leading-relaxed`}
              value={settings.resumeContext}
              onChange={(e) => onChange({ resumeContext: e.target.value })}
              placeholder="Paste your résumé, key projects, and metrics. Injected into every answer."
            />
          </div>

          {/* language */}
          <div>
            <span className={label}>Call language</span>
            <select
              className={field}
              value={settings.speechLanguage}
              onChange={(e) => onChange({ speechLanguage: e.target.value })}
            >
              {LANGS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10.5px] text-[var(--text-faint)]">
              <b>Listen</b> transcribes the call's system audio (the other people, not your mic) via Whisper —
              it needs a <b>Groq</b> or <b>OpenAI</b> key. Other providers: type the question.
            </p>
          </div>

          {/* opacity */}
          <div>
            <span className={label}>Overlay opacity — {Math.round(settings.opacity * 100)}%</span>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(e) => onChange({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* hotkeys */}
          <div className="space-y-1 border-t border-[var(--line)] pt-3 text-[11.5px] text-[var(--text-faint)]">
            {[
              ['Hide / show overlay', 'Ctrl+Shift+H'],
              ['Collapse panel', 'Ctrl+\\'],
              ['Toggle click-through', 'Ctrl+Shift+T'],
              ['Quit', 'Ctrl+Shift+Q'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span>{k}</span>
                <kbd className="rounded border border-[var(--line)] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-dim)]">
                  {v}
                </kbd>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300/90">
            Screen-capture exclusion is active — the overlay is invisible to Zoom, Meet, Teams, and OBS.
          </div>
        </div>
      </div>
    </div>
  );
}
