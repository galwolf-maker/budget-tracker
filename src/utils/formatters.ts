export function formatCurrency(amount: number, currency = 'USD'): string {
  const locale = currency === 'ILS' ? 'he-IL' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  // Append T12:00:00 to avoid timezone-induced day shift
  return new Date(dateString + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getTodayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function getMonthLabel(monthStr: string): string {
  return new Date(monthStr + '-02').toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
