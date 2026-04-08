import {
    HasilKalkulasiTetap,
    LogAudit,
    DataKaryawan,
    InputGajiBulanan,
    KonfigurasiTarif
} from '../types/payroll';

import {
    NILAI_PTKP,
    BATAS_PENGURANG,
    TARIF_PASAL_17
} from './constants';

import { hitungPajakBulanan } from './taxEngineBulanan';

function getNominalPtkp(statusPtkp: string): number {
    let ptkp = NILAI_PTKP.WP_SENDIRI;
    if (statusPtkp.startsWith('K/')) ptkp += NILAI_PTKP.STATUS_KAWIN;
    const tanggungan = parseInt(statusPtkp.split('/')[1]);
    if (!isNaN(tanggungan) && tanggungan > 0) {
        ptkp += (Math.min(tanggungan, 3) * NILAI_PTKP.TANGGUNGAN);
    }
    return ptkp;
}

export function hitungPenyesuaianDesember(
    karyawan: DataKaryawan,
    historyInputs: InputGajiBulanan[],
    totalPajakJanNov: number,
    config: KonfigurasiTarif
): HasilKalkulasiTetap {

    const log: LogAudit[] = [];
    const isGrossUp = karyawan.metodePajak === 'GROSS_UP';

    // 1. REKAPITULASI
    let brutoJanNov = 0;
    let iuranPensiunJanNov = 0;
    let bpjsKesJanNov = 0;

    historyInputs.filter(h => h.bulan < 12).forEach(data => {
        const res = hitungPajakBulanan(karyawan, data);
        brutoJanNov += res.totalBruto;
        iuranPensiunJanNov += (res.iuranJhtKaryawan + res.iuranJpKaryawan);
        bpjsKesJanNov += res.iuranBpjsKesKaryawan;
    });

    const dataDes = historyInputs.find(h => h.bulan === 12)!;
    const resDesMurni = hitungPajakBulanan(karyawan, dataDes);

    log.push({
        langkah: 'REKAPITULASI',
        deskripsi: `Mengumpulkan data penghasilan dari Masa 1 sampai Masa 11.`,
        nilai: brutoJanNov,
        rumus: `Total Bruto Jan-Nov: Rp ${brutoJanNov.toLocaleString()}`
    });

    // 2. ITERASI GROSS UP
    let tunjanganPajakDes = 0;
    let pajakDesember = 0;
    let totalBrutoSetahun = 0;
    let totalPajakSetahun = 0;
    let pkpDibulatkan = 0;
    let biayaJabatanSetahun = 0;

    const maxIterations = isGrossUp ? 10 : 1;

    for (let i = 0; i < maxIterations; i++) {
        totalBrutoSetahun = brutoJanNov + resDesMurni.totalBruto + tunjanganPajakDes;

        biayaJabatanSetahun = Math.min(
            Math.floor(totalBrutoSetahun * BATAS_PENGURANG.BIAYA_JABATAN.RATE),
            BATAS_PENGURANG.BIAYA_JABATAN.MAX_TAHUNAN
        );

        const totalIuranSetahun = iuranPensiunJanNov + resDesMurni.iuranJhtKaryawan + resDesMurni.iuranJpKaryawan;
        const totalKesSetahun = bpjsKesJanNov + resDesMurni.iuranBpjsKesKaryawan;
        const netoSetahun = totalBrutoSetahun - biayaJabatanSetahun - totalIuranSetahun - totalKesSetahun;

        const nominalPtkp = getNominalPtkp(karyawan.statusPtkp);
        const pkp = Math.max(0, netoSetahun - nominalPtkp);
        pkpDibulatkan = Math.floor(pkp / 1000) * 1000;

        let kalkulasiPajak = 0;
        let sisaPkp = pkpDibulatkan;

        for (const lapis of TARIF_PASAL_17) {
            if (sisaPkp <= 0) break;
            const rentang = lapis.max - lapis.min;
            const kenaLapisIni = Math.min(sisaPkp, rentang); // FIX: Sudah tidak ada spasi
            kalkulasiPajak += Math.floor(kenaLapisIni * lapis.rate);
            sisaPkp -= kenaLapisIni;
        }

        if (!karyawan.adaNPWP) kalkulasiPajak = Math.floor(kalkulasiPajak * 1.2);

        totalPajakSetahun = kalkulasiPajak;
        pajakDesember = totalPajakSetahun - totalPajakJanNov;

        if (isGrossUp) {
            if (Math.abs(pajakDesember - tunjanganPajakDes) < 1) break;
            tunjanganPajakDes = pajakDesember;
        }
    }

    // 3. FINALISASI LOG
    log.push({
        langkah: 'PKP SETAHUN',
        deskripsi: `PKP setelah dikurangi PTKP dan dibulatkan ke bawah.`,
        nilai: pkpDibulatkan,
        rumus: `Neto Setahun - PTKP`
    });

    log.push({
        langkah: 'ADJUSTMENT DESEMBER',
        deskripsi: `Selisih Pajak Setahun dengan pajak yang sudah dibayar Jan-Nov.`,
        nilai: pajakDesember,
        rumus: `${totalPajakSetahun.toLocaleString()} (Setahun) - ${totalPajakJanNov.toLocaleString()} (Jan-Nov)`
    });

    return {
        ...resDesMurni,
        totalBruto: resDesMurni.totalBruto + tunjanganPajakDes,
        tunjanganPajakGrossUp: tunjanganPajakDes,
        pajakTerutang: Math.max(0, pajakDesember),
        thpBersih: resDesMurni.totalGajiTunjangan - (resDesMurni.iuranJhtKaryawan + resDesMurni.iuranJpKaryawan + resDesMurni.iuranBpjsKesKaryawan) - (isGrossUp ? 0 : pajakDesember),
        logKalkulasi: log,
        kategoriTER: 'A',
        rateTER: 0
    };
}