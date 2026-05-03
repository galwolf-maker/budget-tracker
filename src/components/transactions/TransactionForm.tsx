import { useState } from 'react';
import { RefreshCw, ChevronLeft, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { getTodayString } from '../../utils/formatters';
import type { Transaction, TransactionType, Category } from '../../types';

// ── Date utilities ─────────────────────────────────────────────────────────────

/**
 * Generate one YYYY-MM-DD string per calendar month across the range
 * [-monthsBack … +monthsForward] relative to baseDate.
 * If the base day doesn't exist in the target month (e.g. Jan 31 → Feb),
 * clamps to the last day of that month.
 */
function generateMonthlyDates(
  baseDate: string,
  monthsBack: number,
  monthsForward: number
): string[] {
  const [y, m, d] = baseDate.split('-').map(Number);
  const dates: string[] = [];
  for (let offset = -monthsBack; offset <= monthsForward; offset++) {
    let tYear  = y;
    let tMonth = m + offset;
    while (tMonth > 12) { tMonth -= 12; tYear++; }
    while (tMonth < 1)  { tMonth += 12; tYear--; }
    const maxDay = new Date(tYear, tMonth, 0).getDate();
    const tDay   = Math.min(d, maxDay);
    dates.push(
      `${tYear}-${String(tMonth).padStart(2, '0')}-${String(tDay).padStart(2, '0')}`
    );
  }
  return dates;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface TransactionFormProps {
  transaction: Transaction | null;
  getCategoriesForType: (type: TransactionType) => Category[];
  /** Passed for duplicate detection in recurring mode */
  existingTransactions?: Transaction[];
  onSubmit: (data: Omit<Transaction, 'id' | 'createdAt'>) => void;
  /** Called when the user confirms a recurring batch; receives only the non-duplicate dates */
  onSubmitRecurring?: (
    data: Omit<Transaction, 'id' | 'createdAt'>,
    dates: string[]
  ) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  amount?: string;
  category?: string;
  date?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TransactionForm({
  transaction,
  getCategoriesForType,
  existingTransactions = [],
  onSubmit,
  onSubmitRecurring,
  onCancel,
}: TransactionFormProps) {
  // ── Field state ───────────────────────────────────────────────────────────
  const [type, setType]               = useState<TransactionType>(transaction?.type ?? 'expense');
  const [amount, setAmount]           = useState(transaction?.amount.toString() ?? '');
  const [category, setCategory]       = useState(transaction?.category ?? '');
  const [date, setDate]               = useState(transaction?.date ?? getTodayString());
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [errors, setErrors]           = useState<FormErrors>({});

  // ── Recurring state (new transactions only) ───────────────────────────────
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [monthsBack, setMonthsBack]             = useState(0);
  const [monthsForward, setMonthsForward]       = useState(0);

  // ── Confirmation phase state ──────────────────────────────────────────────
  const [phase, setPhase]               = useState<'edit' | 'confirm'>('edit');
  const [confirmedDates, setConfirmedDates] = useState<string[]>([]);
  const [duplicateDates, setDuplicateDates] = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);

  const isNew               = !transaction;
  const availableCategories = getCategoriesForType(type);
  const totalMonths         = monthsBack + 1 + monthsForward;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clearError = (field: keyof FormErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  const validate = (): boolean => {
    const next: FormErrors = {};
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num <= 0) next.amount = 'Enter a valid amount greater than $0.00';
    if (!category) next.category = 'Please select a category';
    if (!date) next.date = 'Please select a date';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const baseInput =
    'w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition dark:bg-slate-700/50 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500';

  const inputClass = (error?: string) =>
    `${baseInput} ${
      error
        ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300'
        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100'
    }`;

  // ── Submit (edit phase) ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const parsedAmount = Math.round(parseFloat(amount) * 100) / 100;
    const desc         = description.trim();

    // Recurring batch path: go to confirmation step
    if (isNew && recurringEnabled && onSubmitRecurring && (monthsBack > 0 || monthsForward > 0)) {
      const dates = generateMonthlyDates(date, monthsBack, monthsForward);
      const descLower = desc.toLowerCase();

      const dupes = new Set<string>(
        dates.filter((d) => {
          const month = d.substring(0, 7);
          return existingTransactions.some(
            (t) =>
              t.date.substring(0, 7) === month &&
              Math.abs(t.amount - parsedAmount) < 0.01 &&
              t.type === type &&
              t.category === category &&
              t.description.trim().toLowerCase() === descLower
          );
        })
      );

      setConfirmedDates(dates);
      setDuplicateDates(dupes);
      setPhase('confirm');
      return;
    }

    // Single transaction path (unchanged)
    onSubmit({
      type,
      amount:      parsedAmount,
      category,
      date,
      description: desc,
      isRecurring: transaction?.isRecurring,
    });
  };

  // ── Confirm recurring batch ───────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!onSubmitRecurring) return;
    const nonDupeDates = confirmedDates.filter((d) => !duplicateDates.has(d));
    if (nonDupeDates.length === 0) { onCancel(); return; }
    setSaving(true);
    await onSubmitRecurring(
      {
        type,
        amount:      Math.round(parseFloat(amount) * 100) / 100,
        category,
        date,
        description: description.trim(),
        isRecurring: true,
      },
      nonDupeDates
    );
    setSaving(false);
  };

  const handleTypeChange = (next: TransactionType) => { setType(next); setCategory(''); };

  // ════════════════════════════════════════════════════════════════════════════
  // CONFIRM PHASE
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'confirm') {
    const nonDupes     = confirmedDates.filter((d) => !duplicateDates.has(d));
    const parsedAmount = Math.round(parseFloat(amount) * 100) / 100;
    const firstDate    = confirmedDates[0];
    const lastDate     = confirmedDates[confirmedDates.length - 1];

    return (
      <div className="space-y-4">
        {/* Back */}
        <button
          type="button"
          onClick={() => setPhase('edit')}
          disabled={saving}
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          <ChevronLeft size={15} />
          Back to edit
        </button>

        {/* Summary card */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            {confirmedDates.length} recurring transaction{confirmedDates.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
            {fmtDate(firstDate)} → {fmtDate(lastDate)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {parsedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} · {category} · {type}
          </p>
        </div>

        {/* Duplicate warning */}
        {duplicateDates.size > 0 && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {duplicateDates.size} month{duplicateDates.size !== 1 ? 's' : ''} already{' '}
              ha{duplicateDates.size === 1 ? 's' : 've'} a matching transaction and will be skipped.
            </p>
          </div>
        )}

        {/* Date list */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Dates ({nonDupes.length} to create
            {duplicateDates.size > 0 ? `, ${duplicateDates.size} skipped` : ''})
          </p>
          <ul className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {confirmedDates.map((d) => {
              const isDupe = duplicateDates.has(d);
              return (
                <li
                  key={d}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
                    isDupe
                      ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{fmtDate(d)}</span>
                  {isDupe
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500">skip</span>
                    : <Check size={12} className="text-emerald-500" />
                  }
                </li>
              );
            })}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || nonDupes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create {nonDupes.length} transaction{nonDupes.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EDIT PHASE
  // ════════════════════════════════════════════════════════════════════════════
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
        {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
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
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        {errors.category && <p className="mt-1 text-xs text-rose-500">{errors.category}</p>}
      </div>

      {/* Date — no future cap when creating recurring months forward */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Date
        </label>
        <input
          type="date"
          value={date}
          max={recurringEnabled && monthsForward > 0 ? undefined : getTodayString()}
          onChange={(e) => { setDate(e.target.value); clearError('date'); }}
          className={inputClass(errors.date)}
        />
        {errors.date && <p className="mt-1 text-xs text-rose-500">{errors.date}</p>}
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

      {/* ── Recurring section (new transactions only) ── */}
      {isNew && onSubmitRecurring && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-3">
          {/* Toggle row */}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-2.5">
              <RefreshCw
                size={15}
                className={recurringEnabled ? 'text-blue-500' : 'text-slate-400'}
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Recurring transaction
              </span>
            </div>
            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={recurringEnabled}
              onClick={() => setRecurringEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                recurringEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  recurringEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>

          {/* Expanded options */}
          {recurringEnabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Months before
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={monthsBack}
                    onChange={(e) =>
                      setMonthsBack(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))
                    }
                    className={`${baseInput} border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Months after
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={monthsForward}
                    onChange={(e) =>
                      setMonthsForward(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))
                    }
                    className={`${baseInput} border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100`}
                  />
                </div>
              </div>

              {/* Preview hint */}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Will create{' '}
                <strong className="text-slate-700 dark:text-slate-300">{totalMonths}</strong>{' '}
                transaction{totalMonths !== 1 ? 's' : ''} monthly
                {monthsBack > 0 && monthsForward > 0 && (
                  <> — {monthsBack} before, this month, {monthsForward} after</>
                )}
                {monthsBack > 0 && monthsForward === 0 && (
                  <> — {monthsBack} month{monthsBack !== 1 ? 's' : ''} before + this month</>
                )}
                {monthsBack === 0 && monthsForward > 0 && (
                  <> — this month + {monthsForward} month{monthsForward !== 1 ? 's' : ''} after</>
                )}
                .
              </p>
            </>
          )}
        </div>
      )}

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
          {isNew && recurringEnabled && (monthsBack > 0 || monthsForward > 0)
            ? `Preview ${totalMonths} month${totalMonths !== 1 ? 's' : ''}`
            : transaction
            ? 'Update Transaction'
            : 'Add Transaction'}
        </button>
      </div>
    </form>
  );
}
