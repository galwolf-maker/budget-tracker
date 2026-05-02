import { useState } from 'react';
import { X, Copy, Check, Users, Crown, User, Lock, Link } from 'lucide-react';
import type { HouseholdMember, Workspace } from '../../types';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  members: HouseholdMember[];
  currentUserId: string;
  /** Pre-built join URL — null for personal workspaces */
  joinUrl: string | null;
}

export function WorkspaceModal({
  isOpen,
  onClose,
  workspace,
  members,
  currentUserId,
  joinUrl,
}: WorkspaceModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isPersonal = workspace.type === 'personal';

  const handleCopy = async () => {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
        </div>
      </div>
    </div>
  );
}
