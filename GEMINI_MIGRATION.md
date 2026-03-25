# Gemini Embedding Migration Summary

## Overview

Successfully migrated SIGNAL from OpenAI embeddings to Google Gemini embeddings on 2026-03-25.

## Changes Made

### 1. Package Dependencies

- **Added**: `@google/generative-ai` (v0.24.1)
- **Kept**: `openai` package (may be removed in future if not needed)

### 2. Embedding Library ([`src/lib/embeddings.ts`](src/lib/embeddings.ts))

- **Model**: Changed from `text-embedding-3-small` (OpenAI) to `embedding-001` (Gemini)
- **Dimensions**: Changed from 1536-dim to 768-dim vectors
- **API Client**: Switched from `OpenAI` to `GoogleGenerativeAI`
- **Method**: Changed from `openai.embeddings.create()` to `model.embedContent()`

### 3. Database Schema ([`src/lib/db/schema.ts`](src/lib/db/schema.ts))

- **Vector Type**: Changed from `VECTOR(1536)` to `VECTOR(768)`
- Custom pgvector type updated to reflect new dimensions

### 4. Database Migration Scripts

#### [`scripts/migrate-to-gemini.sql`](scripts/migrate-to-gemini.sql)

SQL migration that:

- Drops existing ivfflat index
- Alters embedding column to vector(768)
- Recreates index with cosine similarity
- Adds column comment for documentation

#### [`scripts/run-gemini-migration.ts`](scripts/run-gemini-migration.ts)

TypeScript migration runner that executes the SQL migration steps:

1. Drop existing index
2. Alter column type
3. Recreate index
4. Add documentation comment

### 5. Environment Variables

- **Removed**: `OPENAI_API_KEY`
- **Added**: `GOOGLE_API_KEY`
- Updated in [`/env.local.example`](.env.local.example)

### 6. Documentation Updates

- Updated [`AGENT_CONTEXT.md`](AGENT_CONTEXT.md) - all references to embedding dimensions and providers
- Updated [`README.md`](README.md) - tech stack, prerequisites, and schema documentation

### 7. NPM Scripts

Added new script in [`package.json`](package.json):

```json
"db:migrate:gemini": "dotenv-cli -e .env.local -- tsx scripts/run-gemini-migration.ts"
```

## Migration Steps

To apply this migration to your database:

1. **Ensure you have a Google API key**:

   ```bash
   # Add to .env.local
   GOOGLE_API_KEY=your_google_api_key_here
   ```

2. **Run the migration**:

   ```bash
   npm run db:migrate:gemini
   ```

3. **Regenerate all embeddings**:
   ⚠️ **IMPORTANT**: All existing embeddings in the database are now invalid (they are 1536-dim OpenAI embeddings, but the column expects 768-dim Gemini embeddings). You must:
   - Clear existing embeddings, or
   - Regenerate all embeddings using the new Gemini model

## Benefits of Gemini Embeddings

1. **Cost Efficiency**: Gemini embeddings are more cost-effective than OpenAI
2. **Smaller Vectors**: 768-dim vs 1536-dim = 50% storage reduction
3. **Performance**: Smaller vectors = faster similarity searches
4. **Integration**: Native Google ecosystem integration

## Technical Notes

- Vector dimensions: 1536 → 768 (50% reduction)
- Index type: ivfflat with 100 lists (unchanged)
- Similarity metric: Cosine similarity (unchanged)
- Database: pgvector extension (unchanged)

## Rollback Plan

If you need to rollback to OpenAI embeddings:

1. Revert [`src/lib/embeddings.ts`](src/lib/embeddings.ts) to use OpenAI
2. Revert [`src/lib/db/schema.ts`](src/lib/db/schema.ts) to vector(1536)
3. Run SQL migration to change column back:
   ```sql
   DROP INDEX IF EXISTS signal_chunks_embedding_idx;
   ALTER TABLE signal_chunks ALTER COLUMN embedding TYPE vector(1536);
   CREATE INDEX signal_chunks_embedding_idx ON signal_chunks
   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```
4. Update environment variables back to `OPENAI_API_KEY`
5. Regenerate all embeddings with OpenAI

## Testing

After migration, verify:

- [ ] Embedding generation works with Gemini API
- [ ] Vector similarity search returns relevant results
- [ ] Index is being used (check query plans)
- [ ] Application performance is acceptable

## Next Steps

1. Regenerate all existing document embeddings with Gemini
2. Test retrieval quality compared to previous OpenAI embeddings
3. Monitor API costs and performance metrics
4. Consider removing `openai` package dependency if no longer needed
