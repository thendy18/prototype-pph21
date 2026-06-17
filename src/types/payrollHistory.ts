import type {
  DataKaryawan,
  DataPerusahaan,
  HasilKalkulasiTetap,
  InputGajiBulanan,
  KonfigurasiTarif,
} from './payroll';

export type PayrollHistorySummary = {
  employeeCount: number;
  totalBruto: number;
  totalTax: number;
  totalThp: number;
  savedAt: string;
};

export type SavePayrollHistoryPayload = {
  companyProfile: DataPerusahaan;
  periodMonth: number;
  periodYear: number;
  configBpjs: KonfigurasiTarif;
  employeesSnapshot: Record<string, unknown>;
  summary: PayrollHistorySummary;
};

export type SavePayrollHistoryResult = {
  success?: string;
  error?: string;
};

export type PayrollPeriodHistoryListItem = {
  id: string;
  periodMonth: number;
  periodYear: number;
  companyName: string;
  companyNpwp: string;
  companyIdTku: string;
  employeeCount: number;
  totalBruto: number;
  totalTax: number;
  totalThp: number;
  createdBy: string;
  createdAt: string;
};

export type PayrollHistoryEmployeeSnapshot = {
  karyawan: DataKaryawan;
  input: InputGajiBulanan;
  hasil: HasilKalkulasiTetap;
  monthlyInputs?: Record<number, InputGajiBulanan>;
  monthlyHasils?: Record<number, HasilKalkulasiTetap>;
};

export type PayrollPeriodHistoryDetail = PayrollPeriodHistoryListItem & {
  configSnapshot: KonfigurasiTarif;
  employeesSnapshot: PayrollHistoryEmployeeSnapshot[];
  summarySnapshot: PayrollHistorySummary;
};

export type PayrollAuditEventType =
  | 'IMPORT_EXCEL'
  | 'SAVE_HISTORY'
  | 'FINALIZE_PERIOD'
  | 'GENERATE_XML'
  | 'DOWNLOAD_SLIP'
  | 'UPDATE_VARIABLE'
  | 'UPDATE_OVERRIDE';

export type PayrollAuditEventPayload = {
  eventType: PayrollAuditEventType;
  companyProfile: DataPerusahaan;
  periodMonth: number;
  periodYear: number;
  description: string;
  metadata?: Record<string, unknown>;
};

export type PayrollAuditEventListItem = {
  id: string;
  eventType: PayrollAuditEventType;
  periodMonth: number;
  periodYear: number;
  companyName: string;
  companyNpwp: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
};

export type PayrollPeriodLockPayload = {
  companyProfile: DataPerusahaan;
  periodMonth: number;
  periodYear: number;
  summary: PayrollHistorySummary;
  note?: string;
};

export type PayrollPeriodLockResult = {
  success?: string;
  error?: string;
};

export type PayrollPeriodLockStatus = {
  locked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  error?: string;
};

export type PayrollPeriodLockListItem = {
  id: string;
  periodMonth: number;
  periodYear: number;
  companyName: string;
  companyNpwp: string;
  employeeCount: number;
  totalTax: number;
  lockedBy: string;
  lockedAt: string;
};
