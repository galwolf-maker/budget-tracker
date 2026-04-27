import { createContext, useCallback, useContext } from 'react';
import { formatCurrency } from '../utils/formatters';

export type Currency = 'USD' | 'ILS' | 'EUR';

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$',  label: 'US Dollar' },
  { code: 'ILS', symbol: '₪', label: 'Israeli Shekel' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
];

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
});

export function useCurrencyContext() {
  return useContext(CurrencyContext);
}

/** Returns a pre-bound formatter — components just call fmt(amount). */
export function useCurrencyFormat() {
  const { currency } = useCurrencyContext();
  return useCallback((amount: number) => formatCurrency(amount, currency), [currency]);
}
