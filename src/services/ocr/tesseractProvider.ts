import Tesseract from 'tesseract.js';
import type { OcrProvider, OcrResult, OcrProgress } from './types';

// ── PDF.js lazy loader ───────────────────────────────────────────────────────
// Imported dynamically to avoid bundling the heavy worker at startup.
// The worker itself is loaded from unpkg so Vite doesn't need to resolve it.

type PdfjsModule = typeof import('pdfjs-dist');
let _pdfjs: PdfjsModule | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
  if (_pdfjs) return _pdfjs;
  const lib = await import('pdfjs-dist');
  // Point the worker at the matching version on unpkg — avoids Vite worker bundling issues.
  lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
  _pdfjs = lib;
  return lib;
}

// ── PDF helpers ──────────────────────────────────────────────────────────────

/**
 * Attempt to extract the native text layer from a PDF.
 * Returns null if the PDF is image-only (scanned) or has too little text.
 */
async function extractNativePdfText(file: File): Promise<string | null> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Each TextItem has a `str` field; TextMarkedContent items do not.
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(line);
  }

  const full = pageTexts.join('\n').trim();
  // Heuristic: fewer than 60 chars means the PDF is probably scanned/image-only.
  return full.length >= 60 ? full : null;
}

/**
 * Render each page of a PDF to a PNG blob at 2× scale for better OCR quality.
 * Caps at 6 pages to avoid very long waits on thick documents.
 */
async function renderPdfPagesToBlobs(
  file: File,
  onProgress: (msg: string) => void
): Promise<Blob[]> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const total = Math.min(pdf.numPages, 6);
  const blobs: Blob[] = [];

  for (let p = 1; p <= total; p++) {
    onProgress(`Rendering page ${p} of ${total}…`);
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: canvas.getContext('2d')!,
      viewport,
    }).promise;

    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/png'
      )
    );
    blobs.push(blob);
  }

  return blobs;
}

// ── Tesseract helpers ────────────────────────────────────────────────────────

const LOW_CONFIDENCE_THRESHOLD = 45; // percent — below this we warn the user

function buildTesseractLogger(
  onProgress: (p: OcrProgress) => void,
  baseOffset = 0,
  range = 1
) {
  return (m: Tesseract.LoggerMessage) => {
    switch (m.status) {
      case 'loading tesseract core':
        onProgress({ progress: baseOffset + range * 0.02, status: 'Loading OCR engine…' });
        break;
      case 'loading language traineddata':
        // m.progress goes 0→1 during the download
        onProgress({
          progress: baseOffset + range * (0.03 + m.progress * 0.12),
          status: `Downloading language data… ${Math.round(m.progress * 100)}%`,
        });
        break;
      case 'initializing api':
        onProgress({ progress: baseOffset + range * 0.16, status: 'Initializing OCR…' });
        break;
      case 'recognizing text':
        onProgress({
          progress: baseOffset + range * (0.18 + m.progress * 0.82),
          status: 'Recognizing text…',
        });
        break;
    }
  };
}

async function runTesseract(
  source: Blob | File,
  lang: string,
  onProgress: (p: OcrProgress) => void,
  baseOffset = 0,
  range = 1
): Promise<{ text: string; confidence: number }> {
  const result = await Tesseract.recognize(source, lang, {
    logger: buildTesseractLogger(onProgress, baseOffset, range),
  });
  return {
    text: result.data.text,
    confidence: result.data.confidence,
  };
}

// ── Main provider ────────────────────────────────────────────────────────────

export class TesseractProvider implements OcrProvider {
  readonly name = 'tesseract';

  /**
   * @param lang  Tesseract language string.
   *              'eng+heb' loads both English and Hebrew traineddata from CDN
   *              on first use (~4–20 MB). Subsequent runs use the browser cache.
   */
  constructor(private readonly lang: string = 'eng+heb') {}

  async extract(
    file: File,
    onProgress: (p: OcrProgress) => void = () => undefined
  ): Promise<OcrResult> {
    // ── PDF ────────────────────────────────────────────────────────
    if (file.type === 'application/pdf') {
      onProgress({ progress: 0.05, status: 'Reading PDF…' });

      // 1. Try native text layer first (fast, no OCR needed)
      const nativeText = await extractNativePdfText(file);
      if (nativeText) {
        onProgress({ progress: 1, status: 'Done' });
        return {
          text: nativeText,
          confidence: undefined,   // not applicable for native text
          requiresManualInput: false,
          method: 'pdf-native',
        };
      }

      // 2. Scanned PDF → render pages → OCR each one
      const blobs = await renderPdfPagesToBlobs(file, (msg) =>
        onProgress({ progress: 0.15, status: msg })
      );

      const texts: string[] = [];
      let totalConfidence = 0;

      for (let i = 0; i < blobs.length; i++) {
        const pageBase = 0.2 + (i / blobs.length) * 0.75;
        const pageRange = 0.75 / blobs.length;
        const { text, confidence } = await runTesseract(
          blobs[i],
          this.lang,
          onProgress,
          pageBase,
          pageRange
        );
        texts.push(text);
        totalConfidence += confidence;
      }

      const avgConfidence = blobs.length > 0 ? totalConfidence / blobs.length : 0;
      onProgress({ progress: 1, status: 'Done' });

      return {
        text: texts.join('\n--- page break ---\n'),
        confidence: avgConfidence / 100,
        requiresManualInput: avgConfidence < LOW_CONFIDENCE_THRESHOLD,
        method: 'pdf-ocr',
        pageCount: blobs.length,
      };
    }

    // ── Image (PNG / JPEG / WEBP) ──────────────────────────────────
    onProgress({ progress: 0, status: 'Starting OCR…' });
    const { text, confidence } = await runTesseract(file, this.lang, onProgress);
    onProgress({ progress: 1, status: 'Done' });

    return {
      text,
      confidence: confidence / 100,
      requiresManualInput: confidence < LOW_CONFIDENCE_THRESHOLD,
      method: 'tesseract-image',
    };
  }
}
