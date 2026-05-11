/**
 * SharedInsights
 *
 * Full collaborative analytics panel — only shown when the active workspace
 * has 2+ members.
 *
 * Tabs:
 *   Overview      — summary cards, member pie, AI insights
 *   By Category   — per-category split between members
 *   By Member     — income vs expenses grouped bar per member
 *   Trends        — stacked monthly expenses by member
 *   Balance       — who paid what, settlement recommendations
 */

import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Users, TrendingUp, BarChart2, Layers, Scale, Sparkles, RefreshCw, ArrowRight, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext, useCurrencyFormat, CURRENCIES } from '../../context/CurrencyContext';
import {
  useSharedAnalytics,
  DEFAULT_FILTERS,
  type SharedFilters,
  type DateRangeFilter,
  type TypeFilter,
  type MemberStats,
  type BalanceEntry,
  type Settlement,
  type MonthlyStackRow,
} from '../../hooks/useSharedAnalytics';
import type { Transaction, HouseholdMember } from '../../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface SharedInsightsProps {
  transactions:   Transaction[];
  members:        HouseholdMember[];
  currentUserId:  string | null;
  categories:     string[];
}

// ── Shared tooltip helpers ────────────────────────────────────────────────────

function SimpleTooltip({
  active, payload, label, formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 px-3 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-sm min-w-[160px]">
      {label && <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>}
      {payload.map(e => (
        <div key={e.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 font-medium" style={{ color: e.color }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
            {e.name}
          </span>
          <span className="text-slate-600 dark:text-slate-300 tabular-nums">{formatter(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTip({
  active, payload, formatter,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { pct: number } }[];
  formatter: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-sm">
      <p className="font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
      <p className="text-slate-500">{formatter(p.value)}</p>
      <p className="text-slate-400 text-xs">{p.payload.pct.toFixed(1)}%</p>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const bg = `rgba(${r},${g},${b},0.15)`;
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0 select-none"
      style={{ width: size, height: size, background: bg, color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  'this-month':    'This month',
  'last-3-months': 'Last 3 months',
  'this-year':     'This year',
  'all':           'All time',
};

function FilterBar({
  filters, setFilters, categories, members,
}: {
  filters:    SharedFilters;
  setFilters: (f: SharedFilters) => void;
  categories: string[];
  members:    HouseholdMember[];
}) {
  const sel = 'text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range */}
      <select
        value={filters.dateRange}
        onChange={e => setFilters({ ...filters, dateRange: e.target.value as DateRangeFilter })}
        className={sel}
      >
        {(Object.keys(DATE_RANGE_LABELS) as DateRangeFilter[]).map(k => (
          <option key={k} value={k}>{DATE_RANGE_LABELS[k]}</option>
        ))}
      </select>

      {/* Type */}
      <select
        value={filters.typeFilter}
        onChange={e => setFilters({ ...filters, typeFilter: e.target.value as TypeFilter })}
        className={sel}
      >
        <option value="all">All types</option>
        <option value="expense">Expenses</option>
        <option value="income">Income</option>
      </select>

      {/* Category */}
      <select
        value={filters.categoryFilter}
        onChange={e => setFilters({ ...filters, categoryFilter: e.target.value })}
        className={sel}
      >
        <option value="">All categories</option>
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Member */}
      <select
        value={filters.memberFilter}
        onChange={e => setFilters({ ...filters, memberFilter: e.target.value })}
        className={sel}
      >
        <option value="">All members</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>
            {m.fullName?.trim() || m.email.split('@')[0] || m.userId.slice(-6)}
          </option>
        ))}
      </select>

      {/* Recurring toggle */}
      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.recurringOnly}
          onChange={e => setFilters({ ...filters, recurringOnly: e.target.checked })}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <RefreshCw size={11} className="text-slate-400" />
        Recurring only
      </label>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function TabOverview({
  memberStats, totalExpenses, insights, format,
}: {
  memberStats:   MemberStats[];
  totalExpenses: number;
  insights:      string[];
  format:        (v: number) => string;
}) {
  const pieData = memberStats
    .filter(m => m.totalExpenses > 0)
    .map(m => ({ name: m.displayName, value: m.totalExpenses, pct: m.expensePct, fill: m.color }));

  return (
    <div className="space-y-6">
      {/* Member stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {memberStats.map(m => (
          <div
            key={m.userId}
            className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 space-y-3"
          >
            <div className="flex items-center gap-2.5">
              <Avatar initials={m.initials} color={m.color} size={36} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{m.displayName}</p>
                <p className="text-[11px] text-slate-400">{m.transactionCount} transactions</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Expenses</p>
                <p className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">{format(m.totalExpenses)}</p>
                <p className="text-slate-400">{m.expensePct.toFixed(0)}% of total</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Income</p>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{format(m.totalIncome)}</p>
                <p className="text-slate-400">{m.incomePct.toFixed(0)}% of total</p>
              </div>
              <div className={`rounded-lg p-2 ${m.netContribution >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                <p className="text-slate-400 mb-0.5">Net</p>
                <p className={`font-bold tabular-nums text-sm ${m.netContribution >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {m.netContribution >= 0 ? '+' : ''}{format(m.netContribution)}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-2">
                <p className="text-slate-400 mb-0.5">Avg tx</p>
                <p className="font-bold text-slate-700 dark:text-slate-200 tabular-nums">{format(m.avgTransactionSize)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Expense pie by member */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Expenses by Member
          </h4>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-sm text-slate-400">No expense data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                  animationBegin={0}
                  animationDuration={600}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={(p) => <PieTip {...(p as Parameters<typeof PieTip>[0])} formatter={format} />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* AI insights */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={14} className="text-violet-500" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Insights</h4>
          </div>
          {insights.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">
              Add more transactions to see insights.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {insights.map((txt, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span
                    className="mt-1 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                    style={{ background: `hsl(${(i * 60) % 360}, 70%, 55%)` }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 leading-snug">{txt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab: By Category ──────────────────────────────────────────────────────────

function TabByCategory({
  categoryBreakdown, memberStats, format,
}: {
  categoryBreakdown: { category: string; total: number; [uid: string]: number | string }[];
  memberStats:       MemberStats[];
  format:            (v: number) => string;
}) {
  const chartData = categoryBreakdown.slice(0, 10).map(row => {
    const out: Record<string, number | string> = { category: row.category };
    for (const m of memberStats) out[m.displayName] = (row[m.userId] as number) ?? 0;
    return out;
  });

  const totalAll = categoryBreakdown.reduce((s, r) => s + (r.total as number), 0);

  return (
    <div className="space-y-5">
      {chartData.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-100 dark:border-slate-700 text-center text-sm text-slate-400">
          No category data for the selected period.
        </div>
      ) : (
        <>
          {/* Grouped bar chart */}
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Spending by Category & Member
            </h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rc-grid)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} width={44}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={p => <SimpleTooltip {...(p as Parameters<typeof SimpleTooltip>[0])} formatter={format} />} cursor={{ fill: 'var(--rc-cursor)' }} />
                <Legend iconType="circle" iconSize={8}
                  formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
                {memberStats.map(m => (
                  <Bar key={m.userId} dataKey={m.displayName} fill={m.color} radius={[3, 3, 0, 0]} animationDuration={500} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">Category</th>
                  {memberStats.map(m => (
                    <th key={m.userId} className="text-right px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Avatar initials={m.initials} color={m.color} size={20} />
                        <span className="text-slate-500 font-semibold uppercase tracking-wider truncate max-w-[80px]">{m.displayName}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-2.5 text-slate-500 font-semibold uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
                {categoryBreakdown.slice(0, 12).map(row => {
                  const pct = totalAll > 0 ? ((row.total as number) / totalAll) * 100 : 0;
                  return (
                    <tr key={row.category} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 w-16 overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{row.category}</span>
                        </div>
                      </td>
                      {memberStats.map(m => (
                        <td key={m.userId} className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                          {(row[m.userId] as number) > 0 ? format(row[m.userId] as number) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                        {format(row.total as number)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: By Member ────────────────────────────────────────────────────────────

function TabByMember({
  memberStats, format,
}: {
  memberStats: MemberStats[];
  format:      (v: number) => string;
}) {
  const chartData = memberStats.map(m => ({
    name:     m.displayName,
    Expenses: m.totalExpenses,
    Income:   m.totalIncome,
    Net:      Math.max(0, m.netContribution),
    color:    m.color,
  }));

  return (
    <div className="space-y-5">
      {/* Income vs Expenses side-by-side bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Income vs Expenses per Member
        </h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barGap={4} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rc-grid)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} width={48}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={p => <SimpleTooltip {...(p as Parameters<typeof SimpleTooltip>[0])} formatter={format} />} cursor={{ fill: 'var(--rc-cursor)' }} />
            <Legend iconType="circle" iconSize={8}
              formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
            <Bar dataKey="Income"   fill="#10b981" radius={[3, 3, 0, 0]} animationDuration={500} />
            <Bar dataKey="Expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} animationDuration={500} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {memberStats.map(m => {
          const topCats = Object.entries(m.byCategory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          return (
            <div key={m.userId} className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2.5 mb-3">
                <Avatar initials={m.initials} color={m.color} size={34} />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.displayName}</p>
                  <p className="text-[11px] text-slate-400">{m.transactionCount} transactions · avg {format(m.avgTransactionSize)}</p>
                </div>
              </div>

              {topCats.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Top categories</p>
                  {topCats.map(([cat, amt]) => {
                    const pct = m.totalExpenses > 0 ? (amt / m.totalExpenses) * 100 : 0;
                    return (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <div className="flex-1 flex items-center gap-1.5">
                          <div className="h-1.5 flex-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: m.color }}
                            />
                          </div>
                          <span className="text-slate-600 dark:text-slate-300 w-20 truncate">{cat}</span>
                        </div>
                        <span className="tabular-nums text-slate-700 dark:text-slate-200 w-20 text-right shrink-0">{format(amt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Trends ───────────────────────────────────────────────────────────────

function TabTrends({
  monthlyStacked, memberStats, format,
}: {
  monthlyStacked: MonthlyStackRow[];
  memberStats:    MemberStats[];
  format:         (v: number) => string;
}) {
  // Build cumulative data for line chart
  const cumulative = useMemo(() => {
    const runningTotals: Record<string, number> = {};
    memberStats.forEach(m => { runningTotals[m.userId] = 0; });
    return monthlyStacked.map(row => {
      const out: Record<string, number | string> = { month: row.month, label: row.label };
      memberStats.forEach(m => {
        runningTotals[m.userId] += (row[m.userId] as number) ?? 0;
        out[m.displayName + '_cum'] = Math.round(runningTotals[m.userId]);
        out[m.displayName] = (row[m.userId] as number) ?? 0;
      });
      return out;
    });
  }, [monthlyStacked, memberStats]);

  return (
    <div className="space-y-5">
      {/* Stacked bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Monthly Expenses by Member
        </h4>
        {monthlyStacked.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-sm text-slate-400">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyStacked} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rc-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} width={44}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={p => <SimpleTooltip {...(p as Parameters<typeof SimpleTooltip>[0])} formatter={format} label={p.label as string | undefined} />} cursor={{ fill: 'var(--rc-cursor)' }} />
              <Legend iconType="circle" iconSize={8}
                formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
              {memberStats.map((m, i) => (
                <Bar key={m.userId} dataKey={m.userId} name={m.displayName} stackId="a"
                  fill={m.color}
                  radius={i === memberStats.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  animationDuration={500} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cumulative line chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Cumulative Spending Over Time
        </h4>
        {cumulative.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-sm text-slate-400">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={cumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--rc-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--rc-tick)' }} axisLine={false} tickLine={false} width={44}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip content={p => <SimpleTooltip {...(p as Parameters<typeof SimpleTooltip>[0])} formatter={format} />} cursor={{ stroke: 'var(--rc-cursor)', strokeWidth: 1 }} />
              <Legend iconType="circle" iconSize={8}
                formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
              {memberStats.map(m => (
                <Line key={m.userId} type="monotone"
                  dataKey={m.displayName + '_cum'}
                  name={m.displayName}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  animationDuration={600} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ── Tab: Balance ──────────────────────────────────────────────────────────────

function TabBalance({
  balances, settlements, format,
}: {
  balances:    BalanceEntry[];
  settlements: Settlement[];
  format:      (v: number) => string;
}) {
  const maxAbs = Math.max(...balances.map(b => Math.abs(b.balance)), 1);

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Who Paid What
          <span className="ml-2 text-[11px] font-normal text-slate-400">(based on all-time shared expenses)</span>
        </h4>

        <div className="space-y-3">
          {balances.map(b => {
            const barPct = (Math.abs(b.balance) / maxAbs) * 100;
            const isOver = b.balance >= 0;
            return (
              <div key={b.userId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Avatar initials={b.initials} color={b.color} size={28} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{b.displayName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm tabular-nums font-semibold text-slate-800 dark:text-slate-100">
                      {format(b.paid)}
                    </span>
                    <span className={`ml-2 text-xs font-medium tabular-nums ${isOver ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {isOver ? '+' : ''}{format(b.balance)}
                    </span>
                  </div>
                </div>

                {/* Balance bar */}
                <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute h-full rounded-full transition-all ${isOver ? 'bg-emerald-500' : 'bg-rose-400'}`}
                    style={{
                      width: `${barPct}%`,
                      left: isOver ? '50%' : `${50 - barPct / 2}%`,
                    }}
                  />
                  <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300 dark:bg-slate-600" />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>Fair share: {format(b.fairShare)}</span>
                  <span>{isOver ? 'overpaid' : 'underpaid'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settlement recommendations */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Suggested Settlement
        </h4>

        {settlements.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/40">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <Scale size={14} className="text-emerald-600" />
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              All expenses are balanced — no settlements needed.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {settlements.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700"
              >
                <Avatar initials={s.fromName.slice(0, 2).toUpperCase()} color={s.fromColor} size={30} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    <strong>{s.fromName}</strong> owes <strong>{s.toName}</strong>
                  </p>
                </div>
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
                <span className="font-bold text-base tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
                  {format(s.amount)}
                </span>
                <Avatar initials={s.toName.slice(0, 2).toUpperCase()} color={s.toColor} size={30} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type TabId = 'overview' | 'category' | 'member' | 'trends' | 'balance';

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: 'overview',  label: 'Overview',  Icon: Users      },
  { id: 'category',  label: 'By Category', Icon: BarChart2 },
  { id: 'member',    label: 'By Member', Icon: Layers     },
  { id: 'trends',    label: 'Trends',    Icon: TrendingUp },
  { id: 'balance',   label: 'Balance',   Icon: Scale      },
];

export function SharedInsights({
  transactions,
  members,
  currentUserId,
  categories,
}: SharedInsightsProps) {
  const [activeTab, setActiveTab]     = useState<TabId>('overview');
  const [filters, setFilters]         = useState<SharedFilters>(DEFAULT_FILTERS);
  const { currency }                  = useCurrencyContext();
  const format                        = useCurrencyFormat();
  const _currencySymbol               = CURRENCIES.find(c => c.code === currency)?.symbol ?? '$';

  const analytics = useSharedAnalytics(transactions, members, filters, currentUserId);

  if (members.length < 2) return null;

  const isEmptyAll = transactions.length === 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Users size={15} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Shared Insights
            </h2>
            <p className="text-[11px] text-slate-400">
              {members.length} members · collaborative analytics
            </p>
          </div>
          {/* Member avatars */}
          <div className="ml-auto flex -space-x-1.5">
            {analytics.memberStats.slice(0, 5).map(m => (
              <Avatar key={m.userId} initials={m.initials} color={m.color} size={26} />
            ))}
          </div>
        </div>

        {/* Filters */}
        <FilterBar filters={filters} setFilters={setFilters} categories={categories} members={members} />
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-slate-100 dark:border-slate-700 scrollbar-none">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 sm:p-6">
        {isEmptyAll ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Users size={32} className="text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No transactions yet in this workspace.
            </p>
            <p className="text-xs text-slate-400">
              Add transactions to see shared analytics for all {members.length} members.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'overview'  && (
              <TabOverview
                memberStats={analytics.memberStats}
                totalExpenses={analytics.totalExpenses}
                insights={analytics.insights}
                format={format}
              />
            )}
            {activeTab === 'category' && (
              <TabByCategory
                categoryBreakdown={analytics.categoryBreakdown}
                memberStats={analytics.memberStats}
                format={format}
              />
            )}
            {activeTab === 'member' && (
              <TabByMember
                memberStats={analytics.memberStats}
                format={format}
              />
            )}
            {activeTab === 'trends' && (
              <TabTrends
                monthlyStacked={analytics.monthlyStacked}
                memberStats={analytics.memberStats}
                format={format}
              />
            )}
            {activeTab === 'balance' && (
              <TabBalance
                balances={analytics.balances}
                settlements={analytics.settlements}
                format={format}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
