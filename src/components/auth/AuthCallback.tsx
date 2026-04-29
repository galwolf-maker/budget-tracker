import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Status = 'loading' | 'success' | 'error';

interface AuthCallbackProps {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

// Detect whether this is a Google/OAuth callback vs email confirmation
function isOAuthCallback(): boolean {
  return window.location.pathname.includes('/auth/callback');
}

export function AuthCallback({ onSuccess, onBackToLogin }: AuthCallbackProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const oauth = isOAuthCallback();

  useEffect(() => {
    console.log('[AuthCallback] URL:', window.location.href);
    console.log('[AuthCallback] pathname:', window.location.pathname);
    console.log('[AuthCallback] search:', window.location.search);
    console.log('[AuthCallback] hash:', window.location.hash);
    console.log('[AuthCallback] flow:', oauth ? 'OAuth/Google' : 'Email confirmation');

    if (!supabase) {
      setStatus('error');
      setErrorMessage('Authentication service is not configured.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error_description') ?? params.get('error');

    console.log('[AuthCallback] code present:', !!code);
    console.log('[AuthCallback] error param:', errorParam ?? 'none');

    if (errorParam) {
      const msg = decodeURIComponent(errorParam.replace(/\+/g, ' '));
      console.error('[AuthCallback] OAuth error from provider:', msg);
      setStatus('error');
      setErrorMessage(msg);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code) {
      console.log('[AuthCallback] Exchanging PKCE code for session…');
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        window.history.replaceState({}, '', '/');
        if (error) {
          console.error('[AuthCallback] exchangeCodeForSession failed:', error.message);
          setStatus('error');
          setErrorMessage(error.message);
        } else {
          console.log('[AuthCallback] Session established for:', data.session?.user?.email);
          setStatus('success');
        }
      });
    } else {
      // Legacy implicit/hash flow — supabase-js picks up #access_token automatically
      console.log('[AuthCallback] No code param — checking for existing session (hash flow)');
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        window.history.replaceState({}, '', '/');
        if (error) {
          console.error('[AuthCallback] getSession error:', error.message);
          setStatus('error');
          setErrorMessage(error.message);
        } else if (session) {
          console.log('[AuthCallback] Hash-flow session found for:', session.user.email);
          setStatus('success');
        } else {
          console.warn('[AuthCallback] No session found');
          setStatus('error');
          setErrorMessage(
            oauth
              ? 'Google sign-in failed. Please try again.'
              : 'Confirmation link may have expired. Please request a new one.'
          );
        }
      });
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
              {oauth ? 'Signing in with Google…' : 'Confirming your email…'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hang tight, this only takes a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {oauth ? 'Signed in!' : 'Email confirmed!'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {oauth ? 'Welcome back to BudgetTrack.' : 'Your account is ready. Welcome to BudgetTrack.'}
            </p>
            <button
              onClick={onSuccess}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
            >
              Continue to app →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              {oauth ? 'Google sign-in failed' : 'Confirmation failed'}
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
