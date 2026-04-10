export type AppRole = 'master' | 'staff';

export interface AppUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CurrentUserProfile {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
}

export interface LoginFormState {
  error?: string;
}
