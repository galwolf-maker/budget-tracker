import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Wallet, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Status = 'loading' | 'ready' | 'saving' | 'success' | 'error';

interface ResetPasswordPageProps {
  onDone: () => void;
}

export function ResetPasswordPage({ onDone }: ResetPasswordPageProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatus('error');
      setErrorMessage('Authentication service is not configured.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error_description') ?? params.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(decodeURIComponent(errorParam.replace(/\+/g, ' ')));
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        // Clean up URL so refresh doesn't re-exchange
        const clean = new URL(window.location.href);
        clean.searchParams.delete('code');
        clean.searchParams.delete('reset');
        window.history.replaceState({}, '', clean.toString());

        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
        } else {
          setStatus('ready');
        }
      });
    } else {
      // Hash/implicit flow — session already available
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        window.history.replaceState({}, '', window.location.pathname);
        if (error || !session) {
          setStatus('error');
          setErrorMessage(error?.message ?? 'Reset link may have expired. Please request a new one.');
        } else {
          setStatus('ready');
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (password.length < 6) { setFormError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setFormError('Passwords do not match.'); return; }

    setStatus('saving');
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) {
      setStatus('ready');
      setFormError(error.message);
    } else {
      setStatus('success');
    }
  };

  const inputBase =
    'w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
          <Wallet size={26} className="text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Verifying link…</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Hang tight, this only takes a moment.</p>
          </>
        )}

        {(status === 'ready' || status === 'saving') && (
          <form onSubmit={handleSubmit} className="text-left space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Set new password</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Choose a strong password for your account.</p>
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                required
                className={inputBase}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                className={inputBase}
              />
            </div>

            {formError && (
              <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'saving'}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none disabled:opacity-50"
            >
              {status === 'saving' ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Password updated!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              You're all set. You can now sign in with your new password.
            </p>
            <button
              onClick={onDone}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-sm shadow-blue-200 dark:shadow-none"
            >
              Go to app →
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Link expired</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {errorMessage ?? 'This reset link is invalid or has expired. Please request a new one.'}
            </p>
            <button
              onClick={onDone}
              className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors"
            >
              ← Back to app
            </button>
          </>
        )}
      </div>
    </div>
  );
}
