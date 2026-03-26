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
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log('[embeddings] generating for text length', text.length);

  try {
    const result = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768,
      },
    });

    return result.embeddings![0].values!;
  } catch (error) {
    console.error('[embeddings] error generating embedding:', error);
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
