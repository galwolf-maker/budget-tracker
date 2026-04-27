import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { FileInputStep } from './FileInputStep';
import { PreviewStep, type PreviewRow } from './PreviewStep';
import { parseStatementText } from '../../utils/statementParser';
import { categorize } from '../../utils/categorizer';
import type { Category, Transaction } from '../../types';

interface StatementImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onImport: (transactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

type Step = 'input' | 'preview' | 'done';

const STEP_LABELS: Record<Step, string> = {
  input: 'Upload / Paste',
  preview: 'Review',
  done: 'Done',
};

const STEP_ORDER: Step[] = ['input', 'preview', 'done'];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEP_ORDER.filter((s) => s !== 'done').map((step, i) => {
        const idx = STEP_ORDER.indexOf(step);
        const done = currentIdx > idx;
        const active = currentIdx === idx;
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  active ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEP_ORDER.filter((s) => s !== 'done').length - 1 && (
              <div
                className={`flex-1 h-px mx-3 transition-colors ${
                  done ? 'bg-emerald-300' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StatementImportModal({
  isOpen,
  onClose,
  categories,
  onImport,
}: StatementImportModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const expenseCategories = categories
    .filter((c) => c.type === 'expense')
    .map((c) => c.name);

  const incomeCategories = categories
    .filter((c) => c.type === 'income')
    .map((c) => c.name);

  // Called when the user clicks "Parse transactions →" in FileInputStep
  const handleTextReady = (text: string) => {
    const parsed = parseStatementText(text);

    const rows: PreviewRow[] = parsed.map((p) => {
      const type = p.isCredit ? 'income' : 'expense';
      const availableCats = p.isCredit ? incomeCategories : expenseCategories;
      const category = categorize(p.description, availableCats);

      return {
        id: p.id,
        selected: true,
        date: p.date,
        description: p.description,
        category,
        amount: p.amount,
        type,
      };
    });

    setPreviewRows(rows);
    setStep('preview');
  };

  // Called when user clicks "Import X transactions" in PreviewStep
  const handleConfirm = (selectedRows: PreviewRow[]) => {
    const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = selectedRows.map(
      (r) => ({
        type: r.type,
        amount: r.amount,
        category: r.category,
        date: r.date,
        description: r.description,
      })
    );
    onImport(transactions);
    setImportedCount(transactions.length);
    setStep('done');
  };

  const handleClose = () => {
    // Reset state on close
    setStep('input');
    setPreviewRows([]);
    setImportedCount(0);
    onClose();
  };

  const titleMap: Record<Step, string> = {
    input: 'Import Credit Card Statement',
    preview: 'Review Transactions',
    done: 'Import Complete',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={titleMap[step]}
      maxWidth="max-w-2xl"
    >
      {step !== 'done' && <StepIndicator current={step} />}

      {step === 'input' && <FileInputStep onReady={handleTextReady} />}

      {step === 'preview' && (
        <PreviewStep
          rows={previewRows}
          categories={categories}
          onConfirm={handleConfirm}
          onBack={() => setStep('input')}
        />
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {importedCount} transaction{importedCount !== 1 ? 's' : ''} imported
            </p>
            <p className="text-sm text-slate-500 mt-1">
              They have been added to your transactions list.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => {
                setStep('input');
                setPreviewRows([]);
                setImportedCount(0);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
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
