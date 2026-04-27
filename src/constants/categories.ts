import type { Category } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food', type: 'expense', isCustom: false },
  { id: 'rent', name: 'Rent', type: 'expense', isCustom: false },
  { id: 'transport', name: 'Transport', type: 'expense', isCustom: false },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', isCustom: false },
  { id: 'shopping', name: 'Shopping', type: 'expense', isCustom: false },
  { id: 'health', name: 'Health', type: 'expense', isCustom: false },
  { id: 'other-expense', name: 'Other', type: 'expense', isCustom: false },
  { id: 'salary', name: 'Salary', type: 'income', isCustom: false },
  { id: 'freelance', name: 'Freelance', type: 'income', isCustom: false },
  { id: 'gifts', name: 'Gifts', type: 'income', isCustom: false },
  { id: 'other-income', name: 'Other', type: 'income', isCustom: false },
];

// Named colors for known categories — extras fall back to CHART_PALETTE
export const CATEGORY_COLOR_MAP: Record<string, string> = {
  Food: '#f97316',
  Rent: '#8b5cf6',
  Transport: '#06b6d4',
  Entertainment: '#ec4899',
  Shopping: '#f59e0b',
  Health: '#10b981',
  Other: '#6b7280',
  Salary: '#3b82f6',
  Freelance: '#14b8a6',
  Gifts: '#a78bfa',
};

export const CHART_PALETTE = [
  '#3b82f6',
  '#f97316',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#6b7280',
  '#ef4444',
  '#84cc16',
];
