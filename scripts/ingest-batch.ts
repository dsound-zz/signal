/**
 * Batch ingestion script for SIGNAL.
 * Reads corpus-manifest.json and processes all documents in sequence,
 * skipping any already present in signal_chunks by source_title.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- tsx scripts/ingest-batch.ts
 */

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';
import { generateEmbedding } from '../src/lib/embeddings';
import { chunkPages, PageContent } from './chunk';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  pdfUrl?: string;
  localPath?: string;
  sourceTitle: string;
  sourceUrl?: string;
  sourceType:
  | 'government_report'
  | 'congressional_testimony'
  | 'foia_document'
  | 'scientific_paper'
  | 'investigative_journalism'
  | 'witness_account';
  credibilityTier: 1 | 2 | 3;
  docDate: string;
  declassified: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadPdf(url: string, destPath: string): void {
  console.log(`[batch] downloading ${url}`);
  execSync(
    `curl -sS -L -A "Mozilla/5.0" --retry 3 --retry-delay 2 -o "${destPath}" "${url}"`,
    { stdio: 'inherit' }
  );
  const buf = readFileSync(destPath);
  if (buf.slice(0, 4).toString() !== '%PDF') {
    throw new Error(`Downloaded file is not a PDF — server may have rejected the request`);
  }
}

function extractPages(pdfPath: string): PageContent[] {
  const jsonPath = pdfPath.replace(/\.pdf$/i, '.json');
  execSync(`python3 scripts/ingest.py "${pdfPath}" "${jsonPath}"`, { stdio: 'inherit' });
  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8')) as { pages: PageContent[] };
  unlinkSync(jsonPath);
  return raw.pages;
}

async function isAlreadyIngested(
  db: ReturnType<typeof drizzle>,
  sourceTitle: string
): Promise<boolean> {
  const rows = await (db as any)
    .select({ id: schema.signalChunks.id })
    .from(schema.signalChunks)
    .where(eq(schema.signalChunks.sourceTitle, sourceTitle))
    .limit(1);
  return rows.length > 0;
}

async function ingestDocument(
  db: ReturnType<typeof drizzle>,
  entry: ManifestEntry
): Promise<number> {
  let tmpPdf = join(tmpdir(), `signal-ingest-${Date.now()}.pdf`);
  let shouldCleanup = true;

  try {
    if (entry.localPath && existsSync(entry.localPath)) {
      console.log(`[batch] using local file: ${entry.localPath}`);
      tmpPdf = entry.localPath;
      shouldCleanup = false;
    } else {
      if (!entry.pdfUrl) throw new Error('no pdfUrl or valid localPath for entry');
      downloadPdf(entry.pdfUrl, tmpPdf);
    }
    const pages = extractPages(tmpPdf);

    const chunks = chunkPages(pages);
    const total = chunks.length;
    console.log(`[batch] ${total} chunks from ${pages.length} pages — "${entry.sourceTitle}"`);

    if (total === 0) throw new Error('no chunks produced');

    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.content.trim()) continue;

      try {
        const embedding = await generateEmbedding(chunk.content);
        await (db as any).insert(schema.signalChunks).values({
          content: chunk.content,
          embedding,
          sourceTitle: entry.sourceTitle,
          sourceUrl: entry.sourceUrl ?? entry.pdfUrl,
          sourceType: entry.sourceType,
          credibilityTier: entry.credibilityTier,
          docDate: entry.docDate,
          declassified: entry.declassified,
          pageNumber: chunk.page_number,
          chunkIndex: chunk.chunk_index,
        });
        inserted++;
      } catch (err) {
        errors++;
        console.error(`[batch] ERROR on chunk ${i}:`, err);
      }

      if ((i + 1) % 10 === 0 || i + 1 === total) {
        console.log(`[batch]   chunk ${i + 1}/${total} (${inserted} ok, ${errors} errors)`);
      }

      if (i < chunks.length - 1) await sleep(500);
    }

    if (errors > 0) {
      console.warn(`[batch] ${errors} chunk(s) failed for "${entry.sourceTitle}"`);
    }

    return inserted;
  } finally {
    if (shouldCleanup && existsSync(tmpPdf)) unlinkSync(tmpPdf);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[batch] ERROR: DATABASE_URL is not set');
    process.exit(1);
  }
  if (!process.env.GOOGLE_API_KEY) {
    console.error('[batch] ERROR: GOOGLE_API_KEY is not set');
    process.exit(1);
  }

  const manifestPath = 'scripts/corpus-manifest.json';
  if (!existsSync(manifestPath)) {
    console.error(`[batch] ERROR: ${manifestPath} not found`);
    process.exit(1);
  }

  const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  if (!Array.isArray(manifest) || manifest.length === 0) {
    console.error('[batch] ERROR: manifest is empty or invalid');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  const total = manifest.length;
  let totalInserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    console.log(`\n[batch] document ${i + 1}/${total} — "${entry.sourceTitle}"`);

    const already = await isAlreadyIngested(db as any, entry.sourceTitle);
    if (already) {
      console.log(`[batch] skipping — already ingested`);
      skipped++;
      continue;
    }

    try {
      const inserted = await ingestDocument(db as any, entry);
      totalInserted += inserted;
      console.log(`[batch] ✓ inserted ${inserted} chunks for "${entry.sourceTitle}"`);
    } catch (err) {
      failed++;
      console.error(`[batch] FAILED "${entry.sourceTitle}":`, err);
    }
  }

  console.log(`
[batch] ─── complete ───────────────────────────────
[batch] documents processed : ${total - skipped - failed}/${total}
[batch] documents skipped   : ${skipped}
[batch] documents failed    : ${failed}
[batch] total chunks inserted: ${totalInserted}
[batch] ─────────────────────────────────────────────`);

  if (failed > 0) process.exit(1);
}

main();
