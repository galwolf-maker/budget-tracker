import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Currency } from '../context/CurrencyContext';

export function useCurrency(userId: string | null) {
  const [currency, _setCurrency] = useState<Currency>('USD');

  // Fetch saved currency from profiles when user signs in
  useEffect(() => {
    if (!userId || !supabase) return;
    supabase
      .from('profiles')
      .select('currency')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.currency) _setCurrency(data.currency as Currency);
      });
  }, [userId]);

  const setCurrency = useCallback(
    async (c: Currency) => {
      _setCurrency(c);
      if (userId && supabase) {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: userId, currency: c }, { onConflict: 'id' });
        if (error) console.error('[BT] Failed to save currency:', error);
      }
    },
    [userId]
  );

  return { currency, setCurrency };
}
