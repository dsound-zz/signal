import { NextRequest } from 'next/server';
import { retrieveChunks } from '@/lib/retrieval';
import { generateAnswer } from '@/lib/generation';

interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  role: string;
  parts?: UIMessagePart[];
  content?: string; // legacy / fallback
}

function getMessageText(msg: UIMessage): string {
  if (msg.parts) {
    return msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('');
  }
  return msg.content ?? '';
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  const { messages, tierFilter } = body as {
    messages?: UIMessage[];
    tierFilter?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400 });
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) {
    return new Response(JSON.stringify({ error: 'No user message found' }), { status: 400 });
  }

  const query = getMessageText(lastUserMsg).trim();
  if (!query) {
    return new Response(JSON.stringify({ error: 'User message has no text content' }), { status: 400 });
  }

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

  console.log('[signal/query] retrieved', chunks.length, 'chunks for query:', query.slice(0, 60));

  return generateAnswer(query, chunks, {
    'X-Sources': JSON.stringify(sources),
  });
}
