import { create } from 'zustand';
import {
  DataKaryawan,
  FasilitasPajak,
  HasilKalkulasiTetap,
  InputGajiBulanan,
  KonfigurasiTarif,
  MetodePajak,
  OverrideBpjsKaryawan,
  OverrideBpjsPerusahaan,
  ResidentStatus,
  StatusIdentitasPajak,
  StatusPtkp,
  TipeKaryawan,
} from '../types/payroll';
import { DEFAULT_TARIF_BPJS } from '../lib/constants';
import { hitungPajakBulanan } from '../lib/taxEngineBulanan';
import { hitungPenyesuaianDesember } from '../lib/taxEngineTahunan';
import { hitungPajakNonPegawai } from '../lib/taxEngineNonPegawai';

interface EmployeeData {
  karyawan: DataKaryawan;
  monthlyInputs: Record<number, InputGajiBulanan>;
  monthlyHasils: Record<number, HasilKalkulasiTetap>;
}

type OverrideBpjsPerusahaanUpdate = {
  premiJkk?: number | null;
  premiJkm?: number | null;
  premiJht?: number | null;
  premiBpjsKes?: number | null;
  premiJp?: number | null;
};

type OverrideBpjsKaryawanUpdate = {
  iuranJht?: number | null;
  iuranBpjsKes?: number | null;
  iuranJp?: number | null;
};

type UpdateVariablePayload = {
  bonus?: number;
  thr?: number;
  lembur?: number;
  dplk?: number;
  zakat?: number;
  gajiPokok?: number;
  tunjanganTetap?: number;
  naturaTaxable?: number;
  premiAsuransiSwastaPerusahaan?: number;
  dasarUpahBpjs?: number | null;
  overrideBpjsPerusahaan?: OverrideBpjsPerusahaanUpdate | null;
  overrideBpjsKaryawan?: OverrideBpjsKaryawanUpdate | null;
};

interface PayrollStore {
  configBpjs: KonfigurasiTarif;
  employees: Record<string, EmployeeData>;
  metodePajakGlobal: MetodePajak;

  resetStore: () => void;
  setConfigBpjs: (newConfig: Partial<KonfigurasiTarif>) => void;
  setMetodePajakGlobal: (metode: MetodePajak) => void;
  loadDefaultBpjs: () => void;
  importExcel: (rows: Record<string, unknown>[]) => void;
  updateVariable: (
    nik: string,
    bulan: number,
    updates: UpdateVariablePayload
  ) => void;
}

const PASSPORT_KEYS = [
  'No Paspor',
  'Nomor Paspor',
  'Paspor',
  'Passport',
  'No Passport',
] as const;

const FASILITAS_PAJAK_KEYS = [
  'Fasilitas Pajak',
  'Tax Certificate',
  'TaxCertificate',
] as const;

function coerceCellToString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return value
      .toLocaleString('fullwide', {
        useGrouping: false,
        maximumFractionDigits: 20,
      })
      .trim();
  }
  return String(value).trim();
}

function parseNumericCell(nilai: unknown): number {
  if (typeof nilai === 'number') {
    return Number.isFinite(nilai) ? nilai : 0;
  }

  const raw = coerceCellToString(nilai);
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') {
    return 0;
  }

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;

  if (commaCount > 0 && dotCount > 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (commaCount > 0) {
    const [whole, fraction = ''] = cleaned.split(',');
    normalized =
      commaCount > 1 || fraction.length === 3
        ? cleaned.replace(/,/g, '')
        : `${whole}.${fraction}`;
  } else if (dotCount > 0) {
    const [, fraction = ''] = cleaned.split('.');
    normalized =
      dotCount > 1 || fraction.length === 3
        ? cleaned.replace(/\./g, '')
        : cleaned;
  }

  const angka = Number(normalized);
  if (!Number.isFinite(angka)) return 0;
  return angka;
}

function floorRupiah(nilai: unknown): number {
  const angka = parseNumericCell(nilai);
  return Math.floor(angka);
}

function clampMonth(nilai: unknown, fallback: number): number {
  const angka = floorRupiah(nilai);
  if (angka < 1 || angka > 12) return fallback;
  return angka;
}

function bacaString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    const parsed = coerceCellToString(value);
    if (parsed !== '') {
      return parsed;
    }
  }
  return '';
}

function sanitizeDigits(value: unknown): string {
  return coerceCellToString(value).replace(/\D/g, '');
}

function sanitizeFixedDigits(value: unknown, length: number): string | null {
  const digits = sanitizeDigits(value);
  return digits.length === length ? digits : null;
}

function isRowEmpty(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => coerceCellToString(value) === '');
}

function parseTipeKaryawan(row: Record<string, unknown>): TipeKaryawan {
  const tipeRaw = bacaString(row, 'Tipe', 'TIPE', 'Jenis Karyawan').toUpperCase();
  if (tipeRaw.includes('NON')) return 'NON_PEGAWAI';
  return 'TETAP';
}

function parseStatusIdentitas(row: Record<string, unknown>): StatusIdentitasPajak {
  const raw = bacaString(
    row,
    'Status Identitas',
    'Status Identitas Pajak',
    'Identitas Pajak'
  ).toUpperCase();

  if (raw === 'NPWP') return 'NPWP';
  if (raw === 'NIK_VALID' || raw === 'NIK VALID') return 'NIK_VALID';
  if (raw === 'BELUM_VALID' || raw === 'BELUM VALID') return 'BELUM_VALID';
  if (raw === 'TEMP_TIN' || raw === 'TEMP TIN') return 'TEMP_TIN';

  const adaNpwpRaw = bacaString(row, 'Ada NPWP', 'NPWP').toUpperCase();
  if (adaNpwpRaw === 'YA' || adaNpwpRaw === 'TRUE') return 'NPWP';
  if (adaNpwpRaw === 'TIDAK' || adaNpwpRaw === 'FALSE') return 'BELUM_VALID';

  return 'NPWP';
}

function parseMetodePajak(
  row: Record<string, unknown>,
  fallback: MetodePajak
): MetodePajak {
  const raw = bacaString(row, 'Metode Pajak', 'Metode', 'Tax Method').toUpperCase();
  if (raw === 'NET') return 'NET';
  if (raw === 'GROSS_UP' || raw === 'GROSS UP') return 'GROSS_UP';
  if (raw === 'GROSS') return 'GROSS';
  return fallback;
}

function parseResidentStatus(row: Record<string, unknown>): ResidentStatus {
  const raw = bacaString(row, 'Resident Status', 'Status Resident').toUpperCase();
  if (raw === 'NON_RESIDENT' || raw === 'NON RESIDENT') return 'NON_RESIDENT';
  return 'RESIDENT';
}

function parseStatusPtkp(
  row: Record<string, unknown>,
  tipeKaryawan: TipeKaryawan
): StatusPtkp {
  const raw = bacaString(row, 'PTKP').toUpperCase();
  if (!raw) {
    return tipeKaryawan === 'NON_PEGAWAI' ? '-' : 'TK/0';
  }

  if (
    raw === 'TK/0' ||
    raw === 'TK/1' ||
    raw === 'TK/2' ||
    raw === 'TK/3' ||
    raw === 'K/0' ||
    raw === 'K/1' ||
    raw === 'K/2' ||
    raw === 'K/3'
  ) {
    return raw;
  }

  return tipeKaryawan === 'NON_PEGAWAI' ? '-' : 'TK/0';
}

function parseFasilitasPajak(row: Record<string, unknown>): FasilitasPajak {
  const raw = bacaString(row, ...FASILITAS_PAJAK_KEYS).toUpperCase();

  if (
    raw === 'N/A' ||
    raw === 'SKB' ||
    raw === 'DTP' ||
    raw === 'SKD' ||
    raw === 'ETC'
  ) {
    return raw;
  }

  return 'N/A';
}

function parseNoPaspor(
  row: Record<string, unknown>,
  residentStatus: ResidentStatus
): string | null {
  if (residentStatus !== 'NON_RESIDENT') {
    return null;
  }

  const raw = bacaString(row, ...PASSPORT_KEYS);
  return raw || null;
}

function buildEmptyResult(
  karyawan: DataKaryawan,
  bulan: number,
  alasan: string
): HasilKalkulasiTetap {
  return {
    metodePajak: karyawan.metodePajak,
    residentStatus: karyawan.residentStatus,
    isMasaPajakTerakhir: false,
    totalGajiTunjangan: 0,
    totalPenghasilanCash: 0,
    thrAtauBonus: 0,
    naturaTaxable: 0,
    premiAsuransiSwastaPerusahaan: 0,
    dasarUpahBpjs: 0,
    premiJkkPerusahaan: 0,
    premiJkmPerusahaan: 0,
    premiJhtPerusahaan: 0,
    premiBpjsKesPerusahaan: 0,
    premiJpPerusahaan: 0,
    tunjanganPajakGrossUp: 0,
    totalPenambahBrutoPajak: 0,
    totalBruto: 0,
    iuranJhtKaryawan: 0,
    iuranJpKaryawan: 0,
    iuranBpjsKesKaryawan: 0,
    potonganDplkKaryawan: 0,
    potonganZakat: 0,
    totalIuranCashKaryawan: 0,
    totalPengurangPajak: 0,
    kategoriTER: null,
    rateTER: null,
    pajakTerutang: 0,
    penyesuaianPajak: 0,
    pajakDipotongDariKaryawan: 0,
    pajakDitanggungPerusahaan: 0,
    refundPajak: 0,
    statusLebihBayar: false,
    thpBersih: 0,
    logKalkulasi: [
      {
        langkah: `${bulan}`,
        deskripsi: 'Bulan tidak aktif',
        nilai: 0,
        rumus: alasan,
      },
    ],
  };
}

function mapNonPegawaiResult(
  karyawan: DataKaryawan,
  input: InputGajiBulanan,
  hasil: any
): HasilKalkulasiTetap {
  const totalPendapatan =
    input.gajiPokok +
    input.tunjanganTetap +
    input.tunjanganVariabel +
    input.thrAtauBonus +
    input.naturaTaxable;

  const pajakTerutang = floorRupiah(hasil?.pajakTerutang);
  const thpBersih = floorRupiah(hasil?.thpBersih);

  return {
    metodePajak: karyawan.metodePajak,
    residentStatus: karyawan.residentStatus,
    isMasaPajakTerakhir: input.bulan === karyawan.bulanSelesai,
    totalGajiTunjangan:
      input.gajiPokok + input.tunjanganTetap + input.tunjanganVariabel,
    totalPenghasilanCash:
      input.gajiPokok +
      input.tunjanganTetap +
      input.tunjanganVariabel +
      input.thrAtauBonus,
    thrAtauBonus: input.thrAtauBonus,
    naturaTaxable: input.naturaTaxable,
    premiAsuransiSwastaPerusahaan: input.premiAsuransiSwastaPerusahaan,
    dasarUpahBpjs: 0,
    premiJkkPerusahaan: 0,
    premiJkmPerusahaan: 0,
    premiJhtPerusahaan: 0,
    premiBpjsKesPerusahaan: 0,
    premiJpPerusahaan: 0,
    tunjanganPajakGrossUp: 0,
    totalPenambahBrutoPajak:
      input.naturaTaxable + input.premiAsuransiSwastaPerusahaan,
    totalBruto: floorRupiah(hasil?.totalBruto ?? totalPendapatan),
    iuranJhtKaryawan: 0,
    iuranJpKaryawan: 0,
    iuranBpjsKesKaryawan: 0,
    potonganDplkKaryawan: 0,
    potonganZakat: 0,
    totalIuranCashKaryawan: 0,
    totalPengurangPajak: 0,
    kategoriTER: null,
    rateTER: hasil?.rateEfektif ?? null,
    pajakTerutang,
    penyesuaianPajak: pajakTerutang,
    pajakDipotongDariKaryawan: pajakTerutang,
    pajakDitanggungPerusahaan: 0,
    refundPajak: 0,
    statusLebihBayar: false,
    thpBersih,
    logKalkulasi: Array.isArray(hasil?.logKalkulasi) ? hasil.logKalkulasi : [],
  };
}

function mergeOverridePerusahaan(
  current: OverrideBpjsPerusahaan | undefined,
  update: OverrideBpjsPerusahaanUpdate | null | undefined
): OverrideBpjsPerusahaan | undefined {
  if (update === undefined) return current;
  if (update === null) return undefined;

  const next: OverrideBpjsPerusahaan = { ...(current ?? {}) };

  if ('premiJkk' in update) {
    if (update.premiJkk === null) delete next.premiJkk;
    else next.premiJkk = floorRupiah(update.premiJkk);
  }
  if ('premiJkm' in update) {
    if (update.premiJkm === null) delete next.premiJkm;
    else next.premiJkm = floorRupiah(update.premiJkm);
  }
  if ('premiJht' in update) {
    if (update.premiJht === null) delete next.premiJht;
    else next.premiJht = floorRupiah(update.premiJht);
  }
  if ('premiBpjsKes' in update) {
    if (update.premiBpjsKes === null) delete next.premiBpjsKes;
    else next.premiBpjsKes = floorRupiah(update.premiBpjsKes);
  }
  if ('premiJp' in update) {
    if (update.premiJp === null) delete next.premiJp;
    else next.premiJp = floorRupiah(update.premiJp);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function mergeOverrideKaryawan(
  current: OverrideBpjsKaryawan | undefined,
  update: OverrideBpjsKaryawanUpdate | null | undefined
): OverrideBpjsKaryawan | undefined {
  if (update === undefined) return current;
  if (update === null) return undefined;

  const next: OverrideBpjsKaryawan = { ...(current ?? {}) };

  if ('iuranJht' in update) {
    if (update.iuranJht === null) delete next.iuranJht;
    else next.iuranJht = floorRupiah(update.iuranJht);
  }
  if ('iuranBpjsKes' in update) {
    if (update.iuranBpjsKes === null) delete next.iuranBpjsKes;
    else next.iuranBpjsKes = floorRupiah(update.iuranBpjsKes);
  }
  if ('iuranJp' in update) {
    if (update.iuranJp === null) delete next.iuranJp;
    else next.iuranJp = floorRupiah(update.iuranJp);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeInputConfig(
  input: InputGajiBulanan,
  config: KonfigurasiTarif
): InputGajiBulanan {
  return {
    ...input,
    konfigurasiTarif: config,
  };
}

function calculateFullYear(
  emp: EmployeeData,
  config: KonfigurasiTarif
): Record<number, HasilKalkulasiTetap> {
  const newHasils: Record<number, HasilKalkulasiTetap> = {};
  const bulanMulai = emp.karyawan.bulanMulai;
  const bulanSelesai = emp.karyawan.bulanSelesai;
  const bulanAktif = Array.from({ length: 12 }, (_, index) => index + 1).filter(
    (bulan) => bulan >= bulanMulai && bulan <= bulanSelesai
  );

  for (let bulan = 1; bulan <= 12; bulan += 1) {
    if (bulan < bulanMulai || bulan > bulanSelesai) {
      newHasils[bulan] = buildEmptyResult(
        emp.karyawan,
        bulan,
        `Bulan ${bulan} di luar rentang aktif ${bulanMulai}-${bulanSelesai}`
      );
    }
  }

  if (bulanAktif.length === 0) {
    return newHasils;
  }

  if (emp.karyawan.tipeKaryawan === 'NON_PEGAWAI') {
    for (const bulan of bulanAktif) {
      const inp = normalizeInputConfig(emp.monthlyInputs[bulan], config);
      const totalPendapatan =
        inp.gajiPokok +
        inp.tunjanganTetap +
        inp.tunjanganVariabel +
        inp.thrAtauBonus +
        inp.naturaTaxable;

      const hasilNP = hitungPajakNonPegawai({
        totalPendapatan,
        statusIdentitas: emp.karyawan.statusIdentitas,
        residentStatus: emp.karyawan.residentStatus,
        metodePajak: emp.karyawan.metodePajak,
        adaNPWP: emp.karyawan.adaNPWP,
      } as any);

      newHasils[bulan] = mapNonPegawaiResult(emp.karyawan, inp, hasilNP);
    }

    return newHasils;
  }

  const bulanTerakhir = bulanAktif[bulanAktif.length - 1];
  let totalPajakSebelumnya = 0;

  for (const bulan of bulanAktif) {
    const inp = normalizeInputConfig(emp.monthlyInputs[bulan], config);

    if (emp.karyawan.residentStatus === 'RESIDENT' && bulan === bulanTerakhir) {
      newHasils[bulan] = hitungPenyesuaianDesember(
        emp.karyawan,
        Object.values(emp.monthlyInputs).map((item) => normalizeInputConfig(item, config)),
        totalPajakSebelumnya,
        config
      );
    } else {
      const hasil = hitungPajakBulanan(emp.karyawan, inp);
      newHasils[bulan] = hasil;
      totalPajakSebelumnya += hasil.pajakTerutang;
    }
  }

  return newHasils;
}

const EMPTY_BPJS: KonfigurasiTarif = {
  rateJkkPerusahaan: 0,
  rateJkmPerusahaan: 0,
  rateJhtPerusahaan: 0,
  rateBpjsKesPerusahaan: 0,
  rateJpPerusahaan: 0,
  rateJhtKaryawan: 0,
  rateBpjsKesKaryawan: 0,
  rateJpKaryawan: 0,
  rateDplkPerusahaan: 0,
  rateDplkKaryawan: 0,
  rateZakat: 0,
  plafonJp: 10547400,
  plafonBpjsKes: 12000000,
  basisUpahBpjs: 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP',
};

function createEmptyBpjsConfig(): KonfigurasiTarif {
  return { ...EMPTY_BPJS };
}

function createInitialStoreState() {
  return {
    configBpjs: createEmptyBpjsConfig(),
    employees: {} as Record<string, EmployeeData>,
    metodePajakGlobal: 'GROSS' as MetodePajak,
  };
}

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  ...createInitialStoreState(),

  resetStore: () => set(createInitialStoreState()),

  loadDefaultBpjs: () => get().setConfigBpjs({ ...DEFAULT_TARIF_BPJS }),

  setMetodePajakGlobal: (metode) =>
    set((state) => {
      const updatedEmployees = Object.fromEntries(
        Object.entries(state.employees).map(([nik, emp]) => {
          const updatedEmp: EmployeeData = {
            ...emp,
            karyawan: {
              ...emp.karyawan,
              metodePajak: metode,
            },
          };

          return [nik, { ...updatedEmp, monthlyHasils: calculateFullYear(updatedEmp, state.configBpjs) }];
        })
      );

      return {
        metodePajakGlobal: metode,
        employees: updatedEmployees,
      };
    }),

  setConfigBpjs: (newConfig) =>
    set((state) => {
      const updatedConfig = { ...state.configBpjs, ...newConfig };
      const updatedEmployees = Object.fromEntries(
        Object.entries(state.employees).map(([nik, emp]) => {
          const monthlyInputs = Object.fromEntries(
            Object.entries(emp.monthlyInputs).map(([bulan, input]) => [
              Number(bulan),
              {
                ...input,
                konfigurasiTarif: updatedConfig,
              },
            ])
          ) as Record<number, InputGajiBulanan>;

          const updatedEmp: EmployeeData = {
            ...emp,
            monthlyInputs,
          };

          return [nik, { ...updatedEmp, monthlyHasils: calculateFullYear(updatedEmp, updatedConfig) }];
        })
      );

      return {
        configBpjs: updatedConfig,
        employees: updatedEmployees,
      };
    }),

  importExcel: (rows) =>
    set((state) => {
      const newEmployees: Record<string, EmployeeData> = {};
      const validationErrors: string[] = [];

      rows.forEach((row, index) => {
        const excelRowNumber = index + 2;
        if (isRowEmpty(row)) return;

        const rawNik = bacaString(row, 'NIK', 'Nik');
        const nik = sanitizeFixedDigits(rawNik, 16);
        if (!rawNik) {
          validationErrors.push(`Baris ${excelRowNumber}: NIK wajib diisi.`);
          return;
        }
        if (!nik) {
          validationErrors.push(
            `Baris ${excelRowNumber}: NIK harus tepat 16 digit angka.`
          );
          return;
        }

        const tipeKaryawan = parseTipeKaryawan(row);
        const statusIdentitas = parseStatusIdentitas(row);
        const metodePajak = parseMetodePajak(row, state.metodePajakGlobal);
        const residentStatus = parseResidentStatus(row);
        const counterpartTinRaw = bacaString(row, 'Counterpart TIN', 'CounterpartTin');
        const counterpartTin = counterpartTinRaw
          ? sanitizeFixedDigits(counterpartTinRaw, 16)
          : nik;
        if (counterpartTinRaw && !counterpartTin) {
          validationErrors.push(
            `Baris ${excelRowNumber}: Counterpart TIN harus tepat 16 digit angka.`
          );
          return;
        }

        const bulanMulai = clampMonth(row['Bln Mulai'], 1);
        const bulanSelesai = clampMonth(row['Bln Selesai'], 12);
        const bulanSelesaiFinal = bulanSelesai < bulanMulai ? bulanMulai : bulanSelesai;

        const tunjanganTetapUmum = floorRupiah(row['Tunjangan Tetap']);
        const tunjanganRincian =
          floorRupiah(row['Tunjangan Jabatan']) +
          floorRupiah(row['Tunj Transport']) +
          floorRupiah(row['Tunjangan Makan']);
        const totalTunjanganTetap = tunjanganTetapUmum + tunjanganRincian;

        const karyawan: DataKaryawan = {
          idKaryawan: nik,
          nik,
          namaLengkap: bacaString(row, 'Nama') || 'Tanpa Nama',
          statusPtkp: parseStatusPtkp(row, tipeKaryawan),
          statusIdentitas,
          metodePajak,
          residentStatus,
          tipeKaryawan,
          bulanMulai,
          bulanSelesai: bulanSelesaiFinal,
          jabatan: bacaString(row, 'Jabatan') || undefined,
          counterpartTin: counterpartTin ?? nik,
          temporaryTin: bacaString(row, 'Temporary TIN') || undefined,
          noPaspor: parseNoPaspor(row, residentStatus),
          fasilitasPajak: parseFasilitasPajak(row),
          adaNPWP: statusIdentitas === 'NPWP' || statusIdentitas === 'NIK_VALID',
        };

        const monthlyInputs: Record<number, InputGajiBulanan> = {};

        for (let bulan = 1; bulan <= 12; bulan += 1) {
          monthlyInputs[bulan] = {
            bulan,
            gajiPokok: floorRupiah(row['Gaji Pokok']),
            tunjanganTetap: totalTunjanganTetap,
            tunjanganVariabel: 0,
            thrAtauBonus: 0,
            naturaTaxable: floorRupiah(row['Natura'] ?? row['Natura Taxable']),
            premiAsuransiSwastaPerusahaan: floorRupiah(
              row['Premi Asuransi Swasta Perusahaan']
            ),
            dplkPerusahaan: floorRupiah(row['DPLK Perusahaan']),
            dplkKaryawan: floorRupiah(row['DPLK Karyawan']),
            zakat: 0,
            dasarUpahBpjs:
              row['Dasar Upah BPJS'] !== undefined && row['Dasar Upah BPJS'] !== null
                ? floorRupiah(row['Dasar Upah BPJS'])
                : undefined,
            overrideBpjsPerusahaan: undefined,
            overrideBpjsKaryawan: undefined,
            originalTunjangan: totalTunjanganTetap,
            isOverridden: false,
            konfigurasiTarif: state.configBpjs,
          };
        }

        const empTemplate: EmployeeData = {
          karyawan,
          monthlyInputs,
          monthlyHasils: {} as Record<number, HasilKalkulasiTetap>,
        };

        empTemplate.monthlyHasils = calculateFullYear(empTemplate, state.configBpjs);
        newEmployees[nik] = empTemplate;
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      return { employees: newEmployees };
    }),

  updateVariable: (nik, bulan, updates) =>
    set((state) => {
      const emp = state.employees[nik];
      if (!emp) return state;

      const currentInput = emp.monthlyInputs[bulan];
      if (!currentInput) return state;

      const hasBonusOrThrUpdate =
        updates.bonus !== undefined || updates.thr !== undefined;
      const newThrAtauBonus = hasBonusOrThrUpdate
        ? floorRupiah(updates.bonus) + floorRupiah(updates.thr)
        : currentInput.thrAtauBonus;

      const newInput: InputGajiBulanan = {
        ...currentInput,
        gajiPokok:
          updates.gajiPokok !== undefined
            ? floorRupiah(updates.gajiPokok)
            : currentInput.gajiPokok,
        tunjanganTetap:
          updates.tunjanganTetap !== undefined
            ? floorRupiah(updates.tunjanganTetap)
            : currentInput.tunjanganTetap,
        tunjanganVariabel:
          updates.lembur !== undefined
            ? floorRupiah(updates.lembur)
            : currentInput.tunjanganVariabel,
        thrAtauBonus: newThrAtauBonus,
        naturaTaxable:
          updates.naturaTaxable !== undefined
            ? floorRupiah(updates.naturaTaxable)
            : currentInput.naturaTaxable,
        premiAsuransiSwastaPerusahaan:
          updates.premiAsuransiSwastaPerusahaan !== undefined
            ? floorRupiah(updates.premiAsuransiSwastaPerusahaan)
            : currentInput.premiAsuransiSwastaPerusahaan,
        dplkKaryawan:
          updates.dplk !== undefined
            ? floorRupiah(updates.dplk)
            : currentInput.dplkKaryawan,
        zakat:
          updates.zakat !== undefined
            ? floorRupiah(updates.zakat)
            : currentInput.zakat,
        dasarUpahBpjs:
          updates.dasarUpahBpjs === undefined
            ? currentInput.dasarUpahBpjs
            : updates.dasarUpahBpjs === null
              ? undefined
              : floorRupiah(updates.dasarUpahBpjs),
        overrideBpjsPerusahaan: mergeOverridePerusahaan(
          currentInput.overrideBpjsPerusahaan,
          updates.overrideBpjsPerusahaan
        ),
        overrideBpjsKaryawan: mergeOverrideKaryawan(
          currentInput.overrideBpjsKaryawan,
          updates.overrideBpjsKaryawan
        ),
        isOverridden:
          currentInput.isOverridden ||
          updates.gajiPokok !== undefined ||
          updates.tunjanganTetap !== undefined ||
          updates.lembur !== undefined ||
          updates.bonus !== undefined ||
          updates.thr !== undefined ||
          updates.dplk !== undefined ||
          updates.zakat !== undefined ||
          updates.naturaTaxable !== undefined ||
          updates.premiAsuransiSwastaPerusahaan !== undefined ||
          updates.dasarUpahBpjs !== undefined ||
          updates.overrideBpjsPerusahaan !== undefined ||
          updates.overrideBpjsKaryawan !== undefined,
        originalTunjangan: currentInput.originalTunjangan,
      };

      const updatedInputs: Record<number, InputGajiBulanan> = {
        ...emp.monthlyInputs,
        [bulan]: newInput,
      };
      const updatedEmp: EmployeeData = {
        ...emp,
        monthlyInputs: updatedInputs,
      };

      return {
        employees: {
          ...state.employees,
          [nik]: {
            ...updatedEmp,
            monthlyHasils: calculateFullYear(updatedEmp, state.configBpjs),
          },
        },
      };
    }),
}));
