import { neon } from '@neondatabase/serverless';

async function runMigration() {
  console.log('[migration] Starting Gemini embedding migration...');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const sql = neon(databaseUrl);
  
  try {
    console.log('[migration] Step 1: Dropping existing index...');
    await sql`DROP INDEX IF EXISTS signal_chunks_embedding_idx`;
    
    console.log('[migration] Step 2: Altering column to vector(768)...');
    await sql`ALTER TABLE signal_chunks ALTER COLUMN embedding TYPE vector(768)`;
    
    console.log('[migration] Step 3: Recreating index for cosine similarity...');
    await sql`CREATE INDEX signal_chunks_embedding_idx ON signal_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`;
    
    console.log('[migration] Step 4: Adding column comment...');
    await sql`COMMENT ON COLUMN signal_chunks.embedding IS 'Gemini embedding-001 (768 dimensions)'`;
    
    console.log('[migration] ✅ Migration completed successfully');
    console.log('[migration] Vector dimension updated from 1536 to 768');
    console.log('[migration] Index recreated for Gemini embeddings');
    console.log('[migration] ⚠️  Note: All existing embeddings need to be regenerated');
    
  } catch (error) {
    console.error('[migration] ❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('[migration] Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[migration] Error:', error);
    process.exit(1);
  });
