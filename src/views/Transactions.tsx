import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { TransactionFilters } from '../components/transactions/TransactionFilters';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type {
  Transaction,
  TransactionFilters as Filters,
  Category,
  HouseholdMember,
} from '../types';

interface TransactionsViewProps {
  transactions: Transaction[];
  categories: Category[];
  getFilteredTransactions: (filters: Filters) => Transaction[];
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onMarkRecurring: (id: string, flag: boolean) => void;
  currentUserId?: string | null;
  members?: HouseholdMember[];
}

const DEFAULT_FILTERS: Filters = {
  type: 'all',
  category: '',
  month: 'all',
  search: '',
};

export function Transactions({
  transactions,
  categories,
  getFilteredTransactions,
  onAdd,
  onEdit,
  onDelete,
  onMarkRecurring,
  currentUserId,
  members,
}: TransactionsViewProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () => getFilteredTransactions(filters),
    [getFilteredTransactions, filters]
  );

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const isFiltered = filtered.length !== transactions.length;

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        availableMonths={availableMonths}
      />

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* List header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {filtered.length}{' '}
              {filtered.length === 1 ? 'transaction' : 'transactions'}
            </span>
            {isFiltered && (
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full">
                filtered
              </span>
            )}
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-4xl mb-3">
              {transactions.length === 0 ? '💸' : '🔍'}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {transactions.length === 0
                ? 'No transactions yet'
                : 'No results match your filters'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {transactions.length === 0
                ? 'Add your first transaction to get started.'
                : 'Try adjusting the search or filter options.'}
            </p>
            {transactions.length === 0 && (
              <button
                onClick={onAdd}
                className="mt-5 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <Plus size={15} />
                Add Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {filtered.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                onEdit={onEdit}
                onDelete={(id) => setPendingDeleteId(id)}
                onMarkRecurring={onMarkRecurring}
                currentUserId={currentUserId}
                members={members}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message="This transaction will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
