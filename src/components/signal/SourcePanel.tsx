'use client';

import type { Source } from './types';

const TIER_CONFIG: Record<1 | 2 | 3, { label: string; dot: string; badge: string }> = {
  1: { label: 'Tier 1 — Official', dot: 'bg-green-500', badge: 'text-green-400 border-green-800' },
  2: { label: 'Tier 2 — Scientific', dot: 'bg-yellow-500', badge: 'text-yellow-400 border-yellow-800' },
  3: { label: 'Tier 3 — Unverified', dot: 'bg-red-500', badge: 'text-red-400 border-red-800' },
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  government_report: 'Gov Report',
  scientific_report: 'Scientific',
  technical_report: 'Technical',
  congressional_testimony: 'Testimony',
  foia_document: 'FOIA',
  scientific_paper: 'Paper',
  investigative_journalism: 'Press',
  witness_account: 'Witness',
};

interface SourcePanelProps {
  sources: Source[];
  highlightedTitle: string | null;
  onHoverSource: (title: string | null) => void;
}

export default function SourcePanel({ sources, highlightedTitle, onHoverSource }: SourcePanelProps) {
  const sorted = [...sources].sort((a, b) => a.tier - b.tier);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Sources ({sorted.length})
      </p>
      {sorted.map((source, i) => {
        const tier = TIER_CONFIG[source.tier];
        const isHighlighted = highlightedTitle === source.title;
        const typeLabel = source.sourceType ? SOURCE_TYPE_LABELS[source.sourceType] ?? source.sourceType : null;

        return (
          <div
            key={i}
            onMouseEnter={() => onHoverSource(source.title)}
            onMouseLeave={() => onHoverSource(null)}
            className={`rounded border p-3 transition-colors cursor-default ${isHighlighted
              ? 'border-slate-500 bg-slate-700'
              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded border ${tier.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tier.dot}`} />
                {tier.label}
              </span>
              {typeLabel && (
                <span className="text-xs px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">
                  {typeLabel}
                </span>
              )}
              {source.declassified && (
                <span className="text-xs px-1.5 py-0.5 rounded border border-blue-800 text-blue-400">
                  DECLASSIFIED
                </span>
              )}
            </div>

            <p className="text-sm text-slate-200 font-medium leading-snug">
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer"
                  className="hover:text-white hover:underline">
                  {source.title}
                </a>
              ) : (
                source.title
              )}
            </p>

            <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
              {source.page != null && <span>p.&nbsp;{source.page}</span>}
              {source.date && <span>{new Date(source.date).getFullYear()}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}