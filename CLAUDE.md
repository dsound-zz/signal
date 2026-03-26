## Claude Code Instructions

- This file is auto-loaded by Claude Code at session start
- Read ## Current State first — it tells you exactly where we are
- Update this file at the end of every session per the Session Closeout Rules below
- Never create separate notes files — all state lives here

# SIGNAL — Agent Context

## What This App Is

SIGNAL is a credibility-weighted RAG (Retrieval-Augmented Generation) over declassified
government documents, congressional testimony, and scientific research on UAP/UFO phenomena.
It answers questions about UAPs by separating what is officially confirmed from what is
contested or unverified — with every claim sourced to a primary document.

## The Core Value Proposition

Most UAP information online is scattered, credibility is impossible to assess, and LLMs
hallucinate freely on this topic. SIGNAL retrieves only from ingested primary sources and
refuses to answer beyond what those sources say. Every claim shows its source, page number,
and credibility tier.

## Tech Stack

- Next.js 14 App Router, TypeScript, Tailwind CSS
- Neon (serverless Postgres) + pgvector for vector storage and similarity search
- Drizzle ORM for type-safe database queries
- Google Gemini embedding-001 (768-dim) for embeddings
- Anthropic Claude Sonnet via Vercel AI SDK for generation
- Vercel for deployment
- Python (ingestion scripts only — one-time ETL, not production runtime)

## Database: Neon

- pgvector extension enabled
- Single table: signal_chunks
- Connection via DATABASE_URL env var (Neon connection string)

## Schema (signal_chunks table)

```sql
CREATE TABLE signal_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(768),
  source_title TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL,
  credibility_tier INTEGER NOT NULL CHECK (credibility_tier IN (1, 2, 3)),
  doc_date DATE,
  declassified BOOLEAN DEFAULT false,
  case_number TEXT,
  page_number INTEGER,
  chunk_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Credibility Tier System

- Tier 1: Official government documents (AARO reports, DNI reports, declassified FOIA,
  congressional sworn testimony, Project Blue Book official files)
- Tier 2: Scientific and investigative (NARCAP technical reports, SCU peer-reviewed
  analyses, established investigative journalism)
- Tier 3: Witness accounts and secondary sources (NUFORC curated reports, researcher
  writings, corroborated but unverified accounts)

## Source Corpus (Phase 1)

- AARO Historical Record Report Vol. 1 (2024)
- AARO Annual Reports 2022–2024
- DNI Consolidated UAP Reports 2021–2024
- Congressional UAP hearing transcripts 2022, 2023, 2024
- AARO Information Papers 2025
- NARCAP technical reports (subset)
- SCU analyses (subset)

## Coding Conventions

- All API routes in src/app/api/[route]/route.ts
- Database client: import { db } from '@/lib/db' (Drizzle instance)
- Schema types: import { signalChunks } from '@/lib/db/schema'
- Embedding calls go through src/lib/embeddings.ts — never call OpenAI directly from routes
- All retrieval logic in src/lib/retrieval.ts
- All generation/prompts in src/lib/generation.ts
- Ingestion scripts in scripts/ directory (Python or TypeScript, run once)
- Environment variables: DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY
- Log format: console.log('[module] message', data)
- Never generate answers beyond what retrieved chunks contain
- Always return source metadata alongside every answer

## Project Status

### ✅ COMPLETED: Infrastructure Setup (2026-03-25)

**Database Infrastructure**:

- ✅ Next.js 14 project initialized with TypeScript and Tailwind CSS
- ✅ Drizzle ORM configured with @neondatabase/serverless driver
- ✅ Custom pgvector type implemented in src/lib/db/schema.ts for 768-dim vectors
- ✅ Database connection established via src/lib/db/index.ts
- ✅ Gemini embeddings utility created in src/lib/embeddings.ts
- ✅ pgvector extension enabled in Neon database
- ✅ signal_chunks table created with full schema
- ✅ ivfflat index created on embedding column (100 lists, cosine similarity)
- ✅ Database migration scripts: scripts/run-migration.ts, scripts/init-db.sql, scripts/run-gemini-migration.ts
- ✅ Setup verification script: scripts/verify-setup.ts
- ✅ Migrated from OpenAI (1536-dim) to Gemini embedding-001 (768-dim)

**Available npm Scripts**:

- npm run db:migrate — Run database migration
- npm run db:migrate:gemini — Run Gemini migration (update vector dimensions)
- npm run db:push — Push schema changes with Drizzle Kit
- npm run db:studio — Open Drizzle Studio GUI
- npm run dev — Start development server

**Environment Variables Configured**:

- DATABASE_URL — Neon connection string (configured)
- GOOGLE_API_KEY — Google API key for Gemini embeddings (needs to be added)
- ANTHROPIC_API_KEY — Anthropic API key (needs to be added)

**Documentation Created**:

- README.md — Comprehensive setup and usage guide
- SETUP_COMPLETE.md — Detailed infrastructure setup summary

### ✅ COMPLETED: Retrieval Layer + Generation API (2026-03-25)

**Retrieval Layer** (src/lib/retrieval.ts):

- ✅ Vector similarity search via pgvector cosine distance (`<=>` operator)
- ✅ Credibility tier filtering (`WHERE credibility_tier <= tierFilter`)
- ✅ Configurable topK (default 8, capped at 20 via API)
- ✅ Returns typed `RetrievedChunk[]` with similarity scores

**Generation Layer** (src/lib/generation.ts):

- ✅ SIGNAL_SYSTEM_PROMPT with strict citation-enforcement rules
- ✅ Anthropic SDK (`@anthropic-ai/sdk`) — not Vercel AI SDK
- ✅ Model: claude-sonnet-4-6
- ✅ Source citation detection: parses `[Source N]` references to identify which chunks were cited
- ✅ Formats chunks with tier labels, dates, page numbers, and declassification status

**Query API Route** (src/app/api/query/route.ts):

- ✅ POST /api/query endpoint
- ✅ Input validation: rejects empty questions, invalid tierFilter, clamps topK to 20
- ✅ Returns `{ answer, sources, metadata: { chunksRetrieved, queryTime, model } }`

**Dependencies Added**:

- `@anthropic-ai/sdk` — Anthropic SDK for direct Claude API calls

**Decisions**:

- Used Drizzle `sql` template tag with `::vector` cast for pgvector compatibility
- Source citation detection falls back to all chunks if no `[Source N]` references are found
- Generation does not stream (returns full answer) — streaming can be added later for UI

### ✅ COMPLETED: Chat UI with Source Panel (2026-03-25)

**Components Built**:

- ✅ `src/components/signal/types.ts` — Shared `Source` interface
- ✅ `src/components/signal/SourcePanel.tsx` — Source cards with Tier 1/2/3 badges, declassified flag, hover highlight
- ✅ `src/components/signal/AnswerView.tsx` — Parses CONFIRMED/CONTEXT sections; inline citation badges that highlight source cards on hover
- ✅ `src/components/signal/ChatInterface.tsx` — `useChat` streaming hook, message list, loading text, context toggle
- ✅ `src/app/page.tsx` — Full-page dark layout (slate-900), SIGNAL wordmark header

**API Route Updated**:

- ✅ `/api/signal/query` now accepts Vercel AI SDK `useChat` message format `{ messages: [...] }` instead of `{ query }`
- ✅ Sources passed via `X-Sources` response header; captured in `useChat`'s `onResponse` callback and mapped to messages via `onFinish`

**Decisions**:

- Sources are linked to specific messages via `sourcesMap: Record<messageId, Source[]>` state — `onResponse` captures sources to a ref, `onFinish` assigns them to the completed message ID
- `showContext` is a global toggle (affects all messages) placed near each answer header
- Citation badges in AnswerView show abbreviated title or page number on hover; full title in tooltip
- `generation.ts` uses Vercel AI SDK `streamText` + `@ai-sdk/anthropic` (not the raw `@anthropic-ai/sdk`)

### 🔜 NEXT TASKS:

1. **Document Ingestion Pipeline**:
   - Create PDF parsing utilities for government documents
   - Implement chunking strategy (semantic chunking, ~500 tokens per chunk)
   - Build ingestion scripts to process initial corpus
   - Generate embeddings and populate signal_chunks table

2. **Additional API Routes**:
   - GET /api/sources — List available sources in the corpus
   - POST /api/feedback — User feedback collection

3. **UI Enhancements**:
   - Tier filter dropdown in UI (pass as `body` param via `useChat`)
   - Stream the "Searching X documents..." count from actual retrieval result
   - Mobile layout polish

4. **Environment Variables** (still needed):
   - GOOGLE_API_KEY — Google API key for Gemini embeddings
   - ANTHROPIC_API_KEY — Anthropic API key

## Session Closeout Rules

At the end of every task, update this file with:

- Move completed items to the appropriate ✅ COMPLETED section with date
- Update 🔜 NEXT TASKS to reflect remaining and newly identified work
- Note any decisions, tradeoffs, or constraints discovered during the session
