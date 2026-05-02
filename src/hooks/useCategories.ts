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

/** Stable key for deduplication — "expense:food" */
function catKey(c: Category) {
  return `${c.type}:${c.name.toLowerCase().trim()}`;
}

export function useCategories(userId: string | null, householdId: string | null, isGuest = false) {
  const [categories, _set] = useState<Category[]>(() => isGuest ? DEFAULT_CATEGORIES : readLS());

  const setCategories = useCallback(
    (updater: Category[] | ((p: Category[]) => Category[])) => {
      _set((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        // Only persist workspace-specific categories to localStorage
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    []
  );

  useEffect(() => {
    if (isGuest || !userId || !supabase || householdId === null) return;

    (async () => {
      try {
        // Fetch global defaults and workspace-specific categories in parallel
        const [defaultsRes, wsRes] = await Promise.all([
          supabase
            .from('categories')
            .select('*')
            .eq('is_default', true),
          supabase
            .from('categories')
            .select('*')
            .eq('household_id', householdId),
        ]);

        if (wsRes.error) throw wsRes.error;
        if (defaultsRes.error) console.warn('[BT] Could not load default categories:', defaultsRes.error);

        const defaults: Category[] = (defaultsRes.data ?? []).map(rowToCat);
        const wsSpecific: Category[] = (wsRes.data ?? []).map(rowToCat);

        console.log(
          '[BT] Categories — defaults:', defaults.length,
          '| workspace-specific:', wsSpecific.length,
          '| workspace:', householdId
        );

        if (defaults.length === 0 && wsSpecific.length === 0) {
          // DB has no defaults yet (migration not run) — fall back to frontend constant
          console.warn('[BT] No categories in DB; using frontend DEFAULT_CATEGORIES. Run the SQL migration.');
          setCategories(DEFAULT_CATEGORIES);
          return;
        }

        // Merge: workspace-specific categories take precedence over defaults with the
        // same name + type, so the user can effectively "override" a default per workspace.
        const wsKeys = new Set(wsSpecific.map(catKey));
        const filteredDefaults = defaults.filter((c) => !wsKeys.has(catKey(c)));

        // Sort: defaults first (alphabetical within type), then workspace-specific
        const sorted = [
          ...filteredDefaults.sort((a, b) => a.name.localeCompare(b.name)),
          ...wsSpecific.sort((a, b) => a.name.localeCompare(b.name)),
        ];

        setCategories(sorted);
      } catch (err) {
        console.error('[BT] Category load failed — using localStorage cache:', err);
      }
    })();
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guest mode: clear to defaults if isGuest changes to true
  useEffect(() => {
    if (isGuest) _set(DEFAULT_CATEGORIES);
  }, [isGuest]);

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
      // Hard guard: never delete global defaults, even if called programmatically
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      if (cat.isDefault) {
        console.warn('[BT] Attempted to delete a default category — blocked.');
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('household_id', householdId); // RLS guard
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
