import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, Pencil, FileText, Table2, ImageIcon,
  CheckCircle, AlertCircle, Info, ChevronLeft,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { PreviewStep, type PreviewRow } from './PreviewStep';
import { parseStatementText } from '../../utils/statementParser';
import { parseXlsx } from '../../utils/xlsxParser';
import { parseCSV } from '../../utils/csv';
import { categorize, categorizeFromSector } from '../../utils/categorizer';
import { ocrProvider } from '../../services/ocr';
import type { OcrProgress } from '../../services/ocr/types';
import type { Category, Transaction } from '../../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  merchantRules: Record<string, string>;
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

type Step = 'choose' | 'uploading' | 'text' | 'preview' | 'done';

const XLSX_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const OCR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ACCEPTED_ATTR = [...OCR_TYPES, ...XLSX_TYPES, '.xlsx', '.xls', '.csv'].join(',');

const HEB_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/u;
function isRTL(t: string) { return HEB_RE.test(t); }

const METHOD_LABEL: Record<string, string> = {
  'tesseract-image': 'Tesseract OCR',
  'pdf-native':      'PDF text layer',
  'pdf-ocr':         'PDF → OCR',
  'manual':          'Manual',
};

function confidenceUi(conf: number) {
  if (conf >= 0.75) return { label: 'High',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (conf >= 0.45) return { label: 'Medium', badge: 'bg-amber-50  text-amber-700  border-amber-200'  };
  return               { label: 'Low',    badge: 'bg-rose-50   text-rose-700   border-rose-200'   };
}

export function ImportModal({ isOpen, onClose, categories, merchantRules, onImport }: ImportModalProps) {
  const [step, setStep]                 = useState<Step>('choose');
  const [dragging, setDragging]         = useState(false);
  const [uploadProgress, setProgress]   = useState(0);
  const [uploadStatus, setStatus]       = useState('');
  const [uploadFileName, setFileName]   = useState('');
  const [ocrMethod, setOcrMethod]       = useState<string | undefined>();
  const [ocrConfidence, setOcrConf]     = useState<number | undefined>();
  const [text, setText]                 = useState('');
  const [textError, setTextError]       = useState('');
  const [previewRows, setPreviewRows]   = useState<PreviewRow[]>([]);
  const [importedCount, setCount]       = useState(0);
  const [previewBack, setPreviewBack]   = useState<'choose' | 'text'>('choose');
  const fileRef = useRef<HTMLInputElement>(null);

  const expCats = categories.filter(c => c.type === 'expense').map(c => c.name);
  const incCats = categories.filter(c => c.type === 'income').map(c => c.name);

  const resetToChoose = () => {
    setStep('choose');
    setDragging(false);
    setProgress(0);
    setStatus('');
    setFileName('');
    setOcrMethod(undefined);
    setOcrConf(undefined);
    setText('');
    setTextError('');
    setPreviewRows([]);
    setPreviewBack('choose');
  };

  const handleClose = () => { resetToChoose(); setCount(0); onClose(); };

  // ── File processing ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isXlsx = XLSX_TYPES.includes(file.type) || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');
    const isCsv  = file.type === 'text/csv' || lowerName.endsWith('.csv');
    const isOcr  = OCR_TYPES.includes(file.type);

    if (!isXlsx && !isCsv && !isOcr) {
      setTextError('Unsupported file type. Please use CSV, Excel (.xlsx), PDF, or an image.');
      setStep('text');
      return;
    }

    setFileName(file.name);
    setStep('uploading');

    // ── CSV ──────────────────────────────────────────────────────────────────
    if (isCsv) {
      try {
        setProgress(0.3); setStatus('Reading CSV…');
        const content = await file.text();
        setProgress(0.7); setStatus('Parsing rows…');
        const parsed = parseCSV(content, merchantRules);
        if (parsed.length === 0) throw new Error('No transactions found in this CSV file.');
        const rows: PreviewRow[] = parsed.map((t, i) => ({
          id: `csv-${Date.now()}-${i}`,
          selected: true,
          date: t.date,
          description: t.description,
          category: t.category,
          amount: t.amount,
          type: t.type,
        }));
        setPreviewRows(rows);
        setPreviewBack('choose');
        setStep('preview');
      } catch (err) {
        setTextError((err as Error).message);
        setStep('text');
      }
      return;
    }

    // ── XLSX ─────────────────────────────────────────────────────────────────
    if (isXlsx) {
      try {
        setProgress(0.3); setStatus('Reading Excel file…');
        setProgress(0.6); setStatus('Parsing rows…');
        const parsed = await parseXlsx(file);
        if (parsed.length === 0) throw new Error('No transactions found. Check that the file contains Hebrew column headers.');
        const eCats = categories.filter(c => c.type === 'expense').map(c => c.name);
        const iCats = categories.filter(c => c.type === 'income').map(c => c.name);
        const rows: PreviewRow[] = parsed.map(p => {
          const type = p.isCredit ? 'income' : 'expense';
          const avail = type === 'income' ? iCats : eCats;
          let category = categorize(p.description, avail);
          const fallback = avail.includes('Other') ? 'Other' : (avail[0] ?? 'Other');
          if (category === fallback && p.sector) category = categorizeFromSector(p.sector, avail);
          return { id: p.id, selected: true, date: p.date, description: p.description, category, amount: p.amount, type };
        });
        setPreviewRows(rows);
        setPreviewBack('choose');
        setStep('preview');
      } catch (err) {
        setTextError((err as Error).message);
        setStep('text');
      }
      return;
    }

    // ── OCR / PDF ────────────────────────────────────────────────────────────
    try {
      const result = await ocrProvider.extract(file, (p: OcrProgress) => {
        setProgress(p.progress);
        setStatus(p.status);
      });
      setOcrMethod(result.method);
      setOcrConf(result.confidence);
      setText(result.text);
      setTextError('');
      setStep('text');
    } catch (err) {
      setTextError((err as Error).message);
      setStep('text');
    }
  }, [categories, merchantRules]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Text → Preview ───────────────────────────────────────────────────────────
  const handleParseText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const parsed = parseStatementText(trimmed);
      if (parsed.length === 0) {
        setTextError('No transactions could be parsed. Check the format and try again.');
        return;
      }
      const rows: PreviewRow[] = parsed.map(p => {
        const type = p.isCredit ? 'income' : 'expense';
        const avail = type === 'income' ? incCats : expCats;
        return {
          id: p.id,
          selected: true,
          date: p.date,
          description: p.description,
          category: categorize(p.description, avail),
          amount: p.amount,
          type,
        };
      });
      setTextError('');
      setPreviewRows(rows);
      setPreviewBack('text');
      setStep('preview');
    } catch (err) {
      setTextError((err as Error).message);
    }
  };

  const handleConfirm = (selectedRows: PreviewRow[]) => {
    const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = selectedRows.map(r => ({
      type: r.type, amount: r.amount, category: r.category, date: r.date, description: r.description,
    }));
    onImport(transactions);
    setCount(transactions.length);
    setStep('done');
  };

  const titleMap: Record<Step, string> = {
    choose:    'Import Data',
    uploading: 'Import Data',
    text:      'Import Data',
    preview:   'Review Transactions',
    done:      'Import Complete',
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={titleMap[step]} maxWidth="max-w-2xl">

      {/* ── Choose ── */}
      {step === 'choose' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_ATTR}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Choose how you want to import transactions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Upload File */}
            <button
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                dragging
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <UploadCloud size={22} className="text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Upload File</p>
                <p className="text-xs text-slate-400 mt-0.5">CSV · Excel · PDF · Image</p>
                <p className="text-xs text-slate-400">or drag & drop here</p>
              </div>
              <div className="flex gap-2 text-slate-300">
                <Table2 size={15} />
                <FileText size={15} />
                <ImageIcon size={15} />
              </div>
            </button>

            {/* Paste Text */}
            <button
              onClick={() => { setText(''); setTextError(''); setOcrMethod(undefined); setOcrConf(undefined); setStep('text'); }}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <Pencil size={20} className="text-slate-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Paste Text</p>
                <p className="text-xs text-slate-400 mt-0.5">Paste from a statement</p>
                <p className="text-xs text-slate-400">or type manually</p>
              </div>
            </button>
          </div>

          {dragging && (
            <p className="mt-3 text-center text-sm text-blue-600 dark:text-blue-400 font-medium animate-pulse">
              Drop to upload
            </p>
          )}
        </div>
      )}

      {/* ── Uploading ── */}
      {step === 'uploading' && (
        <div className="py-2">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-blue-500 shrink-0" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{uploadFileName}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{uploadStatus}</span>
                <span>{Math.round(uploadProgress * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                First OCR run downloads language data (~20 MB). Subsequent runs are instant.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Text ── */}
      {step === 'text' && (
        <div className="space-y-4">
          <button
            onClick={() => { setTextError(''); setText(''); setOcrMethod(undefined); setOcrConf(undefined); setStep('choose'); }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <ChevronLeft size={14} />
            Back
          </button>

          {/* OCR metadata badges */}
          {ocrMethod && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                {METHOD_LABEL[ocrMethod] ?? ocrMethod}
              </span>
              {ocrConfidence !== undefined && (() => {
                const ui = confidenceUi(ocrConfidence);
                return (
                  <span className={`px-2 py-0.5 rounded-full border font-medium ${ui.badge}`}>
                    {ui.label} confidence · {Math.round(ocrConfidence * 100)}%
                  </span>
                );
              })()}
            </div>
          )}

          {ocrConfidence !== undefined && ocrConfidence < 0.45 && (
            <div className="flex gap-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>OCR quality is low — review and correct the text before parsing.</span>
            </div>
          )}

          {ocrMethod === 'pdf-native' && (
            <div className="flex gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2">
              <Info size={13} className="shrink-0 mt-0.5" />
              <span>Text extracted directly from PDF — no OCR needed. Best accuracy.</span>
            </div>
          )}

          {textError && (
            <div className="flex items-start gap-2 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{textError}</span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              <Pencil size={13} className="text-slate-400" />
              {ocrMethod ? 'Extracted text (editable)' : 'Paste statement text'}
              {isRTL(text) && (
                <span className="ml-auto text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 font-normal">
                  Hebrew / RTL detected
                </span>
              )}
            </label>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setTextError(''); }}
              dir={isRTL(text) ? 'auto' : 'ltr'}
              rows={10}
              spellCheck={false}
              placeholder={
                '01/15/2024  STARBUCKS #1234            4.50\n' +
                '01/14/2024  UBER* TRIP                12.35\n' +
                '15/01/2024  מקדונלדס ישראל           ₪42.50\n' +
                '01/12/2024  PAYMENT THANK YOU        -500.00'
              }
              className="w-full px-3 py-2.5 text-sm font-mono border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
            />
            <p className="mt-1 text-xs text-slate-400">
              Each line should contain a date, description, and amount.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleParseText}
              disabled={!text.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Parse transactions →
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {step === 'preview' && (
        <PreviewStep
          rows={previewRows}
          categories={categories}
          onConfirm={handleConfirm}
          onBack={() => setStep(previewBack)}
        />
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              They have been added to your transactions list.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={resetToChoose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Import another
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
