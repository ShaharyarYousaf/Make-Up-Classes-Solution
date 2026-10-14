import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { CloudUpload, KeyRound, Lock, LogIn, LogOut, ShieldCheck, X } from 'lucide-react';
import { useTimetableStore } from '../store/timetableStore';
import { lockEditing, publishDataset, reloadFromDatabase, signIn, signOut, unlockWithPin } from '../lib/remoteSync';
import { REQUIRE_SIGN_IN } from '../lib/supabase';

const STATUS_TEXT: Record<string, string> = {
  local: 'No database configured – changes stay in this browser.',
  loading: 'Loading the shared timetable…',
  synced: 'Connected – changes are shared with everyone.',
  saving: 'Saving…',
  offline: 'Could not reach the database. Showing the last data this browser had.',
  empty: 'The database has no timetable yet. Unlock editing and publish the current one to fill it.',
};

const inputClass =
  'px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
const primaryButton =
  'flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold';
const secondaryButton =
  'flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60';

export const CoordinatorModal: React.FC = () => {
  const { isOpen, close, authEmail, canEdit, syncStatus, allocations, students, showToast } = useTimetableStore(
    useShallow((s) => ({
      isOpen: s.isCoordinatorModalOpen,
      close: s.closeCoordinatorModal,
      authEmail: s.authEmail,
      canEdit: s.canEdit,
      syncStatus: s.syncStatus,
      allocations: s.allocations.length,
      students: s.students.length,
      showToast: s.showToast,
    }))
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (success) showToast(success, 'success');
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = () => {
    const ok = window.confirm(
      `Replace the shared timetable for everyone with the one in this browser?\n\n${allocations} classes, ${students} students.`
    );
    if (ok) run(publishDataset, 'Timetable published to the shared database.');
  };

  const unlockedPanel = (
    <>
      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-emerald-900 dark:text-emerald-200 text-xs">
        {authEmail ? (
          <>
            Signed in as <strong>{authEmail}</strong>.{' '}
          </>
        ) : (
          <>Editing is unlocked on this browser. </>
        )}
        Reschedules, make-ups and imports are saved for everyone.
      </div>
      <button onClick={handlePublish} disabled={busy} className={primaryButton}>
        <CloudUpload className="w-4 h-4" />
        Publish this browser’s timetable to everyone
      </button>
      <div className="flex gap-2">
        <button
          onClick={() => run(reloadFromDatabase, 'Reloaded the shared timetable.')}
          disabled={busy}
          className={`flex-1 ${secondaryButton}`}
        >
          Reload from database
        </button>
        {authEmail ? (
          <button onClick={() => run(signOut)} disabled={busy} className={secondaryButton}>
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        ) : (
          <button
            onClick={() => {
              lockEditing();
              showToast('Editing locked on this browser.', 'info');
            }}
            className={secondaryButton}
            title="Forget the PIN on this browser"
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>
        )}
      </div>
    </>
  );

  const pinForm = (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await unlockWithPin(pin.trim());
          setPin('');
        }, 'Editing unlocked.');
      }}
    >
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Anyone can view the timetable. Enter the edit PIN to reschedule, add make-ups, delete or import data.
      </p>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        required
        autoFocus
        placeholder="Edit PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className={`${inputClass} text-center tracking-[0.5em] text-lg font-bold`}
      />
      <button type="submit" disabled={busy} className={primaryButton}>
        <KeyRound className="w-4 h-4" />
        {busy ? 'Checking…' : 'Unlock editing'}
      </button>
    </form>
  );

  const signInForm = (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => signIn(email.trim(), password), 'Signed in.');
      }}
    >
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Anyone can view the timetable. Sign in with your coordinator account to make changes.
      </p>
      <input type="email" required autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      <input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      <button type="submit" disabled={busy} className={primaryButton}>
        <LogIn className="w-4 h-4" />
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={close}>
      <div
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit access</h3>
          </div>
          <button onClick={close} aria-label="Close" className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 text-sm">
          <p className="text-xs text-gray-600 dark:text-gray-400">{STATUS_TEXT[syncStatus]}</p>
          {syncStatus === 'local' ? null : canEdit ? unlockedPanel : REQUIRE_SIGN_IN ? signInForm : pinForm}
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};
