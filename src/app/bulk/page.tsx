'use client';

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import * as XLSX from 'xlsx';
import {
  finalizePayrollPeriod,
  getPayrollPeriodLockStatus,
  recordPayrollAuditEvent,
  savePayrollPeriodHistory,
} from '../../actions/payrollHistoryActions';
import {
  downloadBpa1Xml,
  downloadBp21Xml,
  downloadBp26Xml,
  downloadBpmpXml,
  generateBpa1Xml,
  generateBp21Xml,
  generateBp26Xml,
  generateBpmpXml,
  type BpmpGlobalSettings,
} from '../../actions/exportXML';
import {
  downloadAllSlipGajiZip,
  downloadReceiptPembayaranPdf,
  downloadSlipGajiPdf,
} from '../../actions/exportSlipGaji';
import { buildNominalOverridePreviewRows } from '../../lib/payrollOverrides';
import { usePayrollStore } from '../../store/usePayrollStore';
import { DataPerusahaan, KonfigurasiTarif } from '../../types/payroll';
import type { SavePayrollHistoryPayload } from '../../types/payrollHistory';
import { SlipGajiSource } from '../../types/slipGaji';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const RATE_KEYS = [
  'rateJkkPerusahaan',
  'rateJkmPerusahaan',
  'rateJhtPerusahaan',
  'rateBpjsKesPerusahaan',
  'rateJpPerusahaan',
  'rateJhtKaryawan',
  'rateBpjsKesKaryawan',
  'rateJpKaryawan',
] as const;

const SETTINGS_CARD_CLASS =
  'rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/70 p-4 shadow-lg shadow-black/20 transition-colors hover:border-[#6CA6C1]/70 focus-within:border-[#6CA6C1]/70';

const SETTINGS_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F7FFF7]/70';

const SETTINGS_CONTROL_CLASS =
  'flex h-12 items-center rounded-xl border border-[#6CA6C1]/35 bg-[#343434]/80 px-3 transition-colors hover:border-[#6CA6C1] hover:bg-[#343434] focus-within:border-[#6CA6C1] focus-within:bg-[#343434] focus-within:ring-2 focus-within:ring-[#6CA6C1]/25';

const SETTINGS_INPUT_CLASS =
  'h-auto border-none bg-transparent p-0 text-base font-semibold text-[#F7FFF7] shadow-none outline-none placeholder:text-[#6CA6C1]/60 focus-visible:ring-0';

const SETTINGS_SELECT_TRIGGER_CLASS =
  'h-12 w-full rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 font-mono text-sm font-medium text-[#F7FFF7] transition-all duration-200 hover:border-[#6CA6C1] hover:bg-[#343434] focus:ring-2 focus:ring-[#6CA6C1]/25 data-[state=open]:border-[#6CA6C1] data-[state=open]:bg-[#343434] [&_svg]:text-[#6CA6C1]';

const SETTINGS_SELECT_CONTENT_CLASS =
  'rounded-xl border border-[#6CA6C1]/30 bg-[#343434] font-mono text-[#F7FFF7] shadow-2xl shadow-black/40 [&_[data-slot=select-scroll-down-button]]:bg-[#343434] [&_[data-slot=select-scroll-down-button]]:text-[#6CA6C1] [&_[data-slot=select-scroll-up-button]]:bg-[#343434] [&_[data-slot=select-scroll-up-button]]:text-[#6CA6C1] [&_[data-slot=select-viewport]]:bg-[#343434]';

const SETTINGS_SELECT_ITEM_CLASS =
  'cursor-pointer rounded-lg font-mono text-sm !text-[#F7FFF7] hover:bg-[#2F3061] hover:!text-[#FFE66D] focus:bg-[#2F3061] focus:!text-[#FFE66D] data-[highlighted]:bg-[#2F3061] data-[highlighted]:!text-[#FFE66D] data-[state=checked]:bg-[#6CA6C1]/20 data-[state=checked]:!text-[#FFE66D] [&_svg]:!text-[#FFE66D]';

const TABLE_INPUT_CLASS =
  'h-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 text-center font-semibold text-[#F7FFF7] transition-colors placeholder:text-[#6CA6C1]/55 hover:border-[#6CA6C1] hover:bg-[#343434] focus-visible:border-[#6CA6C1] focus-visible:ring-2 focus-visible:ring-[#6CA6C1]/25';

const CURRENCY_INPUT_WRAP_CLASS =
  'flex h-10 items-center rounded-xl border border-[#6CA6C1]/35 bg-[#343434]/80 px-3 transition-colors hover:border-[#6CA6C1] hover:bg-[#343434] focus-within:border-[#6CA6C1] focus-within:bg-[#343434] focus-within:ring-2 focus-within:ring-[#6CA6C1]/25';

const CURRENCY_INPUT_CLASS =
  'h-auto border-none bg-transparent py-0 pl-0 pr-3 text-right font-semibold text-[#F7FFF7] caret-[#6CA6C1] shadow-none outline-none placeholder:text-[#6CA6C1]/55 focus-visible:ring-0';

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableCurrencyInput(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? null : parseCurrencyInput(digits);
}

function formatCurrencyInputValue(
  value: number | null | undefined,
  options: { emptyZero?: boolean } = {}
): string {
  const { emptyZero = true } = options;
  if (value === null || value === undefined || (emptyZero && value === 0)) {
    return '';
  }

  return formatCurrency(value);
}

function formatLabel(key: string): string {
  return key
    .replace('rate', '')
    .replace(/([A-Z])/g, ' $1')
    .replace('Perusahaan', '(Co)')
    .replace('Karyawan', '(Emp)')
    .trim();
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isExcelFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BpmpModalSettings = Omit<BpmpGlobalSettings, 'withholdingDate' | 'strict'> & {
  withholdingDate: string;
};

type EmployeeFilter = 'ALL' | 'TETAP' | 'NON_PEGAWAI' | 'NEEDS_REVIEW';

type ImportValidationIssue = {
  row: number;
  field: string;
  message: string;
};

type ImportValidationReport = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: ImportValidationIssue[];
  warnings: ImportValidationIssue[];
};

function readCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null) continue;
    const parsed = String(value).trim();
    if (parsed) return parsed;
  }

  return '';
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function isEmptyExcelRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => String(value ?? '').trim() === '');
}

function hasTransactionHeader(row: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(row, 'Jenis Penerima') ||
    Object.prototype.hasOwnProperty.call(row, 'Jenis Penerima Penghasilan') ||
    Object.prototype.hasOwnProperty.call(row, 'jenis_penerima')
  );
}

function isTransactionImport(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => hasTransactionHeader(row));
}

function normalizeJenisPenerima(row: Record<string, unknown>): string {
  return readCell(row, 'Jenis Penerima', 'Jenis Penerima Penghasilan', 'jenis_penerima')
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function normalizeExcelDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value ?? '').trim();
}

function isValidIsoDateText(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function buildImportValidationReport(
  rows: Record<string, unknown>[]
): ImportValidationReport {
  const errors: ImportValidationIssue[] = [];
  const warnings: ImportValidationIssue[] = [];
  const rowStatus = new Map<number, { hasError: boolean; hasWarning: boolean }>();
  const transactionMode = isTransactionImport(rows);
  let totalRows = 0;

  const mark = (row: number, type: 'error' | 'warning') => {
    const current = rowStatus.get(row) ?? { hasError: false, hasWarning: false };
    rowStatus.set(row, {
      ...current,
      hasError: current.hasError || type === 'error',
      hasWarning: current.hasWarning || type === 'warning',
    });
  };

  rows.forEach((row, index) => {
    if (isEmptyExcelRow(row)) return;

    totalRows += 1;
    const excelRow = index + 2;
    const addError = (field: string, message: string) => {
      errors.push({ row: excelRow, field, message });
      mark(excelRow, 'error');
    };
    const addWarning = (field: string, message: string) => {
      warnings.push({ row: excelRow, field, message });
      mark(excelRow, 'warning');
    };

    const nik = readCell(row, 'NIK', 'Nik');
    if (!nik) addError('NIK', 'NIK wajib diisi.');
    else if (digitsOnly(nik).length !== 16) addError('NIK', 'NIK harus tepat 16 digit angka.');

    if (transactionMode) {
      const jenisPenerima = normalizeJenisPenerima(row);
      if (!jenisPenerima) {
        addError('Jenis Penerima', 'Jenis Penerima wajib diisi untuk template transaksi.');
      } else if (jenisPenerima.includes('TIDAK') && jenisPenerima.includes('TETAP')) {
        addError('Jenis Penerima', 'Pegawai Tidak Tetap disiapkan untuk fase berikutnya dan belum dihitung pada v1.');
      }
    }

    const metodePajak = readCell(row, 'Metode Pajak', 'Metode', 'Tax Method').toUpperCase();
    if (!metodePajak) addError('Metode Pajak', 'Metode Pajak wajib diisi.');
    else if (!['GROSS', 'NET', 'GROSS_UP'].includes(metodePajak)) {
      addError('Metode Pajak', 'Metode Pajak harus GROSS, NET, atau GROSS_UP.');
    }

    const counterpartTin = readCell(row, 'Counterpart TIN', 'CounterpartTin');
    if (counterpartTin && digitsOnly(counterpartTin).length !== 16) {
      addError('Counterpart TIN', 'Counterpart TIN harus tepat 16 digit angka.');
    }

    const residentStatus = readCell(row, 'Resident Status', 'Status Resident').toUpperCase();
    const passport = readCell(row, 'No Paspor', 'Nomor Paspor', 'Paspor', 'Passport', 'No Passport');
    if ((residentStatus === 'NON_RESIDENT' || residentStatus === 'NON RESIDENT') && !passport) {
      addWarning('No Paspor', 'WNA/non-resident sebaiknya mengisi nomor paspor untuk BPMP.');
    }

    const fasilitasPajak = readCell(row, 'Fasilitas Pajak', 'Tax Certificate', 'TaxCertificate');
    if (fasilitasPajak && !['N/A', 'SKB', 'DTP', 'SKD', 'ETC', 'TAXEXAR21'].includes(fasilitasPajak.toUpperCase())) {
      addWarning('Fasilitas Pajak', 'Nilai tidak dikenal dan akan default ke N/A.');
    }

    if (transactionMode) {
      const jenisPenerima = normalizeJenisPenerima(row);
      const isBp21Row = jenisPenerima.includes('BUKAN') || jenisPenerima.includes('NON');

      if (isBp21Row) {
        const taxObjectCode = readCell(row, 'TaxObjectCode', 'Tax Object Code', 'Kode Objek Pajak');
        const document = readCell(row, 'Document', 'Jenis Dokumen');
        const documentNumber = readCell(row, 'DocumentNumber', 'Document Number', 'Nomor Dokumen');
        const documentDate = normalizeExcelDate(row['DocumentDate'] ?? row['Document Date'] ?? row['Tanggal Dokumen']);
        const withholdingDate = normalizeExcelDate(row['WithholdingDate'] ?? row['Withholding Date'] ?? row['Tanggal Pemotongan']);
        const idTkuPenerima = readCell(
          row,
          'ID TKU Penerima',
          'IDPlaceOfBusinessActivityOfIncomeRecipient',
          'ID TKU'
        );

        if (!taxObjectCode) addError('TaxObjectCode', 'TaxObjectCode wajib diisi untuk BP21.');
        if (!document) addError('Document', 'Document wajib diisi untuk BP21.');
        if (!documentNumber) addError('DocumentNumber', 'DocumentNumber wajib diisi untuk BP21.');
        if (!documentDate || !isValidIsoDateText(documentDate)) {
          addError('DocumentDate', 'DocumentDate wajib berformat YYYY-MM-DD untuk BP21.');
        }
        if (!idTkuPenerima || digitsOnly(idTkuPenerima).length !== 22) {
          addError('ID TKU Penerima', 'ID TKU Penerima harus tepat 22 digit angka untuk BP21.');
        }
        if (withholdingDate && !isValidIsoDateText(withholdingDate)) {
          addError('WithholdingDate', 'WithholdingDate harus berformat YYYY-MM-DD.');
        }
      }

      const isBp26Row =
        jenisPenerima.includes('TETAP') &&
        !jenisPenerima.includes('TIDAK') &&
        (residentStatus === 'NON_RESIDENT' || residentStatus === 'NON RESIDENT');

      if (isBp26Row) {
        const counterpartTin = readCell(row, 'BP26 CounterpartTin', 'BP26_CounterpartTin');
        const country = readCell(row, 'BP26 Country', 'BP26_Country');
        const address = readCell(row, 'BP26 Address', 'BP26_Address');
        const dateOfBirth = normalizeExcelDate(row['BP26 Date Of Birth'] ?? row['BP26_Date_Of_Birth']);
        const birthCity = readCell(row, 'BP26 Birth City', 'BP26_Birth_City');
        const taxCertificate = readCell(row, 'BP26 TaxCertificate', 'BP26_TaxCertificate').toUpperCase() || 'N/A';
        const receipt = readCell(row, 'BP26 CounterpartReceiptNumber', 'BP26_CounterpartReceiptNumber');
        const deemed = readCell(row, 'BP26 Deemed', 'BP26_Deemed');
        const rate = readCell(row, 'BP26 Rate', 'BP26_Rate');
        const document = readCell(row, 'Document', 'Jenis Dokumen', 'BP26 Document');
        const documentNumber = readCell(row, 'DocumentNumber', 'Document Number', 'Nomor Dokumen', 'BP26 DocumentNumber');
        const documentDate = normalizeExcelDate(row['DocumentDate'] ?? row['Document Date'] ?? row['Tanggal Dokumen'] ?? row['BP26 DocumentDate']);
        const withholdingDate = normalizeExcelDate(row['WithholdingDate'] ?? row['Withholding Date'] ?? row['Tanggal Pemotongan'] ?? row['BP26 WithholdingDate']);

        if (!counterpartTin) addError('BP26 CounterpartTin', 'BP26 CounterpartTin wajib diisi.');
        if (!country) addError('BP26 Country', 'BP26 Country wajib diisi.');
        if (!address) addError('BP26 Address', 'BP26 Address wajib diisi.');
        if (!dateOfBirth || !isValidIsoDateText(dateOfBirth)) {
          addError('BP26 Date Of Birth', 'BP26 Date Of Birth wajib berformat YYYY-MM-DD.');
        }
        if (!birthCity) addError('BP26 Birth City', 'BP26 Birth City wajib diisi.');
        if (!['N/A', 'DTP', 'COD', 'ETC'].includes(taxCertificate)) {
          addError('BP26 TaxCertificate', 'BP26 TaxCertificate harus N/A, DTP, COD, atau ETC.');
        }
        if (!document) addError('Document', 'Document wajib diisi untuk BP26.');
        if (!documentNumber) addError('DocumentNumber', 'DocumentNumber wajib diisi untuk BP26.');
        if (!documentDate || !isValidIsoDateText(documentDate)) {
          addError('DocumentDate', 'DocumentDate wajib berformat YYYY-MM-DD untuk BP26.');
        }
        if (withholdingDate && !isValidIsoDateText(withholdingDate)) {
          addError('WithholdingDate', 'WithholdingDate harus berformat YYYY-MM-DD.');
        }
        if (taxCertificate === 'COD') {
          if (!receipt) addError('BP26 CounterpartReceiptNumber', 'BP26 CounterpartReceiptNumber wajib diisi untuk COD.');
          if (!deemed) addError('BP26 Deemed', 'BP26 Deemed wajib diisi untuk COD.');
          if (!rate) addError('BP26 Rate', 'BP26 Rate wajib diisi untuk COD.');
        }
      }
    }
  });

  const invalidRows = Array.from(rowStatus.values()).filter((row) => row.hasError).length;
  const warningRows = Array.from(rowStatus.values()).filter((row) => row.hasWarning).length;

  return {
    totalRows,
    validRows: Math.max(totalRows - invalidRows, 0),
    errorRows: invalidRows,
    warningRows,
    errors,
    warnings,
  };
}

export default function TaxelingPage() {
  const {
    configBpjs,
    setConfigBpjs,
    loadDefaultBpjs,
    employees,
    importExcel,
    setNominalOverride,
    setSubjekPajakSejakAwalTahun,
    updateVariable,
  } = usePayrollStore();

  const [masaPajak, setMasaPajak] = useState(10);
  const [tahunPayroll, setTahunPayroll] = useState(new Date().getFullYear());
  const [selectedNik, setSelectedNik] = useState<string | null>(null);
  const [isBpmpModalOpen, setIsBpmpModalOpen] = useState(false);
  const [isBp21ModalOpen, setIsBp21ModalOpen] = useState(false);
  const [isBp26ModalOpen, setIsBp26ModalOpen] = useState(false);
  const [isBpa1ModalOpen, setIsBpa1ModalOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('ALL');
  const [slipExportNik, setSlipExportNik] = useState<string | null>(null);
  const [isExportingAllSlip, setIsExportingAllSlip] = useState(false);
  const [isSavingHistory, startSaveHistoryTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [periodLockMessage, setPeriodLockMessage] = useState<string | null>(null);
  const [lockedPeriodKey, setLockedPeriodKey] = useState<string | null>(null);
  const [isFinalizingPeriod, startFinalizePeriodTransition] = useTransition();
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [importValidationReport, setImportValidationReport] =
    useState<ImportValidationReport | null>(null);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportMessage, setExcelImportMessage] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [companyProfile, setCompanyProfile] = useState<DataPerusahaan>({
    namaPerusahaan: '',
    npwpPemotong: '',
    idTku: '',
  });
  const [bpmpSettings, setBpmpSettings] = useState<BpmpModalSettings>(() => {
    const today = new Date();
    return {
      taxPeriodMonth: 10,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    };
  });
  const [bp21Settings, setBp21Settings] = useState<BpmpModalSettings>(() => {
    const today = new Date();
    return {
      taxPeriodMonth: 10,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    };
  });
  const [bp26Settings, setBp26Settings] = useState<BpmpModalSettings>(() => {
    const today = new Date();
    return {
      taxPeriodMonth: 10,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    };
  });
  const [bpa1Settings, setBpa1Settings] = useState<BpmpModalSettings>(() => {
    const today = new Date();
    return {
      taxPeriodMonth: 12,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    };
  });

  const employeeList = useMemo(() => Object.values(employees), [employees]);
  const activeEmp = selectedNik ? employees[selectedNik] : null;
  const activeInput = activeEmp?.monthlyInputs[masaPajak];
  const activeResult = activeEmp?.monthlyHasils[masaPajak];
  const activeOverrideRows = useMemo(
    () =>
      activeEmp && activeInput
        ? buildNominalOverridePreviewRows(activeInput, activeEmp.karyawan.tipeKaryawan)
        : [],
    [activeEmp, activeInput]
  );
  const availableTaxYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 2 + index);
  }, []);
  type EmployeeListItem = (typeof employeeList)[number];
  const currentPeriodKey = `${companyProfile.npwpPemotong || 'no-npwp'}:${masaPajak}:${tahunPayroll}`;
  const isPeriodLocked = lockedPeriodKey === currentPeriodKey;
  const hasReviewIssue = useCallback((emp: EmployeeListItem): boolean => {
    if (emp.karyawan.tipeKaryawan === 'PEGAWAI_TIDAK_TETAP') return true;
    if (emp.karyawan.tipeKaryawan === 'TETAP' && emp.karyawan.residentStatus === 'NON_RESIDENT') {
      const metadata = emp.karyawan.bp26;
      return !metadata ||
        !metadata.counterpartTin ||
        !metadata.country ||
        !metadata.address ||
        !metadata.dateOfBirth ||
        !metadata.birthCity ||
        !metadata.documentType ||
        !metadata.documentNumber ||
        !metadata.documentDate ||
        (metadata.taxCertificate === 'COD' &&
          (!metadata.hasExplicitReceiptNumber ||
            !metadata.hasExplicitDeemed ||
            !metadata.hasExplicitRate));
    }
    if (emp.karyawan.tipeKaryawan !== 'NON_PEGAWAI') return false;

    const metadata = emp.karyawan.bp21;
    return !metadata ||
      !metadata.taxObjectCode ||
      !metadata.documentType ||
      !metadata.documentNumber ||
      !metadata.documentDate ||
      !metadata.idTkuPenerima;
  }, []);
  const displayedEmployeeList = useMemo(() => {
    if (employeeFilter === 'TETAP') {
      return employeeList.filter((emp) => emp.karyawan.tipeKaryawan === 'TETAP');
    }
    if (employeeFilter === 'NON_PEGAWAI') {
      return employeeList.filter((emp) => emp.karyawan.tipeKaryawan === 'NON_PEGAWAI');
    }
    if (employeeFilter === 'NEEDS_REVIEW') {
      return employeeList.filter(hasReviewIssue);
    }
    return employeeList;
  }, [employeeFilter, employeeList, hasReviewIssue]);
  const filterCounts = useMemo(
    () => ({
      ALL: employeeList.length,
      TETAP: employeeList.filter((emp) => emp.karyawan.tipeKaryawan === 'TETAP').length,
      NON_PEGAWAI: employeeList.filter((emp) => emp.karyawan.tipeKaryawan === 'NON_PEGAWAI').length,
      NEEDS_REVIEW: employeeList.filter(hasReviewIssue).length,
    }),
    [employeeList, hasReviewIssue]
  );

  const slipEligibleEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.karyawan.tipeKaryawan === 'TETAP' &&
          !!emp.monthlyInputs[masaPajak] &&
          !!emp.monthlyHasils[masaPajak] &&
          emp.monthlyHasils[masaPajak].totalBruto > 0
      ),
    [employeeList, masaPajak]
  );

  const isSlipEligible = (emp: EmployeeListItem): boolean =>
    emp.karyawan.tipeKaryawan === 'TETAP' &&
    !!emp.monthlyInputs[masaPajak] &&
    !!emp.monthlyHasils[masaPajak] &&
    emp.monthlyHasils[masaPajak].totalBruto > 0;

  const isReceiptEligible = (emp: EmployeeListItem): boolean =>
    emp.karyawan.tipeKaryawan === 'NON_PEGAWAI' &&
    !!emp.monthlyInputs[masaPajak] &&
    !!emp.monthlyHasils[masaPajak] &&
    emp.monthlyHasils[masaPajak].totalBruto > 0;

  const isPaymentDocumentEligible = (emp: EmployeeListItem): boolean =>
    isSlipEligible(emp) || isReceiptEligible(emp);

  const bp21EligibleEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.karyawan.tipeKaryawan === 'NON_PEGAWAI' &&
          !!emp.monthlyInputs[masaPajak] &&
          !!emp.monthlyHasils[masaPajak] &&
          emp.monthlyHasils[masaPajak].totalBruto > 0
      ),
    [employeeList, masaPajak]
  );

  const bp26EligibleEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.karyawan.tipeKaryawan === 'TETAP' &&
          emp.karyawan.residentStatus === 'NON_RESIDENT' &&
          !!emp.monthlyInputs[masaPajak] &&
          !!emp.monthlyHasils[masaPajak] &&
          emp.monthlyHasils[masaPajak].totalBruto > 0
      ),
    [employeeList, masaPajak]
  );

  const bpa1EligibleEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.karyawan.tipeKaryawan === 'TETAP' &&
          emp.karyawan.bulanSelesai === masaPajak &&
          !!emp.monthlyInputs[masaPajak] &&
          !!emp.monthlyHasils[masaPajak] &&
          emp.monthlyHasils[masaPajak].totalBruto > 0
      ),
    [employeeList, masaPajak]
  );

  useEffect(() => {
    if (!companyProfile.npwpPemotong) {
      setLockedPeriodKey(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await getPayrollPeriodLockStatus({
        companyNpwp: companyProfile.npwpPemotong,
        periodMonth: masaPajak,
        periodYear: tahunPayroll,
      });

      if (cancelled) return;
      setLockedPeriodKey(result.locked ? currentPeriodKey : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyProfile.npwpPemotong, currentPeriodKey, masaPajak, tahunPayroll]);

  const toSlipSource = (emp: EmployeeListItem): SlipGajiSource => ({
    namaPerusahaan: companyProfile.namaPerusahaan,
    bulan: masaPajak,
    tahun: tahunPayroll,
    karyawan: emp.karyawan,
    input: emp.monthlyInputs[masaPajak],
    hasil: emp.monthlyHasils[masaPajak],
  });

  const buildPayrollHistoryPayload = (): SavePayrollHistoryPayload => {
    const employeesForPeriod = employeeList.filter(
      (emp) => !!emp.monthlyInputs[masaPajak] && !!emp.monthlyHasils[masaPajak]
    );

    const summary = employeesForPeriod.reduce(
      (acc, emp) => {
        const hasil = emp.monthlyHasils[masaPajak];
        return {
          employeeCount: acc.employeeCount + 1,
          totalBruto: acc.totalBruto + hasil.totalBruto,
          totalTax: acc.totalTax + hasil.pajakTerutang,
          totalThp: acc.totalThp + hasil.thpBersih,
          savedAt: acc.savedAt,
        };
      },
      {
        employeeCount: 0,
        totalBruto: 0,
        totalTax: 0,
        totalThp: 0,
        savedAt: new Date().toISOString(),
      }
    );

    const employeesSnapshot = Object.fromEntries(
      employeesForPeriod.map((emp) => [
        emp.karyawan.idKaryawan,
        {
          karyawan: emp.karyawan,
          input: emp.monthlyInputs[masaPajak],
          hasil: emp.monthlyHasils[masaPajak],
          monthlyInputs: emp.monthlyInputs,
          monthlyHasils: emp.monthlyHasils,
        },
      ])
    );

    return {
      companyProfile,
      periodMonth: masaPajak,
      periodYear: tahunPayroll,
      configBpjs,
      employeesSnapshot,
      summary,
    };
  };

  const setExcelFile = (file: File | null) => {
    if (!file) {
      setSelectedExcelFile(null);
      setExcelImportMessage(null);
      return;
    }

    if (!isExcelFile(file)) {
      setSelectedExcelFile(null);
      setExcelImportMessage(null);
      setExportError('Format file harus .xlsx atau .xls.');
      return;
    }

    setSelectedExcelFile(file);
    setExportError(null);
    setExcelImportMessage('File siap diimport. Klik Import Data untuk memproses.');
  };

  const handleExcelFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setExcelFile(e.target.files?.[0] ?? null);
  };

  const handleExcelDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(true);
  };

  const handleExcelDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
  };

  const handleExcelDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    setExcelFile(e.dataTransfer.files?.[0] ?? null);
  };

  const clearExcelFile = () => {
    setExcelFile(null);
    setImportValidationReport(null);
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const importSelectedExcel = async () => {
    if (isPeriodLocked) {
      setExportError('Periode ini sudah dikunci. Import Excel tidak bisa dilakukan.');
      return;
    }

    if (!selectedExcelFile) {
      setExportError('Pilih file Excel terlebih dahulu.');
      return;
    }

    setIsImportingExcel(true);
    setExportError(null);
    setExcelImportMessage(null);

    try {
      const buf = await selectedExcelFile.arrayBuffer();
      const wb = XLSX.read(buf);
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]],
        {
          raw: true,
          rawNumbers: false,
          defval: '',
        }
      );
      const report = buildImportValidationReport(data);
      setImportValidationReport(report);

      if (report.errors.length > 0) {
        setExportError(
          `Import dibatalkan. Ditemukan ${report.errors.length} error pada ${report.errorRows} baris.`
        );
        return;
      }

      importExcel(data);
      setExportError(null);
      setExcelImportMessage(
        `Berhasil import ${data.length} baris dari ${selectedExcelFile.name}.`
      );
      void recordPayrollAuditEvent({
        eventType: 'IMPORT_EXCEL',
        companyProfile,
        periodMonth: masaPajak,
        periodYear: tahunPayroll,
        description: `Import Excel ${selectedExcelFile.name}`,
        metadata: {
          fileName: selectedExcelFile.name,
          fileSize: selectedExcelFile.size,
          totalRows: report.totalRows,
          warningRows: report.warningRows,
        },
      });
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membaca file Excel.'
      );
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleSavePayrollHistory = () => {
    if (employeeList.length === 0) {
      setExportError('Import data payroll terlebih dahulu sebelum menyimpan histori.');
      return;
    }

    setExportError(null);
    setHistoryMessage(null);

    const payload = buildPayrollHistoryPayload();

    startSaveHistoryTransition(() => {
      void (async () => {
        const result = await savePayrollPeriodHistory(payload);
        if (result.error) {
          setExportError(result.error);
          return;
        }

        setHistoryMessage(result.success ?? 'Histori payroll berhasil disimpan.');
        void recordPayrollAuditEvent({
          eventType: 'SAVE_HISTORY',
          companyProfile,
          periodMonth: masaPajak,
          periodYear: tahunPayroll,
          description: `Simpan histori masa ${masaPajak}/${tahunPayroll}`,
          metadata: payload.summary,
        });
      })();
    });
  };

  const handleFinalizePeriod = () => {
    if (employeeList.length === 0) {
      setExportError('Import data payroll terlebih dahulu sebelum mengunci periode.');
      return;
    }

    setExportError(null);
    setPeriodLockMessage(null);
    const payload = buildPayrollHistoryPayload();

    startFinalizePeriodTransition(() => {
      void (async () => {
        const result = await finalizePayrollPeriod({
          companyProfile,
          periodMonth: masaPajak,
          periodYear: tahunPayroll,
          summary: payload.summary,
          note: 'Finalized from Bulk Payroll page',
        });

        if (result.error) {
          setExportError(result.error);
          return;
        }

        setLockedPeriodKey(currentPeriodKey);
        setPeriodLockMessage(result.success ?? 'Periode berhasil dikunci.');
      })();
    });
  };

  const openBpmpModal = () => {
    const today = new Date();
    setBpmpSettings({
      taxPeriodMonth: masaPajak,
      taxPeriodYear: tahunPayroll,
      withholdingDate: formatDateInputValue(today),
    });
    setExportError(null);
    setIsBpmpModalOpen(true);
  };

  const openBp21Modal = () => {
    const today = new Date();
    setBp21Settings({
      taxPeriodMonth: masaPajak,
      taxPeriodYear: tahunPayroll,
      withholdingDate: formatDateInputValue(today),
    });
    setExportError(null);
    setIsBp21ModalOpen(true);
  };

  const openBp26Modal = () => {
    const today = new Date();
    setBp26Settings({
      taxPeriodMonth: masaPajak,
      taxPeriodYear: tahunPayroll,
      withholdingDate: formatDateInputValue(today),
    });
    setExportError(null);
    setIsBp26ModalOpen(true);
  };

  const openBpa1Modal = () => {
    const today = new Date();
    setBpa1Settings({
      taxPeriodMonth: masaPajak,
      taxPeriodYear: tahunPayroll,
      withholdingDate: formatDateInputValue(today),
    });
    setExportError(null);
    setIsBpa1ModalOpen(true);
  };

  const closeBpmpModal = () => {
    setIsBpmpModalOpen(false);
  };

  const closeBp21Modal = () => {
    setIsBp21ModalOpen(false);
  };

  const closeBp26Modal = () => {
    setIsBp26ModalOpen(false);
  };

  const closeBpa1Modal = () => {
    setIsBpa1ModalOpen(false);
  };

  const downloadXML = (settings: BpmpModalSettings) => {
    try {
      const data = employeeList
        .filter(
          (emp) =>
            emp.karyawan.tipeKaryawan === 'TETAP' &&
            emp.karyawan.residentStatus === 'RESIDENT' &&
            emp.monthlyHasils[settings.taxPeriodMonth]?.totalBruto > 0
        )
        .map((emp) => ({
          karyawan: emp.karyawan,
          hasilKalkulasi: emp.monthlyHasils[settings.taxPeriodMonth],
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada pegawai tetap resident aktif untuk export BPMP.');
      }

      const xml = generateBpmpXml(
        {
          namaPerusahaan: companyProfile.namaPerusahaan,
          npwpPemotong: companyProfile.npwpPemotong,
          idTku: companyProfile.idTku,
        },
        data,
        {
          taxPeriodMonth: settings.taxPeriodMonth,
          taxPeriodYear: settings.taxPeriodYear,
          withholdingDate: settings.withholdingDate,
          strict: true,
        }
      );

      downloadBpmpXml(xml);
      setExportError(null);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth: settings.taxPeriodMonth,
        periodYear: settings.taxPeriodYear,
        description: `Generate XML BPMP masa ${settings.taxPeriodMonth}/${settings.taxPeriodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: settings.withholdingDate,
        },
      });
      closeBpmpModal();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal export XML.');
    }
  };

  const downloadBP21XML = (settings: BpmpModalSettings) => {
    try {
      const data = employeeList
        .filter(
          (emp) =>
            emp.karyawan.tipeKaryawan === 'NON_PEGAWAI' &&
            emp.monthlyHasils[settings.taxPeriodMonth]?.totalBruto > 0
        )
        .map((emp) => ({
          karyawan: emp.karyawan,
          hasilKalkulasi: emp.monthlyHasils[settings.taxPeriodMonth],
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada bukan pegawai aktif untuk export BP21.');
      }

      const xml = generateBp21Xml(
        {
          namaPerusahaan: companyProfile.namaPerusahaan,
          npwpPemotong: companyProfile.npwpPemotong,
          idTku: companyProfile.idTku,
        },
        data,
        {
          taxPeriodMonth: settings.taxPeriodMonth,
          taxPeriodYear: settings.taxPeriodYear,
          withholdingDate: settings.withholdingDate,
          strict: true,
        }
      );

      downloadBp21Xml(xml);
      setExportError(null);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth: settings.taxPeriodMonth,
        periodYear: settings.taxPeriodYear,
        description: `Generate XML BP21 masa ${settings.taxPeriodMonth}/${settings.taxPeriodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: settings.withholdingDate,
        },
      });
      closeBp21Modal();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal export XML BP21.');
    }
  };

  const downloadBP26XML = (settings: BpmpModalSettings) => {
    try {
      const data = employeeList
        .filter(
          (emp) =>
            emp.karyawan.tipeKaryawan === 'TETAP' &&
            emp.karyawan.residentStatus === 'NON_RESIDENT' &&
            emp.monthlyHasils[settings.taxPeriodMonth]?.totalBruto > 0
        )
        .map((emp) => ({
          karyawan: emp.karyawan,
          hasilKalkulasi: emp.monthlyHasils[settings.taxPeriodMonth],
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada pegawai asing non-resident aktif untuk export BP26.');
      }

      const xml = generateBp26Xml(
        {
          namaPerusahaan: companyProfile.namaPerusahaan,
          npwpPemotong: companyProfile.npwpPemotong,
          idTku: companyProfile.idTku,
        },
        data,
        {
          taxPeriodMonth: settings.taxPeriodMonth,
          taxPeriodYear: settings.taxPeriodYear,
          withholdingDate: settings.withholdingDate,
          strict: true,
        }
      );

      downloadBp26Xml(
        xml,
        `BP26_${settings.taxPeriodYear}-${String(settings.taxPeriodMonth).padStart(2, '0')}.xml`
      );
      setExportError(null);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth: settings.taxPeriodMonth,
        periodYear: settings.taxPeriodYear,
        description: `Generate XML BP26 masa ${settings.taxPeriodMonth}/${settings.taxPeriodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: settings.withholdingDate,
        },
      });
      closeBp26Modal();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal export XML BP26.');
    }
  };

  const downloadBPA1XML = (settings: BpmpModalSettings) => {
    try {
      const data = employeeList
        .filter(
          (emp) =>
            emp.karyawan.tipeKaryawan === 'TETAP' &&
            emp.karyawan.bulanSelesai === settings.taxPeriodMonth &&
            emp.monthlyHasils[settings.taxPeriodMonth]?.totalBruto > 0
        )
        .map((emp) => ({
          karyawan: emp.karyawan,
          monthlyInputs: emp.monthlyInputs,
          monthlyHasils: emp.monthlyHasils,
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada pegawai tetap pada masa pajak terakhir untuk export BPA1.');
      }

      const xml = generateBpa1Xml(
        {
          namaPerusahaan: companyProfile.namaPerusahaan,
          npwpPemotong: companyProfile.npwpPemotong,
          idTku: companyProfile.idTku,
        },
        data,
        {
          taxPeriodMonth: settings.taxPeriodMonth,
          taxPeriodYear: settings.taxPeriodYear,
          withholdingDate: settings.withholdingDate,
          strict: true,
        }
      );

      downloadBpa1Xml(
        xml,
        `BPA1_${settings.taxPeriodYear}-${String(settings.taxPeriodMonth).padStart(2, '0')}.xml`
      );
      setExportError(null);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth: settings.taxPeriodMonth,
        periodYear: settings.taxPeriodYear,
        description: `Generate XML BPA1 masa terakhir ${settings.taxPeriodMonth}/${settings.taxPeriodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: settings.withholdingDate,
        },
      });
      closeBpa1Modal();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal export XML BPA1.');
    }
  };

  const handleDownloadSlip = async (emp: EmployeeListItem) => {
    if (!isPaymentDocumentEligible(emp)) {
      setExportError('Dokumen PDF hanya tersedia untuk pegawai tetap atau bukan pegawai yang punya hasil di periode aktif.');
      return;
    }

    setSlipExportNik(emp.karyawan.idKaryawan);
    setExportError(null);

    try {
      if (isReceiptEligible(emp)) {
        await downloadReceiptPembayaranPdf(toSlipSource(emp));
      } else {
        await downloadSlipGajiPdf(toSlipSource(emp));
      }
      void recordPayrollAuditEvent({
        eventType: 'DOWNLOAD_SLIP',
        companyProfile,
        periodMonth: masaPajak,
        periodYear: tahunPayroll,
        description: `Download ${isReceiptEligible(emp) ? 'receipt pembayaran' : 'slip gaji'} ${emp.karyawan.namaLengkap}`,
        metadata: { nik: emp.karyawan.nik },
      });
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membuat dokumen PDF.'
      );
    } finally {
      setSlipExportNik(null);
    }
  };

  const handleDownloadAllSlip = async () => {
    if (slipEligibleEmployees.length === 0) {
      setExportError('Tidak ada pegawai TETAP yang eligible untuk slip gaji pada periode aktif.');
      return;
    }

    setIsExportingAllSlip(true);
    setExportError(null);

    try {
      await downloadAllSlipGajiZip(
        slipEligibleEmployees.map(toSlipSource),
        masaPajak,
        tahunPayroll
      );
      void recordPayrollAuditEvent({
        eventType: 'DOWNLOAD_SLIP',
        companyProfile,
        periodMonth: masaPajak,
        periodYear: tahunPayroll,
        description: `Download ZIP slip gaji masa ${masaPajak}/${tahunPayroll}`,
        metadata: { employeeCount: slipEligibleEmployees.length },
      });
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membuat ZIP slip gaji.'
      );
    } finally {
      setIsExportingAllSlip(false);
    }
  };

  const handleVariableUpdate = (
    emp: EmployeeListItem,
    updates: Parameters<typeof updateVariable>[2],
    description: string
  ) => {
    if (isPeriodLocked) {
      setExportError('Periode ini sudah dikunci. Perubahan nominal tidak bisa dilakukan.');
      return;
    }

    updateVariable(emp.karyawan.idKaryawan, masaPajak, updates);
    void recordPayrollAuditEvent({
      eventType: 'UPDATE_VARIABLE',
      companyProfile,
      periodMonth: masaPajak,
      periodYear: tahunPayroll,
      description,
      metadata: {
        nik: emp.karyawan.nik,
        updates,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061] shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-[#6CA6C1]/20 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#FFE66D]">Taxeling</h1>
              <p className="text-xs text-[#F7FFF7]/60">BPJS, PPh 21/26, audit log, dan export BPMP</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={loadDefaultBpjs}
                className="h-10 rounded-xl border border-[#6CA6C1]/50 bg-[#6CA6C1] px-4 text-xs font-bold text-[#343434] transition-colors hover:bg-[#FFE66D] focus-visible:ring-[#FFE66D]/30"
              >
                Load Defaults
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data1">
                  Nama Perusahaan
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.namaPerusahaan}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, namaPerusahaan: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="PT ..."
                    id="data1"
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data2">
                  NPWP Pemotong
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.npwpPemotong}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, npwpPemotong: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="TIN / NPWP"
                    id="data2"
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data3">
                  ID TKU
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.idTku}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, idTku: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="ID TKU"
                    id="data3"
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#6CA6C1]/20 p-6 lg:grid-cols-4">
            {RATE_KEYS.map((key, i) => (
              <div key={key} className={SETTINGS_CARD_CLASS}>
                <Field className="space-y-3">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor={`rate${i}`}>
                    {formatLabel(key)}
                  </FieldLabel>
                  <div className={SETTINGS_CONTROL_CLASS}>
                    <Input
                      type="number"
                      step="0.01"
                      id={`rate${i}`}
                      value={((configBpjs[key] ?? 0) * 100).toFixed(2)}
                      onChange={(e) => setConfigBpjs({ [key]: parseNumber(e.target.value) / 100 } as Partial<KonfigurasiTarif>)}
                      className={SETTINGS_INPUT_CLASS}
                    />
                    <span className="ml-3 text-sm font-bold text-[#6CA6C1]">%</span>
                  </div>
                </Field>
              </div>
            ))}
          </div>

          <div className="grid gap-4 border-t border-[#6CA6C1]/20 p-6 md:grid-cols-3">
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS}>
                    Basis Upah BPJS
                  </FieldLabel>
                </div>

                <Select
                  value={configBpjs.basisUpahBpjs ?? 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP'}
                  onValueChange={(value) =>
                    setConfigBpjs({
                      basisUpahBpjs: value as KonfigurasiTarif['basisUpahBpjs'],
                    })
                  }
                >
                  <SelectTrigger
                    id="basis-upah-bpjs"
                    className={SETTINGS_SELECT_TRIGGER_CLASS}
                  >
                    <SelectValue placeholder="Pilih basis upah" />
                  </SelectTrigger>

                  <SelectContent
                    className={SETTINGS_SELECT_CONTENT_CLASS}
                  >
                    <SelectGroup>
                      <SelectItem
                        value="GAJI_POKOK"
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Gaji Pokok
                      </SelectItem>

                      <SelectItem
                        value="GAJI_POKOK_PLUS_TUNJANGAN_TETAP"
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Gaji Pokok + Tunjangan Tetap
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="plafon-jp">
                    Plafon Jaminan Pensiun
                  </FieldLabel>
                </div>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <span className="mr-3 text-sm font-bold text-[#6CA6C1]">Rp</span>
                  <Input
                    id="plafon-jp"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInputValue(configBpjs.plafonJp, {
                      emptyZero: false,
                    })}
                    onChange={(e) => setConfigBpjs({ plafonJp: parseCurrencyInput(e.target.value) })}
                    className={SETTINGS_INPUT_CLASS}
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="plafon-bpjs-kes">
                    Plafon BPJS Kesehatan
                  </FieldLabel>
                </div>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <span className="mr-3 text-sm font-bold text-[#6CA6C1]">Rp</span>
                  <Input
                    id="plafon-bpjs-kes"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInputValue(configBpjs.plafonBpjsKes, {
                      emptyZero: false,
                    })}
                    onChange={(e) => setConfigBpjs({ plafonBpjsKes: parseCurrencyInput(e.target.value) })}
                    className={SETTINGS_INPUT_CLASS}
                  />
                </div>
              </Field>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#FFE66D]/30 bg-[#FFE66D] p-5 text-[#343434] shadow-lg shadow-black/20 lg:col-span-2">
            <Field className="gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <FieldLabel
                    htmlFor="excel-upload"
                    className="text-xl font-black text-[#343434]"
                  >
                    Upload Excel
                  </FieldLabel>
                </div>
              </div>

              <Input
                ref={excelInputRef}
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="sr-only"
              />

              <label
                htmlFor="excel-upload"
                onDragOver={handleExcelDragOver}
                onDragLeave={handleExcelDragLeave}
                onDrop={handleExcelDrop}
                className={`group flex cursor-pointer flex-col gap-4 rounded-2xl border-2 border-dashed p-5 transition-all sm:flex-row sm:items-center sm:justify-between ${
                  isDraggingExcel
                    ? 'border-[#2F3061] bg-[#F7FFF7]'
                    : 'border-[#343434]/30 bg-[#F7FFF7]/45 hover:border-[#2F3061] hover:bg-[#F7FFF7]/75'
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#343434] text-sm font-black text-[#FFE66D] shadow-lg shadow-black/15">
                    XLS
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#343434]">
                      {selectedExcelFile
                        ? selectedExcelFile.name
                        : 'Klik atau drag file Excel ke sini'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#343434]/60">
                      {selectedExcelFile
                        ? `${formatFileSize(selectedExcelFile.size)} - Siap diproses`
                        : 'Mendukung .xlsx dan .xls'}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-[#343434] px-4 py-2 text-xs font-black text-[#F7FFF7] transition-colors group-hover:bg-[#2F3061]">
                  Pilih File
                </div>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-xs font-semibold text-[#343434]/70">
                  {excelImportMessage ?? 'Kolom Metode Pajak wajib ada per karyawan.'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedExcelFile && (
                    <Button
                      type="button"
                      onClick={clearExcelFile}
                      disabled={isImportingExcel}
                      className="h-10 rounded-xl border border-[#343434]/25 bg-[#F7FFF7]/60 px-4 text-xs font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#343434]/25"
                    >
                      Ganti File
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => void importSelectedExcel()}
                    disabled={!selectedExcelFile || isImportingExcel || isPeriodLocked}
                    className={`h-10 rounded-xl px-5 text-xs font-black focus-visible:ring-[#343434]/25 ${
                      !selectedExcelFile || isImportingExcel || isPeriodLocked
                        ? 'cursor-not-allowed bg-[#343434]/30 text-[#343434]/45'
                        : 'bg-[#343434] text-[#FFE66D] hover:bg-[#2F3061]'
                    }`}
                  >
                    {isImportingExcel ? 'Mengimport...' : 'Import Data'}
                  </Button>
                </div>
              </div>
            </Field>
          </div>
          <div className={SETTINGS_CARD_CLASS}>
            <Field className="space-y-3">
              <FieldLabel className={SETTINGS_LABEL_CLASS}>
                Masa Pajak
              </FieldLabel>
              <Select
                value={String(masaPajak)}
                onValueChange={(value) => setMasaPajak(Number(value))}
              >
                <SelectTrigger
                  id="masa-pajak"
                  className={SETTINGS_SELECT_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Pilih masa pajak" />
                </SelectTrigger>
                <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                  <SelectGroup>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem
                        key={i + 1}
                        value={String(i + 1)}
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Bulan {i + 1}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className={SETTINGS_CARD_CLASS}>
            <Field className="space-y-3">
              <FieldLabel className={SETTINGS_LABEL_CLASS}>
                Tahun Payroll
              </FieldLabel>
              <Select
                value={String(tahunPayroll)}
                onValueChange={(value) => setTahunPayroll(Number(value))}
              >
                <SelectTrigger
                  id="tahun-payroll"
                  className={SETTINGS_SELECT_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Pilih tahun payroll" />
                </SelectTrigger>
                <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                  <SelectGroup>
                    {availableTaxYears.map((year) => (
                      <SelectItem
                        key={year}
                        value={String(year)}
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        {year}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {importValidationReport && (
          <section className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061] p-5 shadow-xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.25em] text-[#6CA6C1]">
                  Import Validation Report
                </div>
                <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
                  {importValidationReport.errors.length > 0
                    ? 'File belum aman untuk diimport'
                    : 'File siap untuk diproses'}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-4">
                {[
                  ['Rows', importValidationReport.totalRows],
                  ['Valid', importValidationReport.validRows],
                  ['Errors', importValidationReport.errors.length],
                  ['Warnings', importValidationReport.warnings.length],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 py-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                      {label}
                    </div>
                    <div className="mt-1 text-lg font-black text-[#FFE66D]">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {(importValidationReport.errors.length > 0 ||
              importValidationReport.warnings.length > 0) && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {importValidationReport.errors.length > 0 && (
                  <div className="rounded-2xl border border-[#FFE66D]/30 bg-[#FFE66D]/10 p-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                      Errors
                    </h3>
                    <div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs text-[#F7FFF7]/80">
                      {importValidationReport.errors.slice(0, 20).map((issue, index) => (
                        <div key={`${issue.row}-${issue.field}-${index}`}>
                          Baris {issue.row} - {issue.field}: {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {importValidationReport.warnings.length > 0 && (
                  <div className="rounded-2xl border border-[#6CA6C1]/30 bg-[#6CA6C1]/10 p-4">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                      Warnings
                    </h3>
                    <div className="mt-3 max-h-48 space-y-2 overflow-auto text-xs text-[#F7FFF7]/80">
                      {importValidationReport.warnings.slice(0, 20).map((issue, index) => (
                        <div key={`${issue.row}-${issue.field}-${index}`}>
                          Baris {issue.row} - {issue.field}: {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {exportError && (
          <div className="whitespace-pre-line rounded-2xl border border-[#FFE66D]/30 bg-[#FFE66D]/10 px-4 py-3 text-sm text-[#FFE66D]">
            {exportError}
          </div>
        )}

        {historyMessage && (
          <div className="whitespace-pre-line rounded-2xl border border-[#6CA6C1]/35 bg-[#6CA6C1]/10 px-4 py-3 text-sm font-semibold text-[#F7FFF7]">
            {historyMessage}
          </div>
        )}

        {periodLockMessage && (
          <div className="whitespace-pre-line rounded-2xl border border-[#FFE66D]/35 bg-[#FFE66D]/10 px-4 py-3 text-sm font-semibold text-[#FFE66D]">
            {periodLockMessage}
          </div>
        )}

        {employeeList.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061] shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[#6CA6C1]/20 p-6">
              <h2 className="text-lg font-black uppercase tracking-widest">
                Variable Matrix (Masa {masaPajak}/{tahunPayroll})
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleFinalizePeriod}
                  disabled={isFinalizingPeriod || isPeriodLocked}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#FFE66D]/30 ${
                    isFinalizingPeriod || isPeriodLocked
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'border border-[#FFE66D]/50 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
                  }`}
                >
                  {isPeriodLocked
                    ? 'Periode Locked'
                    : isFinalizingPeriod
                      ? 'Mengunci...'
                      : 'Finalize / Lock'}
                </Button>
                <Button
                  onClick={handleSavePayrollHistory}
                  disabled={isSavingHistory || employeeList.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#6CA6C1]/30 ${
                    isSavingHistory || employeeList.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'border border-[#6CA6C1]/50 bg-[#343434]/80 text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434]'
                  }`}
                >
                  {isSavingHistory ? 'Menyimpan...' : 'Simpan Histori'}
                </Button>
                <Button
                  onClick={handleDownloadAllSlip}
                  disabled={isExportingAllSlip || slipEligibleEmployees.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#FFE66D]/30 ${
                    isExportingAllSlip || slipEligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'bg-[#FFE66D] text-[#343434] hover:bg-[#F7FFF7]'
                  }`}
                >
                  {isExportingAllSlip ? 'Membuat ZIP...' : 'Download Semua Slip'}
                </Button>
                <Button
                  onClick={openBpmpModal}
                  className="h-10 rounded-xl border border-[#6CA6C1]/50 bg-[#6CA6C1] px-6 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
                >
                  Generate XML BPMP
                </Button>
                <Button
                  onClick={openBp21Modal}
                  disabled={bp21EligibleEmployees.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#FFE66D]/30 ${
                    bp21EligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'border border-[#FFE66D]/50 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
                  }`}
                >
                  Generate XML BP21
                </Button>
                <Button
                  onClick={openBp26Modal}
                  disabled={bp26EligibleEmployees.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#6CA6C1]/30 ${
                    bp26EligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'border border-[#6CA6C1]/50 bg-[#343434]/80 text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434]'
                  }`}
                >
                  Generate XML BP26
                </Button>
                <Button
                  onClick={openBpa1Modal}
                  disabled={bpa1EligibleEmployees.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#6CA6C1]/30 ${
                    bpa1EligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'border border-[#6CA6C1]/50 bg-[#343434]/80 text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434]'
                  }`}
                >
                  Generate XML BPA1
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[#6CA6C1]/20 bg-[#343434]/35 px-6 py-4">
              {[
                ['ALL', 'Semua'],
                ['TETAP', 'Pegawai Tetap'],
                ['NON_PEGAWAI', 'Bukan Pegawai'],
                ['NEEDS_REVIEW', 'Perlu Dicek'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  onClick={() => setEmployeeFilter(value as EmployeeFilter)}
                  className={`h-9 rounded-lg px-3 text-[11px] font-black focus-visible:ring-[#6CA6C1]/30 ${
                    employeeFilter === value
                      ? 'bg-[#FFE66D] text-[#343434]'
                      : 'border border-[#6CA6C1]/30 bg-[#2F3061]/70 text-[#F7FFF7]/70 hover:border-[#6CA6C1] hover:text-[#FFE66D]'
                  }`}
                >
                  {label} ({filterCounts[value as EmployeeFilter]})
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#343434]/60 text-[10px] font-black uppercase tracking-widest text-[#F7FFF7]/60">
                  <TableRow className="border-[#6CA6C1]/20 hover:bg-transparent">
                    <TableHead className="p-4 text-left">Pegawai</TableHead>
                    <TableHead className="p-4 text-left">Profile</TableHead>
                    <TableHead className="p-4 text-left">Basic Fixed</TableHead>
                    <TableHead className="p-4 text-center">THR / Bonus</TableHead>
                    <TableHead className="p-4 text-center">Lembur</TableHead>
                    <TableHead className="p-4 text-right">Tax</TableHead>
                    <TableHead className="p-4 text-right">THP</TableHead>
                    <TableHead className="p-4 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#6CA6C1]/20">
                  {displayedEmployeeList.map((emp) => {
                    const input = emp.monthlyInputs[masaPajak];
                    const result = emp.monthlyHasils[masaPajak];
                    const slipEligible = isSlipEligible(emp);
                    const receiptEligible = isReceiptEligible(emp);
                    const paymentDocumentEligible = slipEligible || receiptEligible;
                    const isGeneratingSlip =
                      slipExportNik === emp.karyawan.idKaryawan;
                    return (
                      <TableRow
                        key={emp.karyawan.idKaryawan}
                        className="border-[#6CA6C1]/20 hover:bg-[#343434]/45"
                      >
                        <TableCell className="p-4">
                          <div className="font-bold">{emp.karyawan.namaLengkap}</div>
                          <div className="text-[10px] text-[#F7FFF7]/50">{emp.karyawan.nik}</div>
                        </TableCell>
                        <TableCell className="p-4 text-[10px] text-[#F7FFF7]/65">
                          <div>{emp.karyawan.metodePajak} • {emp.karyawan.residentStatus}</div>
                          <div>{emp.karyawan.statusIdentitas} • Aktif {emp.karyawan.bulanMulai}-{emp.karyawan.bulanSelesai}</div>
                        </TableCell>
                        <TableCell className="p-4">{formatCurrency(input.gajiPokok + input.tunjanganTetap)}</TableCell>
                        <TableCell className="p-4">
                          <div className={CURRENCY_INPUT_WRAP_CLASS}>
                            <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrencyInputValue(input.thrAtauBonus)}
                              onChange={(e) =>
                                handleVariableUpdate(
                                  emp,
                                  { bonus: parseCurrencyInput(e.target.value) },
                                  `Update THR/Bonus ${emp.karyawan.namaLengkap}`
                                )
                              }
                              disabled={isPeriodLocked}
                              className={CURRENCY_INPUT_CLASS}
                              placeholder="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <div className={CURRENCY_INPUT_WRAP_CLASS}>
                            <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrencyInputValue(input.tunjanganVariabel)}
                              onChange={(e) =>
                                handleVariableUpdate(
                                  emp,
                                  { lembur: parseCurrencyInput(e.target.value) },
                                  `Update lembur ${emp.karyawan.namaLengkap}`
                                )
                              }
                              disabled={isPeriodLocked}
                              className={CURRENCY_INPUT_CLASS}
                              placeholder="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-right font-bold text-[#FFE66D]">{formatCurrency(result.pajakTerutang)}</TableCell>
                        <TableCell className="p-4 text-right font-black text-[#6CA6C1]">{formatCurrency(result.thpBersih)}</TableCell>
                        <TableCell className="p-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              onClick={() => setSelectedNik(emp.karyawan.idKaryawan)}
                              className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#6CA6C1] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                            >
                              Detail
                            </Button>
                            <Button
                              onClick={() => void handleDownloadSlip(emp)}
                              disabled={!paymentDocumentEligible || isGeneratingSlip || isExportingAllSlip}
                              className={`h-9 rounded-lg px-3 text-xs font-bold focus-visible:ring-[#FFE66D]/30 ${
                                !paymentDocumentEligible || isGeneratingSlip || isExportingAllSlip
                                  ? 'cursor-not-allowed border border-[#6CA6C1]/15 bg-[#343434]/50 text-[#F7FFF7]/35'
                                  : 'border border-[#FFE66D]/50 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
                              }`}
                            >
                              {isGeneratingSlip
                                ? 'Membuat...'
                                : receiptEligible
                                  ? 'Receipt PDF'
                                  : 'Slip PDF'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {isBpmpModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <button
              aria-label="Tutup modal Generate XML BPMP"
              className="absolute inset-0"
              onClick={closeBpmpModal}
            />
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#FFE66D]">Generate XML BPMP</h3>
                  <p className="mt-2 text-xs text-[#F7FFF7]/65">
                    Atur masa pajak, tahun pajak, dan tanggal pemotongan sebelum download XML.
                  </p>
                </div>
                <Button
                  onClick={closeBpmpModal}
                  className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#F7FFF7] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Masa Pajak
                  </label>
                  <Select
                    value={String(bpmpSettings.taxPeriodMonth)}
                    onValueChange={(value) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih masa pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={String(i + 1)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            Bulan {i + 1}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tahun Pajak
                  </label>
                  <Select
                    value={String(bpmpSettings.taxPeriodYear)}
                    onValueChange={(value) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih tahun pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {availableTaxYears.map((year) => (
                          <SelectItem
                            key={year}
                            value={String(year)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tanggal Pemotongan
                  </label>
                  <Input
                    type="date"
                    value={bpmpSettings.withholdingDate}
                    onChange={(e) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className={TABLE_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#F7FFF7]/55">
                  NPWP Pemotong dan ID TKU tetap memakai data perusahaan di form utama.
                </p>
                <Button
                  onClick={() => downloadXML(bpmpSettings)}
                  className="h-11 rounded-xl bg-[#FFE66D] px-5 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                >
                  Download XML
                </Button>
              </div>
            </div>
          </div>
        )}

        {isBp21ModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <button
              aria-label="Tutup modal Generate XML BP21"
              className="absolute inset-0"
              onClick={closeBp21Modal}
            />
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[#FFE66D]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#FFE66D]">Generate XML BP21</h3>
                  <p className="mt-2 text-xs text-[#F7FFF7]/65">
                    Export khusus bukan pegawai dengan format Bp21Bulk.
                  </p>
                </div>
                <Button
                  onClick={closeBp21Modal}
                  className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#F7FFF7] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Masa Pajak
                  </label>
                  <Select
                    value={String(bp21Settings.taxPeriodMonth)}
                    onValueChange={(value) =>
                      setBp21Settings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih masa pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={String(i + 1)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            Bulan {i + 1}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tahun Pajak
                  </label>
                  <Select
                    value={String(bp21Settings.taxPeriodYear)}
                    onValueChange={(value) =>
                      setBp21Settings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih tahun pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {availableTaxYears.map((year) => (
                          <SelectItem
                            key={year}
                            value={String(year)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tanggal Pemotongan
                  </label>
                  <Input
                    type="date"
                    value={bp21Settings.withholdingDate}
                    onChange={(e) =>
                      setBp21Settings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className={TABLE_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#F7FFF7]/55">
                  Ditemukan {bp21EligibleEmployees.length} transaksi bukan pegawai pada masa aktif.
                </p>
                <Button
                  onClick={() => downloadBP21XML(bp21Settings)}
                  className="h-11 rounded-xl bg-[#FFE66D] px-5 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                >
                  Download XML BP21
                </Button>
              </div>
            </div>
          </div>
        )}

        {isBp26ModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <button
              aria-label="Tutup modal Generate XML BP26"
              className="absolute inset-0"
              onClick={closeBp26Modal}
            />
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#FFE66D]">Generate XML BP26</h3>
                  <p className="mt-2 text-xs text-[#F7FFF7]/65">
                    Export pegawai tetap non-resident dengan format BP26Bulk.
                  </p>
                </div>
                <Button
                  onClick={closeBp26Modal}
                  className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#F7FFF7] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Masa Pajak
                  </label>
                  <Select
                    value={String(bp26Settings.taxPeriodMonth)}
                    onValueChange={(value) =>
                      setBp26Settings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih masa pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={String(i + 1)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            Bulan {i + 1}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tahun Pajak
                  </label>
                  <Select
                    value={String(bp26Settings.taxPeriodYear)}
                    onValueChange={(value) =>
                      setBp26Settings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih tahun pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {availableTaxYears.map((year) => (
                          <SelectItem
                            key={year}
                            value={String(year)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tanggal Pemotongan
                  </label>
                  <Input
                    type="date"
                    value={bp26Settings.withholdingDate}
                    onChange={(e) =>
                      setBp26Settings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className={TABLE_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                  Eligible Periode Aktif
                </div>
                <div className="mt-2 text-2xl font-black text-[#6CA6C1]">
                  {bp26EligibleEmployees.length} pegawai
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#F7FFF7]/55">
                  TaxCertificate COD wajib punya receipt, deemed, dan rate dari Excel.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#F7FFF7]/55">
                  BPMP hanya mengambil pegawai resident; non-resident diexport dari modal ini.
                </p>
                <Button
                  onClick={() => downloadBP26XML(bp26Settings)}
                  className="h-11 rounded-xl bg-[#FFE66D] px-5 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                >
                  Download XML BP26
                </Button>
              </div>
            </div>
          </div>
        )}

        {isBpa1ModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <button
              aria-label="Tutup modal Generate XML BPA1"
              className="absolute inset-0"
              onClick={closeBpa1Modal}
            />
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#FFE66D]">Generate XML BPA1</h3>
                  <p className="mt-2 text-xs text-[#F7FFF7]/65">
                    Export A1Bulk untuk pegawai tetap pada masa pajak terakhir.
                  </p>
                </div>
                <Button
                  onClick={closeBpa1Modal}
                  className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#F7FFF7] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Masa Terakhir
                  </label>
                  <Select
                    value={String(bpa1Settings.taxPeriodMonth)}
                    onValueChange={(value) =>
                      setBpa1Settings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih masa terakhir" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={String(i + 1)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            Bulan {i + 1}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tahun Pajak
                  </label>
                  <Select
                    value={String(bpa1Settings.taxPeriodYear)}
                    onValueChange={(value) =>
                      setBpa1Settings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih tahun pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {availableTaxYears.map((year) => (
                          <SelectItem
                            key={year}
                            value={String(year)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tanggal Pemotongan
                  </label>
                  <Input
                    type="date"
                    value={bpa1Settings.withholdingDate}
                    onChange={(e) =>
                      setBpa1Settings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className={TABLE_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                  Eligible Periode Aktif
                </div>
                <div className="mt-2 text-2xl font-black text-[#6CA6C1]">
                  {bpa1EligibleEmployees.length} pegawai
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#F7FFF7]/55">
                  Sistem memakai total bulan aktif, lalu kolom override BPA1 dari Excel jika tersedia.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#F7FFF7]/55">
                  Export ini memakai format A1Bulk sesuai file acuan BPA1.
                </p>
                <Button
                  onClick={() => downloadBPA1XML(bpa1Settings)}
                  className="h-11 rounded-xl bg-[#FFE66D] px-5 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                >
                  Download XML BPA1
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeEmp && activeInput && activeResult && (
          <div className="fixed inset-0 z-50 flex">
            <button className="flex-1 bg-black/70" onClick={() => setSelectedNik(null)} />
            <div className="h-full w-[640px] overflow-y-auto border-l border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7]">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black">{activeEmp.karyawan.namaLengkap}</h3>
                  <p className="mt-2 text-[11px] text-[#F7FFF7]/65">
                    {activeEmp.karyawan.metodePajak} • {activeEmp.karyawan.residentStatus} • {activeEmp.karyawan.statusIdentitas}
                  </p>
                </div>
                <button onClick={() => setSelectedNik(null)} className="text-2xl text-[#F7FFF7]/55 transition-colors hover:text-[#FFE66D]">✕</button>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4 border-b border-[#6CA6C1]/25 pb-2">
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                        Status Pajak Tahunan
                      </h4>
                      <p className="mt-2 text-[11px] text-[#F7FFF7]/55">
                        Tentukan apakah karyawan sudah menjadi subjek pajak dalam negeri sejak 1 Januari.
                        Status ini dipakai untuk memutuskan apakah neto perlu disetahunkan pada masa pajak terakhir.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                    <Field className="space-y-3">
                      <FieldLabel className={SETTINGS_LABEL_CLASS}>
                        Karyawan merupakan Subjek Pajak Dalam Negeri Sejak Awal Tahun?
                      </FieldLabel>
                      <Select
                        value={
                          activeEmp.karyawan.subjekPajakSejakAwalTahun ? 'YA' : 'TIDAK'
                        }
                        disabled={isPeriodLocked}
                        onValueChange={(value) => {
                          if (isPeriodLocked) {
                            setExportError('Periode ini sudah dikunci. Status pajak tidak bisa diubah.');
                            return;
                          }

                          setSubjekPajakSejakAwalTahun(
                            activeEmp.karyawan.idKaryawan,
                            value === 'YA'
                          );
                          void recordPayrollAuditEvent({
                            eventType: 'UPDATE_VARIABLE',
                            companyProfile,
                            periodMonth: masaPajak,
                            periodYear: tahunPayroll,
                            description: `Update status subjek pajak ${activeEmp.karyawan.namaLengkap}`,
                            metadata: {
                              nik: activeEmp.karyawan.nik,
                              subjekPajakSejakAwalTahun: value === 'YA',
                            },
                          });
                        }}
                      >
                        <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                          <SelectValue placeholder="Pilih status subjek pajak" />
                        </SelectTrigger>
                        <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                          <SelectGroup>
                            <SelectItem value="YA" className={SETTINGS_SELECT_ITEM_CLASS}>
                              YA
                            </SelectItem>
                            <SelectItem
                              value="TIDAK"
                              className={SETTINGS_SELECT_ITEM_CLASS}
                            >
                              TIDAK
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-relaxed text-[#F7FFF7]/55">
                        Pilih YA untuk sebagian besar karyawan (WNI maupun WNA) yang memang sudah tinggal di Indonesia sejak sebelum 1 Januari. Gaji mereka TIDAK akan disetahunkan meskipun mereka baru bergabung dengan perusahaan di tengah tahun.
                        Pilih TIDAK hanya untuk kasus: WNA yang baru saja pindah ke Indonesia, atau WNI yang baru pulang menetap dari luar negeri setelah tanggal 1 Januari. Gaji mereka akan disetahunkan.
                      </p>
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4 border-b border-[#FFE66D]/25 pb-2">
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                        Global Nominal Override
                      </h4>
                      <p className="mt-2 text-[11px] text-[#F7FFF7]/55">
                        Isi nominal manual untuk komponen yang ingin dikoreksi. Jika kolom override kosong,
                        sistem tetap memakai nilai asli atau hitung otomatis.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-[#2F3061]/80 text-[10px] font-black uppercase tracking-widest text-[#F7FFF7]/60">
                          <TableRow className="border-[#6CA6C1]/20 hover:bg-transparent">
                            <TableHead className="p-3 text-left">Kelompok</TableHead>
                            <TableHead className="p-3 text-left">Komponen</TableHead>
                            <TableHead className="p-3 text-right">Nilai Awal / Auto</TableHead>
                            <TableHead className="p-3 text-right">Override Nominal</TableHead>
                            <TableHead className="p-3 text-right">Nilai Dipakai</TableHead>
                            <TableHead className="p-3 text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-[#6CA6C1]/20">
                          {activeOverrideRows.map((row) => {
                            const isOverridden = row.overrideValue !== undefined;

                            return (
                              <TableRow
                                key={row.key}
                                className={`border-[#6CA6C1]/20 hover:bg-[#2F3061]/45 ${
                                  isOverridden ? 'bg-[#FFE66D]/10' : ''
                                }`}
                              >
                                <TableCell className="p-3 text-[11px] font-bold text-[#F7FFF7]/50">
                                  {row.group}
                                </TableCell>
                                <TableCell className="p-3 text-[12px] text-[#F7FFF7]">{row.label}</TableCell>
                                <TableCell className="p-3 text-right font-bold text-[#F7FFF7]/65">
                                  Rp {formatCurrency(row.originalValue)}
                                </TableCell>
                                <TableCell className="p-3">
                                  <div className={CURRENCY_INPUT_WRAP_CLASS}>
                                    <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                                      Rp
                                    </span>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Kosong = auto"
                                      value={formatCurrencyInputValue(row.overrideValue, {
                                        emptyZero: false,
                                      })}
                                      onChange={(e) => {
                                        if (isPeriodLocked) {
                                          setExportError('Periode ini sudah dikunci. Override tidak bisa diubah.');
                                          return;
                                        }

                                        setNominalOverride(
                                          activeEmp.karyawan.idKaryawan,
                                          masaPajak,
                                          row.key,
                                          parseNullableCurrencyInput(e.target.value)
                                        );
                                        void recordPayrollAuditEvent({
                                          eventType: 'UPDATE_OVERRIDE',
                                          companyProfile,
                                          periodMonth: masaPajak,
                                          periodYear: tahunPayroll,
                                          description: `Update override ${row.label} - ${activeEmp.karyawan.namaLengkap}`,
                                          metadata: {
                                            nik: activeEmp.karyawan.nik,
                                            key: row.key,
                                            value: parseNullableCurrencyInput(e.target.value),
                                          },
                                        });
                                      }}
                                      disabled={isPeriodLocked}
                                      className={CURRENCY_INPUT_CLASS}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="p-3 text-right font-black text-[#F7FFF7]">
                                  Rp {formatCurrency(row.finalValue)}
                                </TableCell>
                                <TableCell className="p-3 text-center">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      if (isPeriodLocked) {
                                        setExportError('Periode ini sudah dikunci. Override tidak bisa direset.');
                                        return;
                                      }

                                      setNominalOverride(
                                        activeEmp.karyawan.idKaryawan,
                                        masaPajak,
                                        row.key,
                                        null
                                      );
                                      void recordPayrollAuditEvent({
                                        eventType: 'UPDATE_OVERRIDE',
                                        companyProfile,
                                        periodMonth: masaPajak,
                                        periodYear: tahunPayroll,
                                        description: `Reset override ${row.label} - ${activeEmp.karyawan.namaLengkap}`,
                                        metadata: {
                                          nik: activeEmp.karyawan.nik,
                                          key: row.key,
                                          reset: true,
                                        },
                                      });
                                    }}
                                    disabled={!isOverridden || isPeriodLocked}
                                    className={`h-9 rounded-lg px-3 text-[11px] font-bold focus-visible:ring-[#6CA6C1]/30 ${
                                      isOverridden
                                        ? 'bg-[#6CA6C1] text-[#343434]'
                                        : 'cursor-not-allowed bg-[#343434]/50 text-[#F7FFF7]/35'
                                    }`}
                                  >
                                    Reset
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-[#6CA6C1]/25 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/80">
                    Result Snapshot
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Total Bruto Pajak</div>
                      <div className="mt-2 text-2xl font-black text-[#F7FFF7]">Rp {formatCurrency(activeResult.totalBruto)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">THP</div>
                      <div className="mt-2 text-2xl font-black text-[#6CA6C1]">Rp {formatCurrency(activeResult.thpBersih)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Pajak Dipotong</div>
                      <div className="mt-2 text-2xl font-black text-[#FFE66D]">Rp {formatCurrency(activeResult.pajakDipotongDariKaryawan)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Pajak Ditanggung / Refund</div>
                      <div className="mt-2 text-2xl font-black text-[#6CA6C1]">
                        Rp {formatCurrency(activeResult.pajakDitanggungPerusahaan + activeResult.refundPajak)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-[#6CA6C1]/25 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                    Step-by-Step Calculation
                  </h4>
                  <div className="space-y-4">
                    {activeResult.logKalkulasi.map((log, idx) => (
                      <div key={idx} className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-5">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <span className="rounded bg-[#2F3061] px-2 py-1 text-[9px] font-bold uppercase text-[#F7FFF7]/70">
                            Step {idx + 1}
                          </span>
                          <span className="text-right text-lg font-black text-[#F7FFF7]">
                            {typeof log.nilai === 'number' ? `Rp ${formatCurrency(log.nilai)}` : log.nilai}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-[#6CA6C1]">{log.langkah}</h5>
                        <p className="mt-2 text-sm text-[#F7FFF7]/65">{log.deskripsi}</p>
                        {log.rumus && (
                          <div className="mt-4 rounded-xl border border-[#6CA6C1]/20 bg-[#2F3061]/70 p-3">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/45">Logic Formula</div>
                            <code className="break-all text-[11px] leading-relaxed text-[#FFE66D]">{log.rumus}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="rounded-2xl border border-[#FFE66D]/30 bg-[#343434]/80 p-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Take Home Pay</div>
                  <div className="mt-2 text-3xl font-black text-[#FFE66D]">Rp {formatCurrency(activeResult.thpBersih)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
