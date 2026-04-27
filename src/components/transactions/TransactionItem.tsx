import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import { CATEGORY_COLOR_MAP, CHART_PALETTE } from '../../constants/categories';
import type { Transaction, HouseholdMember } from '../../types';

interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkRecurring?: (id: string, flag: boolean) => void;
  readOnly?: boolean;
  currentUserId?: string | null;
  members?: HouseholdMember[];
}

function getCategoryColor(name: string): string {
  return CATEGORY_COLOR_MAP[name] ?? CHART_PALETTE[name.charCodeAt(0) % CHART_PALETTE.length];
}

export function TransactionItem({
  transaction: t,
  onEdit,
  onDelete,
  onMarkRecurring,
  readOnly = false,
  currentUserId,
  members = [],
}: TransactionItemProps) {
  const { currency } = useCurrencyContext();
  const color = getCategoryColor(t.category);
  const isIncome = t.type === 'income';

  // Show "added by" badge when there are household members and it's not the current user
  const addedByMember =
    t.createdBy && t.createdBy !== currentUserId
      ? members.find((m) => m.userId === t.createdBy)
      : null;
  const addedByLabel = addedByMember
    ? (addedByMember.fullName ?? addedByMember.email.split('@')[0])
    : null;

  return (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors group">
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 select-none"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {t.category.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {t.category}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
              isIncome
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'
                : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600'
            }`}
          >
            {t.type}
          </span>
          {t.isRecurring && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 font-semibold uppercase tracking-wide flex items-center gap-1">
              <RefreshCw size={8} />
              recurring
            </span>
          )}
        </div>
        {t.description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{t.description}</p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {formatDate(t.date)}
          {addedByLabel && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium">
              by {addedByLabel}
            </span>
          )}
        </p>
      </div>

      {/* Amount */}
      <div
        className={`text-sm font-semibold shrink-0 ${
          isIncome ? 'text-emerald-600' : 'text-rose-500'
        }`}
      >
        {isIncome ? '+' : '−'}
        {formatCurrency(t.amount, currency)}
      </div>

      {/* Actions — appear on hover */}
      {!readOnly && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {onMarkRecurring && (
            <button
              onClick={() => onMarkRecurring(t.id, !t.isRecurring)}
              title={t.isRecurring ? 'Remove recurring' : 'Mark as recurring'}
              className={`p-1.5 rounded-lg transition-colors ${
                t.isRecurring
                  ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 hover:text-blue-700'
                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
              }`}
            >
              <RefreshCw size={13} />
            </button>
          )}
          <button
            onClick={() => onEdit(t)}
            title="Edit"
            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(t.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
