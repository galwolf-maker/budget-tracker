import type { Transaction, TransactionType } from '../types';

function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RecurringCandidate {
  key: string;
  description: string;
  amount: number;
  category: string;
  type: TransactionType;
  occurrences: Transaction[];
  monthCount: number;
}

/**
 * Returns transactions that appear in 2+ distinct months with the same
 * normalized description and amount, and are not already marked recurring.
 * Candidates dismissed by the user are filtered via `dismissedKeys`.
 */
export function detectRecurring(
  transactions: Transaction[],
  dismissedKeys: Set<string> = new Set()
): RecurringCandidate[] {
  const groups = new Map<string, Transaction[]>();

  for (const t of transactions) {
    if (t.isRecurring) continue;
    const norm = normalizeDesc(t.description);
    if (!norm) continue;
    const key = `${norm}|${t.amount.toFixed(2)}|${t.type}`;
    if (dismissedKeys.has(key)) continue;
    const group = groups.get(key) ?? [];
    group.push(t);
    groups.set(key, group);
  }

  const candidates: RecurringCandidate[] = [];

  for (const [key, txns] of groups) {
    const months = new Set(txns.map(t => t.date.slice(0, 7)));
    if (months.size < 2) continue;

    const sorted = [...txns].sort((a, b) => b.date.localeCompare(a.date));
    candidates.push({
      key,
      description: sorted[0].description,
      amount: sorted[0].amount,
      category: sorted[0].category,
      type: sorted[0].type,
      occurrences: sorted,
      monthCount: months.size,
    });
  }

  return candidates.sort((a, b) => b.monthCount - a.monthCount);
}
