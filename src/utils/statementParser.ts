/**
 * Parses raw text from a credit card statement into structured transactions.
 *
 * Handles the most common statement formats:
 *   01/15/2024  STARBUCKS #3456 SEATTLE WA        4.50
 *   Jan 15      UBER* TRIP HELP.UBER.COM          12.35
 *   15 JAN 24   AMAZON.COM*2X1234                99.99
 *   01/12       PAYMENT THANK YOU               -500.00
 *   01/11       NETFLIX.COM                      15.99 CR
 */

export interface ParsedTransaction {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Merchant / description as it appears in the statement */
  description: string;
  /** Always positive */
  amount: number;
  /**
   * true  → payment or refund (maps to "income" in the app)
   * false → charge            (maps to "expense")
   */
  isCredit: boolean;
  /** Original line, kept for debugging / manual correction */
  rawLine: string;
}

// ── Date helpers ────────────────────────────────────────────────────────────

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function resolveYear(raw: string | undefined): number {
  if (!raw) return new Date().getFullYear();
  let y = parseInt(raw, 10);
  if (y < 100) y += y > 50 ? 1900 : 2000;
  return y;
}

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

function toIso(year: number, month: string, day: string): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Try to extract a date from the *start* of `text`.
 * Returns { date, consumed } where `consumed` is the number of characters matched,
 * or null if no date pattern matched.
 */
function extractDateFromStart(
  text: string
): { date: string; consumed: number } | null {
  // ISO: 2024-01-15
  {
    const m = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m)
      return {
        date: toIso(parseInt(m[1]), m[2], m[3]),
        consumed: m[0].length,
      };
  }
  // MM/DD/YYYY, MM/DD/YY, MM/DD  — also handles DD/MM/YYYY (Israeli/European)
  {
    const m = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
    if (m) {
      let month = parseInt(m[1], 10);
      let day   = parseInt(m[2], 10);
      // If the first number is unambiguously a day (> 12), swap to DD/MM order
      if (month > 12 && day <= 12) {
        [month, day] = [day, month];
      }
      return {
        date: toIso(resolveYear(m[3]), String(month), String(day)),
        consumed: m[0].length,
      };
    }
  }
  // DD Mon YYYY  /  DD Mon YY  /  DD Mon
  {
    const m = text.match(
      /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*,?\s*(\d{2,4})?/i
    );
    if (m)
      return {
        date: toIso(
          resolveYear(m[3]),
          MONTH_ABBR[m[2].slice(0, 3).toLowerCase()],
          m[1]
        ),
        consumed: m[0].length,
      };
  }
  // Mon DD, YYYY  /  Mon DD YYYY  /  Mon DD
  {
    const m = text.match(
      /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{2,4}))?/i
    );
    if (m)
      return {
        date: toIso(
          resolveYear(m[3]),
          MONTH_ABBR[m[1].slice(0, 3).toLowerCase()],
          m[2]
        ),
        consumed: m[0].length,
      };
  }

  return null;
}

// ── Amount helpers ───────────────────────────────────────────────────────────

/**
 * Extract an amount from the *end* of `text`.
 * Returns { amount, isCredit, consumed } where consumed is chars from the end,
 * or null if not found.
 */
function extractAmountFromEnd(
  text: string
): { amount: number; isCredit: boolean; consumed: number } | null {
  // Matches patterns like:  4.50  $4.50  ₪4.50  -4.50  ($4.50)  4.50 CR
  // Also: amounts without decimals common in some Hebrew statements: 1,234
  const m = text.match(
    /(\(?-?[₪$€£¥]?\s*[\d,]+(?:\.\d{1,2})?\s*(?:CR|DR|זכות|חובה)?\)?)\s*$/
  );
  if (!m) return null;

  const raw = m[1].trim();
  // "זכות" = credit in Hebrew; "חובה" = debit
  const isCredit =
    /(?:CR|זכות)\s*$/iu.test(raw) ||
    raw.startsWith('(') ||
    raw.startsWith('-');

  const cleaned = raw
    .replace(/[₪$€£¥,\s()]/g, '')
    .replace(/(?:CR|DR|זכות|חובה)/gi, '')
    .replace(/^-/, '');
  const amount = parseFloat(cleaned);
  if (isNaN(amount) || amount <= 0) return null;

  return { amount, isCredit, consumed: m[0].length };
}

// ── Skip heuristics ──────────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  /^\s*$/,
  // English headers
  /^(date|description|amount|transaction|posting|reference|account|statement|page\s*\d|continued|subtotal|total|balance|payment due|minimum|opening|closing|previous|available|credit limit|rewards|points)/i,
  // Hebrew headers / footer phrases common in Israeli bank statements
  /^(תאריך|תיאור|סכום|חשבון|כרטיס|יתרה|סה"כ|עמוד|המשך|חיוב|זיכוי|פירוט)/u,
  /^\s*[-=_*]{3,}/,   // separator lines
  /^--- page break ---$/,
];

function shouldSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(line));
}

// ── ID generator ─────────────────────────────────────────────────────────────

let _seq = 0;
function nextId(): string {
  return `parsed-${Date.now()}-${++_seq}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse raw statement text and return an array of candidate transactions.
 * Lines that don't match the expected pattern are silently skipped.
 */
export function parseStatementText(text: string): ParsedTransaction[] {
  _seq = 0;
  const results: ParsedTransaction[] = [];

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    if (shouldSkipLine(rawLine)) continue;

    const line = rawLine.trim();
    if (line.length < 8) continue;

    // 1. Extract date from start
    const dateResult = extractDateFromStart(line);
    if (!dateResult) continue;

    let rest = line.slice(dateResult.consumed).trimStart();

    // 2. Some statements repeat the posting date right after the transaction date
    //    If the remaining text starts with another date, skip it
    const secondDate = extractDateFromStart(rest);
    if (secondDate) {
      rest = rest.slice(secondDate.consumed).trimStart();
    }

    // 3. Extract amount from end
    const amountResult = extractAmountFromEnd(rest);
    if (!amountResult) continue;

    const description = rest
      .slice(0, rest.length - amountResult.consumed)
      .trim()
      // Collapse multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Strip trailing state abbreviations like "  CA  " or "  NY"
      .replace(/\s+[A-Z]{2}\s*$/, '')
      .trim();

    if (!description || description.length < 2) continue;

    results.push({
      id: nextId(),
      date: dateResult.date,
      description,
      amount: amountResult.amount,
      isCredit: amountResult.isCredit,
      rawLine,
    });
  }

  return results;
}
