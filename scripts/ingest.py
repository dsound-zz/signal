#!/usr/bin/env python3
"""
PDF text extraction utility for SIGNAL ingestion pipeline.
Usage: python scripts/ingest.py <pdf_path> <output_json>
"""

import sys
import json
import fitz  # PyMuPDF


def extract_pages(pdf_path: str) -> list[dict]:
    pages = []
    doc = fitz.open(pdf_path)

    for i, page in enumerate(doc):
        page_number = i + 1
        text = page.get_text().strip()

        if not text:
            print(f"[ingest] WARNING: page {page_number} has no extractable text (may be scanned), skipping", file=sys.stderr)
            continue

        pages.append({"page_number": page_number, "text": text})

    doc.close()
    return pages


def main():
    if len(sys.argv) != 3:
        print("Usage: python scripts/ingest.py <pdf_path> <output_json>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]

    print(f"[ingest] extracting text from {pdf_path}")
    pages = extract_pages(pdf_path)
    print(f"[ingest] extracted {len(pages)} pages with text")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump({"pages": pages}, f, ensure_ascii=False, indent=2)

    print(f"[ingest] wrote {output_path}")


if __name__ == "__main__":
    main()
