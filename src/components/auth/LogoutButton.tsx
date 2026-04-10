'use client';

import { logout } from '../../actions/authActions';
import { usePayrollStore } from '../../store/usePayrollStore';

export function LogoutButton() {
  const resetStore = usePayrollStore((state) => state.resetStore);

  return (
    <form action={logout}>
      <button
        type="submit"
        onClick={() => resetStore()}
        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-200"
      >
        Logout
      </button>
    </form>
  );
}
