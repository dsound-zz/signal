# SIGNAL — UAP Document Intelligence

SIGNAL is a credibility-weighted RAG (Retrieval-Augmented Generation) system built over declassified government documents, congressional testimony, and scientific research on UAP/UFO phenomena. It answers questions about UAPs by separating what is officially confirmed from what is contested or unverified — with every claim sourced to a primary document.

Most UAP information online is scattered, credibility is impossible to assess, and LLMs hallucinate freely on this topic. SIGNAL retrieves only from ingested primary sources and refuses to answer beyond what those sources say. Every claim shows its source, page number, and credibility tier.

---

## Credibility Tier System

| Tier | Type | Sources |
|------|------|---------|
| **Tier 1** | Official government | AARO reports, DNI reports, declassified FOIA documents, sworn congressional testimony, Project Blue Book |
| **Tier 2** | Scientific & investigative | NARCAP technical reports, SCU peer-reviewed analyses, established investigative journalism |
| **Tier 3** | Witness & secondary | NUFORC curated reports, researcher writings, corroborated but unverified accounts |

Queries default to all tiers. You can filter to Tier 1 only to restrict answers to official government sources.

---

## How SIGNAL Handles Knowledge Gaps

SIGNAL only answers from ingested primary sources. If a person, event, or claim doesn't appear in the corpus, SIGNAL says so explicitly rather than generating an answer from training data.

**Example:** Searching for "Steven Greer" returns no results against the current Tier 1 government corpus — not because the query failed, but because civilian researchers are not cited in official DNI/AARO documentation. This is correct behavior. Add congressional testimony or Tier 2 sources to surface that content.

This constraint is intentional. The goal is a system where silence is informative: if SIGNAL doesn't know, it's because the official record doesn't say.

---

## Source Corpus (Phase 1)

- AARO Historical Record Report Vol. 1 (2024)
- AARO Annual Reports 2022–2024
- DNI Consolidated UAP Reports 2021–2024
- Congressional UAP hearing transcripts 2022, 2023, 2024
- AARO Information Papers 2025
- NARCAP technical reports (subset)
- SCU analyses (subset)

---

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Neon (serverless Postgres) + pgvector
- **ORM**: Drizzle ORM
- **Embeddings**: Google Gemini embedding-001 (768-dim)
- **Generation**: Anthropic Claude Sonnet (via Vercel AI SDK, streaming)
- **Deployment**: Vercel

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon account with a Postgres database
- Google API key (for Gemini embeddings)
- Anthropic API key

### Installation

1. **Clone and install dependencies**:

```bash
npm install
```

2. **Set up environment variables**:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in:

```
DATABASE_URL=        # Neon connection string
GOOGLE_API_KEY=      # Google API key for Gemini embeddings
ANTHROPIC_API_KEY=   # Anthropic API key
```

3. **Initialize the database**:

```bash
npm run db:migrate
```

This enables the pgvector extension, creates the `signal_chunks` table, and adds an ivfflat index for cosine similarity search.

4. **Start the development server**:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
signal/
├── src/
│   ├── app/
│   │   ├── api/signal/query/route.ts   # POST /api/signal/query
│   │   └── page.tsx                    # Main chat UI
│   ├── components/signal/
│   │   ├── ChatInterface.tsx            # Chat input + message list
│   │   ├── AnswerView.tsx               # Renders answer with inline citations
│   │   ├── SourcePanel.tsx              # Source cards with tier badges
│   │   └── types.ts                    # Shared Source interface
│   └── lib/
│       ├── db/
│       │   ├── schema.ts               # Drizzle schema with pgvector
│       │   └── index.ts                # Database connection
│       ├── embeddings.ts               # Gemini embedding calls
│       ├── retrieval.ts                # Vector similarity search
│       └── generation.ts              # Claude generation + system prompt
├── scripts/
│   ├── ingest-batch.ts                 # Batch ingestion script
│   ├── corpus-manifest.json            # Source manifest
│   ├── init-db.sql                     # Database initialization SQL
│   └── run-migration.ts               # Migration script
└── drizzle.config.ts
```

---

## API

### `POST /api/signal/query`

Accepts a Vercel AI SDK `useChat` message format.

**Request body:**
```json
{
  "messages": [{ "role": "user", "content": "What has AARO confirmed about UAP shapes?" }],
  "tierFilter": 1,
  "topK": 8
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `messages` | array | required | Chat message history |
| `tierFilter` | 1 \| 2 \| 3 | 3 | Max credibility tier to include |
| `topK` | number | 8 | Number of chunks to retrieve (max 20) |

**Response:** Streamed text. Retrieved sources are passed via the `X-Sources` response header as JSON.

---

## Database Schema

The `signal_chunks` table stores document chunks with their embeddings:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `content` | TEXT | Chunk text |
| `embedding` | VECTOR(768) | Gemini embedding |
| `source_title` | TEXT | Document title |
| `source_url` | TEXT | Optional URL |
| `source_type` | TEXT | `government_report`, `congressional_testimony`, `foia_document`, `scientific_paper`, `investigative_journalism`, `witness_account` |
| `credibility_tier` | INTEGER | 1, 2, or 3 |
| `doc_date` | DATE | Document date |
| `declassified` | BOOLEAN | Declassification flag |
| `case_number` | TEXT | Optional case identifier |
| `page_number` | INTEGER | Page reference |
| `chunk_index` | INTEGER | Chunk position in document |

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:migrate` | Run database migration |
| `npm run db:push` | Push schema changes with Drizzle Kit |
| `npm run db:studio` | Open Drizzle Studio GUI |

---

## License

Private project — all rights reserved.
