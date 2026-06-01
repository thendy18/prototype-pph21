'use server';

import { requireCurrentUserProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import type {
  PayrollAuditEventPayload,
  PayrollPeriodLockPayload,
  PayrollPeriodLockResult,
  PayrollPeriodLockStatus,
  SavePayrollHistoryPayload,
  SavePayrollHistoryResult,
} from '@/types/payrollHistory';

function isValidPeriod(month: number, year: number): boolean {
  return (
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100
  );
}

export async function savePayrollPeriodHistory(
  payload: SavePayrollHistoryPayload
): Promise<SavePayrollHistoryResult> {
  const currentUser = await requireCurrentUserProfile();

  if (!isValidPeriod(payload.periodMonth, payload.periodYear)) {
    return { error: 'Periode payroll tidak valid.' };
  }

  if (payload.summary.employeeCount <= 0) {
    return { error: 'Tidak ada data karyawan untuk disimpan ke histori.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('payroll_period_histories').insert({
    period_month: payload.periodMonth,
    period_year: payload.periodYear,
    company_name: payload.companyProfile.namaPerusahaan,
    company_npwp: payload.companyProfile.npwpPemotong,
    company_id_tku: payload.companyProfile.idTku,
    employee_count: payload.summary.employeeCount,
    total_bruto: payload.summary.totalBruto,
    total_tax: payload.summary.totalTax,
    total_thp: payload.summary.totalThp,
    config_snapshot: payload.configBpjs,
    employees_snapshot: payload.employeesSnapshot,
    summary_snapshot: payload.summary,
    created_by: currentUser.id,
  });

  if (error) {
    return {
      error:
        error.message.includes('payroll_period_histories')
          ? 'Tabel histori payroll belum tersedia. Jalankan SQL setup histori terlebih dahulu.'
          : error.message,
    };
  }

  return {
    success: `Histori masa ${payload.periodMonth}/${payload.periodYear} berhasil disimpan.`,
  };
}

export async function recordPayrollAuditEvent(
  payload: PayrollAuditEventPayload
): Promise<void> {
  const currentUser = await requireCurrentUserProfile();

  if (!isValidPeriod(payload.periodMonth, payload.periodYear)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from('payroll_audit_events').insert({
    event_type: payload.eventType,
    period_month: payload.periodMonth,
    period_year: payload.periodYear,
    company_name: payload.companyProfile.namaPerusahaan,
    company_npwp: payload.companyProfile.npwpPemotong,
    description: payload.description,
    metadata: payload.metadata ?? {},
    created_by: currentUser.id,
  });
}

export async function finalizePayrollPeriod(
  payload: PayrollPeriodLockPayload
): Promise<PayrollPeriodLockResult> {
  const currentUser = await requireCurrentUserProfile();

  if (!isValidPeriod(payload.periodMonth, payload.periodYear)) {
    return { error: 'Periode payroll tidak valid.' };
  }

  if (payload.summary.employeeCount <= 0) {
    return { error: 'Tidak ada data karyawan untuk dikunci.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('payroll_period_locks').insert({
    period_month: payload.periodMonth,
    period_year: payload.periodYear,
    company_name: payload.companyProfile.namaPerusahaan,
    company_npwp: payload.companyProfile.npwpPemotong,
    company_id_tku: payload.companyProfile.idTku,
    employee_count: payload.summary.employeeCount,
    total_bruto: payload.summary.totalBruto,
    total_tax: payload.summary.totalTax,
    total_thp: payload.summary.totalThp,
    note: payload.note ?? null,
    locked_by: currentUser.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'Periode ini sudah pernah dikunci.' };
    }

    return {
      error:
        error.message.includes('payroll_period_locks')
          ? 'Tabel lock periode belum tersedia. Jalankan SQL setup histori terbaru terlebih dahulu.'
          : error.message,
    };
  }

  await recordPayrollAuditEvent({
    eventType: 'FINALIZE_PERIOD',
    companyProfile: payload.companyProfile,
    periodMonth: payload.periodMonth,
    periodYear: payload.periodYear,
    description: `Finalize / lock masa ${payload.periodMonth}/${payload.periodYear}`,
    metadata: {
      employeeCount: payload.summary.employeeCount,
      totalTax: payload.summary.totalTax,
      note: payload.note ?? null,
    },
  });

  return {
    success: `Masa ${payload.periodMonth}/${payload.periodYear} berhasil dikunci.`,
  };
}

export async function getPayrollPeriodLockStatus(payload: {
  companyNpwp: string;
  periodMonth: number;
  periodYear: number;
}): Promise<PayrollPeriodLockStatus> {
  await requireCurrentUserProfile();

  if (!payload.companyNpwp || !isValidPeriod(payload.periodMonth, payload.periodYear)) {
    return { locked: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('payroll_period_locks')
    .select('id, locked_by, locked_at')
    .eq('company_npwp', payload.companyNpwp)
    .eq('period_month', payload.periodMonth)
    .eq('period_year', payload.periodYear)
    .maybeSingle();

  if (error) {
    return { locked: false, error: error.message };
  }

  return data
    ? {
        locked: true,
        lockedBy: String(data.locked_by),
        lockedAt: String(data.locked_at),
      }
    : { locked: false };
}
