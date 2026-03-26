'use client';

import React from 'react';

interface AnswerViewProps {
  content: string;
  onHoverCitation: (title: string | null) => void;
  showContext: boolean;
}

// Split answer into CONFIRMED and CONTEXT sections.
// Handles optional markdown bold: **CONFIRMED:** or plain CONFIRMED:
function parseSections(content: string): { confirmed: string; context: string } {
  // Find the CONTEXT: marker (must be at the start of a line)
  const contextMatch = content.match(/\n\s*\*{0,2}CONTEXT:?\*{0,2}\s*\n?/i);

  if (!contextMatch || contextMatch.index == null) {
    // Only confirmed section (or still streaming)
    const confirmed = content.replace(/^\s*\*{0,2}CONFIRMED:?\*{0,2}\s*\n?/i, '').trim();
    return { confirmed, context: '' };
  }

  const confirmedRaw = content.slice(0, contextMatch.index);
  const contextRaw = content.slice(contextMatch.index + contextMatch[0].length);

  const confirmed = confirmedRaw.replace(/^\s*\*{0,2}CONFIRMED:?\*{0,2}\s*\n?/i, '').trim();
  const context = contextRaw.trim();

  return { confirmed, context };
}

// Replace [SOURCE: "title", p.X] or [SOURCE: "title"] with interactive badge spans.
function renderWithCitations(
  text: string,
  onHoverCitation: (title: string | null) => void
): React.ReactNode {
  const re = /\[SOURCE:\s*"([^"]+)"(?:,\s*p\.(\d+))?\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }

    const title = match[1];
    const page = match[2];

    parts.push(
      <span
        key={key++}
        onMouseEnter={() => onHoverCitation(title)}
        onMouseLeave={() => onHoverCitation(null)}
        className="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-500 hover:text-white cursor-default transition-colors"
        title={page ? `${title}, p. ${page}` : title}
      >
        {page ? `p. ${page}` : title.split(' ').slice(0, 3).join(' ')}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

export default function AnswerView({ content, onHoverCitation, showContext }: AnswerViewProps) {
  const { confirmed, context } = parseSections(content);
  const hasContext = context.length > 0;

  return (
    <div className="space-y-3">
      {confirmed && (
        <div className="rounded border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
            Confirmed
          </p>
          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {renderWithCitations(confirmed, onHoverCitation)}
          </div>
        </div>
      )}

      {hasContext && showContext && (
        <div className="rounded border border-slate-700/60 bg-slate-800/40 p-4">
          <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-0.5">
            Context
          </p>
          <p className="text-xs text-slate-500 mb-2">Less authoritative sources</p>
          <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
            {renderWithCitations(context, onHoverCitation)}
          </div>
        </div>
      )}

      {/* Streaming: no sections parsed yet — show raw content */}
      {!confirmed && !hasContext && content && (
        <div className="rounded border border-slate-700 bg-slate-800 p-4">
          <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
