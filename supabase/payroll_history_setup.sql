-- Payroll period history setup
-- Run this after auth_setup.sql.

create table if not exists public.payroll_period_histories (
  id uuid primary key default gen_random_uuid(),
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null check (period_year between 2000 and 2100),
  company_name text not null default '',
  company_npwp text not null default '',
  company_id_tku text not null default '',
  employee_count integer not null check (employee_count >= 0),
  total_bruto numeric(18, 0) not null default 0,
  total_tax numeric(18, 0) not null default 0,
  total_thp numeric(18, 0) not null default 0,
  config_snapshot jsonb not null,
  employees_snapshot jsonb not null,
  summary_snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists payroll_period_histories_period_idx
  on public.payroll_period_histories (period_year desc, period_month desc);

create index if not exists payroll_period_histories_created_at_idx
  on public.payroll_period_histories (created_at desc);

create index if not exists payroll_period_histories_created_by_idx
  on public.payroll_period_histories (created_by);

alter table public.payroll_period_histories enable row level security;

drop policy if exists "active app users can read payroll histories"
  on public.payroll_period_histories;

create policy "active app users can read payroll histories"
  on public.payroll_period_histories
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists "active app users can create payroll histories"
  on public.payroll_period_histories;

create policy "active app users can create payroll histories"
  on public.payroll_period_histories
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

grant select, insert on public.payroll_period_histories to authenticated;

create table if not exists public.payroll_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'IMPORT_EXCEL',
      'SAVE_HISTORY',
      'FINALIZE_PERIOD',
      'GENERATE_XML',
      'DOWNLOAD_SLIP',
      'UPDATE_VARIABLE',
      'UPDATE_OVERRIDE'
    )
  ),
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null check (period_year between 2000 and 2100),
  company_name text not null default '',
  company_npwp text not null default '',
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists payroll_audit_events_created_at_idx
  on public.payroll_audit_events (created_at desc);

create index if not exists payroll_audit_events_period_idx
  on public.payroll_audit_events (period_year desc, period_month desc);

alter table public.payroll_audit_events enable row level security;

drop policy if exists "active app users can read payroll audit events"
  on public.payroll_audit_events;

create policy "active app users can read payroll audit events"
  on public.payroll_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists "active app users can create payroll audit events"
  on public.payroll_audit_events;

create policy "active app users can create payroll audit events"
  on public.payroll_audit_events
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

grant select, insert on public.payroll_audit_events to authenticated;

create table if not exists public.payroll_period_locks (
  id uuid primary key default gen_random_uuid(),
  period_month integer not null check (period_month between 1 and 12),
  period_year integer not null check (period_year between 2000 and 2100),
  company_name text not null default '',
  company_npwp text not null default '',
  company_id_tku text not null default '',
  employee_count integer not null check (employee_count >= 0),
  total_bruto numeric(18, 0) not null default 0,
  total_tax numeric(18, 0) not null default 0,
  total_thp numeric(18, 0) not null default 0,
  note text,
  locked_by uuid not null references auth.users(id),
  locked_at timestamptz not null default now(),
  unique (period_month, period_year, company_npwp)
);

create index if not exists payroll_period_locks_period_idx
  on public.payroll_period_locks (period_year desc, period_month desc);

alter table public.payroll_period_locks enable row level security;

drop policy if exists "active app users can read payroll period locks"
  on public.payroll_period_locks;

create policy "active app users can read payroll period locks"
  on public.payroll_period_locks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

drop policy if exists "active app users can create payroll period locks"
  on public.payroll_period_locks;

create policy "active app users can create payroll period locks"
  on public.payroll_period_locks
  for insert
  to authenticated
  with check (
    locked_by = auth.uid()
    and exists (
      select 1
      from public.app_users au
      where au.id = auth.uid()
        and au.is_active = true
    )
  );

grant select, insert on public.payroll_period_locks to authenticated;
