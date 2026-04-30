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
    console.log('[BT:workspace] Loading members for workspace', wsId);
    const { data: memberRows, error } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', wsId);
    if (error) { console.error('[BT:workspace] loadMembers error:', error); return; }
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
      console.log('[BT:workspace] Switching active workspace →', id);
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
    console.log('[BT:workspace] Resolving workspaces for user', userId);

    (async () => {
      try {
        // Upsert profile
        if (userEmail) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
          if (profileErr) console.warn('[BT:workspace] Profile upsert error:', profileErr);
        }

        // Fetch all workspaces the user belongs to (via household_members)
        const { data: memberRows, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id, households(id, name, type, created_by)')
          .eq('user_id', userId);

        if (memberErr) {
          console.error('[BT:workspace] Failed to fetch member rows:', memberErr);
        }

        console.log('[BT:workspace] Raw member rows:', memberRows);

        type HouseholdJoin = {
          id: string;
          name: string;
          type: string | null;
          created_by: string;
        };

        type MemberRow = {
          household_id: string;
          households: HouseholdJoin | HouseholdJoin[] | null;
        };

        const fetched: Workspace[] = ((memberRows ?? []) as MemberRow[])
          .map((r) => {
            // PostgREST may return the joined row as an object or a single-element array
            const hhRaw = r.households;
            const hh: HouseholdJoin | null = Array.isArray(hhRaw)
              ? (hhRaw[0] ?? null)
              : hhRaw;
            if (!hh) return null;
            const ws: Workspace = {
              id:          hh.id,
              name:        hh.name,
              type:        (hh.type ?? 'shared') as 'personal' | 'shared',
              memberCount: 1,
            };
            console.log('[BT:workspace] Found workspace:', ws.name, '| type:', ws.type, '| id:', ws.id);
            return ws;
          })
          .filter(Boolean) as Workspace[];

        // ── Ensure personal workspace exists ─────────────────────────────────
        let personalWs = fetched.find((w) => w.type === 'personal');
        console.log('[BT:workspace] Personal workspace found?', !!personalWs);

        if (!personalWs) {
          const personalName = userEmail ? `${userEmail}'s workspace` : 'Personal';
          console.log('[BT:workspace] Creating personal workspace:', personalName);

          // Generate UUID client-side to avoid the RLS chicken-and-egg:
          // INSERT...SELECT fails because SELECT RLS checks household_members
          // membership which doesn't exist yet at INSERT time.
          const wsId = crypto.randomUUID();
          console.log('[BT:workspace] Generated workspace id:', wsId);

          const { error: hhErr } = await supabase
            .from('households')
            .insert({ id: wsId, created_by: userId, name: personalName, type: 'personal' });

          if (hhErr) {
            console.error('[BT:workspace] INSERT households failed:', hhErr);
            console.error('[BT:workspace] Hint: if error says "column type does not exist", go to');
            console.error('[BT:workspace] Supabase Dashboard → Settings → API → Reload schema cache');
          } else {
            console.log('[BT:workspace] Household inserted, adding membership...');
            const { error: memberInsertErr } = await supabase
              .from('household_members')
              .insert({ household_id: wsId, user_id: userId, role: 'owner' });

            if (memberInsertErr) {
              console.error('[BT:workspace] INSERT household_members failed:', memberInsertErr);
            } else {
              console.log('[BT:workspace] Membership inserted. Backfilling orphaned data...');

              // Backfill any transactions/categories not yet assigned to a workspace
              const [txRes, catRes] = await Promise.all([
                supabase
                  .from('transactions')
                  .update({ household_id: wsId, created_by: userId })
                  .eq('user_id', userId)
                  .is('household_id', null),
                supabase
                  .from('categories')
                  .update({ household_id: wsId })
                  .eq('user_id', userId)
                  .is('household_id', null),
              ]);
              if (txRes.error) console.warn('[BT:workspace] Transaction backfill error:', txRes.error);
              if (catRes.error) console.warn('[BT:workspace] Category backfill error:', catRes.error);

              personalWs = { id: wsId, name: personalName, type: 'personal', memberCount: 1 };
              fetched.unshift(personalWs);
              console.log('[BT:workspace] Personal workspace created successfully:', wsId);
            }
          }
        }

        // ── Get member counts for shared workspaces ───────────────────────────
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

        // ── Sort: personal first, then shared alphabetically ─────────────────
        fetched.sort((a, b) => {
          if (a.type === 'personal') return -1;
          if (b.type === 'personal') return 1;
          return a.name.localeCompare(b.name);
        });

        console.log('[BT:workspace] Final workspace list:', fetched.map((w) => `${w.name} (${w.type})`));
        setWorkspaces(fetched);

        // ── Resolve active workspace ──────────────────────────────────────────
        const savedId = localStorage.getItem(lsKey(userId));
        const validSaved = savedId && fetched.some((w) => w.id === savedId);
        const targetId = validSaved ? savedId : (personalWs?.id ?? fetched[0]?.id ?? null);
        console.log('[BT:workspace] Active workspace resolved →', targetId, validSaved ? '(from localStorage)' : '(default)');

        if (targetId) {
          _setActiveWorkspaceId(targetId);
          localStorage.setItem(lsKey(userId), targetId);
          await loadMembers(targetId);
        }
      } catch (err) {
        console.error('[BT:workspace] Unexpected error:', err);
      } finally {
        setWorkspaceLoading(false);
      }
    })();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload members when user switches workspace (after initial load)
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
      console.log('[BT:workspace] Joined workspace:', newId);
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

      // Use crypto.randomUUID() for the same reason as personal workspace creation
      const wsId = crypto.randomUUID();
      console.log('[BT:workspace] Creating shared workspace:', name, '| id:', wsId);

      const { error: hhErr } = await supabase
        .from('households')
        .insert({ id: wsId, created_by: userId, name, type: 'shared' });

      if (hhErr) {
        console.error('[BT:workspace] Failed to create shared workspace:', hhErr);
        return hhErr.message;
      }

      const { error: memberErr } = await supabase
        .from('household_members')
        .insert({ household_id: wsId, user_id: userId, role: 'owner' });

      if (memberErr) {
        console.error('[BT:workspace] Failed to add owner to shared workspace:', memberErr);
        return memberErr.message;
      }

      console.log('[BT:workspace] Shared workspace created:', wsId);
      const newWs: Workspace = { id: wsId, name, type: 'shared', memberCount: 1 };
      setWorkspaces((prev) => [...prev, newWs]);
      persistActive(wsId);
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
