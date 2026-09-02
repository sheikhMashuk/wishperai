import React, { useState } from 'react';
import type { CopilotSuggestion } from '../../types';
import { Sparkles, Code2, Layers, CheckCircle2, Copy, Check, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

interface AnswerCardProps {
  suggestion: CopilotSuggestion;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ suggestion }) => {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(true);

  const handleCopy = () => {
    const textToCopy = suggestion.codeSnippet
      ? suggestion.codeSnippet.code
      : `${suggestion.summary}\n\n${suggestion.bulletPoints.map((b) => `• ${b}`).join('\n')}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getIntentBadge = () => {
    switch (suggestion.intent) {
      case 'BEHAVIORAL':
        return {
          label: 'STAR Method',
          icon: <CheckCircle2 className="w-3 h-3 text-amber-400" />,
          color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        };
      case 'CODING_ALGORITHM':
        return {
          label: 'Algorithm',
          icon: <Code2 className="w-3 h-3 text-cyan-400" />,
          color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        };
      case 'SYSTEM_DESIGN':
        return {
          label: 'Architecture',
          icon: <Layers className="w-3 h-3 text-purple-400" />,
          color: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
        };
      default:
        return {
          label: 'Direct Answer',
          icon: <Sparkles className="w-3 h-3 text-indigo-400" />,
          color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
        };
    }
  };

  const badge = getIntentBadge();

  return (
    <div
      className="rounded-xl p-3.5 mb-2.5 transition-all animate-fadeIn"
      style={{
        background: 'linear-gradient(180deg, rgba(26, 29, 41, 0.75) 0%, rgba(18, 20, 29, 0.85) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      {/* Header & Question */}
      <div className="flex items-start justify-between gap-2.5 mb-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badge.color}`}>
              {badge.icon}
              {badge.label}
            </span>
            {suggestion.latencyMs !== undefined && (
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-500/30">
                ⚡ {suggestion.latencyMs}ms
              </span>
            )}
            {suggestion.modelUsed && (
              <span className="text-[10px] text-zinc-400 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/5">
                {suggestion.modelUsed}
              </span>
            )}
            {suggestion.codeSnippet?.complexity && (
              <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded border border-white/5">
                {suggestion.codeSnippet.complexity}
              </span>
            )}
          </div>
          <h3 className="text-xs font-semibold text-zinc-100 leading-snug">
            {suggestion.question}
          </h3>
        </div>

        {/* Card Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopy}
            title="Copy answer"
            className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Spoken Summary / Direct Response Capsule */}
      <div className="p-2.5 rounded-lg mb-2 bg-gradient-to-b from-indigo-950/40 to-black/40 border border-indigo-500/20">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1">
          <MessageSquare className="w-3 h-3 text-indigo-400" />
          <span>Say This:</span>
        </div>
        <p className="text-xs text-zinc-200 font-medium leading-relaxed">
          {suggestion.summary}
        </p>
      </div>

      {showDetails && (
        <div className="space-y-2.5 pt-1">
          {/* STAR Breakdown if applicable */}
          {suggestion.starStory && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">Situation</span>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{suggestion.starStory.situation}</p>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-0.5">Task</span>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{suggestion.starStory.task}</p>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">Action</span>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{suggestion.starStory.action}</p>
              </div>
              <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-0.5">Result</span>
                <p className="text-zinc-300 text-[11px] leading-relaxed">{suggestion.starStory.result}</p>
              </div>
            </div>
          )}

          {/* Key Talking Points */}
          {suggestion.bulletPoints.length > 0 && (
            <div className="bg-black/20 p-2 rounded-lg border border-white/5">
              <ul className="space-y-1.5 text-xs text-zinc-300">
                {suggestion.bulletPoints.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    <span className="leading-relaxed text-[11px]">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Code Snippet Container */}
          {suggestion.codeSnippet && (
            <div className="bg-black/70 rounded-lg p-2.5 border border-white/10 font-mono text-xs overflow-x-auto">
              <div className="flex justify-between items-center mb-1 text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
                <span className="text-indigo-300 font-semibold">{suggestion.codeSnippet.language}</span>
                <span className="text-zinc-500">Optimal Complexity</span>
              </div>
              <pre className="text-emerald-300 text-[11px] leading-relaxed py-1">
                <code>{suggestion.codeSnippet.code}</code>
              </pre>
            </div>
          )}

          {/* Retrieved Resume Context match tags */}
          {suggestion.retrievedContext && suggestion.retrievedContext.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {suggestion.retrievedContext.map((tag, idx) => (
                <span key={idx} className="text-[9px] font-medium bg-indigo-950/60 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  ⚡ {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
