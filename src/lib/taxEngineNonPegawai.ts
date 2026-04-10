import {
  HasilKalkulasiNonPegawai,
  InputNonPegawai,
  LogAudit,
} from '../types/payroll';

import { TARIF_PASAL_17 } from './constants';

const DEFAULT_DEEMED_PERSENTASE = 50;
const RATE_PPH_26_NON_RESIDENT = 0.2;
const MAX_ITERASI_GROSS_UP = 50;

type LapisanPajak = {
  lapis: number;
  rate: number;
  dasarTerpakai: number;
  pajakLapis: number;
};

type HasilPajakDasar = {
  pasalPemotongan: 'PPh21' | 'PPh26';
  totalBruto: number;
  dasarPengenaanPajak: number;
  rateEfektif: number;
  pajakNormal: number;
  pajakFinal: number;
  deemedPersentase: number | null;
  lapisan: LapisanPajak[];
  multiplierIdentitas: number;
};

function floorRupiah(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.floor(nilai);
}

function normalisasiStatusIdentitas(input: InputNonPegawai): string {
  if (input.statusIdentitas) return input.statusIdentitas;
  if (input.adaNPWP === true) return 'NPWP';
  if (input.adaNPWP === false) return 'BELUM_VALID';
  return 'NPWP';
}

function gunakanTarifLebihTinggiIdentitas(input: InputNonPegawai): boolean {
  return (
    input.residentStatus === 'RESIDENT' &&
    normalisasiStatusIdentitas(input) === 'BELUM_VALID'
  );
}

function hitungPajakProgresif(
  dasarPengenaanPajak: number
): { totalPajak: number; lapisan: LapisanPajak[] } {
  let sisaDpp = dasarPengenaanPajak;
  let totalPajak = 0;
  const lapisan: LapisanPajak[] = [];

  for (let index = 0; index < TARIF_PASAL_17.length; index += 1) {
    if (sisaDpp <= 0) break;

    const batasBawah = TARIF_PASAL_17[index].min;
    const batasAtas = TARIF_PASAL_17[index].max;
    const rate = TARIF_PASAL_17[index].rate;
    const rentangLapis = batasAtas - batasBawah;
    const dasarTerpakai = Math.min(sisaDpp, rentangLapis);
    const pajakLapis = floorRupiah(dasarTerpakai * rate);

    totalPajak += pajakLapis;
    sisaDpp -= dasarTerpakai;

    lapisan.push({
      lapis: index + 1,
      rate,
      dasarTerpakai,
      pajakLapis,
    });
  }

  return { totalPajak, lapisan };
}

function hitungPajakResident(input: InputNonPegawai, totalBruto: number): HasilPajakDasar {
  const deemedPersentase = input.deemedPersentase ?? DEFAULT_DEEMED_PERSENTASE;
  const dasarPengenaanPajak = floorRupiah(
    totalBruto * (deemedPersentase / 100)
  );
  const progresif = hitungPajakProgresif(dasarPengenaanPajak);
  const multiplierIdentitas = gunakanTarifLebihTinggiIdentitas(input) ? 1.2 : 1;
  const pajakFinal = floorRupiah(progresif.totalPajak * multiplierIdentitas);
  const rateEfektif = totalBruto > 0 ? pajakFinal / totalBruto : 0;

  return {
    pasalPemotongan: 'PPh21',
    totalBruto,
    dasarPengenaanPajak,
    rateEfektif,
    pajakNormal: progresif.totalPajak,
    pajakFinal,
    deemedPersentase,
    lapisan: progresif.lapisan,
    multiplierIdentitas,
  };
}

function hitungPajakNonResident(totalBruto: number): HasilPajakDasar {
  const pajak = floorRupiah(totalBruto * RATE_PPH_26_NON_RESIDENT);

  return {
    pasalPemotongan: 'PPh26',
    totalBruto,
    dasarPengenaanPajak: totalBruto,
    rateEfektif: RATE_PPH_26_NON_RESIDENT,
    pajakNormal: pajak,
    pajakFinal: pajak,
    deemedPersentase: null,
    lapisan: [],
    multiplierIdentitas: 1,
  };
}

function hitungPajakDasar(
  input: InputNonPegawai,
  totalBruto: number
): HasilPajakDasar {
  if (input.residentStatus === 'NON_RESIDENT') {
    return hitungPajakNonResident(totalBruto);
  }

  return hitungPajakResident(input, totalBruto);
}

function buatLogRincianPajak(
  log: LogAudit[],
  hasil: HasilPajakDasar,
  statusIdentitas: string
): void {
  if (hasil.pasalPemotongan === 'PPh26') {
    log.push({
      langkah: '2',
      deskripsi: 'Menghitung PPh 26 untuk non-resident',
      nilai: hasil.pajakFinal,
      rumus: `Bruto (${hasil.totalBruto.toLocaleString()}) x 20%`,
    });
    return;
  }

  log.push({
    langkah: '2',
    deskripsi: 'Menghitung DPP non-pegawai',
    nilai: hasil.dasarPengenaanPajak,
    rumus: `Total Bruto (${hasil.totalBruto.toLocaleString()}) x ${hasil.deemedPersentase}%`,
  });

  hasil.lapisan.forEach((lapis) => {
    log.push({
      langkah: `3.${lapis.lapis}`,
      deskripsi: `Pajak progresif lapis ${lapis.lapis}`,
      nilai: lapis.pajakLapis,
      rumus: `DPP ${lapis.dasarTerpakai.toLocaleString()} x ${(lapis.rate * 100).toFixed(0)}%`,
    });
  });

  log.push({
    langkah: '4',
    deskripsi: 'Total pajak progresif',
    nilai: hasil.pajakNormal,
    rumus: 'Penjumlahan seluruh lapis Pasal 17',
  });

  if (hasil.multiplierIdentitas > 1) {
    log.push({
      langkah: '5',
      deskripsi: 'Tarif lebih tinggi karena status identitas belum valid',
      nilai: hasil.pajakFinal,
      rumus: `${hasil.pajakNormal.toLocaleString()} x 120%`,
    });
  } else {
    log.push({
      langkah: '5',
      deskripsi: 'Status identitas tidak memicu surcharge',
      nilai: hasil.pajakFinal,
      rumus: `Status identitas ${statusIdentitas}`,
    });
  }
}

function hitungGrossUp(
  input: InputNonPegawai,
  brutoAwal: number
): { tunjanganPajak: number; hasil: HasilPajakDasar; iterasi: number } {
  let tunjanganPajak = 0;
  let hasil = hitungPajakDasar(input, brutoAwal);
  let iterasi = 0;

  while (iterasi < MAX_ITERASI_GROSS_UP) {
    const brutoKandidat = brutoAwal + tunjanganPajak;
    hasil = hitungPajakDasar(input, brutoKandidat);

    const selisih = Math.abs(hasil.pajakFinal - tunjanganPajak);
    tunjanganPajak = hasil.pajakFinal;
    iterasi += 1;

    if (selisih < 1) break;
  }

  return { tunjanganPajak, hasil, iterasi };
}

// ============================================================================
// FUNGSI UTAMA: KALKULASI PAJAK NON-PEGAWAI / FREELANCER
// ============================================================================
export function hitungPajakNonPegawai(
  input: InputNonPegawai
): HasilKalkulasiNonPegawai {
  const log: LogAudit[] = [];
  const totalPendapatan = floorRupiah(input.totalPendapatan);
  const statusIdentitas = normalisasiStatusIdentitas(input);

  log.push({
    langkah: '1',
    deskripsi: 'Membaca profil non-pegawai',
    nilai: `${input.residentStatus} | ${input.metodePajak} | ${statusIdentitas}`,
    rumus: `Pendapatan bruto ${totalPendapatan.toLocaleString()}`,
  });

  let hasilDasar = hitungPajakDasar(input, totalPendapatan);
  let tunjanganPajakGrossUp = 0;

  if (input.metodePajak === 'GROSS_UP') {
    const hasilGrossUp = hitungGrossUp(input, totalPendapatan);
    hasilDasar = hasilGrossUp.hasil;
    tunjanganPajakGrossUp = hasilGrossUp.tunjanganPajak;

    log.push({
      langkah: '1a',
      deskripsi: `Iterasi gross-up selesai dalam ${hasilGrossUp.iterasi} putaran`,
      nilai: tunjanganPajakGrossUp,
      rumus: `Bruto akhir ${hasilDasar.totalBruto.toLocaleString()}`,
    });
  }

  buatLogRincianPajak(log, hasilDasar, statusIdentitas);

  let pajakDipotongDariPenerima = 0;
  let pajakDitanggungPemberi = 0;

  if (input.metodePajak === 'NET') {
    pajakDitanggungPemberi = hasilDasar.pajakFinal;
  } else {
    pajakDipotongDariPenerima = hasilDasar.pajakFinal;
  }

  const thpFinal = input.metodePajak === 'GROSS_UP'
    ? hasilDasar.totalBruto - hasilDasar.pajakFinal
    : input.metodePajak === 'NET'
      ? totalPendapatan
      : totalPendapatan - pajakDipotongDariPenerima;

  log.push({
    langkah: '6',
    deskripsi: 'Menghitung THP non-pegawai',
    nilai: thpFinal,
    rumus:
      input.metodePajak === 'NET'
        ? `Bruto ${totalPendapatan.toLocaleString()} tanpa potong pajak`
        : input.metodePajak === 'GROSS_UP'
          ? `Bruto akhir ${hasilDasar.totalBruto.toLocaleString()} - Pajak ${hasilDasar.pajakFinal.toLocaleString()}`
          : `Bruto ${totalPendapatan.toLocaleString()} - Pajak ${hasilDasar.pajakFinal.toLocaleString()}`,
  });

  return {
    pasalPemotongan: hasilDasar.pasalPemotongan,
    totalBruto: hasilDasar.totalBruto,
    dasarPengenaanPajak: hasilDasar.dasarPengenaanPajak,
    rateEfektif: hasilDasar.rateEfektif,
    pajakTerutang: hasilDasar.pajakFinal,
    pajakDipotongDariPenerima,
    pajakDitanggungPemberi,
    thpBersih: thpFinal,
    logKalkulasi: log,
  };
}