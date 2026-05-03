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
  /** Returns the join URL for the active shared workspace */
  getJoinUrl: () => string | null;
  /** Join a shared workspace by its ID. Returns error string or null on success. */
  joinWorkspace: (workspaceId: string) => Promise<{ workspaceName: string } | { error: string }>;
  createSharedWorkspace: (name: string) => Promise<string | null>;
  /**
   * Permanently delete a SHARED workspace and all its data.
   * Returns null on success or an error string on failure.
   * Refuses if: workspace is personal, user is not the owner,
   * or the workspace is currently active.
   */
  deleteWorkspace: (workspaceId: string) => Promise<string | null>;
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
    if (error) { console.error('[BT:workspace] loadMembers error — code:', error.code, '| message:', error.message, '| details:', error.details, '| hint:', error.hint); return; }
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
    console.log('[BT:workspace] Members loaded:', memberRows.length);
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
        if (userEmail) {
          const { error: profileErr } = await supabase
            .from('profiles')
            .upsert({ id: userId, email: userEmail }, { onConflict: 'id' });
          if (profileErr) console.warn('[BT:workspace] Profile upsert error:', profileErr);
        }

        // ── DIAGNOSTIC: log auth.uid() via a known-safe RPC ─────────────────
        // This tells us whether auth.uid() matches userId, and whether RLS
        // is evaluating with the correct identity.
        let uidData: string | null = null;
        try {
          const { data: uidResult, error: uidErr } = await supabase.rpc('get_my_uid');
          if (!uidErr) uidData = uidResult as string | null;
        } catch {
          // RPC may not exist yet — ignore
        }
        console.log('[BT:workspace] DIAG auth.uid() from DB:', uidData ?? '(RPC not available)');
        console.log('[BT:workspace] DIAG userId from hook:  ', userId);
        console.log('[BT:workspace] DIAG match:', uidData === userId);

        // ── Step 1: fetch household IDs this user belongs to ─────────────────
        // Two plain queries instead of one embedded join — embedded joins require
        // a registered FK in the PostgREST schema cache and error-free RLS on the
        // joined table; either missing produces HTTP 500. Two queries avoid both.
        const { data: memberRows, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', userId);

        console.log('[BT:workspace] DIAG memberErr:', memberErr ? JSON.stringify(memberErr) : 'none');
        console.log('[BT:workspace] DIAG memberRows count:', memberRows?.length ?? 'null');
        console.log('[BT:workspace] DIAG household_ids:', JSON.stringify(memberRows?.map((r) => r.household_id)));

        if (memberErr) {
          console.error('[BT:workspace] Failed to fetch member rows — code:', memberErr.code, '| message:', memberErr.message, '| details:', memberErr.details, '| hint:', memberErr.hint);
        }

        // ── Step 2: fetch household details for those IDs ─────────────────────
        const householdIds = (memberRows ?? []).map((r: { household_id: string }) => r.household_id);
        let householdRows: Array<{ id: string; name: string; type: string | null; created_by: string }> = [];

        if (householdIds.length > 0) {
          const { data: hhData, error: hhErr } = await supabase
            .from('households')
            .select('id, name, type, created_by')
            .in('id', householdIds);

          console.log('[BT:workspace] DIAG hhErr:', hhErr ? JSON.stringify(hhErr) : 'none');
          console.log('[BT:workspace] DIAG households count:', hhData?.length ?? 'null');

          if (hhErr) {
            console.error('[BT:workspace] Failed to fetch household details — code:', hhErr.code, '| message:', hhErr.message, '| details:', hhErr.details, '| hint:', hhErr.hint);
          } else {
            householdRows = hhData ?? [];
          }
        }

        // ── Deduplicate by ID (guards against duplicate DB rows created during ──
        // previous 500-error loops where personal workspace was re-created each
        // load). For personal workspaces prefer the one matching savedId so the
        // user's previously active workspace "wins".
        const savedId = localStorage.getItem(lsKey(userId));
        const seenIds = new Set<string>();
        const allMapped: Workspace[] = householdRows.map((hh) => ({
          id:          hh.id,
          name:        hh.name,
          type:        (hh.type ?? 'shared') as 'personal' | 'shared',
          memberCount: 1,
        }));

        // Sort so the savedId (preferred) or most-recently-seen personal comes first
        // before we deduplicate, ensuring the "right" one survives.
        allMapped.sort((a, b) => {
          if (a.id === savedId) return -1;
          if (b.id === savedId) return 1;
          return 0;
        });

        const fetched: Workspace[] = allMapped.filter((ws) => {
          if (seenIds.has(ws.id)) return false;
          seenIds.add(ws.id);
          return true;
        });

        if (allMapped.length !== fetched.length) {
          console.warn('[BT:workspace] Deduplicated workspace list from', allMapped.length, 'to', fetched.length,
            '— duplicate household rows exist in DB for this user');
        }

        fetched.forEach((ws) =>
          console.log('[BT:workspace] Found workspace:', ws.name, '| type:', ws.type, '| id:', ws.id)
        );

        // ── Ensure personal workspace exists ──────────────────────────────────
        // First check in-memory fetched list (fast path).
        let personalWs = fetched.find((w) => w.type === 'personal');
        console.log('[BT:workspace] Personal workspace in fetched list?', !!personalWs,
          personalWs ? `(id: ${personalWs.id})` : '');

        // If not found in fetched, query the DB directly before creating.
        // This is the critical guard: fetched may be empty because of a transient
        // RLS/membership issue, not because the workspace genuinely doesn't exist.
        // Checking households by (created_by, type) is the source of truth.
        if (!personalWs) {
          console.log('[BT:workspace] Not in fetched list — querying DB for existing personal workspace…');
          const { data: existingPersonal, error: existErr } = await supabase
            .from('households')
            .select('id, name, type, created_by')
            .eq('created_by', userId)
            .eq('type', 'personal')
            .limit(1)
            .maybeSingle();

          if (existErr) {
            console.error('[BT:workspace] DB check for personal workspace failed — code:', existErr.code,
              '| message:', existErr.message);
          }

          if (existingPersonal) {
            // Workspace exists in DB but wasn't in fetched (membership row may be
            // missing or RLS blocked it). Adopt it without creating a new one.
            console.log('[BT:workspace] Found existing personal workspace in DB:', existingPersonal.id,
              '— adopting without creating a duplicate');
            personalWs = {
              id:          existingPersonal.id,
              name:        existingPersonal.name,
              type:        'personal',
              memberCount: 1,
            };
            // Ensure this user has a membership row (may have been missing).
            const { error: adoptMemberErr } = await supabase
              .from('household_members')
              .upsert(
                { household_id: existingPersonal.id, user_id: userId, role: 'owner', joined_at: new Date().toISOString() },
                { onConflict: 'household_id,user_id' }
              );
            if (adoptMemberErr) {
              console.warn('[BT:workspace] Could not upsert membership for adopted workspace:',
                adoptMemberErr.message);
            }
            if (!fetched.some((w) => w.id === personalWs!.id)) {
              fetched.unshift(personalWs);
            }
          }
        }

        // Only reach here if neither fetched list nor DB query found a personal
        // workspace — safe to create exactly one.
        if (!personalWs) {
          const personalName = userEmail ? `${userEmail}'s workspace` : 'Personal';
          console.log('[BT:workspace] No personal workspace found anywhere — creating:', personalName);
          const wsId = crypto.randomUUID();

          const { error: hhErr } = await supabase
            .from('households')
            .insert({ id: wsId, created_by: userId, name: personalName, type: 'personal' });

          if (hhErr) {
            console.error('[BT:workspace] INSERT households failed — code:', hhErr.code, '| message:', hhErr.message, '| details:', hhErr.details, '| hint:', hhErr.hint);
            console.error('[BT:workspace] Hint: if "column type does not exist", reload schema cache in Supabase → Settings → API');
          } else {
            const { error: memberInsertErr } = await supabase
              .from('household_members')
              .insert({ household_id: wsId, user_id: userId, role: 'owner', joined_at: new Date().toISOString() });

            if (memberInsertErr) {
              console.error('[BT:workspace] INSERT household_members failed — code:', memberInsertErr.code, '| message:', memberInsertErr.message, '| details:', memberInsertErr.details, '| hint:', memberInsertErr.hint);
            } else {
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
              if (txRes.error) console.warn('[BT:workspace] Transaction backfill error — code:', txRes.error.code, '| message:', txRes.error.message, '| hint:', txRes.error.hint);
              if (catRes.error) console.warn('[BT:workspace] Category backfill error — code:', catRes.error.code, '| message:', catRes.error.message, '| hint:', catRes.error.hint);

              personalWs = { id: wsId, name: personalName, type: 'personal', memberCount: 1 };
              fetched.unshift(personalWs);
              console.log('[BT:workspace] Personal workspace created:', wsId);
            }
          }
        }

        // ── Member counts for shared workspaces ───────────────────────────────
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

        // Personal first, then shared alphabetically
        fetched.sort((a, b) => {
          if (a.type === 'personal') return -1;
          if (b.type === 'personal') return 1;
          return a.name.localeCompare(b.name);
        });

        console.log('[BT:workspace] Final workspace list:', fetched.map((w) => `${w.name} (${w.type})`));
        setWorkspaces(fetched);

        const validSaved = savedId && fetched.some((w) => w.id === savedId);
        const targetId = validSaved ? savedId : (personalWs?.id ?? fetched[0]?.id ?? null);
        console.log('[BT:workspace] Active workspace →', targetId, validSaved ? '(saved)' : '(default)');

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

  useEffect(() => {
    if (activeWorkspaceId && workspaces.length > 0) {
      loadMembers(activeWorkspaceId);
    }
  }, [activeWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveWorkspaceId = useCallback(
    (id: string) => persistActive(id),
    [persistActive]
  );

  // ── getJoinUrl ─────────────────────────────────────────────────────────────
  // Returns a shareable join link for the currently active shared workspace.
  const getJoinUrl = useCallback((): string | null => {
    if (!activeWorkspaceId || activeWorkspace?.type !== 'shared') return null;
    return `${window.location.origin}/?join=${activeWorkspaceId}`;
  }, [activeWorkspaceId, activeWorkspace]);

  // ── joinWorkspace ──────────────────────────────────────────────────────────
  // Calls the join_shared_workspace RPC which is SECURITY DEFINER (bypasses
  // RLS) — handles duplicate check and personal-workspace guard server-side.
  const joinWorkspace = useCallback(
    async (workspaceId: string): Promise<{ workspaceName: string } | { error: string }> => {
      if (!supabase) return { error: 'Supabase not configured' };

      console.log('[BT:workspace] Joining workspace:', workspaceId);

      const { data, error } = await supabase.rpc('join_shared_workspace', {
        p_workspace_id: workspaceId,
      });

      if (error) {
        console.error('[BT:workspace] join_shared_workspace RPC error:', error);
        return { error: error.message };
      }

      if (data?.error) {
        console.error('[BT:workspace] join_shared_workspace returned error:', data.error);
        return { error: data.error as string };
      }

      const wsName = (data?.workspace_name as string) ?? 'Workspace';
      const alreadyMember = data?.already_member as boolean;
      const wsId = (data?.workspace_id as string) ?? workspaceId;

      console.log(
        '[BT:workspace] Join result — workspace:', wsName,
        '| already_member:', alreadyMember,
        '| id:', wsId
      );

      // Add to workspaces list if not already there
      setWorkspaces((prev) => {
        if (prev.some((w) => w.id === wsId)) return prev;
        return [...prev, { id: wsId, name: wsName, type: 'shared', memberCount: 1 }];
      });

      // Make it the active workspace
      persistActive(wsId);
      await loadMembers(wsId);

      return { workspaceName: wsName };
    },
    [persistActive, loadMembers]
  );

  // ── deleteWorkspace ────────────────────────────────────────────────────────
  // Deletes a shared workspace and all its associated data in dependency order.
  // If the deleted workspace is currently active, the user is automatically
  // switched to their personal workspace after deletion.
  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<string | null> => {
      if (!supabase || !userId) return 'Not ready';

      // ── Guard: never delete personal workspaces ──────────────────────────
      const ws = workspaces.find((w) => w.id === workspaceId);
      if (!ws) return 'Workspace not found';
      if (ws.type === 'personal') return 'Personal workspaces cannot be deleted';

      // ── Guard: current user must be owner (verified via DB) ─────────────
      const { data: memberRow, error: memberCheckErr } = await supabase
        .from('household_members')
        .select('role')
        .eq('household_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (memberCheckErr) {
        console.error('[BT:workspace] deleteWorkspace ownership check failed:', memberCheckErr.message);
        return 'Could not verify ownership';
      }
      if (!memberRow || memberRow.role !== 'owner') {
        return 'Only the workspace owner can delete it';
      }

      console.log('[BT:workspace] Deleting shared workspace:', workspaceId);

      // ── Delete in dependency order ────────────────────────────────────────
      // 1. Transactions
      const { error: txErr } = await supabase
        .from('transactions')
        .delete()
        .eq('household_id', workspaceId);
      if (txErr) {
        console.error('[BT:workspace] Delete transactions failed:', txErr.message);
        return `Failed to delete transactions: ${txErr.message}`;
      }

      // 2. Categories
      const { error: catErr } = await supabase
        .from('categories')
        .delete()
        .eq('household_id', workspaceId);
      if (catErr) {
        console.error('[BT:workspace] Delete categories failed:', catErr.message);
        return `Failed to delete categories: ${catErr.message}`;
      }

      // 3. Members
      const { error: membersErr } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', workspaceId);
      if (membersErr) {
        console.error('[BT:workspace] Delete household_members failed:', membersErr.message);
        return `Failed to delete members: ${membersErr.message}`;
      }

      // 4. Household itself
      const { error: hhErr } = await supabase
        .from('households')
        .delete()
        .eq('id', workspaceId);
      if (hhErr) {
        console.error('[BT:workspace] Delete household failed:', hhErr.message);
        return `Failed to delete workspace: ${hhErr.message}`;
      }

      // ── Remove from local state ───────────────────────────────────────────
      const nextWorkspaces = workspaces.filter((w) => w.id !== workspaceId);
      setWorkspaces(nextWorkspaces);
      console.log('[BT:workspace] Workspace deleted:', workspaceId);

      // ── If this was the active workspace, switch to personal ──────────────
      if (workspaceId === activeWorkspaceId) {
        const personal = nextWorkspaces.find((w) => w.type === 'personal');
        const fallback = personal ?? nextWorkspaces[0] ?? null;
        if (fallback) {
          console.log('[BT:workspace] Deleted workspace was active — switching to:', fallback.name);
          persistActive(fallback.id);
          await loadMembers(fallback.id);
        }
      }

      return null;
    },
    [userId, workspaces, activeWorkspaceId, persistActive, loadMembers]
  );

  // ── createSharedWorkspace ──────────────────────────────────────────────────
  const createSharedWorkspace = useCallback(
    async (name: string): Promise<string | null> => {
      if (!supabase || !userId) return 'Not ready';

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
        console.error('[BT:workspace] Failed to add owner:', memberErr);
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
    getJoinUrl,
    joinWorkspace,
    createSharedWorkspace,
    deleteWorkspace,
  };
}
