export interface PageContent {
  page_number: number;
  text: string;
}

export interface Chunk {
  content: string;
  page_number: number;
  chunk_index: number;
}

// ~512 tokens at ~0.75 words/token
const CHUNK_WORDS = 384;
const OVERLAP_WORDS = 38;
const MIN_WORDS = 50;

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export function chunkPages(pages: PageContent[]): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const words = splitWords(page.text);
    if (words.length === 0) continue;

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + CHUNK_WORDS, words.length);
      const chunkWords = words.slice(start, end);

      if (chunkWords.length >= MIN_WORDS) {
        chunks.push({
          content: chunkWords.join(' '),
          page_number: page.page_number,
          chunk_index: chunkIndex++,
        });
      }

      if (end === words.length) break;
      start = end - OVERLAP_WORDS;
    }
  }

  return chunks;
}
