import {
  DataKaryawan,
  HasilKalkulasiTetap,
  HasilPenyesuaianTahunan,
  InputGajiBulanan,
  KonfigurasiTarif,
  LogAudit,
  StatusPtkpValid,
} from '../types/payroll';

import {
  BATAS_PENGURANG,
  NILAI_PTKP,
  TARIF_PASAL_17,
} from './constants';

import { floorDecimalProduct } from './decimalMath';
import { hitungPajakBulanan } from './taxEngineBulanan';

const MAX_ITERASI_GROSS_UP_TAHUNAN = 50;

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
  return (
    karyawan.residentStatus === 'RESIDENT' &&
    normalisasiStatusIdentitas(karyawan) === 'BELUM_VALID'
  );
}

function isStatusPtkpValid(statusPtkp: string): statusPtkp is StatusPtkpValid {
  return (
    statusPtkp === 'TK/0' ||
    statusPtkp === 'TK/1' ||
    statusPtkp === 'TK/2' ||
    statusPtkp === 'TK/3' ||
    statusPtkp === 'K/0' ||
    statusPtkp === 'K/1' ||
    statusPtkp === 'K/2' ||
    statusPtkp === 'K/3'
  );
}

function getNominalPtkp(statusPtkp: string): number {
  if (!isStatusPtkpValid(statusPtkp)) return 0;

  let ptkp = NILAI_PTKP.WP_SENDIRI;
  if (statusPtkp.startsWith('K/')) ptkp += NILAI_PTKP.STATUS_KAWIN;

  const tanggungan = parseInt(statusPtkp.split('/')[1] ?? '0', 10);
  if (!Number.isNaN(tanggungan) && tanggungan > 0) {
    ptkp += Math.min(tanggungan, 3) * NILAI_PTKP.TANGGUNGAN;
  }

  return ptkp;
}

function hitungPajakPasal17(pkpDibulatkan: number): number {
  let sisaPkp = pkpDibulatkan;
  let totalPajak = 0;

  for (const lapis of TARIF_PASAL_17) {
    if (sisaPkp <= 0) break;

    const rentang = lapis.max - lapis.min;
    const kenaLapisIni = Math.min(sisaPkp, rentang);
    totalPajak += floorDecimalProduct(kenaLapisIni, lapis.rate);
    sisaPkp -= kenaLapisIni;
  }

  return totalPajak;
}

function hitungPenyesuaianTahunanDetail(
  karyawan: DataKaryawan,
  hasilSebelumnya: HasilKalkulasiTetap[],
  hasilMasaTerakhirAcuan: HasilKalkulasiTetap,
  tunjanganPajakMasaTerakhir: number,
  log: LogAudit[]
): HasilPenyesuaianTahunan & {
  totalPajakBagianTahunFinal: number;
} {
  const jumlahBulanAktif = hasilSebelumnya.length + 1;
  const nominalPtkp = getNominalPtkp(karyawan.statusPtkp);

  const totalBrutoSebelumnya = hasilSebelumnya.reduce(
    (sum, item) => sum + item.totalBruto,
    0
  );
  const totalPengurangPajakSebelumnya = hasilSebelumnya.reduce(
    (sum, item) => sum + item.totalPengurangPajak,
    0
  );
  const totalPajakSebelumnya = hasilSebelumnya.reduce(
    (sum, item) => sum + item.pajakTerutang,
    0
  );

  const brutoMasaTerakhirDasar =
    hasilMasaTerakhirAcuan.totalBruto - hasilMasaTerakhirAcuan.tunjanganPajakGrossUp;
  const brutoMasaTerakhirFinal = brutoMasaTerakhirDasar + tunjanganPajakMasaTerakhir;

  const totalBrutoAktual = totalBrutoSebelumnya + brutoMasaTerakhirFinal;
  const maxBiayaJabatan = jumlahBulanAktif * BATAS_PENGURANG.BIAYA_JABATAN.MAX_BULANAN;
  const totalBiayaJabatan = Math.min(
    floorDecimalProduct(totalBrutoAktual, BATAS_PENGURANG.BIAYA_JABATAN.RATE),
    maxBiayaJabatan
  );

  const totalPengurangPajak =
    totalPengurangPajakSebelumnya + hasilMasaTerakhirAcuan.totalPengurangPajak;

  const penghasilanNetoAktual =
    totalBrutoAktual - totalBiayaJabatan - totalPengurangPajak;

  const penghasilanNetoDisetahunkan =
    jumlahBulanAktif >= 12
      ? penghasilanNetoAktual
      : floorRupiah((penghasilanNetoAktual * 12) / jumlahBulanAktif);

  const pkpRaw = Math.max(0, penghasilanNetoDisetahunkan - nominalPtkp);
  const pkp = floorRupiah(pkpRaw / 1000) * 1000;

  const totalPajakSetahunan = hitungPajakPasal17(pkp);
  const totalPajakBagianTahun =
    jumlahBulanAktif >= 12
      ? totalPajakSetahunan
      : floorRupiah((totalPajakSetahunan * jumlahBulanAktif) / 12);

  const multiplierIdentitas = gunakanTarifLebihTinggiIdentitas(karyawan) ? 1.2 : 1;
  const totalPajakBagianTahunFinal = floorDecimalProduct(
    totalPajakBagianTahun,
    multiplierIdentitas
  );

  const pajakMasaTerakhir = totalPajakBagianTahunFinal - totalPajakSebelumnya;
  const statusLebihBayar = pajakMasaTerakhir < 0;
  const nominalRefund = statusLebihBayar ? Math.abs(pajakMasaTerakhir) : 0;

  log.push({
    langkah: '10',
    deskripsi: 'Rekap bruto aktual selama masa kerja',
    nilai: totalBrutoAktual,
    rumus: `Bruto sebelum masa terakhir (${totalBrutoSebelumnya}) + Bruto masa terakhir (${brutoMasaTerakhirFinal})`,
  });

  log.push({
    langkah: '11',
    deskripsi: 'Menghitung biaya jabatan masa kerja',
    nilai: totalBiayaJabatan,
    rumus: `Min(5% x ${totalBrutoAktual}, ${maxBiayaJabatan})`,
  });

  log.push({
    langkah: '12',
    deskripsi: 'Menghitung penghasilan neto aktual',
    nilai: penghasilanNetoAktual,
    rumus: `Bruto Aktual (${totalBrutoAktual}) - Biaya Jabatan (${totalBiayaJabatan}) - Pengurang Pajak (${totalPengurangPajak})`,
  });

  if (jumlahBulanAktif < 12) {
    log.push({
      langkah: '13',
      deskripsi: 'Menyetahunkan neto untuk bagian tahun',
      nilai: penghasilanNetoDisetahunkan,
      rumus: `Neto Aktual (${penghasilanNetoAktual}) x 12 / ${jumlahBulanAktif}`,
    });
  } else {
    log.push({
      langkah: '13',
      deskripsi: 'Penghasilan neto penuh satu tahun',
      nilai: penghasilanNetoDisetahunkan,
      rumus: 'Tidak perlu annualized karena aktif 12 bulan',
    });
  }

  log.push({
    langkah: '14',
    deskripsi: 'Menghitung PKP setelah PTKP',
    nilai: pkp,
    rumus: `Max(0, ${penghasilanNetoDisetahunkan} - ${nominalPtkp}), lalu dibulatkan ke bawah per 1.000`,
  });

  log.push({
    langkah: '15',
    deskripsi: 'Menghitung PPh Pasal 17',
    nilai: totalPajakSetahunan,
    rumus:
      jumlahBulanAktif < 12
        ? `PPh setahunan ${totalPajakSetahunan}, lalu diprorata menjadi ${totalPajakBagianTahun}`
        : `PPh setahun penuh = ${totalPajakSetahunan}`,
  });

  if (multiplierIdentitas > 1) {
    log.push({
      langkah: '16',
      deskripsi: 'Menerapkan tarif lebih tinggi status identitas',
      nilai: totalPajakBagianTahunFinal,
      rumus: `${totalPajakBagianTahun} x 120%`,
    });
  }

  log.push({
    langkah: '17',
    deskripsi: 'Menghitung penyesuaian masa pajak terakhir',
    nilai: pajakMasaTerakhir,
    rumus: `${totalPajakBagianTahunFinal} - ${totalPajakSebelumnya}`,
  });

  return {
    totalBrutoAktual,
    totalBrutoDisetahunkan: jumlahBulanAktif >= 12 ? totalBrutoAktual : floorRupiah((totalBrutoAktual * 12) / jumlahBulanAktif),
    totalBiayaJabatan,
    totalJhtJpKaryawan:
      hasilSebelumnya.reduce(
        (sum, item) => sum + item.iuranJhtKaryawan + item.iuranJpKaryawan,
        0
      ) +
      hasilMasaTerakhirAcuan.iuranJhtKaryawan +
      hasilMasaTerakhirAcuan.iuranJpKaryawan,
    totalDplkKaryawan:
      hasilSebelumnya.reduce((sum, item) => sum + item.potonganDplkKaryawan, 0) +
      hasilMasaTerakhirAcuan.potonganDplkKaryawan,
    totalPengurangPajak,
    penghasilanNetoAktual,
    penghasilanNetoDisetahunkan,
    nominalPtkp,
    pkp,
    totalPajakSetahunan,
    totalPajakBagianTahun,
    pajakMasaTerakhir,
    statusLebihBayar,
    nominalRefund,
    logKalkulasi: log,
    totalPajakBagianTahunFinal,
  };
}

function hitungThpMasaTerakhir(
  hasilAcuan: HasilKalkulasiTetap,
  metodePajak: DataKaryawan['metodePajak'],
  tunjanganPajakGrossUp: number,
  pajakMasaTerakhir: number
): {
  totalPenghasilanCashFinal: number;
  pajakDipotongDariKaryawan: number;
  pajakDitanggungPerusahaan: number;
  refundPajak: number;
  thpBersih: number;
  statusLebihBayar: boolean;
} {
  const totalPenghasilanCashDasar =
    hasilAcuan.totalPenghasilanCash - hasilAcuan.tunjanganPajakGrossUp;
  const totalPenghasilanCashFinal =
    totalPenghasilanCashDasar + tunjanganPajakGrossUp;
  const statusLebihBayar = pajakMasaTerakhir < 0;
  const refundPajak = statusLebihBayar ? Math.abs(pajakMasaTerakhir) : 0;

  let pajakDipotongDariKaryawan = 0;
  let pajakDitanggungPerusahaan = 0;

  if (!statusLebihBayar) {
    if (metodePajak === 'NET') {
      pajakDitanggungPerusahaan = pajakMasaTerakhir;
    } else {
      pajakDipotongDariKaryawan = pajakMasaTerakhir;
    }
  }

  const thpBersih =
    totalPenghasilanCashFinal -
    hasilAcuan.totalIuranCashKaryawan -
    pajakDipotongDariKaryawan +
    refundPajak;

  return {
    totalPenghasilanCashFinal,
    pajakDipotongDariKaryawan,
    pajakDitanggungPerusahaan,
    refundPajak,
    thpBersih,
    statusLebihBayar,
  };
}

export function hitungPenyesuaianDesember(
  karyawan: DataKaryawan,
  historyInputs: InputGajiBulanan[],
  _totalPajakJanNov: number,
  config: KonfigurasiTarif
): HasilKalkulasiTetap {
  const activeInputs = [...historyInputs]
    .filter(
      (item) =>
        item.bulan >= karyawan.bulanMulai && item.bulan <= karyawan.bulanSelesai
    )
    .sort((a, b) => a.bulan - b.bulan);

  if (activeInputs.length === 0) {
    throw new Error('Tidak ada input aktif untuk masa pajak terakhir.');
  }

  const inputMasaTerakhir = activeInputs[activeInputs.length - 1];
  const inputSebelumnya = activeInputs.slice(0, -1);

  const hasilMasaTerakhirAcuan = hitungPajakBulanan(karyawan, {
    ...inputMasaTerakhir,
    konfigurasiTarif: config,
  });

  if (karyawan.residentStatus !== 'RESIDENT' || karyawan.tipeKaryawan !== 'TETAP') {
    return {
      ...hasilMasaTerakhirAcuan,
      isMasaPajakTerakhir: true,
      logKalkulasi: [
        ...hasilMasaTerakhirAcuan.logKalkulasi,
        {
          langkah: 'TAHUNAN-INFO',
          deskripsi: 'Penyesuaian tahunan dilewati',
          nilai: 'Tidak berlaku',
          rumus: 'Jalur masa terakhir tahunan hanya dipakai untuk pegawai tetap resident',
        },
      ],
    };
  }

  const log: LogAudit[] = [
    {
      langkah: '1',
      deskripsi: 'Menentukan masa pajak terakhir',
      nilai: inputMasaTerakhir.bulan,
      rumus: `Bulan aktif ${karyawan.bulanMulai} s.d. ${karyawan.bulanSelesai}`,
    },
  ];

  const hasilSebelumnya = inputSebelumnya.map((item) =>
    hitungPajakBulanan(karyawan, {
      ...item,
      konfigurasiTarif: config,
    })
  );

  const totalPajakSebelumnya = hasilSebelumnya.reduce(
    (sum, item) => sum + item.pajakTerutang,
    0
  );

  log.push({
    langkah: '2',
    deskripsi: 'Rekap pajak sebelum masa terakhir',
    nilai: totalPajakSebelumnya,
    rumus: `Jumlah bulan sebelumnya: ${hasilSebelumnya.length}`,
  });

  const isGrossUp = karyawan.metodePajak === 'GROSS_UP';
  let tunjanganPajakMasaTerakhir = isGrossUp ? 0 : 0;
  let detailTahunan!: HasilPenyesuaianTahunan & { totalPajakBagianTahunFinal: number };

  for (let iterasi = 0; iterasi < MAX_ITERASI_GROSS_UP_TAHUNAN; iterasi += 1) {
    detailTahunan = hitungPenyesuaianTahunanDetail(
      karyawan,
      hasilSebelumnya,
      hasilMasaTerakhirAcuan,
      tunjanganPajakMasaTerakhir,
      iterasi === 0 ? log : []
    );

    if (!isGrossUp) break;

    if (detailTahunan.pajakMasaTerakhir <= 0) {
      tunjanganPajakMasaTerakhir = 0;
      break;
    }

    if (Math.abs(detailTahunan.pajakMasaTerakhir - tunjanganPajakMasaTerakhir) < 1) {
      break;
    }

    tunjanganPajakMasaTerakhir = detailTahunan.pajakMasaTerakhir;
  }

  if (isGrossUp) {
    log.push({
      langkah: '18',
      deskripsi: 'Final gross-up masa terakhir',
      nilai: tunjanganPajakMasaTerakhir,
      rumus: `Gross-up akhir = pajak masa terakhir ${detailTahunan.pajakMasaTerakhir}`,
    });
  }

  const thpMasaTerakhir = hitungThpMasaTerakhir(
    hasilMasaTerakhirAcuan,
    karyawan.metodePajak,
    tunjanganPajakMasaTerakhir,
    detailTahunan.pajakMasaTerakhir
  );

  const totalBrutoDasarMasaTerakhir =
    hasilMasaTerakhirAcuan.totalBruto - hasilMasaTerakhirAcuan.tunjanganPajakGrossUp;

  log.push({
    langkah: '19',
    deskripsi: 'Menghitung THP masa terakhir',
    nilai: thpMasaTerakhir.thpBersih,
    rumus:
      `(Cash Final ${thpMasaTerakhir.totalPenghasilanCashFinal}) - ` +
      `(Potongan Cash ${hasilMasaTerakhirAcuan.totalIuranCashKaryawan}) - ` +
      `(Pajak Dipotong ${thpMasaTerakhir.pajakDipotongDariKaryawan}) + ` +
      `(Refund ${thpMasaTerakhir.refundPajak})`,
  });

  return {
    ...hasilMasaTerakhirAcuan,
    isMasaPajakTerakhir: true,
    totalPenghasilanCash: thpMasaTerakhir.totalPenghasilanCashFinal,
    tunjanganPajakGrossUp: tunjanganPajakMasaTerakhir,
    totalBruto: totalBrutoDasarMasaTerakhir + tunjanganPajakMasaTerakhir,
    kategoriTER: null,
    rateTER: null,
    pajakTerutang: Math.max(0, detailTahunan.pajakMasaTerakhir),
    penyesuaianPajak: detailTahunan.pajakMasaTerakhir,
    pajakDipotongDariKaryawan: thpMasaTerakhir.pajakDipotongDariKaryawan,
    pajakDitanggungPerusahaan: thpMasaTerakhir.pajakDitanggungPerusahaan,
    refundPajak: thpMasaTerakhir.refundPajak,
    statusLebihBayar: thpMasaTerakhir.statusLebihBayar,
    thpBersih: thpMasaTerakhir.thpBersih,
    logKalkulasi: log,
  };
}

export const hitungPenyesuaianMasaTerakhir = hitungPenyesuaianDesember;
