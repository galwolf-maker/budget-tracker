import { useState, useEffect } from 'react';
import { X, Copy, Check, Users, Crown, User, Lock, Link, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { HouseholdMember, Workspace } from '../../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  members: HouseholdMember[];
  currentUserId: string;
  /** Pre-built join URL — null for personal workspaces */
  joinUrl: string | null;
  /** Whether this workspace is currently active (blocks deletion) */
  isActiveWorkspace: boolean;
  /** Delete handler — only called for shared workspaces the user owns */
  onDeleteWorkspace?: (workspaceId: string) => Promise<string | null>;
}

export function WorkspaceModal({
  isOpen,
  onClose,
  workspace,
  members,
  currentUserId,
  joinUrl,
  isActiveWorkspace,
  onDeleteWorkspace,
}: WorkspaceModalProps) {
  const [copied, setCopied] = useState(false);
  const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'deleting'>('idle');
  const isDeleting = deletePhase === 'deleting';

  // ── Diagnostics ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const currentMember = members.find((m) => m.userId === currentUserId);
    console.log('[BT:WorkspaceModal] === DELETE VISIBILITY DEBUG ===');
    console.log('[BT:WorkspaceModal] workspace.id   :', workspace.id);
    console.log('[BT:WorkspaceModal] workspace.type :', workspace.type);
    console.log('[BT:WorkspaceModal] currentUserId  :', currentUserId);
    console.log('[BT:WorkspaceModal] members count  :', members.length);
    console.log('[BT:WorkspaceModal] members        :', JSON.stringify(members));
    console.log('[BT:WorkspaceModal] currentMember  :', JSON.stringify(currentMember ?? null));
    console.log('[BT:WorkspaceModal] role            :', currentMember?.role ?? '(not found in members)');
    console.log('[BT:WorkspaceModal] onDeleteWorkspace provided:', !!onDeleteWorkspace);
    console.log('[BT:WorkspaceModal] isActiveWorkspace:', isActiveWorkspace);
    const isPersonalLocal = workspace.type === 'personal';
    const canDeleteLocal = !isPersonalLocal && !!onDeleteWorkspace;
    console.log('[BT:WorkspaceModal] canDelete (section visible):', canDeleteLocal);
    console.log('[BT:WorkspaceModal] delete button vs amber warning:',
      !canDeleteLocal
        ? 'HIDDEN — workspace is personal or onDeleteWorkspace not provided'
        : isActiveWorkspace
          ? 'AMBER WARNING — workspace is currently active (this is always true when opened via sidebar)'
          : 'DELETE BUTTON — visible'
    );
    console.log('[BT:WorkspaceModal] ============================================');
  }, [isOpen, members, currentUserId, workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const isPersonal = workspace.type === 'personal';
  const currentMember = members.find((m) => m.userId === currentUserId);
  const isOwner = currentMember?.role === 'owner';

  // The delete button is shown whenever:
  //   • workspace is shared (not personal)
  //   • the parent passed onDeleteWorkspace (App.tsx only does this for shared workspaces)
  //
  // We do NOT gate on isOwner here — the members list may be empty due to RLS
  // only returning the user's own row, or a transient load failure.  The real
  // ownership check is enforced inside useWorkspace.deleteWorkspace() via a
  // fresh DB query, so the UI just needs to show the button and let the hook
  // return an error if the user turns out not to be the owner.
  const canDelete = !isPersonal && !!onDeleteWorkspace;

  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDeleteConfirm = async () => {
    if (!onDeleteWorkspace) return;
    setDeletePhase('deleting');
    const err = await onDeleteWorkspace(workspace.id);
    if (err) {
      // Reset so the user sees the error via toast (App.tsx handles it)
      setDeletePhase('idle');
    } else {
      setDeletePhase('idle');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            {isPersonal ? (
              <User size={17} className="text-blue-500" />
            ) : (
              <Users size={17} className="text-blue-500" />
            )}
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                {workspace.name}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isPersonal ? 'Personal workspace' : 'Shared workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Personal workspace notice */}
          {isPersonal && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
              <Lock size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                This is your private workspace. Only you can see this data.
                Create a shared workspace to collaborate with others.
              </p>
            </div>
          )}

          {/* Members list */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Members
              <span className="ml-1.5 font-normal normal-case text-slate-400">
                ({members.length})
              </span>
            </p>
            {members.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No members loaded yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(m.fullName ?? m.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {m.fullName && (
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {m.fullName}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.userId === currentUserId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                          you
                        </span>
                      )}
                      {m.role === 'owner' && (
                        <span title="Owner">
                          <Crown size={13} className="text-amber-400" />
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Invite section — shared workspaces only */}
          {!isPersonal && joinUrl && (
            <>
              <hr className="border-slate-100 dark:border-slate-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Invite members
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Share this link. Anyone who opens it will join this workspace.
                </p>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 min-w-0">
                    <Link size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
                      {joinUrl}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shrink-0"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Delete section — shared workspaces, owners only */}
          {canDelete && (
            <>
              <hr className="border-slate-100 dark:border-slate-700" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Danger zone
                </p>

                {/* If this is the active workspace, show an info note but still allow deletion */}
                {isActiveWorkspace && deletePhase === 'idle' && (
                  <div className="flex items-start gap-2.5 p-3 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      This is your current workspace. You'll be switched to your personal workspace after deletion.
                    </p>
                  </div>
                )}

                {deletePhase === 'confirm' ? (
                  /* Two-step inline confirmation */
                  <div className="rounded-xl border border-rose-200 dark:border-rose-700/50 bg-rose-50 dark:bg-rose-900/20 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={15} className="text-rose-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-rose-700 dark:text-rose-300">
                        Delete <strong>"{workspace.name}"</strong>? This will permanently remove all
                        transactions, categories, and member data in this workspace.
                        This action cannot be undone.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeletePhase('idle')}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteConfirm}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-60"
                      >
                        {isDeleting && <Loader2 size={12} className="animate-spin" />}
                        Yes, delete workspace
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletePhase('confirm')}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete workspace
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
