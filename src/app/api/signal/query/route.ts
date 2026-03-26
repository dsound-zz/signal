import { NextRequest } from 'next/server';
import { retrieveChunks } from '@/lib/retrieval';
import { generateAnswer } from '@/lib/generation';

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { messages, tierFilter } = body as {
    messages?: ChatMessage[];
    tierFilter?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400 });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg || typeof lastUserMsg.content !== 'string' || lastUserMsg.content.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'No valid user message found' }), { status: 400 });
  }

  const query = lastUserMsg.content.trim();

  if (tierFilter !== undefined && tierFilter !== 1 && tierFilter !== 2 && tierFilter !== 3) {
    return new Response(JSON.stringify({ error: 'tierFilter must be 1, 2, or 3' }), { status: 400 });
  }

  const chunks = await retrieveChunks({
    query,
    topK: 8,
    tierFilter: tierFilter as 1 | 2 | 3 | undefined,
  });

  const sources = chunks.map((c) => ({
    title: c.sourceTitle,
    tier: c.credibilityTier as 1 | 2 | 3,
    page: c.pageNumber,
    url: c.sourceUrl,
    date: c.docDate,
    declassified: c.declassified,
  }));

  console.log('[signal/query] retrieved', chunks.length, 'chunks, streaming response');

  const stream = await generateAnswer(query, chunks);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Sources': JSON.stringify(sources),
    },
  });
}
