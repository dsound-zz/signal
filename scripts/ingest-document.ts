/**
 * Main document ingestion script for SIGNAL.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- tsx scripts/ingest-document.ts
 *
 * Configure the `DOC` constant below before running.
 */

import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/lib/db/schema';
import { generateEmbedding } from '../src/lib/embeddings';
import { chunkPages, PageContent } from './chunk';

// ─── Document config ────────────────────────────────────────────────────────
interface DocumentConfig {
  jsonPath: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceType:
    | 'government_report'
    | 'congressional_testimony'
    | 'foia_document'
    | 'scientific_paper'
    | 'investigative_journalism'
    | 'witness_account';
  credibilityTier: 1 | 2 | 3;
  docDate: string;      // ISO date e.g. "2024-03-08"
  declassified: boolean;
}

const DOC: DocumentConfig = {
  jsonPath: 'aaro-historical-vol1.json',
  sourceTitle: 'AARO Historical Record Report Vol. 1',
  sourceUrl:
    'https://media.defense.gov/2024/Mar/08/2003409233/-1/-1/0/DOPSR-2024-0263-AARO-HISTORICAL-RECORD-REPORT-VOLUME-1-2024.PDF',
  sourceType: 'government_report',
  credibilityTier: 1,
  docDate: '2024-03-08',
  declassified: true,
};
// ────────────────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[ingest] ERROR: DATABASE_URL is not set');
    process.exit(1);
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error('[ingest] ERROR: GOOGLE_API_KEY is not set');
    process.exit(1);
  }

  // Load extracted pages JSON
  console.log(`[ingest] loading pages from ${DOC.jsonPath}`);
  let pagesData: { pages: PageContent[] };
  try {
    pagesData = JSON.parse(readFileSync(DOC.jsonPath, 'utf-8'));
  } catch (err) {
    console.error(`[ingest] ERROR: could not read ${DOC.jsonPath}:`, err);
    process.exit(1);
  }

  const chunks = chunkPages(pagesData.pages);
  const total = chunks.length;
  console.log(`[ingest] produced ${total} chunks from ${pagesData.pages.length} pages`);

  if (total === 0) {
    console.error('[ingest] ERROR: no chunks produced — check the JSON file');
    process.exit(1);
  }

  // Set up DB
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (!chunk.content.trim()) {
      console.warn(`[ingest] skipping empty chunk ${i}`);
      continue;
    }

    try {
      const embedding = await generateEmbedding(chunk.content);

      await db.insert(schema.signalChunks).values({
        content: chunk.content,
        embedding,
        sourceTitle: DOC.sourceTitle,
        sourceUrl: DOC.sourceUrl,
        sourceType: DOC.sourceType,
        credibilityTier: DOC.credibilityTier,
        docDate: DOC.docDate,
        declassified: DOC.declassified,
        pageNumber: chunk.page_number,
        chunkIndex: chunk.chunk_index,
      });

      inserted++;

      if ((i + 1) % 10 === 0 || i + 1 === total) {
        console.log(`[ingest] chunk ${i + 1}/${total} (${inserted} inserted, ${errors} errors)`);
      }
    } catch (err) {
      errors++;
      console.error(`[ingest] ERROR on chunk ${i}:`, err);
    }

    // Rate-limit safety: 100ms between embedding calls
    if (i < chunks.length - 1) {
      await sleep(100);
    }
  }

  console.log(`[ingest] complete. ${inserted} chunks inserted for "${DOC.sourceTitle}"`);
  if (errors > 0) {
    console.warn(`[ingest] ${errors} chunks failed — review errors above`);
    process.exit(1);
  }
}

main();
