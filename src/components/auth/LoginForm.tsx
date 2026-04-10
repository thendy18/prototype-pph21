'use client';

import { useActionState } from 'react';
import { login } from '../../actions/authActions';
import type { LoginFormState } from '../../types/auth';

const INITIAL_STATE: LoginFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, INITIAL_STATE);

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Email
        </label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          className="w-full bg-transparent text-sm text-slate-100 outline-none"
          placeholder="user@company.com"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          className="w-full bg-transparent text-sm text-slate-100 outline-none"
          placeholder="********"
        />
      </div>

      {state.error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
      >
        {pending ? 'Masuk...' : 'Masuk'}
      </button>
    </form>
  );
}
