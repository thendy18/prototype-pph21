import {
  BasisUpahBpjs,
  KomponenBpjsKaryawan,
  KomponenBpjsPerusahaan,
  KonfigurasiTarif,
  OverrideBpjsKaryawan,
  OverrideBpjsPerusahaan,
} from '../types/payroll';
import { DEFAULT_TARIF_BPJS } from './constants';

export interface ParameterHitungBpjs {
  gajiPokok: number;
  tunjanganTetap?: number;
  dasarUpahBpjs?: number;
  konfigurasiTarif?: KonfigurasiTarif;
  overrideBpjsPerusahaan?: OverrideBpjsPerusahaan;
  overrideBpjsKaryawan?: OverrideBpjsKaryawan;
}

export interface HasilBpjsPerusahaan extends KomponenBpjsPerusahaan {
  dasarUpahBpjs: number;
  dasarBpjsKes: number;
  dasarJp: number;
  totalPenambahBrutoPajak: number;
  totalDicatatPerusahaan: number;

  // Alias legacy agar caller lama tidak langsung rusak.
  totalPremi: number;
}

export interface HasilBpjsKaryawan extends KomponenBpjsKaryawan {
  dasarUpahBpjs: number;
  dasarBpjsKes: number;
  dasarJp: number;
  totalPengurangPajak: number;
  totalPotonganCash: number;

  // Alias legacy agar caller lama tidak langsung rusak.
  totalIuran: number;
}

export interface HasilBpjsLengkap {
  perusahaan: HasilBpjsPerusahaan;
  karyawan: HasilBpjsKaryawan;
}

function floorRupiah(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.max(0, Math.floor(nilai));
}

function ambilNominalOverride(
  overrideValue: number | undefined,
  hasilNormal: number
): number {
  if (overrideValue === undefined) return hasilNormal;
  return floorRupiah(overrideValue);
}

function tentukanBasisUpah(
  basis: BasisUpahBpjs | undefined
): BasisUpahBpjs {
  return basis ?? 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP';
}

function tentukanDasarUpahBpjsDariInput(
  input: ParameterHitungBpjs,
  config: KonfigurasiTarif
): number {
  if (input.dasarUpahBpjs !== undefined) {
    return floorRupiah(input.dasarUpahBpjs);
  }

  const basis = tentukanBasisUpah(config.basisUpahBpjs);
  if (basis === 'GAJI_POKOK') {
    return floorRupiah(input.gajiPokok);
  }

  return floorRupiah(input.gajiPokok + (input.tunjanganTetap ?? 0));
}

function normalisasiInput(
  input: number | ParameterHitungBpjs,
  config: KonfigurasiTarif
): Required<
  Pick<
    ParameterHitungBpjs,
    'gajiPokok' | 'tunjanganTetap' | 'overrideBpjsPerusahaan' | 'overrideBpjsKaryawan'
  >
> & {
  konfigurasiTarif: KonfigurasiTarif;
  dasarUpahBpjs: number;
} {
  if (typeof input === 'number') {
    return {
      gajiPokok: floorRupiah(input),
      tunjanganTetap: 0,
      overrideBpjsPerusahaan: {},
      overrideBpjsKaryawan: {},
      konfigurasiTarif: config,
      dasarUpahBpjs: floorRupiah(input),
    };
  }

  const konfigurasiTarif = input.konfigurasiTarif ?? config;
  return {
    gajiPokok: floorRupiah(input.gajiPokok),
    tunjanganTetap: floorRupiah(input.tunjanganTetap ?? 0),
    overrideBpjsPerusahaan: input.overrideBpjsPerusahaan ?? {},
    overrideBpjsKaryawan: input.overrideBpjsKaryawan ?? {},
    konfigurasiTarif,
    dasarUpahBpjs: tentukanDasarUpahBpjsDariInput(input, konfigurasiTarif),
  };
}

function hitungKomponenPerusahaanInternal(
  dasarUpahBpjs: number,
  config: KonfigurasiTarif,
  overrideBpjsPerusahaan: OverrideBpjsPerusahaan
): HasilBpjsPerusahaan {
  const dasarBpjsKes = Math.min(dasarUpahBpjs, config.plafonBpjsKes);
  const dasarJp = Math.min(dasarUpahBpjs, config.plafonJp);

  const premiJkk = ambilNominalOverride(
    overrideBpjsPerusahaan.premiJkk,
    floorRupiah(dasarUpahBpjs * config.rateJkkPerusahaan)
  );
  const premiJkm = ambilNominalOverride(
    overrideBpjsPerusahaan.premiJkm,
    floorRupiah(dasarUpahBpjs * config.rateJkmPerusahaan)
  );
  const premiJht = ambilNominalOverride(
    overrideBpjsPerusahaan.premiJht,
    floorRupiah(dasarUpahBpjs * config.rateJhtPerusahaan)
  );
  const premiBpjsKes = ambilNominalOverride(
    overrideBpjsPerusahaan.premiBpjsKes,
    floorRupiah(dasarBpjsKes * config.rateBpjsKesPerusahaan)
  );
  const premiJp = ambilNominalOverride(
    overrideBpjsPerusahaan.premiJp,
    floorRupiah(dasarJp * config.rateJpPerusahaan)
  );

  const totalPenambahBrutoPajak = premiJkk + premiJkm + premiBpjsKes;
  const totalDicatatPerusahaan =
    premiJkk + premiJkm + premiJht + premiBpjsKes + premiJp;

  return {
    dasarUpahBpjs,
    dasarBpjsKes,
    dasarJp,
    premiJkk,
    premiJkm,
    premiJht,
    premiBpjsKes,
    premiJp,
    totalPenambahBrutoPajak,
    totalDicatatPerusahaan,
    totalPremi: totalPenambahBrutoPajak,
  };
}

function hitungKomponenKaryawanInternal(
  dasarUpahBpjs: number,
  config: KonfigurasiTarif,
  overrideBpjsKaryawan: OverrideBpjsKaryawan
): HasilBpjsKaryawan {
  const dasarBpjsKes = Math.min(dasarUpahBpjs, config.plafonBpjsKes);
  const dasarJp = Math.min(dasarUpahBpjs, config.plafonJp);

  const iuranJht = ambilNominalOverride(
    overrideBpjsKaryawan.iuranJht,
    floorRupiah(dasarUpahBpjs * config.rateJhtKaryawan)
  );
  const iuranBpjsKes = ambilNominalOverride(
    overrideBpjsKaryawan.iuranBpjsKes,
    floorRupiah(dasarBpjsKes * config.rateBpjsKesKaryawan)
  );
  const iuranJp = ambilNominalOverride(
    overrideBpjsKaryawan.iuranJp,
    floorRupiah(dasarJp * config.rateJpKaryawan)
  );

  const totalPengurangPajak = iuranJht + iuranJp;
  const totalPotonganCash = iuranJht + iuranBpjsKes + iuranJp;

  return {
    dasarUpahBpjs,
    dasarBpjsKes,
    dasarJp,
    iuranJht,
    iuranBpjsKes,
    iuranJp,
    totalPengurangPajak,
    totalPotonganCash,
    totalIuran: totalPotonganCash,
  };
}

export function tentukanDasarUpahBpjs(
  input: number | ParameterHitungBpjs,
  config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): number {
  return normalisasiInput(input, config).dasarUpahBpjs;
}

export function hitungKomponenBpjs(
  input: number | ParameterHitungBpjs,
  config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): HasilBpjsLengkap {
  const normalized = normalisasiInput(input, config);

  return {
    perusahaan: hitungKomponenPerusahaanInternal(
      normalized.dasarUpahBpjs,
      normalized.konfigurasiTarif,
      normalized.overrideBpjsPerusahaan
    ),
    karyawan: hitungKomponenKaryawanInternal(
      normalized.dasarUpahBpjs,
      normalized.konfigurasiTarif,
      normalized.overrideBpjsKaryawan
    ),
  };
}

// ============================================================================
// FUNGSI LEGACY: tetap dipertahankan agar file engine lama masih bisa jalan
// sambil migrasi ke API baru yang berbasis object.
// ============================================================================
export function hitungBpjsPerusahaan(
  input: number | ParameterHitungBpjs,
  config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): HasilBpjsPerusahaan {
  return hitungKomponenBpjs(input, config).perusahaan;
}

export function hitungBpjsKaryawan(
  input: number | ParameterHitungBpjs,
  config: KonfigurasiTarif = DEFAULT_TARIF_BPJS
): HasilBpjsKaryawan {
  return hitungKomponenBpjs(input, config).karyawan;
}