import { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Trash2, Copy, ArrowRight } from 'lucide-react';
import { TransactionFilters } from '../components/transactions/TransactionFilters';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CopyMoveModal } from '../components/workspace/CopyMoveModal';
import type {
  Transaction,
  TransactionFilters as Filters,
  Category,
  HouseholdMember,
  Workspace,
} from '../types';

interface TransactionsViewProps {
  transactions: Transaction[];
  categories: Category[];
  getFilteredTransactions: (filters: Filters) => Transaction[];
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => Promise<string | null>;
  onMarkRecurring: (id: string, flag: boolean) => void;
  currentUserId?: string | null;
  members?: HouseholdMember[];
  workspaces?: Workspace[];
  currentWorkspaceId?: string | null;
  onCopyTransactions?: (ids: string[], targetId: string) => Promise<string | null>;
  onMoveTransactions?: (ids: string[], targetId: string) => Promise<string | null>;
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
  onBulkDelete,
  onMarkRecurring,
  currentUserId,
  members,
  workspaces,
  currentWorkspaceId,
  onCopyTransactions,
  onMoveTransactions,
}: TransactionsViewProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [copyMoveMode, setCopyMoveMode] = useState<'copy' | 'move' | null>(null);

  const filtered = useMemo(
    () => getFilteredTransactions(filters),
    [getFilteredTransactions, filters]
  );

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const isFiltered = filtered.length !== transactions.length;

  // Clear selection whenever filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someFilteredSelected = filteredIds.some((id) => selectedIds.has(id));

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [allFilteredSelected, filteredIds]);

  // How many of the currently-selected IDs are visible in this filtered view
  const visibleSelectedCount = filteredIds.filter((id) => selectedIds.has(id)).length;
  // Total selected (may include items outside the current filter)
  const totalSelected = selectedIds.size;

  // ── Single-delete ──────────────────────────────────────────────────────────
  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      // Also remove from selection if it was selected
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingDeleteId);
        return next;
      });
      setPendingDeleteId(null);
    }
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const handleConfirmBulkDelete = async () => {
    setIsBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const error = await onBulkDelete(ids);
    setIsBulkDeleting(false);
    setConfirmBulkDelete(false);
    setSelectedIds(new Set());
    if (error) {
      // Surface the error via toast in the parent; nothing more to do here
      console.error('[BT] Bulk delete error:', error);
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
        {/* ── List header ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {/* Select-all checkbox */}
            {filtered.length > 0 && (
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => {
                  // Indeterminate state: some but not all are selected
                  if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                }}
                onChange={toggleSelectAll}
                aria-label="Select all transactions"
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 accent-blue-600 cursor-pointer shrink-0"
              />
            )}
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

        {/* ── Bulk action toolbar — visible when anything is selected ── */}
        {totalSelected > 0 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/40">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {visibleSelectedCount > 0 && visibleSelectedCount !== totalSelected
                ? `${totalSelected} selected (${visibleSelectedCount} visible)`
                : `${totalSelected} selected`}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear
              </button>
              {/* Copy / Move — only when the user has multiple workspaces */}
              {workspaces && workspaces.length > 1 && (
                <>
                  <button
                    onClick={() => setCopyMoveMode('copy')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <button
                    onClick={() => setCopyMoveMode('move')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                  >
                    <ArrowRight size={12} />
                    Move
                  </button>
                </>
              )}
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
              >
                <Trash2 size={12} />
                Delete {totalSelected}
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
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
                selected={selectedIds.has(t.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Single-delete confirmation */}
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message="This transaction will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
      />

      {/* Bulk-delete confirmation */}
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Transactions"
        message={`Are you sure you want to delete ${totalSelected} ${totalSelected === 1 ? 'transaction' : 'transactions'}? This cannot be undone.`}
        confirmLabel={`Delete ${totalSelected}`}
        confirmLoading={isBulkDeleting}
      />

      {/* Copy / Move modal */}
      <CopyMoveModal
        isOpen={copyMoveMode !== null}
        onClose={() => setCopyMoveMode(null)}
        mode={copyMoveMode ?? 'copy'}
        count={totalSelected}
        workspaces={workspaces ?? []}
        currentWorkspaceId={currentWorkspaceId ?? null}
        onConfirm={async (targetId) => {
          const ids = Array.from(selectedIds);
          if (copyMoveMode === 'copy') {
            const error = await onCopyTransactions?.(ids, targetId) ?? null;
            if (!error) {
              setCopyMoveMode(null);
              // Keep selection so the user can do a follow-up action
            }
          } else {
            const error = await onMoveTransactions?.(ids, targetId) ?? null;
            if (!error) {
              setCopyMoveMode(null);
              setSelectedIds(new Set()); // moved away — nothing left to select
            }
          }
        }}
      />
    </div>
  );
}
