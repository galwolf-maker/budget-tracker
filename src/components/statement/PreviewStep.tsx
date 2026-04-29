import { useState, useCallback, useMemo } from 'react';
import {
  CheckSquare, Square, AlertTriangle, Repeat, RefreshCw, ChevronDown,
  UtensilsCrossed, Home, Car, Tv, ShoppingBag, Heart,
  Briefcase, Laptop, Gift, MoreHorizontal, Music, Pill,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import { CATEGORY_COLOR_MAP } from '../../constants/categories';
import type { Category, Transaction, TransactionType } from '../../types';

// ── Public interface ──────────────────────────────────────────────────────────

export interface PreviewRow {
  id: string;
  selected: boolean;
  date: string;         // YYYY-MM-DD
  description: string;
  category: string;
  amount: number;
  type: TransactionType;
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'weekly';
}

interface PreviewStepProps {
  rows: PreviewRow[];
  categories: Category[];
  existingTransactions?: Transaction[];
  onConfirm: (rows: PreviewRow[]) => void;
  onBack: () => void;
}

// ── Category icons ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Icon = React.ComponentType<any>;

const CAT_ICONS: Record<string, Icon> = {
  food:          UtensilsCrossed,
  rent:          Home,
  housing:       Home,
  transport:     Car,
  transportation: Car,
  entertainment: Tv,
  music:         Music,
  shopping:      ShoppingBag,
  health:        Heart,
  pharmacy:      Pill,
  salary:        Briefcase,
  freelance:     Laptop,
  gifts:         Gift,
  gift:          Gift,
};

function catIcon(name: string): Icon {
  return CAT_ICONS[name.toLowerCase()] ?? MoreHorizontal;
}

function catColor(name: string): string {
  return CATEGORY_COLOR_MAP[name] ?? '#6b7280';
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ── Date formatting ───────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// ── Recurring detection ───────────────────────────────────────────────────────

function normDesc(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function wordOverlap(a: string, b: string): number {
  const aw = new Set(a.split(' ').filter(w => w.length > 2));
  const bw = new Set(b.split(' ').filter(w => w.length > 2));
  if (aw.size === 0 || bw.size === 0) return a === b ? 1 : 0;
  return [...aw].filter(w => bw.has(w)).length / Math.max(aw.size, bw.size);
}

function isRecurringCandidate(row: PreviewRow, existing: Transaction[]): boolean {
  if (row.isRecurring) return false;
  const norm = normDesc(row.description);
  if (norm.length < 2) return false;

  const matches = existing.filter(t =>
    t.type === row.type && wordOverlap(normDesc(t.description), norm) >= 0.5
  );
  if (matches.length < 2) return false;

  const months = new Set(matches.map(t => t.date.slice(0, 7)));
  return months.size >= 2;
}

// ── Individual row ────────────────────────────────────────────────────────────

interface RowProps {
  row: PreviewRow;
  categories: Category[];
  showRecurringSuggestion: boolean;
  onUpdate: (id: string, patch: Partial<PreviewRow>) => void;
}

function TransactionRow({ row, categories, showRecurringSuggestion, onUpdate }: RowProps) {
  const { currency } = useCurrencyContext();
  const [editField, setEditField] = useState<'amount' | 'date' | null>(null);
  const [showFreqPicker, setShowFreqPicker] = useState(false);

  const isExpense = row.type === 'expense';
  const color = catColor(row.category);
  const Icon = catIcon(row.category);
  const cats = categories.filter(c => c.type === row.type);

  return (
    <div className={`transition-colors ${row.selected ? 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750' : 'bg-slate-50/50 dark:bg-slate-900/40 opacity-50'}`}>

      {/* ── Main row ── */}
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Checkbox */}
        <button
          onClick={() => onUpdate(row.id, { selected: !row.selected })}
          className="shrink-0 text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors"
          aria-label={row.selected ? 'Deselect' : 'Select'}
        >
          {row.selected
            ? <CheckSquare size={18} className="text-blue-500" />
            : <Square size={18} />}
        </button>

        {/* Category icon bubble */}
        <div
          className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
          style={{ backgroundColor: hexToRgba(color, 0.14) }}
        >
          <Icon size={15} style={{ color }} />
        </div>

        {/* Text block */}
        <div className="flex-1 min-w-0">
          <p
            dir="auto"
            className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate leading-snug"
            title={row.description}
          >
            {row.description}
          </p>

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Date — click to edit */}
            {editField === 'date' ? (
              <input
                type="date"
                value={row.date}
                autoFocus
                onBlur={() => setEditField(null)}
                onChange={e => { onUpdate(row.id, { date: e.target.value }); setEditField(null); }}
                className="text-xs border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              />
            ) : (
              <button
                onClick={() => setEditField('date')}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Click to edit date"
              >
                {fmtDate(row.date)}
              </button>
            )}

            <span className="text-slate-200 dark:text-slate-700">·</span>

            {/* Category select styled as a badge */}
            <div className="relative">
              <select
                value={row.category}
                onChange={e => onUpdate(row.id, { category: e.target.value })}
                className="text-[11px] font-medium appearance-none rounded-full pl-2 pr-5 py-0.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 bg-transparent"
                style={{
                  backgroundColor: hexToRgba(color, 0.1),
                  borderColor: hexToRgba(color, 0.35),
                  color,
                }}
              >
                {cats.map(c => (
                  <option key={c.id} value={c.name} className="text-slate-800 bg-white dark:bg-slate-800 dark:text-slate-100">
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={9} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" style={{ color }} />
            </div>

            {/* Recurring badge */}
            {row.isRecurring && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-full px-1.5 py-0.5">
                <Repeat size={8} />
                {row.recurringFrequency === 'weekly' ? 'Weekly' : 'Monthly'}
              </span>
            )}
          </div>
        </div>

        {/* Amount + type toggle */}
        <div className="text-right shrink-0 ml-1">
          {editField === 'amount' ? (
            <input
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={row.amount}
              autoFocus
              onBlur={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) onUpdate(row.id, { amount: v });
                setEditField(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditField(null);
              }}
              className="w-24 text-sm text-right border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          ) : (
            <button
              onClick={() => setEditField('amount')}
              title="Click to edit amount"
              className={`text-base font-bold tabular-nums leading-none transition-colors ${
                isExpense ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'
              }`}
            >
              {isExpense ? '−' : '+'}{formatCurrency(row.amount, currency)}
            </button>
          )}

          <div className="mt-1 flex justify-end">
            <button
              onClick={() =>
                onUpdate(row.id, {
                  type: isExpense ? 'income' : 'expense',
                  category: isExpense
                    ? (categories.find(c => c.type === 'income')?.name ?? 'Other')
                    : (categories.find(c => c.type === 'expense')?.name ?? 'Other'),
                })
              }
              title="Click to toggle income / expense"
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide transition-colors ${
                isExpense
                  ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100'
              }`}
            >
              {isExpense ? 'exp' : 'inc'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Recurring suggestion ── */}
      {showRecurringSuggestion && !row.isRecurring && (
        <div className="mx-4 mb-2.5 -mt-0.5">
          {showFreqPicker ? (
            <div className="flex items-center gap-2 flex-wrap text-xs bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
              <Repeat size={11} className="text-blue-500 shrink-0" />
              <span className="text-blue-700 dark:text-blue-300 font-medium">How often?</span>
              {(['monthly', 'weekly'] as const).map(freq => (
                <button
                  key={freq}
                  onClick={() => { onUpdate(row.id, { isRecurring: true, recurringFrequency: freq }); setShowFreqPicker(false); }}
                  className="px-2.5 py-0.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 capitalize transition-colors"
                >
                  {freq}
                </button>
              ))}
              <button onClick={() => setShowFreqPicker(false)} className="ml-auto text-slate-400 hover:text-slate-600 text-xs transition-colors">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg px-3 py-1.5">
              <RefreshCw size={11} className="text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">Seen in previous months — looks recurring</span>
              <button
                onClick={() => setShowFreqPicker(true)}
                className="ml-auto text-[11px] font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900 whitespace-nowrap transition-colors"
              >
                Mark recurring →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PreviewStep ───────────────────────────────────────────────────────────────

export function PreviewStep({
  rows: initialRows,
  categories,
  existingTransactions = [],
  onConfirm,
  onBack,
}: PreviewStepProps) {
  const { currency } = useCurrencyContext();
  const [rows, setRows] = useState<PreviewRow[]>(initialRows);

  const update = useCallback(
    (id: string, patch: Partial<PreviewRow>) =>
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r)),
    []
  );

  const selectedRows = rows.filter(r => r.selected);
  const selectedCount = selectedRows.length;
  const allSelected = selectedCount === rows.length;
  const noneSelected = selectedCount === 0;

  const toggleAll = () => setRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));

  const summary = useMemo(() => ({
    expenses: selectedRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
    income:   selectedRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0),
  }), [selectedRows]);

  return (
    <div className="space-y-3">

      {/* Stats bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">
            {rows.length} transaction{rows.length !== 1 ? 's' : ''} found
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className={`font-semibold ${selectedCount > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
            {selectedCount} selected
          </span>
        </div>
        <button
          onClick={toggleAll}
          className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-2 transition-colors"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          No transactions could be parsed. Check the format and try again.
        </div>
      )}

      {/* Transaction list */}
      {rows.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[440px] overflow-y-auto">
          {rows.map(row => (
            <TransactionRow
              key={row.id}
              row={row}
              categories={categories}
              showRecurringSuggestion={isRecurringCandidate(row, existingTransactions)}
              onUpdate={update}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-slate-400 dark:text-slate-500">{selectedCount} of {rows.length} selected</span>
          <div className="flex items-center gap-3">
            {summary.income > 0 && (
              <span className="font-semibold text-emerald-600">+{formatCurrency(summary.income, currency)}</span>
            )}
            {summary.expenses > 0 && (
              <span className="font-semibold text-rose-600">−{formatCurrency(summary.expenses, currency)}</span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => !noneSelected && onConfirm(selectedRows)}
          disabled={noneSelected}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Import {selectedCount > 0 ? `${selectedCount} ` : ''}transaction{selectedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
