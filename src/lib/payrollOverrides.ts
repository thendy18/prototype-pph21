import {
  InputGajiBulanan,
  LogAudit,
  NominalOverrideKey,
  NominalOverrideMap,
  OverrideBpjsKaryawan,
  OverrideBpjsPerusahaan,
  TipeKaryawan,
} from '../types/payroll';
import { hitungKomponenBpjs } from './bpjsCalculator';

type DirectOverrideKey =
  | 'gajiPokok'
  | 'tunjanganTetap'
  | 'tunjanganVariabel'
  | 'thrAtauBonus'
  | 'naturaTaxable'
  | 'premiAsuransiSwastaPerusahaan'
  | 'dplkPerusahaan'
  | 'dplkKaryawan'
  | 'zakat'
  | 'dasarUpahBpjs';

type OverrideGroup =
  | 'Penghasilan Dasar'
  | 'Penambah Bruto'
  | 'Potongan Personal'
  | 'BPJS Perusahaan'
  | 'BPJS Karyawan';

type OverrideScope = 'ALL' | 'TETAP_ONLY' | 'NON_PEGAWAI_ONLY';

type RowDefinition = {
  key: NominalOverrideKey;
  label: string;
  group: OverrideGroup;
  scope: OverrideScope;
};

export interface NominalOverridePreviewRow {
  key: NominalOverrideKey;
  label: string;
  group: OverrideGroup;
  originalValue: number;
  overrideValue?: number;
  finalValue: number;
}

const COMPANY_BPJS_KEYS = {
  premiJkkPerusahaan: 'premiJkk',
  premiJkmPerusahaan: 'premiJkm',
  premiJhtPerusahaan: 'premiJht',
  premiBpjsKesPerusahaan: 'premiBpjsKes',
  premiJpPerusahaan: 'premiJp',
} as const satisfies Record<
  | 'premiJkkPerusahaan'
  | 'premiJkmPerusahaan'
  | 'premiJhtPerusahaan'
  | 'premiBpjsKesPerusahaan'
  | 'premiJpPerusahaan',
  keyof OverrideBpjsPerusahaan
>;

const EMPLOYEE_BPJS_KEYS = {
  iuranJhtKaryawan: 'iuranJht',
  iuranBpjsKesKaryawan: 'iuranBpjsKes',
  iuranJpKaryawan: 'iuranJp',
} as const satisfies Record<
  'iuranJhtKaryawan' | 'iuranBpjsKesKaryawan' | 'iuranJpKaryawan',
  keyof OverrideBpjsKaryawan
>;

const ROW_DEFINITIONS: readonly RowDefinition[] = [
  { key: 'gajiPokok', label: 'Gaji Pokok', group: 'Penghasilan Dasar', scope: 'ALL' },
  { key: 'tunjanganTetap', label: 'Tunjangan Tetap', group: 'Penghasilan Dasar', scope: 'ALL' },
  { key: 'tunjanganVariabel', label: 'Lembur / Variabel', group: 'Penghasilan Dasar', scope: 'ALL' },
  { key: 'thrAtauBonus', label: 'THR / Bonus', group: 'Penghasilan Dasar', scope: 'ALL' },
  { key: 'naturaTaxable', label: 'Natura Taxable', group: 'Penambah Bruto', scope: 'ALL' },
  {
    key: 'premiAsuransiSwastaPerusahaan',
    label: 'Premi Asuransi Swasta Perusahaan',
    group: 'Penambah Bruto',
    scope: 'ALL',
  },
  { key: 'dplkPerusahaan', label: 'DPLK Perusahaan', group: 'Potongan Personal', scope: 'TETAP_ONLY' },
  { key: 'dplkKaryawan', label: 'DPLK Karyawan', group: 'Potongan Personal', scope: 'TETAP_ONLY' },
  { key: 'zakat', label: 'Zakat', group: 'Potongan Personal', scope: 'TETAP_ONLY' },
  { key: 'dasarUpahBpjs', label: 'Dasar Upah BPJS', group: 'BPJS Perusahaan', scope: 'TETAP_ONLY' },
  { key: 'premiJkkPerusahaan', label: 'JKK Perusahaan', group: 'BPJS Perusahaan', scope: 'TETAP_ONLY' },
  { key: 'premiJkmPerusahaan', label: 'JKM Perusahaan', group: 'BPJS Perusahaan', scope: 'TETAP_ONLY' },
  { key: 'premiJhtPerusahaan', label: 'JHT Perusahaan', group: 'BPJS Perusahaan', scope: 'TETAP_ONLY' },
  {
    key: 'premiBpjsKesPerusahaan',
    label: 'BPJS Kesehatan Perusahaan',
    group: 'BPJS Perusahaan',
    scope: 'TETAP_ONLY',
  },
  { key: 'premiJpPerusahaan', label: 'JP Perusahaan', group: 'BPJS Perusahaan', scope: 'TETAP_ONLY' },
  { key: 'iuranJhtKaryawan', label: 'JHT Karyawan', group: 'BPJS Karyawan', scope: 'TETAP_ONLY' },
  {
    key: 'iuranBpjsKesKaryawan',
    label: 'BPJS Kesehatan Karyawan',
    group: 'BPJS Karyawan',
    scope: 'TETAP_ONLY',
  },
  { key: 'iuranJpKaryawan', label: 'JP Karyawan', group: 'BPJS Karyawan', scope: 'TETAP_ONLY' },
] as const;

function floorRupiah(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.floor(nilai);
}

function shouldIncludeRow(scope: OverrideScope, tipeKaryawan: TipeKaryawan): boolean {
  if (scope === 'ALL') return true;
  if (scope === 'TETAP_ONLY') return tipeKaryawan === 'TETAP';
  return tipeKaryawan === 'NON_PEGAWAI';
}

function getDirectOverrideValue(
  input: InputGajiBulanan,
  key: DirectOverrideKey
): number | undefined {
  return input.nominalOverrides?.[key];
}

export function normalizeNominalOverrideValue(
  nilai: number | null | undefined
): number | undefined {
  if (nilai === null || nilai === undefined || !Number.isFinite(nilai)) {
    return undefined;
  }
  return floorRupiah(nilai);
}

export function getNominalOverrideValue(
  input: InputGajiBulanan,
  key: NominalOverrideKey
): number | undefined {
  const fromMap = input.nominalOverrides?.[key];
  if (fromMap !== undefined) return fromMap;

  if (key in COMPANY_BPJS_KEYS) {
    const legacyKey = COMPANY_BPJS_KEYS[key as keyof typeof COMPANY_BPJS_KEYS];
    return input.overrideBpjsPerusahaan?.[legacyKey];
  }

  if (key in EMPLOYEE_BPJS_KEYS) {
    const legacyKey = EMPLOYEE_BPJS_KEYS[key as keyof typeof EMPLOYEE_BPJS_KEYS];
    return input.overrideBpjsKaryawan?.[legacyKey];
  }

  return undefined;
}

function setDirectEffectiveValue(
  input: InputGajiBulanan,
  key: DirectOverrideKey
): number {
  const overrideValue = getDirectOverrideValue(input, key);
  if (overrideValue !== undefined) {
    return overrideValue;
  }

  const current = input[key];
  if (current === undefined) return 0;
  return floorRupiah(current);
}

function buildCompanyBpjsOverrides(input: InputGajiBulanan): OverrideBpjsPerusahaan | undefined {
  const merged: OverrideBpjsPerusahaan = {
    ...(input.overrideBpjsPerusahaan ?? {}),
  };

  for (const [overrideKey, bpjsKey] of Object.entries(COMPANY_BPJS_KEYS)) {
    const value = getNominalOverrideValue(
      input,
      overrideKey as keyof typeof COMPANY_BPJS_KEYS
    );
    if (value !== undefined) {
      merged[bpjsKey] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function buildEmployeeBpjsOverrides(input: InputGajiBulanan): OverrideBpjsKaryawan | undefined {
  const merged: OverrideBpjsKaryawan = {
    ...(input.overrideBpjsKaryawan ?? {}),
  };

  for (const [overrideKey, bpjsKey] of Object.entries(EMPLOYEE_BPJS_KEYS)) {
    const value = getNominalOverrideValue(
      input,
      overrideKey as keyof typeof EMPLOYEE_BPJS_KEYS
    );
    if (value !== undefined) {
      merged[bpjsKey] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function applyNominalOverrides(input: InputGajiBulanan): InputGajiBulanan {
  return {
    ...input,
    gajiPokok: setDirectEffectiveValue(input, 'gajiPokok'),
    tunjanganTetap: setDirectEffectiveValue(input, 'tunjanganTetap'),
    tunjanganVariabel: setDirectEffectiveValue(input, 'tunjanganVariabel'),
    thrAtauBonus: setDirectEffectiveValue(input, 'thrAtauBonus'),
    naturaTaxable: setDirectEffectiveValue(input, 'naturaTaxable'),
    premiAsuransiSwastaPerusahaan: setDirectEffectiveValue(
      input,
      'premiAsuransiSwastaPerusahaan'
    ),
    dplkPerusahaan: setDirectEffectiveValue(input, 'dplkPerusahaan'),
    dplkKaryawan: setDirectEffectiveValue(input, 'dplkKaryawan'),
    zakat: setDirectEffectiveValue(input, 'zakat'),
    dasarUpahBpjs:
      getDirectOverrideValue(input, 'dasarUpahBpjs') ??
      (input.dasarUpahBpjs !== undefined
        ? floorRupiah(input.dasarUpahBpjs)
        : undefined),
    overrideBpjsPerusahaan: buildCompanyBpjsOverrides(input),
    overrideBpjsKaryawan: buildEmployeeBpjsOverrides(input),
  };
}

export function updateNominalOverrides(
  current: NominalOverrideMap | undefined,
  key: NominalOverrideKey,
  nilai: number | null | undefined
): NominalOverrideMap | undefined {
  const next = { ...(current ?? {}) };
  const normalized = normalizeNominalOverrideValue(nilai);

  if (normalized === undefined) {
    delete next[key];
  } else {
    next[key] = normalized;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function clearLegacyBpjsOverride(
  input: InputGajiBulanan,
  key: NominalOverrideKey
): Pick<InputGajiBulanan, 'overrideBpjsPerusahaan' | 'overrideBpjsKaryawan'> {
  if (key in COMPANY_BPJS_KEYS) {
    const legacyKey = COMPANY_BPJS_KEYS[key as keyof typeof COMPANY_BPJS_KEYS];
    const next = { ...(input.overrideBpjsPerusahaan ?? {}) };
    delete next[legacyKey];
    return {
      overrideBpjsPerusahaan: Object.keys(next).length > 0 ? next : undefined,
      overrideBpjsKaryawan: input.overrideBpjsKaryawan,
    };
  }

  if (key in EMPLOYEE_BPJS_KEYS) {
    const legacyKey = EMPLOYEE_BPJS_KEYS[key as keyof typeof EMPLOYEE_BPJS_KEYS];
    const next = { ...(input.overrideBpjsKaryawan ?? {}) };
    delete next[legacyKey];
    return {
      overrideBpjsPerusahaan: input.overrideBpjsPerusahaan,
      overrideBpjsKaryawan: Object.keys(next).length > 0 ? next : undefined,
    };
  }

  return {
    overrideBpjsPerusahaan: input.overrideBpjsPerusahaan,
    overrideBpjsKaryawan: input.overrideBpjsKaryawan,
  };
}

export function buildNominalOverridePreviewRows(
  input: InputGajiBulanan,
  tipeKaryawan: TipeKaryawan
): NominalOverridePreviewRow[] {
  const effectiveInput = applyNominalOverrides(input);
  const autoBpjs = hitungKomponenBpjs({
    ...effectiveInput,
    overrideBpjsPerusahaan: undefined,
    overrideBpjsKaryawan: undefined,
  });
  const autoBasisOnly = hitungKomponenBpjs({
    ...effectiveInput,
    dasarUpahBpjs: undefined,
    overrideBpjsPerusahaan: undefined,
    overrideBpjsKaryawan: undefined,
  });
  const finalBpjs = hitungKomponenBpjs(effectiveInput);

  return ROW_DEFINITIONS.filter((row) => shouldIncludeRow(row.scope, tipeKaryawan)).map(
    (row) => {
      const overrideValue = getNominalOverrideValue(input, row.key);

      if (row.key === 'dasarUpahBpjs') {
        return {
          ...row,
          overrideValue,
          originalValue: autoBasisOnly.perusahaan.dasarUpahBpjs,
          finalValue: finalBpjs.perusahaan.dasarUpahBpjs,
        };
      }

      if (row.key in COMPANY_BPJS_KEYS) {
        const autoMap = {
          premiJkkPerusahaan: autoBpjs.perusahaan.premiJkk,
          premiJkmPerusahaan: autoBpjs.perusahaan.premiJkm,
          premiJhtPerusahaan: autoBpjs.perusahaan.premiJht,
          premiBpjsKesPerusahaan: autoBpjs.perusahaan.premiBpjsKes,
          premiJpPerusahaan: autoBpjs.perusahaan.premiJp,
        } as const;

        const finalMap = {
          premiJkkPerusahaan: finalBpjs.perusahaan.premiJkk,
          premiJkmPerusahaan: finalBpjs.perusahaan.premiJkm,
          premiJhtPerusahaan: finalBpjs.perusahaan.premiJht,
          premiBpjsKesPerusahaan: finalBpjs.perusahaan.premiBpjsKes,
          premiJpPerusahaan: finalBpjs.perusahaan.premiJp,
        } as const;

        return {
          ...row,
          overrideValue,
          originalValue: autoMap[row.key as keyof typeof autoMap],
          finalValue: finalMap[row.key as keyof typeof finalMap],
        };
      }

      if (row.key in EMPLOYEE_BPJS_KEYS) {
        const autoMap = {
          iuranJhtKaryawan: autoBpjs.karyawan.iuranJht,
          iuranBpjsKesKaryawan: autoBpjs.karyawan.iuranBpjsKes,
          iuranJpKaryawan: autoBpjs.karyawan.iuranJp,
        } as const;

        const finalMap = {
          iuranJhtKaryawan: finalBpjs.karyawan.iuranJht,
          iuranBpjsKesKaryawan: finalBpjs.karyawan.iuranBpjsKes,
          iuranJpKaryawan: finalBpjs.karyawan.iuranJp,
        } as const;

        return {
          ...row,
          overrideValue,
          originalValue: autoMap[row.key as keyof typeof autoMap],
          finalValue: finalMap[row.key as keyof typeof finalMap],
        };
      }

      const directKey = row.key as DirectOverrideKey;
      return {
        ...row,
        overrideValue,
        originalValue:
          input[directKey] !== undefined ? floorRupiah(input[directKey] ?? 0) : 0,
        finalValue:
          effectiveInput[directKey] !== undefined
            ? floorRupiah(effectiveInput[directKey] ?? 0)
            : 0,
      };
    }
  );
}

export function buildNominalOverrideAuditLogs(
  input: InputGajiBulanan,
  tipeKaryawan: TipeKaryawan
): LogAudit[] {
  return buildNominalOverridePreviewRows(input, tipeKaryawan)
    .filter((row) => row.overrideValue !== undefined)
    .map((row, index) => ({
      langkah: `OVR-${index + 1}`,
      deskripsi: `Menggunakan override nominal untuk ${row.label}`,
      nilai: row.finalValue,
      rumus: `Nilai asli/otomatis ${row.originalValue}, override manual ${row.overrideValue}, nilai dipakai ${row.finalValue}`,
    }));
}

export function hasNominalOverride(input: InputGajiBulanan): boolean {
  return buildNominalOverridePreviewRows(input, 'TETAP').some(
    (row) => row.overrideValue !== undefined
  );
}
