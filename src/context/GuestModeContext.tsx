import { createContext, useContext } from 'react';

interface GuestModeContextValue {
  isGuestMode: boolean;
  exitGuestMode: () => void;
}

export const GuestModeContext = createContext<GuestModeContextValue>({
  isGuestMode: false,
  exitGuestMode: () => {},
});

export function useGuestMode(): GuestModeContextValue {
  return useContext(GuestModeContext);
}
