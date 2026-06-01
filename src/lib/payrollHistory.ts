import { requireCurrentUserProfile } from './auth';
import { createSupabaseServerClient } from './supabaseServer';
import type {
  PayrollAuditEventListItem,
  PayrollAuditEventType,
  PayrollHistoryEmployeeSnapshot,
  PayrollHistorySummary,
  PayrollPeriodHistoryDetail,
  PayrollPeriodHistoryListItem,
  PayrollPeriodLockListItem,
} from '@/types/payrollHistory';
import type { KonfigurasiTarif } from '@/types/payroll';

type PayrollHistoryRow = {
  id: string;
  period_month: number;
  period_year: number;
  company_name: string;
  company_npwp: string;
  company_id_tku: string;
  employee_count: number;
  total_bruto: number | string;
  total_tax: number | string;
  total_thp: number | string;
  created_by: string;
  created_at: string;
};

type PayrollHistoryDetailRow = PayrollHistoryRow & {
  config_snapshot: KonfigurasiTarif;
  employees_snapshot: Record<string, unknown>;
  summary_snapshot: PayrollHistorySummary;
};

function toNumber(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isEmployeeSnapshot(
  value: unknown
): value is PayrollHistoryEmployeeSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PayrollHistoryEmployeeSnapshot>;
  return Boolean(candidate.karyawan && candidate.input && candidate.hasil);
}

function parseEmployeeSnapshots(
  snapshot: Record<string, unknown>
): PayrollHistoryEmployeeSnapshot[] {
  return Object.values(snapshot).filter(isEmployeeSnapshot);
}

function mapHistoryDetailRow(
  row: PayrollHistoryDetailRow
): PayrollPeriodHistoryDetail {
  return {
    id: row.id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    companyName: row.company_name,
    companyNpwp: row.company_npwp,
    companyIdTku: row.company_id_tku,
    employeeCount: row.employee_count,
    totalBruto: toNumber(row.total_bruto),
    totalTax: toNumber(row.total_tax),
    totalThp: toNumber(row.total_thp),
    configSnapshot: row.config_snapshot,
    employeesSnapshot: parseEmployeeSnapshots(row.employees_snapshot ?? {}),
    summarySnapshot: row.summary_snapshot,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function getPreviousPeriod(month: number, year: number): {
  month: number;
  year: number;
} {
  if (month <= 1) {
    return { month: 12, year: year - 1 };
  }

  return { month: month - 1, year };
}

export async function listPayrollPeriodHistories(): Promise<
  PayrollPeriodHistoryListItem[]
> {
  await requireCurrentUserProfile();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_period_histories')
    .select(
      'id, period_month, period_year, company_name, company_npwp, company_id_tku, employee_count, total_bruto, total_tax, total_thp, created_by, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message.includes('payroll_period_histories')) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as PayrollHistoryRow[]).map((row) => ({
    id: row.id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    companyName: row.company_name,
    companyNpwp: row.company_npwp,
    companyIdTku: row.company_id_tku,
    employeeCount: row.employee_count,
    totalBruto: toNumber(row.total_bruto),
    totalTax: toNumber(row.total_tax),
    totalThp: toNumber(row.total_thp),
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function getPayrollPeriodHistoryDetail(
  id: string
): Promise<PayrollPeriodHistoryDetail | null> {
  await requireCurrentUserProfile();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_period_histories')
    .select(
      'id, period_month, period_year, company_name, company_npwp, company_id_tku, employee_count, total_bruto, total_tax, total_thp, config_snapshot, employees_snapshot, summary_snapshot, created_by, created_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as PayrollHistoryDetailRow;

  return mapHistoryDetailRow(row);
}

export async function getPreviousPayrollPeriodHistoryDetail(payload: {
  companyNpwp: string;
  periodMonth: number;
  periodYear: number;
}): Promise<PayrollPeriodHistoryDetail | null> {
  await requireCurrentUserProfile();

  if (!payload.companyNpwp) return null;

  const previousPeriod = getPreviousPeriod(payload.periodMonth, payload.periodYear);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_period_histories')
    .select(
      'id, period_month, period_year, company_name, company_npwp, company_id_tku, employee_count, total_bruto, total_tax, total_thp, config_snapshot, employees_snapshot, summary_snapshot, created_by, created_at'
    )
    .eq('company_npwp', payload.companyNpwp)
    .eq('period_month', previousPeriod.month)
    .eq('period_year', previousPeriod.year)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return mapHistoryDetailRow(data as PayrollHistoryDetailRow);
}

type PayrollLockRow = {
  id: string;
  period_month: number;
  period_year: number;
  company_name: string;
  company_npwp: string;
  employee_count: number;
  total_tax: number | string;
  locked_by: string;
  locked_at: string;
};

type PayrollAuditEventRow = {
  id: string;
  event_type: PayrollAuditEventType;
  period_month: number;
  period_year: number;
  company_name: string;
  company_npwp: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
};

export async function listPayrollPeriodLocks(): Promise<
  PayrollPeriodLockListItem[]
> {
  await requireCurrentUserProfile();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_period_locks')
    .select(
      'id, period_month, period_year, company_name, company_npwp, employee_count, total_tax, locked_by, locked_at'
    )
    .order('locked_at', { ascending: false });

  if (error) return [];

  return ((data ?? []) as PayrollLockRow[]).map((row) => ({
    id: row.id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    companyName: row.company_name,
    companyNpwp: row.company_npwp,
    employeeCount: row.employee_count,
    totalTax: toNumber(row.total_tax),
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
  }));
}

export async function listPayrollAuditEvents(): Promise<
  PayrollAuditEventListItem[]
> {
  await requireCurrentUserProfile();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_audit_events')
    .select(
      'id, event_type, period_month, period_year, company_name, company_npwp, description, metadata, created_by, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return [];

  return ((data ?? []) as PayrollAuditEventRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    companyName: row.company_name,
    companyNpwp: row.company_npwp,
    description: row.description,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}
