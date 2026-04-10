-- Authentication and authorization bootstrap for Payroll Coretax.
-- Run this in the Supabase SQL editor before using the app.

create table if not exists public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('master', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid null references auth.users (id) on delete set null
);

create index if not exists app_users_role_idx on public.app_users (role);
create index if not exists app_users_active_idx on public.app_users (is_active);

create or replace function public.set_app_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;

create trigger app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_app_users_updated_at();

alter table public.app_users enable row level security;

drop policy if exists "Users can read own app profile" on public.app_users;

create policy "Users can read own app profile"
on public.app_users
for select
to authenticated
using (auth.uid() = id);

-- Manual first-master seed:
-- 1. Create the first auth user from the Supabase dashboard or admin API.
-- 2. Find the real auth.users row, for example:
--    select id, email from auth.users order by created_at desc;
-- 3. Insert the matching row into public.app_users, for example:
--
-- insert into public.app_users (
--   id,
--   email,
--   full_name,
--   role,
--   is_active,
--   created_by
-- )
-- select
--   id,
--   email,
--   'Master User',
--   'master',
--   true,
--   null
-- from auth.users
-- where email = 'master@example.com'
-- on conflict (id) do update
-- set
--   email = excluded.email,
--   full_name = excluded.full_name,
--   role = excluded.role,
--   is_active = excluded.is_active,
--   created_by = excluded.created_by;
