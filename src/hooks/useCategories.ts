import { useCallback, useEffect, useState } from 'react';
import { supabase, rowToCat, catToRow } from '../lib/supabase';
import { DEFAULT_CATEGORIES } from '../constants/categories';
import type { Category, TransactionType } from '../types';

const LS_KEY = 'bt-categories';

function readLS(): Category[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? (JSON.parse(s) as Category[]) : DEFAULT_CATEGORIES;
  } catch { return DEFAULT_CATEGORIES; }
}

/** Stable dedup key — "expense:food" */
function catKey(c: Category) {
  return `${c.type}:${c.name.toLowerCase().trim()}`;
}

/**
 * Merge strategy:
 *   1. Start with all global DEFAULT_CATEGORIES (isDefault = true).
 *   2. Layer workspace-specific DB categories on top.
 *   3. Workspace category with same type+name as a default hides the default
 *      (the user has effectively overridden it for this workspace).
 */
function mergeCategories(wsSpecific: Category[]): Category[] {
  const wsKeys = new Set(wsSpecific.map(catKey));
  const visibleDefaults = DEFAULT_CATEGORIES.filter((c) => !wsKeys.has(catKey(c)));
  return [
    ...visibleDefaults,
    ...wsSpecific.sort((a, b) => a.name.localeCompare(b.name)),
  ];
}

export function useCategories(userId: string | null, householdId: string | null, isGuest = false) {
  const [categories, _set] = useState<Category[]>(() =>
    isGuest ? DEFAULT_CATEGORIES : mergeCategories(readLS().filter((c) => c.isCustom))
  );

  const setCategories = useCallback(
    (updater: Category[] | ((p: Category[]) => Category[])) => {
      _set((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // Only persist workspace-specific (custom) categories to localStorage
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(next.filter((c) => c.isCustom)));
        } catch {}
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (isGuest) { _set(DEFAULT_CATEGORIES); return; }
  }, [isGuest]);

  useEffect(() => {
    if (isGuest || !userId || !supabase || householdId === null) return;

    (async () => {
      try {
        // Only fetch workspace-specific categories from the DB.
        // Global defaults come from the frontend constant — no DB column needed.
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('household_id', householdId);

        if (error) throw error;

        const wsSpecific = (data ?? []).map(rowToCat);
        console.log(
          '[BT] Categories — workspace-specific:', wsSpecific.length,
          '| defaults from constant:', DEFAULT_CATEGORIES.length,
          '| workspace:', householdId
        );

        setCategories(mergeCategories(wsSpecific));
      } catch (err) {
        console.error('[BT] Category load failed — using cached + defaults:', err);
      }
    })();
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCategory = useCallback(
    async (name: string, type: TransactionType) => {
      const cat: Category = {
        id: `custom-${Date.now()}`,
        name,
        type,
        isCustom: true,
        isDefault: false,
      };
      setCategories((prev) => [...prev, cat]);
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('categories')
          .insert(catToRow(userId, cat, householdId));
        if (error) console.error('[BT] Category insert failed:', error);
      }
    },
    [userId, householdId, setCategories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat || cat.isDefault) return; // global defaults are never deleted

      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('household_id', householdId);
        if (error) console.error('[BT] Category delete failed:', error);
      }
    },
    [userId, householdId, categories, setCategories]
  );

  const getCategoriesForType = useCallback(
    (type: TransactionType) => categories.filter((c) => c.type === type),
    [categories]
  );

  return { categories, addCategory, deleteCategory, getCategoriesForType };
}
