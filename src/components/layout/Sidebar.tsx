import { Home, LayoutDashboard, ArrowLeftRight, Tag, Wallet, Cloud, HardDrive, RefreshCw, Users, Lock, User, Plus, Settings } from 'lucide-react';
import type { ViewType, Workspace } from '../../types';

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  isSupabaseConfigured: boolean;
  isSynced: boolean;
  syncing: boolean;
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
  onSwitchWorkspace?: (id: string) => void;
  onCreateWorkspace?: () => void;
  onOpenWorkspace?: () => void;
  isGuestMode?: boolean;
}

const NAV_ITEMS = [
  { id: 'home' as ViewType, label: 'Home', icon: Home },
  { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions' as ViewType, label: 'Transactions', icon: ArrowLeftRight },
  { id: 'categories' as ViewType, label: 'Categories', icon: Tag },
];

const GUEST_LOCKED: ViewType[] = ['transactions', 'categories'];

export function Sidebar({
  activeView,
  onNavigate,
  isSupabaseConfigured,
  isSynced,
  syncing,
  workspaces = [],
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
  onOpenWorkspace,
  isGuestMode = false,
}: SidebarProps) {
  const storageLabel = !isSupabaseConfigured || !isSynced ? 'Local storage' : 'Synced to cloud';
  const StorageIcon = !isSupabaseConfigured || !isSynced ? HardDrive : Cloud;
  const dotColor = !isSupabaseConfigured || !isSynced ? 'bg-slate-500' : 'bg-emerald-500';
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const WorkspaceSwitcher = () => (
    <div className="mt-4 pt-4 border-t border-slate-700/60">
      <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Workspace
      </p>
      <ul className="space-y-0.5">
        {workspaces.map((ws) => {
          const WsIcon = ws.type === 'personal' ? User : Users;
          const isActive = ws.id === activeWorkspaceId;
          return (
            <li key={ws.id}>
              <button
                onClick={() => onSwitchWorkspace?.(ws.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <WsIcon size={15} className="shrink-0" />
                <span className="flex-1 text-left truncate">{ws.name}</span>
                {ws.type === 'shared' && ws.memberCount > 1 && (
                  <span className="text-[10px] bg-slate-600 text-slate-300 rounded-full px-1.5 py-0.5 font-medium">
                    {ws.memberCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {onCreateWorkspace && (
        <button
          onClick={onCreateWorkspace}
          className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm text-slate-500 hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-800"
        >
          <Plus size={14} />
          New shared workspace
        </button>
      )}
      {activeWorkspace?.type === 'shared' && onOpenWorkspace && (
        <button
          onClick={onOpenWorkspace}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors rounded-xl hover:bg-slate-800"
        >
          <Settings size={14} />
          Manage members
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-slate-900 fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">BudgetTrack</p>
            <p className="text-xs text-slate-400">Personal Finance</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Menu
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = activeView === id;
              const locked = isGuestMode && GUEST_LOCKED.includes(id);
              return (
                <li key={id}>
                  <button
                    onClick={() => !locked && onNavigate(id)}
                    disabled={locked}
                    title={locked ? 'Sign in to access' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      locked
                        ? 'text-slate-600 cursor-not-allowed opacity-50'
                        : active
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    }`}
                  >
                    <Icon size={17} />
                    {label}
                    {locked && <Lock size={12} className="ml-auto opacity-60" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {workspaces.length > 0 && <WorkspaceSwitcher />}
        </nav>

        {/* Storage indicator footer */}
        <div className="px-5 py-4 border-t border-slate-700/60">
          <div className="flex items-center gap-2.5">
            {syncing ? (
              <RefreshCw size={13} className="text-amber-400 animate-spin shrink-0" />
            ) : (
              <StorageIcon size={13} className={isSynced && isSupabaseConfigured ? 'text-emerald-400' : 'text-slate-500'} />
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${syncing ? 'bg-amber-400' : dotColor}`} />
              <p className="text-xs text-slate-400 truncate">
                {syncing ? 'Syncing…' : storageLabel}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 z-40 safe-area-pb">
        <ul className="flex">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeView === id;
            const locked = isGuestMode && GUEST_LOCKED.includes(id);
            return (
              <li key={id} className="flex-1">
                <button
                  onClick={() => !locked && onNavigate(id)}
                  disabled={locked}
                  className={`w-full flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                    locked
                      ? 'text-slate-300 dark:text-slate-600 opacity-50 cursor-not-allowed'
                      : active
                      ? 'text-blue-600'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <Icon size={20} />
                  {label}
                </button>
              </li>
            );
          })}
          {activeWorkspace?.type === 'shared' && onOpenWorkspace && (
            <li className="flex-1">
              <button
                onClick={onOpenWorkspace}
                className="w-full flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 transition-colors relative"
              >
                <Users size={20} />
                Members
                {activeWorkspace.memberCount > 1 && (
                  <span className="absolute top-1.5 right-3 w-4 h-4 bg-blue-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {activeWorkspace.memberCount}
                  </span>
                )}
              </button>
            </li>
          )}
        </ul>
      </nav>
    </>
  );
}
