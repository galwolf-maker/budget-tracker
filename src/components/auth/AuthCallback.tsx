import { useEffect, useState } from 'react';
import { XCircle, Loader2, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Status = 'loading' | 'error';

interface AuthCallbackProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export function AuthCallback({ onSuccess, onBackToLogin }: AuthCallbackProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // ── Log everything so we can debug in production ────────────────────────
    const fullUrl = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error_description') ?? params.get('error');

    console.log('[AuthCallback] URL:', fullUrl);
    console.log('[AuthCallback] pathname:', window.location.pathname);
    console.log('[AuthCallback] code present:', !!code);
    console.log('[AuthCallback] error param:', errorParam ?? 'none');

    // ── Supabase must be configured ─────────────────────────────────────────
    if (!supabase) {
      console.error('[AuthCallback] Supabase client is not configured');
      setStatus('error');
      setErrorMessage('Authentication service is not configured.');
      return;
    }

    // ── Provider returned an error (e.g. user cancelled) ────────────────────
    if (errorParam) {
      const msg = decodeURIComponent(errorParam.replace(/\+/g, ' '));
      console.error('[AuthCallback] Provider error:', msg);
      setStatus('error');
      setErrorMessage(msg);
      window.history.replaceState({}, '', '/');
      return;
    }

    // ── PKCE code-exchange flow (Google OAuth + email confirmation) ──────────
    if (code) {
      console.log('[AuthCallback] Exchanging code via full URL…');
      // Pass the ENTIRE href — supabase-js extracts both `code` and `state`
      // from it, which lets it locate the correct PKCE code-verifier in
      // localStorage. Passing only the raw code string loses the state and
      // causes "invalid_grant / verifier not found" failures.
      supabase.auth.exchangeCodeForSession(fullUrl).then(({ data, error }) => {
        // Clean the code out of the URL regardless of outcome
        window.history.replaceState({}, '', '/');

        if (error) {
          console.error('[AuthCallback] exchangeCodeForSession failed:', error.message);
          setStatus('error');
          setErrorMessage(error.message);
        } else {
          console.log('[AuthCallback] Session established for:', data.session?.user?.email);
          // Auto-navigate — no button click required
          onSuccess();
        }
      });
      return;
    }

    // ── Hash / implicit flow fallback (#access_token=…) ─────────────────────
    console.log('[AuthCallback] No code param — checking for existing session (hash flow)');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      window.history.replaceState({}, '', '/');

      if (error) {
        console.error('[AuthCallback] getSession error:', error.message);
        setStatus('error');
        setErrorMessage(error.message);
      } else if (session) {
        console.log('[AuthCallback] Existing session found for:', session.user.email);
        onSuccess();
      } else {
        console.warn('[AuthCallback] No code and no session — cannot authenticate');
        setStatus('error');
        setErrorMessage('Sign-in failed. Please try again.');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
          <Wallet size={26} className="text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Signing in…
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hang tight, this only takes a moment.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              Sign-in failed
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {errorMessage ?? 'Something went wrong. Please try again.'}
            </p>
            <button
              onClick={onBackToLogin}
              className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
            >
              ← Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
