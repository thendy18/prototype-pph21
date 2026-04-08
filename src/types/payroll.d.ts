// ============================================================================
// 1. KONFIGURASI TARIF & PLAFON (Untuk Fitur "Isi Default" di UI)
// ============================================================================
export interface KonfigurasiTarif {
  // Rate BPJS Perusahaan (Desimal: 0.04 = 4%)
  rateJkkPerusahaan: number;
  rateJkmPerusahaan: number;
  rateJhtPerusahaan: number;
  rateJhtKaryawan: number;
  rateBpjsKesPerusahaan: number;
  rateBpjsKesKaryawan: number;
  rateJpPerusahaan: number;
  rateJpKaryawan: number;


  // === TAMBAHKAN 3 BARIS INI ===
  rateDplkPerusahaan: number; 
  rateDplkKaryawan: number;   
  rateZakat: number;          
  // ============================

  // Batas Maksimal Gaji (Plafon)
  plafonJp: number;
  plafonBpjsKes: number;
}

// ============================================================================
// 2. DATA MASTER KARYAWAN & PERUSAHAAN (Untuk XML Coretax & Slip Gaji)
// ============================================================================
export interface DataPerusahaan {
  npwpPemotong: string; // 16 Digit
  idTku: string;        // 22 Digit (Coretax)
  namaPerusahaan: string;
}

export interface DataKaryawan {
  idKaryawan: string;
  nik: string;          // 16 Digit (Coretax)
  namaLengkap: string;
  statusPtkp: string;   // Contoh: 'TK/0', 'K/1'
  adaNPWP: boolean;     // Menentukan denda 20% jika false
  tipeKaryawan: 'TETAP' | 'NON_PEGAWAI';
  metodePajak: 'GROSS' | 'GROSS_UP';
}

// ============================================================================
// 3. INPUT BULANAN DARI USER (Dashboard Matrix)
// ============================================================================
export interface InputGajiBulanan {
  bulan: number; // 1 - 12
  
  // Pendapatan Utama
  gajiPokok: number;
  tunjanganTetap: number;
  tunjanganVariabel: number;
  thrAtauBonus: number; // Digabung ke bruto untuk cek tabel TER
  
  // Potongan Nominal (Bukan persentase)
  dplkPerusahaan: number; // Fasilitas kantor (TIDAK masuk Bruto pajak)
  dplkKaryawan: number;   // Potong gaji (Pengurang PKP)
  zakat: number;          // Potong gaji (Pengurang PKP)
  originalTunjangan?: number; // Untuk menyimpan angka asli dari Excel
  isOverridden?: boolean;     // Penanda kalau data sudah dirubah manual

  // Konfigurasi Dinamis (Diambil dari Setingan UI)
  konfigurasiTarif: KonfigurasiTarif;
}

// ============================================================================
// 4. HASIL KALKULASI PEGAWAI TETAP (Untuk Slip Gaji & Coretax)
// ============================================================================
export interface HasilKalkulasiTetap {
  // === BAGIAN A: PENDAPATAN (BRUTO) ===
  totalGajiTunjangan: number;
  thrAtauBonus: number;
  
  // Premi dibayar perusahaan (Masuk ke Bruto Coretax)
  premiJkkPerusahaan: number;
  premiJkmPerusahaan: number;
  premiBpjsKesPerusahaan: number;
  
  tunjanganPajakGrossUp: number; // Nominalnya sama dengan pajakTerutang jika Gross Up, 0 jika Gross
  totalBruto: number; // Angka ini yang disetor ke tag <Gross> XML Coretax
  
  // === BAGIAN B: PENGURANG (DEDUCTIONS) ===
  iuranJhtKaryawan: number;
  iuranJpKaryawan: number;
  iuranBpjsKesKaryawan: number;
  potonganDplkKaryawan: number;
  potonganZakat: number;

  // === BAGIAN C: HASIL PAJAK ===
  kategoriTER: 'A' | 'B' | 'C';
  rateTER: number;        // Contoh: 0.02 (Tarif 2%)
  pajakTerutang: number;  // Angka final yang dibayar ke negara

  // === BAGIAN D: SLIP GAJI ===
  thpBersih: number;      // Take Home Pay (Gaji yang ditransfer ke rekening)
  
  // === FITUR AUDIT ===
  logKalkulasi: LogAudit[];
}

// ============================================================================
// 5. INPUT & HASIL KALKULASI NON-PEGAWAI
// ============================================================================
export interface InputNonPegawai {
  totalPendapatan: number;
  adaNPWP: boolean;
}

export interface HasilKalkulasiNonPegawai {
  totalBruto: number;
  dasarPengenaanPajak: number; // 50% dari Total Bruto
  pajakTerutang: number;       // Hasil kali dengan Tarif Progresif
  thpBersih: number;
  logKalkulasi: LogAudit[];
}

// ============================================================================
// 6. STRUKTUR LOG AUDIT
// ============================================================================
export interface LogAudit {
  langkah: string;
  deskripsi: string;
  nilai: number | string;
  rumus?: string;
}


// ============================================================================
// 7. INPUT & HASIL KALKULASI TAHUNAN (Penyesuaian Bulan Desember)
// ============================================================================
export interface InputPenyesuaianTahunan {
  // Array yang berisi history gaji karyawan dari bulan 1 sampai 12
  dataPendapatanBulanan: InputGajiBulanan[]; 
  
  // Total PPh 21 yang sudah dipotong dan disetor dari Januari s.d. November
  totalPajakDibayarJanNov: number;           
}

export interface HasilPenyesuaianTahunan {
  totalBrutoSetahun: number;
  totalBiayaJabatan: number;
  totalIuranPensiun: number;      // Total JHT + JP Karyawan selama setahun
  totalBpjsKesKaryawan: number;   // Total BPJS Kesehatan Karyawan selama setahun
  penghasilanNeto: number;
  nominalPtkp: number;
  pkp: number;                    // Penghasilan Kena Pajak (dibulatkan ke bawah ke ribuan terdekat)

  totalPajakPasal17: number;      // Total Pajak riil setahun (Berdasarkan Tarif Progresif)
  pajakDesember: number;          // Nominal final yang harus dipotong di slip gaji Desember

  statusLebihBayar: boolean;      // TRUE jika total dibayar Jan-Nov > pajak riil setahun
  nominalRefund: number;          // Nominal yang harus dikembalikan perusahaan ke karyawan
  
  logKalkulasi: LogAudit[];       // Rincian cara hitung untuk fitur Audit
}