import { useEffect, useRef, useState } from 'react';
import {
  Plus, Download, Upload, Wallet, ChevronDown,
  FileText, CreditCard, Sun, Moon,
} from 'lucide-react';
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
  onImportCSV: (content: string) => void;
  onImportStatement: () => void;
  // Auth
  user: User | null;
  syncing: boolean;
  isSupabaseConfigured: boolean;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
}

export function Header({
  title, theme, onToggleTheme,
  onAddTransaction, onExport, onImportCSV, onImportStatement,
  user, syncing, isSupabaseConfigured, onSignIn, onSignOut,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currency, setCurrency } = useCurrencyContext();

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCsvImport = () => {
    setMenuOpen(false);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === 'string') onImportCSV(content);
      };
      reader.readAsText(file);
    };
    input.click();
  };

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
          <button
            onClick={onExport}
            title="Export as CSV"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Import dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              title="Import data"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import</span>
              <ChevronDown size={12} className={`hidden sm:block transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-52 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 py-1">
                <button
                  onClick={handleCsvImport}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <div>
                    <p className="font-medium">Import CSV</p>
                    <p className="text-xs text-slate-400">Structured transaction file</p>
                  </div>
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                <button
                  onClick={() => { setMenuOpen(false); onImportStatement(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <CreditCard size={15} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="font-medium">Import Statement</p>
                    <p className="text-xs text-slate-400">PDF or image, auto-parsed</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Auth */}
          {isSupabaseConfigured && (
            user
              ? <UserMenu user={user} syncing={syncing} onSignOut={onSignOut} />
              : <SignInButton onClick={onSignIn} />
          )}

          {/* Add transaction */}
          <button
            onClick={onAddTransaction}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
          >
            <Plus size={15} />
            <span>Add</span>
          </button>
        </div>
      </div>
    </header>
  );
}
