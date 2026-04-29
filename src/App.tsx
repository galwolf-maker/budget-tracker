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
import { HouseholdModal } from './components/household/HouseholdModal';
import { Home } from './views/Home';
import { Dashboard } from './views/Dashboard';
import { Transactions } from './views/Transactions';
import { Categories } from './views/Categories';
import { useTransactions } from './hooks/useTransactions';
import { useCategories } from './hooks/useCategories';
import { useTheme } from './hooks/useTheme';
import { useMerchantRules } from './hooks/useMerchantRules';
import { useAuth } from './hooks/useAuth';
import { useHousehold } from './hooks/useHousehold';
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
  const [isHouseholdOpen, setIsHouseholdOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // ── Invite token from URL ──────────────────────────────────────────────────
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite');
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
    householdId,
    householdName,
    members,
    householdLoading,
    inviteUser,
    acceptInvite,
  } = useHousehold(userId, userEmail);

  const {
    transactions: realTransactions,
    syncing,
    addTransaction,
    updateTransaction,
    deleteTransaction,
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

  // ── Handle pending invite once user is signed in and household is ready ───
  useEffect(() => {
    if (!pendingInviteToken || !userId || householdLoading) return;

    // Clear token from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());

    (async () => {
      const error = await acceptInvite(pendingInviteToken);
      setPendingInviteToken(null);
      if (error) {
        toast('error', `Could not join household: ${error}`);
      } else {
        toast('success', 'You joined the household! You now share the same data.');
      }
    })();
  }, [pendingInviteToken, userId, householdLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show auth modal when invite link is opened by unauthenticated user ────
  useEffect(() => {
    if (pendingInviteToken && !userId && !authLoading) {
      setIsAuthOpen(true);
    }
  }, [pendingInviteToken, userId, authLoading]);

  // ── Navigate to home + toast when user signs in ───────────────────────────
  useEffect(() => {
    if (!user) return;
    setIsGuestMode(false);
    setIsAuthOpen(false);
    setActiveView('home');
    if (!pendingInviteToken) {
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
  if (authLoading || (!!user && householdLoading)) {
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
        memberCount={members.length}
        onOpenHousehold={user ? () => setIsHouseholdOpen(true) : undefined}
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
              onMarkRecurring={markRecurring}
              currentUserId={userId}
              members={members}
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

      {/* Household modal */}
      {user && (
        <HouseholdModal
          isOpen={isHouseholdOpen}
          onClose={() => setIsHouseholdOpen(false)}
          householdName={householdName}
          members={members}
          currentUserId={userId!}
          onInvite={inviteUser}
        />
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
