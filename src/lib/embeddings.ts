import { GoogleGenAI } from '@google/genai';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY environment variable is not set');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

/**
 * Generate embeddings for text using gemini-embedding-001 (768-dim output)
 * @param text - The text to embed
 * @returns A 768-dimensional embedding vector
 */
export async function generateEmbedding(text: string, retries = 5): Promise<number[]> {
  console.log('[embeddings] generating for text length', text.length);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await genAI.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
        config: {
          outputDimensionality: 768,
        },
      });

      return result.embeddings![0].values!;
    } catch (error: any) {
      const is429 = error?.status === 429 || error?.message?.includes('"code":429');
      if (is429 && attempt < retries) {
        const waitMs = Math.min(1000 * 2 ** attempt, 60_000); // 1s, 2s, 4s, 8s, 16s, cap 60s
        console.warn(`[embeddings] 429 rate limit — retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      console.error('[embeddings] error generating embedding:', error);
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  throw new Error('Failed to generate embedding after max retries');
}
