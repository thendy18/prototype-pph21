import { create } from 'zustand';
import {
  Bp26TaxCertificate,
  Bpa1StatusOfWithholding,
  CoretaxYesNo,
  DataKaryawan,
  FasilitasPajak,
  HasilKalkulasiNonPegawai,
  HasilKalkulasiTetap,
  InputGajiBulanan,
  InputNonPegawai,
  KonfigurasiTarif,
  MetodePajak,
  NominalOverrideKey,
  OverrideBpjsKaryawan,
  OverrideBpjsPerusahaan,
  ResidentStatus,
  StatusIdentitasPajak,
  StatusPtkp,
  TipeKaryawan,
} from '../types/payroll';
import { DEFAULT_TARIF_BPJS } from '../lib/constants';
import { hitungPajakBulanan } from '../lib/taxEngineBulanan';
import { hitungPenyesuaianDesember } from '../lib/taxEngineTahunan';
import { hitungPajakNonPegawai } from '../lib/taxEngineNonPegawai';
import {
  applyNominalOverrides,
  buildNominalOverrideAuditLogs,
  clearLegacyBpjsOverride,
  normalizeNominalOverrideValue,
  updateNominalOverrides,
} from '../lib/payrollOverrides';

interface EmployeeData {
  karyawan: DataKaryawan;
  monthlyInputs: Record<number, InputGajiBulanan>;
  monthlyHasils: Record<number, HasilKalkulasiTetap>;
}

type OverrideBpjsPerusahaanUpdate = {
  premiJkk?: number | null;
  premiJkm?: number | null;
  premiJht?: number | null;
  premiBpjsKes?: number | null;
  premiJp?: number | null;
};

type OverrideBpjsKaryawanUpdate = {
  iuranJht?: number | null;
  iuranBpjsKes?: number | null;
  iuranJp?: number | null;
};

type UpdateVariablePayload = {
  bonus?: number;
  thr?: number;
  lembur?: number;
  dplk?: number;
  zakat?: number;
  gajiPokok?: number;
  tunjanganTetap?: number;
  naturaTaxable?: number;
  premiAsuransiSwastaPerusahaan?: number;
  dasarUpahBpjs?: number | null;
  overrideBpjsPerusahaan?: OverrideBpjsPerusahaanUpdate | null;
  overrideBpjsKaryawan?: OverrideBpjsKaryawanUpdate | null;
};

interface PayrollStore {
  configBpjs: KonfigurasiTarif;
  employees: Record<string, EmployeeData>;

  resetStore: () => void;
  setConfigBpjs: (newConfig: Partial<KonfigurasiTarif>) => void;
  loadDefaultBpjs: () => void;
  importExcel: (rows: Record<string, unknown>[]) => void;
  updateVariable: (
    nik: string,
    bulan: number,
    updates: UpdateVariablePayload
  ) => void;
  setNominalOverride: (
    nik: string,
    bulan: number,
    key: NominalOverrideKey,
    value: number | null
  ) => void;
  setSubjekPajakSejakAwalTahun: (nik: string, value: boolean) => void;
}

const PASSPORT_KEYS = [
  'No Paspor',
  'Nomor Paspor',
  'Paspor',
  'Passport',
  'No Passport',
] as const;

const FASILITAS_PAJAK_KEYS = [
  'Fasilitas Pajak',
  'Tax Certificate',
  'TaxCertificate',
] as const;

const METODE_PAJAK_KEYS = [
  'Metode Pajak',
  'Metode',
  'Tax Method',
] as const;

const SUBJEK_PAJAK_AWAL_TAHUN_KEYS = [
  'Subjek Pajak Sejak Awal Tahun',
  'Subjek Pajak Awal Tahun',
  'Sejak Awal Tahun',
] as const;

function coerceCellToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value
      .toLocaleString('fullwide', {
        useGrouping: false,
        maximumFractionDigits: 20,
      })
      .trim();
  }
  return String(value).trim();
}

function parseNumericCell(nilai: unknown): number {
  if (typeof nilai === 'number') {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  const raw = coerceCellToString(nilai);
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') {
    return 0;
  }

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (commaCount > 0) {
    const [whole, fraction = ''] = cleaned.split(',');
    normalized =
      commaCount > 1 || fraction.length === 3
        ? cleaned.replace(/,/g, '')
        : `${whole}.${fraction}`;
  } else if (dotCount > 0) {
    const [, fraction = ''] = cleaned.split('.');
    normalized =
      dotCount > 1 || fraction.length === 3
        ? cleaned.replace(/\./g, '')
        : cleaned;
  }

  const angka = Number(normalized);
  if (!Number.isFinite(angka)) return 0;
  return angka;
}

function floorRupiah(nilai: unknown): number {
  const angka = parseNumericCell(nilai);
  return Math.floor(angka);
}

function clampMonth(nilai: unknown, fallback: number): number {
  const angka = floorRupiah(nilai);
  if (angka < 1 || angka > 12) return fallback;
  return angka;
}

function bacaString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    const parsed = coerceCellToString(value);
    if (parsed !== '') {
      return parsed;
    }
  }
  return '';
}

function sanitizeDigits(value: unknown): string {
  return coerceCellToString(value).replace(/\D/g, '');
}

function sanitizeFixedDigits(value: unknown, length: number): string | null {
  const digits = sanitizeDigits(value);
  return digits.length === length ? digits : null;
}

function isRowEmpty(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => coerceCellToString(value) === '');
}

function parseTipeKaryawan(row: Record<string, unknown>): TipeKaryawan {
  const tipeRaw = bacaString(row, 'Tipe', 'TIPE', 'Jenis Karyawan').toUpperCase();
  if (tipeRaw.includes('TIDAK') && tipeRaw.includes('TETAP')) {
    return 'PEGAWAI_TIDAK_TETAP';
  }
  if (tipeRaw.includes('NON')) return 'NON_PEGAWAI';
  if (tipeRaw.includes('BUKAN')) return 'NON_PEGAWAI';
  return 'TETAP';
}

function parseJenisPenerima(row: Record<string, unknown>): TipeKaryawan {
  const raw = bacaString(
    row,
    'Jenis Penerima',
    'Jenis Penerima Penghasilan',
    'jenis_penerima'
  ).toUpperCase();

  if (raw.includes('TIDAK') && raw.includes('TETAP')) {
    return 'PEGAWAI_TIDAK_TETAP';
  }
  if (raw.includes('BUKAN') || raw.includes('NON')) {
    return 'NON_PEGAWAI';
  }
  if (raw.includes('TETAP')) {
    return 'TETAP';
  }

  return parseTipeKaryawan(row);
}

function parseStatusIdentitas(row: Record<string, unknown>): StatusIdentitasPajak {
  const raw = bacaString(
    row,
    'Status Identitas',
    'Status Identitas Pajak',
    'Identitas Pajak'
  ).toUpperCase();

  if (raw === 'NPWP') return 'NPWP';
  if (raw === 'NIK_VALID' || raw === 'NIK VALID') return 'NIK_VALID';
  if (raw === 'BELUM_VALID' || raw === 'BELUM VALID') return 'BELUM_VALID';
  if (raw === 'TEMP_TIN' || raw === 'TEMP TIN') return 'TEMP_TIN';

  const adaNpwpRaw = bacaString(row, 'Ada NPWP', 'NPWP').toUpperCase();
  if (adaNpwpRaw === 'YA' || adaNpwpRaw === 'TRUE') return 'NPWP';
  if (adaNpwpRaw === 'TIDAK' || adaNpwpRaw === 'FALSE') return 'BELUM_VALID';

  return 'NPWP';
}

function parseMetodePajak(value: unknown): MetodePajak | null {
  const raw = coerceCellToString(value).toUpperCase();
  if (raw === 'NET') return 'NET';
  if (raw === 'GROSS_UP') return 'GROSS_UP';
  if (raw === 'GROSS') return 'GROSS';
  return null;
}

function parseResidentStatus(row: Record<string, unknown>): ResidentStatus {
  const raw = bacaString(row, 'Resident Status', 'Status Resident').toUpperCase();
  if (raw === 'NON_RESIDENT' || raw === 'NON RESIDENT') return 'NON_RESIDENT';
  return 'RESIDENT';
}

function parseSubjekPajakSejakAwalTahun(
  row: Record<string, unknown>
): boolean {
  const raw = bacaString(row, ...SUBJEK_PAJAK_AWAL_TAHUN_KEYS).toUpperCase();

  if (!raw) return true;
  if (
    raw === 'TIDAK' ||
    raw === 'NO' ||
    raw === 'N' ||
    raw === 'FALSE' ||
    raw === '0'
  ) {
    return false;
  }

  return true;
}

function parseStatusPtkp(
  row: Record<string, unknown>,
  tipeKaryawan: TipeKaryawan
): StatusPtkp {
  const raw = bacaString(row, 'PTKP').toUpperCase();
  if (!raw) {
    return tipeKaryawan === 'NON_PEGAWAI' ? '-' : 'TK/0';
  }

  if (
    raw === 'TK/0' ||
    raw === 'TK/1' ||
    raw === 'TK/2' ||
    raw === 'TK/3' ||
    raw === 'K/0' ||
    raw === 'K/1' ||
    raw === 'K/2' ||
    raw === 'K/3'
  ) {
    return raw;
  }

  return tipeKaryawan === 'NON_PEGAWAI' ? '-' : 'TK/0';
}

function parseFasilitasPajak(row: Record<string, unknown>): FasilitasPajak {
  const rawValue = bacaString(row, ...FASILITAS_PAJAK_KEYS);
  const raw = rawValue.toUpperCase();

  if (
    raw === 'N/A' ||
    raw === 'SKB' ||
    raw === 'DTP' ||
    raw === 'SKD' ||
    raw === 'ETC'
  ) {
    return raw;
  }

  if (raw === 'TAXEXAR21') {
    return 'TaxExAr21';
  }

  return 'N/A';
}

function hasTransactionHeader(row: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(row, 'Jenis Penerima') ||
    Object.prototype.hasOwnProperty.call(row, 'Jenis Penerima Penghasilan') ||
    Object.prototype.hasOwnProperty.call(row, 'jenis_penerima');
}

function isTransactionImport(rows: Record<string, unknown>[]): boolean {
  return rows.some((row) => hasTransactionHeader(row));
}

function isValidIsoDate(value: string): boolean {
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

function parseIsoDateCell(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const raw = coerceCellToString(value);
  if (!raw) return '';
  if (isValidIsoDate(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!slashMatch) return raw;

  const [, dayText, monthText, yearText] = slashMatch;
  const normalized = `${yearText}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
  return isValidIsoDate(normalized) ? normalized : raw;
}

function readTransactionPeriodMonth(row: Record<string, unknown>): number {
  return clampMonth(
    bacaString(row, 'Periode Bulan', 'TaxPeriodMonth', 'Masa Pajak') ||
      row['Periode Bulan'] ||
      row['TaxPeriodMonth'] ||
      row['Masa Pajak'],
    1
  );
}

function parseCoretaxYesNo(value: unknown): CoretaxYesNo | undefined {
  const raw = coerceCellToString(value).toUpperCase();
  if (!raw) return undefined;
  if (raw === 'YES' || raw === 'YA' || raw === 'Y' || raw === 'TRUE' || raw === '1') {
    return 'Yes';
  }
  if (raw === 'NO' || raw === 'TIDAK' || raw === 'N' || raw === 'FALSE' || raw === '0') {
    return 'No';
  }
  return undefined;
}

function parseBpa1StatusOfWithholding(
  value: unknown
): Bpa1StatusOfWithholding | undefined {
  const raw = coerceCellToString(value).toUpperCase().replace(/\s+/g, '');
  if (!raw) return undefined;
  if (raw === 'FULLYEAR' || raw === 'FULL') return 'FullYear';
  if (raw === 'PARTIALYEAR' || raw === 'PARTIAL' || raw === 'KURANGDARISETAHUN') {
    return 'PartialYear';
  }
  if (raw === 'ANNUALIZED' || raw === 'DISETAHUNKAN') return 'Annualized';
  return undefined;
}

function readBpa1Cell(row: Record<string, unknown>, field: string): string {
  return bacaString(
    row,
    `BPA1 ${field}`,
    `BPA1_${field.replace(/\s+/g, '_')}`,
    field
  );
}

function readBpa1Number(
  row: Record<string, unknown>,
  field: string
): number | undefined {
  const raw = readBpa1Cell(row, field);
  if (!raw) return undefined;
  return floorRupiah(raw);
}

function readBpa1Date(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const raw =
    row[`BPA1 ${field}`] ??
    row[`BPA1_${field.replace(/\s+/g, '_')}`] ??
    row[field];
  const parsed = parseIsoDateCell(raw);
  return parsed || undefined;
}

function buildBpa1Metadata(row: Record<string, unknown>): DataKaryawan['bpa1'] {
  const metadata: DataKaryawan['bpa1'] = {};
  const workForSecondEmployer = parseCoretaxYesNo(
    readBpa1Cell(row, 'Work For Second Employer') ||
      readBpa1Cell(row, 'WorkForSecondEmployer') ||
      readBpa1Cell(row, 'Pemberi Kerja Selanjutnya')
  );
  const statusOfWithholding = parseBpa1StatusOfWithholding(
    readBpa1Cell(row, 'Status Of Withholding') ||
      readBpa1Cell(row, 'StatusOfWithholding') ||
      readBpa1Cell(row, 'Status Bukti Potong')
  );
  const taxCertificateRaw =
    readBpa1Cell(row, 'TaxCertificate') ||
    readBpa1Cell(row, 'Tax Certificate') ||
    readBpa1Cell(row, 'Fasilitas Pajak');

  if (workForSecondEmployer) metadata.workForSecondEmployer = workForSecondEmployer;
  if (statusOfWithholding) metadata.statusOfWithholding = statusOfWithholding;

  const taxObjectCode =
    readBpa1Cell(row, 'TaxObjectCode') ||
    readBpa1Cell(row, 'Tax Object Code') ||
    readBpa1Cell(row, 'Kode Objek Pajak');
  if (taxObjectCode) metadata.taxObjectCode = taxObjectCode;

  const prevWhTaxSlip =
    readBpa1Cell(row, 'PrevWhTaxSlip') ||
    readBpa1Cell(row, 'Prev Wh Tax Slip') ||
    readBpa1Cell(row, 'Nomor Bukti Potong Sebelumnya');
  if (prevWhTaxSlip) metadata.prevWhTaxSlip = prevWhTaxSlip;

  if (taxCertificateRaw) {
    metadata.taxCertificate = parseFasilitasPajak({
      'Fasilitas Pajak': taxCertificateRaw,
    });
  }

  metadata.numberOfMonths = readBpa1Number(row, 'Number Of Months') ?? readBpa1Number(row, 'NumberOfMonths');
  metadata.incomeTaxBenefit = readBpa1Number(row, 'IncomeTaxBenefit') ?? readBpa1Number(row, 'Income Tax Benefit');
  metadata.otherBenefit = readBpa1Number(row, 'OtherBenefit') ?? readBpa1Number(row, 'Other Benefit');
  metadata.honorarium = readBpa1Number(row, 'Honorarium');
  metadata.insurancePaidByEmployer = readBpa1Number(row, 'InsurancePaidByEmployer') ?? readBpa1Number(row, 'Insurance Paid By Employer');
  metadata.natura = readBpa1Number(row, 'Natura');
  metadata.tantiemBonusThr = readBpa1Number(row, 'TantiemBonusThr') ?? readBpa1Number(row, 'Tantiem Bonus THR');
  metadata.pensionContributionJhtThtFee =
    readBpa1Number(row, 'PensionContributionJhtThtFee') ??
    readBpa1Number(row, 'Pension Contribution JHT THT Fee');
  metadata.zakat = readBpa1Number(row, 'Zakat');
  metadata.article21IncomeTax = readBpa1Number(row, 'Article21IncomeTax') ?? readBpa1Number(row, 'Article 21 Income Tax');
  metadata.withholdingDate =
    readBpa1Date(row, 'WithholdingDate') ??
    readBpa1Date(row, 'Withholding Date') ??
    readBpa1Date(row, 'Tanggal Pemotongan');

  const hasMetadata = Object.values(metadata).some((value) => value !== undefined && value !== '');
  return hasMetadata ? metadata : undefined;
}

function readPrefixedCell(
  row: Record<string, unknown>,
  prefix: string,
  field: string
): string {
  return bacaString(
    row,
    `${prefix} ${field}`,
    `${prefix}_${field.replace(/\s+/g, '_')}`,
    field
  );
}

function readPrefixedNumber(
  row: Record<string, unknown>,
  prefix: string,
  field: string
): number | undefined {
  const raw = readPrefixedCell(row, prefix, field);
  if (!raw) return undefined;
  const parsed = parseNumericCell(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readPrefixedDate(
  row: Record<string, unknown>,
  prefix: string,
  field: string
): string {
  const raw =
    row[`${prefix} ${field}`] ??
    row[`${prefix}_${field.replace(/\s+/g, '_')}`] ??
    row[field];
  return parseIsoDateCell(raw);
}

function parseBp26TaxCertificate(value: unknown): Bp26TaxCertificate | undefined {
  const raw = coerceCellToString(value).toUpperCase();
  if (!raw) return undefined;
  if (raw === 'N/A') return 'N/A';
  if (raw === 'DTP') return 'DTP';
  if (raw === 'COD') return 'COD';
  if (raw === 'ETC') return 'ETC';
  return undefined;
}

function buildBp26Metadata(row: Record<string, unknown>): DataKaryawan['bp26'] {
  const counterpartReceiptNumber = readPrefixedCell(
    row,
    'BP26',
    'CounterpartReceiptNumber'
  );
  const deemed = readPrefixedNumber(row, 'BP26', 'Deemed');
  const rate = readPrefixedNumber(row, 'BP26', 'Rate');
  const taxCertificate =
    parseBp26TaxCertificate(readPrefixedCell(row, 'BP26', 'TaxCertificate')) ??
    'N/A';
  const documentType = bacaString(
    row,
    'Document',
    'Jenis Dokumen',
    'BP26 Document'
  );
  const documentNumber = bacaString(
    row,
    'DocumentNumber',
    'Document Number',
    'Nomor Dokumen',
    'BP26 DocumentNumber'
  );
  const documentDate = parseIsoDateCell(
    row['DocumentDate'] ??
      row['Document Date'] ??
      row['Tanggal Dokumen'] ??
      row['BP26 DocumentDate']
  );
  const withholdingDate =
    parseIsoDateCell(
      row['WithholdingDate'] ??
        row['Withholding Date'] ??
        row['Tanggal Pemotongan'] ??
        row['BP26 WithholdingDate']
    ) || undefined;

  return {
    counterpartTin: readPrefixedCell(row, 'BP26', 'CounterpartTin'),
    counterpartReceiptNumber: counterpartReceiptNumber || '-',
    country: readPrefixedCell(row, 'BP26', 'Country'),
    address: readPrefixedCell(row, 'BP26', 'Address'),
    dateOfBirth: readPrefixedDate(row, 'BP26', 'Date Of Birth'),
    birthCity: readPrefixedCell(row, 'BP26', 'Birth City'),
    kitas: readPrefixedCell(row, 'BP26', 'Kitas') || undefined,
    taxCertificate,
    taxObjectCode: readPrefixedCell(row, 'BP26', 'TaxObjectCode') || '27-100-99',
    deemed: deemed ?? 100,
    rate: rate ?? 20,
    documentType,
    documentNumber,
    documentDate,
    withholdingDate,
    hasExplicitDeemed: deemed !== undefined,
    hasExplicitRate: rate !== undefined,
    hasExplicitReceiptNumber: counterpartReceiptNumber !== '',
  };
}

function validateBp26Metadata(
  metadata: DataKaryawan['bp26'],
  rowNumber: number
): string[] {
  const errors: string[] = [];
  if (!metadata) return errors;

  if (!metadata.counterpartTin) {
    errors.push(`Baris ${rowNumber}: BP26 CounterpartTin wajib diisi.`);
  }
  if (!metadata.country) {
    errors.push(`Baris ${rowNumber}: BP26 Country wajib diisi.`);
  }
  if (!metadata.address) {
    errors.push(`Baris ${rowNumber}: BP26 Address wajib diisi.`);
  }
  if (!metadata.dateOfBirth || !isValidIsoDate(metadata.dateOfBirth)) {
    errors.push(`Baris ${rowNumber}: BP26 Date Of Birth wajib berformat YYYY-MM-DD.`);
  }
  if (!metadata.birthCity) {
    errors.push(`Baris ${rowNumber}: BP26 Birth City wajib diisi.`);
  }
  if (!metadata.documentType) {
    errors.push(`Baris ${rowNumber}: Document wajib diisi untuk BP26.`);
  }
  if (!metadata.documentNumber) {
    errors.push(`Baris ${rowNumber}: DocumentNumber wajib diisi untuk BP26.`);
  }
  if (!metadata.documentDate || !isValidIsoDate(metadata.documentDate)) {
    errors.push(`Baris ${rowNumber}: DocumentDate wajib berformat YYYY-MM-DD untuk BP26.`);
  }
  if (metadata.withholdingDate && !isValidIsoDate(metadata.withholdingDate)) {
    errors.push(`Baris ${rowNumber}: WithholdingDate harus berformat YYYY-MM-DD.`);
  }
  if (metadata.taxCertificate === 'COD') {
    if (!metadata.hasExplicitReceiptNumber || metadata.counterpartReceiptNumber === '-') {
      errors.push(`Baris ${rowNumber}: BP26 CounterpartReceiptNumber wajib diisi untuk TaxCertificate COD.`);
    }
    if (!metadata.hasExplicitDeemed) {
      errors.push(`Baris ${rowNumber}: BP26 Deemed wajib diisi untuk TaxCertificate COD.`);
    }
    if (!metadata.hasExplicitRate) {
      errors.push(`Baris ${rowNumber}: BP26 Rate wajib diisi untuk TaxCertificate COD.`);
    }
  }

  return errors;
}

function parseMonthFromIsoDate(value: unknown): number | null {
  const normalized = parseIsoDateCell(value);
  if (!normalized || !isValidIsoDate(normalized)) return null;
  const month = Number(normalized.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

function readPayrollStartMonth(row: Record<string, unknown>, fallback: number): number {
  const explicitMonth = bacaString(
    row,
    'Bln Mulai',
    'Bulan Mulai',
    'Bulan Masuk',
    'Bulan Mulai Kerja'
  );
  if (explicitMonth) return clampMonth(explicitMonth, fallback);

  return parseMonthFromIsoDate(
    row['Tanggal Mulai Kerja'] ??
      row['Tanggal Masuk'] ??
      row['Tanggal Bergabung']
  ) ?? fallback;
}

function readPayrollEndMonth(row: Record<string, unknown>, fallback: number): number {
  const explicitMonth = bacaString(
    row,
    'Bln Selesai',
    'Bulan Selesai',
    'Bulan Keluar',
    'Bulan Akhir Kerja'
  );
  if (explicitMonth) return clampMonth(explicitMonth, fallback);

  return parseMonthFromIsoDate(
    row['Tanggal Selesai Kerja'] ??
      row['Tanggal Keluar'] ??
      row['Tanggal Resign']
  ) ?? fallback;
}

function parseNoPaspor(
  row: Record<string, unknown>,
  residentStatus: ResidentStatus
): string | null {
  if (residentStatus !== 'NON_RESIDENT') {
    return null;
  }

  const raw = bacaString(row, ...PASSPORT_KEYS);
  return raw || null;
}

function buildEmptyResult(
  karyawan: DataKaryawan,
  bulan: number,
  alasan: string
): HasilKalkulasiTetap {
  return {
    metodePajak: karyawan.metodePajak,
    residentStatus: karyawan.residentStatus,
    isMasaPajakTerakhir: false,
    totalGajiTunjangan: 0,
    totalPenghasilanCash: 0,
    thrAtauBonus: 0,
    naturaTaxable: 0,
    premiAsuransiSwastaPerusahaan: 0,
    iuranPensiunPerusahaan: 0,
    dasarUpahBpjs: 0,
    premiJkkPerusahaan: 0,
    premiJkmPerusahaan: 0,
    premiJhtPerusahaan: 0,
    premiBpjsKesPerusahaan: 0,
    premiJpPerusahaan: 0,
    tunjanganPajakGrossUp: 0,
    totalPenambahBrutoPajak: 0,
    totalBruto: 0,
    iuranJhtKaryawan: 0,
    iuranJpKaryawan: 0,
    iuranBpjsKesKaryawan: 0,
    iuranPensiunKaryawan: 0,
    potonganDplkKaryawan: 0,
    potonganZakat: 0,
    totalIuranCashKaryawan: 0,
    totalPengurangPajak: 0,
    kategoriTER: null,
    rateTER: null,
    pajakTerutang: 0,
    penyesuaianPajak: 0,
    pajakDipotongDariKaryawan: 0,
    pajakDitanggungPerusahaan: 0,
    refundPajak: 0,
    statusLebihBayar: false,
    thpBersih: 0,
    logKalkulasi: [
      {
        langkah: `${bulan}`,
        deskripsi: 'Bulan tidak aktif',
        nilai: 0,
        rumus: alasan,
      },
    ],
  };
}

function mapNonPegawaiResult(
  karyawan: DataKaryawan,
  input: InputGajiBulanan,
  hasil: HasilKalkulasiNonPegawai
): HasilKalkulasiTetap {
  const effectiveInput = applyNominalOverrides(input);
  const totalPendapatan =
    effectiveInput.gajiPokok +
    effectiveInput.tunjanganTetap +
    effectiveInput.tunjanganVariabel +
    effectiveInput.thrAtauBonus +
    effectiveInput.naturaTaxable;

  const pajakTerutang = floorRupiah(hasil?.pajakTerutang);
  const thpBersih = floorRupiah(hasil?.thpBersih);
  const overrideLogs = buildNominalOverrideAuditLogs(input, karyawan.tipeKaryawan);

  return {
    metodePajak: karyawan.metodePajak,
    residentStatus: karyawan.residentStatus,
    isMasaPajakTerakhir: input.bulan === karyawan.bulanSelesai,
    totalGajiTunjangan:
      effectiveInput.gajiPokok +
      effectiveInput.tunjanganTetap +
      effectiveInput.tunjanganVariabel,
    totalPenghasilanCash:
      effectiveInput.gajiPokok +
      effectiveInput.tunjanganTetap +
      effectiveInput.tunjanganVariabel +
      effectiveInput.thrAtauBonus,
    thrAtauBonus: effectiveInput.thrAtauBonus,
    naturaTaxable: effectiveInput.naturaTaxable,
    premiAsuransiSwastaPerusahaan: effectiveInput.premiAsuransiSwastaPerusahaan,
    iuranPensiunPerusahaan: effectiveInput.iuranPensiunPerusahaan,
    dasarUpahBpjs: 0,
    premiJkkPerusahaan: 0,
    premiJkmPerusahaan: 0,
    premiJhtPerusahaan: 0,
    premiBpjsKesPerusahaan: 0,
    premiJpPerusahaan: 0,
    tunjanganPajakGrossUp: 0,
    totalPenambahBrutoPajak:
      effectiveInput.naturaTaxable +
      effectiveInput.premiAsuransiSwastaPerusahaan,
    totalBruto: floorRupiah(hasil?.totalBruto ?? totalPendapatan),
    iuranJhtKaryawan: 0,
    iuranJpKaryawan: 0,
    iuranBpjsKesKaryawan: 0,
    iuranPensiunKaryawan: 0,
    potonganDplkKaryawan: 0,
    potonganZakat: 0,
    totalIuranCashKaryawan: 0,
    totalPengurangPajak: 0,
    kategoriTER: null,
    rateTER: hasil?.rateEfektif ?? null,
    pajakTerutang,
    penyesuaianPajak: pajakTerutang,
    pajakDipotongDariKaryawan: pajakTerutang,
    pajakDitanggungPerusahaan: 0,
    refundPajak: 0,
    statusLebihBayar: false,
    thpBersih,
    logKalkulasi: [
      ...overrideLogs,
      ...(Array.isArray(hasil?.logKalkulasi) ? hasil.logKalkulasi : []),
    ],
  };
}

function mergeOverridePerusahaan(
  current: OverrideBpjsPerusahaan | undefined,
  update: OverrideBpjsPerusahaanUpdate | null | undefined
): OverrideBpjsPerusahaan | undefined {
  if (update === undefined) return current;
  if (update === null) return undefined;

  const next: OverrideBpjsPerusahaan = { ...(current ?? {}) };

  if ('premiJkk' in update) {
    if (update.premiJkk === null) delete next.premiJkk;
    else next.premiJkk = floorRupiah(update.premiJkk);
  }
  if ('premiJkm' in update) {
    if (update.premiJkm === null) delete next.premiJkm;
    else next.premiJkm = floorRupiah(update.premiJkm);
  }
  if ('premiJht' in update) {
    if (update.premiJht === null) delete next.premiJht;
    else next.premiJht = floorRupiah(update.premiJht);
  }
  if ('premiBpjsKes' in update) {
    if (update.premiBpjsKes === null) delete next.premiBpjsKes;
    else next.premiBpjsKes = floorRupiah(update.premiBpjsKes);
  }
  if ('premiJp' in update) {
    if (update.premiJp === null) delete next.premiJp;
    else next.premiJp = floorRupiah(update.premiJp);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeOverrideKaryawan(
  current: OverrideBpjsKaryawan | undefined,
  update: OverrideBpjsKaryawanUpdate | null | undefined
): OverrideBpjsKaryawan | undefined {
  if (update === undefined) return current;
  if (update === null) return undefined;

  const next: OverrideBpjsKaryawan = { ...(current ?? {}) };

  if ('iuranJht' in update) {
    if (update.iuranJht === null) delete next.iuranJht;
    else next.iuranJht = floorRupiah(update.iuranJht);
  }
  if ('iuranBpjsKes' in update) {
    if (update.iuranBpjsKes === null) delete next.iuranBpjsKes;
    else next.iuranBpjsKes = floorRupiah(update.iuranBpjsKes);
  }
  if ('iuranJp' in update) {
    if (update.iuranJp === null) delete next.iuranJp;
    else next.iuranJp = floorRupiah(update.iuranJp);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeInputConfig(
  input: InputGajiBulanan,
  config: KonfigurasiTarif
): InputGajiBulanan {
  return {
    ...input,
    konfigurasiTarif: config,
  };
}

function calculateFullYear(
  emp: EmployeeData,
  config: KonfigurasiTarif
): Record<number, HasilKalkulasiTetap> {
  const newHasils: Record<number, HasilKalkulasiTetap> = {};
  const bulanMulai = emp.karyawan.bulanMulai;
  const bulanSelesai = emp.karyawan.bulanSelesai;
  const bulanAktif = Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (bulan) => bulan >= bulanMulai && bulan <= bulanSelesai
  );

  for (let bulan = 1; bulan <= 12; bulan += 1) {
    if (bulan < bulanMulai || bulan > bulanSelesai) {
      newHasils[bulan] = buildEmptyResult(
        emp.karyawan,
        bulan,
        `Bulan ${bulan} di luar rentang aktif ${bulanMulai}-${bulanSelesai}`
      );
    }
  }

  if (bulanAktif.length === 0) {
    return newHasils;
  }

  if (emp.karyawan.tipeKaryawan === 'NON_PEGAWAI') {
    for (const bulan of bulanAktif) {
      const inp = normalizeInputConfig(emp.monthlyInputs[bulan], config);
      const effectiveInput = applyNominalOverrides(inp);
      const totalPendapatan =
        effectiveInput.gajiPokok +
        effectiveInput.tunjanganTetap +
        effectiveInput.tunjanganVariabel +
        effectiveInput.thrAtauBonus +
        effectiveInput.naturaTaxable;

      const inputNonPegawai: InputNonPegawai = {
        totalPendapatan,
        statusIdentitas: emp.karyawan.statusIdentitas,
        residentStatus: emp.karyawan.residentStatus,
        metodePajak: emp.karyawan.metodePajak,
        deemedPersentase: emp.karyawan.bp21?.deemedPersentase,
        kodeObjekPajak: emp.karyawan.bp21?.taxObjectCode,
        jenisDokumen: emp.karyawan.bp21?.documentType,
        nomorDokumen: emp.karyawan.bp21?.documentNumber,
        tanggalDokumen: emp.karyawan.bp21?.documentDate,
        tanggalPemotongan: emp.karyawan.bp21?.withholdingDate,
        taxCertificate: emp.karyawan.bp21?.taxCertificate ?? emp.karyawan.fasilitasPajak,
        adaNPWP: emp.karyawan.adaNPWP,
      };
      const hasilNP = hitungPajakNonPegawai(inputNonPegawai);

      newHasils[bulan] = mapNonPegawaiResult(emp.karyawan, inp, hasilNP);
    }

    return newHasils;
  }

  const bulanTerakhir = bulanAktif[bulanAktif.length - 1];
  let totalPajakSebelumnya = 0;

  for (const bulan of bulanAktif) {
    const inp = normalizeInputConfig(emp.monthlyInputs[bulan], config);

    if (emp.karyawan.residentStatus === 'RESIDENT' && bulan === bulanTerakhir) {
      newHasils[bulan] = hitungPenyesuaianDesember(
        emp.karyawan,
        Object.values(emp.monthlyInputs).map((item) => normalizeInputConfig(item, config)),
        totalPajakSebelumnya,
        config
      );
    } else {
      const hasil = hitungPajakBulanan(emp.karyawan, inp);
      newHasils[bulan] = hasil;
      totalPajakSebelumnya += hasil.pajakTerutang;
    }
  }

  return newHasils;
}

const EMPTY_BPJS: KonfigurasiTarif = {
  rateJkkPerusahaan: 0,
  rateJkmPerusahaan: 0,
  rateJhtPerusahaan: 0,
  rateBpjsKesPerusahaan: 0,
  rateJpPerusahaan: 0,
  rateJhtKaryawan: 0,
  rateBpjsKesKaryawan: 0,
  rateJpKaryawan: 0,
  rateDplkPerusahaan: 0,
  rateDplkKaryawan: 0,
  rateZakat: 0,
  plafonJp: 10547400,
  plafonBpjsKes: 12000000,
  basisUpahBpjs: 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP',
};

function createEmptyBpjsConfig(): KonfigurasiTarif {
  return { ...EMPTY_BPJS };
}

function createInitialStoreState() {
  return {
    configBpjs: createEmptyBpjsConfig(),
    employees: {} as Record<string, EmployeeData>,
  };
}

function createMonthlyInputsFromTransaction(
  row: Record<string, unknown>,
  config: KonfigurasiTarif,
  activeMonth: number,
  tipeKaryawan: TipeKaryawan
): Record<number, InputGajiBulanan> {
  const monthlyInputs: Record<number, InputGajiBulanan> = {};
  const bruto = floorRupiah(
    row['Bruto'] ?? row['Gross'] ?? row['Total Bruto'] ?? row['Penghasilan Bruto']
  );
  const tunjanganTetapUmum = floorRupiah(row['Tunjangan Tetap']);
  const tunjanganRincian =
    floorRupiah(row['Tunjangan Jabatan']) +
    floorRupiah(row['Tunj Transport']) +
    floorRupiah(row['Tunjangan Makan']);
  const totalTunjanganTetap = tunjanganTetapUmum + tunjanganRincian;
  const gajiPokokTetap = floorRupiah(row['Gaji Pokok']);

  for (let bulan = 1; bulan <= 12; bulan += 1) {
    const isNonPegawaiActiveMonth =
      tipeKaryawan === 'NON_PEGAWAI' && bulan === activeMonth;
    const isPegawaiTetap = tipeKaryawan === 'TETAP';

    monthlyInputs[bulan] = {
      bulan,
      gajiPokok: isPegawaiTetap
        ? gajiPokokTetap || Math.max(bruto - totalTunjanganTetap, 0)
        : isNonPegawaiActiveMonth
          ? bruto
          : 0,
      tunjanganTetap: isPegawaiTetap ? totalTunjanganTetap : 0,
      tunjanganVariabel: 0,
      thrAtauBonus: 0,
      naturaTaxable: isPegawaiTetap
        ? floorRupiah(row['Natura'] ?? row['Natura Taxable'])
        : 0,
      premiAsuransiSwastaPerusahaan: isPegawaiTetap
        ? floorRupiah(row['Premi Asuransi Swasta Perusahaan'])
        : 0,
      iuranPensiunPerusahaan: isPegawaiTetap
        ? floorRupiah(row['Iuran Pensiun Perusahaan'])
        : 0,
      iuranPensiunKaryawan: isPegawaiTetap
        ? floorRupiah(row['Iuran Pensiun Karyawan'])
        : 0,
      dplkPerusahaan: isPegawaiTetap
        ? floorRupiah(row['DPLK Perusahaan'])
        : 0,
      dplkKaryawan: isPegawaiTetap
        ? floorRupiah(row['DPLK Karyawan'])
        : 0,
      zakat: 0,
      dasarUpahBpjs: isPegawaiTetap
        ? floorRupiah(row['Dasar Upah BPJS']) || undefined
        : undefined,
      overrideBpjsPerusahaan: undefined,
      overrideBpjsKaryawan: undefined,
      originalTunjangan: isPegawaiTetap ? totalTunjanganTetap : 0,
      isOverridden: false,
      konfigurasiTarif: config,
    };
  }

  return monthlyInputs;
}

function makeTransactionEmployeeId(
  nik: string,
  periodMonth: number,
  excelRowNumber: number,
  documentNumber: string
): string {
  const safeDocument = documentNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-12);
  return `${nik}-${periodMonth}-${excelRowNumber}-${safeDocument || 'TX'}`;
}

function buildEmployeesFromTransactionRows(
  rows: Record<string, unknown>[],
  config: KonfigurasiTarif
): Record<string, EmployeeData> {
  const newEmployees: Record<string, EmployeeData> = {};
  const validationErrors: string[] = [];

  rows.forEach((row, index) => {
    const excelRowNumber = index + 2;
    if (isRowEmpty(row)) return;

    const tipeKaryawan = parseJenisPenerima(row);
    if (tipeKaryawan === 'PEGAWAI_TIDAK_TETAP') {
      validationErrors.push(
        `Baris ${excelRowNumber}: Pegawai Tidak Tetap belum didukung pada v1.`
      );
      return;
    }

    const rawNik = bacaString(row, 'NIK', 'Nik');
    const nik = sanitizeFixedDigits(rawNik, 16);
    if (!rawNik) {
      validationErrors.push(`Baris ${excelRowNumber}: NIK wajib diisi.`);
      return;
    }
    if (!nik) {
      validationErrors.push(
        `Baris ${excelRowNumber}: NIK harus tepat 16 digit angka.`
      );
      return;
    }

    const metodePajakRaw = bacaString(row, ...METODE_PAJAK_KEYS);
    const metodePajak = parseMetodePajak(metodePajakRaw);
    if (!metodePajak) {
      validationErrors.push(
        `Baris ${excelRowNumber}: Metode Pajak harus GROSS, NET, atau GROSS_UP.`
      );
      return;
    }

    const periodMonth = readTransactionPeriodMonth(row);
    const bulanMulai = tipeKaryawan === 'TETAP'
      ? readPayrollStartMonth(row, periodMonth)
      : periodMonth;
    const bulanSelesai = tipeKaryawan === 'TETAP'
      ? readPayrollEndMonth(row, 12)
      : periodMonth;
    const bulanSelesaiFinal = bulanSelesai < bulanMulai ? bulanMulai : bulanSelesai;
    const residentStatus = parseResidentStatus(row);
    const statusIdentitas = parseStatusIdentitas(row);
    const subjekPajakSejakAwalTahun =
      parseSubjekPajakSejakAwalTahun(row);
    const counterpartTinRaw = bacaString(row, 'Counterpart TIN', 'CounterpartTin');
    const counterpartTin = counterpartTinRaw
      ? sanitizeFixedDigits(counterpartTinRaw, 16)
      : nik;
    if (counterpartTinRaw && !counterpartTin) {
      validationErrors.push(
        `Baris ${excelRowNumber}: Counterpart TIN harus tepat 16 digit angka.`
      );
      return;
    }

    const fasilitasPajak = parseFasilitasPajak(row);
    const documentNumber = bacaString(row, 'DocumentNumber', 'Document Number', 'Nomor Dokumen');
    const bp26Metadata =
      tipeKaryawan === 'TETAP' && residentStatus === 'NON_RESIDENT'
        ? buildBp26Metadata(row)
        : undefined;
    validationErrors.push(...validateBp26Metadata(bp26Metadata, excelRowNumber));
    const idKaryawan = tipeKaryawan === 'TETAP'
      ? nik
      : makeTransactionEmployeeId(
          nik,
          periodMonth,
          excelRowNumber,
          documentNumber
        );

    const karyawan: DataKaryawan = {
      idKaryawan,
      nik,
      namaLengkap: bacaString(row, 'Nama', 'Nama Penerima') || 'Tanpa Nama',
      statusPtkp: parseStatusPtkp(row, tipeKaryawan),
      statusIdentitas,
      metodePajak,
      residentStatus,
      tipeKaryawan,
      bulanMulai,
      bulanSelesai: bulanSelesaiFinal,
      subjekPajakSejakAwalTahun,
      jabatan: bacaString(row, 'Jabatan') || undefined,
      counterpartTin: counterpartTin ?? nik,
      temporaryTin: bacaString(row, 'Temporary TIN') || undefined,
      noPaspor: parseNoPaspor(row, residentStatus),
      fasilitasPajak,
      bpa1: tipeKaryawan === 'TETAP' ? buildBpa1Metadata(row) : undefined,
      bp26: bp26Metadata,
      adaNPWP: statusIdentitas === 'NPWP' || statusIdentitas === 'NIK_VALID',
    };

    if (tipeKaryawan === 'NON_PEGAWAI') {
      const taxObjectCode = bacaString(row, 'TaxObjectCode', 'Tax Object Code', 'Kode Objek Pajak');
      const documentType = bacaString(row, 'Document', 'Jenis Dokumen');
      const documentDate = parseIsoDateCell(
        row['DocumentDate'] ?? row['Document Date'] ?? row['Tanggal Dokumen']
      );
      const withholdingDate = parseIsoDateCell(
        row['WithholdingDate'] ?? row['Withholding Date'] ?? row['Tanggal Pemotongan']
      );
      const idTkuPenerimaRaw = bacaString(
        row,
        'ID TKU Penerima',
        'IDPlaceOfBusinessActivityOfIncomeRecipient',
        'ID TKU'
      );
      const idTkuPenerima = sanitizeFixedDigits(idTkuPenerimaRaw, 22);

      if (!taxObjectCode) {
        validationErrors.push(`Baris ${excelRowNumber}: TaxObjectCode wajib diisi untuk BP21.`);
      }
      if (!documentType) {
        validationErrors.push(`Baris ${excelRowNumber}: Document wajib diisi untuk BP21.`);
      }
      if (!documentNumber) {
        validationErrors.push(`Baris ${excelRowNumber}: DocumentNumber wajib diisi untuk BP21.`);
      }
      if (!documentDate || !isValidIsoDate(documentDate)) {
        validationErrors.push(
          `Baris ${excelRowNumber}: DocumentDate wajib berformat YYYY-MM-DD untuk BP21.`
        );
      }
      if (!idTkuPenerimaRaw || !idTkuPenerima) {
        validationErrors.push(
          `Baris ${excelRowNumber}: ID TKU Penerima harus tepat 22 digit angka untuk BP21.`
        );
      }
      if (withholdingDate && !isValidIsoDate(withholdingDate)) {
        validationErrors.push(
          `Baris ${excelRowNumber}: WithholdingDate harus berformat YYYY-MM-DD.`
        );
      }

      karyawan.bp21 = {
        taxObjectCode,
        deemedPersentase: floorRupiah(row['Deemed'] ?? row['Deemed Persentase']) || 50,
        documentType,
        documentNumber,
        documentDate,
        withholdingDate: withholdingDate || undefined,
        idTkuPenerima: idTkuPenerima ?? '',
        taxCertificate: fasilitasPajak,
      };
    }

    const empTemplate: EmployeeData = {
      karyawan,
      monthlyInputs: createMonthlyInputsFromTransaction(
        row,
        config,
        periodMonth,
        tipeKaryawan
      ),
      monthlyHasils: {} as Record<number, HasilKalkulasiTetap>,
    };

    empTemplate.monthlyHasils = calculateFullYear(empTemplate, config);
    newEmployees[idKaryawan] = empTemplate;
  });

  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('\n'));
  }

  return newEmployees;
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  ...createInitialStoreState(),

  resetStore: () => set(createInitialStoreState()),

  loadDefaultBpjs: () => get().setConfigBpjs({ ...DEFAULT_TARIF_BPJS }),

  setConfigBpjs: (newConfig) =>
    set((state) => {
      const updatedConfig = { ...state.configBpjs, ...newConfig };
      const updatedEmployees = Object.fromEntries(
        Object.entries(state.employees).map(([nik, emp]) => {
          const monthlyInputs = Object.fromEntries(
            Object.entries(emp.monthlyInputs).map(([bulan, input]) => [
              Number(bulan),
              {
                ...input,
                konfigurasiTarif: updatedConfig,
              },
            ])
          ) as Record<number, InputGajiBulanan>;

          const updatedEmp: EmployeeData = {
            ...emp,
            monthlyInputs,
          };

          return [nik, { ...updatedEmp, monthlyHasils: calculateFullYear(updatedEmp, updatedConfig) }];
        })
      );

      return {
        configBpjs: updatedConfig,
        employees: updatedEmployees,
      };
    }),

  importExcel: (rows) =>
    set((state) => {
      if (isTransactionImport(rows)) {
        return {
          employees: buildEmployeesFromTransactionRows(rows, state.configBpjs),
        };
      }

      const newEmployees: Record<string, EmployeeData> = {};
      const validationErrors: string[] = [];

      rows.forEach((row, index) => {
        const excelRowNumber = index + 2;
        if (isRowEmpty(row)) return;

        const rawNik = bacaString(row, 'NIK', 'Nik');
        const nik = sanitizeFixedDigits(rawNik, 16);
        if (!rawNik) {
          validationErrors.push(`Baris ${excelRowNumber}: NIK wajib diisi.`);
          return;
        }
        if (!nik) {
          validationErrors.push(
            `Baris ${excelRowNumber}: NIK harus tepat 16 digit angka.`
          );
          return;
        }

        const tipeKaryawan = parseTipeKaryawan(row);
        const statusIdentitas = parseStatusIdentitas(row);
        const metodePajakRaw = bacaString(row, ...METODE_PAJAK_KEYS);
        if (!metodePajakRaw) {
          validationErrors.push(
            `Baris ${excelRowNumber}: Metode Pajak wajib diisi.`
          );
          return;
        }

        const metodePajak = parseMetodePajak(metodePajakRaw);
        if (!metodePajak) {
          validationErrors.push(
            `Baris ${excelRowNumber}: Metode Pajak harus salah satu dari GROSS, NET, atau GROSS_UP.`
          );
          return;
        }

        const residentStatus = parseResidentStatus(row);
        const subjekPajakSejakAwalTahun =
          parseSubjekPajakSejakAwalTahun(row);
        const counterpartTinRaw = bacaString(row, 'Counterpart TIN', 'CounterpartTin');
        const counterpartTin = counterpartTinRaw
          ? sanitizeFixedDigits(counterpartTinRaw, 16)
          : nik;
        if (counterpartTinRaw && !counterpartTin) {
          validationErrors.push(
            `Baris ${excelRowNumber}: Counterpart TIN harus tepat 16 digit angka.`
          );
          return;
        }

        const bulanMulai = clampMonth(row['Bln Mulai'], 1);
        const bulanSelesai = clampMonth(row['Bln Selesai'], 12);
        const bulanSelesaiFinal = bulanSelesai < bulanMulai ? bulanMulai : bulanSelesai;

        const tunjanganTetapUmum = floorRupiah(row['Tunjangan Tetap']);
        const tunjanganRincian =
          floorRupiah(row['Tunjangan Jabatan']) +
          floorRupiah(row['Tunj Transport']) +
          floorRupiah(row['Tunjangan Makan']);
        const totalTunjanganTetap = tunjanganTetapUmum + tunjanganRincian;
        const bp26Metadata =
          tipeKaryawan === 'TETAP' && residentStatus === 'NON_RESIDENT'
            ? buildBp26Metadata(row)
            : undefined;
        validationErrors.push(...validateBp26Metadata(bp26Metadata, excelRowNumber));

        const karyawan: DataKaryawan = {
          idKaryawan: nik,
          nik,
          namaLengkap: bacaString(row, 'Nama') || 'Tanpa Nama',
          statusPtkp: parseStatusPtkp(row, tipeKaryawan),
          statusIdentitas,
          metodePajak,
          residentStatus,
          tipeKaryawan,
          bulanMulai,
          bulanSelesai: bulanSelesaiFinal,
          subjekPajakSejakAwalTahun,
          jabatan: bacaString(row, 'Jabatan') || undefined,
          counterpartTin: counterpartTin ?? nik,
          temporaryTin: bacaString(row, 'Temporary TIN') || undefined,
          noPaspor: parseNoPaspor(row, residentStatus),
          fasilitasPajak: parseFasilitasPajak(row),
          bpa1: tipeKaryawan === 'TETAP' ? buildBpa1Metadata(row) : undefined,
          bp26: bp26Metadata,
          adaNPWP: statusIdentitas === 'NPWP' || statusIdentitas === 'NIK_VALID',
        };

        const monthlyInputs: Record<number, InputGajiBulanan> = {};

        for (let bulan = 1; bulan <= 12; bulan += 1) {
          monthlyInputs[bulan] = {
            bulan,
            gajiPokok: floorRupiah(row['Gaji Pokok']),
            tunjanganTetap: totalTunjanganTetap,
            tunjanganVariabel: 0,
            thrAtauBonus: 0,
            naturaTaxable: floorRupiah(row['Natura'] ?? row['Natura Taxable']),
            premiAsuransiSwastaPerusahaan: floorRupiah(
              row['Premi Asuransi Swasta Perusahaan']
            ),
            iuranPensiunPerusahaan: floorRupiah(row['Iuran Pensiun Perusahaan']),
            iuranPensiunKaryawan: floorRupiah(row['Iuran Pensiun Karyawan']),
            dplkPerusahaan: floorRupiah(row['DPLK Perusahaan']),
            dplkKaryawan: floorRupiah(row['DPLK Karyawan']),
            zakat: 0,
            dasarUpahBpjs: undefined,
            overrideBpjsPerusahaan: undefined,
            overrideBpjsKaryawan: undefined,
            originalTunjangan: totalTunjanganTetap,
            isOverridden: false,
            konfigurasiTarif: state.configBpjs,
          };
        }

        const empTemplate: EmployeeData = {
          karyawan,
          monthlyInputs,
          monthlyHasils: {} as Record<number, HasilKalkulasiTetap>,
        };

        empTemplate.monthlyHasils = calculateFullYear(empTemplate, state.configBpjs);
        newEmployees[nik] = empTemplate;
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      return { employees: newEmployees };
    }),

  updateVariable: (nik, bulan, updates) =>
    set((state) => {
      const emp = state.employees[nik];
      if (!emp) return state;

      const currentInput = emp.monthlyInputs[bulan];
      if (!currentInput) return state;

      const hasBonusOrThrUpdate =
        updates.bonus !== undefined || updates.thr !== undefined;
      const newThrAtauBonus = hasBonusOrThrUpdate
        ? floorRupiah(updates.bonus) + floorRupiah(updates.thr)
        : currentInput.thrAtauBonus;
      const nextNominalOverrides =
        updates.dasarUpahBpjs === undefined
          ? currentInput.nominalOverrides
          : updateNominalOverrides(
              currentInput.nominalOverrides,
              'dasarUpahBpjs',
              updates.dasarUpahBpjs
            );

      const newInput: InputGajiBulanan = {
        ...currentInput,
        gajiPokok:
          updates.gajiPokok !== undefined
            ? floorRupiah(updates.gajiPokok)
            : currentInput.gajiPokok,
        tunjanganTetap:
          updates.tunjanganTetap !== undefined
            ? floorRupiah(updates.tunjanganTetap)
            : currentInput.tunjanganTetap,
        tunjanganVariabel:
          updates.lembur !== undefined
            ? floorRupiah(updates.lembur)
            : currentInput.tunjanganVariabel,
        thrAtauBonus: newThrAtauBonus,
        naturaTaxable:
          updates.naturaTaxable !== undefined
            ? floorRupiah(updates.naturaTaxable)
            : currentInput.naturaTaxable,
        premiAsuransiSwastaPerusahaan:
          updates.premiAsuransiSwastaPerusahaan !== undefined
            ? floorRupiah(updates.premiAsuransiSwastaPerusahaan)
            : currentInput.premiAsuransiSwastaPerusahaan,
        dplkKaryawan:
          updates.dplk !== undefined
            ? floorRupiah(updates.dplk)
            : currentInput.dplkKaryawan,
        zakat:
          updates.zakat !== undefined
            ? floorRupiah(updates.zakat)
            : currentInput.zakat,
        dasarUpahBpjs: undefined,
        overrideBpjsPerusahaan: mergeOverridePerusahaan(
          currentInput.overrideBpjsPerusahaan,
          updates.overrideBpjsPerusahaan
        ),
        overrideBpjsKaryawan: mergeOverrideKaryawan(
          currentInput.overrideBpjsKaryawan,
          updates.overrideBpjsKaryawan
        ),
        isOverridden:
          currentInput.isOverridden ||
          updates.gajiPokok !== undefined ||
          updates.tunjanganTetap !== undefined ||
          updates.lembur !== undefined ||
          updates.bonus !== undefined ||
          updates.thr !== undefined ||
          updates.dplk !== undefined ||
          updates.zakat !== undefined ||
          updates.naturaTaxable !== undefined ||
          updates.premiAsuransiSwastaPerusahaan !== undefined ||
          updates.dasarUpahBpjs !== undefined ||
          updates.overrideBpjsPerusahaan !== undefined ||
          updates.overrideBpjsKaryawan !== undefined,
        originalTunjangan: currentInput.originalTunjangan,
        nominalOverrides: nextNominalOverrides,
      };

      const updatedInputs: Record<number, InputGajiBulanan> = {
        ...emp.monthlyInputs,
        [bulan]: newInput,
      };
      const updatedEmp: EmployeeData = {
        ...emp,
        monthlyInputs: updatedInputs,
      };

      return {
        employees: {
          ...state.employees,
          [nik]: {
            ...updatedEmp,
            monthlyHasils: calculateFullYear(updatedEmp, state.configBpjs),
          },
        },
      };
    }),

  setNominalOverride: (nik, bulan, key, value) =>
    set((state) => {
      const emp = state.employees[nik];
      if (!emp) return state;

      const currentInput = emp.monthlyInputs[bulan];
      if (!currentInput) return state;

      const normalizedValue = normalizeNominalOverrideValue(value);
      const nextNominalOverrides = updateNominalOverrides(
        currentInput.nominalOverrides,
        key,
        normalizedValue ?? null
      );
      const nextLegacyBpjs = clearLegacyBpjsOverride(currentInput, key);

      const newInput: InputGajiBulanan = {
        ...currentInput,
        nominalOverrides: nextNominalOverrides,
        overrideBpjsPerusahaan: nextLegacyBpjs.overrideBpjsPerusahaan,
        overrideBpjsKaryawan: nextLegacyBpjs.overrideBpjsKaryawan,
        isOverridden: true,
      };

      const updatedEmp: EmployeeData = {
        ...emp,
        monthlyInputs: {
          ...emp.monthlyInputs,
          [bulan]: newInput,
        },
      };

      return {
        employees: {
          ...state.employees,
          [nik]: {
            ...updatedEmp,
            monthlyHasils: calculateFullYear(updatedEmp, state.configBpjs),
          },
        },
      };
    }),

  setSubjekPajakSejakAwalTahun: (nik, value) =>
    set((state) => {
      const emp = state.employees[nik];
      if (!emp) return state;

      const updatedEmp: EmployeeData = {
        ...emp,
        karyawan: {
          ...emp.karyawan,
          subjekPajakSejakAwalTahun: value,
        },
      };

      return {
        employees: {
          ...state.employees,
          [nik]: {
            ...updatedEmp,
            monthlyHasils: calculateFullYear(updatedEmp, state.configBpjs),
          },
        },
      };
    }),
}));
