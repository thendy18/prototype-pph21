import { KonfigurasiTarif } from '../types/payroll';
import { DEFAULT_TARIF_BPJS } from './constants';

// ============================================================================
// INTERFACE HASIL OUTPUT BPJS
// ============================================================================
export interface HasilBpjsPerusahaan {
    premiJkk: number;
    premiJkm: number;
    premiJht: number;
    premiBpjsKes: number;
    premiJp: number;
    totalPremi: number; // Untuk ditambahkan ke Bruto (hanya JKK, JKM, BPJS Kes)
}

export interface HasilBpjsKaryawan {
    iuranJht: number;
    iuranBpjsKes: number;
    iuranJp: number;
    totalIuran: number; // Pengurang gaji (Neto)
}

// ============================================================================
// FUNGSI 1: HITUNG BPJS YANG DIBAYAR PERUSAHAAN (Menambah Bruto Karyawan)
// ============================================================================
export function hitungBpjsPerusahaan(
    gajiPokok: number,
    config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): HasilBpjsPerusahaan {

    // 1. Tentukan Dasar Pengenaan (Cek apakah gaji melebihi plafon)
    const dasarBpjsKes = Math.min(gajiPokok, config.plafonBpjsKes);
    const dasarJp = Math.min(gajiPokok, config.plafonJp);

    // 2. Kalkulasi (Gunakan Math.floor agar dibulatkan ke bawah sesuai standar)
    const premiJkk = Math.floor(gajiPokok * config.rateJkkPerusahaan);
    const premiJkm = Math.floor(gajiPokok * config.rateJkmPerusahaan);
    const premiJht = Math.floor(gajiPokok * config.rateJhtPerusahaan);

    const premiBpjsKes = Math.floor(dasarBpjsKes * config.rateBpjsKesPerusahaan);
    const premiJp = Math.floor(dasarJp * config.rateJpPerusahaan);

    return {
        premiJkk,
        premiJkm,
        premiJht,
        premiBpjsKes,
        premiJp,
        // Ingat: JHT dan JP Perusahaan TIDAK ditambahkan ke Total Bruto PPh 21
        totalPremi: premiJkk + premiJkm + premiBpjsKes,
    };
}

// ============================================================================
// FUNGSI 2: HITUNG BPJS YANG DIBAYAR KARYAWAN (Memotong THP / Pengurang Pajak)
// ============================================================================
export function hitungBpjsKaryawan(
    gajiPokok: number,
    config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): HasilBpjsKaryawan {

    // 1. Tentukan Dasar Pengenaan (Cek Plafon)
    const dasarBpjsKes = Math.min(gajiPokok, config.plafonBpjsKes);
    const dasarJp = Math.min(gajiPokok, config.plafonJp);

    // 2. Kalkulasi
    const iuranJht = Math.floor(gajiPokok * config.rateJhtKaryawan);
    const iuranBpjsKes = Math.floor(dasarBpjsKes * config.rateBpjsKesKaryawan);
    const iuranJp = Math.floor(dasarJp * config.rateJpKaryawan);

    return {
        iuranJht,
        iuranBpjsKes,
        iuranJp,
        totalIuran: iuranJht + iuranBpjsKes + iuranJp,
    };
}