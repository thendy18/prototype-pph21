import {
  DataKaryawan,
  HasilKalkulasiTetap,
  InputGajiBulanan,
  MetodePajak,
} from './payroll';

export type SlipGajiLineCategory =
  | 'penerimaan'
  | 'potongan'
  | 'informational';

export interface SlipGajiLineItem {
  label: string;
  amount: number;
  category: SlipGajiLineCategory;
  affectsTakeHome: boolean;
}

export interface SlipGajiSource {
  namaPerusahaan: string;
  bulan: number;
  tahun: number;
  karyawan: DataKaryawan;
  input: InputGajiBulanan;
  hasil: HasilKalkulasiTetap;
}

export interface SlipGajiPayload {
  companyName: string;
  period: {
    month: number;
    year: number;
    label: string;
  };
  employee: {
    employeeId: string;
    nik: string;
    nama: string;
    jabatan: string;
    cabang: string;
    divisi: string;
    metodePajak: MetodePajak;
    residentStatus: DataKaryawan['residentStatus'];
    statusIdentitas: DataKaryawan['statusIdentitas'];
  };
  penerimaan: SlipGajiLineItem[];
  potongan: SlipGajiLineItem[];
  informational: SlipGajiLineItem[];
  totals: {
    totalPenerimaan: number;
    totalPotongan: number;
    thp: number;
  };
}
