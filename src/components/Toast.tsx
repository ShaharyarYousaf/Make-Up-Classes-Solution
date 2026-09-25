import React, { useEffect } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage, clearToast, undoLastReschedule, allocationHistory } = useTimetableStore();

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  const canUndo = allocationHistory.length > 0;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl bg-zinc-900 text-white border border-zinc-700 min-w-[320px] max-w-md">
        {toastMessage.type === 'success' ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : toastMessage.type === 'warning' ? (
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-blue-400 shrink-0" />
        )}

        <div className="flex-1 text-xs font-medium leading-snug">
          {toastMessage.text}
        </div>

        {canUndo && toastMessage.type === 'success' && (
          <button
            onClick={() => {
              undoLastReschedule();
              clearToast();
            }}
            className="flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 underline px-1 py-0.5"
          >
            <Undo2 className="w-3 h-3" />
            Undo
          </button>
        )}

        <button
          onClick={clearToast}
          className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
