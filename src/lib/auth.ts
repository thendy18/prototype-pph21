import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { CurrentUserProfile } from '../types/auth';
import { getAppUserById } from './appUsers';
import { createSupabaseServerClient } from './supabaseServer';

export const getCurrentUserProfile = cache(
  async (): Promise<CurrentUserProfile | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const profile = await getAppUserById(user.id);
    if (!profile || !profile.isActive) {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      isActive: profile.isActive,
    };
  }
);

export async function requireCurrentUserProfile(): Promise<CurrentUserProfile> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect('/login');
  }

  return profile;
}

export async function requireMasterProfile(): Promise<CurrentUserProfile> {
  const profile = await requireCurrentUserProfile();

  if (profile.role !== 'master') {
    redirect('/unauthorized');
  }

  return profile;
}
