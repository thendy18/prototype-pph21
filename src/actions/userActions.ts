'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { countActiveMasters, getAppUserById } from '../lib/appUsers';
import { requireMasterProfile } from '../lib/auth';
import { createSupabaseAdminClient } from '../lib/supabaseAdmin';
import type { AppRole } from '../types/auth';

function getTrimmedValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseRole(value: string): AppRole | null {
  if (value === 'master' || value === 'staff') {
    return value;
  }

  return null;
}

function redirectUsers(type: 'success' | 'error', message: string): never {
  const params = new URLSearchParams({
    [type]: message,
  });

  redirect(`/users?${params.toString()}`);
}

function isChecked(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
}

function ensureStrongEnoughPassword(password: string): boolean {
  return password.length >= 8;
}

export async function createUser(formData: FormData): Promise<void> {
  const actor = await requireMasterProfile();
  const fullName = getTrimmedValue(formData, 'full_name');
  const email = getTrimmedValue(formData, 'email').toLowerCase();
  const password = getTrimmedValue(formData, 'password');
  const role = parseRole(getTrimmedValue(formData, 'role'));
  const isActive = isChecked(formData, 'is_active');

  if (!fullName || !email || !password || !role) {
    redirectUsers('error', 'Nama, email, password, dan role wajib diisi.');
  }

  if (!ensureStrongEnoughPassword(password)) {
    redirectUsers('error', 'Password minimal 8 karakter.');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error || !data.user) {
    redirectUsers('error', error?.message ?? 'Gagal membuat user auth.');
  }

  const { error: insertError } = await admin.from('app_users').insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    is_active: isActive,
    created_by: actor.id,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    redirectUsers('error', `User auth dibuat tetapi profil app gagal dibuat: ${insertError.message}`);
  }

  revalidatePath('/users');
  redirectUsers('success', 'User baru berhasil dibuat.');
}

export async function updateUserRole(formData: FormData): Promise<void> {
  const actor = await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const nextRole = parseRole(getTrimmedValue(formData, 'role'));

  if (!userId || !nextRole) {
    redirectUsers('error', 'Target user atau role tidak valid.');
  }

  if (userId === actor.id) {
    redirectUsers('error', 'Role akun Anda sendiri tidak bisa diubah dari panel ini.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    redirectUsers('error', 'User target tidak ditemukan.');
  }

  if (
    target.role === 'master' &&
    target.isActive &&
    nextRole !== 'master' &&
    (await countActiveMasters()) <= 1
  ) {
    redirectUsers('error', 'Harus ada minimal satu master user aktif.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('app_users')
    .update({ role: nextRole })
    .eq('id', userId);

  if (error) {
    redirectUsers('error', `Gagal mengubah role: ${error.message}`);
  }

  revalidatePath('/users');
  redirectUsers('success', 'Role user berhasil diperbarui.');
}

export async function updateUserActiveStatus(formData: FormData): Promise<void> {
  const actor = await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const nextStatus = getTrimmedValue(formData, 'is_active');

  if (!userId || (nextStatus !== 'true' && nextStatus !== 'false')) {
    redirectUsers('error', 'Status user tidak valid.');
  }

  if (userId === actor.id && nextStatus === 'false') {
    redirectUsers('error', 'Anda tidak bisa menonaktifkan akun Anda sendiri.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    redirectUsers('error', 'User target tidak ditemukan.');
  }

  if (
    target.role === 'master' &&
    target.isActive &&
    nextStatus === 'false' &&
    (await countActiveMasters()) <= 1
  ) {
    redirectUsers('error', 'Master user aktif terakhir tidak bisa dinonaktifkan.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('app_users')
    .update({ is_active: nextStatus === 'true' })
    .eq('id', userId);

  if (error) {
    redirectUsers('error', `Gagal mengubah status user: ${error.message}`);
  }

  revalidatePath('/users');
  redirectUsers('success', 'Status user berhasil diperbarui.');
}

export async function resetUserPassword(formData: FormData): Promise<void> {
  await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const password = getTrimmedValue(formData, 'password');

  if (!userId || !password) {
    redirectUsers('error', 'User dan password baru wajib diisi.');
  }

  if (!ensureStrongEnoughPassword(password)) {
    redirectUsers('error', 'Password baru minimal 8 karakter.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    redirectUsers('error', 'User target tidak ditemukan.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    redirectUsers('error', `Gagal reset password: ${error.message}`);
  }

  revalidatePath('/users');
  redirectUsers('success', `Password untuk ${target.email} berhasil diperbarui.`);
}
