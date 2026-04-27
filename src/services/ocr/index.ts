/**
 * Active OCR provider.
 *
 * To swap providers, change the import and instantiation below:
 *
 *   // Manual (no OCR — user pastes text):
 *   import { ManualOcrProvider } from './manualProvider';
 *   export const ocrProvider = new ManualOcrProvider();
 *
 *   // Tesseract.js (client-side, no API key needed):
 *   import { TesseractProvider } from './tesseractProvider';
 *   export const ocrProvider = new TesseractProvider('eng+heb');
 *
 *   // English-only (smaller download, faster first run):
 *   export const ocrProvider = new TesseractProvider('eng');
 *
 *   // Future: cloud OCR API
 *   import { GoogleVisionProvider } from './googleVisionProvider';
 *   export const ocrProvider = new GoogleVisionProvider(import.meta.env.VITE_GOOGLE_VISION_KEY);
 */
import { TesseractProvider } from './tesseractProvider';

export const ocrProvider = new TesseractProvider('eng+heb');

export type { OcrProvider, OcrResult, OcrProgress } from './types';
