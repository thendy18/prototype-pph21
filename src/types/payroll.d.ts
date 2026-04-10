// ============================================================================
// 1. TIPE DASAR DOMAIN PAYROLL / PPH 21
// ============================================================================
export type StatusPtkpValid =
  | 'TK/0'
  | 'TK/1'
  | 'TK/2'
  | 'TK/3'
  | 'K/0'
  | 'K/1'
  | 'K/2'
  | 'K/3';

export type StatusPtkp = StatusPtkpValid | '-';

export type StatusIdentitasPajak =
  | 'NPWP'
  | 'NIK_VALID'
  | 'BELUM_VALID'
  | 'TEMP_TIN';

export type MetodePajak = 'GROSS' | 'NET' | 'GROSS_UP';

export type ResidentStatus = 'RESIDENT' | 'NON_RESIDENT';

export type TipeKaryawan = 'TETAP' | 'NON_PEGAWAI';

export type KategoriTER = 'A' | 'B' | 'C';

export type PasalPemotongan = 'PPh21' | 'PPh26';

export type BasisUpahBpjs =
  | 'GAJI_POKOK'
  | 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP';

// ============================================================================
// 2. KONFIGURASI TARIF & PLAFON
// ============================================================================
export interface KonfigurasiTarif {
  // Rate BPJS Perusahaan (Desimal: 0.04 = 4%)
  rateJkkPerusahaan: number;
  rateJkmPerusahaan: number;
  rateJhtPerusahaan: number;
  rateBpjsKesPerusahaan: number;
  rateJpPerusahaan: number;

  // Rate BPJS Karyawan
  rateJhtKaryawan: number;
  rateBpjsKesKaryawan: number;
  rateJpKaryawan: number;

  // Rate tambahan payroll
  rateDplkPerusahaan: number;
  rateDplkKaryawan: number;
  rateZakat: number;

  // Batas maksimal gaji / upah
  plafonJp: number;
  plafonBpjsKes: number;

  // Opsional agar engine bisa dibekukan sesuai policy perusahaan
  basisUpahBpjs?: BasisUpahBpjs;
}

// ============================================================================
// 3. DATA MASTER PERUSAHAAN & KARYAWAN
// ============================================================================
export interface DataPerusahaan {
  npwpPemotong: string; // 16 digit / TIN pemotong
  idTku: string; // 22 digit Coretax
  namaPerusahaan: string;
}

export interface DataKaryawan {
  idKaryawan: string;
  nik: string; // 16 digit NIK / counterpart default
  namaLengkap: string;
  statusPtkp: StatusPtkp;
  statusIdentitas: StatusIdentitasPajak;
  metodePajak: MetodePajak;
  residentStatus: ResidentStatus;
  tipeKaryawan: TipeKaryawan;
  bulanMulai: number;
  bulanSelesai: number;

  // Metadata tambahan yang akan berguna untuk XML / slip / BPA1
  jabatan?: string;
  counterpartTin?: string;
  temporaryTin?: string;

  // Legacy bridge agar migrasi file lain bisa bertahap
  adaNPWP?: boolean;
}

// ============================================================================
// 4. OVERRIDE / INPUT MANUAL KOMPONEN BPJS
// ============================================================================
export interface KomponenBpjsPerusahaan {
  premiJkk: number;
  premiJkm: number;
  premiJht: number;
  premiBpjsKes: number;
  premiJp: number;
}

export interface KomponenBpjsKaryawan {
  iuranJht: number;
  iuranBpjsKes: number;
  iuranJp: number;
}

export interface OverrideBpjsPerusahaan
  extends Partial<KomponenBpjsPerusahaan> {}

export interface OverrideBpjsKaryawan
  extends Partial<KomponenBpjsKaryawan> {}

// ============================================================================
// 5. INPUT BULANAN DARI USER / EXCEL / UI
// ============================================================================
export interface InputGajiBulanan {
  bulan: number; // 1 - 12

  // Pendapatan utama
  gajiPokok: number;
  tunjanganTetap: number;
  tunjanganVariabel: number; // lembur / insentif / komponen variabel
  thrAtauBonus: number; // penghasilan tidak teratur
  naturaTaxable: number;
  premiAsuransiSwastaPerusahaan: number;

  // Potongan nominal
  dplkPerusahaan: number;
  dplkKaryawan: number;
  zakat: number;

  // Dasar / override BPJS
  dasarUpahBpjs?: number;
  overrideBpjsPerusahaan?: OverrideBpjsPerusahaan;
  overrideBpjsKaryawan?: OverrideBpjsKaryawan;

  // Metadata UI
  originalTunjangan?: number;
  isOverridden?: boolean;

  // Konfigurasi dinamis
  konfigurasiTarif: KonfigurasiTarif;
}

// ============================================================================
// 6. HASIL KALKULASI PEGAWAI TETAP
// ============================================================================
export interface HasilKalkulasiTetap {
  // Pendapatan & dasar hitung
  metodePajak: MetodePajak;
  residentStatus: ResidentStatus;
  isMasaPajakTerakhir: boolean;
  totalGajiTunjangan: number;
  totalPenghasilanCash: number;
  thrAtauBonus: number;
  naturaTaxable: number;
  premiAsuransiSwastaPerusahaan: number;
  dasarUpahBpjs: number;

  // Premi / iuran perusahaan
  premiJkkPerusahaan: number;
  premiJkmPerusahaan: number;
  premiJhtPerusahaan: number;
  premiBpjsKesPerusahaan: number;
  premiJpPerusahaan: number;

  // Tunjangan pajak & bruto pajak
  tunjanganPajakGrossUp: number;
  totalPenambahBrutoPajak: number;
  totalBruto: number;

  // Potongan / iuran karyawan
  iuranJhtKaryawan: number;
  iuranJpKaryawan: number;
  iuranBpjsKesKaryawan: number;
  potonganDplkKaryawan: number;
  potonganZakat: number;
  totalIuranCashKaryawan: number;
  totalPengurangPajak: number;

  // Hasil pajak
  kategoriTER: KategoriTER | null;
  rateTER: number | null;
  pajakTerutang: number;
  penyesuaianPajak: number; // bisa negatif saat lebih bayar masa terakhir
  pajakDipotongDariKaryawan: number;
  pajakDitanggungPerusahaan: number;
  refundPajak: number;
  statusLebihBayar: boolean;

  // Slip gaji
  thpBersih: number;

  // Audit
  logKalkulasi: LogAudit[];
}

// ============================================================================
// 7. INPUT & HASIL KALKULASI NON-PEGAWAI
// ============================================================================
export interface InputNonPegawai {
  totalPendapatan: number;
  statusIdentitas: StatusIdentitasPajak;
  residentStatus: ResidentStatus;
  metodePajak: MetodePajak;

  // Opsional untuk BP21 / XML ke depan
  deemedPersentase?: number;
  kodeObjekPajak?: string;
  nomorDokumen?: string;
  tanggalDokumen?: string;

  // Legacy bridge
  adaNPWP?: boolean;
}

export interface HasilKalkulasiNonPegawai {
  pasalPemotongan: PasalPemotongan;
  totalBruto: number;
  dasarPengenaanPajak: number;
  rateEfektif: number;
  pajakTerutang: number;
  pajakDipotongDariPenerima: number;
  pajakDitanggungPemberi: number;
  thpBersih: number;
  logKalkulasi: LogAudit[];
}

// ============================================================================
// 8. STRUKTUR LOG AUDIT
// ============================================================================
export interface LogAudit {
  langkah: string;
  deskripsi: string;
  nilai: number | string;
  rumus?: string;
}

// ============================================================================
// 9. INPUT & HASIL PENYESUAIAN TAHUNAN / MASA TERAKHIR
// ============================================================================
export interface InputPenyesuaianTahunan {
  dataPendapatanBulanan: InputGajiBulanan[];
  totalPajakDibayarSebelumnya: number;
  jumlahBulanAktif: number;
}

export interface HasilPenyesuaianTahunan {
  totalBrutoAktual: number;
  totalBrutoDisetahunkan: number;
  totalBiayaJabatan: number;
  totalJhtJpKaryawan: number;
  totalDplkKaryawan: number;
  totalPengurangPajak: number;
  penghasilanNetoAktual: number;
  penghasilanNetoDisetahunkan: number;
  nominalPtkp: number;
  pkp: number;
  totalPajakSetahunan: number;
  totalPajakBagianTahun: number;
  pajakMasaTerakhir: number;
  statusLebihBayar: boolean;
  nominalRefund: number;
  logKalkulasi: LogAudit[];
}