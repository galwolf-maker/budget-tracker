import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, rowToTxn, txnToRow } from '../lib/supabase';
import { getTodayString } from '../utils/formatters';
import type {
  Transaction,
  TransactionFilters,
  SummaryData,
  MonthlyDataPoint,
  CategoryDataPoint,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const LS_KEY = 'bt-transactions';

function readLS(): Transaction[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? (JSON.parse(s) as Transaction[]) : [];
  } catch { return []; }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTransactions(userId: string | null, householdId: string | null, isGuest = false) {
  // In guest mode: start empty — never read localStorage, never touch Supabase
  const [transactions, _set] = useState<Transaction[]>(() => isGuest ? [] : readLS());
  const [syncing, setSyncing] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(isGuest || !userId || !supabase);

  // Clear real state if guest mode is entered after mount
  useEffect(() => {
    if (isGuest) _set([]);
  }, [isGuest]);
  const [recurringAutoAdded, setRecurringAutoAdded] = useState(0);

  const setTransactions = useCallback(
    (updater: Transaction[] | ((p: Transaction[]) => Transaction[])) => {
      _set((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    },
    []
  );

  const lsSnapshotRef = useRef(readLS());

  // ── Load from / migrate to Supabase ─────────────────────────────────────────
  useEffect(() => {
    if (isGuest || !userId || !supabase) {
      setDataLoaded(true);
      return;
    }
    // Wait until householdId is resolved before loading
    if (householdId === null) return;

    const migKey = `bt-migrated-${userId}`;
    setSyncing(true);

    (async () => {
      try {
        console.log('[BT] Loading transactions from Supabase (household:', householdId, ')');
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('household_id', householdId)
          .order('date', { ascending: false });

        if (error) throw error;

        let rows = data ?? [];
        console.log('[BT] Supabase returned', rows.length, 'transactions');

        // First-login migration: upload localStorage data
        if (rows.length === 0 && !localStorage.getItem(migKey)) {
          const local = lsSnapshotRef.current;
          if (local.length > 0) {
            console.log('[BT] Migrating', local.length, 'transactions from localStorage to Supabase');
            const { error: upErr } = await supabase
              .from('transactions')
              .insert(local.map((t) => txnToRow(userId, t, householdId)));

            if (upErr) {
              console.error('[BT] Migration upload failed:', upErr);
            } else {
              const { data: fresh } = await supabase
                .from('transactions')
                .select('*')
                .eq('household_id', householdId)
                .order('date', { ascending: false });
              rows = fresh ?? [];
              console.log('[BT] Migration complete —', rows.length, 'transactions in Supabase');
            }
          }
          localStorage.setItem(migKey, 'true');
        }

        setTransactions(rows.map(rowToTxn));
      } catch (err) {
        console.error('[BT] Supabase load failed — using localStorage cache:', err);
      } finally {
        setSyncing(false);
        setDataLoaded(true);
      }
    })();
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (isGuest || !userId || !supabase || !householdId) return;
    const sb = supabase;

    const channel = sb
      .channel(`transactions:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${householdId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = rowToTxn(payload.new as Parameters<typeof rowToTxn>[0]);
            setTransactions((prev) => {
              if (prev.some((t) => t.id === incoming.id)) return prev;
              return [incoming, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = rowToTxn(payload.new as Parameters<typeof rowToTxn>[0]);
            setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setTransactions((prev) => prev.filter((t) => t.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [userId, householdId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addTransaction = useCallback(
    async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      const tx: Transaction = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        createdBy: userId ?? undefined,
      };
      setTransactions((prev) => [tx, ...prev]);
      if (userId && supabase && householdId) {
        console.log('[BT] Saving transaction to Supabase:', tx.id);
        const { error } = await supabase.from('transactions').insert(txnToRow(userId, tx, householdId));
        if (error) console.error('[BT] Supabase insert failed:', error);
        else console.log('[BT] Transaction saved ✓');
      } else {
        console.warn('[BT] Supabase save SKIPPED — userId:', userId, 'householdId:', householdId, 'supabase:', !!supabase);
      }
    },
    [userId, householdId, setTransactions]
  );

  const updateTransaction = useCallback(
    async (id: string, data: Omit<Transaction, 'id' | 'createdAt'>) => {
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('transactions')
          .update({
            type:         data.type,
            amount:       data.amount,
            category:     data.category,
            date:         data.date,
            description:  data.description,
            is_recurring: data.isRecurring ?? false,
          })
          .eq('id', id)
          .eq('household_id', householdId);
        if (error) console.error('[BT] Supabase update failed:', error);
        else console.log('[BT] Transaction updated ✓', id);
      } else {
        console.warn('[BT] Update SKIPPED — userId:', userId, 'householdId:', householdId);
      }
    },
    [userId, householdId, setTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('household_id', householdId);
        if (error) console.error('[BT] Supabase delete failed:', error);
        else console.log('[BT] Transaction deleted ✓', id);
      } else {
        console.warn('[BT] Delete SKIPPED — userId:', userId, 'householdId:', householdId);
      }
    },
    [userId, householdId, setTransactions]
  );

  const importTransactions = useCallback(
    async (rows: Omit<Transaction, 'id' | 'createdAt'>[]) => {
      const newTxs: Transaction[] = rows.map((row) => ({
        ...row,
        id: generateId(),
        createdAt: new Date().toISOString(),
        createdBy: userId ?? undefined,
      }));
      setTransactions((prev) => [...newTxs, ...prev]);
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('transactions')
          .insert(newTxs.map((t) => txnToRow(userId, t, householdId)));
        if (error) console.error('Supabase import failed:', error);
      }
    },
    [userId, householdId, setTransactions]
  );

  const markRecurring = useCallback(
    async (id: string, flag: boolean) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isRecurring: flag } : t))
      );
      if (userId && supabase && householdId) {
        const { error } = await supabase
          .from('transactions')
          .update({ is_recurring: flag })
          .eq('id', id)
          .eq('household_id', householdId);
        if (error) console.error('Supabase markRecurring failed:', error);
      }
    },
    [userId, householdId, setTransactions]
  );

  const clearRecurringAutoAdded = useCallback(() => setRecurringAutoAdded(0), []);

  // ── Auto-add recurring transactions once per calendar month ──────────────────
  const autoApplied = useRef(false);
  const txnsRef = useRef(transactions);
  txnsRef.current = transactions;

  useEffect(() => {
    if (!dataLoaded || autoApplied.current || isGuest) return;
    autoApplied.current = true;

    const month = currentYearMonth();
    if (localStorage.getItem('bt-recurring-applied') === month) return;

    const allTxns = txnsRef.current;
    const recurring = allTxns.filter((t) => t.isRecurring);

    localStorage.setItem('bt-recurring-applied', month);
    if (recurring.length === 0) return;

    const today = getTodayString();
    const toAdd: Transaction[] = [];
    const seen = new Set<string>();

    for (const t of recurring) {
      const key = `${t.description.trim().toLowerCase()}|${t.amount}|${t.type}|${t.category}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const already = allTxns.some(
        (tx) =>
          tx.date.startsWith(month) &&
          tx.description.trim().toLowerCase() === t.description.trim().toLowerCase() &&
          Math.abs(tx.amount - t.amount) < 0.01
      );
      if (!already) {
        toAdd.push({
          ...t,
          id: generateId(),
          date: today,
          createdAt: new Date().toISOString(),
          createdBy: userId ?? undefined,
        });
      }
    }

    if (toAdd.length === 0) return;

    setTransactions((prev) => [...toAdd, ...prev]);
    setRecurringAutoAdded(toAdd.length);

    if (userId && supabase && householdId) {
      supabase
        .from('transactions')
        .insert(toAdd.map((t) => txnToRow(userId, t, householdId)))
        .then(({ error }) => {
          if (error) console.error('Supabase recurring insert failed:', error);
        });
    }
  }, [dataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ─────────────────────────────────────────────────────────────

  const summary = useMemo((): SummaryData => {
    const month = currentYearMonth();
    let totalIncome = 0, totalExpenses = 0, thisMonthSpending = 0, thisMonthIncome = 0;
    for (const t of transactions) {
      if (t.type === 'income') {
        totalIncome += t.amount;
        if (t.date.startsWith(month)) thisMonthIncome += t.amount;
      } else {
        totalExpenses += t.amount;
        if (t.date.startsWith(month)) thisMonthSpending += t.amount;
      }
    }
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, thisMonthSpending, thisMonthIncome };
  }, [transactions]);

  const expensesByCategory = useMemo((): CategoryDataPoint[] => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === 'expense') map[t.category] = (map[t.category] ?? 0) + t.amount;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyData = useMemo((): MonthlyDataPoint[] => {
    const map: Record<string, { income: number; expenses: number }> = {};
    for (const t of transactions) {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { income: 0, expenses: 0 };
      if (t.type === 'income') map[m].income += t.amount;
      else map[m].expenses += t.amount;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month,
        label: new Date(month + '-02').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        ...data,
      }));
  }, [transactions]);

  const getFilteredTransactions = useCallback(
    (filters: TransactionFilters): Transaction[] => {
      return transactions
        .filter((t) => {
          if (filters.type !== 'all' && t.type !== filters.type) return false;
          if (filters.category && t.category !== filters.category) return false;
          if (filters.month && filters.month !== 'all' && !t.date.startsWith(filters.month)) return false;
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (
              !t.description.toLowerCase().includes(q) &&
              !t.category.toLowerCase().includes(q) &&
              !t.amount.toString().includes(q)
            ) return false;
          }
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime() ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    },
    [transactions]
  );

  return {
    transactions,
    syncing,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    markRecurring,
    recurringAutoAdded,
    clearRecurringAutoAdded,
    getFilteredTransactions,
    summary,
    expensesByCategory,
    monthlyData,
  };
}
