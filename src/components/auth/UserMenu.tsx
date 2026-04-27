import { useEffect, useRef, useState } from 'react';
import { LogOut, User, RefreshCw } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useCurrencyContext, CURRENCIES } from '../../context/CurrencyContext';

interface UserMenuProps {
  user: SupabaseUser;
  syncing: boolean;
  onSignOut: () => Promise<void>;
}

export function UserMenu({ user, syncing, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currency, setCurrency } = useCurrencyContext();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Build avatar: first letter of email or display name
  const avatar =
    user.user_metadata?.full_name?.charAt(0)?.toUpperCase() ||
    user.email?.charAt(0)?.toUpperCase() ||
    '?';

  const email = user.email ?? 'Signed in';

  const handleSignOut = async () => {
    setOpen(false);
    await onSignOut();
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={email}
        className="relative w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold hover:bg-blue-700 transition-colors"
      >
        {avatar}
        {syncing && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
            <RefreshCw size={6} className="animate-spin" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-60 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 py-1">
          {/* User info */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {avatar}
            </div>
            <div className="min-w-0">
              {user.user_metadata?.full_name && (
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {user.user_metadata.full_name}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
            </div>
          </div>

          {/* Sync status */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs">
              {syncing ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Syncing…</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-500 dark:text-slate-400">Data synced to cloud</span>
                </>
              )}
            </div>
          </div>

          {/* Currency selector */}
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Currency</p>
            <div className="flex gap-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCurrency(c.code)}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                    currency === c.code
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {c.symbol} {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
          >
            <LogOut size={14} className="text-slate-400 shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

interface SignInButtonProps {
  onClick: () => void;
}

export function SignInButton({ onClick }: SignInButtonProps) {
  return (
    <button
      onClick={onClick}
      title="Sign in to sync data across devices"
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
    >
      <User size={15} />
      <span className="hidden sm:inline">Sign in</span>
    </button>
  );
}
