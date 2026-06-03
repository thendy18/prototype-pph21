'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import {
  resetUserPasswordWithFeedback,
  updateUserActiveStatusWithFeedback,
  updateUserRoleWithFeedback,
} from '../../actions/userActions';
import { UserToast } from './user-toast';
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
import type { AppRole } from '@/types/auth';

const LABEL_CLASS =
  'text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/55';

const SELECT_TRIGGER_CLASS =
  'h-10 w-full rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 font-mono text-sm font-semibold text-[#F7FFF7] transition-all hover:border-[#6CA6C1] hover:bg-[#343434] focus:ring-2 focus:ring-[#6CA6C1]/25 data-[state=open]:border-[#6CA6C1] [&_svg]:text-[#6CA6C1]';

const SELECT_CONTENT_CLASS =
  'rounded-xl border border-[#6CA6C1]/30 bg-[#343434] font-mono text-[#F7FFF7] shadow-2xl shadow-black/40 [&_[data-slot=select-scroll-down-button]]:bg-[#343434] [&_[data-slot=select-scroll-down-button]]:text-[#6CA6C1] [&_[data-slot=select-scroll-up-button]]:bg-[#343434] [&_[data-slot=select-scroll-up-button]]:text-[#6CA6C1] [&_[data-slot=select-viewport]]:bg-[#343434]';

const SELECT_ITEM_CLASS =
  'cursor-pointer rounded-lg font-mono text-sm !text-[#F7FFF7] hover:bg-[#2F3061] hover:!text-[#FFE66D] focus:bg-[#2F3061] focus:!text-[#FFE66D] data-[highlighted]:bg-[#2F3061] data-[highlighted]:!text-[#FFE66D] data-[state=checked]:bg-[#6CA6C1]/20 data-[state=checked]:!text-[#FFE66D] [&_svg]:!text-[#FFE66D]';

const INITIAL_ACTION_STATE = {
  status: 'idle' as const,
  message: '',
  nonce: 0,
};

type PendingButtonProps = {
  children: string;
  loadingText: string;
  className: string;
};

function PendingButton({ children, loadingText, className }: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {pending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? loadingText : children}
    </Button>
  );
}

export function RoleUpdateForm({ userId, role }: { userId: string; role: AppRole }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateUserRoleWithFeedback,
    INITIAL_ACTION_STATE
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.nonce, state.status]);

  return (
    <>
      <UserToast
        status={state.status === 'idle' ? null : state.status}
        message={state.message || null}
        nonce={state.nonce}
      />
      <form action={formAction} className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4">
        <input type="hidden" name="user_id" value={userId} />
        <label className={`mb-2 block ${LABEL_CLASS}`}>
          Ubah Role
        </label>
        <div className="flex gap-3">
          <Select name="role" defaultValue={role}>
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
          <PendingButton
            loadingText="Saving..."
            className="h-10 rounded-xl bg-[#6CA6C1] px-4 text-xs font-black uppercase tracking-[0.2em] text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
          >
            Save
          </PendingButton>
        </div>
      </form>
    </>
  );
}

export function UserStatusForm({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateUserActiveStatusWithFeedback,
    INITIAL_ACTION_STATE
  );

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.nonce, state.status]);

  return (
    <>
      <UserToast
        status={state.status === 'idle' ? null : state.status}
        message={state.message || null}
        nonce={state.nonce}
      />
      <form
        action={formAction}
        className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4"
      >
        <input type="hidden" name="user_id" value={userId} />
        <input
          type="hidden"
          name="is_active"
          value={isActive ? 'false' : 'true'}
        />
        <label className={`mb-2 block ${LABEL_CLASS}`}>
          Status Akun
        </label>
        <p className="mb-3 text-sm text-[#F7FFF7]/65">
          {isActive
            ? 'Nonaktifkan user agar tidak bisa login.'
            : 'Aktifkan kembali user agar bisa login.'}
        </p>
        <PendingButton
          loadingText={isActive ? 'Disabling...' : 'Enabling...'}
          className={`h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.2em] focus-visible:ring-[#FFE66D]/30 ${
            isActive
              ? 'border border-[#FFE66D]/40 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
              : 'bg-[#6CA6C1] text-[#343434] hover:bg-[#F7FFF7]'
          }`}
        >
          {isActive ? 'Disable' : 'Enable'}
        </PendingButton>
      </form>
    </>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    resetUserPasswordWithFeedback,
    INITIAL_ACTION_STATE
  );

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, state.nonce, state.status]);

  return (
    <>
      <UserToast
        status={state.status === 'idle' ? null : state.status}
        message={state.message || null}
        nonce={state.nonce}
      />
      <form
        ref={formRef}
        action={formAction}
        className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/80 p-4"
      >
        <input type="hidden" name="user_id" value={userId} />
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
          <PendingButton
            loadingText="Resetting..."
            className="h-10 rounded-xl border border-[#6CA6C1]/40 bg-[#343434]/80 px-4 text-xs font-black uppercase tracking-[0.2em] text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
          >
            Reset
          </PendingButton>
        </div>
      </form>
    </>
  );
}
