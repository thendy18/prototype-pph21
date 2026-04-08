import { create } from 'zustand';
import { 
  DataKaryawan, 
  InputGajiBulanan, 
  HasilKalkulasiTetap, 
  KonfigurasiTarif 
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

interface PayrollStore {
  configBpjs: KonfigurasiTarif;
  employees: Record<string, EmployeeData>;
  metodePajakGlobal: 'GROSS' | 'GROSS_UP';
  
  setConfigBpjs: (newConfig: Partial<KonfigurasiTarif>) => void;
  setMetodePajakGlobal: (metode: 'GROSS' | 'GROSS_UP') => void;
  loadDefaultBpjs: () => void;
  importExcel: (rows: any[]) => void;
  updateVariable: (
    nik: string, 
    bulan: number, 
    updates: { 
      bonus?: number; 
      thr?: number; 
      lembur?: number;
      dplk?: number; 
      zakat?: number;
      gajiPokok?: number;
      tunjanganTetap?: number;
    }
  ) => void;
}

// Helper Internal: Hitung ulang 12 bulan untuk satu karyawan
const calculateFullYear = (emp: EmployeeData, config: KonfigurasiTarif) => {
  const newHasils: Record<number, HasilKalkulasiTetap> = {};
  
  // =================================================================
  // JALUR 1: LOGIKA NON-PEGAWAI
  // =================================================================
  if (emp.karyawan.tipeKaryawan === 'NON_PEGAWAI') {
    for (let m = 1; m <= 12; m++) {
      const inp = emp.monthlyInputs[m];
      const totalPendapatan = inp.gajiPokok + inp.tunjanganTetap + inp.tunjanganVariabel + inp.thrAtauBonus;
      
      const hasilNP = hitungPajakNonPegawai({
        totalPendapatan,
        adaNPWP: emp.karyawan.adaNPWP,
      });
      
      // Peta HasilKalkulasiNonPegawai → HasilKalkulasiTetap agar UI tidak crash
      newHasils[m] = {
        totalGajiTunjangan: totalPendapatan,
        thrAtauBonus: inp.thrAtauBonus,
        premiJkkPerusahaan: 0,
        premiJkmPerusahaan: 0,
        premiBpjsKesPerusahaan: 0,
        tunjanganPajakGrossUp: 0,
        totalBruto: hasilNP.totalBruto,
        iuranJhtKaryawan: 0,
        iuranJpKaryawan: 0,
        iuranBpjsKesKaryawan: 0,
        potonganDplkKaryawan: 0,
        potonganZakat: 0,
        kategoriTER: 'A', // Default aman untuk UI
        rateTER: 0,
        pajakTerutang: hasilNP.pajakTerutang,
        thpBersih: hasilNP.thpBersih,
        logKalkulasi: hasilNP.logKalkulasi,
      };
    }
    return newHasils;
  }

  // =================================================================
  // JALUR 2: LOGIKA PEGAWAI TETAP (Existing Logic)
  // =================================================================
  let totalPajakJanNov = 0;
  for (let m = 1; m <= 11; m++) {
    const res = hitungPajakBulanan(emp.karyawan, { ...emp.monthlyInputs[m], konfigurasiTarif: config });
    newHasils[m] = res;
    totalPajakJanNov += res.pajakTerutang;
  }

  const historyInputs = Object.values(emp.monthlyInputs);
  newHasils[12] = hitungPenyesuaianDesember(
    emp.karyawan,
    historyInputs,
    totalPajakJanNov,
    config
  );

  return newHasils;
};

const EMPTY_BPJS: KonfigurasiTarif = {
  rateJkkPerusahaan: 0, rateJkmPerusahaan: 0, rateJhtPerusahaan: 0, rateJhtKaryawan: 0,
  rateBpjsKesPerusahaan: 0, rateBpjsKesKaryawan: 0, rateJpPerusahaan: 0, rateJpKaryawan: 0,
  rateDplkPerusahaan: 0, rateDplkKaryawan: 0, rateZakat: 0,
  plafonJp: 10547000, plafonBpjsKes: 12000000
};

export const usePayrollStore = create<PayrollStore>((set, get) => ({
  configBpjs: EMPTY_BPJS,
  employees: {},
  metodePajakGlobal: 'GROSS',

  loadDefaultBpjs: () => get().setConfigBpjs(DEFAULT_TARIF_BPJS),

  setMetodePajakGlobal: (metode) => set((state) => {
    const updatedEmployees = { ...state.employees };
    Object.keys(updatedEmployees).forEach(nik => {
      updatedEmployees[nik].karyawan.metodePajak = metode;
      updatedEmployees[nik].monthlyHasils = calculateFullYear(updatedEmployees[nik], state.configBpjs);
    });
    return { metodePajakGlobal: metode, employees: updatedEmployees };
  }),

  setConfigBpjs: (newConfig) => set((state) => {
    const updatedConfig = { ...state.configBpjs, ...newConfig };
    const updatedEmployees = { ...state.employees };
    Object.keys(updatedEmployees).forEach((nik) => {
      for (let m = 1; m <= 12; m++) {
        updatedEmployees[nik].monthlyInputs[m].konfigurasiTarif = updatedConfig;
      }
      updatedEmployees[nik].monthlyHasils = calculateFullYear(updatedEmployees[nik], updatedConfig);
    });
    return { configBpjs: updatedConfig, employees: updatedEmployees };
  }),

  importExcel: (rows) => set((state) => {
    const newEmployees: Record<string, EmployeeData> = {};
    rows.forEach((row) => {
      const nik = row['NIK']?.toString();
      if (!nik) return;

      // --- PERBAIKAN KRUSIAL DI SINI ---
      // Baca kolom 'Tipe' atau 'TIPE', dan abaikan besar/kecil huruf
      const tipeRaw = (row['Tipe'] || row['TIPE'] || 'PEGAWAI').toString().toUpperCase();
      
      // Logika deteksi pintar: Selama ada kata "NON" (entah itu NON-PEGAWAI, NON_PEGAWAI, NON PEGAWAI), 
      // sistem akan menganggapnya sebagai Freelancer. Jika tidak ada kata "NON", maka dia TETAP.
      const tipeKaryawan = tipeRaw.includes('NON') ? 'NON_PEGAWAI' : 'TETAP';

      const karyawan: DataKaryawan = {
        idKaryawan: nik, 
        nik, 
        namaLengkap: row['Nama'] || 'Tanpa Nama',
        statusPtkp: row['PTKP'] || 'TK/0', 
        adaNPWP: String(row['Ada NPWP']).toUpperCase() === 'YA',
        tipeKaryawan: tipeKaryawan, 
        metodePajak: state.metodePajakGlobal
      };

      const monthlyInputs: Record<number, InputGajiBulanan> = {};
      for (let m = 1; m <= 12; m++) {
        const totalTunjanganExcel = (Number(row['Tunjangan Jabatan']) || 0) + 
                                    (Number(row['Tunj Transport']) || 0) + 
                                    (Number(row['Tunjangan Makan']) || 0);
                                    
        monthlyInputs[m] = {
          bulan: m, 
          gajiPokok: Number(row['Gaji Pokok']) || 0,
          tunjanganTetap: totalTunjanganExcel,
          originalTunjangan: totalTunjanganExcel,
          isOverridden: false,
          tunjanganVariabel: 0, 
          thrAtauBonus: 0, 
          dplkPerusahaan: 0, 
          dplkKaryawan: 0, 
          zakat: 0, 
          konfigurasiTarif: state.configBpjs
        };
      }
      
      const empTemplate = { karyawan, monthlyInputs, monthlyHasils: {} as any };
      empTemplate.monthlyHasils = calculateFullYear(empTemplate, state.configBpjs);
      newEmployees[nik] = empTemplate;
    });
    return { employees: newEmployees };
  }),

  updateVariable: (nik, bulan, updates) => set((state) => {
    const emp = state.employees[nik];
    if (!emp) return state;

    const currentInput = emp.monthlyInputs[bulan];

    const isNowOverridden = 
      updates.gajiPokok !== undefined || 
      updates.tunjanganTetap !== undefined || 
      currentInput.isOverridden;

    const hasBonusOrThrUpdate = updates.bonus !== undefined || updates.thr !== undefined;
    const newThrAtauBonus = hasBonusOrThrUpdate 
      ? (updates.bonus || 0) + (updates.thr || 0) 
      : currentInput.thrAtauBonus;

    const newInput: InputGajiBulanan = {
      ...currentInput,
      gajiPokok: updates.gajiPokok !== undefined ? updates.gajiPokok : currentInput.gajiPokok,
      tunjanganTetap: updates.tunjanganTetap !== undefined ? updates.tunjanganTetap : currentInput.tunjanganTetap,
      thrAtauBonus: newThrAtauBonus,
      tunjanganVariabel: updates.lembur !== undefined ? updates.lembur : currentInput.tunjanganVariabel,
      dplkKaryawan: updates.dplk !== undefined ? updates.dplk : currentInput.dplkKaryawan,
      zakat: updates.zakat !== undefined ? updates.zakat : currentInput.zakat,
      isOverridden: isNowOverridden, 
      originalTunjangan: currentInput.originalTunjangan 
    };

    const updatedInputs = { ...emp.monthlyInputs, [bulan]: newInput };
    const updatedEmp = { ...emp, monthlyInputs: updatedInputs };
    const newHasils = calculateFullYear(updatedEmp, state.configBpjs);

    return {
      employees: { 
        ...state.employees, 
        [nik]: { ...updatedEmp, monthlyHasils: newHasils } 
      }
    };
  })
}));