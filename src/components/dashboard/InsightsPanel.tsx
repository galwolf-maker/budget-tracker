import { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Zap, Star } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Transaction } from '../../types';

interface InsightsPanelProps {
  transactions: Transaction[];
}

interface Insight {
  icon: React.ReactNode;
  text: string;
  kind: 'good' | 'warn' | 'neutral';
}

export function InsightsPanel({ transactions }: InsightsPanelProps) {
  const insights = useMemo((): Insight[] => {
    if (transactions.length < 3) return [];

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const thisExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(thisMonth)
    );
    const lastExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(lastMonth)
    );

    const thisTotal = thisExpenses.reduce((s, t) => s + t.amount, 0);
    const lastTotal = lastExpenses.reduce((s, t) => s + t.amount, 0);

    const result: Insight[] = [];

    // ── Month-over-month ──────────────────────────────────────────
    if (lastTotal > 0) {
      const pct = ((thisTotal - lastTotal) / lastTotal) * 100;
      if (pct <= -10) {
        result.push({
          icon: <TrendingDown size={14} />,
          text: `Spending down ${Math.abs(pct).toFixed(0)}% vs last month — ${formatCurrency(thisTotal)} vs ${formatCurrency(lastTotal)}.`,
          kind: 'good',
        });
      } else if (pct >= 20) {
        result.push({
          icon: <TrendingUp size={14} />,
          text: `Spending up ${pct.toFixed(0)}% vs last month — ${formatCurrency(thisTotal)} vs ${formatCurrency(lastTotal)}.`,
          kind: 'warn',
        });
      } else {
        result.push({
          icon: <TrendingUp size={14} />,
          text: `Spent ${formatCurrency(thisTotal)} this month (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs last month).`,
          kind: 'neutral',
        });
      }
    } else if (thisTotal > 0) {
      result.push({
        icon: <Star size={14} />,
        text: `Spent ${formatCurrency(thisTotal)} so far this month.`,
        kind: 'neutral',
      });
    }

    // ── Top spending categories ───────────────────────────────────
    const catMap: Record<string, number> = {};
    for (const t of thisExpenses) {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
    }
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topCats.length > 0) {
      const str = topCats
        .map(([cat, amt]) => `${cat} (${formatCurrency(amt)})`)
        .join(', ');
      result.push({
        icon: <Star size={14} />,
        text: `Top categories this month: ${str}.`,
        kind: 'neutral',
      });
    }

    // ── Unusual / large transactions ──────────────────────────────
    // Build per-category average across all history (excluding this month)
    const histCatSum: Record<string, number> = {};
    const histCatCount: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || t.date.startsWith(thisMonth)) continue;
      histCatSum[t.category] = (histCatSum[t.category] ?? 0) + t.amount;
      histCatCount[t.category] = (histCatCount[t.category] ?? 0) + 1;
    }

    const unusual = thisExpenses
      .filter((t) => {
        const count = histCatCount[t.category] ?? 0;
        if (count < 2) return false;
        const avg = histCatSum[t.category] / count;
        return t.amount > avg * 2.5;
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2);

    for (const t of unusual) {
      result.push({
        icon: <AlertCircle size={14} />,
        text: `Unusually large ${t.category} charge: ${formatCurrency(t.amount)}${t.description ? ` — "${t.description}"` : ''}.`,
        kind: 'warn',
      });
    }

    // ── Recurring suggestion ──────────────────────────────────────
    const monthSet: Record<string, Set<string>> = {};
    for (const t of transactions) {
      if (t.type !== 'expense' || t.isRecurring) continue;
      const key = `${t.description.trim().toLowerCase()}|${t.amount}`;
      if (!monthSet[key]) monthSet[key] = new Set();
      monthSet[key].add(t.date.slice(0, 7));
    }
    const candidates = Object.entries(monthSet)
      .filter(([, months]) => months.size >= 3)
      .map(([key]) => key.split('|')[0]);

    if (candidates.length > 0) {
      const names = candidates
        .slice(0, 2)
        .map((n) => `"${n}"`)
        .join(' and ');
      result.push({
        icon: <Zap size={14} />,
        text: `${names} appear monthly — consider marking ${candidates.length === 1 ? 'it' : 'them'} as recurring.`,
        kind: 'neutral',
      });
    }

    return result;
  }, [transactions]);

  if (insights.length === 0) return null;

  const kindClasses: Record<Insight['kind'], string> = {
    good: 'text-emerald-500',
    warn: 'text-amber-500',
    neutral: 'text-blue-400 dark:text-blue-300',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3.5">
        Insights
      </h3>
      <ul className="space-y-2.5">
        {insights.map((ins, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className={`mt-0.5 shrink-0 ${kindClasses[ins.kind]}`}>
              {ins.icon}
            </span>
            <span className="text-slate-600 dark:text-slate-300 leading-snug">
              {ins.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
