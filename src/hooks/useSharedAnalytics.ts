/**
 * useSharedAnalytics
 *
 * Computes per-member statistics for a shared workspace.
 * Groups transactions by `createdBy` (user_id) and produces:
 *   - Per-member expense/income/category breakdowns
 *   - Monthly stacked data for trend charts
 *   - Balance and settlement recommendations
 *   - Human-readable AI-style insight strings
 */

import { useMemo } from 'react';
import type { Transaction } from '../types';
import type { HouseholdMember } from '../types';

// ── Palette ───────────────────────────────────────────────────────────────────

export const MEMBER_COLORS = [
  '#3b82f6', // blue
  '#f97316', // orange
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
];

// ── Filters ───────────────────────────────────────────────────────────────────

export type DateRangeFilter = 'this-month' | 'last-3-months' | 'this-year' | 'all';
export type TypeFilter      = 'all' | 'expense' | 'income';

export interface SharedFilters {
  dateRange:      DateRangeFilter;
  typeFilter:     TypeFilter;
  categoryFilter: string;   // '' = all categories
  memberFilter:   string;   // '' = all members, else userId
  recurringOnly:  boolean;
}

export const DEFAULT_FILTERS: SharedFilters = {
  dateRange:      'this-month',
  typeFilter:     'all',
  categoryFilter: '',
  memberFilter:   '',
  recurringOnly:  false,
};

function applyDateRange(txns: Transaction[], range: DateRangeFilter): Transaction[] {
  if (range === 'all') return txns;
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth(); // 0-indexed

  if (range === 'this-month') {
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    return txns.filter(t => t.date.startsWith(prefix));
  }
  if (range === 'last-3-months') {
    const cutoff = new Date(y, m - 2, 1);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-01`;
    return txns.filter(t => t.date >= cutoffStr);
  }
  if (range === 'this-year') {
    return txns.filter(t => t.date.startsWith(String(y)));
  }
  return txns;
}

// ── Display name helpers ──────────────────────────────────────────────────────

export function memberDisplayName(m: HouseholdMember): string {
  if (m.fullName?.trim()) return m.fullName.trim();
  if (m.email && m.email !== 'Unknown') return m.email.split('@')[0];
  return `User …${m.userId.slice(-4)}`;
}

export function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Per-member stats ──────────────────────────────────────────────────────────

export interface MemberStats {
  userId:             string;
  displayName:        string;
  initials:           string;
  color:              string;
  // Totals (within current filter)
  totalExpenses:      number;
  totalIncome:        number;
  netContribution:    number;  // income − expenses
  expensePct:         number;  // % of workspace total expenses
  incomePct:          number;  // % of workspace total income
  transactionCount:   number;
  avgTransactionSize: number;
  // Breakdowns
  byCategory:  Record<string, number>;           // category → expense total
  byMonth:     Record<string, { income: number; expenses: number }>;
}

// ── Balance / settlement ──────────────────────────────────────────────────────

export interface BalanceEntry {
  userId:      string;
  displayName: string;
  initials:    string;
  color:       string;
  paid:        number;
  fairShare:   number;
  balance:     number;   // paid − fairShare  (+ = overpaid, − = underpaid)
}

export interface Settlement {
  fromUserId:  string;
  fromName:    string;
  fromColor:   string;
  toUserId:    string;
  toName:      string;
  toColor:     string;
  amount:      number;
}

function computeSettlements(balances: BalanceEntry[]): Settlement[] {
  const creditors = balances
    .filter(b => b.balance >  0.005)
    .sort((a, b) => b.balance - a.balance)
    .map(b => ({ ...b, rem: b.balance }));

  const debtors = balances
    .filter(b => b.balance < -0.005)
    .sort((a, b) => a.balance - b.balance)
    .map(b => ({ ...b, rem: Math.abs(b.balance) }));

  const result: Settlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].rem, debtors[di].rem);
    if (amount > 0.005) {
      result.push({
        fromUserId:  debtors[di].userId,
        fromName:    debtors[di].displayName,
        fromColor:   debtors[di].color,
        toUserId:    creditors[ci].userId,
        toName:      creditors[ci].displayName,
        toColor:     creditors[ci].color,
        amount:      Math.round(amount * 100) / 100,
      });
    }
    creditors[ci].rem -= amount;
    debtors[di].rem   -= amount;
    if (creditors[ci].rem < 0.005) ci++;
    if (debtors[di].rem   < 0.005) di++;
  }

  return result;
}

// ── Monthly stacked data ──────────────────────────────────────────────────────

export interface MonthlyStackRow {
  month:  string;
  label:  string;
  [userId: string]: number | string;
}

// ── AI-style summaries ────────────────────────────────────────────────────────

function generateInsights(
  stats:           MemberStats[],
  allTime:         MemberStats[],  // all-time for trend comparison
  filters:         SharedFilters,
): string[] {
  const insights: string[] = [];
  if (stats.length < 2) return insights;

  const totalExp = stats.reduce((s, m) => s + m.totalExpenses, 0);
  const totalInc = stats.reduce((s, m) => s + m.totalIncome,   0);

  // Biggest spender
  const byExp = [...stats].sort((a, b) => b.totalExpenses - a.totalExpenses);
  if (byExp[0].totalExpenses > 0) {
    insights.push(
      `${byExp[0].displayName} paid ${byExp[0].expensePct.toFixed(0)}% of all shared expenses` +
      (filters.dateRange === 'this-month' ? ' this month' : '')
    );
  }

  // Top income contributor
  if (totalInc > 0) {
    const byInc = [...stats].sort((a, b) => b.totalIncome - a.totalIncome);
    if (byInc[0].totalIncome > 0) {
      insights.push(
        `${byInc[0].displayName} contributed ${byInc[0].incomePct.toFixed(0)}% of total income`
      );
    }
  }

  // Top shared category
  const catTotals: Record<string, number> = {};
  for (const m of stats) {
    for (const [cat, amt] of Object.entries(m.byCategory)) {
      catTotals[cat] = (catTotals[cat] ?? 0) + amt;
    }
  }
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const splits = stats
      .filter(m => (m.byCategory[topCat[0]] ?? 0) > 0)
      .map(m => `${m.displayName}: ${m.byCategory[topCat[0]].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`)
      .join(' | ');
    if (splits) {
      insights.push(`Shared ${topCat[0]} split: ${splits}`);
    }
  }

  // Biggest saver (highest income - expenses)
  const byNet = [...stats].sort((a, b) => b.netContribution - a.netContribution);
  if (byNet[0].netContribution > 0) {
    insights.push(`${byNet[0].displayName} has the best net balance (+${byNet[0].netContribution.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`);
  }

  // Recurring subscriptions summary (per member)
  // (available in allTime since we don't filter recurring in main filter unless recurringOnly=true)
  const recurringByMember = allTime.map(m => ({
    ...m,
    recurringCats: Object.entries(m.byCategory).length,
  }));
  const topRecurring = recurringByMember.sort((a, b) => b.recurringCats - a.recurringCats)[0];
  if (topRecurring && topRecurring.recurringCats > 2 && stats.length > 1) {
    insights.push(`${topRecurring.displayName} covers the most spending categories (${topRecurring.recurringCats})`);
  }

  // Month-over-month trend (only if totalExp is non-zero)
  if (totalExp > 0 && byExp.length >= 2) {
    const ratio = byExp[0].totalExpenses / Math.max(byExp[1].totalExpenses, 1);
    if (ratio > 1.5) {
      insights.push(`${byExp[0].displayName} spent ${ratio.toFixed(1)}× more than ${byExp[1].displayName}`);
    }
  }

  return insights.slice(0, 5); // cap at 5
}

// ── Return type ───────────────────────────────────────────────────────────────

export interface SharedAnalyticsResult {
  memberStats:        MemberStats[];
  allTimeStats:       MemberStats[];
  totalExpenses:      number;
  totalIncome:        number;
  balances:           BalanceEntry[];
  settlements:        Settlement[];
  insights:           string[];
  monthlyStacked:     MonthlyStackRow[];   // expenses per member per month
  categoryBreakdown:  { category: string; total: number; [userId: string]: number | string }[];
  memberOrder:        string[];            // userId array, stable order
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSharedAnalytics(
  transactions: Transaction[],
  members:      HouseholdMember[],
  filters:      SharedFilters,
  currentUserId: string | null,
): SharedAnalyticsResult {

  return useMemo(() => {
    if (members.length < 2) {
      return {
        memberStats: [], allTimeStats: [], totalExpenses: 0, totalIncome: 0,
        balances: [], settlements: [], insights: [],
        monthlyStacked: [], categoryBreakdown: [], memberOrder: [],
      };
    }

    // Assign stable colors by join order
    const memberOrder = members.map(m => m.userId);
    const colorMap:   Record<string, string>      = {};
    const nameMap:    Record<string, string>       = {};
    const initMap:    Record<string, string>       = {};
    members.forEach((m, i) => {
      colorMap[m.userId] = MEMBER_COLORS[i % MEMBER_COLORS.length];
      nameMap[m.userId]  = memberDisplayName(m);
      initMap[m.userId]  = memberInitials(nameMap[m.userId]);
    });

    // Apply filters for "display" stats
    let filtered = applyDateRange(transactions, filters.dateRange);
    if (filters.recurringOnly) filtered = filtered.filter(t => t.isRecurring);
    if (filters.typeFilter !== 'all') filtered = filtered.filter(t => t.type === filters.typeFilter);
    if (filters.categoryFilter) filtered = filtered.filter(t => t.category === filters.categoryFilter);
    if (filters.memberFilter) filtered = filtered.filter(t => (t.createdBy ?? '') === filters.memberFilter);

    // All-time (no date filter, type/recurring still applied for trend comparison)
    const allTimeTxns = filters.recurringOnly ? transactions.filter(t => t.isRecurring) : transactions;

    function buildStats(txns: Transaction[]): Record<string, MemberStats> {
      const map: Record<string, MemberStats> = {};

      for (const uid of memberOrder) {
        map[uid] = {
          userId: uid, displayName: nameMap[uid], initials: initMap[uid], color: colorMap[uid],
          totalExpenses: 0, totalIncome: 0, netContribution: 0,
          expensePct: 0, incomePct: 0,
          transactionCount: 0, avgTransactionSize: 0,
          byCategory: {}, byMonth: {},
        };
      }

      for (const tx of txns) {
        const uid = tx.createdBy ?? '';
        if (!memberOrder.includes(uid)) continue; // unknown / guest
        const s = map[uid];
        s.transactionCount++;

        const month = tx.date.slice(0, 7);
        if (!s.byMonth[month]) s.byMonth[month] = { income: 0, expenses: 0 };

        if (tx.type === 'expense') {
          s.totalExpenses += tx.amount;
          s.byCategory[tx.category] = (s.byCategory[tx.category] ?? 0) + tx.amount;
          s.byMonth[month].expenses += tx.amount;
        } else {
          s.totalIncome += tx.amount;
          s.byMonth[month].income += tx.amount;
        }
      }

      const totalExp = Object.values(map).reduce((s, m) => s + m.totalExpenses, 0);
      const totalInc = Object.values(map).reduce((s, m) => s + m.totalIncome,   0);

      for (const s of Object.values(map)) {
        s.netContribution    = s.totalIncome - s.totalExpenses;
        s.expensePct         = totalExp > 0 ? (s.totalExpenses / totalExp) * 100 : 0;
        s.incomePct          = totalInc > 0 ? (s.totalIncome   / totalInc) * 100 : 0;
        s.avgTransactionSize = s.transactionCount > 0
          ? (s.totalExpenses + s.totalIncome) / s.transactionCount
          : 0;
      }

      return map;
    }

    const filteredMap  = buildStats(filtered);
    const allTimeMap   = buildStats(allTimeTxns);

    const memberStats  = memberOrder.map(uid => filteredMap[uid]);
    const allTimeStats = memberOrder.map(uid => allTimeMap[uid]);

    const totalExpenses = memberStats.reduce((s, m) => s + m.totalExpenses, 0);
    const totalIncome   = memberStats.reduce((s, m) => s + m.totalIncome,   0);

    // Balance (based on ALL TIME expenses — fair split)
    const allTimeTotalExp = allTimeStats.reduce((s, m) => s + m.totalExpenses, 0);
    const fairShare       = allTimeTotalExp / members.length;
    const balances: BalanceEntry[] = allTimeStats.map(m => ({
      userId:      m.userId,
      displayName: m.displayName,
      initials:    m.initials,
      color:       m.color,
      paid:        m.totalExpenses,
      fairShare,
      balance:     m.totalExpenses - fairShare,
    }));

    const settlements = computeSettlements(balances);

    // Monthly stacked (all time, expenses only)
    const allMonths = new Set<string>();
    for (const tx of allTimeTxns) {
      if (tx.type === 'expense' && tx.createdBy && memberOrder.includes(tx.createdBy)) {
        allMonths.add(tx.date.slice(0, 7));
      }
    }
    const sortedMonths = [...allMonths].sort();

    const monthlyStacked: MonthlyStackRow[] = sortedMonths.slice(-12).map(month => {
      const row: MonthlyStackRow = {
        month,
        label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
      for (const uid of memberOrder) {
        row[uid] = allTimeMap[uid].byMonth[month]?.expenses ?? 0;
      }
      return row;
    });

    // Category breakdown per member
    const allCategories = new Set<string>();
    for (const m of memberStats) {
      Object.keys(m.byCategory).forEach(c => allCategories.add(c));
    }
    const categoryBreakdown = [...allCategories]
      .map(cat => {
        const row: { category: string; total: number; [uid: string]: number | string } = {
          category: cat,
          total: memberStats.reduce((s, m) => s + (m.byCategory[cat] ?? 0), 0),
        };
        for (const m of memberStats) row[m.userId] = m.byCategory[cat] ?? 0;
        return row;
      })
      .filter(r => r.total > 0)
      .sort((a, b) => (b.total as number) - (a.total as number));

    const insights = generateInsights(memberStats, allTimeStats, filters);

    return {
      memberStats, allTimeStats,
      totalExpenses, totalIncome,
      balances, settlements, insights,
      monthlyStacked, categoryBreakdown,
      memberOrder,
    };
  }, [transactions, members, filters, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps
}
