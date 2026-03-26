import { NextRequest, NextResponse } from 'next/server';
import { retrieveChunks } from '@/lib/retrieval';
import { generateAnswer } from '@/lib/generation';

interface QueryRequest {
  question: string;
  tierFilter?: 1 | 2 | 3;
  topK?: number;
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  let body: QueryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question, tierFilter, topK } = body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ error: 'question is required and must be a non-empty string' }, { status: 400 });
  }

  const clampedTopK = Math.min(topK ?? 8, 20);

  if (tierFilter !== undefined && ![1, 2, 3].includes(tierFilter)) {
    return NextResponse.json({ error: 'tierFilter must be 1, 2, or 3' }, { status: 400 });
  }

  try {
    const chunks = await retrieveChunks({
      query: question.trim(),
      topK: clampedTopK,
      tierFilter,
    });

    if (chunks.length === 0) {
      return NextResponse.json({
        answer: 'The available sources do not address this question.',
        sources: [],
        metadata: {
          chunksRetrieved: 0,
          queryTime: Date.now() - start,
          model: 'claude-sonnet-4-6',
        },
      });
    }

    const response = await generateAnswer(question.trim(), chunks);
    
    // Add custom headers to the response
    response.headers.set('X-Chunks-Retrieved', String(chunks.length));
    response.headers.set('X-Query-Time', String(Date.now() - start));
    
    return response;
  } catch (error) {
    console.error('[api/query] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
