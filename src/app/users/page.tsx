import {
  resetUserPassword,
  updateUserActiveStatus,
  updateUserRole,
} from '../../actions/userActions';
import { listAppUsers } from '../../lib/appUsers';
import { requireMasterProfile } from '../../lib/auth';
import { CreateUserForm } from './create-user-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const LABEL_CLASS =
  'text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/55';

const SELECT_TRIGGER_CLASS =
  'h-10 w-full rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 font-mono text-sm font-semibold text-[#F7FFF7] transition-all hover:border-[#6CA6C1] hover:bg-[#343434] focus:ring-2 focus:ring-[#6CA6C1]/25 data-[state=open]:border-[#6CA6C1] [&_svg]:text-[#6CA6C1]';

const SELECT_CONTENT_CLASS =
  'rounded-xl border border-[#6CA6C1]/30 bg-[#343434] font-mono text-[#F7FFF7] shadow-2xl shadow-black/40 [&_[data-slot=select-scroll-down-button]]:bg-[#343434] [&_[data-slot=select-scroll-down-button]]:text-[#6CA6C1] [&_[data-slot=select-scroll-up-button]]:bg-[#343434] [&_[data-slot=select-scroll-up-button]]:text-[#6CA6C1] [&_[data-slot=select-viewport]]:bg-[#343434]';

const SELECT_ITEM_CLASS =
  'cursor-pointer rounded-lg font-mono text-sm !text-[#F7FFF7] hover:bg-[#2F3061] hover:!text-[#FFE66D] focus:bg-[#2F3061] focus:!text-[#FFE66D] data-[highlighted]:bg-[#2F3061] data-[highlighted]:!text-[#FFE66D] data-[state=checked]:bg-[#6CA6C1]/20 data-[state=checked]:!text-[#FFE66D] [&_svg]:!text-[#FFE66D]';

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

        {successMessage && (
          <div className="rounded-2xl border border-[#6CA6C1]/40 bg-[#6CA6C1]/10 px-4 py-3 text-sm font-semibold text-[#F7FFF7]">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-[#FFE66D]/40 bg-[#FFE66D]/10 px-4 py-3 text-sm font-semibold text-[#FFE66D]">
            {errorMessage}
          </div>
        )}

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
                  <form action={updateUserRole} className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4">
                    <input type="hidden" name="user_id" value={user.id} />
                    <label className={`mb-2 block ${LABEL_CLASS}`}>
                      Ubah Role
                    </label>
                    <div className="flex gap-3">
                      <Select
                        name="role"
                        defaultValue={user.role}
                      >
                        <SelectTrigger className={`flex-1 ${SELECT_TRIGGER_CLASS}`}>
                          <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                        <SelectContent className={SELECT_CONTENT_CLASS}>
                          <SelectGroup>
                            <SelectItem value="staff" className={SELECT_ITEM_CLASS}>staff</SelectItem>
                            <SelectItem value="master" className={SELECT_ITEM_CLASS}>master</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        type="submit"
                        className="h-10 rounded-xl bg-[#6CA6C1] px-4 text-xs font-black uppercase tracking-[0.2em] text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
                      >
                        Save
                      </Button>
                    </div>
                  </form>

                  <form
                    action={updateUserActiveStatus}
                    className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4"
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={user.isActive ? 'false' : 'true'}
                    />
                    <label className={`mb-2 block ${LABEL_CLASS}`}>
                      Status Akun
                    </label>
                    <p className="mb-3 text-sm text-[#F7FFF7]/65">
                      {user.isActive
                        ? 'Nonaktifkan user agar tidak bisa login.'
                        : 'Aktifkan kembali user agar bisa login.'}
                    </p>
                    <Button
                      type="submit"
                      className={`h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.2em] focus-visible:ring-[#FFE66D]/30 ${
                        user.isActive
                          ? 'border border-[#FFE66D]/40 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
                          : 'bg-[#6CA6C1] text-[#343434] hover:bg-[#F7FFF7]'
                      }`}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </form>

                  <form
                    action={resetUserPassword}
                    className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4"
                  >
                    <input type="hidden" name="user_id" value={user.id} />
                    <label className={`mb-2 block ${LABEL_CLASS}`}>
                      Reset Password
                    </label>
                    <div className="flex gap-3">
                      <Input
                        name="password"
                        type="password"
                        className="h-10 flex-1 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 px-3 text-sm font-semibold text-[#F7FFF7] placeholder:text-[#6CA6C1]/55 hover:border-[#6CA6C1] focus-visible:ring-2 focus-visible:ring-[#6CA6C1]/25"
                        placeholder="Password baru"
                      />
                      <Button
                        type="submit"
                        className="h-10 rounded-xl border border-[#6CA6C1]/40 bg-[#343434]/80 px-4 text-xs font-black uppercase tracking-[0.2em] text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                      >
                        Reset
                      </Button>
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
