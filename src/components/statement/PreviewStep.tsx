import { useState, useCallback } from 'react';
import { CheckSquare, Square, AlertTriangle, ChevronDown } from 'lucide-react';
import { formatCurrency, getTodayString } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import type { Category, TransactionType } from '../../types';

export interface PreviewRow {
  id: string;
  selected: boolean;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
}

interface PreviewStepProps {
  rows: PreviewRow[];
  categories: Category[];
  onConfirm: (rows: PreviewRow[]) => void;
  onBack: () => void;
}

export function PreviewStep({
  rows: initialRows,
  categories,
  onConfirm,
  onBack,
}: PreviewStepProps) {
  const { currency } = useCurrencyContext();
  const [rows, setRows] = useState<PreviewRow[]>(initialRows);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const update = useCallback(
    (id: string, patch: Partial<PreviewRow>) =>
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    []
  );

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = selectedCount === rows.length;
  const noneSelected = selectedCount === 0;

  const toggleAll = () =>
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));

  const handleConfirm = () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length) onConfirm(selected);
  };

  const today = getTodayString();

  const categoriesForType = (type: TransactionType) =>
    type === 'expense' ? expenseCategories : incomeCategories;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-700">
            {rows.length} transaction{rows.length !== 1 ? 's' : ''} found
          </span>
          <span className="text-slate-400">·</span>
          <span
            className={`font-medium ${
              selectedCount > 0 ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            {selectedCount} selected
          </span>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {rows.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          No transactions could be parsed. Check that the text includes dates
          and amounts, or adjust the format.
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[32px_110px_1fr_140px_90px_70px] gap-2 items-center px-3 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span />
            <span>Date</span>
            <span>Description</span>
            <span>Category</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Type</span>
          </div>

          {/* Rows */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {rows.map((row) => {
              const cats = categoriesForType(row.type);
              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-[32px_110px_1fr_140px_90px_70px] gap-2 items-center px-3 py-2 transition-colors ${
                    row.selected ? 'bg-white' : 'bg-slate-50/60 opacity-60'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => update(row.id, { selected: !row.selected })}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    aria-label={row.selected ? 'Deselect' : 'Select'}
                  >
                    {row.selected ? (
                      <CheckSquare size={16} className="text-blue-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>

                  {/* Date */}
                  <input
                    type="date"
                    value={row.date}
                    max={today}
                    onChange={(e) => update(row.id, { date: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />

                  {/* Description */}
                  <span
                    className="text-xs text-slate-700 truncate"
                    title={row.description}
                  >
                    {row.description}
                  </span>

                  {/* Category */}
                  <div className="relative">
                    <select
                      value={row.category}
                      onChange={(e) =>
                        update(row.id, { category: e.target.value })
                      }
                      className="w-full appearance-none text-xs border border-slate-200 rounded-md pl-2 pr-6 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer"
                    >
                      {cats.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>

                  {/* Amount */}
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={row.amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) update(row.id, { amount: v });
                      }}
                      className="w-full text-xs border border-slate-200 rounded-md pl-5 pr-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-right"
                    />
                  </div>

                  {/* Type toggle */}
                  <div className="flex justify-center">
                    <button
                      onClick={() =>
                        update(row.id, {
                          type: row.type === 'expense' ? 'income' : 'expense',
                          category:
                            row.type === 'expense'
                              ? (incomeCategories[0]?.name ?? 'Other')
                              : (expenseCategories[0]?.name ?? 'Other'),
                        })
                      }
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide transition-colors ${
                        row.type === 'expense'
                          ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                      title="Click to toggle income/expense"
                    >
                      {row.type === 'expense' ? 'exp' : 'inc'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer summary */}
      {selectedCount > 0 && (
        <div className="text-xs text-slate-500 text-right">
          Total selected:{' '}
          <span className="font-semibold text-slate-700">
            {formatCurrency(
              rows
                .filter((r) => r.selected && r.type === 'expense')
                .reduce((s, r) => s + r.amount, 0),
              currency
            )}
          </span>{' '}
          in expenses
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={noneSelected}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Import {selectedCount > 0 ? `${selectedCount} ` : ''}
          transaction{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
