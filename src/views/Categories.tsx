import { useState } from 'react';
import { Plus, Trash2, Globe } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { Category, TransactionType } from '../types';

interface CategoriesProps {
  categories: Category[];
  onAdd: (name: string, type: TransactionType) => void;
  onDelete: (id: string) => void;
}

export function Categories({ categories, onAdd, onDelete }: CategoriesProps) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TransactionType>('expense');
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      setError('Category name is required.');
      return;
    }
    const duplicate = categories.some(
      (c) =>
        c.type === newType && c.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setError(`A ${newType} category named "${name}" already exists.`);
      return;
    }
    onAdd(name, newType);
    setNewName('');
    setError('');
  };

  const pendingCategory = categories.find((c) => c.id === pendingDeleteId);

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Add Custom Category
        </h2>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-start">
          <select
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value as TransactionType);
              setError('');
            }}
            className="px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <div className="flex-1 min-w-[180px]">
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError('');
              }}
              placeholder="e.g. Subscriptions"
              maxLength={32}
              className={`w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition dark:bg-slate-700/50 dark:text-slate-100 dark:placeholder:text-slate-500 ${
                error
                  ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20'
                  : 'border-slate-200 dark:border-slate-600 bg-white'
              }`}
            />
            {error && (
              <p className="mt-1 text-xs text-rose-500">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={15} />
            Add Category
          </button>
        </form>
      </div>

      {/* Category lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <CategorySection
          title="Expense Categories"
          categories={expenseCategories}
          accentClass="bg-rose-500"
          onDelete={(id) => setPendingDeleteId(id)}
        />
        <CategorySection
          title="Income Categories"
          categories={incomeCategories}
          accentClass="bg-emerald-500"
          onDelete={(id) => setPendingDeleteId(id)}
        />
      </div>

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) {
            onDelete(pendingDeleteId);
            setPendingDeleteId(null);
          }
        }}
        title="Delete Category"
        message={`Remove "${pendingCategory?.name ?? ''}"? Existing transactions with this category will not be affected.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  categories: Category[];
  accentClass: string;
  onDelete: (id: string) => void;
}

function CategorySection({
  title,
  categories,
  accentClass,
  onDelete,
}: CategorySectionProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        {categories.length === 0 && (
          <p className="px-6 py-8 text-sm text-slate-400 dark:text-slate-500 text-center">
            No categories yet.
          </p>
        )}
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between px-4 sm:px-6 py-3 group hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-lg ${accentClass} flex items-center justify-center text-white text-[10px] font-bold`}
              >
                {cat.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {cat.name}
              </span>
              {cat.isDefault && (
                <span
                  title="Global default — available in all workspaces"
                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full font-medium"
                >
                  <Globe size={9} />
                  default
                </span>
              )}
              {!cat.isDefault && !cat.isCustom && (
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full font-medium">
                  built-in
                </span>
              )}
            </div>
            {cat.isCustom && (
              <button
                onClick={() => onDelete(cat.id)}
                title="Delete category"
                className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
