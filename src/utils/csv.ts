import type { Transaction } from '../types';
import { categorizeFromSector, categorize } from './categorizer';

// ── Column alias map ─────────────────────────────────────────────────────────
//
// Maps any known header variant (Hebrew, English alternate spellings) to the
// canonical field name used internally.  Keys are matched case-insensitively
// after trimming surrounding whitespace and quotes.
//
// Add rows here to support additional bank/card export formats.

const COLUMN_ALIASES: Record<string, string> = {
  // ── Hebrew (Israeli credit card / bank exports) ───────────────────────────
  'תאריך עסקה':       'date',
  'תאריך רכישה':      'date',
  'תאריך ביצוע':      'date',
  'תאריך פעולה':      'date',
  'תאריך':            'date',
  'שם בית עסק':       'description',
  'שם בית העסק':      'description',
  'בית עסק':          'description',
  'פירוט':            'description',
  'תיאור':            'description',
  'תיאור עסקה':       'description',
  'סכום חיוב':        'amount',
  'סכום עסקה':        'amount',
  'סכום בש"ח':        'amount',
  'סכום':             'amount',
  'חיוב':             'amount',
  'סוג עסקה':         'type',
  'סוג':              'type',
  'ענף':              'category',
  'ענף מסחר':         'category',
  'קטגוריה':          'category',

  // ── English alternate spellings ───────────────────────────────────────────
  'transaction date':  'date',
  'posting date':      'date',
  'trans date':        'date',
  'value date':        'date',
  'merchant':          'description',
  'merchant name':     'description',
  'payee':             'description',
  'memo':              'description',
  'narrative':         'description',
  'details':           'description',
  'charge amount':     'amount',
  'transaction amount':'amount',
  'debit amount':      'amount',
  'debit':             'amount',
  'transaction type':  'type',
  'trans type':        'type',
  'sector':            'category',
  'mcc':               'category',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function isHebrew(s: string): boolean {
  return /[\u0590-\u05FF]/.test(s);
}

/** Normalize a raw column header to a canonical field name, or return it lowercased. */
function normalizeHeader(raw: string): { canonical: string; wasHebrew: boolean } {
  const cleaned = raw.trim().replace(/^["'\uFEFF]+|["']+$/g, ''); // strip BOM, quotes
  const wasHebrew = isHebrew(cleaned);

  // Try exact match first, then case-insensitive
  const canonical =
    COLUMN_ALIASES[cleaned] ??
    COLUMN_ALIASES[cleaned.toLowerCase()] ??
    cleaned.toLowerCase();

  return { canonical, wasHebrew };
}

/**
 * Parse a date string into YYYY-MM-DD.
 *
 * Handles:
 *   YYYY-MM-DD          (ISO — pass through)
 *   DD/MM/YYYY          (Israeli / European — preferDDMM = true)
 *   MM/DD/YYYY          (US)
 *   DD.MM.YYYY          (dot separator)
 *   D/M/YY              (two-digit year)
 *
 * When `preferDDMM` is true and the date is ambiguous (both parts ≤ 12),
 * the first number is treated as the day (Israeli convention).
 */
function parseDate(raw: string, preferDDMM: boolean): string {
  const s = raw.trim().replace(/^["']+|["']+$/g, '').split(/[\sT]/)[0]; // strip time

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; // already ISO

  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return s; // unrecognised — return as-is, will fail validation later

  let a = parseInt(m[1], 10);
  let b = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += 2000;

  let day: number, month: number;

  if (a > 12 && b <= 12) {
    // Unambiguously DD/MM
    [day, month] = [a, b];
  } else if (b > 12 && a <= 12) {
    // Unambiguously MM/DD
    [day, month] = [b, a];
  } else {
    // Ambiguous — honour the format preference
    [day, month] = preferDDMM ? [a, b] : [b, a];
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return s;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Clean and parse an amount string.
 *
 * Removes currency symbols (₪ $ € £ ¥), thousands commas, surrounding quotes.
 * Treats parentheses and a trailing minus as negative values.
 * Returns a positive number; the sign is conveyed via `isNegative`.
 */
function parseAmount(raw: string): { value: number; isNegative: boolean } {
  const s = raw.trim().replace(/^["']+|["']+$/g, '');

  const trailingMinus = s.endsWith('-');
  const leadingMinus  = s.startsWith('-') || s.startsWith('(');

  const cleaned = s
    .replace(/[₪$€£¥,\s]/g, '')    // currency symbols + commas
    .replace(/[()]/g, '')            // parentheses
    .replace(/^-/, '')               // leading minus
    .replace(/-$/, '');              // trailing minus

  const value = parseFloat(cleaned);
  if (isNaN(value)) throw new Error(`Cannot parse amount: "${raw}"`);

  return { value: Math.abs(value), isNegative: leadingMinus || trailingMinus };
}

/**
 * Determine transaction type from:
 *   1. Explicit `type` column value (Hebrew or English)
 *   2. Whether the parsed amount was negative (refund / credit)
 *
 * Hebrew credit indicators: זיכוי (refund), החזר (return)
 * Hebrew debit  indicators: רגיל, תשלומים, קרדיט, חיוב
 */
function parseType(
  rawType: string | undefined,
  isNegativeAmount: boolean
): 'income' | 'expense' {
  if (rawType) {
    const v = rawType.trim();
    if (/זיכוי|החזר|refund|credit(?!\s*card)/i.test(v)) return 'income';
    if (/רגיל|תשלומים|קרדיט|חיוב|debit|charge|expense/i.test(v))
      return 'expense';
  }
  // Negative amounts on a credit card statement → payment or refund
  return isNegativeAmount ? 'income' : 'expense';
}

// ── Default category list (always available even before user customises) ─────
const DEFAULT_CATEGORY_NAMES = [
  'Food', 'Rent', 'Transport', 'Entertainment',
  'Shopping', 'Health', 'Other',
  'Salary', 'Freelance', 'Gifts',
];

// ── Public API ────────────────────────────────────────────────────────────────

export function exportToCSV(transactions: Transaction[]): void {
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const headers = ['Date', 'Type', 'Category', 'Amount', 'Description'];
  const rows = transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      t.date,
      t.type,
      t.category,
      t.amount.toFixed(2),
      `"${t.description.replace(/"/g, '""')}"`,
    ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV string (any supported format) into transactions.
 *
 * Supported column sets:
 *   Standard English:  date, type, category, amount[, description]
 *   Israeli Hebrew:    תאריך עסקה, שם בית עסק, סכום חיוב[, סוג עסקה][, ענף]
 *   Mixed / aliased:   any combination of the column aliases above
 *
 * Date formats:   YYYY-MM-DD · DD/MM/YYYY · MM/DD/YYYY · DD.MM.YYYY
 * Amount formats: 42.50 · ₪42.50 · 1,234.56 · (42.50) · 42.50-
 * Type values:    expense · income · רגיל · זיכוי · תשלומים · …
 */
export function parseCSV(
  text: string,
  learnedRules?: Record<string, string>
): Omit<Transaction, 'id' | 'createdAt'>[] {
  // Strip BOM that Excel sometimes adds to UTF-8 files
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/);

  // ── Find the header row ─────────────────────────────────────────────────
  // Skip blank lines and lines that don't resolve any known column name.
  // This handles bank exports that include a title row or empty rows above
  // the actual column headers.
  const KNOWN_CANONICAL = new Set(['date', 'description', 'amount', 'type', 'category']);

  function isHeaderLine(line: string): boolean {
    if (!line.trim()) return false;
    const cols = parseCSVLine(line);
    return cols.some((c) => KNOWN_CANONICAL.has(normalizeHeader(c).canonical));
  }

  const headerLineIdx = lines.findIndex(isHeaderLine);
  if (headerLineIdx === -1) {
    throw new Error(
      'Could not find a header row with recognised column names.\n' +
      'Expected at minimum: date, amount, description (or their Hebrew equivalents).'
    );
  }
  if (headerLineIdx === lines.length - 1) {
    throw new Error('CSV must have a header row and at least one data row.');
  }

  // ── Normalise header ────────────────────────────────────────────────────
  const rawHeaders = parseCSVLine(lines[headerLineIdx]);
  let anyHebrew = false;

  const normalised = rawHeaders.map((h) => {
    const { canonical, wasHebrew } = normalizeHeader(h);
    if (wasHebrew) anyHebrew = true;
    return canonical;
  });

  const idx = (name: string): number => normalised.indexOf(name);

  const dateIdx = idx('date');
  const descIdx = idx('description');
  const amtIdx  = idx('amount');
  const typeIdx = idx('type');
  const catIdx  = idx('category');

  if (dateIdx === -1 || amtIdx === -1 || descIdx === -1) {
    const missing = [
      dateIdx === -1 && 'date (תאריך עסקה)',
      amtIdx  === -1 && 'amount (סכום חיוב)',
      descIdx === -1 && 'description (שם בית עסק)',
    ].filter(Boolean);
    throw new Error(
      `CSV is missing required columns: ${missing.join(', ')}.\n` +
      'Expected at minimum: date, amount, description (or their Hebrew equivalents).'
    );
  }

  // Hebrew CSVs use DD/MM/YYYY; English CSVs use YYYY-MM-DD or MM/DD/YYYY
  const preferDDMM = anyHebrew;

  // ── Parse rows ──────────────────────────────────────────────────────────
  const results: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = parseCSVLine(line);
    const rowLabel = `Row ${i + 1}`;

    // Date
    const rawDate = cols[dateIdx]?.trim() ?? '';
    if (!rawDate) throw new Error(`${rowLabel}: date is empty.`);
    const date = parseDate(rawDate, preferDDMM);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        `${rowLabel}: cannot parse date "${rawDate}". ` +
        'Expected DD/MM/YYYY, MM/DD/YYYY, or YYYY-MM-DD.'
      );
    }

    // Amount
    const rawAmt = cols[amtIdx]?.trim() ?? '';
    if (!rawAmt) throw new Error(`${rowLabel}: amount is empty.`);
    let parsedAmount: { value: number; isNegative: boolean };
    try {
      parsedAmount = parseAmount(rawAmt);
    } catch (e) {
      throw new Error(`${rowLabel}: ${(e as Error).message ?? `cannot parse amount "${rawAmt}".`}`);
    }
    if (parsedAmount.value === 0) {
      throw new Error(`${rowLabel}: amount must be non-zero.`);
    }

    // Type
    const rawType = typeIdx >= 0 ? cols[typeIdx]?.trim() : undefined;
    const type    = parseType(rawType, parsedAmount.isNegative);

    // Description
    const description = (cols[descIdx]?.trim() ?? '').replace(/^["']+|["']+$/g, '');

    // Category — map Hebrew sector if present, otherwise auto-detect
    let category = 'Other';
    if (catIdx >= 0 && cols[catIdx]?.trim()) {
      const rawCat = cols[catIdx].trim().replace(/^["']+|["']+$/g, '');
      category = isHebrew(rawCat)
        ? categorizeFromSector(rawCat, DEFAULT_CATEGORY_NAMES, learnedRules)
        : categorize(rawCat, DEFAULT_CATEGORY_NAMES, learnedRules);
    } else {
      // No category column — infer from description
      category = categorize(description, DEFAULT_CATEGORY_NAMES, learnedRules);
    }

    results.push({
      date,
      type,
      amount: Math.round(parsedAmount.value * 100) / 100,
      category,
      description,
    });
  }

  return results;
}

// ── CSV line parser (handles quoted fields with embedded commas/newlines) ─────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
