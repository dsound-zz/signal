import Anthropic from '@anthropic-ai/sdk';
import type { RetrievedChunk } from './retrieval';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SIGNAL_SYSTEM_PROMPT = `You are SIGNAL, an AI research assistant specializing in UAP (Unidentified Aerial Phenomena). You answer questions strictly based on the provided source documents.

RULES:
1. Only state what is explicitly supported by the provided sources
2. For every factual claim, cite the source using [Source N] notation
3. If sources conflict, acknowledge the conflict and cite both positions
4. If the answer is not in the sources, say "The available sources do not address this question."
5. Never speculate beyond what the sources state
6. Distinguish between official government positions and other sources

FORMAT:
- Lead with a direct answer if the sources support one
- Follow with supporting evidence and citations
- End with a "Sources" section listing each cited source with its credibility tier`;

export interface GenerationOptions {
  query: string;
  chunks: RetrievedChunk[];
}

export interface GenerationResult {
  answer: string;
  sourcesUsed: RetrievedChunk[];
  model: string;
}

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

export async function generateAnswer(options: GenerationOptions): Promise<GenerationResult> {
  const { query, chunks } = options;
  const model = 'claude-sonnet-4-6';

  const context = formatChunksAsContext(chunks);
  const userMessage = `SOURCE DOCUMENTS:\n\n${context}\n\n---\n\nQUESTION: ${query}`;

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SIGNAL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  // Determine which sources were cited by checking for [Source N] references
  const citedIndices = new Set<number>();
  const citationPattern = /\[Source (\d+)\]/gi;
  let match;
  while ((match = citationPattern.exec(answer)) !== null) {
    const idx = parseInt(match[1], 10) - 1;
    if (idx >= 0 && idx < chunks.length) {
      citedIndices.add(idx);
    }
  }

  const sourcesUsed = citedIndices.size > 0
    ? [...citedIndices].sort((a, b) => a - b).map((i) => chunks[i])
    : chunks;

  console.log('[generation] answer generated, cited', sourcesUsed.length, 'sources');

  return { answer, sourcesUsed, model };
}
