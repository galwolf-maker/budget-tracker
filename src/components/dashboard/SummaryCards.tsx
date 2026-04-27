import { TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import type { SummaryData } from '../../types';

interface SummaryCardsProps {
  summary: SummaryData;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { currency } = useCurrencyContext();
  const cards = [
    {
      label: 'Net Balance',
      value: summary.balance,
      icon: Wallet,
      iconBg: summary.balance >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: summary.balance >= 0 ? 'text-blue-600' : 'text-rose-600',
      valueColor: summary.balance >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-700 dark:text-rose-400',
      border: summary.balance >= 0 ? 'border-blue-100 dark:border-slate-700' : 'border-rose-100 dark:border-slate-700',
    },
    {
      label: 'Total Income',
      value: summary.totalIncome,
      icon: TrendingUp,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-100 dark:border-slate-700',
    },
    {
      label: 'Total Expenses',
      value: summary.totalExpenses,
      icon: TrendingDown,
      iconBg: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600',
      valueColor: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-100 dark:border-slate-700',
    },
    {
      label: "This Month's Spending",
      value: summary.thisMonthSpending,
      icon: Calendar,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-100 dark:border-slate-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor, border }) => (
        <div
          key={label}
          className={`bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm border ${border}`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug">{label}</p>
            <div className={`p-2 rounded-xl ${iconBg} shrink-0`}>
              <Icon size={16} className={iconColor} />
            </div>
          </div>
          <p className={`text-lg sm:text-2xl font-bold ${valueColor} tracking-tight`}>
            {formatCurrency(value, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}
