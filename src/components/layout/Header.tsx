import { Plus, Download, Upload, Wallet, Sun, Moon } from 'lucide-react';
import { UserMenu, SignInButton } from '../auth/UserMenu';
import { useCurrencyContext, CURRENCIES } from '../../context/CurrencyContext';
import type { Theme } from '../../hooks/useTheme';
import type { User } from '@supabase/supabase-js';

interface HeaderProps {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onAddTransaction: () => void;
  onExport: () => void;
  onImportData: () => void;
  isGuestMode?: boolean;
  // Auth
  user: User | null;
  syncing: boolean;
  isSupabaseConfigured: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
}

export function Header({
  title, theme, onToggleTheme,
  onAddTransaction, onExport, onImportData,
  isGuestMode = false,
  user, syncing, isSupabaseConfigured, onSignIn, onSignOut,
}: HeaderProps) {
  const { currency, setCurrency } = useCurrencyContext();

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-700/80 px-4 sm:px-6 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile logo / Desktop title */}
        <div className="flex items-center gap-2.5 lg:gap-0">
          <div className="lg:hidden w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wallet size={15} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Currency toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                title={c.label}
                className={`px-2 py-1.5 transition-colors ${
                  currency === c.code
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {c.symbol}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Export */}
          {!isGuestMode && (
            <button
              onClick={onExport}
              title="Export as CSV"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Import */}
          {!isGuestMode && (
            <button
              onClick={onImportData}
              title="Import data"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}

          {/* Auth */}
          {isSupabaseConfigured && (
            user
              ? <UserMenu user={user} syncing={syncing} onSignOut={onSignOut} />
              : <SignInButton onClick={onSignIn} />
          )}

          {/* Add transaction — hidden in guest mode */}
          {!isGuestMode && (
            <button
              onClick={onAddTransaction}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
            >
              <Plus size={15} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
