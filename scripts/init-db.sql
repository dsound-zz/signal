-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create signal_chunks table
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
);

-- Create ivfflat index for vector similarity search
CREATE INDEX IF NOT EXISTS signal_chunks_embedding_idx 
  ON signal_chunks 
  USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);
