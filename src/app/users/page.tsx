import { listAppUsers } from '../../lib/appUsers';
import { requireMasterProfile } from '../../lib/auth';
import { CreateUserForm } from './create-user-form';
import {
  ResetPasswordForm,
  RoleUpdateForm,
  UserStatusForm,
} from './user-action-forms';
import { UserToast } from './user-toast';

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

const PANEL_CLASS =
  'rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20';

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await requireMasterProfile();
  const users = await listAppUsers();
  const params = await searchParams;
  const successMessage = firstValue(params.success);
  const errorMessage = firstValue(params.error);

  return (
    <main className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className={PANEL_CLASS}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                Master User
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#FFE66D]">User Management</h1>
              <p className="mt-2 text-sm text-[#F7FFF7]/65">
                Kelola akun internal yang boleh mengakses aplikasi payroll.
              </p>
            </div>
            <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 py-3 text-sm text-[#F7FFF7]/70">
              Login sebagai <span className="font-bold text-[#F7FFF7]">{currentUser.email}</span>
            </div>
          </div>
        </section>

        <UserToast
          status={successMessage ? 'success' : errorMessage ? 'error' : null}
          message={successMessage ?? errorMessage}
        />

        <section className={PANEL_CLASS}>
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#F7FFF7]">
              Tambah User Baru
            </h2>
            <p className="mt-2 text-sm text-[#F7FFF7]/65">
              Master user membuat akun dan password awal untuk user baru.
            </p>
          </div>

          <CreateUserForm />
        </section>

        <section className={PANEL_CLASS}>
          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#F7FFF7]">
              Daftar User
            </h2>
            <p className="mt-2 text-sm text-[#F7FFF7]/65">
              Ubah role, aktif/nonaktifkan akun, dan reset password dari sini.
            </p>
          </div>

          <div className="grid gap-4">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-3xl border border-[#6CA6C1]/25 bg-[#343434]/75 p-5 shadow-lg shadow-black/15 transition-colors hover:border-[#6CA6C1]/55"
              >
                <div className="flex flex-col gap-4 border-b border-[#6CA6C1]/20 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-[#F7FFF7]">{user.fullName}</h3>
                      <span className="rounded-full border border-[#6CA6C1]/35 bg-[#2F3061]/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                        {user.role}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                          user.isActive
                            ? 'border border-[#6CA6C1]/35 bg-[#6CA6C1]/10 text-[#6CA6C1]'
                            : 'border border-[#FFE66D]/35 bg-[#FFE66D]/10 text-[#FFE66D]'
                        }`}
                      >
                        {user.isActive ? 'active' : 'inactive'}
                      </span>
                      {user.id === currentUser.id && (
                        <span className="rounded-full border border-[#FFE66D]/35 bg-[#FFE66D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-[#F7FFF7]/65">{user.email}</p>
                  </div>

                  <div className="text-[11px] text-[#F7FFF7]/45">
                    Dibuat: {new Date(user.createdAt).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <RoleUpdateForm userId={user.id} role={user.role} />
                  <UserStatusForm userId={user.id} isActive={user.isActive} />
                  <ResetPasswordForm userId={user.id} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
