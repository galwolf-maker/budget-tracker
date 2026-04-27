import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  ImageIcon,
  AlertCircle,
  CheckCircle,
  Info,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { ocrProvider } from '../../services/ocr';
import type { OcrProgress } from '../../services/ocr/types';

interface FileInputStepProps {
  onReady: (text: string) => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'processing'; progress: number; status: string }
  | { kind: 'done'; confidence?: number; method?: string; pageCount?: number }
  | { kind: 'error'; message: string };

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ACCEPTED_ATTR  = ACCEPTED_TYPES.join(',');

// Hebrew Unicode block — used to detect RTL content
const HEB_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/u;

function isRTL(text: string): boolean {
  return HEB_RE.test(text);
}

/** Confidence % → label + colour classes */
function confidenceUi(conf: number): { label: string; bar: string; badge: string } {
  if (conf >= 0.75) return { label: 'High', bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (conf >= 0.45) return { label: 'Medium', bar: 'bg-amber-400',  badge: 'bg-amber-50  text-amber-700  border-amber-200'  };
  return               { label: 'Low',    bar: 'bg-rose-500',   badge: 'bg-rose-50   text-rose-700   border-rose-200'   };
}

const METHOD_LABEL: Record<string, string> = {
  'tesseract-image': 'Tesseract OCR',
  'pdf-native':      'PDF text layer',
  'pdf-ocr':         'PDF → OCR',
  'manual':          'Manual',
};

export function FileInputStep({ onReady }: FileInputStepProps) {
  const [text, setText]         = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase]       = useState<Phase>({ kind: 'idle' });
  const fileRef = useRef<HTMLInputElement>(null);

  // Cast to string so TS doesn't complain when the provider literal type is 'tesseract'
  const isManualProvider = (ocrProvider.name as string) === 'manual';

  // ── File handling ──────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhase({ kind: 'error', message: 'Unsupported file type. Please use PNG, JPG, WEBP, or PDF.' });
      return;
    }

    setFileName(file.name);
    setText('');
    setPhase({ kind: 'processing', progress: 0, status: 'Starting…' });

    try {
      const result = await ocrProvider.extract(
        file,
        (p: OcrProgress) => setPhase({ kind: 'processing', progress: p.progress, status: p.status })
      );

      setPhase({
        kind:      'done',
        confidence: result.confidence,
        method:    result.method,
        pageCount: result.pageCount,
      });
      setText(result.text);
    } catch (err) {
      setPhase({ kind: 'error', message: (err as Error).message });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const resetToIdle = () => {
    setPhase({ kind: 'idle' });
    setFileName(null);
    setText('');
  };

  const handleParse = () => {
    const trimmed = text.trim();
    if (trimmed) onReady(trimmed);
  };

  const processing = phase.kind === 'processing';
  const showRtlHint = text && isRTL(text);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Drop zone ── */}
      {(phase.kind === 'idle' || phase.kind === 'error') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer select-none transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_ATTR}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
          <div className="flex gap-3 text-slate-300">
            <ImageIcon size={26} />
            <UploadCloud size={30} className="text-slate-400" />
            <FileText size={26} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">Drop your statement here</p>
            <p className="text-xs text-slate-400 mt-0.5">PNG · JPG · WEBP · PDF — click to browse</p>
          </div>
        </div>
      )}

      {/* ── Processing: file info + progress bar ── */}
      {phase.kind === 'processing' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-3">
            <FileText size={18} className="text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{phase.status}</span>
              <span>{Math.round(phase.progress * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(phase.progress * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              First run downloads language data (~20 MB). Subsequent runs are instant.
            </p>
          </div>
        </div>
      )}

      {/* ── Done: file info + confidence badge ── */}
      {phase.kind === 'done' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-emerald-500 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate flex-1">{fileName}</span>
            <button
              onClick={resetToIdle}
              title="Upload a different file"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {/* Method badge */}
            {phase.method && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {METHOD_LABEL[phase.method] ?? phase.method}
                {phase.pageCount && phase.pageCount > 1 ? ` · ${phase.pageCount} pages` : ''}
              </span>
            )}

            {/* Confidence badge */}
            {phase.confidence !== undefined && (() => {
              const ui = confidenceUi(phase.confidence);
              return (
                <span className={`px-2 py-0.5 rounded-full border font-medium ${ui.badge}`}>
                  {ui.label} confidence · {Math.round(phase.confidence * 100)}%
                </span>
              );
            })()}
          </div>

          {/* Low-confidence warning */}
          {phase.confidence !== undefined && phase.confidence < 0.45 && (
            <div className="flex gap-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>
                OCR quality is low — the extracted text may contain errors.
                Please review and correct the text below before parsing.
              </span>
            </div>
          )}

          {/* Native PDF info */}
          {phase.method === 'pdf-native' && (
            <div className="flex gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>Text extracted directly from PDF — no OCR needed. Best accuracy.</span>
            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {phase.kind === 'error' && (
        <div className="flex items-start gap-2 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Extraction failed</p>
            <p className="text-xs mt-0.5">{phase.message}</p>
          </div>
        </div>
      )}

      {/* ── Manual provider notice (no Tesseract) ── */}
      {isManualProvider && phase.kind !== 'processing' && (
        <div className="flex items-start gap-2.5 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">OCR not active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Open your statement PDF, select all text (Ctrl+A), copy, and paste below.
            </p>
          </div>
        </div>
      )}

      {/* ── Text area ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <Pencil size={13} className="text-slate-400" />
            {phase.kind === 'done' ? 'Extracted text (editable)' : 'Paste statement text'}
          </label>
          {showRtlHint && (
            <span className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
              Hebrew / RTL detected
            </span>
          )}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={processing}
          dir={showRtlHint ? 'auto' : 'ltr'}
          rows={10}
          spellCheck={false}
          placeholder={
            processing
              ? 'Extracting text…'
              : '01/15/2024  STARBUCKS #1234            4.50\n' +
                '01/14/2024  UBER* TRIP                12.35\n' +
                '15/01/2024  מקדונלדס ישראל           ₪42.50\n' +
                '01/12/2024  PAYMENT THANK YOU        -500.00'
          }
          className={`w-full px-3 py-2.5 text-sm font-mono border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition ${
            processing
              ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-white text-slate-700 border-slate-200 placeholder:text-slate-300'
          }`}
        />

        <p className="mt-1 text-xs text-slate-400">
          Each line should contain a date, description, and amount. You can edit before parsing.
        </p>
      </div>

      {/* ── Parse button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleParse}
          disabled={!text.trim() || processing}
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Parse transactions →
        </button>
      </div>
    </div>
  );
}
