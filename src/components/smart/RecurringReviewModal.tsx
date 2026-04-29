import { Repeat2, X, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import type { RecurringCandidate } from '../../utils/recurringDetector';

interface RecurringReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: RecurringCandidate[];
  onMarkRecurring: (candidate: RecurringCandidate) => void;
  onDismiss: (key: string) => void;
}

export function RecurringReviewModal({
  isOpen,
  onClose,
  candidates,
  onMarkRecurring,
  onDismiss,
}: RecurringReviewModalProps) {
  const { currency } = useCurrencyContext();
  const fmt = (v: number) => formatCurrency(v, currency);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recurring Payments" maxWidth="max-w-lg">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        These payments appear every month. Mark them as recurring to auto-add them going forward.
      </p>

      {candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check size={20} className="text-emerald-500" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All caught up — no recurring candidates.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
          {candidates.map(c => (
            <div
              key={c.key}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Repeat2 size={15} className="text-amber-500" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {c.description}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {fmt(c.amount)}
                  {' · '}
                  {c.category}
                  {' · '}
                  seen {c.monthCount}× across {c.monthCount} months
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => onMarkRecurring(c)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                >
                  <Repeat2 size={10} />
                  Mark
                </button>
                <button
                  onClick={() => onDismiss(c.key)}
                  title="Dismiss"
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
