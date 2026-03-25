# SIGNAL — UAP Document Intelligence

Credibility-weighted RAG (Retrieval-Augmented Generation) over declassified government documents, congressional testimony, and scientific research on UAP/UFO phenomena.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database**: Neon (serverless Postgres) + pgvector
- **ORM**: Drizzle ORM
- **Embeddings**: Google Gemini embedding-001 (768-dim)
- **Generation**: Anthropic Claude Sonnet (via Vercel AI SDK)
- **Deployment**: Vercel

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

Edit `.env.local` and add your credentials:

- `DATABASE_URL` - Your Neon connection string
- `GOOGLE_API_KEY` - Your Google API key for Gemini embeddings
- `ANTHROPIC_API_KEY` - Your Anthropic API key

3. **Initialize the database**:

```bash
npm run db:migrate
```

This will:

- Enable the pgvector extension
- Create the `signal_chunks` table with vector support
- Add an ivfflat index for fast similarity search

4. **Run the development server**:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The `signal_chunks` table stores document chunks with their embeddings:

- **id**: UUID primary key
- **content**: Text content of the chunk
- **embedding**: 768-dimensional vector from Gemini
- **source_title**: Document title
- **source_url**: Optional URL to source
- **source_type**: One of: government_report, congressional_testimony, foia_document, scientific_paper, investigative_journalism, witness_account
- **credibility_tier**: 1 (official gov), 2 (scientific), or 3 (witness accounts)
- **doc_date**: Document date
- **declassified**: Boolean flag
- **case_number**: Optional case identifier
- **page_number**: Page reference
- **chunk_index**: Chunk position in document
- **created_at**: Timestamp

## Project Structure

```
signal/
├── src/
│   ├── app/              # Next.js app router pages
│   └── lib/
│       ├── db/
│       │   ├── schema.ts # Drizzle schema with pgvector
│       │   └── index.ts  # Database connection
│       ├── embeddings.ts # Gemini embedding utility
│       ├── retrieval.ts  # Vector search logic (to be added)
│       └── generation.ts # Claude generation (to be added)
├── scripts/
│   ├── init-db.sql       # Database initialization SQL
│   └── run-migration.ts  # Migration script
└── drizzle.config.ts     # Drizzle Kit configuration
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migration
- `npm run db:migrate:gemini` - Run Gemini migration (update vector dimensions)
- `npm run db:push` - Push schema changes with Drizzle Kit
- `npm run db:studio` - Open Drizzle Studio GUI

## Next Steps

1. Add document ingestion scripts (Python/TypeScript)
2. Implement vector retrieval logic in [`src/lib/retrieval.ts`](src/lib/retrieval.ts)
3. Implement Claude generation in [`src/lib/generation.ts`](src/lib/generation.ts)
4. Build chat/query interface
5. Deploy to Vercel

## Credibility Tier System

- **Tier 1**: Official government documents (AARO, DNI, declassified FOIA, sworn testimony)
- **Tier 2**: Scientific and investigative (NARCAP, SCU analyses, investigative journalism)
- **Tier 3**: Witness accounts and secondary sources (NUFORC, researcher writings)

## License

Private project - All rights reserved
# signal
