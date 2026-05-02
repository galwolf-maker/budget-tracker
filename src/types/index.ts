export type TransactionType = 'income' | 'expense';
export type ViewType = 'home' | 'dashboard' | 'transactions' | 'categories';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  createdAt: string; // ISO timestamp
  isRecurring?: boolean;
  recurringFrequency?: 'monthly' | 'weekly';
  createdBy?: string; // user_id of who added it
}

export interface HouseholdMember {
  userId: string;
  email: string;
  fullName?: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'shared';
  memberCount: number;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  isCustom: boolean;
  /** True for global defaults seeded by the platform (household_id = NULL in DB) */
  isDefault?: boolean;
}

export interface TransactionFilters {
  type: TransactionType | 'all';
  category: string;
  month: string; // YYYY-MM or 'all'
  search: string;
}

export interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  thisMonthSpending: number;
  thisMonthIncome: number;
}

export interface MonthlyDataPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
}
