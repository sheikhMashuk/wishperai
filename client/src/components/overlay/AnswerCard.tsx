import { useState } from 'react';
import type { Answer } from '../../types';
import { Check, Copy, Loader2 } from 'lucide-react';

const INTENT_LABEL: Record<Answer['intent'], string> = {
  BEHAVIORAL: 'Behavioral',
  CODING_ALGORITHM: 'Coding',
  SYSTEM_DESIGN: 'System design',
  TECHNICAL_KNOWLEDGE: 'Technical',
  GENERAL: 'General',
};

export function AnswerCard({ answer }: { answer: Answer }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const text = answer.code
      ? answer.code.content
      : [answer.headline, ...answer.points.map((p) => `• ${p}`)].join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="fade-in rounded-xl border border-[var(--line)] bg-[var(--raise)] px-3.5 py-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-[var(--text-faint)]">
          <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-medium text-[var(--text-dim)]">
            {INTENT_LABEL[answer.intent]}
          </span>
          {answer.streaming ? (
            <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />
          ) : (
            !answer.error && answer.latencyMs != null && <span>{answer.latencyMs} ms</span>
          )}
          {answer.model && !answer.streaming && !answer.error && (
            <span className="truncate text-[var(--text-faint)]">{answer.model}</span>
          )}
        </div>
        <button
          onClick={copy}
          title="Copy"
          className="no-drag shrink-0 rounded-md p-1 text-[var(--text-faint)] transition-colors hover:bg-white/[0.08] hover:text-[var(--text)]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </header>

      <p className="truncate text-[11px] text-[var(--text-faint)]" title={answer.question}>
        {answer.question}
      </p>

      <p
        className={`mt-1.5 text-[13.5px] leading-relaxed ${
          answer.error ? 'text-[var(--danger)]' : 'text-[var(--text)]'
        }`}
      >
        {answer.headline || (answer.streaming ? '…' : '')}
      </p>

      {answer.points.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {answer.points.map((point, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-faint)]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {answer.code && (
        <div className="mt-2.5 overflow-hidden rounded-lg border border-[var(--line)] bg-black/40">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-2.5 py-1 text-[10.5px] text-[var(--text-faint)]">
            <span>{answer.code.language}</span>
            {answer.code.complexity && <span>{answer.code.complexity}</span>}
          </div>
          <pre className="scroll-thin overflow-x-auto px-2.5 py-2 text-[11.5px] leading-relaxed text-[var(--text-dim)]">
            <code>{answer.code.content}</code>
          </pre>
        </div>
      )}
    </article>
  );
}
