/**
 * Parses Israeli credit-card Excel (.xlsx / .xls) exports into transactions.
 *
 * Supports the Visa/Cal/Max/Leumi-Card format where:
 *   - Column "תאריך עסקה"  → transaction date (Excel serial number)
 *   - Column "שם בית עסק"  → merchant name
 *   - Column "סכום חיוב"   → billing amount in ILS (preferred)
 *   - Column "סכום עסקה"   → transaction amount (fallback / foreign currency)
 *   - Column "סוג עסקה"    → transaction type ("זיכוי" = credit/refund)
 *   - Column "ענף"          → Hebrew sector (used for categorisation)
 */

import type { ParsedTransaction } from './statementParser';

export interface XlsxTransaction extends ParsedTransaction {
  /** Raw Hebrew sector string from the ענף column, e.g. "מסעדות" */
  sector?: string;
}

// ── Column detection patterns (ordered highest → lowest priority) ────────────

const DATE_PATTERNS   = [/תאריך[\s\S]*עסקה/u, /תאריך[\s\S]*רכישה/u, /תאריך/u];
const DESC_PATTERNS   = [/שם[\s\S]*בית[\s\S]*עסק/u, /תיאור[\s\S]*עסקה/u, /פירוט/u, /שם[\s\S]*עסק/u];
const AMOUNT_PATTERNS = [/סכום[\s\S]*חיוב/u, /סכום[\s\S]*עסקה/u, /סכום/u, /חיוב/u];
const TYPE_PATTERNS   = [/סוג[\s\S]*עסקה/u, /סוג/u];
const SECTOR_PATTERNS = [/^ענף$/u, /ענף/u, /קטגוריה/u];

function normalizeHeader(raw: unknown): string {
  return String(raw ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function matchCol(headers: string[], patterns: RegExp[]): number {
  for (const pat of patterns) {
    const idx = headers.findIndex((h) => pat.test(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Convert Excel serial date to YYYY-MM-DD using UTC arithmetic. */
function xlSerialToDate(serial: number): string {
  const utcMs = (serial - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(val: unknown): string | null {
  if (typeof val === 'number' && val > 1) {
    return xlSerialToDate(val);
  }
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const s = String(val ?? '').trim();
  // DD/MM/YY or DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

// ── Amount helpers ────────────────────────────────────────────────────────────

function parseAmount(val: unknown): { amount: number; isCredit: boolean } | null {
  if (typeof val === 'number') {
    if (val === 0) return null;
    return { amount: Math.abs(val), isCredit: val < 0 };
  }
  const s = String(val ?? '').replace(/[₪\s,]/g, '').replace(/[()]/g, '');
  const n = parseFloat(s);
  if (isNaN(n) || n === 0) return null;
  return { amount: Math.abs(n), isCredit: n < 0 };
}

// ── ID generator ──────────────────────────────────────────────────────────────

let _seq = 0;
function nextId(): string {
  return `xlsx-${Date.now()}-${++_seq}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lazily loads SheetJS and parses the first sheet of an xlsx/xls file.
 * Throws a descriptive error if the expected Hebrew headers cannot be found.
 */
export async function parseXlsx(file: File): Promise<XlsxTransaction[]> {
  _seq = 0;

  // Lazy-load xlsx so it doesn't affect the main bundle
  const XLSX = await import('xlsx');

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  // ── Find the header row ────────────────────────────────────────────────────
  let headerIdx = -1;
  let dateCol = -1, descCol = -1, amountCol = -1, typeCol = -1, sectorCol = -1;

  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const headers = (rawRows[i] as unknown[]).map(normalizeHeader);
    const dIdx = matchCol(headers, DATE_PATTERNS);
    const mIdx = matchCol(headers, DESC_PATTERNS);
    const aIdx = matchCol(headers, AMOUNT_PATTERNS);
    if (dIdx >= 0 && mIdx >= 0 && aIdx >= 0) {
      headerIdx = i;
      dateCol    = dIdx;
      descCol    = mIdx;
      amountCol  = aIdx;
      typeCol    = matchCol(headers, TYPE_PATTERNS);
      sectorCol  = matchCol(headers, SECTOR_PATTERNS);
      console.log('[BT xlsx] Detected headers at row', i, { headers, dateCol, descCol, amountCol, typeCol, sectorCol });
      break;
    }
  }

  if (headerIdx < 0) {
    throw new Error(
      'Could not detect transaction columns in this file.\n' +
      'Expected Hebrew headers: תאריך עסקה · שם בית עסק · סכום חיוב'
    );
  }

  // ── Parse data rows ────────────────────────────────────────────────────────
  const results: XlsxTransaction[] = [];

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] as unknown[];

    // Skip empty rows
    if (row.every((c) => c === '' || c == null)) continue;

    // Skip footer / summary rows (date cell must be a number or a date string)
    const rawDate = row[dateCol];
    if (typeof rawDate !== 'number' && !(rawDate instanceof Date)) {
      const ds = String(rawDate ?? '').trim();
      if (!ds || !/^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}$/.test(ds)) continue;
    }

    const date = parseDate(rawDate);
    if (!date) continue;

    const description = String(row[descCol] ?? '').trim();
    if (!description) continue;

    const amountResult = parseAmount(row[amountCol]);
    if (!amountResult) continue;

    // "זיכוי" in type column = credit / refund
    let isCredit = amountResult.isCredit;
    if (typeCol >= 0) {
      const typeStr = String(row[typeCol] ?? '').trim();
      if (/זיכוי/u.test(typeStr)) isCredit = true;
    }

    const sector = sectorCol >= 0 ? String(row[sectorCol] ?? '').trim() : undefined;

    results.push({
      id: nextId(),
      date,
      description,
      amount: amountResult.amount,
      isCredit,
      rawLine: (row as unknown[]).join('\t'),
      sector: sector || undefined,
    });
  }

  // Debug output
  console.log('[BT xlsx] First 5 parsed rows:', results.slice(0, 5).map(r =>
    `${r.date}  ${r.description}  ₪${r.amount}${r.isCredit ? ' [credit]' : ''}${r.sector ? `  [${r.sector}]` : ''}`
  ));
  console.log(`[BT xlsx] Total parsed: ${results.length} transactions`);

  return results;
}
