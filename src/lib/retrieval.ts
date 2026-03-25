import { sql } from 'drizzle-orm';
import { db } from './db';
import { generateEmbedding } from './embeddings';

export interface RetrievalOptions {
  query: string;
  topK?: number;
  tierFilter?: 1 | 2 | 3;
  dateRange?: { from: string; to: string };
}

export interface RetrievedChunk {
  id: string;
  content: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceType: string;
  credibilityTier: number;
  docDate: string | null;
  declassified: boolean;
  pageNumber: number | null;
  similarity: number;
}

export async function retrieveChunks(options: RetrievalOptions): Promise<RetrievedChunk[]> {
  const { query, topK = 8, tierFilter } = options;

  const embedding = await generateEmbedding(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  const baseQuery = tierFilter
    ? sql`
        SELECT id, content, source_title, source_url, source_type, credibility_tier,
               doc_date, declassified, page_number,
               1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM signal_chunks
        WHERE credibility_tier <= ${tierFilter}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `
    : sql`
        SELECT id, content, source_title, source_url, source_type, credibility_tier,
               doc_date, declassified, page_number,
               1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM signal_chunks
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
      `;

  const rows = await db.execute(baseQuery);

  const chunks: RetrievedChunk[] = (rows as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    content: row.content as string,
    sourceTitle: row.source_title as string,
    sourceUrl: (row.source_url as string | null) ?? null,
    sourceType: row.source_type as string,
    credibilityTier: row.credibility_tier as number,
    docDate: (row.doc_date as string | null) ?? null,
    declassified: row.declassified as boolean,
    pageNumber: (row.page_number as number | null) ?? null,
    similarity: parseFloat(row.similarity as string),
  }));

  const topSimilarity = chunks[0]?.similarity ?? 0;
  console.log('[retrieval] found', chunks.length, 'chunks for query, top similarity:', topSimilarity.toFixed(4));

  return chunks;
}
