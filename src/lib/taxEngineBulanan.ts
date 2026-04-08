import {
    DataKaryawan,
    InputGajiBulanan,
    HasilKalkulasiTetap,
    LogAudit
} from '../types/payroll';

import {
    KATEGORI_TER,
    TABEL_TER_A,
    TABEL_TER_B,
    TABEL_TER_C,
    BatasTarif
} from './constants';

import { hitungBpjsPerusahaan, hitungBpjsKaryawan } from './bpjsCalculator';

// ============================================================================
// HELPER 1: TENTUKAN KATEGORI TER (A, B, C) DARI STATUS PTKP
// ============================================================================
function tentukanKategoriTER(statusPtkp: string): 'A' | 'B' | 'C' {
    // Tambahan "as readonly string[]" untuk mengatasi error strict mode TypeScript
    if ((KATEGORI_TER.A as readonly string[]).includes(statusPtkp)) return 'A';
    if ((KATEGORI_TER.B as readonly string[]).includes(statusPtkp)) return 'B';
    if ((KATEGORI_TER.C as readonly string[]).includes(statusPtkp)) return 'C';
    throw new Error(`Status PTKP tidak valid: ${statusPtkp}`);
}

// ============================================================================
// HELPER 2: CARI TARIF TER BERDASARKAN BRUTO
// ============================================================================
function cariTarifTER(bruto: number, kategori: 'A' | 'B' | 'C'): number {
    let tabel: readonly BatasTarif[];
    if (kategori === 'A') tabel = TABEL_TER_A;
    else if (kategori === 'B') tabel = TABEL_TER_B;
    else tabel = TABEL_TER_C;

    const temuan = tabel.find(tarif => bruto <= tarif.max);
    return temuan ? temuan.rate : 0.34; // Jika lebih dari batas maksimal, kena 34%
}

// ============================================================================
// FUNGSI UTAMA: KALKULASI PAJAK BULANAN PEGAWAI TETAP
// ============================================================================
export function hitungPajakBulanan(
    karyawan: DataKaryawan,
    input: InputGajiBulanan
): HasilKalkulasiTetap {

    const log: LogAudit[] = [];

    // 1. Tentukan Kategori TER
    const kategoriTER = tentukanKategoriTER(karyawan.statusPtkp);
    log.push({
        langkah: '1',
        deskripsi: 'Menentukan Kategori TER',
        nilai: `Kategori ${kategoriTER}`,
        rumus: `Status ${karyawan.statusPtkp} masuk ke Kategori TER ${kategoriTER}`
    });

    // 2. Hitung BPJS (Base-nya Gaji Pokok)
    const bpjsPerusahaan = hitungBpjsPerusahaan(input.gajiPokok, input.konfigurasiTarif);
    const bpjsKaryawan = hitungBpjsKaryawan(input.gajiPokok, input.konfigurasiTarif);

    log.push({
        langkah: '2',
        deskripsi: 'Menghitung Premi BPJS Perusahaan (Penambah Bruto)',
        nilai: bpjsPerusahaan.totalPremi,
        rumus: `JKK (${bpjsPerusahaan.premiJkk}) + JKM (${bpjsPerusahaan.premiJkm}) + BPJS Kes (${bpjsPerusahaan.premiBpjsKes})`
    });

    // 3. Kalkulasi Base Bruto (Tanpa Pajak)
    const totalGajiTunjangan = input.gajiPokok + input.tunjanganTetap + input.tunjanganVariabel;
    const baseBruto = totalGajiTunjangan + input.thrAtauBonus + bpjsPerusahaan.totalPremi;

    log.push({
        langkah: '3',
        deskripsi: 'Menghitung Penghasilan Bruto Dasar',
        nilai: baseBruto,
        rumus: `Gaji & Tunjangan (${totalGajiTunjangan}) + Bonus/THR (${input.thrAtauBonus}) + Premi BPJS (${bpjsPerusahaan.totalPremi})`
    });

    // ============================================================================
    // 4. LOGIKA ENGINE: GROSS vs GROSS UP
    // ============================================================================
    let tunjanganPajakGrossUp = 0;
    let pajakTerutang = 0;
    let rateTER = 0;
    let finalBruto = baseBruto;

    if (karyawan.metodePajak === 'GROSS') {
        // Jalur A: Hitungan Biasa (Pajak dipotong dari gaji karyawan)
        rateTER = cariTarifTER(finalBruto, kategoriTER);
        pajakTerutang = Math.floor(finalBruto * rateTER);

        // Penalty NPWP
        if (!karyawan.adaNPWP) {
            pajakTerutang = Math.floor(pajakTerutang * 1.2);
        }

        log.push({
            langkah: '4',
            deskripsi: 'Metode Pajak: GROSS (Pajak memotong THP)',
            nilai: pajakTerutang,
            rumus: `Bruto (${finalBruto}) x Rate (${(rateTER * 100).toFixed(2)}%) ${!karyawan.adaNPWP ? 'x 120% (Non-NPWP)' : ''}`
        });

    } else {
        // Jalur B: Metode GROSS UP (Looping iteratif mencari angka presisi)
        log.push({
            langkah: '4',
            deskripsi: 'Memulai Iterasi Gross Up (Mencari Tunjangan Pajak)',
            nilai: 'Proses...',
            rumus: 'Looping hingga Tunjangan Pajak == Pajak Terutang'
        });

        let selisih = 9999999;
        let iterasi = 0;

        while (selisih > 0 && iterasi < 50) {
            finalBruto = baseBruto + tunjanganPajakGrossUp;
            rateTER = cariTarifTER(finalBruto, kategoriTER);

            let tempPajak = Math.floor(finalBruto * rateTER);
            if (!karyawan.adaNPWP) {
                tempPajak = Math.floor(tempPajak * 1.2); // Penalty 20%
            }

            selisih = Math.abs(tempPajak - tunjanganPajakGrossUp);
            tunjanganPajakGrossUp = tempPajak;
            pajakTerutang = tempPajak;
            iterasi++;
        }

        log.push({
            langkah: '5',
            deskripsi: `Selesai Iterasi Gross Up (Total: ${iterasi} putaran)`,
            nilai: tunjanganPajakGrossUp,
            rumus: `Bruto Akhir: ${finalBruto} | Rate TER: ${(rateTER * 100).toFixed(2)}%`
        });
    }

    // ============================================================================
    // 5. MENGHITUNG TAKE HOME PAY (THP)
    // ============================================================================
    const totalPemasukanCash = totalGajiTunjangan + input.thrAtauBonus + tunjanganPajakGrossUp;

    // FIX: Menggunakan input.dplkKaryawan dan input.zakat sesuai dengan payroll.d.ts
    const totalPotonganCash = pajakTerutang + bpjsKaryawan.totalIuran + input.dplkKaryawan + input.zakat;

    const thpBersih = totalPemasukanCash - totalPotonganCash;

    log.push({
        langkah: '6',
        deskripsi: 'Menghitung TAKE HOME PAY (THP)',
        nilai: thpBersih,
        rumus: `(Pemasukan Cash: ${totalPemasukanCash}) - (Potongan Cash: ${totalPotonganCash})`
    });

    // 6. Kumpulkan Hasil
    return {
        totalGajiTunjangan,
        thrAtauBonus: input.thrAtauBonus,
        premiJkkPerusahaan: bpjsPerusahaan.premiJkk,
        premiJkmPerusahaan: bpjsPerusahaan.premiJkm,
        premiBpjsKesPerusahaan: bpjsPerusahaan.premiBpjsKes,
        tunjanganPajakGrossUp,
        totalBruto: finalBruto,

        iuranJhtKaryawan: bpjsKaryawan.iuranJht,
        iuranJpKaryawan: bpjsKaryawan.iuranJp,
        iuranBpjsKesKaryawan: bpjsKaryawan.iuranBpjsKes,

        // FIX: Mapping dari property InputGajiBulanan ke HasilKalkulasiTetap
        potonganDplkKaryawan: input.dplkKaryawan,
        potonganZakat: input.zakat,

        kategoriTER,
        rateTER,
        pajakTerutang,
        thpBersih,
        logKalkulasi: log
    };
}