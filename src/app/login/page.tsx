import { redirect } from 'next/navigation';
import { LoginForm } from '../../components/auth/LoginForm';
import { getCurrentUserProfile } from '../../lib/auth';

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string | string[];
  }>;
};

function readReasonMessage(reason: string | undefined): string | null {
  if (reason === 'signin') {
    return 'Silakan login untuk mengakses aplikasi.';
  }

  if (reason === 'inactive') {
    return 'Akun Anda sedang nonaktif atau tidak memiliki akses aplikasi.';
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const currentUser = await getCurrentUserProfile();
  if (currentUser) {
    redirect('/bulk');
  }

  const params = await searchParams;
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const reasonMessage = readReasonMessage(reason);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-[28px] border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8 space-y-2">
          <div className="text-[11px] font-black uppercase tracking-[0.35em] text-indigo-400">
            Internal Access
          </div>
          <h1 className="text-3xl font-black tracking-tight">Payroll Coretax</h1>
          <p className="text-sm text-slate-400">
            Login untuk mengakses modul payroll, export, dan manajemen user.
          </p>
        </div>

        {reasonMessage && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {reasonMessage}
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
