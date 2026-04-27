import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HouseholdMember } from '../types';
import type { HouseholdMemberRow } from '../lib/supabase';

export interface UseHouseholdReturn {
  householdId: string | null;
  householdName: string;
  members: HouseholdMember[];
  householdLoading: boolean;
  inviteUser: (email: string) => Promise<{ link: string } | { error: string }>;
  acceptInvite: (token: string) => Promise<string | null>;
}

function rowToMember(r: HouseholdMemberRow): HouseholdMember {
  return {
    userId:   r.user_id,
    email:    r.profiles?.email ?? 'Unknown',
    fullName: r.profiles?.full_name ?? undefined,
    role:     r.role as HouseholdMember['role'],
    joinedAt: r.joined_at,
  };
}

export function useHousehold(
  userId: string | null,
  userEmail: string | null
): UseHouseholdReturn {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState('My Household');
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  // Start as loading immediately when we have a userId — prevents mutations
  // from firing before householdId is known.
  const [householdLoading, setHouseholdLoading] = useState(!!userId && !!supabase);

  const loadMembers = useCallback(async (hhId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('household_members')
      .select('*, profiles(email, full_name)')
      .eq('household_id', hhId);
    if (error) console.error('[BT] loadMembers error:', error);
    if (data) setMembers(data.map(rowToMember));
  }, []);

  useEffect(() => {
    if (!userId || !supabase) {
      setHouseholdLoading(false);
      return;
    }

    setHouseholdLoading(true);
    console.log('[BT] useHousehold: resolving household for user', userId);

    (async () => {
      try {
        // Upsert profile so other members can see our email
        if (userEmail) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
          if (profileErr) console.error('[BT] Profile upsert error:', profileErr);
        }

        // Check existing membership
        const { data: membership, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id, households(name)')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (memberErr) console.error('[BT] Membership query error:', memberErr);

        if (membership) {
          const hhId = membership.household_id;
          const hhName = (membership.households as unknown as { name: string } | null)?.name ?? 'My Household';
          console.log('[BT] Found existing household:', hhId);
          setHouseholdId(hhId);
          setHouseholdName(hhName);
          await loadMembers(hhId);
        } else {
          console.log('[BT] No household found — creating one');
          const { data: hh, error: hhErr } = await supabase
            .from('households')
            .insert({ created_by: userId })
            .select()
            .single();

          if (hhErr || !hh) {
            console.error('[BT] Failed to create household:', hhErr);
            return;
          }

          const { error: memberInsertErr } = await supabase
            .from('household_members')
            .insert({ household_id: hh.id, user_id: userId, role: 'owner' });
          if (memberInsertErr) console.error('[BT] household_members insert error:', memberInsertErr);

          // Backfill existing transactions and categories
          const { error: txBackfillErr } = await supabase
            .from('transactions')
            .update({ household_id: hh.id, created_by: userId })
            .eq('user_id', userId)
            .is('household_id', null);
          if (txBackfillErr) console.error('[BT] Transaction backfill error:', txBackfillErr);

          const { error: catBackfillErr } = await supabase
            .from('categories')
            .update({ household_id: hh.id })
            .eq('user_id', userId)
            .is('household_id', null);
          if (catBackfillErr) console.error('[BT] Category backfill error:', catBackfillErr);

          console.log('[BT] Household created:', hh.id);
          setHouseholdId(hh.id);
          setHouseholdName(hh.name);
          await loadMembers(hh.id);
        }
      } catch (err) {
        console.error('[BT] useHousehold unexpected error:', err);
      } finally {
        setHouseholdLoading(false);
      }
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const inviteUser = useCallback(
    async (email: string): Promise<{ link: string } | { error: string }> => {
      if (!supabase || !householdId || !userId) return { error: 'Not ready' };

      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('household_id', householdId)
        .eq('invited_email', email)
        .eq('status', 'pending');

      const { data, error } = await supabase
        .from('invitations')
        .insert({ household_id: householdId, invited_email: email, invited_by: userId })
        .select()
        .single();

      if (error || !data) return { error: error?.message ?? 'Failed to create invitation' };

      const link = `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
      return { link };
    },
    [householdId, userId]
  );

  const acceptInvite = useCallback(
    async (token: string): Promise<string | null> => {
      if (!supabase) return 'Supabase not configured';

      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (error) return error.message;
      if (data?.error) return data.error as string;

      const newHouseholdId = data?.household_id as string;
      console.log('[BT] Joined household:', newHouseholdId);
      setHouseholdId(newHouseholdId);
      await loadMembers(newHouseholdId);
      return null;
    },
    [loadMembers]
  );

  return { householdId, householdName, members, householdLoading, inviteUser, acceptInvite };
}
