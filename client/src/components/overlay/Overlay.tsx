import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  MessageSquareText,
  Mic,
  Settings2,
  Square,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { Answer, AppSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { generateAnswer } from '../../services/aiService';
import { speechService } from '../../services/speechService';
import { windowService } from '../../services/windowService';
import { AnswerCard } from './AnswerCard';
import { AudioBars } from './AudioBars';
import { SettingsModal } from '../settings/SettingsModal';

const STORAGE_KEY = 'whisperai.settings';
const HISTORY_KEY = 'whisperai.history';
const HISTORY_LIMIT = 40;
const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const CHIPS = [
  { label: 'Answer this', prompt: 'Answer the interviewer\'s last question directly.' },
  { label: 'What do I say?', prompt: 'Give me the exact first-person sentence to say out loud right now.' },
  { label: 'Follow-up', prompt: 'Suggest two sharp follow-up questions I can ask the interviewer.' },
  { label: 'Recap', prompt: 'Summarize the last few minutes of this conversation into key points.' },
];

function loadSettings(): AppSettings {
  // current schema
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
  } catch {
    /* ignore */
  }
  // migrate the pre-redesign schema (whisperai_settings) once
  try {
    const legacy = localStorage.getItem('whisperai_settings');
    if (legacy) {
      const o = JSON.parse(legacy);
      localStorage.removeItem('whisperai_settings');
      return {
        ...DEFAULT_SETTINGS,
        provider: o.modelProvider ?? DEFAULT_SETTINGS.provider,
        model: '', // force a fresh live lookup — old ids are dead
        localModelUrl: o.localModelUrl ?? DEFAULT_SETTINGS.localModelUrl,
        resumeContext: o.resumeContext ?? '',
        speechLanguage: o.speechLanguage ?? DEFAULT_SETTINGS.speechLanguage,
        opacity: typeof o.opacity === 'number' ? o.opacity : 1,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Past answers, most recent last. Survives restarts. */
function loadHistory(): Answer[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Answer[];
    return Array.isArray(list) ? list.map((a) => ({ ...a, streaming: false })) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: Answer[]) {
  try {
    const trimmed = list
      .filter((a) => !a.streaming)
      .slice(-HISTORY_LIMIT)
      .map(({ streaming: _s, ...a }) => a);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / disabled — history just won't persist */
  }
}

export function Overlay() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [answers, setAnswers] = useState<Answer[]>(loadHistory);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [listenLine, setListenLine] = useState('listening…');
  const [listenStatusKind, setListenStatusKind] = useState<string>('waiting');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [clickThrough, setClickThrough] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [listenError, setListenError] = useState<string | null>(null);

  const listenStart = useRef(0);
  const lastQuestion = useRef('');
  const feedRef = useRef<HTMLDivElement>(null);

  const surface = useMemo(() => {
    const a = 0.5 + settings.opacity * 0.32;
    return `rgba(14, 14, 16, ${a.toFixed(3)})`;
  }, [settings.opacity]);

  /* ---- persistence ---------------------------------------------------- */
  useEffect(() => {
    const { apiKey: _omit, ...safe } = settings;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      /* ignore */
    }
    speechService.setLanguage(settings.speechLanguage);
  }, [settings]);

  useEffect(() => {
    windowService.getApiKey().then((key) => {
      if (key) setSettings((s) => ({ ...s, apiKey: key }));
    });
  }, []);

  /* persist conversation history (skips in-flight cards) */
  useEffect(() => {
    if (answers.some((a) => a.streaming)) return;
    saveHistory(answers);
  }, [answers]);

  /* ---- tauri events ------------------------------------------------------ */
  useEffect(() => {
    if (!IN_TAURI) return;
    const offs: Array<() => void> = [];
    listen<boolean>('clickthrough-changed', (e) => setClickThrough(e.payload)).then((f) => offs.push(f));
    listen('stealth-visibility-toggled', () => setCollapsed(false)).then((f) => offs.push(f));
    return () => offs.forEach((f) => f());
  }, []);

  const applySettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    if (patch.apiKey !== undefined) void windowService.setApiKey(patch.apiKey);
  }, []);

  /* ---- ask flow ------------------------------------------------------- */
  const runAsk = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setBusy(true);
      setCollapsed(false);

      const placeholderId = `a-${Date.now()}`;
      setAnswers((prev) => [
        ...prev,
        { id: placeholderId, question: q, intent: 'GENERAL', headline: '', points: [], createdAt: Date.now(), streaming: true },
      ]);

      const patch = (p: Partial<Answer>) =>
        setAnswers((prev) => prev.map((a) => (a.id === placeholderId ? { ...a, ...p } : a)));

      try {
        const final = await generateAnswer(q, settings, {
          onPartial: patch,
          onModelResolved: (model) => setSettings((s) => (s.model === model ? s : { ...s, model })),
        });
        setAnswers((prev) => prev.map((a) => (a.id === placeholderId ? { ...final, id: placeholderId } : a)));
      } catch (err) {
        patch({ streaming: false, error: true, headline: `Failed — ${(err as Error).message}` });
      } finally {
        setBusy(false);
      }
    },
    [busy, settings],
  );

  useEffect(() => {
    speechService.onInterim(setInterim);
    speechService.onSegment(() => setInterim(''));
    speechService.onQuestion((text) => {
      lastQuestion.current = text;
      void runAsk(text);
    });
    speechService.onStatus((s) => {
      if (s.kind === 'heard') setListenLine(s.text);
      else if (s.kind === 'hearing') setListenLine('hearing them…');
      else if (s.kind === 'transcribing') setListenLine('transcribing…');
      else if (s.kind === 'silent')
        setListenLine(`no call audio on "${s.device}" — is the meeting playing through that output device?`);
      else if (s.kind === 'error') setListenLine(`transcription failed — ${s.detail}`);
      else setListenLine('listening for the call…');
      setListenStatusKind(s.kind);
    });
  }, [runAsk]);

  /* ---- audio level + timer while listening ----------------------------- */
  useEffect(() => {
    if (!listening) {
      setMicLevel(0);
      return;
    }
    const id = setInterval(async () => {
      setElapsed(Date.now() - listenStart.current);
      try {
        const [mic, loop] = await invoke<[number, number]>('get_audio_levels');
        setMicLevel(Math.max(mic, loop));
      } catch {
        setMicLevel(0.2 + Math.random() * 0.3);
      }
    }, 200);
    return () => clearInterval(id);
  }, [listening]);

  /* ---- keyboard ------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---- autoscroll --------------------------------------------------- */
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
  }, [answers, interim]);

  /* ---- actions ------------------------------------------------------ */
  const toggleListen = async () => {
    if (listening) {
      await speechService.stop();
      setListening(false);
      return;
    }
    const res = await speechService.start({
      provider: settings.provider,
      apiKey: settings.apiKey,
      language: settings.speechLanguage,
      transcriptionKey: settings.transcriptionKey,
    });
    if (!res.ok) {
      setListenError(res.reason ?? 'Could not start listening.');
      return;
    }
    setListenError(null);
    setInterim('');
    setListenLine('listening…');
    setListenStatusKind('waiting');
    listenStart.current = Date.now();
    setElapsed(0);
    setListening(true);
  };

  const toggleClickThrough = async () => {
    const next = !clickThrough;
    setClickThrough(next);
    await windowService.setClickThrough(next);
  };

  const cycleOpacity = () =>
    setSettings((s) => ({ ...s, opacity: s.opacity > 0.85 ? 0.7 : s.opacity > 0.55 ? 0.4 : 1 }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    lastQuestion.current = input.trim();
    void runAsk(input);
    setInput('');
  };

  const chip = (prompt: string) => {
    const ctx = lastQuestion.current ? `${prompt}\n\nContext (last question heard): "${lastQuestion.current}"` : prompt;
    void runAsk(ctx);
  };

  /* ---- render ------------------------------------------------------- */
  return (
    <div className="flex h-full w-full flex-col p-2">
      <div
        className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-2xl transition-colors ${
          collapsed ? 'shrink-0' : 'flex-1'
        } ${clickThrough ? 'border-amber-400/40' : 'border-[var(--line-strong)]'}`}
        style={{ backgroundColor: surface }}
      >
        {/* ---- top bar ---- */}
        <header className="drag-region flex h-11 items-center justify-between gap-2 px-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${listening ? 'bg-[var(--accent)] pulse-dot' : 'bg-[var(--text-faint)]'}`}
            />
            <span className="text-[12px] font-semibold tracking-wide text-[var(--text-dim)]">WhisperAI</span>
            {listening && (
              <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-[var(--text-faint)]">
                <AudioBars active level={micLevel} />
                {fmtElapsed(elapsed)}
              </span>
            )}
          </div>

          <div className="no-drag flex items-center gap-1">
            <button
              onClick={toggleListen}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors ${
                listening
                  ? 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25'
                  : 'bg-white/[0.06] text-[var(--text)] hover:bg-white/[0.12]'
              }`}
            >
              {listening ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
              {listening ? 'Stop' : 'Listen'}
            </button>

            <IconBtn title="Opacity" onClick={cycleOpacity}>
              <span className="text-[10px] font-medium tabular-nums text-[var(--text-dim)]">
                {Math.round(settings.opacity * 100)}
              </span>
            </IconBtn>
            <IconBtn title={clickThrough ? 'Disable click-through (Ctrl+Shift+T)' : 'Click-through (Ctrl+Shift+T)'} onClick={toggleClickThrough}>
              {clickThrough ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn
              title="Clear history"
              onClick={() => {
                setAnswers([]);
                try {
                  localStorage.removeItem(HISTORY_KEY);
                } catch {
                  /* ignore */
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Settings" onClick={() => { setShowSettings(true); setListenError(null); }}>
              <Settings2 className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title={collapsed ? 'Expand (Ctrl+\\)' : 'Collapse (Ctrl+\\)'} onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn title="Hide (Ctrl+Shift+H)" onClick={() => windowService.hide()}>
              <Eye className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn title="Quit (Ctrl+Shift+Q)" onClick={() => windowService.quit()} danger>
              <X className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </header>

        {!collapsed && (
          <>
            {clickThrough && (
              <button
                onClick={toggleClickThrough}
                className="no-drag flex items-center justify-center gap-1.5 border-y border-amber-400/20 bg-amber-400/10 py-1 text-[11px] text-amber-300 transition-colors hover:bg-amber-400/15"
              >
                <Lock className="h-3 w-3" /> Click-through on — clicks pass through. Tap to unlock.
              </button>
            )}

            {listenError && (
              <button
                onClick={() => setListenError(null)}
                className="no-drag flex items-center justify-center gap-1.5 border-y border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-1 text-[11px] text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/15"
              >
                {listenError} <span className="text-[var(--text-faint)]">(tap to dismiss)</span>
              </button>
            )}

            {/* ---- chips ---- */}
            <div className="no-drag flex gap-1.5 overflow-x-auto border-t border-[var(--line)] px-2.5 py-1.5 scroll-thin">
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => chip(c.prompt)}
                  disabled={busy}
                  className="shrink-0 rounded-md border border-[var(--line)] bg-white/[0.03] px-2 py-1 text-[11px] text-[var(--text-dim)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text)] disabled:opacity-40"
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* ---- feed ---- */}
            <div ref={feedRef} className="selectable no-drag scroll-thin flex-1 space-y-2 overflow-y-auto px-2.5 py-2.5">
              {answers.length === 0 ? (
                <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-1.5 text-center">
                  <MessageSquareText className="h-6 w-6 text-[var(--text-faint)]" />
                  <p className="text-[12.5px] text-[var(--text-dim)]">Ready</p>
                  <p className="max-w-[250px] text-[11px] text-[var(--text-faint)]">
                    <span className="text-[var(--text-dim)]">Listen</span> transcribes the other people on the call and answers their questions. Or type one below.
                  </p>
                </div>
              ) : (
                answers.map((a) => <AnswerCard key={a.id} answer={a} />)
              )}
            </div>

            {/* ---- live transcript (the other side of the call) ---- */}
            {listening && (
              <div className="no-drag flex items-center gap-2 border-t border-[var(--line)] px-2.5 py-1.5 text-[11px]">
                <span
                  className={`shrink-0 font-medium ${
                    listenStatusKind === 'error' || listenStatusKind === 'silent'
                      ? 'text-[var(--danger)]'
                      : 'text-[var(--accent)]'
                  }`}
                >
                  {listenStatusKind === 'error' ? 'Audio' : 'Them'}
                </span>
                <span
                  className={`truncate ${
                    listenStatusKind === 'heard' ? 'text-[var(--text-dim)]' : 'text-[var(--text-faint)]'
                  }`}
                >
                  {listenLine}
                </span>
              </div>
            )}

            {/* ---- input ---- */}
            <form onSubmit={submit} className="no-drag border-t border-[var(--line)] p-2">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-black/25 px-3 focus-within:border-[var(--accent)]/50">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="flex-1 bg-transparent py-2 text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-black transition-opacity disabled:opacity-30"
                >
                  {busy ? '…' : 'Ask'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onChange={applySettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-lg px-1 text-[var(--text-faint)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text)] ${
        danger ? 'hover:bg-[var(--danger)]/15 hover:text-[var(--danger)]' : ''
      }`}
    >
      {children}
    </button>
  );
}
