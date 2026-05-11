/**
 * recurringDetector
 *
 * Identifies transactions that are likely recurring subscriptions or fixed
 * charges.  Detection is intentionally strict to avoid false positives from
 * variable-spend merchants (grocery stores, restaurants, fuel stations, etc.).
 *
 * A candidate is only surfaced when ALL of the following hold:
 *
 *  1. Same (or very similar) merchant name — normalised with normalizeMerchant
 *     which strips asterisks, country-code suffixes, trailing order numbers,
 *     and punctuation noise.
 *
 *  2. Same amount (or within ±0.05 rounding tolerance).
 *     Amounts are bucketed to the nearest $0.05 so that currency-conversion
 *     rounding differences ("$9.99" vs "$10.00") are treated as equal,
 *     while genuinely different charges ("$25.50" vs "$78.30") are not.
 *
 *  3. Appears in 2+ distinct calendar months (fixed-spend categories) or
 *     3+ distinct months (variable-spend categories).
 *
 * Confidence is then calculated from:
 *  • Amount variance  (exact match → higher confidence)
 *  • Regularity       (monthly / quarterly intervals → higher confidence)
 *  • Month count      (more months → higher confidence)
 *
 * Debug logs ([BT-RECURRING]) are always emitted.
 */

import type { Transaction, TransactionType } from '../types';
import { normalizeMerchant } from './transactionMatcher';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Round to nearest $0.05 — accounts for currency-conversion rounding. */
const AMOUNT_STEP = 0.05;

/**
 * Categories where amounts naturally vary (restaurants, groceries, fuel …).
 * Require more months of evidence before suggesting "recurring".
 */
const VARIABLE_SPEND_CATEGORIES = new Set([
  'Food',
  'Transport',
  'Shopping',
  'Health',
  'Other',
]);

/** Months needed for fixed-cost merchants (subscriptions, rent, utilities). */
const MIN_MONTHS_FIXED    = 2;

/** Months needed for variable-spend merchant categories. */
const MIN_MONTHS_VARIABLE = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function amountBucket(amount: number): string {
  // e.g. $9.99 → "10.00", $20.04 → "20.05"
  return (Math.round(amount / AMOUNT_STEP) * AMOUNT_STEP).toFixed(2);
}

function monthsBetween(isoA: string, isoB: string): number {
  // "YYYY-MM" strings
  const [yA, mA] = isoA.split('-').map(Number);
  const [yB, mB] = isoB.split('-').map(Number);
  return (yB - yA) * 12 + (mB - mA);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecurringConfidence = 'high' | 'medium';

export interface RecurringCandidate {
  /** Stable string key used to dismiss this candidate. */
  key:         string;
  description: string;
  amount:      number;
  category:    string;
  type:        TransactionType;
  occurrences: Transaction[];
  monthCount:  number;
  confidence:  RecurringConfidence;
  /** Human-readable reason shown in the UI. */
  matchReason: string;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Returns recurring candidates that pass all detection thresholds.
 * Transactions already marked `isRecurring` and keys in `dismissedKeys`
 * are excluded.
 */
export function detectRecurring(
  transactions: Transaction[],
  dismissedKeys: Set<string> = new Set(),
): RecurringCandidate[] {

  // ── Step 1: group by (normalizedMerchant, amountBucket, type) ────────────
  const groups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.isRecurring) continue;
    const norm = normalizeMerchant(t.description);
    if (!norm) continue;
    const bucket = amountBucket(t.amount);
    const key    = `${norm}|${bucket}|${t.type}`;
    if (dismissedKeys.has(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  // ── Step 2: filter and score ─────────────────────────────────────────────
  const candidates: RecurringCandidate[] = [];

  for (const [key, txns] of groups) {
    const sorted   = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    const months   = new Set(txns.map(t => t.date.slice(0, 7)));
    const normKey  = key.split('|')[0];
    const bucket   = key.split('|')[1];
    const category = sorted[0].category;
    const refAmt   = sorted[0].amount;

    // Category-sensitive month threshold
    const isVariable = VARIABLE_SPEND_CATEGORIES.has(category);
    const minMonths  = isVariable ? MIN_MONTHS_VARIABLE : MIN_MONTHS_FIXED;

    if (months.size < minMonths) {
      console.log(
        `[BT-RECURRING] SKIP  "${sorted[0].description}"`,
        `→ norm="${normKey}" bucket=${bucket}`,
        `| months=${months.size} < required ${minMonths}`,
        `| category="${category}" (${isVariable ? 'variable' : 'fixed'})`,
      );
      continue;
    }

    // ── Amount variance within this group ───────────────────────────────
    const amounts     = txns.map(t => t.amount);
    const minAmt      = Math.min(...amounts);
    const maxAmt      = Math.max(...amounts);
    const amtVariance = maxAmt - minAmt;
    const isExactAmt  = amtVariance < 0.02; // treat as exact if diff < 2¢

    // ── Month spacing (regular = monthly or quarterly) ──────────────────
    const sortedMonths = [...months].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sortedMonths.length; i++) {
      gaps.push(monthsBetween(sortedMonths[i - 1], sortedMonths[i]));
    }
    const allMonthly   = gaps.length > 0 && gaps.every(g => g === 1);
    const allQuarterly = gaps.length > 0 && gaps.every(g => g === 3);
    const isRegular    = allMonthly || allQuarterly;

    // ── Confidence ───────────────────────────────────────────────────────
    const confidence: RecurringConfidence =
      (isExactAmt && (isRegular || months.size >= 3)) ? 'high' : 'medium';

    // ── Match reason (UI text) ───────────────────────────────────────────
    const matchReason = isExactAmt
      ? `Seen in ${months.size} months with the same amount — looks recurring`
      : `Seen in ${months.size} months with similar amount (±${amtVariance.toFixed(2)}) — looks recurring`;

    // ── Debug log ────────────────────────────────────────────────────────
    console.log(
      `[BT-RECURRING] FOUND "${sorted[0].description}"`,
      `→ norm="${normKey}" bucket=${bucket}`,
      `| refAmount=${refAmt.toFixed(2)} amtVariance=${amtVariance.toFixed(2)}`,
      `| months=[${sortedMonths.join(', ')}] gaps=[${gaps.join(', ')}]`,
      `| isExactAmt=${isExactAmt} isRegular=${isRegular}`,
      `| confidence=${confidence}`,
      `| reason: ${matchReason}`,
    );

    candidates.push({
      key,
      description: sorted[0].description,
      amount:      sorted[0].amount,
      category,
      type:        sorted[0].type,
      occurrences: sorted,
      monthCount:  months.size,
      confidence,
      matchReason,
    });
  }

  // ── Step 3: sort — high confidence first, then by month count ────────────
  return candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return b.monthCount - a.monthCount;
  });
}
