import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useCurrencyContext, useCurrencyFormat, CURRENCIES } from '../../context/CurrencyContext';
import { CATEGORY_COLOR_MAP, CHART_PALETTE } from '../../constants/categories';
import type { Transaction, Category } from '../../types';

interface CategoryTrendChartProps {
  transactions: Transaction[];
  categories: Category[];
}

const RANGES = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
] as const;

function getCategoryColor(name: string, idx: number): string {
  return CATEGORY_COLOR_MAP[name] ?? CHART_PALETTE[idx % CHART_PALETTE.length];
}

function TrendTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter(p => p.value > 0);
  if (!items.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 px-3 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-sm min-w-[150px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      {items.map(entry => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }} className="font-medium truncate max-w-[100px]">
            {entry.name}
          </span>
          <span className="text-slate-600 dark:text-slate-300 shrink-0">
            {formatter(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-52 gap-2">
    <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
      📈
    </div>
    <p className="text-sm text-slate-400 dark:text-slate-500 text-center max-w-xs">{message}</p>
  </div>
);

export function CategoryTrendChart({ transactions, categories }: CategoryTrendChartProps) {
  const { currency } = useCurrencyContext();
  const format = useCurrencyFormat();
  const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol ?? '$';

  const expenseCats = useMemo(
    () => categories.filter(c => c.type === 'expense').map(c => c.name),
    [categories]
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [range, setRange] = useState<number>(6);
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // Initialize selection to top-3 categories once transactions arrive
  useEffect(() => {
    if (initialized || transactions.length === 0) return;
    setInitialized(true);
    const totals: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === 'expense') totals[t.category] = (totals[t.category] ?? 0) + t.amount;
    }
    const top3 = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
      .filter(name => expenseCats.includes(name));
    setSelected(top3);
  }, [transactions, initialized, expenseCats]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  const toggleCat = (name: string) =>
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: range }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (range - 1 - i), 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const point: Record<string, string | number> = {
        month,
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
      for (const cat of selected) {
        point[cat] = transactions
          .filter(t => t.type === 'expense' && t.category === cat && t.date.startsWith(month))
          .reduce((sum, t) => sum + t.amount, 0);
      }
      return point;
    });
  }, [transactions, selected, range]);

  const hasData = selected.length > 0 &&
    chartData.some(pt => selected.some(cat => (pt[cat] as number) > 0));

  const dropLabel =
    selected.length === 0 ? 'Select categories'
    : selected.length === 1 ? selected[0]
    : `${selected.length} categories`;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Category Trend
        </h3>
        <div className="flex items-center gap-2">
          {/* Range pills */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-medium">
            {RANGES.map(r => (
              <button
                key={r.months}
                onClick={() => setRange(r.months)}
                className={`px-2.5 py-1.5 transition-colors ${
                  range === r.months
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Category multi-select */}
          <div ref={dropRef} className="relative">
            <button
              onClick={() => setDropOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors max-w-[160px]"
            >
              <span className="truncate">{dropLabel}</span>
              <ChevronDown size={11} className={`shrink-0 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-52 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-y-auto max-h-60 z-20 py-1">
                {expenseCats.length === 0 ? (
                  <p className="text-xs text-slate-400 px-4 py-2">No expense categories</p>
                ) : (
                  expenseCats.map((cat, idx) => (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                    >
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                          selected.includes(cat)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {selected.includes(cat) && <Check size={10} className="text-white" />}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getCategoryColor(cat, idx) }}
                      />
                      <span className="truncate">{cat}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart / empty state */}
      {selected.length === 0 ? (
        <EmptyState message="Select at least one category above to see its spending trend." />
      ) : !hasData ? (
        <EmptyState message="No spending data for the selected categories in this period." />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rc-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--rc-tick)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--rc-tick)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000
                  ? `${currencySymbol}${(v / 1000).toFixed(0)}k`
                  : `${currencySymbol}${v}`
              }
              width={48}
            />
            <Tooltip
              content={(props) => (
                <TrendTooltip
                  {...(props as Parameters<typeof TrendTooltip>[0])}
                  formatter={format}
                />
              )}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>
              )}
            />
            {selected.map((cat, i) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={getCategoryColor(cat, i)}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
