'use client';

import React from 'react';

interface AnswerViewProps {
  content: string;
  onHoverCitation: (title: string | null) => void;
  showContext: boolean;
}

function parseSections(content: string): { confirmed: string; context: string } {
  const contextMatch = content.match(/\n\s*\*{0,2}CONTEXT:?\*{0,2}\s*\n?/i);
  if (!contextMatch || contextMatch.index == null) {
    const confirmed = content.replace(/^\s*\*{0,2}CONFIRMED:?\*{0,2}\s*\n?/i, '').trim();
    return { confirmed, context: '' };
  }
  const confirmedRaw = content.slice(0, contextMatch.index);
  const contextRaw = content.slice(contextMatch.index + contextMatch[0].length);
  return {
    confirmed: confirmedRaw.replace(/^\s*\*{0,2}CONFIRMED:?\*{0,2}\s*\n?/i, '').trim(),
    context: contextRaw.trim(),
  };
}

function renderWithCitations(
  text: string,
  onHoverCitation: (title: string | null) => void
): React.ReactNode {
  // Split text into lines and render with markdown-like formatting
  const lines = text.split('\n');
  let key = 0;

  const renderInline = (line: string): React.ReactNode => {
    const re = /\[SOURCE:\s*"([^"]+)"(?:,\s*p\.(\d+))?\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Handle bold **text**
    const boldAndCite = (str: string): React.ReactNode[] => {
      const boldRe = /\*\*(.+?)\*\*/g;
      const nodes: React.ReactNode[] = [];
      let bi = 0;
      let bm: RegExpExecArray | null;
      while ((bm = boldRe.exec(str)) !== null) {
        if (bm.index > bi) nodes.push(<span key={key++}>{str.slice(bi, bm.index)}</span>);
        nodes.push(<strong key={key++} className="text-slate-100 font-semibold">{bm[1]}</strong>);
        bi = bm.index + bm[0].length;
      }
      if (bi < str.length) nodes.push(<span key={key++}>{str.slice(bi)}</span>);
      return nodes;
    };

    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...boldAndCite(line.slice(lastIndex, match.index)));
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
    if (lastIndex < line.length) {
      parts.push(...boldAndCite(line.slice(lastIndex)));
    }
    return <>{parts}</>;
  };

  return (
    <>
      {lines.map((line, i) => {
        // Bullet points
        if (/^[\s]*[-*]\s/.test(line)) {
          return (
            <li key={i} className="ml-4 list-disc text-sm text-slate-200 leading-relaxed">
              {renderInline(line.replace(/^[\s]*[-*]\s/, ''))}
            </li>
          );
        }
        // Empty line = paragraph break
        if (line.trim() === '') return <div key={i} className="h-2" />;
        // Normal line
        return (
          <p key={i} className="text-sm text-slate-200 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </>
  );
}

export default function AnswerView({ content, onHoverCitation, showContext }: AnswerViewProps) {
  const { confirmed, context } = parseSections(content);
  const hasContext = context.length > 0;

  return (
    <div className="space-y-3">
      {confirmed && (
        <div className="rounded border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">
            ✓ Confirmed
          </p>
          <div className="space-y-1">
            {renderWithCitations(confirmed, onHoverCitation)}
          </div>
        </div>
      )}

      {hasContext && showContext && (
        <div className="rounded border border-slate-700/60 bg-slate-800/40 p-4">
          <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-0.5">
            ⚠ Context
          </p>
          <p className="text-xs text-slate-500 mb-3">From secondary or scientific sources</p>
          <div className="space-y-1">
            {renderWithCitations(context, onHoverCitation)}
          </div>
        </div>
      )}

      {!confirmed && !hasContext && content && (
        <div className="rounded border border-slate-700 bg-slate-800 p-4">
          <div className="space-y-1">
            {renderWithCitations(content, onHoverCitation)}
          </div>
        </div>
      )}
    </div>
  );
}