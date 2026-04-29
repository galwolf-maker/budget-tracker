import { Check, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import type { DuplicateGroup } from '../../utils/duplicateDetector';

interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DuplicateGroup[];
  onKeepBoth: (pairId: string) => void;
  onDeleteDuplicate: (txnId: string, pairId: string) => void;
}

export function DuplicateReviewModal({
  isOpen,
  onClose,
  groups,
  onKeepBoth,
  onDeleteDuplicate,
}: DuplicateReviewModalProps) {
  const { currency } = useCurrencyContext();
  const fmt = (v: number) => formatCurrency(v, currency);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Possible Duplicates" maxWidth="max-w-xl">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        These transaction pairs look like duplicates — often from overlapping credit card statements.
        Delete the duplicate entry or keep both if they are intentional.
      </p>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Check size={20} className="text-emerald-500" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No duplicates found.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-0.5">
          {groups.map(g => {
            const [first, second] = g.transactions;
            return (
              <div
                key={g.id}
                className="rounded-xl border border-rose-100 dark:border-rose-900/40 overflow-hidden"
              >
                {/* Side-by-side transaction cards */}
                <div className="grid grid-cols-2 divide-x divide-rose-100 dark:divide-rose-900/40">
                  {/* Older = "original" */}
                  <div className="p-3 bg-white dark:bg-slate-800">
                    <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">
                      Original
                    </p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug line-clamp-2">
                      {first.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{first.date}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">
                      {fmt(first.amount)}
                    </p>
                  </div>

                  {/* Newer = "duplicate?" */}
                  <div className="p-3 bg-rose-50/60 dark:bg-rose-900/10">
                    <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wider mb-1.5">
                      Duplicate?{g.daysDiff > 0 ? ` (+${g.daysDiff}d)` : ''}
                    </p>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-snug line-clamp-2">
                      {second.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{second.date}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1">
                      {fmt(second.amount)}
                    </p>
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-rose-100 dark:border-rose-900/30">
                  <button
                    onClick={() => onKeepBoth(g.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Keep Both
                  </button>
                  <button
                    onClick={() => onDeleteDuplicate(second.id, g.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete Duplicate
                  </button>
                </div>
              </div>
            );
          })}
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
