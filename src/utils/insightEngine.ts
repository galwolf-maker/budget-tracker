/**
 * insightEngine
 *
 * Pure-function insight generators.  No React — safe to call anywhere.
 *
 * Six rule generators run in order:
 *   1. trend          — month-over-month spending change
 *   2. top_categories — top-3 expense categories this month
 *   3. anomaly        — individual transactions that are unusually large
 *      → suppressed when the merchant+amount looks recurring
 *      → replaced by "recurring_detected" when it IS recurring but not yet marked
 *   4. recurring_detected — up to 2 recurring patterns not yet marked
 *
 * Anomaly detection is deliberately strict:
 *  • Amount must exceed the per-category historical average by 2× OR z-score ≥ 2.0
 *  • Suppressed if the same merchant+amount was seen in ≥ 2 prior months
 *  • Suppressed if the transaction is already isRecurring / has recurringGroupId
 *  • Suppressed if the category is a fixed-cost category and ANY prior occurrence exists
 *  • Suppressed if the user previously marked this pattern as "not unusual" or "recurring"
 *
 * Debug: every suppression and every generated insight emits a [BT-INSIGHTS] log.
 */

import { normalizeMerchant } from './transactionMatcher';
import type { Transaction } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsightType =
  | 'anomaly'
  | 'recurring_detected'
  | 'trend_up'
  | 'trend_down'
  | 'trend_neutral'
  | 'monthly_summary'
  | 'top_categories';

export type InsightSeverity = 'good' | 'warn' | 'info';
export type InsightConfidence = 'low' | 'medium' | 'high';

export interface Insight {
  /** Deterministic per-occurrence ID — used to track dismissals. */
  id: string;
  /**
   * Pattern-level key (merchant+amount+category).
   * Used for "not unusual" / "hide similar" suppressions across months.
   */
  entityKey: string;
  type:        InsightType;
  title:       string;
  description: string;
  severity:    InsightSeverity;
  confidence:  InsightConfidence;
  /** Short call-to-action text, shown as the primary action button label. */
  suggestedAction?: string;
  relatedTransactionIds: string[];
  /** Show a "Mark as recurring" button. */
  canMarkRecurring: boolean;
  /** Show a "Not unusual" / "Hide similar" button. */
  canSuppressAnomaly: boolean;
}

/**
 * Persisted feedback.  Stored as JSON in localStorage under `bt-insight-feedback`.
 */
export interface InsightFeedbackRecord {
  /** IDs of individual insight instances the user dismissed. */
  dismissedIds:        string[];
  /** Entity keys the user said are "not unusual" — suppress anomaly forever. */
  suppressedPatterns:  string[];
  /** Entity keys the user confirmed as recurring — suppress anomaly + suggest mark. */
  recurringPatterns:   string[];
}

export const EMPTY_FEEDBACK: InsightFeedbackRecord = {
  dismissedIds:       [],
  suppressedPatterns: [],
  recurringPatterns:  [],
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Round to nearest $0.05 — matches the bucket used in recurringDetector. */
const AMOUNT_STEP = 0.05;
function amountBucket(amount: number): string {
  return (Math.round(amount / AMOUNT_STEP) * AMOUNT_STEP).toFixed(2);
}

function yyyyMm(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonthStr(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return yyyyMm(d);
}

/**
 * Categories whose charges are typically fixed and predictable.
 * A single prior occurrence is enough to suppress an anomaly insight.
 */
const FIXED_COST_CATEGORIES = new Set([
  'Rent', 'Utilities', 'Insurance', 'Salary', 'Freelance',
]);

// ── Generator 1: month-over-month trend ───────────────────────────────────────

function trendInsight(
  thisExpenses: Transaction[],
  lastExpenses: Transaction[],
  fmt:          (v: number) => string,
  month:        string,
): Insight | null {
  const thisTotal = thisExpenses.reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastExpenses.reduce((s, t) => s + t.amount, 0);

  const id        = `trend|${month}`;
  const entityKey = id;
  const ids       = thisExpenses.map(t => t.id);

  if (thisTotal === 0 && lastTotal === 0) return null;

  if (lastTotal === 0) {
    return {
      id, entityKey, type: 'monthly_summary',
      title: 'Monthly spending',
      description: `Spent ${fmt(thisTotal)} so far this month.`,
      severity: 'info', confidence: 'high',
      relatedTransactionIds: ids,
      canMarkRecurring: false, canSuppressAnomaly: false,
    };
  }

  const pct = ((thisTotal - lastTotal) / lastTotal) * 100;

  if (pct <= -10) {
    return {
      id, entityKey, type: 'trend_down',
      title: 'Spending is down',
      description: `Down ${Math.abs(pct).toFixed(0)}% vs last month — ${fmt(thisTotal)} vs ${fmt(lastTotal)}.`,
      severity: 'good', confidence: 'high',
      relatedTransactionIds: ids,
      canMarkRecurring: false, canSuppressAnomaly: false,
    };
  }

  if (pct >= 20) {
    return {
      id, entityKey, type: 'trend_up',
      title: 'Higher spending this month',
      description: `Up ${pct.toFixed(0)}% vs last month — ${fmt(thisTotal)} vs ${fmt(lastTotal)}.`,
      severity: 'warn', confidence: 'high',
      relatedTransactionIds: ids,
      canMarkRecurring: false, canSuppressAnomaly: false,
    };
  }

  return {
    id, entityKey, type: 'trend_neutral',
    title: 'Spending on track',
    description: `${fmt(thisTotal)} this month (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs last month).`,
    severity: 'info', confidence: 'high',
    relatedTransactionIds: ids,
    canMarkRecurring: false, canSuppressAnomaly: false,
  };
}

// ── Generator 2: top categories ───────────────────────────────────────────────

function topCategoriesInsight(
  thisExpenses: Transaction[],
  fmt:          (v: number) => string,
  month:        string,
): Insight | null {
  if (thisExpenses.length === 0) return null;

  const catMap: Record<string, number> = {};
  for (const t of thisExpenses) catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;

  const top = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length === 0) return null;

  return {
    id: `top_cats|${month}`,
    entityKey: `top_cats|${month}`,
    type: 'top_categories',
    title: 'Top spending categories',
    description: `This month: ${top.map(([c, a]) => `${c} (${fmt(a)})`).join(', ')}.`,
    severity: 'info', confidence: 'high',
    relatedTransactionIds: thisExpenses.map(t => t.id),
    canMarkRecurring: false, canSuppressAnomaly: false,
  };
}

// ── Generator 3: anomaly + recurring_detected ─────────────────────────────────

interface MerchantEntry { months: Set<string>; ids: string[] }

function buildMerchantHistory(priorExpenses: Transaction[]): Map<string, MerchantEntry> {
  const map = new Map<string, MerchantEntry>();
  for (const t of priorExpenses) {
    const key = `${normalizeMerchant(t.description)}|${amountBucket(t.amount)}`;
    const e   = map.get(key) ?? { months: new Set(), ids: [] };
    e.months.add(t.date.slice(0, 7));
    e.ids.push(t.id);
    map.set(key, e);
  }
  return map;
}

function anomalyAndRecurringInsights(
  thisExpenses:     Transaction[],
  priorExpenses:    Transaction[],
  suppressed:       Set<string>,
  fmt:              (v: number) => string,
  month:            string,
): Insight[] {
  const insights: Insight[] = [];

  // Per-category historical amount arrays (for avg/stddev)
  const histAmounts: Record<string, number[]> = {};
  for (const t of priorExpenses) {
    (histAmounts[t.category] ??= []).push(t.amount);
  }

  const merchantHistory = buildMerchantHistory(priorExpenses);

  // Dedup recurring_detected within this call
  const recurringShown = new Set<string>();
  let recurringCount   = 0;
  let anomalyCount     = 0;

  for (const t of thisExpenses) {
    const norm        = normalizeMerchant(t.description);
    const bucket      = amountBucket(t.amount);
    const merchantKey = `${norm}|${bucket}`;
    const anomalyKey  = `anomaly|${norm}|${bucket}|${t.category}`;
    const recurKey    = `recurring|${norm}|${bucket}`;

    const prior           = merchantHistory.get(merchantKey);
    const priorMonthCount = prior?.months.size ?? 0;
    const isFixedCost     = FIXED_COST_CATEGORIES.has(t.category);
    const alreadyRecurring = !!(t.isRecurring || t.recurringGroupId);

    // ── Suppression / recurring guard ─────────────────────────────────────

    if (alreadyRecurring) {
      console.log(
        `[BT-INSIGHTS] SKIP anomaly "${t.description}"`,
        `— already flagged recurring (isRecurring=${t.isRecurring})`,
      );
      continue;
    }

    // 2+ prior months with same merchant+amount → treat as recurring
    const looksRecurring = (isFixedCost && priorMonthCount >= 1) || priorMonthCount >= 2;

    if (looksRecurring) {
      console.log(
        `[BT-INSIGHTS] SKIP anomaly "${t.description}"`,
        `— looks recurring: priorMonths=${priorMonthCount} fixedCost=${isFixedCost}`,
      );

      // Surface as "recurring detected" (not yet marked) — up to 2 per render
      if (
        recurringCount < 2 &&
        !recurringShown.has(merchantKey) &&
        !suppressed.has(recurKey) &&
        !suppressed.has(anomalyKey)
      ) {
        recurringShown.add(merchantKey);
        recurringCount++;
        const conf: InsightConfidence = priorMonthCount >= 3 ? 'high' : 'medium';
        const ins: Insight = {
          id:          `recurring_detected|${merchantKey}|${month}`,
          entityKey:   recurKey,
          type:        'recurring_detected',
          title:       'Recurring payment detected',
          description: `"${t.description}" ${fmt(t.amount)} — seen in ${priorMonthCount} previous months with the same amount.`,
          severity:    'info', confidence: conf,
          suggestedAction: 'Mark as recurring',
          relatedTransactionIds: [t.id, ...(prior?.ids ?? [])],
          canMarkRecurring:   true,
          canSuppressAnomaly: false,
        };
        console.log(
          `[BT-INSIGHTS] GENERATE recurring_detected "${t.description}"`,
          `| priorMonths=${priorMonthCount} confidence=${conf}`,
        );
        insights.push(ins);
      }
      continue;
    }

    // ── User feedback suppression ─────────────────────────────────────────

    if (suppressed.has(anomalyKey)) {
      console.log(
        `[BT-INSIGHTS] SUPPRESSED anomaly "${t.description}"`,
        `— user marked as not-unusual (key="${anomalyKey}")`,
      );
      continue;
    }

    // ── Statistical anomaly check ─────────────────────────────────────────

    const catAmts = histAmounts[t.category] ?? [];
    if (catAmts.length < 2) {
      console.log(
        `[BT-INSIGHTS] SKIP anomaly "${t.description}"`,
        `— insufficient history for category "${t.category}" (${catAmts.length} samples)`,
      );
      continue;
    }

    const avg    = catAmts.reduce((s, a) => s + a, 0) / catAmts.length;
    const stdDev = Math.sqrt(catAmts.reduce((s, a) => s + (a - avg) ** 2, 0) / catAmts.length);
    const zScore = stdDev > 1 ? (t.amount - avg) / stdDev : (t.amount > avg ? 99 : 0);

    const isAnomaly = t.amount > avg * 2.0 || zScore >= 2.0;

    console.log(
      `[BT-INSIGHTS] CHECK anomaly "${t.description}"`,
      `→ norm="${norm}" bucket=${bucket}`,
      `| amount=${t.amount.toFixed(2)} avg=${avg.toFixed(2)} stdDev=${stdDev.toFixed(2)} zScore=${zScore.toFixed(2)}`,
      `| priorMonths=${priorMonthCount} fixedCost=${isFixedCost} isAnomaly=${isAnomaly}`,
    );

    if (!isAnomaly || anomalyCount >= 3) continue;

    let confidence: InsightConfidence;
    let title: string;
    let description: string;

    if (zScore >= 3.0 || t.amount > avg * 3.0) {
      confidence  = 'high';
      title       = `High ${t.category} charge`;
      description = `${fmt(t.amount)} for "${t.description}" is significantly above your usual ${t.category} spending (avg ${fmt(avg)}).`;
    } else {
      confidence  = 'medium';
      title       = `${t.category} looks higher than usual`;
      description = `${fmt(t.amount)} for "${t.description}" is above your typical ${t.category} spending (avg ${fmt(avg)}).`;
    }

    console.log(
      `[BT-INSIGHTS] GENERATE anomaly "${t.description}"`,
      `| confidence=${confidence} title="${title}"`,
    );

    anomalyCount++;
    insights.push({
      id:          `anomaly|${t.id}|${month}`,
      entityKey:   anomalyKey,
      type:        'anomaly',
      title,
      description,
      severity:    confidence === 'high' ? 'warn' : 'info',
      confidence,
      suggestedAction: 'Review this charge',
      relatedTransactionIds: [t.id, ...(prior?.ids ?? [])],
      canMarkRecurring:   priorMonthCount === 1,
      canSuppressAnomaly: true,
    });
  }

  return insights;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run all insight generators and apply feedback suppression.
 *
 * @param transactions  All transactions (all time).
 * @param feedback      Persisted user feedback from `useInsightFeedback`.
 * @param fmt           Currency-aware number formatter from the app context.
 */
export function generateInsights(
  transactions: Transaction[],
  feedback:     InsightFeedbackRecord,
  fmt:          (v: number) => string,
): Insight[] {
  if (transactions.length < 3) return [];

  const month    = yyyyMm(new Date());
  const lastMo   = prevMonthStr(month);

  const dismissed  = new Set(feedback.dismissedIds);
  const suppressed = new Set([...feedback.suppressedPatterns, ...feedback.recurringPatterns]);

  const thisExpenses  = transactions.filter(t => t.type === 'expense' && t.date.startsWith(month));
  const lastExpenses  = transactions.filter(t => t.type === 'expense' && t.date.startsWith(lastMo));
  const priorExpenses = transactions.filter(t => t.type === 'expense' && !t.date.startsWith(month));

  const result: Insight[] = [];

  const trend = trendInsight(thisExpenses, lastExpenses, fmt, month);
  if (trend && !dismissed.has(trend.id)) result.push(trend);

  const topCats = topCategoriesInsight(thisExpenses, fmt, month);
  if (topCats && !dismissed.has(topCats.id)) result.push(topCats);

  const anomalies = anomalyAndRecurringInsights(thisExpenses, priorExpenses, suppressed, fmt, month);
  for (const ins of anomalies) {
    if (!dismissed.has(ins.id)) result.push(ins);
  }

  return result;
}
