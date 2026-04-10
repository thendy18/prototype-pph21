import type { AppRole, AppUserProfile } from '../types/auth';
import { createSupabaseAdminClient } from './supabaseAdmin';

type AppUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

function mapAppUser(row: AppUserRow): AppUserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

export async function getAppUserById(id: string): Promise<AppUserProfile | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('app_users')
    .select('id, email, full_name, role, is_active, created_at, updated_at, created_by')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    const code = 'code' in error ? error.code : undefined;
    if (code === 'PGRST116') {
      return null;
    }

    throw new Error(`Failed to read app user: ${error.message}`);
  }

  return data ? mapAppUser(data as AppUserRow) : null;
}

export async function listAppUsers(): Promise<AppUserProfile[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('app_users')
    .select('id, email, full_name, role, is_active, created_at, updated_at, created_by')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list app users: ${error.message}`);
  }

  return ((data ?? []) as AppUserRow[]).map(mapAppUser);
}

export async function countActiveMasters(): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from('app_users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'master')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to count master users: ${error.message}`);
  }

  return count ?? 0;
}
