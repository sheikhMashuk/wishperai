import { useState, useEffect, useRef } from 'react';
import type { FC, FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { CopilotSuggestion, TranscriptSegment, AppSettings, AudioLevels } from '../../types';
import { AnswerCard } from './AnswerCard';
import { AudioVisualizer } from './AudioVisualizer';
import { SettingsModal } from '../settings/SettingsModal';
import { speechService } from '../../services/speechService';
import { AIService } from '../../services/aiService';
import { WindowService } from '../../services/windowService';
import {
  ShieldCheck,
  Settings,
  Trash2,
  Play,
  Square,
  Sparkles,
  MessageSquare,
  X,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sliders,
  Sun,
  Wand2,
  RotateCcw,
  Send,
  LayoutDashboard,
} from 'lucide-react';

interface StealthHUDProps {
  onReturnToDashboard?: () => void;
}

export const StealthHUD: FC<StealthHUDProps> = ({ onReturnToDashboard }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('whisperai_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Use default
      }
    }
    return {
      opacity: 0.95,
      clickThrough: false,
      modelProvider: 'groq',
      groqModel: 'llama-3.3-70b-versatile',
      apiKey: '',
      selectedMic: 'default',
      autoScroll: true,
      stealthModeEnabled: true,
      localModelUrl: 'http://localhost:11434',
      localModelName: 'llama3.2',
      resumeContext:
        'Senior Full-Stack Engineer with 6+ years building distributed Rust/Go backends, low-latency WebSockets, and modern React/Next.js architectures. Led high-throughput API scaling handling 100k+ req/sec.',
      speechLanguage: 'en-US',
    };
  });

  const [isCapturing, setIsCapturing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({ micRms: 0, loopbackRms: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showOpacityPopover, setShowOpacityPopover] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isStealthHidden, setIsStealthHidden] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([
    {
      id: 'demo-1',
      question: 'How do you design a real-time low-latency WebSocket system handling 100k concurrent connections?',
      intent: 'SYSTEM_DESIGN',
      summary:
        'Architect with an async Rust/Tokio or Go edge gateway cluster using Redis Pub/Sub backplane and epoll/kqueue socket multiplexing to minimize thread context switching overhead.',
      bulletPoints: [
        'Transport & Gateway: Use Rust Axum / Tokio with custom buffer recycling (bytes crate) to achieve zero-copy framing.',
        'State & Fanout: Partition connections across worker nodes using a consistent hashing ring; delegate room fanout to Redis Dragonfly / NATS cluster.',
        'Backpressure & Flow Control: Implement bounded RingBuffers per client connection to drop stale telemetry frames rather than blocking the async executor.',
      ],
      retrievedContext: ['Project: Edge Gateway Microservice', 'Skills: Rust, Tokio, WebSockets, Redis'],
      timestamp: Date.now() - 45000,
      latencyMs: 195,
      modelUsed: 'Groq (Llama 3.3 70B)',
    },
  ]);

  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([
    {
      id: 'tr-1',
      speaker: 'interviewer',
      text: 'Can you walk me through your experience building distributed real-time systems?',
      timestamp: Date.now() - 50000,
      isFinal: true,
    },
  ]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('whisperai_settings', JSON.stringify(settings));
    speechService.setLanguage(settings.speechLanguage || 'en-US');
  }, [settings]);

  // Listen to Tauri Global Shortcut Events (Sync Rust Backend with React Frontend)
  useEffect(() => {
    let unlistenClickthrough: (() => void) | undefined;
    let unlistenVisibility: (() => void) | undefined;

    try {
      listen<boolean>('clickthrough-changed', (event) => {
        setSettings((prev) => ({ ...prev, clickThrough: event.payload }));
      }).then((fn) => {
        unlistenClickthrough = fn;
      });

      listen('stealth-visibility-toggled', () => {
        setIsStealthHidden((prev) => !prev);
      }).then((fn) => {
        unlistenVisibility = fn;
      });
    } catch (err) {
      console.warn('Tauri event listeners not active in browser mode:', err);
    }

    return () => {
      if (unlistenClickthrough) unlistenClickthrough();
      if (unlistenVisibility) unlistenVisibility();
    };
  }, []);

  // Wire Speech Recognition & Question Auto-Trigger
  useEffect(() => {
    speechService.onSegment((seg) => {
      setTranscripts((prev) => [...prev.slice(-20), seg]);
      setInterimText('');
    });

    speechService.onInterim((text) => {
      setInterimText(text);
    });

    speechService.onQuestion(async (questionText) => {
      await handleTriggerQuestion(questionText);
    });
  }, [settings]);

  // Audio Telemetry Polling
  useEffect(() => {
    let interval: any;
    if (isCapturing) {
      interval = setInterval(async () => {
        try {
          const levels: [number, number] = await invoke('get_audio_levels');
          setAudioLevels({
            micRms: levels[0],
            loopbackRms: levels[1],
          });
        } catch {
          // fallback simulated RMS if running outside Tauri
          setAudioLevels({
            micRms: Math.random() * 0.4 + 0.1,
            loopbackRms: Math.random() * 0.5 + 0.2,
          });
        }
      }, 100);
    } else {
      setAudioLevels({ micRms: 0, loopbackRms: 0 });
    }
    return () => clearInterval(interval);
  }, [isCapturing]);

  // Auto-scroll on new suggestions
  useEffect(() => {
    if (settings.autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [suggestions, interimText]);

  // Global Keyboard Listener for Hide/Unhide within Webview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === '\\' || (e.shiftKey && e.key.toLowerCase() === 'h'))) {
        e.preventDefault();
        setIsStealthHidden((prev) => !prev);
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleToggleClickThrough();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.clickThrough]);

  // Toggle Audio Capture
  const handleToggleCapture = async () => {
    if (!isCapturing) {
      try {
        await invoke('start_audio_capture');
      } catch (err) {
        console.warn('Tauri start_audio_capture unavailable, using browser speech fallback:', err);
      }
      speechService.start();
      setIsCapturing(true);
    } else {
      try {
        await invoke('stop_audio_capture');
      } catch (err) {
        console.warn('Tauri stop_audio_capture unavailable:', err);
      }
      speechService.stop();
      setIsCapturing(false);
    }
  };

  // Toggle Click-Through Mode
  const handleToggleClickThrough = async () => {
    const next = !settings.clickThrough;
    setSettings((prev) => ({ ...prev, clickThrough: next }));
    await WindowService.setClickThrough(next);
  };

  // Quick Opacity Presets
  const setOpacityLevel = (opacityVal: number) => {
    setSettings((prev) => ({ ...prev, opacity: opacityVal }));
  };

  // Cycle Opacity Preset
  const cycleOpacity = () => {
    const current = settings.opacity;
    let next = 0.95;
    if (current >= 0.9) next = 0.7;
    else if (current >= 0.65) next = 0.45;
    else if (current >= 0.4) next = 0.25;
    else next = 0.95;
    setOpacityLevel(next);
  };

  // Trigger Question Intelligence
  const handleTriggerQuestion = async (queryText: string) => {
    if (!queryText.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const suggestion = await AIService.generateCopilotResponse(queryText, settings);
      setSuggestions((prev) => [...prev, suggestion]);
      setManualInput('');
      if (isStealthHidden) {
        setIsStealthHidden(false);
      }
    } catch (err) {
      console.error('Failed to generate AI suggestion:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleTriggerQuestion(manualInput);
    }
  };

  const handleQuickChip = (prompt: string) => {
    const lastSeg = transcripts.length > 0 ? transcripts[transcripts.length - 1].text : '';
    const fullQuery = lastSeg ? `${prompt} regarding: "${lastSeg}"` : prompt;
    handleTriggerQuestion(fullQuery);
  };

  const handleClearHistory = () => {
    setSuggestions([]);
    setTranscripts([]);
  };

  // -------------------------------------------------------------
  // MINIMALIST COLLAPSED STEALTH PILL (When Hidden)
  // -------------------------------------------------------------
  if (isStealthHidden) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
        <div
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-white/20 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-105 drag-region"
          style={{
            background: `linear-gradient(180deg, rgba(17, 20, 29, ${settings.opacity}) 0%, rgba(10, 11, 16, ${settings.opacity}) 100%)`,
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15), 0 12px 30px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* Logo Dot */}
          <div className="flex items-center gap-1.5 no-drag">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCapturing ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isCapturing ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
            </span>
            <span className="text-xs font-bold tracking-tight text-white/90">WhisperAI</span>
          </div>

          <div className="h-3 w-px bg-white/20" />

          {/* Stealth Active Indicator */}
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 no-drag">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Stealth Active</span>
          </div>

          <div className="h-3 w-px bg-white/20" />

          {/* Opacity Indicator in Pill */}
          <button
            onClick={cycleOpacity}
            title="Cycle Opacity (Click to change)"
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-300 bg-white/10 hover:bg-white/20 transition-all no-drag"
          >
            <Sun className="w-2.5 h-2.5 text-amber-300" />
            <span>{Math.round(settings.opacity * 100)}%</span>
          </button>

          <div className="h-3 w-px bg-white/20" />

          {/* Unhide Button */}
          <button
            onClick={() => setIsStealthHidden(false)}
            title="Unhide Interview HUD (Ctrl+\ or Ctrl+Shift+H)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all active:scale-95 no-drag"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Unhide HUD</span>
          </button>

          {/* Quick Capture Toggle */}
          <button
            onClick={handleToggleCapture}
            title={isCapturing ? 'Stop Listening' : 'Start Listening'}
            className={`p-1 rounded-full text-white transition-all no-drag ${
              isCapturing ? 'bg-rose-600 hover:bg-rose-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isCapturing ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // EXPANDED CLUELY-STYLE MINIMALIST HUD
  // -------------------------------------------------------------
  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden relative ${
        settings.clickThrough
          ? 'border-amber-500/60 shadow-[0_0_35px_rgba(245,158,11,0.35)]'
          : 'border-white/15 shadow-2xl'
      }`}
      style={{
        backgroundColor: `rgba(11, 13, 19, ${settings.opacity})`,
        backdropFilter: `blur(${Math.max(4, Math.round(settings.opacity * 24))}px) saturate(180%)`,
        WebkitBackdropFilter: `blur(${Math.max(4, Math.round(settings.opacity * 24))}px) saturate(180%)`,
      }}
    >
      {/* CLICK-THROUGH ACTIVE UNLOCK BANNER */}
      {settings.clickThrough && (
        <div className="bg-amber-500/25 border-b border-amber-500/40 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 z-20 animate-fadeIn no-drag flex-wrap gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
            <span className="truncate">
              <strong>Click-Through Active:</strong> Mouse clicks pass to apps below.
            </span>
          </div>
          <button
            onClick={handleToggleClickThrough}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] shadow transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Unlock className="w-3 h-3" />
            <span>Unlock HUD</span>
          </button>
        </div>
      )}

      {/* 1. TOP CAPSULE DRAG HEADER */}
      <header className="h-12 px-3 flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent select-none drag-region">
        {/* Left: Brand & Return to Dashboard */}
        <div className="flex items-center gap-2 no-drag shrink-0">
          {onReturnToDashboard && (
            <button
              onClick={onReturnToDashboard}
              title="Return to Main Dashboard"
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-zinc-300 transition-all active:scale-95"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Dashboard</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCapturing ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isCapturing ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
            </span>
            <span className="text-xs font-bold tracking-wider text-zinc-100 uppercase">WhisperAI</span>
          </div>
        </div>

        {/* Center: Audio VU Meter (Hidden on ultra-narrow, shown when space permits) */}
        <div className="no-drag hidden sm:flex items-center gap-2 bg-black/40 px-2 py-1 rounded-full border border-white/5 shrink-0">
          <AudioVisualizer
            isCapturing={isCapturing}
            micLevel={audioLevels.micRms}
            loopbackLevel={audioLevels.loopbackRms}
          />
        </div>

        {/* Right: Controls (Listen, Hide, Transparency Slider, Lock, Clear, Settings, Close) */}
        <div className="flex items-center gap-1 sm:gap-1.5 no-drag relative shrink-0">
          {/* Audio Listen / Stop */}
          <button
            onClick={handleToggleCapture}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold tracking-wide text-white transition-all shadow-md active:scale-95 ${
              isCapturing
                ? 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400'
            }`}
          >
            {isCapturing ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span className="hidden sm:inline">Listen</span>
              </>
            )}
          </button>

          {/* HIDE / UNHIDE STEALTH BUTTON */}
          <button
            onClick={() => setIsStealthHidden(true)}
            title="Hide HUD into Stealth Pill (Ctrl+\ or Ctrl+Shift+H)"
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-zinc-200 bg-white/10 hover:bg-white/20 border border-white/10 transition-all hover:scale-105 active:scale-95"
          >
            <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Hide</span>
          </button>

          {/* TRANSPARENCY / OPACITY TOGGLE & SLIDER */}
          <div className="relative">
            <button
              onClick={() => setShowOpacityPopover((prev) => !prev)}
              title={`Transparency Meter (${Math.round(settings.opacity * 100)}%)`}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                showOpacityPopover
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] font-mono">{Math.round(settings.opacity * 100)}%</span>
            </button>

            {/* Interactive Opacity Popover / Slider */}
            {showOpacityPopover && (
              <div className="absolute top-8 right-0 z-50 w-52 sm:w-56 p-3 rounded-2xl bg-zinc-900/95 border border-white/15 shadow-2xl backdrop-blur-xl animate-fadeIn space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>HUD Transparency</span>
                  </span>
                  <span className="font-mono text-indigo-400">{Math.round(settings.opacity * 100)}%</span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min="0.15"
                  max="1.0"
                  step="0.05"
                  value={settings.opacity}
                  onChange={(e) => setOpacityLevel(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />

                {/* Quick Opacity Presets */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[
                    { label: '25%', val: 0.25 },
                    { label: '50%', val: 0.5 },
                    { label: '75%', val: 0.75 },
                    { label: '100%', val: 1.0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setOpacityLevel(p.val)}
                      className={`px-1 py-1 rounded text-[10px] font-mono font-medium transition-all ${
                        Math.abs(settings.opacity - p.val) < 0.08
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Click-Through Lock / Unlock Toggle */}
          <button
            onClick={handleToggleClickThrough}
            title={settings.clickThrough ? 'Disable Click-Through (Ctrl+Shift+T)' : 'Enable Click-Through Mode (Ctrl+Shift+T)'}
            className={`p-1.5 rounded-full transition-all ${
              settings.clickThrough
                ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/40 animate-pulse'
                : 'bg-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10'
            }`}
          >
            {settings.clickThrough ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Clear Button */}
          <button
            onClick={handleClearHistory}
            title="Clear all cards"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            title="Configuration & AI Models"
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Close Window */}
          <button
            onClick={() => WindowService.closeApp()}
            title="Quit Application (Ctrl+Shift+Q)"
            className="p-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. QUICK ASSIST CHIPS BAR (Responsive horizontal scroll) */}
      <div className="px-3 py-1.5 bg-black/30 border-b border-white/5 flex items-center gap-1.5 no-drag overflow-x-auto text-[11px] cluely-scrollbar">
        <button
          onClick={() => handleQuickChip('Give me instant technical assistance')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/5 transition-all whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3 h-3 text-blue-400" />
          <span>Assist</span>
        </button>

        <button
          onClick={() => handleQuickChip('What is the exact 1st-person quote I should say out loud right now?')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/5 transition-all whitespace-nowrap shrink-0"
        >
          <Wand2 className="w-3 h-3 text-indigo-400" />
          <span>What should I say?</span>
        </button>

        <button
          onClick={() => handleQuickChip('Suggest 2 smart follow-up questions to ask the interviewer')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/5 transition-all whitespace-nowrap shrink-0"
        >
          <MessageSquare className="w-3 h-3 text-amber-400" />
          <span>Follow-up questions</span>
        </button>

        <button
          onClick={() => handleQuickChip('Summarize the last 2 minutes of discussion into key points')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/5 transition-all whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3 h-3 text-emerald-400" />
          <span>Recap</span>
        </button>
      </div>

      {/* 3. MAIN CARDS FEED (Scrollable) */}
      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5 sm:space-y-3 select-text no-drag cluely-scrollbar"
      >
        {/* Real-time generating skeleton */}
        {isGenerating && (
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 backdrop-blur-md animate-pulse">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-xs font-semibold text-indigo-300">Generating instant copilot response...</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 bg-indigo-500/20 rounded-md w-3/4" />
              <div className="h-3 bg-indigo-500/10 rounded-md w-full" />
              <div className="h-3 bg-indigo-500/10 rounded-md w-5/6" />
            </div>
          </div>
        )}

        {/* Suggestions List */}
        {suggestions.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
            <Sparkles className="w-8 h-8 text-indigo-400/40 mb-2" />
            <p className="text-xs font-medium text-zinc-400">Ready for Interview Audio</p>
            <p className="text-[11px] text-zinc-600 max-w-xs mt-1">
              Click <strong className="text-indigo-400">Listen</strong> to capture interviewer voice, or type a question below.
            </p>
          </div>
        )}

        {suggestions.map((suggestion) => (
          <AnswerCard key={suggestion.id} suggestion={suggestion} />
        ))}
      </main>

      {/* 4. LIVE TRANSCRIPTION RIBBON */}
      {(isCapturing || interimText || transcripts.length > 0) && (
        <div className="px-3 py-1.5 border-t border-white/10 bg-black/40 text-xs text-zinc-300 flex items-center gap-2 no-drag">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 shrink-0">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>LIVE:</span>
          </div>
          <div className="truncate flex-1 font-mono text-[11px] text-zinc-300">
            {interimText ? (
              <span className="text-emerald-400 animate-pulse">{interimText}</span>
            ) : transcripts.length > 0 ? (
              transcripts[transcripts.length - 1].text
            ) : (
              <span className="text-zinc-500 italic">Listening for interview speech...</span>
            )}
          </div>
        </div>
      )}

      {/* 5. BOTTOM PROMPT BAR */}
      <div className="px-2.5 sm:px-3 py-2 bg-[#0E1017] border-t border-white/10 no-drag">
        <form onSubmit={handleManualSubmit} className="relative flex items-center">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Ask about conversation, or ^ ↵ for Assist..."
            className="w-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] text-zinc-100 placeholder-zinc-500 text-xs pl-3 pr-20 sm:pr-24 py-2 sm:py-2.5 rounded-xl border border-white/10 focus:border-blue-500/50 focus:outline-none transition-all"
          />
          <div className="absolute right-1.5 flex items-center gap-1 sm:gap-1.5">
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/10 text-zinc-300 hidden xs:inline">
              Smart
            </span>
            <button
              type="submit"
              disabled={!manualInput.trim() || isGenerating}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white transition-all flex items-center justify-center shadow"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>
      </div>

      {/* 6. FOOTER STATUS BAR */}
      <footer className="h-6 sm:h-7 px-3 flex items-center justify-between border-t border-white/5 bg-black/60 text-[9px] sm:text-[10px] text-zinc-400 select-none drag-region">
        <div className="flex items-center gap-2 no-drag">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Engine: {settings.modelProvider.toUpperCase()}</span>
          </span>
          <span className="text-zinc-600">•</span>
          {/* Clickable Opacity Quick Cycle in Footer */}
          <button
            onClick={cycleOpacity}
            title="Click to cycle opacity (100% -> 75% -> 50% -> 25%)"
            className="hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Sun className="w-2.5 h-2.5 text-amber-300" />
            <span>Opacity: {Math.round(settings.opacity * 100)}%</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-zinc-500 font-mono no-drag">
          <span>Hide: Ctrl+\</span>
          <span>Lock: Ctrl+Shift+T</span>
          <span>Quit: Ctrl+Shift+Q</span>
        </div>
      </footer>

      {/* Settings Modal Component */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={(updated) => {
            setSettings((prev) => ({ ...prev, ...updated }));
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

