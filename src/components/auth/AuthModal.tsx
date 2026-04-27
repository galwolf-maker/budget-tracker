import { useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
}

type Tab = 'signin' | 'signup';

export function AuthModal({
  isOpen,
  onClose,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
}: AuthModalProps) {
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setConfirmation(false);
    setLoading(false);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (tab === 'signin') {
      const err = await signInWithEmail(email, password);
      if (err) { setError(err); setLoading(false); }
      else onClose();
    } else {
      const { error: err, needsConfirmation } = await signUpWithEmail(email, password);
      if (err) { setError(err); setLoading(false); }
      else if (needsConfirmation) { setConfirmation(true); setLoading(false); }
      else onClose();
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    // Page will redirect; no need to set loading back
  };

  const inputBase =
    'w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {tab === 'signin' ? 'Sign in to sync data' : 'Create an account'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Confirmation state */}
          {confirmation ? (
            <div className="text-center space-y-3 py-4">
              <div className="text-4xl">📧</div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Check your email
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                We sent a confirmation link to <strong>{email}</strong>.
                Click it to finish signing up, then come back here.
              </p>
              <button
                onClick={() => { switchTab('signin'); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                {(['signin', 'signup'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      tab === t
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {t === 'signin' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
              >
                <Chrome size={16} className="text-blue-500" />
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <hr className="flex-1 border-slate-200 dark:border-slate-600" />
                <span className="text-xs text-slate-400">or</span>
                <hr className="flex-1 border-slate-200 dark:border-slate-600" />
              </div>

              {/* Email/Password form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email */}
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    required
                    className={inputBase}
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                    required
                    className={`${inputBase} pr-9`}
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

                {/* Confirm password (sign up only) */}
                {tab === 'signup' && (
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      required
                      className={inputBase}
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading
                    ? 'Please wait…'
                    : tab === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                Your existing data will be synced automatically after sign-in.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
