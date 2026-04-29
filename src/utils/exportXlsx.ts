import * as XLSX from 'xlsx';
import type { Transaction } from '../types';

const HEBREW_HEADERS = ['תאריך', 'סוג', 'קטגוריה', 'סכום', 'תיאור'];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function translateType(type: 'income' | 'expense'): string {
  return type === 'income' ? 'הכנסה' : 'הוצאה';
}

// Auto-fit column widths based on content
function computeColWidths(data: (string | number)[][]): XLSX.ColInfo[] {
  const widths = HEBREW_HEADERS.map((h) => h.length + 2);
  for (const row of data) {
    row.forEach((cell, i) => {
      const len = String(cell).length;
      if (len > widths[i]) widths[i] = len;
    });
  }
  // Cap description at 50, minimum 10
  return widths.map((w, i) => ({ wch: Math.min(Math.max(w, 10), i === 4 ? 50 : 30) }));
}

export function exportToXlsx(transactions: Transaction[]): void {
  if (transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  // Build data rows (amount stays numeric for Excel to handle)
  const dataRows: (string | number)[][] = sorted.map((t) => [
    formatDate(t.date),
    translateType(t.type),
    t.category,
    t.amount,
    t.description,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([HEBREW_HEADERS, ...dataRows]);

  // ── RTL sheet view ────────────────────────────────────────────────────────
  ws['!views'] = [{ rightToLeft: true }];

  // ── Column widths ─────────────────────────────────────────────────────────
  ws['!cols'] = computeColWidths(dataRows);

  // ── Number format for amount column (column index 3) ─────────────────────
  // Israeli Shekel format: ₪1,234.56
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = 1; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (cell) {
      cell.t = 'n';
      cell.z = '[$₪-40D]#,##0.00';
    }
  }

  // ── Header row styles (bold + blue background) ────────────────────────────
  for (let c = 0; c <= 4; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      fill: { patternType: 'solid', fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', readingOrder: 2 },
      border: {
        bottom: { style: 'thin', color: { rgb: '1D4ED8' } },
      },
    };
  }

  // ── Workbook ──────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // ── File name: budget-report-YYYY-MM.xlsx ────────────────────────────────
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  XLSX.writeFile(wb, `budget-report-${month}.xlsx`);
}
