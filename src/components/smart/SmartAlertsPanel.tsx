import { Repeat2, Copy, ChevronRight } from 'lucide-react';

interface SmartAlertsPanelProps {
  recurringCount: number;
  duplicateCount: number;
  onReviewRecurring: () => void;
  onReviewDuplicates: () => void;
}

export function SmartAlertsPanel({
  recurringCount,
  duplicateCount,
  onReviewRecurring,
  onReviewDuplicates,
}: SmartAlertsPanelProps) {
  if (recurringCount === 0 && duplicateCount === 0) return null;

  return (
    <div className="space-y-2">
      {recurringCount > 0 && (
        <button
          onClick={onReviewRecurring}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left group"
        >
          <Repeat2 size={15} className="shrink-0 text-amber-500" />
          <span className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-300">
            {recurringCount} recurring payment{recurringCount !== 1 ? 's' : ''} detected
          </span>
          <span className="text-xs text-amber-600 dark:text-amber-400 group-hover:underline shrink-0">
            Review
          </span>
          <ChevronRight size={13} className="text-amber-400 shrink-0" />
        </button>
      )}
      {duplicateCount > 0 && (
        <button
          onClick={onReviewDuplicates}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors text-left group"
        >
          <Copy size={15} className="shrink-0 text-rose-500" />
          <span className="flex-1 text-sm font-medium text-rose-800 dark:text-rose-300">
            {duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''} detected
          </span>
          <span className="text-xs text-rose-600 dark:text-rose-400 group-hover:underline shrink-0">
            Review
          </span>
          <ChevronRight size={13} className="text-rose-400 shrink-0" />
        </button>
      )}
    </div>
  );
}
