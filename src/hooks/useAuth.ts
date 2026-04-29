import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface UseAuthReturn {
  user: User | null;
  /** True while the initial session check is in flight */
  authLoading: boolean;
  isSupabaseConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<string | null>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    // Get the existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // React to sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase!.auth.signUp({ email, password });
    // needsConfirmation = sign-up succeeded but email not yet verified
    const needsConfirmation = !error && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  };

  const signInWithGoogle = async () => {
    await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase!.auth.signOut();
  };

  const resetPasswordForEmail = async (email: string): Promise<string | null> => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    });
    return error?.message ?? null;
  };

  return {
    user,
    authLoading,
    isSupabaseConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    resetPasswordForEmail,
  };
}
