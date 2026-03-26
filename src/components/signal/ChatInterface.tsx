'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isTextUIPart } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import AnswerView from './AnswerView';
import SourcePanel from './SourcePanel';
import type { Source } from './types';

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState('');
  const [sourcesMap, setSourcesMap] = useState<Record<string, Source[]>>({});
  const [highlightedTitle, setHighlightedTitle] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(true);
  const pendingSourcesRef = useRef<Source[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Custom transport wraps fetch to capture X-Sources header before stream is consumed
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/signal/query',
        fetch: async (url, init) => {
          const response = await fetch(url as string, init as RequestInit);
          const raw = response.headers.get('X-Sources');
          if (raw) {
            try {
              pendingSourcesRef.current = JSON.parse(raw) as Source[];
            } catch {
              pendingSourcesRef.current = [];
            }
          }
          return response;
        },
      }),
    []
  );

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      if (pendingSourcesRef.current.length > 0) {
        const captured = pendingSourcesRef.current;
        setSourcesMap((prev) => ({ ...prev, [message.id]: captured }));
        pendingSourcesRef.current = [];
      }
    },
  });

  const handleReset = () => {
    setMessages([]);
    setSourcesMap({});
    setInputValue('');
    setHighlightedTitle(null);
    pendingSourcesRef.current = [];
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const isLoading = status === 'submitted' || status === 'streaming';
  const hasMessages = messages.some((m) => m.role === 'user');
  const anySourcesLoaded = Object.keys(sourcesMap).length > 0;

  const getMessageText = (message: (typeof messages)[0]): string =>
    message.parts.filter(isTextUIPart).map((p) => p.text).join('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-6">
            <p className="text-slate-500 text-sm text-center max-w-sm">
              Ask anything about UAP disclosures, government reports, or material analysis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
              {[
                'What does the government say about UAP threats to national security?',
                'What did ORNL find when analyzing the recovered metallic specimens?',
                'How has the number of UAP reports changed between 2021 and 2023?',
                'What explanations has AARO given for UAP misidentifications?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInputValue(q)}
                  className="text-left text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-slate-700 rounded-lg px-4 py-2.5 max-w-xl">
                      <p className="text-sm text-slate-100">{getMessageText(message)}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        Signal
                      </span>
                      {anySourcesLoaded && (
                        <button
                          onClick={() => setShowContext((v) => !v)}
                          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {showContext ? 'Hide context sources' : 'Show context sources'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                      <AnswerView
                        content={getMessageText(message)}
                        onHoverCitation={setHighlightedTitle}
                        showContext={showContext}
                      />
                      {sourcesMap[message.id]?.length > 0 && (
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

            {isLoading && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-3">
                  Signal
                </span>
                <p className="text-sm text-slate-400">Searching documents...</p>
              </div>
            )}

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
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-3">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about UAP disclosures, government reports, congressional testimony..."
            disabled={isLoading}
            autoComplete="off"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-500 disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Send
          </button>
          {hasMessages && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="px-5 py-2.5 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
