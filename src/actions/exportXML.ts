import { create } from 'xmlbuilder2';
import type { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import {
  Bp26TaxCertificate,
  Bpa1StatusOfWithholding,
  DataKaryawan,
  DataPerusahaan,
  FasilitasPajak,
  HasilKalkulasiTetap,
  InputGajiBulanan,
} from '../types/payroll';

const VALID_TAX_CERTIFICATES: readonly FasilitasPajak[] = [
  'N/A',
  'SKB',
  'DTP',
  'SKD',
  'ETC',
  'TaxExAr21',
] as const;

export interface DataExportBulanIni {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
  position?: string;
  counterpartPassport?: string | null;
}

export interface DataExportBp21 {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
}

export interface DataExportBp26 {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
}

export interface DataExportBpa1 {
  karyawan: DataKaryawan;
  monthlyInputs?: Record<number, InputGajiBulanan>;
  monthlyHasils?: Record<number, HasilKalkulasiTetap>;
  input?: InputGajiBulanan;
  hasilKalkulasi?: HasilKalkulasiTetap;
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

function normalizeTaxCertificate(value: unknown): FasilitasPajak {
  const raw = String(value ?? 'N/A').trim();
  const upper = raw.toUpperCase();

  if (upper === 'TAXEXAR21') return 'TaxExAr21';
  if (upper === 'N/A') return 'N/A';
  if (upper === 'SKB') return 'SKB';
  if (upper === 'DTP') return 'DTP';
  if (upper === 'SKD') return 'SKD';
  if (upper === 'ETC') return 'ETC';

  return 'N/A';
}

function normalizeBp26TaxCertificate(value: unknown): Bp26TaxCertificate {
  const raw = String(value ?? 'N/A').trim().toUpperCase();
  if (raw === 'DTP') return 'DTP';
  if (raw === 'COD') return 'COD';
  if (raw === 'ETC') return 'ETC';
  return 'N/A';
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
  return normalizeTaxCertificate(karyawan.fasilitasPajak);
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

function resolveBpa1TaxObjectCode(karyawan: DataKaryawan): string {
  return karyawan.bpa1?.taxObjectCode?.trim() || '21-100-01';
}

function floorRupiah(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function sumNumbers(values: number[]): number {
  return values.reduce((sum, value) => sum + floorRupiah(value), 0);
}

function requireText(value: unknown, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${label} wajib diisi.`);
  }
  return normalized;
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

function validateBp21Record(record: DataExportBp21): string[] {
  const issues: string[] = [];
  const { karyawan } = record;
  const metadata = karyawan.bp21;

  try {
    resolveCounterpartTin(karyawan);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'CounterpartTin tidak valid');
  }

  if (!metadata) {
    issues.push(`metadata BP21 ${karyawan.namaLengkap} belum tersedia`);
    return issues;
  }

  try {
    validateFixedDigits(metadata.idTkuPenerima, 22, `ID TKU penerima ${karyawan.namaLengkap}`);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'ID TKU penerima tidak valid');
  }

  if (!metadata.taxObjectCode?.trim()) {
    issues.push(`TaxObjectCode ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.documentType?.trim()) {
    issues.push(`Document ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.documentNumber?.trim()) {
    issues.push(`DocumentNumber ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!isValidIsoDate(metadata.documentDate)) {
    issues.push(`DocumentDate ${karyawan.namaLengkap} harus berformat YYYY-MM-DD`);
  }

  if (metadata.withholdingDate && !isValidIsoDate(metadata.withholdingDate)) {
    issues.push(`WithholdingDate ${karyawan.namaLengkap} harus berformat YYYY-MM-DD`);
  }

  if (record.hasilKalkulasi.totalBruto < 0) {
    issues.push(`BP21 ${karyawan.namaLengkap} memiliki Gross negatif`);
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

function appendNilOrText(parent: XMLBuilder, tagName: string, value?: string | null): void {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    parent.ele(tagName, { 'xsi:nil': 'true' }).up();
    return;
  }

  parent.ele(tagName).txt(normalized).up();
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

function resolveBp21RatePercent(
  record: DataExportBp21,
  taxCertificate: FasilitasPajak
): string {
  if (taxCertificate === 'TaxExAr21') {
    return '0';
  }

  const gross = record.hasilKalkulasi.totalBruto;
  const tax = record.hasilKalkulasi.pajakTerutang;
  if (gross <= 0 || tax <= 0) return '0';

  return trimTrailingZeros((tax / gross) * 100);
}

export function generateBp21Xml(
  perusahaan: DataPerusahaan,
  dataBp21: DataExportBp21[],
  settings: BpmpGlobalSettings
): string {
  const strict = settings.strict ?? true;
  const header = validateHeader(perusahaan, settings);

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
    'Bp21Bulk',
    {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    }
  );

  root.ele('TIN').txt(header.tin).up();

  const listOfBp21 = root.ele('ListOfBp21');

  dataBp21.forEach((record) => {
    const issues = validateBp21Record(record);
    if (issues.length > 0) {
      const message = issues.join('; ');
      if (strict) {
        throw new Error(`Data export BP21 tidak valid: ${message}`);
      }
      console.warn(`[Peringatan Export XML BP21] ${message}`);
      return;
    }

    const { karyawan, hasilKalkulasi } = record;
    const metadata = karyawan.bp21;
    if (!metadata) return;

    const counterpartTin = resolveCounterpartTin(karyawan);
    const taxCertificate = normalizeTaxCertificate(
      metadata.taxCertificate ?? karyawan.fasilitasPajak
    );
    const statusTaxExemption = resolveStatusTaxExemption(karyawan) ?? 'TK/0';
    const withholdingDate = metadata.withholdingDate || header.withholdingDate;
    const bp21 = listOfBp21.ele('Bp21');

    bp21.ele('TaxPeriodMonth').txt(String(settings.taxPeriodMonth)).up();
    bp21.ele('TaxPeriodYear').txt(String(settings.taxPeriodYear)).up();
    bp21.ele('CounterpartTin').txt(counterpartTin).up();
    bp21
      .ele('IDPlaceOfBusinessActivityOfIncomeRecipient')
      .txt(validateFixedDigits(metadata.idTkuPenerima, 22, 'ID TKU penerima'))
      .up();
    bp21.ele('StatusTaxExemption').txt(statusTaxExemption).up();
    bp21.ele('TaxCertificate').txt(taxCertificate).up();
    bp21.ele('TaxObjectCode').txt(requireText(metadata.taxObjectCode, 'TaxObjectCode')).up();
    bp21.ele('Gross').txt(resolveGross(hasilKalkulasi)).up();
    bp21.ele('Deemed').txt(trimTrailingZeros(metadata.deemedPersentase)).up();
    bp21.ele('Rate').txt(resolveBp21RatePercent(record, taxCertificate)).up();
    bp21.ele('Document').txt(requireText(metadata.documentType, 'Document')).up();
    bp21.ele('DocumentNumber').txt(requireText(metadata.documentNumber, 'DocumentNumber')).up();
    bp21.ele('DocumentDate').txt(metadata.documentDate).up();
    bp21
      .ele('IDPlaceOfBusinessActivity')
      .txt(header.idPlaceOfBusinessActivity)
      .up();
    bp21.ele('WithholdingDate').txt(withholdingDate).up();
    bp21.up();
  });

  return root.end({ prettyPrint: true });
}

function validateBp26Record(record: DataExportBp26): string[] {
  const issues: string[] = [];
  const { karyawan, hasilKalkulasi } = record;
  const metadata = karyawan.bp26;

  if (karyawan.tipeKaryawan !== 'TETAP') {
    issues.push(`BP26 ${karyawan.namaLengkap} hanya untuk pegawai tetap`);
  }

  if (karyawan.residentStatus !== 'NON_RESIDENT') {
    issues.push(`BP26 ${karyawan.namaLengkap} hanya untuk Non-Resident`);
  }

  if (!metadata) {
    issues.push(`metadata BP26 ${karyawan.namaLengkap} belum tersedia`);
    return issues;
  }

  if (!metadata.counterpartTin?.trim()) {
    issues.push(`BP26 CounterpartTin ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.country?.trim()) {
    issues.push(`BP26 Country ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.address?.trim()) {
    issues.push(`BP26 Address ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.dateOfBirth || !isValidIsoDate(metadata.dateOfBirth)) {
    issues.push(`BP26 Date Of Birth ${karyawan.namaLengkap} harus berformat YYYY-MM-DD`);
  }

  if (!metadata.birthCity?.trim()) {
    issues.push(`BP26 Birth City ${karyawan.namaLengkap} wajib diisi`);
  }

  if (!metadata.documentType?.trim()) {
    issues.push(`Document ${karyawan.namaLengkap} wajib diisi untuk BP26`);
  }

  if (!metadata.documentNumber?.trim()) {
    issues.push(`DocumentNumber ${karyawan.namaLengkap} wajib diisi untuk BP26`);
  }

  if (!metadata.documentDate || !isValidIsoDate(metadata.documentDate)) {
    issues.push(`DocumentDate ${karyawan.namaLengkap} harus berformat YYYY-MM-DD untuk BP26`);
  }

  if (metadata.withholdingDate && !isValidIsoDate(metadata.withholdingDate)) {
    issues.push(`WithholdingDate ${karyawan.namaLengkap} harus berformat YYYY-MM-DD`);
  }

  const taxCertificate = normalizeBp26TaxCertificate(metadata.taxCertificate);
  if (taxCertificate === 'COD') {
    if (!metadata.hasExplicitReceiptNumber || metadata.counterpartReceiptNumber === '-') {
      issues.push(`BP26 CounterpartReceiptNumber ${karyawan.namaLengkap} wajib diisi untuk COD`);
    }
    if (!metadata.hasExplicitDeemed) {
      issues.push(`BP26 Deemed ${karyawan.namaLengkap} wajib diisi untuk COD`);
    }
    if (!metadata.hasExplicitRate) {
      issues.push(`BP26 Rate ${karyawan.namaLengkap} wajib diisi untuk COD`);
    }
  }

  if (hasilKalkulasi.totalBruto < 0) {
    issues.push(`BP26 ${karyawan.namaLengkap} memiliki Gross negatif`);
  }

  return issues;
}

function resolveBp26Number(value: number | undefined, fallback: number): string {
  return trimTrailingZeros(
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  );
}

export function generateBp26Xml(
  perusahaan: DataPerusahaan,
  dataBp26: DataExportBp26[],
  settings: BpmpGlobalSettings
): string {
  const strict = settings.strict ?? true;
  const header = validateHeader(perusahaan, settings);

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
    'BP26Bulk',
    {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    }
  );

  root.ele('TIN').txt(header.tin).up();

  const listOfBp26 = root.ele('ListOfBP26');

  dataBp26.forEach((record) => {
    const issues = validateBp26Record(record);
    if (issues.length > 0) {
      const message = issues.join('; ');
      if (strict) {
        throw new Error(`Data export BP26 tidak valid: ${message}`);
      }
      console.warn(`[Peringatan Export XML BP26] ${message}`);
      return;
    }

    const { karyawan, hasilKalkulasi } = record;
    const metadata = karyawan.bp26;
    if (!metadata) return;

    const withholdingDate = metadata.withholdingDate || header.withholdingDate;
    const bp26 = listOfBp26.ele('BP26');

    bp26.ele('TaxPeriodMonth').txt(String(settings.taxPeriodMonth)).up();
    bp26.ele('TaxPeriodYear').txt(String(settings.taxPeriodYear)).up();
    bp26.ele('CounterpartTin').txt(requireText(metadata.counterpartTin, 'BP26 CounterpartTin')).up();
    bp26.ele('CounterpartReceiptNumber').txt(metadata.counterpartReceiptNumber || '-').up();
    bp26.ele('CounterpartName').txt(requireText(karyawan.namaLengkap, 'CounterpartName')).up();
    bp26.ele('CounterpartCountry').txt(requireText(metadata.country, 'BP26 Country')).up();
    bp26.ele('CounterpartAddress').txt(requireText(metadata.address, 'BP26 Address')).up();
    bp26.ele('CounterpartDob').txt(metadata.dateOfBirth).up();
    bp26.ele('CounterpartBirthCity').txt(requireText(metadata.birthCity, 'BP26 Birth City')).up();
    appendNilOrText(bp26, 'CounterpartPassport', karyawan.noPaspor);
    appendNilOrText(bp26, 'CounterpartKitas', metadata.kitas);
    bp26.ele('TaxCertificate').txt(normalizeBp26TaxCertificate(metadata.taxCertificate)).up();
    bp26.ele('TaxObjectCode').txt(metadata.taxObjectCode?.trim() || '27-100-99').up();
    bp26.ele('Gross').txt(resolveGross(hasilKalkulasi)).up();
    bp26.ele('Deemed').txt(resolveBp26Number(metadata.deemed, 100)).up();
    bp26.ele('Rate').txt(resolveBp26Number(metadata.rate, 20)).up();
    bp26.ele('Document').txt(requireText(metadata.documentType, 'Document')).up();
    bp26.ele('DocumentNumber').txt(requireText(metadata.documentNumber, 'DocumentNumber')).up();
    bp26.ele('DocumentDate').txt(metadata.documentDate).up();
    bp26.ele('IDPlaceOfBusinessActivity').txt(header.idPlaceOfBusinessActivity).up();
    bp26.ele('WithholdingDate').txt(withholdingDate).up();
    bp26.up();
  });

  return root.end({ prettyPrint: true });
}

function getBpa1MonthRange(karyawan: DataKaryawan): {
  start: number;
  end: number;
  count: number;
} {
  const start = Math.min(Math.max(floorRupiah(karyawan.bulanMulai) || 1, 1), 12);
  const endRaw = Math.min(Math.max(floorRupiah(karyawan.bulanSelesai) || 12, 1), 12);
  const end = Math.max(start, endRaw);

  return {
    start,
    end,
    count: end - start + 1,
  };
}

function resolveBpa1StatusOfWithholding(karyawan: DataKaryawan): Bpa1StatusOfWithholding {
  if (karyawan.bpa1?.statusOfWithholding) {
    return karyawan.bpa1.statusOfWithholding;
  }

  const range = getBpa1MonthRange(karyawan);
  if (range.start === 1 && range.end === 12) return 'FullYear';
  if (!karyawan.subjekPajakSejakAwalTahun) return 'Annualized';
  return 'PartialYear';
}

function resolveBpa1NumberOfMonths(
  karyawan: DataKaryawan,
  statusOfWithholding: Bpa1StatusOfWithholding
): number {
  if (typeof karyawan.bpa1?.numberOfMonths === 'number') {
    return floorRupiah(karyawan.bpa1.numberOfMonths);
  }

  if (statusOfWithholding === 'Annualized') {
    return getBpa1MonthRange(karyawan).count;
  }

  return 0;
}

function getBpa1Inputs(record: DataExportBpa1): InputGajiBulanan[] {
  const range = getBpa1MonthRange(record.karyawan);
  if (record.monthlyInputs) {
    return Object.values(record.monthlyInputs)
      .filter((input) => input.bulan >= range.start && input.bulan <= range.end)
      .sort((a, b) => a.bulan - b.bulan);
  }

  return record.input ? [record.input] : [];
}

function getBpa1Hasils(record: DataExportBpa1): HasilKalkulasiTetap[] {
  const range = getBpa1MonthRange(record.karyawan);
  if (record.monthlyHasils) {
    return Object.entries(record.monthlyHasils)
      .map(([month, hasil]) => ({ month: Number(month), hasil }))
      .filter((item) => item.month >= range.start && item.month <= range.end)
      .sort((a, b) => a.month - b.month)
      .map((item) => item.hasil);
  }

  return record.hasilKalkulasi ? [record.hasilKalkulasi] : [];
}

function resolveBpa1Override(
  value: number | undefined,
  fallback: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? floorRupiah(value)
    : floorRupiah(fallback);
}

function resolveBpa1Article21IncomeTax(
  record: DataExportBpa1,
  hasils: HasilKalkulasiTetap[]
): number {
  const override = record.karyawan.bpa1?.article21IncomeTax;
  if (typeof override === 'number' && Number.isFinite(override)) {
    return floorRupiah(override);
  }

  if (record.monthlyHasils) {
    const range = getBpa1MonthRange(record.karyawan);
    return Object.entries(record.monthlyHasils)
      .map(([month, hasil]) => ({ month: Number(month), hasil }))
      .filter((item) => item.month >= range.start && item.month < range.end)
      .reduce((sum, item) => sum + floorRupiah(item.hasil.pajakTerutang), 0);
  }

  return sumNumbers(hasils.map((hasil) => hasil.pajakTerutang));
}

function aggregateBpa1Record(record: DataExportBpa1): {
  salaryPensionJhtTht: number;
  incomeTaxBenefit: number;
  otherBenefit: number;
  honorarium: number;
  insurancePaidByEmployer: number;
  natura: number;
  tantiemBonusThr: number;
  pensionContributionJhtThtFee: number;
  zakat: number;
  article21IncomeTax: number;
} {
  const inputs = getBpa1Inputs(record);
  const hasils = getBpa1Hasils(record);
  const metadata = record.karyawan.bpa1;

  const derivedHonorarium = 0;
  const honorarium = resolveBpa1Override(metadata?.honorarium, derivedHonorarium);
  const salaryPensionJhtTht = sumNumbers(inputs.map((input) => input.gajiPokok));
  const rawOtherBenefit = sumNumbers(
    inputs.map((input) => input.tunjanganTetap + input.tunjanganVariabel)
  );
  const incomeTaxBenefit = resolveBpa1Override(
    metadata?.incomeTaxBenefit,
    sumNumbers(hasils.map((hasil) => hasil.tunjanganPajakGrossUp))
  );
  const otherBenefit = resolveBpa1Override(
    metadata?.otherBenefit,
    Math.max(0, rawOtherBenefit - honorarium)
  );
  const insurancePaidByEmployer = resolveBpa1Override(
    metadata?.insurancePaidByEmployer,
    sumNumbers(
      hasils.map(
        (hasil) =>
          hasil.premiJkkPerusahaan +
          hasil.premiJkmPerusahaan +
          hasil.premiBpjsKesPerusahaan +
          hasil.premiAsuransiSwastaPerusahaan
      )
    )
  );
  const natura = resolveBpa1Override(
    metadata?.natura,
    sumNumbers(inputs.map((input) => input.naturaTaxable))
  );
  const tantiemBonusThr = resolveBpa1Override(
    metadata?.tantiemBonusThr,
    sumNumbers(inputs.map((input) => input.thrAtauBonus))
  );
  const pensionContributionJhtThtFee = resolveBpa1Override(
    metadata?.pensionContributionJhtThtFee,
    sumNumbers(
      hasils.map(
        (hasil) =>
          hasil.iuranJhtKaryawan +
          hasil.iuranJpKaryawan +
          hasil.iuranPensiunKaryawan +
          hasil.potonganDplkKaryawan
      )
    )
  );
  const zakat = resolveBpa1Override(
    metadata?.zakat,
    sumNumbers(inputs.map((input) => input.zakat))
  );

  return {
    salaryPensionJhtTht,
    incomeTaxBenefit,
    otherBenefit,
    honorarium,
    insurancePaidByEmployer,
    natura,
    tantiemBonusThr,
    pensionContributionJhtThtFee,
    zakat,
    article21IncomeTax: resolveBpa1Article21IncomeTax(record, hasils),
  };
}

function validateBpa1Record(record: DataExportBpa1): string[] {
  const issues: string[] = [];
  const { karyawan } = record;
  const range = getBpa1MonthRange(karyawan);

  if (karyawan.tipeKaryawan !== 'TETAP') {
    issues.push(`BPA1 ${karyawan.namaLengkap} hanya untuk pegawai tetap`);
  }

  try {
    resolveCounterpartTin(karyawan);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'CounterpartTin tidak valid');
  }

  if (karyawan.residentStatus === 'NON_RESIDENT' && !karyawan.noPaspor?.trim()) {
    issues.push(`No Paspor ${karyawan.namaLengkap} wajib diisi untuk Non-Resident`);
  }

  if (!resolveStatusTaxExemption(karyawan)) {
    issues.push(`PTKP ${karyawan.namaLengkap} wajib diisi untuk BPA1`);
  }

  if (!resolvePosition({ karyawan, hasilKalkulasi: getBpa1Hasils(record)[0] ?? ({} as HasilKalkulasiTetap) }).trim()) {
    issues.push(`Jabatan ${karyawan.namaLengkap} wajib diisi untuk BPA1`);
  }

  if (range.start < 1 || range.end > 12 || range.end < range.start) {
    issues.push(`Periode kerja ${karyawan.namaLengkap} tidak valid`);
  }

  const withholdingDate = karyawan.bpa1?.withholdingDate;
  if (withholdingDate && !isValidIsoDate(withholdingDate)) {
    issues.push(`BPA1 WithholdingDate ${karyawan.namaLengkap} harus berformat YYYY-MM-DD`);
  }

  return issues;
}

export function generateBpa1Xml(
  perusahaan: DataPerusahaan,
  dataBpa1: DataExportBpa1[],
  settings: BpmpGlobalSettings
): string {
  const strict = settings.strict ?? true;
  const header = validateHeader(perusahaan, settings);

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele(
    'A1Bulk',
    {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    }
  );

  root.ele('TIN').txt(header.tin).up();

  const listOfA1 = root.ele('ListOfA1');

  dataBpa1.forEach((record) => {
    const issues = validateBpa1Record(record);
    if (issues.length > 0) {
      const message = issues.join('; ');
      if (strict) {
        throw new Error(`Data export BPA1 tidak valid: ${message}`);
      }
      console.warn(`[Peringatan Export XML BPA1] ${message}`);
      return;
    }

    const { karyawan } = record;
    const range = getBpa1MonthRange(karyawan);
    const aggregate = aggregateBpa1Record(record);
    const statusOfWithholding = resolveBpa1StatusOfWithholding(karyawan);
    const taxCertificate = normalizeTaxCertificate(
      karyawan.bpa1?.taxCertificate ?? karyawan.fasilitasPajak
    );
    const withholdingDate = karyawan.bpa1?.withholdingDate || header.withholdingDate;
    const a1 = listOfA1.ele('A1');

    a1.ele('WorkForSecondEmployer').txt(karyawan.bpa1?.workForSecondEmployer ?? 'No').up();
    a1.ele('TaxPeriodMonthStart').txt(String(range.start)).up();
    a1.ele('TaxPeriodMonthEnd').txt(String(range.end)).up();
    a1.ele('TaxPeriodYear').txt(String(settings.taxPeriodYear)).up();
    a1.ele('CounterpartOpt').txt(resolveCounterpartOpt(karyawan)).up();
    appendNilOrText(a1, 'CounterpartPassport', karyawan.noPaspor);
    a1.ele('CounterpartTin').txt(resolveCounterpartTin(karyawan)).up();
    a1.ele('TaxExemptOpt').txt(requireText(resolveStatusTaxExemption(karyawan), 'TaxExemptOpt')).up();
    a1.ele('StatusOfWithholding').txt(statusOfWithholding).up();
    a1.ele('CounterpartPosition').txt(resolvePosition({ karyawan, hasilKalkulasi: getBpa1Hasils(record)[0] ?? ({} as HasilKalkulasiTetap) })).up();
    a1.ele('TaxObjectCode').txt(resolveBpa1TaxObjectCode(karyawan)).up();
    a1.ele('NumberOfMonths').txt(String(resolveBpa1NumberOfMonths(karyawan, statusOfWithholding))).up();
    a1.ele('SalaryPensionJhtTht').txt(String(aggregate.salaryPensionJhtTht)).up();
    a1.ele('GrossUpOpt').txt(karyawan.metodePajak === 'GROSS_UP' ? 'Yes' : 'No').up();
    a1.ele('IncomeTaxBenefit').txt(String(aggregate.incomeTaxBenefit)).up();
    a1.ele('OtherBenefit').txt(String(aggregate.otherBenefit)).up();
    a1.ele('Honorarium').txt(String(aggregate.honorarium)).up();
    a1.ele('InsurancePaidByEmployer').txt(String(aggregate.insurancePaidByEmployer)).up();
    a1.ele('Natura').txt(String(aggregate.natura)).up();
    a1.ele('TantiemBonusThr').txt(String(aggregate.tantiemBonusThr)).up();
    a1.ele('PensionContributionJhtThtFee').txt(String(aggregate.pensionContributionJhtThtFee)).up();
    a1.ele('Zakat').txt(String(aggregate.zakat)).up();
    appendNilOrText(a1, 'PrevWhTaxSlip', karyawan.bpa1?.prevWhTaxSlip);
    a1.ele('TaxCertificate').txt(taxCertificate).up();
    a1.ele('Article21IncomeTax').txt(String(aggregate.article21IncomeTax)).up();
    a1.ele('IDPlaceOfBusinessActivity').txt(header.idPlaceOfBusinessActivity).up();
    a1.ele('WithholdingDate').txt(withholdingDate).up();
    a1.up();
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

export function downloadBp21Xml(
  xml: string,
  filename = 'BP21_Coretax.xml'
): void {
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBp26Xml(
  xml: string,
  filename = 'BP26_Coretax.xml'
): void {
  const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadBpa1Xml(
  xml: string,
  filename = 'BPA1_Coretax.xml'
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
