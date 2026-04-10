import {
  DataKaryawan,
  HasilKalkulasiTetap,
  InputGajiBulanan,
  KategoriTER,
  LogAudit,
  StatusPtkpValid,
} from '../types/payroll';

import {
  BatasTarif,
  KATEGORI_TER,
  TABEL_TER_A,
  TABEL_TER_B,
  TABEL_TER_C,
} from './constants';

import { hitungKomponenBpjs } from './bpjsCalculator';
import { floorDecimalProduct } from './decimalMath';

const RATE_PPH_26_NON_RESIDENT = 0.2;
const MAX_ITERASI_GROSS_UP = 50;

function floorRupiah(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.floor(nilai);
}

function normalisasiStatusIdentitas(karyawan: DataKaryawan): string {
  if (karyawan.statusIdentitas) return karyawan.statusIdentitas;
  if (karyawan.adaNPWP === true) return 'NPWP';
  if (karyawan.adaNPWP === false) return 'BELUM_VALID';
  return 'NPWP';
}

function gunakanTarifLebihTinggiIdentitas(karyawan: DataKaryawan): boolean {
  if (karyawan.residentStatus !== 'RESIDENT') return false;
  return normalisasiStatusIdentitas(karyawan) === 'BELUM_VALID';
}

function getMultiplierIdentitas(karyawan: DataKaryawan): number {
  return gunakanTarifLebihTinggiIdentitas(karyawan) ? 1.2 : 1;
}

function isStatusPtkpValid(statusPtkp: string): statusPtkp is StatusPtkpValid {
  return (
    (KATEGORI_TER.A as readonly string[]).includes(statusPtkp) ||
    (KATEGORI_TER.B as readonly string[]).includes(statusPtkp) ||
    (KATEGORI_TER.C as readonly string[]).includes(statusPtkp)
  );
}

function tentukanKategoriTER(statusPtkp: string): KategoriTER {
  if (!isStatusPtkpValid(statusPtkp)) {
    throw new Error(`Status PTKP tidak valid untuk TER: ${statusPtkp}`);
  }

  if ((KATEGORI_TER.A as readonly string[]).includes(statusPtkp)) return 'A';
  if ((KATEGORI_TER.B as readonly string[]).includes(statusPtkp)) return 'B';
  return 'C';
}

function cariTarifTER(bruto: number, kategori: KategoriTER): number {
  let tabel: readonly BatasTarif[];
  if (kategori === 'A') tabel = TABEL_TER_A;
  else if (kategori === 'B') tabel = TABEL_TER_B;
  else tabel = TABEL_TER_C;

  const temuan = tabel.find((tarif) => bruto <= tarif.max);
  return temuan ? temuan.rate : 0.34;
}

function hitungPajakResidentBulanan(
  brutoPajak: number,
  kategoriTER: KategoriTER,
  karyawan: DataKaryawan
): {
  rateTER: number;
  pajakNormal: number;
  pajakFinal: number;
  rumusSurcharge: string;
} {
  const rateTER = cariTarifTER(brutoPajak, kategoriTER);
  const pajakNormal = floorDecimalProduct(brutoPajak, rateTER);
  const multiplierIdentitas = getMultiplierIdentitas(karyawan);
  const pajakFinal = floorDecimalProduct(pajakNormal, multiplierIdentitas);

  return {
    rateTER,
    pajakNormal,
    pajakFinal,
    rumusSurcharge:
      multiplierIdentitas > 1
        ? `Pajak normal (${pajakNormal}) x 120%`
        : `Pajak normal (${pajakNormal})`,
  };
}

function hitungPajakNonResidentBulanan(brutoPajak: number): {
  rateTER: null;
  pajakNormal: number;
  pajakFinal: number;
  rumusSurcharge: string;
} {
  const pajak = floorDecimalProduct(brutoPajak, RATE_PPH_26_NON_RESIDENT);
  return {
    rateTER: null,
    pajakNormal: pajak,
    pajakFinal: pajak,
    rumusSurcharge: `Bruto Pajak (${brutoPajak}) x 20%`,
  };
}

function iterasiGrossUp(
  baseBrutoPajak: number,
  hitungPajak: (brutoPajak: number) => { pajak: number; rateTER: number | null },
  log: LogAudit[]
): {
  tunjanganPajakGrossUp: number;
  totalBruto: number;
  rateTER: number | null;
  pajakTerutang: number;
} {
  let tunjanganPajakGrossUp = 0;
  let totalBruto = baseBrutoPajak;
  let pajakTerutang = 0;
  let rateTER: number | null = null;
  let iterasi = 0;

  log.push({
    langkah: '6',
    deskripsi: 'Memulai iterasi gross-up',
    nilai: 'Proses',
    rumus: 'Looping sampai tunjangan pajak = pajak terutang',
  });

  while (iterasi < MAX_ITERASI_GROSS_UP) {
    totalBruto = baseBrutoPajak + tunjanganPajakGrossUp;
    const hasil = hitungPajak(totalBruto);

    const selisih = Math.abs(hasil.pajak - tunjanganPajakGrossUp);
    tunjanganPajakGrossUp = hasil.pajak;
    pajakTerutang = hasil.pajak;
    rateTER = hasil.rateTER;
    iterasi += 1;

    if (selisih < 1) {
      break;
    }
  }

  log.push({
    langkah: '7',
    deskripsi: `Gross-up selesai dalam ${iterasi} iterasi`,
    nilai: tunjanganPajakGrossUp,
    rumus: `Bruto Pajak Final (${totalBruto})`,
  });

  return {
    tunjanganPajakGrossUp,
    totalBruto,
    rateTER,
    pajakTerutang,
  };
}

// ============================================================================
// FUNGSI UTAMA: KALKULASI PAJAK BULANAN PEGAWAI TETAP
// ============================================================================
export function hitungPajakBulanan(
  karyawan: DataKaryawan,
  input: InputGajiBulanan
): HasilKalkulasiTetap {
  const log: LogAudit[] = [];
  const statusIdentitas = normalisasiStatusIdentitas(karyawan);

  log.push({
    langkah: '1',
    deskripsi: 'Membaca profil pajak karyawan',
    nilai: `${karyawan.metodePajak} | ${karyawan.residentStatus} | ${statusIdentitas}`,
    rumus: `PTKP ${karyawan.statusPtkp}`,
  });

  const hasilBpjs = hitungKomponenBpjs({
    gajiPokok: input.gajiPokok,
    tunjanganTetap: input.tunjanganTetap,
    dasarUpahBpjs: input.dasarUpahBpjs,
    konfigurasiTarif: input.konfigurasiTarif,
    overrideBpjsPerusahaan: input.overrideBpjsPerusahaan,
    overrideBpjsKaryawan: input.overrideBpjsKaryawan,
  });

  const bpjsPerusahaan = hasilBpjs.perusahaan;
  const bpjsKaryawan = hasilBpjs.karyawan;

  log.push({
    langkah: '2',
    deskripsi: 'Menentukan dasar upah BPJS',
    nilai: bpjsPerusahaan.dasarUpahBpjs,
    rumus: input.dasarUpahBpjs !== undefined
      ? `Override dasar upah BPJS = ${bpjsPerusahaan.dasarUpahBpjs}`
      : `Gaji Pokok (${input.gajiPokok}) + Tunjangan Tetap (${input.tunjanganTetap})`,
  });

  log.push({
    langkah: '3',
    deskripsi: 'Menghitung komponen BPJS perusahaan',
    nilai: bpjsPerusahaan.totalDicatatPerusahaan,
    rumus:
      `JKK (${bpjsPerusahaan.premiJkk}) + JKM (${bpjsPerusahaan.premiJkm}) + ` +
      `JHT (${bpjsPerusahaan.premiJht}) + BPJS Kes (${bpjsPerusahaan.premiBpjsKes}) + ` +
      `JP (${bpjsPerusahaan.premiJp})`,
  });

  log.push({
    langkah: '4',
    deskripsi: 'Menghitung iuran BPJS karyawan',
    nilai: bpjsKaryawan.totalPotonganCash,
    rumus:
      `JHT (${bpjsKaryawan.iuranJht}) + JP (${bpjsKaryawan.iuranJp}) + ` +
      `BPJS Kes (${bpjsKaryawan.iuranBpjsKes})`,
  });

  const totalGajiTunjangan =
    floorRupiah(input.gajiPokok) +
    floorRupiah(input.tunjanganTetap) +
    floorRupiah(input.tunjanganVariabel);

  const totalPenghasilanCash =
    totalGajiTunjangan + floorRupiah(input.thrAtauBonus);

  const totalPenambahBrutoPajak =
    bpjsPerusahaan.totalPenambahBrutoPajak +
    floorRupiah(input.naturaTaxable) +
    floorRupiah(input.premiAsuransiSwastaPerusahaan);

  const baseBrutoPajak = totalPenghasilanCash + totalPenambahBrutoPajak;

  log.push({
    langkah: '5',
    deskripsi: 'Menghitung bruto pajak dasar',
    nilai: baseBrutoPajak,
    rumus:
      `Cash (${totalPenghasilanCash}) + Natura (${input.naturaTaxable}) + ` +
      `Asuransi Swasta ER (${input.premiAsuransiSwastaPerusahaan}) + ` +
      `Penambah Bruto BPJS (${bpjsPerusahaan.totalPenambahBrutoPajak})`,
  });

  const kategoriTER =
    karyawan.residentStatus === 'RESIDENT'
      ? tentukanKategoriTER(karyawan.statusPtkp)
      : null;

  if (kategoriTER) {
    log.push({
      langkah: '5a',
      deskripsi: 'Menentukan kategori TER',
      nilai: kategoriTER,
      rumus: `Status PTKP ${karyawan.statusPtkp} masuk Kategori ${kategoriTER}`,
    });
  } else {
    log.push({
      langkah: '5a',
      deskripsi: 'Resident status NON_RESIDENT',
      nilai: 'PPh 26',
      rumus: 'Tarif flat 20% dari bruto pajak',
    });
  }

  let tunjanganPajakGrossUp = 0;
  let totalBruto = baseBrutoPajak;
  let rateTER: number | null = null;
  let pajakTerutang = 0;

  if (karyawan.metodePajak === 'GROSS_UP') {
    const hasilGrossUp = iterasiGrossUp(
      baseBrutoPajak,
      (brutoPajak) => {
        if (karyawan.residentStatus === 'RESIDENT') {
          const hasil = hitungPajakResidentBulanan(brutoPajak, kategoriTER!, karyawan);
          return { pajak: hasil.pajakFinal, rateTER: hasil.rateTER };
        }

        const hasil = hitungPajakNonResidentBulanan(brutoPajak);
        return { pajak: hasil.pajakFinal, rateTER: hasil.rateTER };
      },
      log
    );

    tunjanganPajakGrossUp = hasilGrossUp.tunjanganPajakGrossUp;
    totalBruto = hasilGrossUp.totalBruto;
    rateTER = hasilGrossUp.rateTER;
    pajakTerutang = hasilGrossUp.pajakTerutang;
  } else if (karyawan.residentStatus === 'RESIDENT') {
    const hasilPajak = hitungPajakResidentBulanan(baseBrutoPajak, kategoriTER!, karyawan);
    rateTER = hasilPajak.rateTER;
    pajakTerutang = hasilPajak.pajakFinal;

    log.push({
      langkah: '6',
      deskripsi: `Metode pajak ${karyawan.metodePajak}`,
      nilai: pajakTerutang,
      rumus:
        `Bruto Pajak (${baseBrutoPajak}) x TER (${(hasilPajak.rateTER * 100).toFixed(2)}%)` +
        `${gunakanTarifLebihTinggiIdentitas(karyawan) ? ' x 120%' : ''}`,
    });
  } else {
    const hasilPajak = hitungPajakNonResidentBulanan(baseBrutoPajak);
    rateTER = null;
    pajakTerutang = hasilPajak.pajakFinal;

    log.push({
      langkah: '6',
      deskripsi: `Metode pajak ${karyawan.metodePajak} untuk NON_RESIDENT`,
      nilai: pajakTerutang,
      rumus: hasilPajak.rumusSurcharge,
    });
  }

  const totalPenghasilanCashFinal = totalPenghasilanCash + tunjanganPajakGrossUp;
  const totalIuranCashKaryawan =
    bpjsKaryawan.totalPotonganCash +
    floorRupiah(input.dplkKaryawan) +
    floorRupiah(input.zakat);

  const pajakDipotongDariKaryawan = karyawan.metodePajak === 'NET' ? 0 : pajakTerutang;
  const pajakDitanggungPerusahaan = karyawan.metodePajak === 'NET' ? pajakTerutang : 0;
  const thpBersih =
    totalPenghasilanCashFinal - totalIuranCashKaryawan - pajakDipotongDariKaryawan;

  log.push({
    langkah: '8',
    deskripsi: 'Menghitung take home pay',
    nilai: thpBersih,
    rumus:
      `(Cash Final ${totalPenghasilanCashFinal}) - ` +
      `(Potongan Karyawan ${totalIuranCashKaryawan}) - ` +
      `(Pajak Dipotong ${pajakDipotongDariKaryawan})`,
  });

  return {
    metodePajak: karyawan.metodePajak,
    residentStatus: karyawan.residentStatus,
    isMasaPajakTerakhir: false,
    totalGajiTunjangan,
    totalPenghasilanCash: totalPenghasilanCashFinal,
    thrAtauBonus: input.thrAtauBonus,
    naturaTaxable: input.naturaTaxable,
    premiAsuransiSwastaPerusahaan: input.premiAsuransiSwastaPerusahaan,
    dasarUpahBpjs: bpjsPerusahaan.dasarUpahBpjs,

    premiJkkPerusahaan: bpjsPerusahaan.premiJkk,
    premiJkmPerusahaan: bpjsPerusahaan.premiJkm,
    premiJhtPerusahaan: bpjsPerusahaan.premiJht,
    premiBpjsKesPerusahaan: bpjsPerusahaan.premiBpjsKes,
    premiJpPerusahaan: bpjsPerusahaan.premiJp,

    tunjanganPajakGrossUp,
    totalPenambahBrutoPajak,
    totalBruto,

    iuranJhtKaryawan: bpjsKaryawan.iuranJht,
    iuranJpKaryawan: bpjsKaryawan.iuranJp,
    iuranBpjsKesKaryawan: bpjsKaryawan.iuranBpjsKes,
    potonganDplkKaryawan: input.dplkKaryawan,
    potonganZakat: input.zakat,
    totalIuranCashKaryawan,
    totalPengurangPajak:
      bpjsKaryawan.totalPengurangPajak +
      floorRupiah(input.dplkKaryawan) +
      floorRupiah(input.zakat),

    kategoriTER,
    rateTER,
    pajakTerutang,
    penyesuaianPajak: pajakTerutang,
    pajakDipotongDariKaryawan,
    pajakDitanggungPerusahaan,
    refundPajak: 0,
    statusLebihBayar: false,

    thpBersih,
    logKalkulasi: log,
  };
}
