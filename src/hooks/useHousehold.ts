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
  const [householdLoading, setHouseholdLoading] = useState(false);

  const loadMembers = useCallback(async (hhId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('household_members')
      .select('*, profiles(email, full_name)')
      .eq('household_id', hhId);
    if (data) setMembers(data.map(rowToMember));
  }, []);

  useEffect(() => {
    if (!userId || !supabase) return;

    setHouseholdLoading(true);

    (async () => {
      // Upsert profile so other members can see our email
      if (userEmail) {
        await supabase
          .from('profiles')
          .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
      }

      // Check existing membership
      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id, households(name)')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (membership) {
        const hhId = membership.household_id;
        const hhName = (membership.households as unknown as { name: string } | null)?.name ?? 'My Household';
        setHouseholdId(hhId);
        setHouseholdName(hhName);
        await loadMembers(hhId);
      } else {
        // First login — create a household
        const { data: hh, error } = await supabase
          .from('households')
          .insert({ created_by: userId })
          .select()
          .single();

        if (hh && !error) {
          await supabase
            .from('household_members')
            .insert({ household_id: hh.id, user_id: userId, role: 'owner' });

          // Backfill existing transactions and categories
          await supabase
            .from('transactions')
            .update({ household_id: hh.id, created_by: userId })
            .eq('user_id', userId)
            .is('household_id', null);

          await supabase
            .from('categories')
            .update({ household_id: hh.id })
            .eq('user_id', userId)
            .is('household_id', null);

          setHouseholdId(hh.id);
          setHouseholdName(hh.name);
          await loadMembers(hh.id);
        } else {
          console.error('Failed to create household:', error);
        }
      }

      setHouseholdLoading(false);
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const inviteUser = useCallback(
    async (email: string): Promise<{ link: string } | { error: string }> => {
      if (!supabase || !householdId || !userId) return { error: 'Not ready' };

      // Expire any existing pending invites for this email in this household
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
      setHouseholdId(newHouseholdId);
      await loadMembers(newHouseholdId);
      return null;
    },
    [loadMembers]
  );

  return { householdId, householdName, members, householdLoading, inviteUser, acceptInvite };
}
