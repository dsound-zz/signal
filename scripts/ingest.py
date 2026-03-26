"""PDF text extraction script with fallback support.

This module provides utilities to extract text from PDF files using PyMuPDF
as the primary method, falling back to Poppler's pdftotext for PDF/UA
tagged documents, and finally falling back to OCR via pdf2image + pytesseract
for scanned documents that contain no embedded text.
"""

# Standard library imports (grouped and alphabetically sorted)
import argparse
import json
import logging
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Third-party imports
try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF not installed. Run: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)

try:
    from pdf2image import convert_from_path
    import pytesseract
except ImportError:
    convert_from_path = None  # type: ignore[assignment]
    pytesseract = None  # type: ignore[assignment]

OCR_AVAILABLE = convert_from_path is not None

# Constants
DEFAULT_PDFTOTEXT_PATH = os.getenv(
    'PDFTOTEXT_PATH',
    '/opt/homebrew/bin/pdftotext'
)
DEFAULT_PDFTOPPM_PATH = os.getenv(
    'PDFTOPPM_PATH',
    '/opt/homebrew/bin'
)
MIN_PAGE_TEXT_LENGTH = 50
MIN_TEXT_EXTRACTION_LENGTH = 100
EXTRACTION_THRESHOLD = 0.5  # Minimum ratio of pages extracted to use PyMuPDF
SUBPROCESS_TIMEOUT = 60  # seconds

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(name)s] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger('ingest')


class PDFExtractionError(Exception):
    """Custom exception for PDF extraction failures."""
    pass


def extract_with_poppler(
    pdf_path: Path,
    pdftotext_path: str = DEFAULT_PDFTOTEXT_PATH,
) -> List[Dict[str, any]]:
    try:
        result = subprocess.run(
            [pdftotext_path, '-nopgbrk', str(pdf_path), '-'],
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
            check=False,
        )
        if result.returncode == 0:
            full_text = result.stdout.strip()
            if len(full_text) < MIN_TEXT_EXTRACTION_LENGTH:
                logger.warning("pdftotext returned almost no text")
                return []

            logger.info(f"pdftotext got {len(full_text)} chars total")

            # Try form-feed page splits first
            raw_pages = [
                p.strip() for p in full_text.split('\f')
                if len(p.strip()) >= MIN_PAGE_TEXT_LENGTH
            ]

            if len(raw_pages) >= 3:
                logger.info(f"split into {len(raw_pages)} pages via form-feed")
                return [
                    {"page_number": i + 1, "text": p}
                    for i, p in enumerate(raw_pages)
                ]

            # No form-feeds — return as single large chunk, chunker will
            # split it downstream
            logger.info(
                f"no form-feeds found, returning as 1 chunk ({len(full_text)} chars)"
            )
            return [{"page_number": 1, "text": full_text}]

        logger.warning(f"pdftotext returned non-zero exit code: {result.returncode}")
        if result.stderr:
            logger.debug(f"pdftotext stderr: {result.stderr}")
    except subprocess.TimeoutExpired:
        logger.error(f"pdftotext timed out after {SUBPROCESS_TIMEOUT} seconds")
    except FileNotFoundError:
        logger.error(
            f"pdftotext not found at {pdftotext_path}. "
            "Install poppler: brew install poppler"
        )
    return []


def extract_with_ocr(
    pdf_path: Path,
    pdftoppm_path: str = DEFAULT_PDFTOPPM_PATH,
) -> List[Dict[str, any]]:
    if not OCR_AVAILABLE:
        logger.error(
            "OCR unavailable. Install: pip install pdf2image pytesseract"
        )
        return []

    try:
        logger.info("Attempting OCR extraction")
        images = convert_from_path(str(pdf_path), poppler_path=pdftoppm_path)
        pages = []
        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image).strip()
            if len(text) >= MIN_PAGE_TEXT_LENGTH:
                pages.append({"page_number": i + 1, "text": text})
                logger.info(f"OCR page {i + 1}: {len(text)} chars")
        return pages
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        return []


def extract_with_pymupdf(pdf_path: Path) -> Dict[int, str]:
    """Extract text from PDF using PyMuPDF (fast method).
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Dictionary mapping page indices to extracted text
        
    Raises:
        PDFExtractionError: If PDF cannot be opened
    """
    try:
        doc = fitz.open(str(pdf_path))
    except Exception as e:
        raise PDFExtractionError(f"Failed to open PDF with PyMuPDF: {e}")
    
    try:
        pages = {}
        for i, page in enumerate(doc):
            try:
                text = page.get_text().strip()
                if len(text) >= MIN_PAGE_TEXT_LENGTH:
                    pages[i] = text
            except Exception as e:
                logger.warning(f"Failed to extract text from page {i + 1}: {e}")
                continue
        
        return pages
    finally:
        doc.close()


def extract_pages(
    pdf_path: Path,
    pdftotext_path: str = DEFAULT_PDFTOTEXT_PATH,
    pdftoppm_path: str = DEFAULT_PDFTOPPM_PATH,
) -> List[Dict[str, any]]:
    """Extract text pages from PDF using the best available method.

    Attempts PyMuPDF first (fast), then Poppler, then OCR as a last resort.
    
    Args:
        pdf_path: Path to the PDF file
        pdftotext_path: Path to pdftotext executable
        
    Returns:
        List of dictionaries containing page_number and text
        
    Raises:
        PDFExtractionError: If extraction fails completely
    """
    # First pass: PyMuPDF (fast, works on most PDFs)
    try:
        fitz_pages = extract_with_pymupdf(pdf_path)
    except PDFExtractionError as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")
        fitz_pages = {}
    
    # Get total page count
    try:
        with fitz.open(str(pdf_path)) as doc:
            total_pages = len(doc)
    except Exception as e:
        logger.error(f"Cannot determine page count: {e}")
        total_pages = len(fitz_pages)  # Best guess
    
    # If PyMuPDF got most pages, use it
    extraction_ratio = len(fitz_pages) / total_pages if total_pages > 0 else 0
    
    if extraction_ratio >= EXTRACTION_THRESHOLD:
        pages = [
            {"page_number": i + 1, "text": text}
            for i, text in sorted(fitz_pages.items())
        ]
        logger.info(
            f"Extracted {len(pages)}/{total_pages} pages via PyMuPDF "
            f"({extraction_ratio:.1%})"
        )
        return pages
    
    # Otherwise fall back to Poppler for the whole document
    logger.info(
        f"PyMuPDF extracted only {len(fitz_pages)}/{total_pages} pages "
        f"({extraction_ratio:.1%}) — falling back to pdftotext"
    )
    
    pages = extract_with_poppler(pdf_path, pdftotext_path)
    total_chars = sum(len(p['text']) for p in pages)
    if len(pages) >= 3 and total_chars > 5000:
        logger.info(f"Extracted {len(pages)} pages via pdftotext")
        return pages

    # Final fallback: OCR for scanned documents with no embedded text
    logger.info(
        f"pdftotext insufficient ({len(pages)} pages, {total_chars} chars)"
        " — falling back to OCR"
    )
    pages = extract_with_ocr(pdf_path, pdftoppm_path)
    logger.info(f"Extracted {len(pages)} pages via OCR")
    return pages


def validate_pdf_path(pdf_path: Path) -> None:
    """Validate that the PDF path exists and is readable.
    
    Args:
        pdf_path: Path to validate
        
    Raises:
        FileNotFoundError: If file doesn't exist
        PermissionError: If file isn't readable
        ValueError: If file isn't a PDF
    """
    if not pdf_path.exists():
        raise FileNotFoundError(f"File not found: {pdf_path}")
    
    if not pdf_path.is_file():
        raise ValueError(f"Not a file: {pdf_path}")
    
    if not os.access(pdf_path, os.R_OK):
        raise PermissionError(f"File not readable: {pdf_path}")
    
    if pdf_path.suffix.lower() != '.pdf':
        logger.warning(f"File doesn't have .pdf extension: {pdf_path}")


def save_pages(pages: List[Dict[str, any]], output_path: Path) -> None:
    """Save extracted pages to JSON file.
    
    Args:
        pages: List of page dictionaries
        output_path: Path where to save the JSON
        
    Raises:
        IOError: If writing fails
    """
    try:
        # Ensure parent directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                {"pages": pages},
                f,
                ensure_ascii=False,
                indent=2
            )
        logger.info(f"Wrote {len(pages)} pages to {output_path}")
    except Exception as e:
        raise IOError(f"Failed to write output file: {e}")


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments.
    
    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description='Extract text from PDF files with fallback support',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ingest.py input.pdf output.json
  python ingest.py --pdftotext /usr/local/bin/pdftotext doc.pdf out.json
  python ingest.py --verbose input.pdf output.json
        """
    )
    
    parser.add_argument(
        'input_pdf',
        type=Path,
        help='Path to input PDF file'
    )
    
    parser.add_argument(
        'output_json',
        type=Path,
        help='Path to output JSON file'
    )
    
    parser.add_argument(
        '--pdftotext',
        type=str,
        default=DEFAULT_PDFTOTEXT_PATH,
        help=f'Path to pdftotext executable (default: {DEFAULT_PDFTOTEXT_PATH})'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    return parser.parse_args()


def main() -> int:
    """Main entry point for the script.
    
    Returns:
        Exit code (0 for success, 1 for error)
    """
    args = parse_arguments()
    
    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    try:
        # Validate input
        logger.info(f"Processing PDF: {args.input_pdf}")
        validate_pdf_path(args.input_pdf)
        
        # Extract pages
        pages = extract_pages(args.input_pdf, args.pdftotext)
        
        if not pages:
            logger.error(f"No text extracted from {args.input_pdf}")
            return 1
        
        # Save output
        save_pages(pages, args.output_json)
        logger.info("Extraction completed successfully")
        return 0
        
    except FileNotFoundError as e:
        logger.error(str(e))
        return 1
    except PermissionError as e:
        logger.error(str(e))
        return 1
    except PDFExtractionError as e:
        logger.error(f"Extraction failed: {e}")
        return 1
    except IOError as e:
        logger.error(str(e))
        return 1
    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
        return 130  # Standard Unix exit code for SIGINT
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
