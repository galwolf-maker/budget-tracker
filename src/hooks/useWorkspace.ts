import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { HouseholdMember, Workspace } from '../types';

export interface UseWorkspaceReturn {
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: HouseholdMember[];
  workspaceLoading: boolean;
  setActiveWorkspaceId: (id: string) => void;
  inviteUser: (email: string) => Promise<{ link: string } | { error: string }>;
  acceptInvite: (token: string) => Promise<string | null>;
  createSharedWorkspace: (name: string) => Promise<string | null>;
}

function lsKey(userId: string) {
  return `bt-active-workspace-${userId}`;
}

export function useWorkspace(
  userId: string | null,
  userEmail: string | null
): UseWorkspaceReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(!!userId && !!supabase);
  const [activeWorkspaceId, _setActiveWorkspaceId] = useState<string | null>(() =>
    userId ? (localStorage.getItem(lsKey(userId)) ?? null) : null
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const loadMembers = useCallback(async (wsId: string) => {
    if (!supabase) return;
    const { data: memberRows, error } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', wsId);
    if (error) { console.error('[BT] loadMembers error:', error); return; }
    if (!memberRows?.length) { setMembers([]); return; }

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', memberRows.map((r) => r.user_id));

    const profileMap = Object.fromEntries((profileRows ?? []).map((p) => [p.id, p]));
    setMembers(
      memberRows.map((r) => ({
        userId:   r.user_id,
        email:    profileMap[r.user_id]?.email ?? 'Unknown',
        fullName: profileMap[r.user_id]?.full_name ?? undefined,
        role:     r.role as HouseholdMember['role'],
        joinedAt: r.joined_at,
      }))
    );
  }, []);

  const persistActive = useCallback(
    (id: string) => {
      _setActiveWorkspaceId(id);
      if (userId) localStorage.setItem(lsKey(userId), id);
    },
    [userId]
  );

  useEffect(() => {
    if (!userId || !supabase) {
      setWorkspaceLoading(false);
      return;
    }

    setWorkspaceLoading(true);
    console.log('[BT] useWorkspace: resolving workspaces for user', userId);

    (async () => {
      try {
        if (userEmail) {
          await supabase
            .from('profiles')
            .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
        }

        // Fetch all workspaces the user belongs to
        const { data: memberRows, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id, households(id, name, type, created_by)')
          .eq('user_id', userId);

        if (memberErr) console.error('[BT] workspace member query error:', memberErr);

        const fetched: Workspace[] = ((memberRows ?? []) as Array<{
          household_id: string;
          households: { id: string; name: string; type: string | null; created_by: string } | null;
        }>)
          .map((r) => {
            const hh = r.households;
            if (!hh) return null;
            return {
              id:          hh.id,
              name:        hh.name,
              type:        (hh.type ?? 'shared') as 'personal' | 'shared',
              memberCount: 1,
            };
          })
          .filter(Boolean) as Workspace[];

        // Ensure personal workspace exists
        let personalWs = fetched.find((w) => w.type === 'personal');
        if (!personalWs) {
          console.log('[BT] No personal workspace — creating one');
          const { data: hh, error: hhErr } = await supabase
            .from('households')
            .insert({ created_by: userId, name: 'Personal', type: 'personal' })
            .select()
            .single();

          if (hhErr || !hh) {
            console.error('[BT] Failed to create personal workspace:', hhErr);
          } else {
            await supabase
              .from('household_members')
              .insert({ household_id: hh.id, user_id: userId, role: 'owner' });

            // Backfill transactions and categories that have no workspace yet
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

            personalWs = { id: hh.id, name: 'Personal', type: 'personal', memberCount: 1 };
            fetched.unshift(personalWs);
            console.log('[BT] Personal workspace created:', hh.id);
          }
        }

        // Sort: personal first, then shared alphabetically
        fetched.sort((a, b) => {
          if (a.type === 'personal') return -1;
          if (b.type === 'personal') return 1;
          return a.name.localeCompare(b.name);
        });

        // Get member counts for shared workspaces
        const sharedIds = fetched.filter((w) => w.type === 'shared').map((w) => w.id);
        if (sharedIds.length > 0) {
          const { data: countRows } = await supabase
            .from('household_members')
            .select('household_id')
            .in('household_id', sharedIds);
          const counts: Record<string, number> = {};
          (countRows ?? []).forEach((r: { household_id: string }) => {
            counts[r.household_id] = (counts[r.household_id] ?? 0) + 1;
          });
          fetched.forEach((w) => {
            if (w.type === 'shared') w.memberCount = counts[w.id] ?? 1;
          });
        }

        setWorkspaces(fetched);

        // Resolve active workspace: saved preference → personal → first available
        const savedId = localStorage.getItem(lsKey(userId));
        const validSaved = savedId && fetched.some((w) => w.id === savedId);
        const targetId = validSaved ? savedId : (personalWs?.id ?? fetched[0]?.id ?? null);

        if (targetId) {
          _setActiveWorkspaceId(targetId);
          localStorage.setItem(lsKey(userId), targetId);
          await loadMembers(targetId);
        }
      } catch (err) {
        console.error('[BT] useWorkspace unexpected error:', err);
      } finally {
        setWorkspaceLoading(false);
      }
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload members when active workspace changes (after initial load)
  useEffect(() => {
    if (activeWorkspaceId && workspaces.length > 0) {
      loadMembers(activeWorkspaceId);
    }
  }, [activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveWorkspaceId = useCallback(
    (id: string) => persistActive(id),
    [persistActive]
  );

  const inviteUser = useCallback(
    async (email: string): Promise<{ link: string } | { error: string }> => {
      if (!supabase || !activeWorkspaceId || !userId) return { error: 'Not ready' };

      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('household_id', activeWorkspaceId)
        .eq('invited_email', email)
        .eq('status', 'pending');

      const { data, error } = await supabase
        .from('invitations')
        .insert({ household_id: activeWorkspaceId, invited_email: email, invited_by: userId })
        .select()
        .single();

      if (error || !data) return { error: error?.message ?? 'Failed to create invitation' };
      const link = `${window.location.origin}${window.location.pathname}?invite=${data.token}`;
      return { link };
    },
    [activeWorkspaceId, userId]
  );

  const acceptInvite = useCallback(
    async (token: string): Promise<string | null> => {
      if (!supabase) return 'Supabase not configured';

      const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
      if (error) return error.message;
      if (data?.error) return data.error as string;

      const newId = data?.household_id as string;
      console.log('[BT] Joined workspace:', newId);
      setWorkspaces((prev) => {
        if (prev.some((w) => w.id === newId)) return prev;
        return [...prev, { id: newId, name: 'Shared workspace', type: 'shared', memberCount: 1 }];
      });
      persistActive(newId);
      await loadMembers(newId);
      return null;
    },
    [persistActive, loadMembers]
  );

  const createSharedWorkspace = useCallback(
    async (name: string): Promise<string | null> => {
      if (!supabase || !userId) return 'Not ready';

      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .insert({ created_by: userId, name, type: 'shared' })
        .select()
        .single();

      if (hhErr || !hh) return hhErr?.message ?? 'Failed to create workspace';

      await supabase
        .from('household_members')
        .insert({ household_id: hh.id, user_id: userId, role: 'owner' });

      const newWs: Workspace = { id: hh.id, name, type: 'shared', memberCount: 1 };
      setWorkspaces((prev) => [...prev, newWs]);
      persistActive(hh.id);
      setMembers([]);
      return null;
    },
    [userId, persistActive]
  );

  return {
    activeWorkspaceId,
    activeWorkspace,
    workspaces,
    members,
    workspaceLoading,
    setActiveWorkspaceId,
    inviteUser,
    acceptInvite,
    createSharedWorkspace,
  };
}
