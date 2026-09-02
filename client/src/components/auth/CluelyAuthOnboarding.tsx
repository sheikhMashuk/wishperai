import { useState, useEffect } from 'react';
import type { FC } from 'react';
import {
  Compass,
  ArrowRight,
  Search,
  GraduationCap,
  Briefcase,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Wand2,
  MessageSquare,
  RotateCcw,
  Send,
  ChevronRight,
  Check,
  EyeOff,
} from 'lucide-react';

interface CluelyAuthOnboardingProps {
  onComplete: () => void;
  onLaunchOverlay: () => void;
}

export const CluelyAuthOnboarding: FC<CluelyAuthOnboardingProps> = ({
  onComplete,
  onLaunchOverlay,
}) => {
  const [step, setStep] = useState<number>(0);
  const [selectedPersona, setSelectedPersona] = useState<string>('job');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(['Engineering']);
  const [selectedSources, setSelectedSources] = useState<string[]>(['Google']);
  const [shortcutTested, setShortcutTested] = useState<boolean>(false);
  const [isDemoHidden, setIsDemoHidden] = useState<boolean>(false);
  const [pressedKeys, setPressedKeys] = useState<{ ctrl: boolean; backslash: boolean; shift: boolean; h: boolean }>({
    ctrl: false,
    backslash: false,
    shift: false,
    h: false,
  });

  // Keyboard shortcut detector for Step 3
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isBackslash = e.key === '\\' || e.code === 'Backslash';
      const isH = e.key.toLowerCase() === 'h';
      const isShift = e.shiftKey;

      if (isCtrl || isBackslash || isH || isShift) {
        setPressedKeys({
          ctrl: isCtrl,
          backslash: isBackslash,
          shift: isShift,
          h: isH,
        });
      }

      // If Ctrl + \ OR Ctrl + Shift + H is pressed
      if ((isCtrl && isBackslash) || (isCtrl && isShift && isH)) {
        e.preventDefault();
        setIsDemoHidden((prev) => !prev);
        setShortcutTested(true);
      }
    };

    const handleKeyUp = () => {
      setPressedKeys({ ctrl: false, backslash: false, shift: false, h: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const toggleIndustry = (ind: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(ind) ? prev.filter((i) => i !== ind) : [...prev, ind]
    );
  };

  const toggleSource = (src: string) => {
    setSelectedSources((prev) =>
      prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
    );
  };

  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      localStorage.setItem('whisperai_onboarded', 'true');
      onComplete();
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans select-none">
      {/* ========================================================================= */}
      {/* LEFT PANE: WHITE APPLE/VERCEL MINIMALIST ONBOARDING CARD */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[48%] bg-white flex flex-col justify-between p-8 lg:p-14 border-r border-slate-200/80 shadow-[10px_0_30px_-15px_rgba(0,0,0,0.03)] z-10 overflow-y-auto">
        {/* Top Progress & Brand */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">WhisperAI</span>
            </div>

            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step === i
                      ? 'w-6 bg-blue-600'
                      : i < step
                      ? 'w-2 bg-blue-400'
                      : 'w-2 bg-slate-200 hover:bg-slate-300'
                  }`}
                  title={`Go to step ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STEP 0: WELCOME & VALUE PROPOSITION */}
          {/* ------------------------------------------------------------- */}
          {step === 0 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-3">
                <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Welcome to WhisperAI
                </h1>
                <p className="text-base text-slate-500 font-normal">
                  The ultimate AI interview & meeting copilot. 100% invisible on Zoom, Meet, and Teams.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleNextStep}
                  className="w-full py-3.5 px-6 rounded-2xl text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/35 transition-all duration-200 flex items-center justify-center gap-2 group active:scale-[0.99]"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-400">
                  By signing up, you agree to our{' '}
                  <span className="text-slate-600 hover:underline cursor-pointer">Terms of Service</span> and{' '}
                  <span className="text-slate-600 hover:underline cursor-pointer">Privacy Policy</span>.
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 1: PERSONA SELECTOR ("Which one fits you best?") */}
          {/* ------------------------------------------------------------- */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Which one fits you best?
                </h1>
                <p className="text-sm text-slate-500">
                  Personalize your copilot suggestions and answer speed.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {[
                  {
                    id: 'job',
                    title: 'Looking for a job',
                    desc: 'Interviews, technical coding rounds, career chats',
                    icon: Search,
                  },
                  {
                    id: 'student',
                    title: 'Student',
                    desc: 'Presentations, research help, defense, office hours',
                    icon: GraduationCap,
                  },
                  {
                    id: 'pro',
                    title: 'Professional',
                    desc: 'Client calls, sales pitches, stakeholder syncs',
                    icon: Briefcase,
                  },
                  {
                    id: 'curious',
                    title: 'Curious',
                    desc: 'Explore how WhisperAI fits in with your workflow',
                    icon: Lightbulb,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedPersona === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedPersona(item.id);
                        handleNextStep();
                      }}
                      className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between group ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 2: INDUSTRY & ATTRIBUTION ("Tell us more") */}
          {/* ------------------------------------------------------------- */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Tell us more
                </h1>
                <p className="text-sm text-slate-500">
                  Customize the AI vocabulary and domain expertise.
                </p>
              </div>

              {/* Industry Grid */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  What industry are you in?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Engineering',
                    'Product',
                    'Design',
                    'Sales / GTM',
                    'Recruiting',
                    'Finance',
                    'Consulting',
                    'Marketing',
                    'Management',
                    'Legal',
                    'Operations',
                    'HR',
                    'Video Editing',
                    'Other',
                  ].map((ind) => {
                    const active = selectedIndustries.includes(ind);
                    return (
                      <button
                        key={ind}
                        onClick={() => toggleIndustry(ind)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {ind}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Referral Source */}
              <div className="space-y-2.5 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  How did you hear about WhisperAI?
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Google',
                    'LinkedIn',
                    'YouTube',
                    'Email',
                    'Twitter / X',
                    'TikTok',
                    'Instagram',
                    'Reddit',
                    'Podcast',
                    'Word of mouth',
                    'Other',
                  ].map((src) => {
                    const active = selectedSources.includes(src);
                    return (
                      <button
                        key={src}
                        onClick={() => toggleSource(src)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          active
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleNextStep}
                  className="w-full py-3.5 px-6 rounded-2xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition-all active:scale-[0.99]"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STEP 3: INTERACTIVE SHORTCUT TEST ("Hide and show on the fly") */}
          {/* ------------------------------------------------------------- */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
                  Interactive Tutorial
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Hide and show WhisperAI on the fly
                </h1>
                <p className="text-sm text-slate-500">
                  Press the keyboard shortcut to try toggling the stealth copilot overlay.
                </p>
              </div>

              {/* Big Interactive Keyboard Badges */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`px-4 py-3 rounded-xl border-2 font-mono text-base font-bold shadow-md transition-all duration-150 ${
                      pressedKeys.ctrl
                        ? 'bg-blue-600 text-white border-blue-600 scale-95 shadow-inner'
                        : 'bg-white text-slate-800 border-slate-200 shadow-slate-200'
                    }`}
                  >
                    Ctrl
                  </div>
                  <span className="text-slate-400 font-bold">+</span>
                  <div
                    className={`px-4 py-3 rounded-xl border-2 font-mono text-base font-bold shadow-md transition-all duration-150 ${
                      pressedKeys.backslash || pressedKeys.h
                        ? 'bg-blue-600 text-white border-blue-600 scale-95 shadow-inner'
                        : 'bg-white text-slate-800 border-slate-200 shadow-slate-200'
                    }`}
                  >
                    \
                  </div>
                </div>

                <p className="text-xs text-slate-500 text-center mt-1">
                  {shortcutTested ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1 justify-center">
                      <Check className="w-4 h-4" /> Shortcut Verified! Overlay is toggling smoothly.
                    </span>
                  ) : (
                    'Press Ctrl + \\ on your keyboard now to test'
                  )}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleNextStep}
                  className="w-full py-3.5 px-6 rounded-2xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-[0.99]"
                >
                  {shortcutTested ? 'Launch WhisperAI Dashboard' : 'Use the shortcut to continue'}
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('whisperai_onboarded', 'true');
                    onComplete();
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center gap-1"
                >
                  <span>Skip to Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Social Proof Logos (Matching Screenshot 1) */}
        <div className="pt-8 border-t border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center lg:text-left">
            Trusted by candidates interviewing at top tech companies
          </p>
          <div className="flex items-center justify-between opacity-50 grayscale hover:grayscale-0 transition-all gap-4 text-xs font-serif font-bold text-slate-700">
            <span>BUSINESS INSIDER</span>
            <span>Forbes</span>
            <span>The New York Times</span>
            <span>TechCrunch</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT PANE: INTERACTIVE LIVE PREVIEW OVERLAY ON BLUEPRINT GRID */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[52%] bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 relative flex flex-col items-center justify-center p-6 lg:p-12 overflow-hidden">
        {/* Subtle Architectural Blueprint Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.45] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#CBD5E1 1px, transparent 1px), linear-gradient(90deg, #CBD5E1 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Ambient Radial Gradient Glow */}
        <div className="absolute w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-lg space-y-6 flex flex-col items-center">
          {/* Dynamic Right Preview Card depending on Step */}
          {step === 0 && (
            <div className="w-full space-y-4 animate-fadeIn">
              {/* Floating Cluely-style Capsule HUD */}
              <div className="flex justify-end pr-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs backdrop-blur-md shadow-xl border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[10px]">
                    <Compass className="w-2.5 h-2.5" />
                  </div>
                  <button
                    onClick={() => setIsDemoHidden(!isDemoHidden)}
                    className="flex items-center gap-1 font-medium hover:text-blue-300 transition-colors"
                  >
                    <span>^ Hide</span>
                  </button>
                  <div className="w-2 h-2 rounded-sm bg-white/40" />
                </div>
              </div>

              {/* Floating Dark Glass Assistant Card (Image 1 Right) */}
              <div className="w-full rounded-2xl bg-slate-900/90 border border-white/15 p-5 text-white shadow-2xl backdrop-blur-2xl space-y-3.5 transition-all hover:border-blue-500/40">
                {/* Prompt Pill */}
                <div className="flex justify-end">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white shadow-md">
                    What should I say next?
                  </span>
                </div>

                {/* Search / Quote Block */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Search className="w-3 h-3" />
                    <span>Searched candidate records & resume</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    "So just to recap, you need a low-latency event gateway handling 100k concurrent connections. I'll get a system architecture spec over to you by this evening, and let's do a technical kickoff next Wednesday if that works for you?"
                  </p>
                </div>

                {/* Assist Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-300">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-blue-400" />
                    <span>Assist</span>
                  </span>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1">
                    <Wand2 className="w-2.5 h-2.5 text-indigo-400" />
                    <span>What should I say?</span>
                  </span>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1">
                    <MessageSquare className="w-2.5 h-2.5 text-amber-400" />
                    <span>Follow-up questions</span>
                  </span>
                  <span>·</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer flex items-center gap-1">
                    <RotateCcw className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Recap</span>
                  </span>
                </div>

                {/* Prompt Input Bar (Image 1 Bottom) */}
                <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] truncate">
                    Ask about your screen or conversation, or <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">^</kbd> <kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px]">↵</kbd> for Assist
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300">
                      Smart
                    </span>
                    <button className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white shadow hover:bg-blue-500 transition-colors">
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Tagline */}
              <div className="text-center pt-3">
                <h3 className="text-xl font-bold tracking-tight text-slate-800">
                  Real-time meeting assistant, always ready to help
                </h3>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="w-full space-y-4 animate-fadeIn">
              {/* Image 2 Right Card */}
              <div className="w-full rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Meeting in 2 minutes</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Product Roadmap & Architecture Sync
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>3 participants</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-800">
                    Roy Lee (Staff Eng)
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-50 text-xs text-slate-500">
                    Alex Chen
                  </span>
                  <span className="px-2 py-1 rounded-md bg-slate-50 text-xs text-slate-500">
                    Neel Shanmugam
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Interviewer: Head of Infrastructure Engineering. Primary focus: Distributed consensus, low-latency queues, and high-concurrency memory safety.
                </p>

                <button
                  onClick={onLaunchOverlay}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Join and Take Live Notes</span>
                </button>
              </div>

              {/* Tagline */}
              <div className="text-center pt-3 space-y-1">
                <p className="text-sm text-slate-600">
                  80% of candidates don't have instant context when surprised by questions.
                </p>
                <h3 className="text-xl font-extrabold text-blue-600 tracking-tight">
                  With WhisperAI, you'll never have to worry.
                </h3>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="w-full space-y-4 animate-fadeIn">
              {/* Image 3 Right Card */}
              <div className="w-full rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    Senior Software Engineer Technical Interview
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                    Follow-up ready
                  </span>
                </div>

                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                      RL
                    </div>
                    <span className="text-xs font-semibold text-slate-800">Roy Lee (Hiring Manager)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                      NS
                    </div>
                    <span className="text-xs font-semibold text-slate-800">Neel Shanmugam (Principal Architect)</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800 block">Candidate STAR Framework:</span>
                  <p className="text-[11px] leading-relaxed">
                    Situation: Handled 120k req/s database bottleneck. Action: Introduced Redis buffer backplane in Rust. Result: Latency reduced from 140ms to 4.2ms.
                  </p>
                </div>
              </div>

              {/* Tagline */}
              <div className="text-center pt-3">
                <h3 className="text-xl font-bold text-slate-900">
                  People perform <span className="text-blue-600 font-extrabold">25% better</span> on technical interviews with WhisperAI
                </h3>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="w-full space-y-4 animate-fadeIn">
              {/* Image 4 Right Live Simulation */}
              <div className="w-full relative">
                {isDemoHidden ? (
                  <div className="p-4 rounded-full bg-slate-900/90 text-white flex items-center justify-center gap-2 shadow-2xl animate-fadeIn border border-white/20">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold">WhisperAI is Hidden (Stealth Pill Active)</span>
                    <button
                      onClick={() => setIsDemoHidden(false)}
                      className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-500"
                    >
                      Unhide
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-900/95 border border-white/20 p-5 text-white shadow-2xl backdrop-blur-2xl space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        Invisible on Zoom / Teams
                      </span>
                      <button
                        onClick={() => setIsDemoHidden(true)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide</span>
                      </button>
                    </div>

                    <div className="flex justify-end">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
                        Is it secure? We handle sensitive technical info.
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-200 leading-relaxed">
                      "We use SOC2-compliant zero-retention pipelines, end-to-end memory encryption, and your context is private to your local hardware. Plus, you can purge transcripts with one click."
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center pt-3">
                <p className="text-xs text-slate-500">
                  Click the test shortcut or buttons above to see the real-time stealth transition.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
