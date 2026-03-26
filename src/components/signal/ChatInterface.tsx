'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import AnswerView from './AnswerView';
import SourcePanel from './SourcePanel';
import type { Source } from './types';

export default function ChatInterface() {
  const [sourcesMap, setSourcesMap] = useState<Record<string, Source[]>>({});
  const [highlightedTitle, setHighlightedTitle] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);
  const pendingSourcesRef = useRef<Source[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/signal/query',
    onResponse: (response) => {
      const raw = response.headers.get('X-Sources');
      if (raw) {
        try {
          pendingSourcesRef.current = JSON.parse(raw) as Source[];
        } catch {
          pendingSourcesRef.current = [];
        }
      }
    },
    onFinish: (message) => {
      if (pendingSourcesRef.current.length > 0) {
        setSourcesMap((prev) => ({ ...prev, [message.id]: pendingSourcesRef.current }));
        pendingSourcesRef.current = [];
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const hasMessages = messages.some((m) => m.role === 'user');
  const anyContext = Object.values(sourcesMap).some(() => true);

  const messageContent = (content: unknown): string =>
    typeof content === 'string' ? content : '';

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-slate-500 text-sm text-center max-w-sm">
              Ask anything about UAP disclosures, government reports, or historical sightings.
            </p>
          </div>
        ) : (
          <div className="space-y-10 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-slate-700 rounded-lg px-4 py-2.5 max-w-xl">
                      <p className="text-sm text-slate-100">{messageContent(message.content)}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Answer header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Signal
                      </span>
                      {anyContext && (
                        <button
                          onClick={() => setShowContext((v) => !v)}
                          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {showContext ? 'Hide context sources' : 'Show context sources'}
                        </button>
                      )}
                    </div>

                    {/* Answer + Sources side by side on large screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                      <AnswerView
                        content={messageContent(message.content)}
                        onHoverCitation={setHighlightedTitle}
                        showContext={showContext}
                      />

                      {sourcesMap[message.id] && sourcesMap[message.id].length > 0 && (
                        <SourcePanel
                          sources={sourcesMap[message.id]}
                          highlightedTitle={highlightedTitle}
                          onHoverSource={setHighlightedTitle}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading state */}
            {isLoading && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-3">
                  Signal
                </span>
                <p className="text-sm text-slate-400">Searching 8 documents...</p>
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <div className="rounded border border-red-900 bg-red-950/30 px-4 py-3">
                <p className="text-sm text-red-400">{error.message}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-800 px-4 py-4">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex gap-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about UAP disclosures, government reports, congressional testimony..."
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
