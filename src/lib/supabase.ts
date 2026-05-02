import { createClient } from '@supabase/supabase-js';
import type { Transaction, Category } from '../types';

console.log('ENV:', import.meta.env);

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseClient = null;
try {
  if (url && key) {
    supabaseClient = createClient(url, key);
  }
} catch (err) {
  console.error('[BT] Failed to initialize Supabase client:', err);
}

export const supabase = supabaseClient;
export const isSupabaseConfigured = !!supabase;

console.log('[BT] Supabase:', isSupabaseConfigured
  ? `configured ✓ (${url})`
  : 'NOT configured — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars');

// ── DB row shapes (snake_case) ────────────────────────────────────────────────

export interface TxnRow {
  id: string;
  user_id: string;
  household_id: string | null;
  created_by: string | null;
  type: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  is_recurring: boolean;
  created_at: string;
}

export interface CatRow {
  id: string;
  user_id: string | null; // NULL for global defaults
  household_id: string | null;
  name: string;
  type: string;
  is_custom: boolean;
  is_default: boolean;
}

export interface HouseholdRow {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  created_by: string;
  created_at: string;
}

export interface HouseholdMemberRow {
  household_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
}

export interface InvitationRow {
  id: string;
  household_id: string;
  invited_email: string;
  invited_by: string;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

export function rowToTxn(r: TxnRow): Transaction {
  return {
    id:          r.id,
    type:        r.type as Transaction['type'],
    amount:      Number(r.amount),
    category:    r.category,
    date:        r.date,
    description: r.description,
    isRecurring: r.is_recurring,
    createdBy:   r.created_by ?? undefined,
    createdAt:   r.created_at,
  };
}

export function txnToRow(
  userId: string,
  t: Transaction,
  householdId: string | null = null
): TxnRow {
  return {
    id:           t.id,
    user_id:      userId,
    household_id: householdId,
    created_by:   userId,
    type:         t.type,
    amount:       t.amount,
    category:     t.category,
    date:         t.date,
    description:  t.description,
    is_recurring: t.isRecurring ?? false,
    created_at:   t.createdAt,
  };
}

export function rowToCat(r: CatRow): Category {
  return {
    id:        r.id,
    name:      r.name,
    type:      r.type as Category['type'],
    isCustom:  r.is_custom,
    isDefault: r.is_default ?? false,
  };
}

export function catToRow(
  userId: string,
  c: Category,
  householdId: string | null = null
): CatRow {
  return {
    id:           c.id,
    user_id:      userId,
    household_id: householdId,
    name:         c.name,
    type:         c.type,
    is_custom:    c.isCustom,
  };
}
