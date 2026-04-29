/**
 * Realistic demo dataset — used exclusively in Guest / Demo mode.
 * All data is synthetic; no real user information is ever used.
 */

import { DEFAULT_CATEGORIES } from '../constants/categories';
import type { Transaction, Category, SummaryData, MonthlyDataPoint, CategoryDataPoint } from '../types';

// ── Date helpers ──────────────────────────────────────────────────────────────

function d(monthsAgo: number, day: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
  // Clamp to last day of the month in case day > max days
  if (date.getMonth() !== ((now.getMonth() - monthsAgo + 12) % 12)) {
    date.setDate(0);
  }
  return date.toISOString().slice(0, 10);
}

function iso(monthsAgo: number, day: number): string {
  return new Date(d(monthsAgo, day)).toISOString();
}

// ── Categories ────────────────────────────────────────────────────────────────

export const DEMO_CATEGORIES: Category[] = DEFAULT_CATEGORIES;

// ── Transactions ──────────────────────────────────────────────────────────────
// 4 months of data (current + 3 prior). Items marked isRecurring are already
// identified; the smart-detection panel is suppressed in demo mode regardless.

const RAW: Omit<Transaction, 'createdAt' | 'createdBy'>[] = [
  // ── Current month ─────────────────────────────────────────────────────────
  { id: 'demo-c01', type: 'income',  amount: 5200,   category: 'Salary',        date: d(0, 1),  description: 'Monthly Salary',      isRecurring: true  },
  { id: 'demo-c02', type: 'expense', amount: 1800,   category: 'Rent',          date: d(0, 1),  description: 'Rent — April',         isRecurring: true  },
  { id: 'demo-c03', type: 'expense', amount: 15.99,  category: 'Entertainment', date: d(0, 7),  description: 'Netflix',              isRecurring: true  },
  { id: 'demo-c04', type: 'expense', amount: 9.99,   category: 'Entertainment', date: d(0, 7),  description: 'Spotify',              isRecurring: true  },
  { id: 'demo-c05', type: 'expense', amount: 45,     category: 'Health',        date: d(0, 8),  description: 'Gym Membership',       isRecurring: true  },
  { id: 'demo-c06', type: 'expense', amount: 8.50,   category: 'Food',          date: d(0, 2),  description: 'Starbucks',            isRecurring: false },
  { id: 'demo-c07', type: 'expense', amount: 124.30, category: 'Food',          date: d(0, 4),  description: 'Trader Joe\'s',        isRecurring: false },
  { id: 'demo-c08', type: 'expense', amount: 14.20,  category: 'Transport',     date: d(0, 5),  description: 'Uber',                 isRecurring: false },
  { id: 'demo-c09', type: 'expense', amount: 47.99,  category: 'Shopping',      date: d(0, 9),  description: 'Amazon',               isRecurring: false },
  { id: 'demo-c10', type: 'expense', amount: 87.60,  category: 'Food',          date: d(0, 12), description: 'Whole Foods',          isRecurring: false },
  { id: 'demo-c11', type: 'expense', amount: 9.80,   category: 'Transport',     date: d(0, 15), description: 'Uber',                 isRecurring: false },
  { id: 'demo-c12', type: 'expense', amount: 42.50,  category: 'Food',          date: d(0, 18), description: 'Pasta Roma Restaurant',isRecurring: false },
  { id: 'demo-c13', type: 'expense', amount: 28.40,  category: 'Health',        date: d(0, 20), description: 'CVS Pharmacy',         isRecurring: false },
  { id: 'demo-c14', type: 'expense', amount: 55.00,  category: 'Transport',     date: d(0, 22), description: 'Shell Gas',            isRecurring: false },
  { id: 'demo-c15', type: 'expense', amount: 6.40,   category: 'Food',          date: d(0, 25), description: 'Blue Bottle Coffee',   isRecurring: false },

  // ── 1 month ago ───────────────────────────────────────────────────────────
  { id: 'demo-b01', type: 'income',  amount: 5200,   category: 'Salary',        date: d(1, 1),  description: 'Monthly Salary',       isRecurring: true  },
  { id: 'demo-b02', type: 'expense', amount: 1800,   category: 'Rent',          date: d(1, 1),  description: 'Rent — March',         isRecurring: true  },
  { id: 'demo-b03', type: 'expense', amount: 15.99,  category: 'Entertainment', date: d(1, 7),  description: 'Netflix',              isRecurring: true  },
  { id: 'demo-b04', type: 'expense', amount: 9.99,   category: 'Entertainment', date: d(1, 7),  description: 'Spotify',              isRecurring: true  },
  { id: 'demo-b05', type: 'expense', amount: 45,     category: 'Health',        date: d(1, 8),  description: 'Gym Membership',       isRecurring: true  },
  { id: 'demo-b06', type: 'expense', amount: 9.20,   category: 'Food',          date: d(1, 2),  description: 'Starbucks',            isRecurring: false },
  { id: 'demo-b07', type: 'expense', amount: 138.90, category: 'Food',          date: d(1, 4),  description: 'Trader Joe\'s',        isRecurring: false },
  { id: 'demo-b08', type: 'expense', amount: 18.40,  category: 'Transport',     date: d(1, 5),  description: 'Uber',                 isRecurring: false },
  { id: 'demo-b09', type: 'expense', amount: 64.00,  category: 'Shopping',      date: d(1, 8),  description: 'H&M',                  isRecurring: false },
  { id: 'demo-b10', type: 'expense', amount: 92.40,  category: 'Food',          date: d(1, 12), description: 'Whole Foods',          isRecurring: false },
  { id: 'demo-b11', type: 'expense', amount: 11.20,  category: 'Transport',     date: d(1, 14), description: 'Uber',                 isRecurring: false },
  { id: 'demo-b12', type: 'expense', amount: 85.00,  category: 'Health',        date: d(1, 17), description: 'Dr. Chen — Checkup',  isRecurring: false },
  { id: 'demo-b13', type: 'expense', amount: 55.80,  category: 'Food',          date: d(1, 19), description: 'Sushi Garden',         isRecurring: false },
  { id: 'demo-b14', type: 'expense', amount: 123.45, category: 'Shopping',      date: d(1, 21), description: 'Amazon',               isRecurring: false },
  { id: 'demo-b15', type: 'expense', amount: 52.00,  category: 'Transport',     date: d(1, 23), description: 'Shell Gas',            isRecurring: false },
  { id: 'demo-b16', type: 'expense', amount: 67.00,  category: 'Entertainment', date: d(1, 27), description: 'Bar Tab — Friday',    isRecurring: false },

  // ── 2 months ago ──────────────────────────────────────────────────────────
  { id: 'demo-a01', type: 'income',  amount: 5200,   category: 'Salary',        date: d(2, 1),  description: 'Monthly Salary',       isRecurring: true  },
  { id: 'demo-a02', type: 'expense', amount: 1800,   category: 'Rent',          date: d(2, 1),  description: 'Rent — February',      isRecurring: true  },
  { id: 'demo-a03', type: 'expense', amount: 15.99,  category: 'Entertainment', date: d(2, 7),  description: 'Netflix',              isRecurring: true  },
  { id: 'demo-a04', type: 'expense', amount: 9.99,   category: 'Entertainment', date: d(2, 7),  description: 'Spotify',              isRecurring: true  },
  { id: 'demo-a05', type: 'expense', amount: 45,     category: 'Health',        date: d(2, 8),  description: 'Gym Membership',       isRecurring: true  },
  { id: 'demo-a06', type: 'expense', amount: 7.80,   category: 'Food',          date: d(2, 3),  description: 'Starbucks',            isRecurring: false },
  { id: 'demo-a07', type: 'expense', amount: 145.60, category: 'Food',          date: d(2, 5),  description: 'Trader Joe\'s',        isRecurring: false },
  { id: 'demo-a08', type: 'expense', amount: 22.40,  category: 'Transport',     date: d(2, 6),  description: 'Lyft',                 isRecurring: false },
  { id: 'demo-a09', type: 'expense', amount: 95.00,  category: 'Food',          date: d(2, 13), description: 'Valentine\'s Dinner', isRecurring: false },
  { id: 'demo-a10', type: 'expense', amount: 34.00,  category: 'Shopping',      date: d(2, 14), description: 'Flower Delivery',      isRecurring: false },
  { id: 'demo-a11', type: 'expense', amount: 78.30,  category: 'Food',          date: d(2, 16), description: 'Whole Foods',          isRecurring: false },
  { id: 'demo-a12', type: 'expense', amount: 16.80,  category: 'Transport',     date: d(2, 17), description: 'Uber',                 isRecurring: false },
  { id: 'demo-a13', type: 'expense', amount: 89.99,  category: 'Shopping',      date: d(2, 20), description: 'Amazon',               isRecurring: false },
  { id: 'demo-a14', type: 'expense', amount: 48.00,  category: 'Transport',     date: d(2, 22), description: 'BP Gas',               isRecurring: false },
  { id: 'demo-a15', type: 'expense', amount: 32.00,  category: 'Entertainment', date: d(2, 23), description: 'Cinema Tickets',       isRecurring: false },
  { id: 'demo-a16', type: 'expense', amount: 24.50,  category: 'Health',        date: d(2, 25), description: 'CVS Pharmacy',         isRecurring: false },
  { id: 'demo-a17', type: 'expense', amount: 48.70,  category: 'Food',          date: d(2, 27), description: 'The Italian Place',   isRecurring: false },

  // ── 3 months ago ──────────────────────────────────────────────────────────
  { id: 'demo-z01', type: 'income',  amount: 5200,   category: 'Salary',        date: d(3, 1),  description: 'Monthly Salary',       isRecurring: true  },
  { id: 'demo-z02', type: 'expense', amount: 1800,   category: 'Rent',          date: d(3, 1),  description: 'Rent — January',       isRecurring: true  },
  { id: 'demo-z03', type: 'expense', amount: 15.99,  category: 'Entertainment', date: d(3, 7),  description: 'Netflix',              isRecurring: true  },
  { id: 'demo-z04', type: 'expense', amount: 9.99,   category: 'Entertainment', date: d(3, 7),  description: 'Spotify',              isRecurring: true  },
  { id: 'demo-z05', type: 'expense', amount: 45,     category: 'Health',        date: d(3, 8),  description: 'Gym Membership',       isRecurring: true  },
  { id: 'demo-z06', type: 'expense', amount: 8.20,   category: 'Food',          date: d(3, 3),  description: 'Starbucks',            isRecurring: false },
  { id: 'demo-z07', type: 'expense', amount: 118.40, category: 'Food',          date: d(3, 5),  description: 'Trader Joe\'s',        isRecurring: false },
  { id: 'demo-z08', type: 'expense', amount: 14.60,  category: 'Transport',     date: d(3, 6),  description: 'Lyft',                 isRecurring: false },
  { id: 'demo-z09', type: 'expense', amount: 210.00, category: 'Shopping',      date: d(3, 10), description: 'Nike Online',          isRecurring: false },
  { id: 'demo-z10', type: 'expense', amount: 82.90,  category: 'Food',          date: d(3, 14), description: 'Whole Foods',          isRecurring: false },
  { id: 'demo-z11', type: 'expense', amount: 12.50,  category: 'Transport',     date: d(3, 16), description: 'Uber',                 isRecurring: false },
  { id: 'demo-z12', type: 'expense', amount: 54.00,  category: 'Food',          date: d(3, 19), description: 'Thai Orchid',         isRecurring: false },
  { id: 'demo-z13', type: 'expense', amount: 43.00,  category: 'Transport',     date: d(3, 22), description: 'Shell Gas',            isRecurring: false },
  { id: 'demo-z14', type: 'expense', amount: 155.00, category: 'Health',        date: d(3, 23), description: 'Dentist Visit',        isRecurring: false },
  { id: 'demo-z15', type: 'expense', amount: 44.99,  category: 'Entertainment', date: d(3, 27), description: 'Concert Tickets',      isRecurring: false },
  { id: 'demo-z16', type: 'expense', amount: 35.60,  category: 'Food',          date: d(3, 28), description: 'Burger Bistro',       isRecurring: false },
];

export const DEMO_TRANSACTIONS: Transaction[] = RAW.map(t => ({
  ...t,
  createdAt: iso(0, 1),
  createdBy: undefined,
}));

// ── Pre-computed derived data ─────────────────────────────────────────────────

function buildSummary(txns: Transaction[]): SummaryData {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let totalIncome = 0, totalExpenses = 0, thisMonthSpending = 0, thisMonthIncome = 0;
  for (const t of txns) {
    if (t.type === 'income') {
      totalIncome += t.amount;
      if (t.date.startsWith(thisMonth)) thisMonthIncome += t.amount;
    } else {
      totalExpenses += t.amount;
      if (t.date.startsWith(thisMonth)) thisMonthSpending += t.amount;
    }
  }
  return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, thisMonthSpending, thisMonthIncome };
}

function buildExpensesByCategory(txns: Transaction[]): CategoryDataPoint[] {
  const map: Record<string, number> = {};
  for (const t of txns) {
    if (t.type === 'expense') map[t.category] = (map[t.category] ?? 0) + t.amount;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function buildMonthlyData(txns: Transaction[]): MonthlyDataPoint[] {
  const map: Record<string, { income: number; expenses: number }> = {};
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    if (!map[m]) map[m] = { income: 0, expenses: 0 };
    if (t.type === 'income') map[m].income += t.amount;
    else map[m].expenses += t.amount;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      ...data,
    }));
}

export const DEMO_SUMMARY             = buildSummary(DEMO_TRANSACTIONS);
export const DEMO_EXPENSES_BY_CATEGORY = buildExpensesByCategory(DEMO_TRANSACTIONS);
export const DEMO_MONTHLY_DATA        = buildMonthlyData(DEMO_TRANSACTIONS);
