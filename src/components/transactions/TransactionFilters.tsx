import { Search, X } from 'lucide-react';
import { getMonthLabel } from '../../utils/formatters';
import type { TransactionFilters as Filters, Category } from '../../types';

interface TransactionFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  categories: Category[];
  availableMonths: string[];
}

export function TransactionFilters({
  filters,
  onChange,
  categories,
  availableMonths,
}: TransactionFiltersProps) {
  const set = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const hasActive =
    filters.type !== 'all' ||
    filters.category !== '' ||
    filters.month !== 'all' ||
    filters.search !== '';

  const selectClass =
    'px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) =>
            set({ type: e.target.value as Filters['type'], category: '' })
          }
          className={selectClass}
        >
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        {/* Category */}
        <select
          value={filters.category}
          onChange={(e) => set({ category: e.target.value })}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {categories
            .filter(
              (c) => filters.type === 'all' || c.type === filters.type
            )
            .map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
        </select>

        {/* Month */}
        <select
          value={filters.month}
          onChange={(e) => set({ month: e.target.value })}
          className={selectClass}
        >
          <option value="all">All Time</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {getMonthLabel(m)}
            </option>
          ))}
        </select>

        {/* Clear */}
        {hasActive && (
          <button
            onClick={() =>
              onChange({ type: 'all', category: '', month: 'all', search: '' })
            }
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={13} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
