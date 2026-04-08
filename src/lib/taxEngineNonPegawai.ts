import {
    InputNonPegawai,
    HasilKalkulasiNonPegawai,
    LogAudit
} from '../types/payroll';

import { TARIF_PASAL_17 } from './constants';

// ============================================================================
// HELPER: MENGHITUNG PAJAK PROGRESIF (PASAL 17) BERLAPIS
// ============================================================================
function hitungPajakProgresif(dasarPengenaanPajak: number, log: LogAudit[]): number {
    let sisaDpp = dasarPengenaanPajak;
    let totalPajak = 0;

    log.push({
        langkah: '2a',
        deskripsi: 'Memulai Perhitungan Progresif (Pasal 17)',
        nilai: dasarPengenaanPajak,
        rumus: 'Sisa DPP akan dipotong lapis demi lapis sesuai UU HPP'
    });

    for (let i = 0; i < TARIF_PASAL_17.length; i++) {
        if (sisaDpp <= 0) break;

        const batasBawah = TARIF_PASAL_17[i].min;
        const batasAtas = TARIF_PASAL_17[i].max;
        const rate = TARIF_PASAL_17[i].rate;

        // Tentukan berapa jumlah uang yang masuk ke "lapis" ini
        const rentangLapis = batasAtas - batasBawah;
        const jumlahKenaPajakLapisIni = Math.min(sisaDpp, rentangLapis);

        const pajakLapisIni = Math.floor(jumlahKenaPajakLapisIni * rate);
        totalPajak += pajakLapisIni;
        sisaDpp -= jumlahKenaPajakLapisIni;

        log.push({
            langkah: `2b - Lapis ${i + 1}`,
            deskripsi: `Pajak Lapis Tarif ${(rate * 100).toFixed(0)}%`,
            nilai: pajakLapisIni,
            rumus: `DPP Terpakai (${jumlahKenaPajakLapisIni.toLocaleString()}) x Tarif ${(rate * 100).toFixed(0)}%`
        });
    }

    return totalPajak;
}

// ============================================================================
// FUNGSI UTAMA: KALKULASI PAJAK NON-PEGAWAI / FREELANCER
// Input: { totalPendapatan, adaNPWP }
// Mapping dari InputGajiBulanan ke InputNonPegawai dilakukan di store
// sebelum memanggil fungsi ini — engine ini tetap bersih & single responsibility
// ============================================================================
export function hitungPajakNonPegawai(input: InputNonPegawai): HasilKalkulasiNonPegawai {
    const log: LogAudit[] = [];

    // 1. Hitung DPP (Dasar Pengenaan Pajak) yaitu 50% dari Bruto
    const dasarPengenaanPajak = Math.floor(input.totalPendapatan * 0.5);

    log.push({
        langkah: '1',
        deskripsi: 'Menghitung Dasar Pengenaan Pajak (DPP 50%)',
        nilai: dasarPengenaanPajak,
        rumus: `Total Bruto (${input.totalPendapatan.toLocaleString()}) x 50%`
    });

    // 2. Hitung Pajak Progresif (Pasal 17)
    let pajakTerutang = hitungPajakProgresif(dasarPengenaanPajak, log);

    log.push({
        langkah: '3',
        deskripsi: 'Total Pajak Terutang (Normal)',
        nilai: pajakTerutang,
        rumus: 'Total penjumlahan seluruh lapis pajak progresif'
    });

    // 3. Penalty NPWP (+20%)
    if (!input.adaNPWP) {
        const pajakSebelumPenalty = pajakTerutang;
        pajakTerutang = Math.floor(pajakTerutang * 1.2);

        log.push({
            langkah: '4',
            deskripsi: 'Penalty Non-NPWP (+20%)',
            nilai: pajakTerutang,
            rumus: `Pajak Normal (${pajakSebelumPenalty.toLocaleString()}) x 120%`
        });
    } else {
        log.push({
            langkah: '4',
            deskripsi: 'Status NPWP',
            nilai: 'Ada (Aman)',
            rumus: 'Tidak dikenakan penalti tambahan 20%'
        });
    }

    // 4. Hitung THP (Bruto - Pajak)
    // Non-pegawai tidak dipotong BPJS, langsung dikurangi pajak saja
    const thpBersih = input.totalPendapatan - pajakTerutang;

    log.push({
        langkah: '5',
        deskripsi: 'Menghitung Take Home Pay (THP) Non-Pegawai',
        nilai: thpBersih,
        rumus: `Total Pendapatan (${input.totalPendapatan.toLocaleString()}) - Pajak Terutang (${pajakTerutang.toLocaleString()})`
    });

    return {
        totalBruto: input.totalPendapatan,
        dasarPengenaanPajak,
        pajakTerutang,
        thpBersih,
        logKalkulasi: log
    };
}