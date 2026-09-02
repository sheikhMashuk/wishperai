import { useState } from 'react';
import type { FC } from 'react';
import {
  Search,
  RefreshCw,
  Compass,
  Monitor,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
  Mic,
  Clock,
  ExternalLink,
  Minimize2,
  X,
  Zap,
} from 'lucide-react';
import type { AppSettings } from '../../types';
import { WindowService } from '../../services/windowService';

interface MainDashboardProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onStartOverlay: () => void;
  onOpenSettings: () => void;
}

export const MainDashboard: FC<MainDashboardProps> = ({
  settings,
  onUpdateSettings,
  onStartOverlay,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stealthActive, setStealthActive] = useState(settings.stealthModeEnabled);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pastSessions = [
    {
      id: 'sess-1',
      title: 'Google Staff Engineer System Design',
      date: 'Today, 2:30 PM',
      duration: '42 min',
      tags: ['System Design', 'Rust', 'Distributed Queues'],
      score: '98% Accuracy',
      summary: 'Discussed bounded buffer backpressure and epoll event loops for 100k WS connections.',
    },
    {
      id: 'sess-2',
      title: 'Stripe Technical Coding & Algorithms',
      date: 'Yesterday, 4:15 PM',
      duration: '35 min',
      tags: ['Algorithms', 'Concurrency', 'Rate Limiting'],
      score: '95% Accuracy',
      summary: 'Implemented Token Bucket rate limiter with sliding window log eviction in Go.',
    },
  ];

  const handleToggleStealth = () => {
    const next = !stealthActive;
    setStealthActive(next);
    onUpdateSettings({ stealthModeEnabled: next });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0B0D13] text-zinc-100 select-none overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP TITLE BAR & SEARCH */}
      {/* ========================================================================= */}
      <header className="h-12 px-3 sm:px-4 flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0E1017] drag-region">
        {/* Left: Search input */}
        <div className="flex items-center gap-3 no-drag flex-1 max-w-md min-w-0">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or ask anything... (Ctrl+K)"
              className="w-full bg-white/[0.06] hover:bg-white/[0.09] focus:bg-white/[0.12] text-xs text-zinc-200 placeholder-zinc-500 rounded-lg pl-8 pr-3 py-1.5 border border-white/5 focus:border-indigo-500/40 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Right: Avatar Badge & Window Controls */}
        <div className="flex items-center gap-2 sm:gap-3 no-drag shrink-0">
          {/* User Profile Badge */}
          <div
            onClick={onOpenSettings}
            title="Account & Settings"
            className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center text-[11px] font-bold shadow cursor-pointer hover:scale-105 transition-transform"
          >
            H
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Window Buttons */}
          <div className="flex items-center gap-1 text-zinc-400">
            <button
              onClick={() => WindowService.hideWindow()}
              title="Minimize"
              className="p-1 hover:bg-white/10 hover:text-zinc-200 rounded transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => WindowService.closeApp()}
              title="Close Application"
              className="p-1 hover:bg-rose-600/80 hover:text-white rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. SUBHEADER WITH STEALTH TOGGLE & GLOWING START BUTTON */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-white/[0.06] bg-[#0E1017]/60 space-y-3.5">
        {/* Banner Pill */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <a
            href="https://whisperai.io/changelog"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
          >
            <span>WhisperAI v2.1 Active</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="text-[11px] text-zinc-400 font-mono hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Low-Latency Ready</span>
          </div>
        </div>

        {/* Title, Stealth Switch & Start Button */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">WhisperAI</h1>
              <button
                onClick={handleRefresh}
                title="Refresh AI Session State"
                className={`p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-all ${
                  isRefreshing ? 'animate-spin text-indigo-400' : ''
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Detectable / Stream-Safe Switch */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs">
              {stealthActive ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="text-zinc-300 font-medium text-[11px] sm:text-xs">
                {stealthActive ? 'Stream-Safe' : 'Detectable'}
              </span>
              <button
                onClick={handleToggleStealth}
                className={`w-7 sm:w-8 h-4 rounded-full transition-colors relative p-0.5 ${
                  stealthActive ? 'bg-emerald-600' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white transition-transform ${
                    stealthActive ? 'translate-x-3 sm:translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex flex-col items-end gap-1 w-full sm:w-auto">
            <button
              onClick={onStartOverlay}
              className="w-full sm:w-auto px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-[0_0_25px_rgba(59,130,246,0.5)] hover:shadow-[0_0_35px_rgba(59,130,246,0.7)] transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Start WhisperAI Copilot</span>
            </button>
            <span className="text-[10px] text-zinc-500 font-medium">
              3 free meetings left · Pro Active
            </span>
          </div>
        </div>

        {/* Link Calendar / Resume Context Ribbon */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer pt-0.5">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span onClick={onOpenSettings} className="truncate">
            Link calendar or update resume context to auto-trigger smart interview cards.
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN DASHBOARD CONTENT */}
      {/* ========================================================================= */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 cluely-scrollbar">
        {/* Center Dashed Box */}
        <div className="w-full p-5 sm:p-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 shadow-inner">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Start your first session
          </h2>

          <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
            WhisperAI provides live AI help during your conversation and generates searchable summaries afterwards.
          </p>

          <div className="pt-1">
            <button
              onClick={onStartOverlay}
              className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 transition-all shadow active:scale-95"
            >
              Launch Floating Overlay
            </button>
          </div>
        </div>

        {/* Quick Capabilities / Models Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">Active AI Model</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-sm font-bold text-white capitalize">{settings.modelProvider} Engine</div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Sub-300ms ultra-low-latency responses tuned for high-stakes interviews.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">Audio Loopback</span>
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-white">Dual-Channel Stream</div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Captures interviewer audio directly from system output without virtual cables.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 sm:space-y-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">Privacy & Stealth</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-white">WDA_EXCLUDEFROMCAPTURE</div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Native Win32 hardware layer blocks all screen capture and window detection.
            </p>
          </div>
        </div>

        {/* Recent Past Sessions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Recent Practice & Interview Sessions
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">2 Saved</span>
          </div>

          <div className="space-y-2.5">
            {pastSessions.map((s) => (
              <div
                key={s.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-all flex items-center justify-between gap-3 sm:gap-4 cursor-pointer group"
                onClick={onStartOverlay}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">
                      {s.title}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                      {s.score}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{s.summary}</p>
                  <div className="flex items-center flex-wrap gap-2 text-[10px] text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{s.date} ({s.duration})</span>
                    </span>
                    <span>•</span>
                    <div className="flex items-center flex-wrap gap-1">
                      {s.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 4. FOOTER STATUS BAR */}
      {/* ========================================================================= */}
      <footer className="h-auto min-h-8 py-1 px-4 sm:px-6 flex items-center justify-between flex-wrap gap-2 border-t border-white/[0.06] bg-[#0E1017] text-[10px] sm:text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WhisperAI Engine Ready</span>
          </span>
          <span>•</span>
          <span>Latency: &lt;200ms</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={onOpenSettings} className="hover:text-zinc-300 transition-colors">
            Configure Models
          </button>
          <span>•</span>
          <span>v2.1.0 Stable</span>
        </div>
      </footer>
    </div>
  );
};

