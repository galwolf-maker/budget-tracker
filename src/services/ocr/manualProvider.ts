import type { OcrProvider, OcrResult, OcrProgress } from './types';

/**
 * Stub provider — always signals the UI to show the manual paste textarea.
 * Replace this by swapping the export in src/services/ocr/index.ts.
 */
export class ManualOcrProvider implements OcrProvider {
  readonly name = 'manual';

  async extract(
    _file: File,
    _onProgress?: (p: OcrProgress) => void
  ): Promise<OcrResult> {
    return {
      text: '',
      confidence: undefined,
      requiresManualInput: true,
      method: 'manual',
    };
  }
}
