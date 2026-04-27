import { Plus } from 'lucide-react';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { Charts } from '../components/dashboard/Charts';
import { InsightsPanel } from '../components/dashboard/InsightsPanel';
import { TransactionItem } from '../components/transactions/TransactionItem';
import type {
  SummaryData,
  Transaction,
  CategoryDataPoint,
  MonthlyDataPoint,
} from '../types';

interface DashboardProps {
  summary: SummaryData;
  expensesByCategory: CategoryDataPoint[];
  monthlyData: MonthlyDataPoint[];
  recentTransactions: Transaction[];
  allTransactions: Transaction[];
  onAddTransaction: () => void;
}

export function Dashboard({
  summary,
  expensesByCategory,
  monthlyData,
  recentTransactions,
  allTransactions,
  onAddTransaction,
}: DashboardProps) {
  const isEmpty = recentTransactions.length === 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <SummaryCards summary={summary} />
      <InsightsPanel transactions={allTransactions} />
      <Charts expensesByCategory={expensesByCategory} monthlyData={monthlyData} />

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Transactions
          </h2>
          <button
            onClick={onAddTransaction}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus size={13} />
            Add new
          </button>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="text-5xl mb-3">💸</div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No transactions yet
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">
              Start tracking by adding your first income or expense.
            </p>
            <button
              onClick={onAddTransaction}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Add Transaction
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
            {recentTransactions.map((t) => (
              <TransactionItem
                key={t.id}
                transaction={t}
                onEdit={() => undefined}
                onDelete={() => undefined}
                readOnly
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
