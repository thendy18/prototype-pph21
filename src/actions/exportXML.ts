import { create } from 'xmlbuilder2';
import {
  DataKaryawan,
  DataPerusahaan,
  HasilKalkulasiTetap,
} from '../types/payroll';

export interface DataExportBulanIni {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
  taxCertificate?: string;
  taxObjectCode?: string;
  position?: string;
  counterpartPassport?: string | null;
}

export interface GenerateMmPayrollOptions {
  withholdingDate?: string | Date;
  defaultTaxCertificate?: string;
  defaultTaxObjectCode?: string;
  strict?: boolean;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveWithholdingDate(
  withholdingDate?: string | Date
): string {
  if (typeof withholdingDate === 'string' && withholdingDate.trim() !== '') {
    return withholdingDate.trim();
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

function resolveCounterpartOpt(karyawan: DataKaryawan): 'Resident' | 'NonResident' {
  return karyawan.residentStatus === 'NON_RESIDENT' ? 'NonResident' : 'Resident';
}

function resolveCounterpartTin(karyawan: DataKaryawan): string {
  return (
    karyawan.counterpartTin?.trim() ||
    karyawan.temporaryTin?.trim() ||
    karyawan.nik?.trim() ||
    ''
  );
}

function resolvePosition(record: DataExportBulanIni): string {
  return record.position?.trim() || record.karyawan.jabatan?.trim() || 'Pegawai';
}

function resolveTaxCertificate(
  record: DataExportBulanIni,
  options: GenerateMmPayrollOptions
): string {
  return record.taxCertificate?.trim() || options.defaultTaxCertificate || 'N/A';
}

function resolveTaxObjectCode(
  record: DataExportBulanIni,
  options: GenerateMmPayrollOptions
): string {
  return record.taxObjectCode?.trim() || options.defaultTaxObjectCode || '21-100-01';
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

function validateRecord(record: DataExportBulanIni): string[] {
  const issues: string[] = [];

  if (record.karyawan.tipeKaryawan !== 'TETAP') {
    issues.push(`pegawai ${record.karyawan.namaLengkap} bukan tipe TETAP`);
  }

  if (!record.karyawan.nik?.trim()) {
    issues.push(`pegawai ${record.karyawan.namaLengkap} tidak memiliki NIK`);
  }

  if (!resolveCounterpartTin(record.karyawan)) {
    issues.push(`pegawai ${record.karyawan.namaLengkap} tidak memiliki CounterpartTin`);
  }

  if (
    record.karyawan.residentStatus === 'RESIDENT' &&
    (!record.karyawan.statusPtkp || record.karyawan.statusPtkp === '-')
  ) {
    issues.push(`pegawai ${record.karyawan.namaLengkap} belum memiliki status PTKP valid`);
  }

  if (record.hasilKalkulasi.totalBruto < 0) {
    issues.push(`pegawai ${record.karyawan.namaLengkap} memiliki Gross negatif`);
  }

  return issues;
}

function validateHeader(
  perusahaan: DataPerusahaan,
  masaPajakBulan: number,
  masaPajakTahun: number
): void {
  if (!perusahaan.npwpPemotong?.trim()) {
    throw new Error('NPWP/TIN pemotong wajib diisi.');
  }

  if (!perusahaan.idTku?.trim()) {
    throw new Error('ID TKU wajib diisi.');
  }

  if (masaPajakBulan < 1 || masaPajakBulan > 12) {
    throw new Error(`Masa pajak bulan tidak valid: ${masaPajakBulan}`);
  }

  if (masaPajakTahun < 2000 || masaPajakTahun > 9999) {
    throw new Error(`Masa pajak tahun tidak valid: ${masaPajakTahun}`);
  }
}

function appendCounterpartPassport(
  mmPayroll: any,
  passport: string | null | undefined
): void {
  if (passport && passport.trim() !== '') {
    mmPayroll.ele('CounterpartPassport').txt(passport.trim()).up();
    return;
  }

  mmPayroll.ele('CounterpartPassport', { 'xsi:nil': 'true' }).up();
}

// ============================================================================
// FUNGSI UTAMA: GENERATE XML CORETAX BPMP (Format: MmPayrollBulk)
// ============================================================================
export function generateCoretaxXML(
  perusahaan: DataPerusahaan,
  masaPajakBulan: number,
  masaPajakTahun: number,
  dataPegawaiTetap: DataExportBulanIni[],
  options: GenerateMmPayrollOptions = {}
): string {
  validateHeader(perusahaan, masaPajakBulan, masaPajakTahun);

  const strict = options.strict ?? true;
  const withholdingDate = resolveWithholdingDate(options.withholdingDate);

  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('MmPayrollBulk', {
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
  });

  root.ele('TIN').txt(perusahaan.npwpPemotong.trim()).up();

  const listOfMmPayroll = root.ele('ListOfMmPayroll');

  dataPegawaiTetap.forEach((record) => {
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
    const mmPayroll = listOfMmPayroll.ele('MmPayroll');

    mmPayroll.ele('TaxPeriodMonth').txt(String(masaPajakBulan)).up();
    mmPayroll.ele('TaxPeriodYear').txt(String(masaPajakTahun)).up();
    mmPayroll.ele('CounterpartOpt').txt(resolveCounterpartOpt(karyawan)).up();

    appendCounterpartPassport(mmPayroll, record.counterpartPassport);

    mmPayroll.ele('CounterpartTin').txt(resolveCounterpartTin(karyawan)).up();

    if (karyawan.statusPtkp && karyawan.statusPtkp !== '-') {
      mmPayroll.ele('StatusTaxExemption').txt(karyawan.statusPtkp).up();
    } else {
      mmPayroll.ele('StatusTaxExemption', { 'xsi:nil': 'true' }).up();
    }

    mmPayroll.ele('Position').txt(resolvePosition(record)).up();
    mmPayroll.ele('TaxCertificate').txt(resolveTaxCertificate(record, options)).up();
    mmPayroll.ele('TaxObjectCode').txt(resolveTaxObjectCode(record, options)).up();
    mmPayroll.ele('Gross').txt(String(Math.max(0, Math.floor(hasilKalkulasi.totalBruto)))).up();
    mmPayroll.ele('Rate').txt(resolveRatePercent(hasilKalkulasi)).up();
    mmPayroll.ele('IDPlaceOfBusinessActivity').txt(perusahaan.idTku.trim()).up();
    mmPayroll.ele('WithholdingDate').txt(withholdingDate).up();
    mmPayroll.up();
  });

  return root.end({ prettyPrint: true });
}

export const generateMmPayrollBulkXML = generateCoretaxXML;