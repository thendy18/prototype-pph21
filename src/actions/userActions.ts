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

type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
  isActive: boolean;
};

type CreateUserFeedbackState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  nonce: number;
};

type UserActionFeedbackState = CreateUserFeedbackState;

function userActionFeedback(
  status: 'success' | 'error',
  message: string
): UserActionFeedbackState {
  return {
    status,
    message,
    nonce: Date.now(),
  };
}

function readCreateUserInput(formData: FormData): {
  input: CreateUserInput | null;
  error: string | null;
} {
  const fullName = getTrimmedValue(formData, 'full_name');
  const email = getTrimmedValue(formData, 'email').toLowerCase();
  const password = getTrimmedValue(formData, 'password');
  const role = parseRole(getTrimmedValue(formData, 'role'));
  const isActive = isChecked(formData, 'is_active');

  if (!fullName || !email || !password || !role) {
    return {
      input: null,
      error: 'Nama, email, password, dan role wajib diisi.',
    };
  }

  if (!ensureStrongEnoughPassword(password)) {
    return {
      input: null,
      error: 'Password minimal 8 karakter.',
    };
  }

  return {
    input: {
      fullName,
      email,
      password,
      role,
      isActive,
    },
    error: null,
  };
}

async function createAuthUserAndProfile(
  actorId: string,
  input: CreateUserInput
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
    },
  });

  if (error || !data.user) {
    return error?.message ?? 'Gagal membuat user auth.';
  }

  const { error: insertError } = await admin.from('app_users').insert({
    id: data.user.id,
    email: input.email,
    full_name: input.fullName,
    role: input.role,
    is_active: input.isActive,
    created_by: actorId,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return `User auth dibuat tetapi profil app gagal dibuat: ${insertError.message}`;
  }

  return null;
}

export async function createUser(formData: FormData): Promise<void> {
  const actor = await requireMasterProfile();
  const { input, error: inputError } = readCreateUserInput(formData);

  if (inputError || !input) {
    redirectUsers('error', inputError ?? 'Input user tidak valid.');
  }

  const createError = await createAuthUserAndProfile(actor.id, input);

  if (createError) {
    redirectUsers('error', createError);
  }

  revalidatePath('/users');
  redirectUsers('success', 'User baru berhasil dibuat.');
}

export async function createUserWithFeedback(
  _previousState: CreateUserFeedbackState,
  formData: FormData
): Promise<CreateUserFeedbackState> {
  const actor = await requireMasterProfile();
  const { input, error: inputError } = readCreateUserInput(formData);

  if (inputError || !input) {
    return userActionFeedback('error', inputError ?? 'Input user tidak valid.');
  }

  const createError = await createAuthUserAndProfile(actor.id, input);

  if (createError) {
    return userActionFeedback('error', createError);
  }

  revalidatePath('/users');
  return userActionFeedback('success', 'User baru berhasil dibuat.');
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

export async function updateUserRoleWithFeedback(
  _previousState: UserActionFeedbackState,
  formData: FormData
): Promise<UserActionFeedbackState> {
  const actor = await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const nextRole = parseRole(getTrimmedValue(formData, 'role'));

  if (!userId || !nextRole) {
    return userActionFeedback('error', 'Target user atau role tidak valid.');
  }

  if (userId === actor.id) {
    return userActionFeedback('error', 'Role akun Anda sendiri tidak bisa diubah dari panel ini.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    return userActionFeedback('error', 'User target tidak ditemukan.');
  }

  if (
    target.role === 'master' &&
    target.isActive &&
    nextRole !== 'master' &&
    (await countActiveMasters()) <= 1
  ) {
    return userActionFeedback('error', 'Harus ada minimal satu master user aktif.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('app_users')
    .update({ role: nextRole })
    .eq('id', userId);

  if (error) {
    return userActionFeedback('error', `Gagal mengubah role: ${error.message}`);
  }

  revalidatePath('/users');
  return userActionFeedback('success', 'Role user berhasil diperbarui.');
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

export async function updateUserActiveStatusWithFeedback(
  _previousState: UserActionFeedbackState,
  formData: FormData
): Promise<UserActionFeedbackState> {
  const actor = await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const nextStatus = getTrimmedValue(formData, 'is_active');

  if (!userId || (nextStatus !== 'true' && nextStatus !== 'false')) {
    return userActionFeedback('error', 'Status user tidak valid.');
  }

  if (userId === actor.id && nextStatus === 'false') {
    return userActionFeedback('error', 'Anda tidak bisa menonaktifkan akun Anda sendiri.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    return userActionFeedback('error', 'User target tidak ditemukan.');
  }

  if (
    target.role === 'master' &&
    target.isActive &&
    nextStatus === 'false' &&
    (await countActiveMasters()) <= 1
  ) {
    return userActionFeedback('error', 'Master user aktif terakhir tidak bisa dinonaktifkan.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('app_users')
    .update({ is_active: nextStatus === 'true' })
    .eq('id', userId);

  if (error) {
    return userActionFeedback('error', `Gagal mengubah status user: ${error.message}`);
  }

  revalidatePath('/users');
  return userActionFeedback('success', 'Status user berhasil diperbarui.');
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

export async function resetUserPasswordWithFeedback(
  _previousState: UserActionFeedbackState,
  formData: FormData
): Promise<UserActionFeedbackState> {
  await requireMasterProfile();
  const userId = getTrimmedValue(formData, 'user_id');
  const password = getTrimmedValue(formData, 'password');

  if (!userId || !password) {
    return userActionFeedback('error', 'User dan password baru wajib diisi.');
  }

  if (!ensureStrongEnoughPassword(password)) {
    return userActionFeedback('error', 'Password baru minimal 8 karakter.');
  }

  const target = await getAppUserById(userId);
  if (!target) {
    return userActionFeedback('error', 'User target tidak ditemukan.');
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return userActionFeedback('error', `Gagal reset password: ${error.message}`);
  }

  revalidatePath('/users');
  return userActionFeedback('success', `Password untuk ${target.email} berhasil diperbarui.`);
}
