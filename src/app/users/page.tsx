import {
  createUser,
  resetUserPassword,
  updateUserActiveStatus,
  updateUserRole,
} from '../../actions/userActions';
import { listAppUsers } from '../../lib/appUsers';
import { requireMasterProfile } from '../../lib/auth';

type UsersPageProps = {
  searchParams: Promise<{
    success?: string | string[];
    error?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await requireMasterProfile();
  const users = await listAppUsers();
  const params = await searchParams;
  const successMessage = firstValue(params.success);
  const errorMessage = firstValue(params.error);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-indigo-400">
                Master User
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">User Management</h1>
              <p className="mt-2 text-sm text-slate-400">
                Kelola akun internal yang boleh mengakses aplikasi payroll.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              Login sebagai <span className="font-bold text-white">{currentUser.email}</span>
            </div>
          </div>
        </section>

        {successMessage && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-200">
              Tambah User Baru
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Master user membuat akun dan password awal untuk user baru.
            </p>
          </div>

          <form action={createUser} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 xl:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Nama Lengkap
              </label>
              <input
                name="full_name"
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Nama user"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Email
              </label>
              <input
                name="email"
                type="email"
                className="w-full bg-transparent text-sm outline-none"
                placeholder="user@company.com"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Password Awal
              </label>
              <input
                name="password"
                type="password"
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Role
              </label>
              <select name="role" defaultValue="staff" className="w-full bg-transparent text-sm outline-none">
                <option value="staff">staff</option>
                <option value="master">master</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm xl:col-span-5">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              User aktif saat dibuat
            </label>

            <div className="xl:col-span-5">
              <button
                type="submit"
                className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"
              >
                Buat User
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-200">
              Daftar User
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Ubah role, aktif/nonaktifkan akun, dan reset password dari sini.
            </p>
          </div>

          <div className="grid gap-4">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5"
              >
                <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-white">{user.fullName}</h3>
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                          user.isActive
                            ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {user.isActive ? 'active' : 'inactive'}
                      </span>
                      {user.id === currentUser.id && (
                        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{user.email}</p>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Dibuat: {new Date(user.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <form action={updateUserRole} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <input type="hidden" name="user_id" value={user.id} />
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Ubah Role
                    </label>
                    <div className="flex gap-3">
                      <select
                        name="role"
                        defaultValue={user.role}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                      >
                        <option value="staff">staff</option>
                        <option value="master">master</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-[0.2em]"
                      >
                        Save
                      </button>
                    </div>
                  </form>

                  <form
                    action={updateUserActiveStatus}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={user.isActive ? 'false' : 'true'}
                    />
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Status Akun
                    </label>
                    <p className="mb-3 text-sm text-slate-400">
                      {user.isActive
                        ? 'Nonaktifkan user agar tidak bisa login.'
                        : 'Aktifkan kembali user agar bisa login.'}
                    </p>
                    <button
                      type="submit"
                      className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.2em] ${
                        user.isActive ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </form>

                  <form
                    action={resetUserPassword}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Reset Password
                    </label>
                    <div className="flex gap-3">
                      <input
                        name="password"
                        type="password"
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none"
                        placeholder="Password baru"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-700 px-4 py-2 text-xs font-black uppercase tracking-[0.2em]"
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
