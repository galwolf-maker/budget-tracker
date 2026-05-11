import { useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertCircle, Star, Repeat2,
  X, CheckCircle2, EyeOff, RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useCurrencyContext } from '../../context/CurrencyContext';
import { generateInsights } from '../../utils/insightEngine';
import { useInsightFeedback } from '../../hooks/useInsightFeedback';
import type { Transaction } from '../../types';
import type { Insight, InsightType, InsightSeverity, InsightConfidence } from '../../utils/insightEngine';

interface InsightsPanelProps {
  transactions: Transaction[];
  /** Called when the user confirms a pattern as recurring from an insight card. */
  onMarkTransactionRecurring?: (id: string, isRecurring: boolean) => void;
}

// ── Styling maps ──────────────────────────────────────────────────────────────

const SEVERITY_BORDER: Record<InsightSeverity, string> = {
  good: 'border-l-emerald-400',
  warn: 'border-l-amber-400',
  info: 'border-l-blue-400',
};

const SEVERITY_BG: Record<InsightSeverity, string> = {
  good: 'bg-emerald-50/60 dark:bg-emerald-900/10',
  warn: 'bg-amber-50/60 dark:bg-amber-900/10',
  info: 'bg-blue-50/40 dark:bg-blue-900/10',
};

const CONFIDENCE_BADGE: Record<InsightConfidence, string> = {
  low:    'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  high:   'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
};

function insightIcon(type: InsightType, severity: InsightSeverity) {
  const cls = {
    good: 'text-emerald-500',
    warn: 'text-amber-500',
    info: 'text-blue-400',
  }[severity];

  if (type === 'trend_down')           return <TrendingDown size={15} className={cls} />;
  if (type === 'trend_up')             return <TrendingUp   size={15} className={cls} />;
  if (type === 'anomaly')              return <AlertCircle  size={15} className={cls} />;
  if (type === 'recurring_detected')   return <Repeat2      size={15} className={cls} />;
  return                                      <Star        size={15} className={cls} />;
}

// ── InsightCard ───────────────────────────────────────────────────────────────

interface CardProps {
  insight: Insight;
  onDismiss:         () => void;
  onNotUnusual:      () => void;
  onMarkRecurring:   () => void;
  onHideSimilar:     () => void;
}

function InsightCard({ insight, onDismiss, onNotUnusual, onMarkRecurring, onHideSimilar }: CardProps) {
  const { type, title, description, severity, confidence, canMarkRecurring, canSuppressAnomaly } = insight;

  return (
    <div
      className={`
        flex gap-3 p-3.5 rounded-xl border-l-4 border border-slate-100 dark:border-slate-700/60
        ${SEVERITY_BORDER[severity]} ${SEVERITY_BG[severity]}
      `}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        {insightIcon(type, severity)}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Title + confidence badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CONFIDENCE_BADGE[confidence]}`}>
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
          </span>
        </div>

        {/* Description */}
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {description}
        </p>

        {/* Action buttons */}
        {(canMarkRecurring || canSuppressAnomaly) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {canMarkRecurring && (
              <button
                onClick={onMarkRecurring}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md
                           bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300
                           hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
              >
                <Repeat2 size={10} />
                Mark as recurring
              </button>
            )}
            {canSuppressAnomaly && (
              <>
                <button
                  onClick={onNotUnusual}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md
                             bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                             hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <CheckCircle2 size={10} />
                  Not unusual
                </button>
                <button
                  onClick={onHideSimilar}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md
                             bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300
                             hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <EyeOff size={10} />
                  Hide similar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        title="Dismiss"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md
                   text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300
                   hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function InsightsPanel({ transactions, onMarkTransactionRecurring }: InsightsPanelProps) {
  const { currency } = useCurrencyContext();
  const fmt = (v: number) => formatCurrency(v, currency);

  const { feedback, dismiss, notUnusual, markAsRecurring, hideSimilar } = useInsightFeedback();

  const insights = useMemo(
    () => generateInsights(transactions, feedback, fmt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, feedback, currency],
  );

  if (insights.length === 0) return null;

  function handleMarkRecurring(insight: Insight) {
    // Persist pattern-level feedback
    markAsRecurring(insight.entityKey);
    // Actually mark all related transactions as recurring
    if (onMarkTransactionRecurring) {
      for (const id of insight.relatedTransactionIds) {
        onMarkTransactionRecurring(id, true);
      }
    }
    dismiss(insight.id);
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Insights
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {insights.length} active
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2.5">
        {insights.map(ins => (
          <InsightCard
            key={ins.id}
            insight={ins}
            onDismiss={() => dismiss(ins.id)}
            onNotUnusual={() => { notUnusual(ins.entityKey); dismiss(ins.id); }}
            onMarkRecurring={() => handleMarkRecurring(ins)}
            onHideSimilar={() => { hideSimilar(ins.entityKey); dismiss(ins.id); }}
          />
        ))}
      </div>

      {/* Footer hint */}
      <p className="mt-3.5 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
        <RefreshCw size={9} />
        Insights update as you add transactions. Dismissals are remembered.
      </p>
    </div>
  );
}
