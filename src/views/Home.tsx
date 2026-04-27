import { Plus, LayoutDashboard, ArrowLeftRight, TrendingUp, TrendingDown, Wallet, LogIn } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { useCurrencyContext } from '../context/CurrencyContext';
import { TransactionItem } from '../components/transactions/TransactionItem';
import type { SummaryData, Transaction, ViewType } from '../types';
import type { User } from '@supabase/supabase-js';

interface HomeProps {
  user: User | null;
  summary: SummaryData;
  recentTransactions: Transaction[];
  onNavigate: (view: ViewType) => void;
  onAddTransaction: () => void;
  onSignIn: () => void;
}

export function Home({
  user,
  summary,
  recentTransactions,
  onNavigate,
  onAddTransaction,
  onSignIn,
}: HomeProps) {
  const { currency } = useCurrencyContext();
  const fmt = (v: number) => formatCurrency(v, currency);

  const displayName =
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
          <Wallet size={36} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          Welcome to BudgetTrack
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
          Take control of your finances. Track income, expenses, and savings — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onSignIn}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <LogIn size={16} />
            Sign in to get started
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            <LayoutDashboard size={16} />
            Browse as guest
          </button>
        </div>
      </div>
    );
  }

  const isPositive = summary.balance >= 0;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
          {greeting}{displayName ? `, ${displayName}` : ''}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Here's a snapshot of your finances.
        </p>
      </div>

      {/* Balance hero card */}
      <div className={`rounded-2xl p-6 text-white shadow-lg ${
        isPositive
          ? 'bg-gradient-to-br from-blue-500 to-blue-700'
          : 'bg-gradient-to-br from-rose-500 to-rose-700'
      }`}>
        <p className="text-sm font-medium opacity-80 mb-1">Net Balance</p>
        <p className="text-4xl font-bold tracking-tight">
          {fmt(summary.balance)}
        </p>
        <div className="flex gap-6 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-xs opacity-70 mb-0.5">Income</p>
            <p className="text-lg font-semibold">{fmt(summary.totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70 mb-0.5">Expenses</p>
            <p className="text-lg font-semibold">{fmt(summary.totalExpenses)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70 mb-0.5">This month</p>
            <p className="text-lg font-semibold">{fmt(summary.thisMonthSpending)}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onAddTransaction}
          className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
            <Plus size={20} className="text-blue-600" />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Add transaction</span>
        </button>

        <button
          onClick={() => onNavigate('dashboard')}
          className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-900/50 transition-colors">
            <LayoutDashboard size={20} className="text-violet-600" />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('transactions')}
          className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-700 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
            <ArrowLeftRight size={20} className="text-emerald-600" />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Transactions</span>
        </button>
      </div>

      {/* This month stat strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">This month income</p>
            <p className="text-base font-bold text-emerald-600 truncate">{fmt(summary.thisMonthIncome)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
            <TrendingDown size={16} className="text-rose-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400">This month spending</p>
            <p className="text-base font-bold text-rose-500 truncate">{fmt(summary.thisMonthSpending)}</p>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      {recentTransactions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent activity</h2>
            <button
              onClick={() => onNavigate('transactions')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              View all →
            </button>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {recentTransactions.slice(0, 5).map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                onEdit={() => undefined}
                onDelete={() => undefined}
                readOnly
              />
            ))}
          </div>
        </div>
      )}

      {recentTransactions.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 text-center">
          <div className="text-4xl mb-3">💸</div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
            No transactions yet — add your first one to get started.
          </p>
          <button
            onClick={onAddTransaction}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            Add Transaction
          </button>
        </div>
      )}
    </div>
  );
}
