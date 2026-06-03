'use client';

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { createUserWithFeedback } from '../../actions/userActions';
import { UserToast } from './user-toast';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELD_CARD_CLASS =
  'rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4 transition-colors hover:border-[#6CA6C1]/70 focus-within:border-[#6CA6C1]/70 focus-within:ring-2 focus-within:ring-[#6CA6C1]/20';

const LABEL_CLASS =
  'text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/55';

const INPUT_CLASS =
  'h-10 border-none bg-transparent p-0 font-semibold text-[#F7FFF7] shadow-none outline-none placeholder:text-[#6CA6C1]/55 focus-visible:ring-0';

const SELECT_TRIGGER_CLASS =
  'h-10 w-full rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 font-mono text-sm font-semibold text-[#F7FFF7] transition-all hover:border-[#6CA6C1] hover:bg-[#343434] focus:ring-2 focus:ring-[#6CA6C1]/25 data-[state=open]:border-[#6CA6C1] [&_svg]:text-[#6CA6C1]';

const SELECT_CONTENT_CLASS =
  'rounded-xl border border-[#6CA6C1]/30 bg-[#343434] font-mono text-[#F7FFF7] shadow-2xl shadow-black/40 [&_[data-slot=select-scroll-down-button]]:bg-[#343434] [&_[data-slot=select-scroll-down-button]]:text-[#6CA6C1] [&_[data-slot=select-scroll-up-button]]:bg-[#343434] [&_[data-slot=select-scroll-up-button]]:text-[#6CA6C1] [&_[data-slot=select-viewport]]:bg-[#343434]';

const SELECT_ITEM_CLASS =
  'cursor-pointer rounded-lg font-mono text-sm !text-[#F7FFF7] hover:bg-[#2F3061] hover:!text-[#FFE66D] focus:bg-[#2F3061] focus:!text-[#FFE66D] data-[highlighted]:bg-[#2F3061] data-[highlighted]:!text-[#FFE66D] data-[state=checked]:bg-[#6CA6C1]/20 data-[state=checked]:!text-[#FFE66D] [&_svg]:!text-[#FFE66D]';

const INITIAL_STATE = {
  status: 'idle' as const,
  message: '',
  nonce: 0,
};

function getTrimmedFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function validateCreateUserForm(formData: FormData): string | null {
  const fullName = getTrimmedFormValue(formData, 'full_name');
  const email = getTrimmedFormValue(formData, 'email');
  const password = getTrimmedFormValue(formData, 'password');
  const role = getTrimmedFormValue(formData, 'role');

  if (!fullName || !email || !password || !role) {
    return 'Nama, email, password, dan role wajib diisi.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Format email belum valid.';
  }

  if (password.length < 8) {
    return 'Password minimal 8 karakter.';
  }

  if (role !== 'staff' && role !== 'master') {
    return 'Role user tidak valid.';
  }

  return null;
}

function SubmitButton({ isPending }: { isPending: boolean }) {
  const { pending } = useFormStatus();
  const loading = pending || isPending;

  return (
    <Button
      type="submit"
      disabled={loading}
      className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? 'Membuat User...' : 'Buat User'}
    </Button>
  );
}

export function CreateUserForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createUserWithFeedback,
    INITIAL_STATE
  );
  const [clientError, setClientError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const validationError = validateCreateUserForm(new FormData(event.currentTarget));

    if (validationError) {
      event.preventDefault();
      setClientError(validationError);
      return;
    }

    setClientError('');
  }

  useEffect(() => {
    if (state.status !== 'success') {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, state.nonce, state.status]);

  const errorMessage = clientError;

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
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
      >
        <fieldset
          disabled={isPending}
          className="contents disabled:pointer-events-none disabled:opacity-70"
        >
          <Field className={`${FIELD_CARD_CLASS} xl:col-span-2`}>
            <FieldLabel className={LABEL_CLASS}>
              Nama Lengkap
            </FieldLabel>
            <Input
              name="full_name"
              className={INPUT_CLASS}
              placeholder="Nama user"
              aria-invalid={Boolean(errorMessage)}
            />
          </Field>

          <Field className={FIELD_CARD_CLASS}>
            <FieldLabel className={LABEL_CLASS}>
              Email
            </FieldLabel>
            <Input
              name="email"
              type="email"
              className={INPUT_CLASS}
              placeholder="user@company.com"
              aria-invalid={Boolean(errorMessage)}
            />
          </Field>

          <Field className={FIELD_CARD_CLASS}>
            <FieldLabel className={LABEL_CLASS}>
              Password Awal
            </FieldLabel>
            <Input
              name="password"
              type="password"
              className={INPUT_CLASS}
              placeholder="Minimal 8 karakter"
              aria-invalid={Boolean(errorMessage)}
            />
          </Field>

          <Field className={FIELD_CARD_CLASS}>
            <FieldLabel className={LABEL_CLASS}>
              Role
            </FieldLabel>
            <Select name="role" defaultValue="staff">
              <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                <SelectValue placeholder="Pilih role" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                <SelectGroup>
                  <SelectItem value="staff" className={SELECT_ITEM_CLASS}>staff</SelectItem>
                  <SelectItem value="master" className={SELECT_ITEM_CLASS}>master</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <label className="flex items-center gap-3 rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4 text-sm text-[#F7FFF7]/75 transition-colors hover:border-[#6CA6C1]/70 xl:col-span-5">
            <input
              name="is_active"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[#6CA6C1]/50 bg-[#343434] accent-[#FFE66D]"
            />
            User aktif saat dibuat
          </label>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-2xl border border-[#FFE66D]/40 bg-[#FFE66D]/10 px-4 py-3 text-sm font-semibold text-[#FFE66D] xl:col-span-5"
            >
              {errorMessage}
            </div>
          )}

          {isPending && !errorMessage && (
            <div
              aria-live="polite"
              className="rounded-2xl border border-[#6CA6C1]/40 bg-[#6CA6C1]/10 px-4 py-3 text-sm font-semibold text-[#F7FFF7] xl:col-span-5"
            >
              Sedang membuat akun auth dan profil aplikasi...
            </div>
          )}

          <div className="xl:col-span-5">
            <SubmitButton isPending={isPending} />
          </div>
        </fieldset>
      </form>
    </>
  );
}
