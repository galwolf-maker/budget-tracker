import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type MerchantRules = Record<string, string>; // normalized description → category

function normalizeKey(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function useMerchantRules() {
  const [merchantRules, setMerchantRules] = useLocalStorage<MerchantRules>(
    'bt-merchant-rules',
    {}
  );

  const saveMerchantRule = useCallback(
    (description: string, category: string) => {
      if (!description.trim()) return;
      const key = normalizeKey(description);
      setMerchantRules((prev) => ({ ...prev, [key]: category }));
    },
    [setMerchantRules]
  );

  const applyMerchantRule = useCallback(
    (description: string): string | undefined => {
      return merchantRules[normalizeKey(description)];
    },
    [merchantRules]
  );

  return { merchantRules, saveMerchantRule, applyMerchantRule };
}
