'use client';

import { useEffect, useState } from 'react';

type UserToastProps = {
  status: 'success' | 'error' | null;
  message: string | null;
  nonce?: number;
};

export function UserToast({ status, message, nonce }: UserToastProps) {
  const toastKey = status && message ? `${status}:${message}:${nonce ?? 0}` : '';
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    if (!toastKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setDismissedKey(toastKey);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [toastKey]);

  if (!status || !message || dismissedKey === toastKey) {
    return null;
  }

  const isSuccess = status === 'success';

  return (
    <div className="fixed left-4 right-4 top-4 z-50 sm:left-auto sm:w-[420px]">
      <div
        role={isSuccess ? 'status' : 'alert'}
        className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl shadow-black/30 backdrop-blur ${
          isSuccess
            ? 'border-[#6CA6C1]/50 bg-[#2F3061]/95 text-[#F7FFF7]'
            : 'border-[#FFE66D]/50 bg-[#343434]/95 text-[#FFE66D]'
        }`}
      >
        <div className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70">
          {isSuccess ? 'Berhasil' : 'Perlu Dicek'}
        </div>
        <div className="mt-1">{message}</div>
      </div>
    </div>
  );
}
