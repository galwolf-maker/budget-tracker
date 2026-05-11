/**
 * useInsightFeedback
 *
 * Persists user feedback on insights to localStorage.
 *
 * Three feedback dimensions:
 *  • dismissedIds       — specific insight instance (id) never shown again
 *  • suppressedPatterns — entity_key flagged "not unusual" or "hide similar"
 *  • recurringPatterns  — entity_key confirmed as recurring
 *
 * All state changes emit a [BT-INSIGHTS] debug log.
 */

import { useState, useCallback } from 'react';
import type { InsightFeedbackRecord } from '../utils/insightEngine';
import { EMPTY_FEEDBACK } from '../utils/insightEngine';

const STORAGE_KEY = 'bt-insight-feedback';

function load(): InsightFeedbackRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_FEEDBACK };
    const parsed = JSON.parse(raw) as Partial<InsightFeedbackRecord>;
    return {
      dismissedIds:       parsed.dismissedIds       ?? [],
      suppressedPatterns: parsed.suppressedPatterns ?? [],
      recurringPatterns:  parsed.recurringPatterns  ?? [],
    };
  } catch {
    return { ...EMPTY_FEEDBACK };
  }
}

function save(fb: InsightFeedbackRecord): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fb)); } catch { /* ignore */ }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

export interface InsightFeedbackActions {
  feedback:        InsightFeedbackRecord;
  /** Hide this exact insight instance permanently. */
  dismiss:         (id: string) => void;
  /** Suppress anomaly insights for this merchant+amount pattern forever. */
  notUnusual:      (entityKey: string) => void;
  /** Mark this merchant+amount pattern as recurring — suppresses anomaly. */
  markAsRecurring: (entityKey: string) => void;
  /** Suppress all insights matching this pattern key. */
  hideSimilar:     (entityKey: string) => void;
}

export function useInsightFeedback(): InsightFeedbackActions {
  const [feedback, setFeedback] = useState<InsightFeedbackRecord>(load);

  const update = useCallback(
    (updater: (prev: InsightFeedbackRecord) => InsightFeedbackRecord) => {
      setFeedback(prev => {
        const next = updater(prev);
        save(next);
        return next;
      });
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    console.log(`[BT-INSIGHTS] FEEDBACK dismissed id="${id}"`);
    update(fb => ({ ...fb, dismissedIds: dedupe([...fb.dismissedIds, id]) }));
  }, [update]);

  const notUnusual = useCallback((entityKey: string) => {
    console.log(`[BT-INSIGHTS] FEEDBACK not_unusual entity_key="${entityKey}"`);
    update(fb => ({ ...fb, suppressedPatterns: dedupe([...fb.suppressedPatterns, entityKey]) }));
  }, [update]);

  const markAsRecurring = useCallback((entityKey: string) => {
    console.log(`[BT-INSIGHTS] FEEDBACK mark_recurring entity_key="${entityKey}"`);
    update(fb => ({ ...fb, recurringPatterns: dedupe([...fb.recurringPatterns, entityKey]) }));
  }, [update]);

  const hideSimilar = useCallback((entityKey: string) => {
    console.log(`[BT-INSIGHTS] FEEDBACK hide_similar entity_key="${entityKey}"`);
    update(fb => ({ ...fb, suppressedPatterns: dedupe([...fb.suppressedPatterns, entityKey]) }));
  }, [update]);

  return { feedback, dismiss, notUnusual, markAsRecurring, hideSimilar };
}
