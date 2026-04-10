import Link from 'next/link';
import type { CurrentUserProfile } from '../../types/auth';
import { LogoutButton } from './LogoutButton';

export function AppHeader({
  currentUser,
}: {
  currentUser: CurrentUserProfile;
}) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/95">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bulk" className="text-lg font-black tracking-tight text-indigo-400">
            Payroll Coretax
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/bulk"
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200"
            >
              Payroll
            </Link>
            {currentUser.role === 'master' && (
              <Link
                href="/users"
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200"
              >
                Users
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-slate-100">{currentUser.fullName}</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              {currentUser.role}
            </div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
