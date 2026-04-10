import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <div className="max-w-xl rounded-[28px] border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.35em] text-rose-400">
          Unauthorized
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Akses Ditolak</h1>
        <p className="mt-3 text-sm text-slate-400">
          Role akun Anda tidak memiliki izin untuk membuka halaman atau aksi tersebut.
        </p>
        <div className="mt-6">
          <Link
            href="/bulk"
            className="inline-flex rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"
          >
            Kembali ke Payroll
          </Link>
        </div>
      </div>
    </main>
  );
}
