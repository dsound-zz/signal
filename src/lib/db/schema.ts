import { pgTable, uuid, text, integer, boolean, timestamp, date, customType } from 'drizzle-orm/pg-core';

// Custom type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const signalChunks = pgTable('signal_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  embedding: vector('embedding'),
  sourceTitle: text('source_title').notNull(),
  sourceUrl: text('source_url'),
  sourceType: text('source_type', {
    enum: [
      'government_report',
      'congressional_testimony',
      'foia_document',
      'scientific_paper',
      'investigative_journalism',
      'witness_account',
    ],
  }).notNull(),
  credibilityTier: integer('credibility_tier').notNull(),
  docDate: date('doc_date'),
  declassified: boolean('declassified').default(false),
  caseNumber: text('case_number'),
  pageNumber: integer('page_number'),
  chunkIndex: integer('chunk_index'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export type SignalChunk = typeof signalChunks.$inferSelect;
export type NewSignalChunk = typeof signalChunks.$inferInsert;
