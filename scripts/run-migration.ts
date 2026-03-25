import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const sql = neon(DATABASE_URL);
  
  try {
    console.log('[migration] Enabling pgvector extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    
    console.log('[migration] Creating signal_chunks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS signal_chunks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        embedding VECTOR(1536),
        source_title TEXT NOT NULL,
        source_url TEXT,
        source_type TEXT NOT NULL CHECK (source_type IN (
          'government_report',
          'congressional_testimony',
          'foia_document',
          'scientific_paper',
          'investigative_journalism',
          'witness_account'
        )),
        credibility_tier INTEGER NOT NULL CHECK (credibility_tier IN (1, 2, 3)),
        doc_date DATE,
        declassified BOOLEAN DEFAULT false,
        case_number TEXT,
        page_number INTEGER,
        chunk_index INTEGER,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    
    console.log('[migration] Creating ivfflat index...');
    await sql`
      CREATE INDEX IF NOT EXISTS signal_chunks_embedding_idx
        ON signal_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    `;
    
    console.log('[migration] ✓ Database initialized successfully');
    console.log('[migration] ✓ pgvector extension enabled');
    console.log('[migration] ✓ signal_chunks table created');
    console.log('[migration] ✓ ivfflat index created');
  } catch (error) {
    console.error('[migration] Error:', error);
    process.exit(1);
  }
}

runMigration();
