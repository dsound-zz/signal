import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { RetrievedChunk } from './retrieval';

export const SIGNAL_SYSTEM_PROMPT = `You are SIGNAL, a research assistant that answers questions about UAP (Unidentified Anomalous Phenomena) using only the provided source documents.

STRICT RULES:

Only use information from the provided source chunks. Never use your internal training knowledge about UAPs.

Every factual claim must be followed by a citation in this format: [SOURCE: "document title", p.X]

If the provided sources do not contain enough information to answer the question, say exactly: "The available documents do not contain sufficient information to answer this question."

Separate your answer into two sections:
CONFIRMED: Claims supported by Tier 1 government documents
CONTEXT: Additional context from Tier 2-3 sources (clearly labeled as less authoritative)

Do not speculate. Do not infer beyond what sources state.

If sources contradict each other, note the contradiction explicitly.`;

function formatChunksAsContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const tierLabel = ['', 'Official Government', 'Scientific/Investigative', 'Witness/Secondary'][chunk.credibilityTier];
      const meta = [
        `Source ${i + 1}: ${chunk.sourceTitle}`,
        `Type: ${chunk.sourceType} | Tier ${chunk.credibilityTier} (${tierLabel})`,
        chunk.docDate ? `Date: ${chunk.docDate}` : null,
        chunk.pageNumber != null ? `Page: ${chunk.pageNumber}` : null,
        chunk.declassified ? 'Declassified: Yes' : null,
        chunk.sourceUrl ? `URL: ${chunk.sourceUrl}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      return `[${meta}]\n${chunk.content}`;
    })
    .join('\n\n---\n\n');
}

export async function generateAnswer(
  query: string,
  chunks: RetrievedChunk[],
  extraHeaders?: Record<string, string>
): Promise<Response> {
  if (chunks.length === 0) {
    const result = streamText({
      model: anthropic('claude-sonnet-4-6'),
      system: SIGNAL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `SOURCE DOCUMENTS:\n\n(No documents retrieved)\n\n---\n\nQUESTION: ${query}` }],
    });
    return result.toUIMessageStreamResponse({ headers: extraHeaders });
  }

  const context = formatChunksAsContext(chunks);
  const userMessage = `SOURCE DOCUMENTS:\n\n${context}\n\n---\n\nQUESTION: ${query}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SIGNAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  console.log('[generation] streaming answer for query, using', chunks.length, 'chunks');

  return result.toUIMessageStreamResponse({ headers: extraHeaders });
}
