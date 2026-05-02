import { useState, useEffect } from 'react';
import { Copy, ArrowRight, Loader2 } from 'lucide-react';
import type { Workspace } from '../../types';

interface CopyMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'copy' | 'move';
  count: number;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  onConfirm: (targetWorkspaceId: string) => Promise<void>;
}

export function CopyMoveModal({
  isOpen,
  onClose,
  mode,
  count,
  workspaces,
  currentWorkspaceId,
  onConfirm,
}: CopyMoveModalProps) {
  const otherWorkspaces = workspaces.filter((w) => w.id !== currentWorkspaceId);
  const [targetId, setTargetId] = useState<string>(otherWorkspaces[0]?.id ?? '');
  const [loading, setLoading] = useState(false);

  // Reset target each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetId(otherWorkspaces[0]?.id ?? '');
      setLoading(false);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const targetWorkspace = workspaces.find((w) => w.id === targetId);
  const verb = mode === 'copy' ? 'Copy' : 'Move';
  const label = `${count} ${count === 1 ? 'transaction' : 'transactions'}`;

  const handleConfirm = async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      await onConfirm(targetId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'copy'
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'bg-amber-50 dark:bg-amber-900/30'
            }`}
          >
            {mode === 'copy' ? (
              <Copy size={16} className="text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowRight size={16} className="text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {verb} {label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {mode === 'copy'
                ? 'Duplicates will appear in the destination workspace.'
                : 'Transactions will be removed from this workspace.'}
            </p>
          </div>
        </div>

        {/* Destination picker */}
        <div className="space-y-2 mb-5">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Destination workspace
          </label>
          {otherWorkspaces.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No other workspaces available.
            </p>
          ) : (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition"
            >
              {otherWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}

          {mode === 'move' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 px-3 py-2 rounded-lg">
              ⚠ These transactions will be removed from the current workspace.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!targetId || loading || otherWorkspaces.length === 0}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 ${
              mode === 'copy'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {verb} to {targetWorkspace?.name ?? '…'}
          </button>
        </div>
      </div>
    </div>
  );
}
