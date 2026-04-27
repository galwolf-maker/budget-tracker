import { useState } from 'react';
import { X, Mail, Copy, Check, Users, Crown, UserPlus } from 'lucide-react';
import type { HouseholdMember } from '../../types';

interface HouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdName: string;
  members: HouseholdMember[];
  currentUserId: string;
  onInvite: (email: string) => Promise<{ link: string } | { error: string }>;
}

export function HouseholdModal({
  isOpen,
  onClose,
  householdName,
  members,
  currentUserId,
  onInvite,
}: HouseholdModalProps) {
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { setError('Enter a valid email address.'); return; }

    setLoading(true);
    setError(null);
    const result = await onInvite(email);
    setLoading(false);

    if ('error' in result) {
      setError(result.error);
    } else {
      setInviteLink(result.link);
      setEmail('');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-slate-200/60 dark:ring-slate-700/60">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <Users size={17} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{householdName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Members list */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Members
            </p>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(m.fullName ?? m.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {m.fullName && (
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{m.fullName}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.userId === currentUserId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        you
                      </span>
                    )}
                    {m.role === 'owner' && (
                      <span title="Owner"><Crown size={13} className="text-amber-400" /></span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-slate-100 dark:border-slate-700" />

          {/* Invite form */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Invite a member
            </p>

            {inviteLink ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Share this link with your partner. It expires in 7 days.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 font-mono min-w-0"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => setInviteLink('')}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Invite another person
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="partner@email.com"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <UserPlus size={14} />
                    {loading ? '…' : 'Invite'}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-rose-500">{error}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  We'll generate a one-time invite link for you to share.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
