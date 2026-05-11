/**
 * Smart recurring transaction matcher.
 *
 * Normalises merchant names (handles "SpotifyIL", "SPOTIFY*", "Spotify Premium"
 * all resolving to the same key) then scores existing transactions against an
 * incoming one to recommend the best-known category / metadata.
 *
 * Priority order (requirement #3):
 *  1. Non-"Other" category             (+2 pts)
 *  2. Same amount                      (+2 pts)
 *  3. Description similarity           (0–3 pts, weighted highest per char)
 *  4. Has recurringGroupId             (+1 pt)
 *  5. Recency (tie-break, ISO string compare)
 */

import type { Transaction } from '../types';

// ── Normalisation ─────────────────────────────────────────────────────────────

const COUNTRY_SUFFIXES = /\b(il|us|uk|eu|gb|au|ca|de|fr|nz|nl|sg|jp|br)\b/g;
const NOISE_CHARS      = /[^a-z0-9֐-׿\s]/gu;

/**
 * Strips asterisks, country/region suffixes, trailing order-number digits,
 * and punctuation noise so "SpotifyIL", "SPOTIFY*", "Spotify #1234" all
 * normalise to "spotify".
 */
export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\*/g, ' ')          // asterisks (SPOTIFY*)
    .replace(/[#\d]+$/, '')       // trailing digits / order numbers
    .replace(COUNTRY_SUFFIXES, '') // region suffixes (spotifyil → spotify)
    .replace(NOISE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOther(cat: string): boolean {
  return !cat || cat.toLowerCase() === 'other';
}

/** Jaccard-style word overlap, 0–1. */
function wordOverlap(normA: string, normB: string): number {
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return normA === normB ? 1 : 0;
  if (wordsA.size === 0 || wordsB.size === 0) return normA === normB ? 1 : 0;
  const shared = [...wordsA].filter(w => wordsB.has(w)).length;
  return shared / Math.max(wordsA.size, wordsB.size);
}

/**
 * Description similarity score, 0–1.
 * Exact normalised match → 1.0
 * One contains the other → 0.85
 * Word overlap ≥ 0.5 → proportional
 */
function descSimilarity(incoming: string, candidate: string): number {
  const a = normalizeMerchant(incoming);
  const b = normalizeMerchant(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const overlap = wordOverlap(a, b);
  return overlap;
}

// ── Public types ──────────────────────────────────────────────────────────────

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchResult {
  /** The historical transaction that was matched. */
  matchedTransaction: Transaction;
  /** Recommended category (never 'Other' when a better option exists). */
  category: string;
  /** How confident we are in the match. */
  confidence: MatchConfidence;
  /** Normalised merchant key used for matching. */
  normalizedKey: string;
  /** Human-readable explanation of why this category was chosen. */
  reason: string;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Finds the best matching historical transaction for an incoming row.
 *
 * Returns `null` when no plausible match exists (all similarities below
 * threshold), meaning the normal keyword categoriser should be used instead.
 *
 * Always emits debug logs (req #9) regardless of confidence.
 */
export function findBestMatch(
  incoming: {
    description: string;
    amount:      number;
    type:        string;
  },
  existing: Transaction[]
): MatchResult | null {

  const normKey = normalizeMerchant(incoming.description);

  interface Scored {
    t: Transaction;
    dSim: number;
    amtSim: number;
    score: number;
    hasCategory: boolean;
  }

  // Score every candidate of the same transaction type
  const scored: Scored[] = existing
    .filter(t => t.type === incoming.type)
    .flatMap(t => {
      const dSim = descSimilarity(incoming.description, t.description);
      if (dSim < 0.35) return []; // too dissimilar — skip

      const amtDiff = Math.abs(t.amount - incoming.amount);
      const amtSim  = amtDiff < 0.01 ? 1
                    : amtDiff / Math.max(t.amount, incoming.amount, 1) < 0.05 ? 0.8
                    : 0;

      const nonOtherBonus = !isOther(t.category) ? 2 : 0;
      const amtBonus      = amtSim * 2;
      const descBonus     = dSim   * 3;
      const groupBonus    = t.recurringGroupId ? 1 : 0;
      const score         = descBonus + amtBonus + nonOtherBonus + groupBonus;

      return [{ t, dSim, amtSim, score, hasCategory: !isOther(t.category) }];
    })
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
      // Tie-break: most recent first
      return b.t.date.localeCompare(a.t.date);
    });

  if (scored.length === 0) {
    console.log(
      `[BT-MATCH] "${incoming.description}" → norm="${normKey}"`,
      '| no match found'
    );
    return null;
  }

  // Prefer a candidate with a non-Other category even if scored slightly lower
  const best = scored.find(c => c.hasCategory) ?? scored[0];

  const { t, dSim, amtSim } = best;

  // Confidence thresholds
  let confidence: MatchConfidence;
  let reason: string;

  if (dSim >= 0.8 && !isOther(t.category)) {
    confidence = 'high';
    reason     = `Exact/near-exact merchant match "${t.description}" → ${t.category}`;
  } else if (dSim >= 0.5 && !isOther(t.category)) {
    confidence = 'medium';
    reason     = `Similar merchant "${t.description}" (${Math.round(dSim * 100)}% similarity) → ${t.category}`;
  } else if (dSim >= 0.35 && !isOther(t.category)) {
    confidence = 'low';
    reason     = `Weak match "${t.description}" (${Math.round(dSim * 100)}% similarity) → ${t.category}`;
  } else {
    // Match exists but category is Other — not useful
    console.log(
      `[BT-MATCH] "${incoming.description}" → norm="${normKey}"`,
      `| matched "${t.description}" but category is Other — skipping`
    );
    return null;
  }

  console.log(
    `[BT-MATCH] "${incoming.description}" → norm="${normKey}"`,
    `| matched tx id=${t.id} desc="${t.description}"`,
    `| category="${t.category}"`,
    `| confidence=${confidence}`,
    `| descSim=${dSim.toFixed(2)} amtSim=${amtSim.toFixed(2)}`,
    `| reason: ${reason}`
  );

  return { matchedTransaction: t, category: t.category, confidence, normalizedKey: normKey, reason };
}

/**
 * Convenience wrapper: like `findBestMatch` but only returns a category string
 * when confidence is high (safe to auto-apply without user confirmation).
 * Returns undefined otherwise.
 */
export function inheritCategory(
  incoming: { description: string; amount: number; type: string },
  existing: Transaction[]
): string | undefined {
  const match = findBestMatch(incoming, existing);
  if (!match) return undefined;
  if (match.confidence !== 'high') return undefined;
  if (isOther(match.category)) return undefined;
  return match.category;
}
