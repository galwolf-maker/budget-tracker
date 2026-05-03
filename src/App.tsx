import { useState, useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Modal } from './components/ui/Modal';
import { ToastContainer } from './components/ui/Toast';
import { TransactionForm } from './components/transactions/TransactionForm';
import { ImportModal } from './components/statement/ImportModal';
import { RecurringReviewModal } from './components/smart/RecurringReviewModal';
import { DuplicateReviewModal } from './components/smart/DuplicateReviewModal';
import { detectRecurring, type RecurringCandidate } from './utils/recurringDetector';
import { detectDuplicates } from './utils/duplicateDetector';
import { AuthModal } from './components/auth/AuthModal';
import { AuthCallback } from './components/auth/AuthCallback';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { WorkspaceModal } from './components/workspace/WorkspaceModal';
import { Home } from './views/Home';
import { Dashboard } from './views/Dashboard';
import { Transactions } from './views/Transactions';
import { Categories } from './views/Categories';
import { useTransactions } from './hooks/useTransactions';
import { useCategories } from './hooks/useCategories';
import { useTheme } from './hooks/useTheme';
import { useMerchantRules } from './hooks/useMerchantRules';
import { useAuth } from './hooks/useAuth';
import { useWorkspace } from './hooks/useWorkspace';
import { useCurrency } from './hooks/useCurrency';
import { CurrencyContext } from './context/CurrencyContext';
import { GuestModeContext } from './context/GuestModeContext';
import { exportToXlsx } from './utils/exportXlsx';
import {
  DEMO_TRANSACTIONS,
  DEMO_CATEGORIES,
  DEMO_SUMMARY,
  DEMO_EXPENSES_BY_CATEGORY,
  DEMO_MONTHLY_DATA,
} from './demo/demoData';
import type { ViewType, Transaction } from './types';
import type { ToastData } from './components/ui/Toast';

const VIEW_TITLES: Record<ViewType, string> = {
  home: 'Home',
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  categories: 'Categories',
};

export default function App() {
  // Detect password reset callback (redirectTo includes ?reset=1, or hash has type=recovery)
  const [isPasswordReset] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset') === '1' || window.location.hash.includes('type=recovery');
  });

  // Detect auth callback — either the /auth/callback path (Google OAuth) or
  // query params from email confirmation / hash from legacy implicit flow
  const [isAuthCallback] = useState(() => {
    if (new URLSearchParams(window.location.search).get('reset') === '1') return false;
    if (window.location.hash.includes('type=recovery')) return false;
    const params = new URLSearchParams(window.location.search);
    const isCallbackPath = window.location.pathname.includes('/auth/callback');
    return (
      isCallbackPath ||
      params.has('code') ||
      params.has('error') ||
      window.location.hash.startsWith('#access_token=')
    );
  });

  const [activeView, setActiveView] = useState<ViewType>('home');
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isRecurringReviewOpen, setIsRecurringReviewOpen] = useState(false);
  const [isDuplicateReviewOpen, setIsDuplicateReviewOpen] = useState(false);

  // ── Smart detection: dismissed/ignored state persisted to localStorage ───────
  const [dismissedRecurringKeys, setDismissedRecurringKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('bt-dismissed-recurring') ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  const [ignoredDuplicatePairs, setIgnoredDuplicatePairs] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('bt-ignored-dupes') ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // ── Pending workspace join from URL (?join=<workspaceId>) ─────────────────
  const [pendingJoinId, setPendingJoinId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join');
  });

  const { theme, toggleTheme } = useTheme();
  const { merchantRules, saveMerchantRule } = useMerchantRules();

  const {
    user,
    authLoading,
    isSupabaseConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPasswordForEmail,
  } = useAuth();

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  const { currency, setCurrency } = useCurrency(userId);

  const {
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
  } = useWorkspace(userId, userEmail);

  const householdId = activeWorkspaceId;

  const {
    transactions: realTransactions,
    syncing,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteTransactions,
    copyTransactions,
    moveTransactions,
    importTransactions,
    markRecurring,
    recurringAutoAdded,
    clearRecurringAutoAdded,
    getFilteredTransactions: getRealFilteredTransactions,
    summary: realSummary,
    expensesByCategory: realExpensesByCategory,
    monthlyData: realMonthlyData,
  } = useTransactions(userId, householdId, isGuestMode);

  const { categories: realCategories, addCategory, deleteCategory, getCategoriesForType: getRealCategoriesForType } =
    useCategories(userId, householdId, isGuestMode);

  // In guest mode, serve demo data
  const transactions = isGuestMode ? DEMO_TRANSACTIONS : realTransactions;
  const summary = isGuestMode ? DEMO_SUMMARY : realSummary;
  const expensesByCategory = isGuestMode ? DEMO_EXPENSES_BY_CATEGORY : realExpensesByCategory;
  const monthlyData = isGuestMode ? DEMO_MONTHLY_DATA : realMonthlyData;
  const categories = isGuestMode ? DEMO_CATEGORIES : realCategories;

  const getFilteredTransactions = isGuestMode
    ? (filters: Parameters<typeof getRealFilteredTransactions>[0]) => {
        return DEMO_TRANSACTIONS.filter((t) => {
          if (filters.type !== 'all' && t.type !== filters.type) return false;
          if (filters.category && t.category !== filters.category) return false;
          if (filters.month && filters.month !== 'all' && !t.date.startsWith(filters.month)) return false;
          if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q) && !t.amount.toString().includes(q)) return false;
          }
          return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    : getRealFilteredTransactions;
  const getCategoriesForType = isGuestMode
    ? (type: Parameters<typeof getRealCategoriesForType>[0]) => DEMO_CATEGORIES.filter((c) => c.type === type)
    : getRealCategoriesForType;

  // ── Execute the join once the user is signed in and workspaces are loaded ─
  useEffect(() => {
    if (!pendingJoinId || !userId || workspaceLoading) return;

    // Remove ?join= from the URL immediately so a reload doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.toString());

    const idToJoin = pendingJoinId;
    setPendingJoinId(null);

    console.log('[BT] Executing pending workspace join for id:', idToJoin);

    (async () => {
      const result = await joinWorkspace(idToJoin);
      if ('error' in result) {
        toast('error', `Could not join workspace: ${result.error}`);
      } else {
        toast('success', `You joined "${result.workspaceName}"! Shared expenses are now visible.`);
        setActiveView('dashboard');
      }
    })();
  }, [pendingJoinId, userId, workspaceLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── If not signed in when a join link is opened → show auth modal ─────────
  useEffect(() => {
    if (pendingJoinId && !userId && !authLoading) {
      setIsAuthOpen(true);
    }
  }, [pendingJoinId, userId, authLoading]);

  // ── Navigate to home + toast when user signs in ───────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsGuestMode(false);
    setIsAuthOpen(false);
    setActiveView('home');
    if (!pendingJoinId) {
      toast('success', 'Signed in — your data is now synced.');
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify when recurring transactions were auto-added ─────────────────
  useEffect(() => {
    if (recurringAutoAdded > 0) {
      toast(
        'success',
        `Auto-added ${recurringAutoAdded} recurring transaction${recurringAutoAdded !== 1 ? 's' : ''} for this month.`
      );
      clearRecurringAutoAdded();
    }
  }, [recurringAutoAdded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guest mode ────────────────────────────────────────────────────────
  const handleEnterGuestMode = useCallback(() => {
    setIsGuestMode(true);
    setActiveView('dashboard');
  }, []);

  const exitGuestMode = useCallback(() => {
    setIsGuestMode(false);
    setActiveView('home');
  }, []);

  // ── Toast helpers ──────────────────────────────────────────────────────
  const toast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Transaction form handlers ──────────────────────────────────────────
  const openAdd = useCallback(() => { setEditingTransaction(null); setIsFormOpen(true); }, []);
  const openEdit = useCallback((t: Transaction) => { setEditingTransaction(t); setIsFormOpen(true); }, []);
  const closeForm = useCallback(() => { setIsFormOpen(false); setEditingTransaction(null); }, []);

  const handleFormSubmit = useCallback(
    (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (editingTransaction) {
        if (data.description && data.category !== editingTransaction.category) {
          saveMerchantRule(data.description, data.category);
        }
        updateTransaction(editingTransaction.id, data);
        toast('success', 'Transaction updated.');
      } else {
        addTransaction(data);
        toast('success', 'Transaction added.');
      }
      closeForm();
    },
    [editingTransaction, updateTransaction, addTransaction, saveMerchantRule, toast, closeForm]
  );

  const handleDelete = useCallback(
    (id: string) => { deleteTransaction(id); toast('success', 'Transaction deleted.'); },
    [deleteTransaction, toast]
  );

  const handleBulkDelete = useCallback(
    async (ids: string[]): Promise<string | null> => {
      const error = await deleteTransactions(ids);
      if (error) {
        toast('error', `Could not delete transactions: ${error}`);
      } else {
        toast('success', `${ids.length} transaction${ids.length !== 1 ? 's' : ''} deleted.`);
      }
      return error;
    },
    [deleteTransactions, toast]
  );

  const handleCopyTransactions = useCallback(
    async (ids: string[], targetId: string): Promise<string | null> => {
      const targetName = workspaces.find((w) => w.id === targetId)?.name ?? 'workspace';
      const error = await copyTransactions(ids, targetId);
      if (error) {
        toast('error', `Could not copy transactions: ${error}`);
      } else {
        toast('success', `${ids.length} transaction${ids.length !== 1 ? 's' : ''} copied to "${targetName}".`);
      }
      return error;
    },
    [copyTransactions, workspaces, toast]
  );

  const handleMoveTransactions = useCallback(
    async (ids: string[], targetId: string): Promise<string | null> => {
      const targetName = workspaces.find((w) => w.id === targetId)?.name ?? 'workspace';
      const error = await moveTransactions(ids, targetId);
      if (error) {
        toast('error', `Could not move transactions: ${error}`);
      } else {
        toast('success', `${ids.length} transaction${ids.length !== 1 ? 's' : ''} moved to "${targetName}".`);
      }
      return error;
    },
    [moveTransactions, workspaces, toast]
  );

  // ── Smart detection ────────────────────────────────────────────────────
  const recurringCandidates = useMemo(
    () => detectRecurring(transactions, dismissedRecurringKeys),
    [transactions, dismissedRecurringKeys]
  );
  const duplicateGroups = useMemo(
    () => detectDuplicates(transactions, ignoredDuplicatePairs),
    [transactions, ignoredDuplicatePairs]
  );

  const handleMarkRecurringCandidate = useCallback(
    (candidate: RecurringCandidate) => {
      markRecurring(candidate.occurrences[0].id, true);
      setDismissedRecurringKeys(prev => {
        const next = new Set(prev); next.add(candidate.key);
        localStorage.setItem('bt-dismissed-recurring', JSON.stringify([...next]));
        return next;
      });
    },
    [markRecurring]
  );

  const handleDismissRecurring = useCallback((key: string) => {
    setDismissedRecurringKeys(prev => {
      const next = new Set(prev); next.add(key);
      localStorage.setItem('bt-dismissed-recurring', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleKeepBothDuplicate = useCallback((pairId: string) => {
    setIgnoredDuplicatePairs(prev => {
      const next = new Set(prev); next.add(pairId);
      localStorage.setItem('bt-ignored-dupes', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleDeleteDuplicate = useCallback(
    (txnId: string, pairId: string) => {
      deleteTransaction(txnId);
      handleKeepBothDuplicate(pairId);
    },
    [deleteTransaction, handleKeepBothDuplicate]
  );

  // ── Delete workspace ──────────────────────────────────────────────────────
  const handleDeleteWorkspace = useCallback(
    async (workspaceId: string): Promise<string | null> => {
      const wsName = workspaces.find((w) => w.id === workspaceId)?.name ?? 'workspace';
      const error = await deleteWorkspace(workspaceId);
      if (error) {
        toast('error', error);
      } else {
        setIsWorkspaceOpen(false);
        toast('success', `Workspace "${wsName}" has been permanently deleted.`);
      }
      return error;
    },
    [deleteWorkspace, workspaces, toast]
  );

  // ── Export / import ────────────────────────────────────────────────────
  const handleExport = useCallback(() => exportToXlsx(transactions), [transactions]);

  const handleImport = useCallback(
    (rows: Omit<Transaction, 'id' | 'createdAt'>[]) => {
      importTransactions(rows);
      toast('success', `Imported ${rows.length} transaction${rows.length !== 1 ? 's' : ''}.`);
    },
    [importTransactions, toast]
  );

  // ── Recent transactions for dashboard ────────────────────────────────
  const recentTransactions = [...transactions]
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  // ── Password reset page ───────────────────────────────────────────────────
  if (isPasswordReset) {
    return (
      <CurrencyContext.Provider value={{ currency, setCurrency }}>
        <ResetPasswordPage onDone={() => window.location.replace('/')} />
      </CurrencyContext.Provider>
    );
  }

  // ── Email confirmation callback ───────────────────────────────────────────
  if (isAuthCallback) {
    return (
      <CurrencyContext.Provider value={{ currency, setCurrency }}>
        <AuthCallback
          onSuccess={() => {
            // Auth state change fires automatically; navigate handled by useEffect above
            window.location.replace('/');
          }}
          onBackToLogin={() => {
            window.history.replaceState({}, '', '/');
            setIsAuthOpen(true);
            // Force re-render without the callback flag
            window.location.replace('/');
          }}
        />
      </CurrencyContext.Provider>
    );
  }

  // ── Auth + household loading splash ──────────────────────────────────────
  // Block UI until both auth and household are resolved so no mutation can
  // fire with a null householdId (which would skip the Supabase save).
  if (authLoading || (!!user && workspaceLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
            <span className="text-white text-lg font-bold">B</span>
          </div>
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <GuestModeContext.Provider value={{ isGuestMode, exitGuestMode }}>
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isSupabaseConfigured={isSupabaseConfigured}
        isSynced={!!user}
        syncing={syncing}
        workspaces={user ? workspaces : []}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={user ? setActiveWorkspaceId : undefined}
        onCreateWorkspace={user ? () => setIsCreateWorkspaceOpen(true) : undefined}
        onOpenWorkspace={user && activeWorkspace?.type === 'shared' ? () => setIsWorkspaceOpen(true) : undefined}
        isGuestMode={isGuestMode}
      />

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <Header
          title={VIEW_TITLES[activeView]}
          theme={theme}
          onToggleTheme={toggleTheme}
          onAddTransaction={openAdd}
          onExport={handleExport}
          onImportData={() => setIsImportOpen(true)}
          isGuestMode={isGuestMode}
          user={user}
          syncing={syncing}
          isSupabaseConfigured={isSupabaseConfigured}
          onSignIn={() => setIsAuthOpen(true)}
          onSignOut={signOut}
        />

        {/* Demo mode banner */}
        {isGuestMode && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Demo mode — sample data only, nothing is saved.
            </p>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline shrink-0"
            >
              Sign in →
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8">
          {activeView === 'home' && (
            <Home
              user={user}
              summary={summary}
              recentTransactions={recentTransactions}
              onNavigate={setActiveView}
              onAddTransaction={openAdd}
              onSignIn={() => setIsAuthOpen(true)}
              onEnterGuestMode={handleEnterGuestMode}
            />
          )}
          {activeView === 'dashboard' && (
            <Dashboard
              summary={summary}
              expensesByCategory={expensesByCategory}
              monthlyData={monthlyData}
              recentTransactions={recentTransactions}
              allTransactions={transactions}
              categories={categories}
              recurringCount={recurringCandidates.length}
              duplicateCount={duplicateGroups.length}
              onAddTransaction={openAdd}
              onReviewRecurring={() => setIsRecurringReviewOpen(true)}
              onReviewDuplicates={() => setIsDuplicateReviewOpen(true)}
            />
          )}
          {activeView === 'transactions' && (
            <Transactions
              transactions={transactions}
              categories={categories}
              getFilteredTransactions={getFilteredTransactions}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={handleDelete}
              onBulkDelete={handleBulkDelete}
              onMarkRecurring={markRecurring}
              currentUserId={userId}
              members={members}
              workspaces={user ? workspaces : []}
              currentWorkspaceId={activeWorkspaceId}
              onCopyTransactions={user ? handleCopyTransactions : undefined}
              onMoveTransactions={user ? handleMoveTransactions : undefined}
            />
          )}
          {activeView === 'categories' && (
            <Categories
              categories={categories}
              onAdd={addCategory}
              onDelete={deleteCategory}
            />
          )}
        </main>
      </div>

      {/* Transaction form */}
      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingTransaction ? 'Edit Transaction' : 'New Transaction'}>
        <TransactionForm
          transaction={editingTransaction}
          getCategoriesForType={getCategoriesForType}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
        />
      </Modal>

      {/* Import modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        categories={categories}
        merchantRules={merchantRules}
        existingTransactions={isGuestMode ? undefined : realTransactions}
        onImport={handleImport}
      />

      {/* Auth modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        signInWithEmail={signInWithEmail}
        signUpWithEmail={signUpWithEmail}
        signInWithGoogle={signInWithGoogle}
        resetPasswordForEmail={resetPasswordForEmail}
      />

      {/* Workspace modal */}
      {user && activeWorkspace && (
        <WorkspaceModal
          isOpen={isWorkspaceOpen}
          onClose={() => setIsWorkspaceOpen(false)}
          workspace={activeWorkspace}
          members={members}
          currentUserId={userId!}
          joinUrl={getJoinUrl()}
          isActiveWorkspace={activeWorkspace.id === activeWorkspaceId}
          onDeleteWorkspace={activeWorkspace.type === 'shared' ? handleDeleteWorkspace : undefined}
        />
      )}

      {/* Create shared workspace modal */}
      {isCreateWorkspaceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateWorkspaceOpen(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60 p-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">New shared workspace</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = newWorkspaceName.trim();
                if (!name) return;
                const err = await createSharedWorkspace(name);
                if (!err) {
                  setIsCreateWorkspaceOpen(false);
                  setNewWorkspaceName('');
                  toast('success', `Workspace "${name}" created.`);
                } else {
                  toast('error', err);
                }
              }}
              className="space-y-4"
            >
              <input
                autoFocus
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Family, Couple, Business"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateWorkspaceOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspaceName.trim()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recurring review */}
      <RecurringReviewModal
        isOpen={isRecurringReviewOpen}
        onClose={() => setIsRecurringReviewOpen(false)}
        candidates={recurringCandidates}
        onMarkRecurring={handleMarkRecurringCandidate}
        onDismiss={handleDismissRecurring}
      />

      {/* Duplicate review */}
      <DuplicateReviewModal
        isOpen={isDuplicateReviewOpen}
        onClose={() => setIsDuplicateReviewOpen(false)}
        groups={duplicateGroups}
        onKeepBoth={handleKeepBothDuplicate}
        onDeleteDuplicate={handleDeleteDuplicate}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
    </CurrencyContext.Provider>
    </GuestModeContext.Provider>
  );
}
