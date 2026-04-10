import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import {
  DataKaryawan,
  DataPerusahaan,
  FasilitasPajak,
  HasilKalkulasiTetap,
} from '../types/payroll';

const VALID_TAX_CERTIFICATES: readonly FasilitasPajak[] = [
  'N/A',
  'SKB',
  'DTP',
  'SKD',
  'ETC',
] as const;

export interface DataExportBulanIni {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
  position?: string;
  counterpartPassport?: string | null;
}

export interface BpmpGlobalSettings {
  taxPeriodMonth: number;
  taxPeriodYear: number;
  withholdingDate?: string | Date;
  strict?: boolean;
}

export interface GenerateMmPayrollOptions {
  withholdingDate?: string | Date;
  strict?: boolean;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeDigits(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\D/g, '');
}

function validateFixedDigits(
  value: unknown,
  length: number,
  label: string
): string {
  const digits = sanitizeDigits(value);
  if (digits.length !== length) {
    throw new Error(`${label} harus tepat ${length} digit angka.`);
  }
  return digits;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function resolveWithholdingDate(withholdingDate?: string | Date): string {
  if (typeof withholdingDate === 'string' && withholdingDate.trim() !== '') {
    const normalized = withholdingDate.trim();
    if (!isValidIsoDate(normalized)) {
      throw new Error(
        'WithholdingDate harus berformat YYYY-MM-DD dan merupakan tanggal yang valid.'
      );
    }
    return normalized;
  }

  if (withholdingDate instanceof Date && !Number.isNaN(withholdingDate.getTime())) {
    return formatLocalDate(withholdingDate);
  }

  return formatLocalDate(new Date());
}

function trimTrailingZeros(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const normalized = value.toFixed(6).replace(/\.?0+$/, '');
  return normalized === '' ? '0' : normalized;
}

function resolveCounterpartOpt(
  karyawan: DataKaryawan
): 'Resident' | 'Non-Resident' {
  return karyawan.residentStatus === 'NON_RESIDENT'
    ? 'Non-Resident'
    : 'Resident';
}

function resolveCounterpartTin(karyawan: DataKaryawan): string {
  const raw = karyawan.counterpartTin?.trim() || karyawan.nik?.trim() || '';
  return validateFixedDigits(raw, 16, `CounterpartTin ${karyawan.namaLengkap}`);
}

function resolveCounterpartPassport(record: DataExportBulanIni): string | null {
  const raw = record.counterpartPassport ?? record.karyawan.noPaspor;
  const normalized = String(raw ?? '').trim();
  return normalized === '' ? null : normalized;
}

function resolvePosition(record: DataExportBulanIni): string {
  return record.position?.trim() || record.karyawan.jabatan?.trim() || 'Pegawai';
}

function resolveTaxCertificate(karyawan: DataKaryawan): FasilitasPajak {
  const raw = String(karyawan.fasilitasPajak ?? 'N/A').trim().toUpperCase();
  if ((VALID_TAX_CERTIFICATES as readonly string[]).includes(raw)) {
    return raw as FasilitasPajak;
  }
  return 'N/A';
}

function resolveTaxObjectCode(karyawan: DataKaryawan): string {
  if (karyawan.residentStatus === 'NON_RESIDENT') {
    return '26-100-99';
  }

  if (karyawan.tipeKaryawan === 'NON_PEGAWAI') {
    return '21-100-07';
  }

  return '21-100-01';
}

function resolveStatusTaxExemption(karyawan: DataKaryawan): string | null {
  const normalized = karyawan.statusPtkp?.trim();
  if (!normalized || normalized === '-') {
    return null;
  }
  return normalized;
}

function resolveGross(hasilKalkulasi: HasilKalkulasiTetap): string {
  return String(Math.max(0, Math.floor(hasilKalkulasi.totalBruto)));
}

function resolveRatePercent(hasilKalkulasi: HasilKalkulasiTetap): string {
  if (typeof hasilKalkulasi.rateTER === 'number') {
    return trimTrailingZeros(hasilKalkulasi.rateTER * 100);
  }

  if (hasilKalkulasi.totalBruto > 0 && hasilKalkulasi.pajakTerutang > 0) {
    return trimTrailingZeros(
      (hasilKalkulasi.pajakTerutang / hasilKalkulasi.totalBruto) * 100
    );
  }

  return '0';
}

function validateHeader(
  perusahaan: DataPerusahaan,
  settings: BpmpGlobalSettings
): {
  tin: string;
  idPlaceOfBusinessActivity: string;
  withholdingDate: string;
} {
  const tin = validateFixedDigits(perusahaan.npwpPemotong, 16, 'TIN perusahaan');
  const idPlaceOfBusinessActivity = validateFixedDigits(
    perusahaan.idTku,
    22,
    'IDPlaceOfBusinessActivity'
  );

  if (
    !Number.isInteger(settings.taxPeriodMonth) ||
    settings.taxPeriodMonth < 1 ||
    settings.taxPeriodMonth > 12
  ) {
    throw new Error(`TaxPeriodMonth tidak valid: ${settings.taxPeriodMonth}`);
  }

  if (
    !Number.isInteger(settings.taxPeriodYear) ||
    settings.taxPeriodYear < 2000 ||
    settings.taxPeriodYear > 9999
  ) {
    throw new Error(`TaxPeriodYear tidak valid: ${settings.taxPeriodYear}`);
  }

  const withholdingDate = resolveWithholdingDate(settings.withholdingDate);

  return {
    tin,
    idPlaceOfBusinessActivity,
    withholdingDate,
  };
}

function validateRecord(record: DataExportBulanIni): string[] {
  const issues: string[] = [];

  try {
    resolveCounterpartTin(record.karyawan);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'CounterpartTin tidak valid');
  }

  const taxCertificate = resolveTaxCertificate(record.karyawan);
  if (!(VALID_TAX_CERTIFICATES as readonly string[]).includes(taxCertificate)) {
    issues.push(
      `pegawai ${record.karyawan.namaLengkap} memiliki fasilitasPajak tidak valid`
    );
  }

  if (record.hasilKalkulasi.totalBruto < 0) {
    issues.push(`pegawai ${record.karyawan.namaLengkap} memiliki Gross negatif`);
  }

  return issues;
}

function appendCounterpartPassport(
  mmPayroll: XMLBuilder,
  passport: string | null
): void {
  if (passport) {
    mmPayroll.ele('CounterpartPassport').txt(passport).up();
    return;
  }

  mmPayroll.ele('CounterpartPassport', { 'xsi:nil': 'true' }).up();
}

function appendStatusTaxExemption(
  mmPayroll: XMLBuilder,
  statusTaxExemption: string | null
): void {
  if (statusTaxExemption) {
    mmPayroll.ele('StatusTaxExemption').txt(statusTaxExemption).up();
    return;
  }

  mmPayroll.ele('StatusTaxExemption', { 'xsi:nil': 'true' }).up();
}

export function generateBpmpXml(
  perusahaan: DataPerusahaan,
  dataKaryawan: DataExportBulanIni[],
  settings: BpmpGlobalSettings
): string {
  const strict = settings.strict ?? true;
  const header = validateHeader(perusahaan, settings);

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
    'MmPayrollBulk',
    {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    }
  );

  root.ele('TIN').txt(header.tin).up();

  const listOfMmPayroll = root.ele('ListOfMmPayroll');

  dataKaryawan.forEach((record) => {
    const issues = validateRecord(record);
    if (issues.length > 0) {
      const message = issues.join('; ');
      if (strict) {
        throw new Error(`Data export BPMP tidak valid: ${message}`);
      }
      console.warn(`[Peringatan Export XML] ${message}`);
      return;
    }

    const { karyawan, hasilKalkulasi } = record;
    const counterpartPassport = resolveCounterpartPassport(record);
    const counterpartTin = resolveCounterpartTin(karyawan);
    const statusTaxExemption = resolveStatusTaxExemption(karyawan);
    const position = resolvePosition(record);
    const taxCertificate = resolveTaxCertificate(karyawan);
    const taxObjectCode = resolveTaxObjectCode(karyawan);
    const gross = resolveGross(hasilKalkulasi);
    const rate = resolveRatePercent(hasilKalkulasi);
    const mmPayroll = listOfMmPayroll.ele('MmPayroll');

    mmPayroll.ele('TaxPeriodMonth').txt(String(settings.taxPeriodMonth)).up();
    mmPayroll.ele('TaxPeriodYear').txt(String(settings.taxPeriodYear)).up();
    mmPayroll.ele('CounterpartOpt').txt(resolveCounterpartOpt(karyawan)).up();
    appendCounterpartPassport(mmPayroll, counterpartPassport);
    mmPayroll.ele('CounterpartTin').txt(counterpartTin).up();
    appendStatusTaxExemption(mmPayroll, statusTaxExemption);
    mmPayroll.ele('Position').txt(position).up();
    mmPayroll.ele('TaxCertificate').txt(taxCertificate).up();
    mmPayroll.ele('TaxObjectCode').txt(taxObjectCode).up();
    mmPayroll.ele('Gross').txt(gross).up();
    mmPayroll.ele('Rate').txt(rate).up();
    mmPayroll
      .ele('IDPlaceOfBusinessActivity')
      .txt(header.idPlaceOfBusinessActivity)
      .up();
    mmPayroll.ele('WithholdingDate').txt(header.withholdingDate).up();
    mmPayroll.up();
  });

  return root.end({ prettyPrint: true });
}

export function generateCoretaxXML(
  perusahaan: DataPerusahaan,
  masaPajakBulan: number,
  masaPajakTahun: number,
  dataKaryawan: DataExportBulanIni[],
  options: GenerateMmPayrollOptions = {}
): string {
  return generateBpmpXml(perusahaan, dataKaryawan, {
    taxPeriodMonth: masaPajakBulan,
    taxPeriodYear: masaPajakTahun,
    withholdingDate: options.withholdingDate,
    strict: options.strict,
  });
}

export function downloadBpmpXml(
  xml: string,
  filename = 'BPMP_Coretax.xml'
): void {
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const generateMmPayrollBulkXML = generateCoretaxXML;
