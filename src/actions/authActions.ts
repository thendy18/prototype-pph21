'use server';

import { redirect } from 'next/navigation';
import type { LoginFormState } from '../types/auth';
import { getAppUserById } from '../lib/appUsers';
import { createSupabaseServerClient } from '../lib/supabaseServer';

function getTrimmedValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function login(
  _previousState: LoginFormState | undefined,
  formData: FormData
): Promise<LoginFormState> {
  const email = getTrimmedValue(formData, 'email').toLowerCase();
  const password = getTrimmedValue(formData, 'password');

  if (!email || !password) {
    return {
      error: 'Email dan password wajib diisi.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      error: 'Email atau password tidak valid.',
    };
  }

  const profile = await getAppUserById(data.user.id);

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: 'Akun berhasil login ke Auth, tetapi belum terdaftar di aplikasi.',
    };
  }

  if (!profile.isActive) {
    await supabase.auth.signOut();
    return {
      error: 'Akun Anda sedang nonaktif. Hubungi master user.',
    };
  }

  redirect('/bulk');
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
