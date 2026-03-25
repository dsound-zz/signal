-- Migration: Update vector dimension from 1536 (OpenAI) to 768 (Gemini)
-- This script will drop the existing index, alter the column, and recreate the index

-- Drop the existing ivfflat index
DROP INDEX IF EXISTS signal_chunks_embedding_idx;

-- Alter the embedding column to use vector(768)
ALTER TABLE signal_chunks 
ALTER COLUMN embedding TYPE vector(768);

-- Recreate the ivfflat index with 100 lists for cosine similarity
CREATE INDEX signal_chunks_embedding_idx 
ON signal_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Note: All existing embeddings will need to be regenerated
-- as they are currently 1536-dimensional OpenAI embeddings
COMMENT ON COLUMN signal_chunks.embedding IS 'Gemini embedding-001 (768 dimensions)';
