import { useState } from 'react';
import { getTodayString } from '../../utils/formatters';
import type { Transaction, TransactionType, Category } from '../../types';

interface TransactionFormProps {
  transaction: Transaction | null;
  getCategoriesForType: (type: TransactionType) => Category[];
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

interface FormErrors {
  amount?: string;
  category?: string;
  date?: string;
}

export function TransactionForm({
  transaction,
  getCategoriesForType,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? 'expense'
  );
  const [amount, setAmount] = useState(transaction?.amount.toString() ?? '');
  const [category, setCategory] = useState(transaction?.category ?? '');
  const [date, setDate] = useState(transaction?.date ?? getTodayString());
  const [description, setDescription] = useState(
    transaction?.description ?? ''
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const availableCategories = getCategoriesForType(type);

  const clearError = (field: keyof FormErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  const validate = (): boolean => {
    const next: FormErrors = {};
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) {
      next.amount = 'Enter a valid amount greater than $0.00';
    }
    if (!category) next.category = 'Please select a category';
    if (!date) next.date = 'Please select a date';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      type,
      amount: Math.round(parseFloat(amount) * 100) / 100,
      category,
      date,
      description: description.trim(),
      isRecurring: transaction?.isRecurring,
    });
  };

  const handleTypeChange = (next: TransactionType) => {
    setType(next);
    setCategory('');
  };

  const baseInput = 'w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition dark:bg-slate-700/50 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500';

  const inputClass = (error?: string) =>
    `${baseInput} ${
      error
        ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300'
        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100'
    }`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all capitalize ${
              type === t
                ? t === 'expense'
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-rose-600'
                  : 'bg-white dark:bg-slate-800 shadow-sm text-emerald-600'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); clearError('amount'); }}
            placeholder="0.00"
            className={`${inputClass(errors.amount)} pl-7`}
            autoFocus
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); clearError('category'); }}
          className={inputClass(errors.category)}
        >
          <option value="">Select a category…</option>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1 text-xs text-rose-500">{errors.category}</p>
        )}
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={date}
          max={getTodayString()}
          onChange={(e) => { setDate(e.target.value); clearError('date'); }}
          className={inputClass(errors.date)}
        />
        {errors.date && (
          <p className="mt-1 text-xs text-rose-500">{errors.date}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Description{' '}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          {transaction ? 'Update' : 'Add'} Transaction
        </button>
      </div>
    </form>
  );
}
