import type { Transaction } from '../types';

function normalizeDesc(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const aN = normalizeDesc(a);
  const bN = normalizeDesc(b);
  if (aN === bN) return 1;
  if (!aN || !bN) return 0;
  if (aN.includes(bN) || bN.includes(aN)) return 0.9;
  const aTokens = aN.split(' ').filter(t => t.length > 1);
  const bSet = new Set(bN.split(' ').filter(t => t.length > 1));
  if (!aTokens.length || !bSet.size) return 0;
  const common = aTokens.filter(t => bSet.has(t)).length;
  return common / Math.max(aTokens.length, bSet.size);
}

export interface DuplicateGroup {
  /** Stable ID: sorted transaction IDs joined by "|" */
  id: string;
  transactions: [Transaction, Transaction]; // [older, newer]
  daysDiff: number;
}

const DAY_MS = 86_400_000;

/**
 * Finds pairs of transactions that look like duplicates:
 * same type & amount, description similarity ≥ 0.6, dates within 10 days.
 * Pairs whose ID is in `ignoredPairs` are skipped.
 */
export function detectDuplicates(
  transactions: Transaction[],
  ignoredPairs: Set<string> = new Set()
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];

      if (a.type !== b.type) continue;
      if (Math.abs(a.amount - b.amount) > 0.01) continue;

      const daysDiff =
        Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime()) / DAY_MS;
      if (daysDiff > 10) continue;

      if (similarity(a.description, b.description) < 0.6) continue;

      const pairKey = [a.id, b.id].sort().join('|');
      if (seen.has(pairKey) || ignoredPairs.has(pairKey)) continue;
      seen.add(pairKey);

      const [first, second] = a.date <= b.date ? [a, b] : [b, a];
      groups.push({
        id: pairKey,
        transactions: [first, second],
        daysDiff: Math.round(daysDiff),
      });
    }
  }

  return groups;
}
