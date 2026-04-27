/** Granular progress update emitted during extraction */
export interface OcrProgress {
  /** 0–1 */
  progress: number;
  /** Human-readable status for the UI */
  status: string;
}

export interface OcrResult {
  /** Raw text extracted from the document */
  text: string;
  /**
   * 0–1 confidence score from the OCR engine.
   * undefined when not available (e.g. native PDF text extraction).
   */
  confidence?: number;
  /** When true the provider couldn't extract usable text — show the paste textarea */
  requiresManualInput: boolean;
  /** How the text was obtained — useful for debugging and UI hints */
  method?: 'tesseract-image' | 'pdf-native' | 'pdf-ocr' | 'manual';
  /** Number of pages processed (PDF only) */
  pageCount?: number;
}

/**
 * Implement this interface to plug in any OCR backend.
 * Swap the export in src/services/ocr/index.ts to activate a new provider.
 *
 * Current providers:
 *   ManualOcrProvider   — stub, asks user to paste text
 *   TesseractProvider   — client-side OCR via Tesseract.js + PDF.js
 *
 * Future provider examples:
 *   GoogleVisionProvider  — Cloud Vision API
 *   AwsTextractProvider   — AWS Textract
 *   AzureDocumentProvider — Azure AI Document Intelligence
 */
export interface OcrProvider {
  readonly name: string;
  extract(
    file: File,
    onProgress?: (p: OcrProgress) => void
  ): Promise<OcrResult>;
}
