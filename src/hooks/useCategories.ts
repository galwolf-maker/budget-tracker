import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useCategories(userId: string | null, householdId: string | null) {
  const [categories, _set] = useState<Category[]>(readLS);

  const setCategories = useCallback(
    (updater: Category[] | ((p: Category[]) => Category[])) => {
      _set((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    []
  );

  const lsSnapshotRef = useRef(readLS());

  useEffect(() => {
    if (!userId || !supabase) return;
    if (householdId === null) return;

    const migKey = `bt-cat-migrated-${userId}`;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('household_id', householdId);

        if (error) throw error;

        let rows = data ?? [];

        if (rows.length === 0 && !localStorage.getItem(migKey)) {
          const local = lsSnapshotRef.current;
          const seed = local.length > 0 ? local : DEFAULT_CATEGORIES;
          const { error: upErr } = await supabase
            .from('categories')
            .insert(seed.map((c) => catToRow(userId, c, householdId)));

          if (upErr) {
            console.error('Category migration failed:', upErr);
          } else {
            const { data: fresh } = await supabase
              .from('categories')
              .select('*')
              .eq('household_id', householdId);
            rows = fresh ?? [];
          }
          localStorage.setItem(migKey, 'true');
        }

        if (rows.length > 0) {
          setCategories(rows.map(rowToCat));
        }
      } catch (err) {
        console.error('Category load failed — using localStorage cache:', err);
      }
    })();
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCategory = useCallback(
    async (name: string, type: TransactionType) => {
      const cat: Category = { id: `custom-${Date.now()}`, name, type, isCustom: true };
      setCategories((prev) => [...prev, cat]);
      if (userId && supabase && householdId) {
        const { error } = await supabase.from('categories').insert(catToRow(userId, cat, householdId));
        if (error) console.error('Supabase category insert failed:', error);
      }
    },
    [userId, householdId, setCategories]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('household_id', householdId);
        if (error) console.error('Supabase category delete failed:', error);
      }
    },
    [userId, householdId, setCategories]
  );

  const getCategoriesForType = useCallback(
    (type: TransactionType) => categories.filter((c) => c.type === type),
    [categories]
  );

  return { categories, addCategory, deleteCategory, getCategoriesForType };
}
