'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  downloadBpmpXml,
  generateBpmpXml,
  type BpmpGlobalSettings,
} from '../../actions/exportXML';
import {
  downloadAllSlipGajiZip,
  downloadSlipGajiPdf,
} from '../../actions/exportSlipGaji';
import { usePayrollStore } from '../../store/usePayrollStore';
import { DataPerusahaan, KonfigurasiTarif } from '../../types/payroll';
import { SlipGajiSource } from '../../types/slipGaji';

const RATE_KEYS = [
  'rateJkkPerusahaan',
  'rateJkmPerusahaan',
  'rateJhtPerusahaan',
  'rateBpjsKesPerusahaan',
  'rateJpPerusahaan',
  'rateJhtKaryawan',
  'rateBpjsKesKaryawan',
  'rateJpKaryawan',
] as const;

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: string): number | null {
  return value.trim() === '' ? null : parseNumber(value);
}

function formatLabel(key: string): string {
  return key
    .replace('rate', '')
    .replace(/([A-Z])/g, ' $1')
    .replace('Perusahaan', '(Co)')
    .replace('Karyawan', '(Emp)')
    .trim();
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type BpmpModalSettings = Omit<BpmpGlobalSettings, 'withholdingDate' | 'strict'> & {
  withholdingDate: string;
};

export default function PayrollProPage() {
  const {
    configBpjs,
    setConfigBpjs,
    loadDefaultBpjs,
    employees,
    importExcel,
    updateVariable,
  } = usePayrollStore();

  const [masaPajak, setMasaPajak] = useState(10);
  const [tahunPayroll, setTahunPayroll] = useState(new Date().getFullYear());
  const [selectedNik, setSelectedNik] = useState<string | null>(null);
  const [isBpmpModalOpen, setIsBpmpModalOpen] = useState(false);
  const [slipExportNik, setSlipExportNik] = useState<string | null>(null);
  const [isExportingAllSlip, setIsExportingAllSlip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<DataPerusahaan>({
    namaPerusahaan: 'PT MAJU',
    npwpPemotong: '0029482015507000',
    idTku: '0029482015507000000000',
  });
  const [bpmpSettings, setBpmpSettings] = useState<BpmpModalSettings>(() => {
    const today = new Date();
    return {
      taxPeriodMonth: 10,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    };
  });

  const employeeList = useMemo(() => Object.values(employees), [employees]);
  const activeEmp = selectedNik ? employees[selectedNik] : null;
  const activeInput = activeEmp?.monthlyInputs[masaPajak];
  const activeResult = activeEmp?.monthlyHasils[masaPajak];
  const availableTaxYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 2 + index);
  }, []);
  type EmployeeListItem = (typeof employeeList)[number];

  const slipEligibleEmployees = useMemo(
    () =>
      employeeList.filter(
        (emp) =>
          emp.karyawan.tipeKaryawan === 'TETAP' &&
          !!emp.monthlyInputs[masaPajak] &&
          !!emp.monthlyHasils[masaPajak] &&
          emp.monthlyHasils[masaPajak].totalBruto > 0
      ),
    [employeeList, masaPajak]
  );

  const isSlipEligible = (emp: EmployeeListItem): boolean =>
    emp.karyawan.tipeKaryawan === 'TETAP' &&
    !!emp.monthlyInputs[masaPajak] &&
    !!emp.monthlyHasils[masaPajak] &&
    emp.monthlyHasils[masaPajak].totalBruto > 0;

  const toSlipSource = (emp: EmployeeListItem): SlipGajiSource => ({
    namaPerusahaan: companyProfile.namaPerusahaan,
    bulan: masaPajak,
    tahun: tahunPayroll,
    karyawan: emp.karyawan,
    input: emp.monthlyInputs[masaPajak],
    hasil: emp.monthlyHasils[masaPajak],
  });

  const handleExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]],
        {
          raw: true,
          rawNumbers: false,
          defval: '',
        }
      );
      importExcel(data);
      setExportError(null);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membaca file Excel.'
      );
    }
  };

  const openBpmpModal = () => {
    const today = new Date();
    setBpmpSettings({
      taxPeriodMonth: masaPajak,
      taxPeriodYear: today.getFullYear(),
      withholdingDate: formatDateInputValue(today),
    });
    setExportError(null);
    setIsBpmpModalOpen(true);
  };

  const closeBpmpModal = () => {
    setIsBpmpModalOpen(false);
  };

  const downloadXML = (settings: BpmpModalSettings) => {
    try {
      const data = employeeList
        .filter(
          (emp) =>
            emp.monthlyHasils[settings.taxPeriodMonth]?.totalBruto > 0
        )
        .map((emp) => ({
          karyawan: emp.karyawan,
          hasilKalkulasi: emp.monthlyHasils[settings.taxPeriodMonth],
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada karyawan aktif untuk export BPMP.');
      }

      const xml = generateBpmpXml(
        {
          namaPerusahaan: companyProfile.namaPerusahaan,
          npwpPemotong: companyProfile.npwpPemotong,
          idTku: companyProfile.idTku,
        },
        data,
        {
          taxPeriodMonth: settings.taxPeriodMonth,
          taxPeriodYear: settings.taxPeriodYear,
          withholdingDate: settings.withholdingDate,
          strict: true,
        }
      );

      downloadBpmpXml(xml);
      setExportError(null);
      closeBpmpModal();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Gagal export XML.');
    }
  };

  const handleDownloadSlip = async (emp: EmployeeListItem) => {
    if (!isSlipEligible(emp)) {
      setExportError('Slip gaji hanya tersedia untuk pegawai TETAP yang punya hasil di periode aktif.');
      return;
    }

    setSlipExportNik(emp.karyawan.nik);
    setExportError(null);

    try {
      await downloadSlipGajiPdf(toSlipSource(emp));
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membuat slip gaji PDF.'
      );
    } finally {
      setSlipExportNik(null);
    }
  };

  const handleDownloadAllSlip = async () => {
    if (slipEligibleEmployees.length === 0) {
      setExportError('Tidak ada pegawai TETAP yang eligible untuk slip gaji pada periode aktif.');
      return;
    }

    setIsExportingAllSlip(true);
    setExportError(null);

    try {
      await downloadAllSlipGajiZip(
        slipEligibleEmployees.map(toSlipSource),
        masaPajak,
        tahunPayroll
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membuat ZIP slip gaji.'
      );
    } finally {
      setIsExportingAllSlip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-mono text-slate-100">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black text-indigo-400">PayrollPro</h1>
              <p className="text-xs text-slate-500">BPJS, PPh 21/26, audit log, dan export BPMP</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={loadDefaultBpjs}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold"
              >
                Load Defaults
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Nama Perusahaan</label>
              <input
                value={companyProfile.namaPerusahaan}
                onChange={(e) => setCompanyProfile((prev) => ({ ...prev, namaPerusahaan: e.target.value }))}
                className="w-full bg-transparent text-sm outline-none focus:text-indigo-300"
                placeholder="PT ..."
              />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">NPWP Pemotong</label>
              <input
                value={companyProfile.npwpPemotong}
                onChange={(e) => setCompanyProfile((prev) => ({ ...prev, npwpPemotong: e.target.value }))}
                className="w-full bg-transparent text-sm outline-none focus:text-indigo-300"
                placeholder="TIN / NPWP"
              />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">ID TKU</label>
              <input
                value={companyProfile.idTku}
                onChange={(e) => setCompanyProfile((prev) => ({ ...prev, idTku: e.target.value }))}
                className="w-full bg-transparent text-sm outline-none focus:text-indigo-300"
                placeholder="ID TKU"
              />
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-800 p-6 lg:grid-cols-4">
            {RATE_KEYS.map((key) => (
              <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {formatLabel(key)}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={((configBpjs[key] ?? 0) * 100).toFixed(2)}
                    onChange={(e) => setConfigBpjs({ [key]: parseNumber(e.target.value) / 100 } as Partial<KonfigurasiTarif>)}
                    className="w-full bg-transparent text-lg outline-none"
                  />
                  <span className="text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 border-t border-slate-800 p-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Basis Upah BPJS</label>
              <select
                value={configBpjs.basisUpahBpjs ?? 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP'}
                onChange={(e) =>
                  setConfigBpjs({ basisUpahBpjs: e.target.value as KonfigurasiTarif['basisUpahBpjs'] })
                }
                className="w-full bg-transparent text-sm outline-none"
              >
                <option value="GAJI_POKOK">Gaji Pokok</option>
                <option value="GAJI_POKOK_PLUS_TUNJANGAN_TETAP">Gaji Pokok + Tunjangan Tetap</option>
              </select>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Plafon JP</label>
              <input
                type="number"
                value={configBpjs.plafonJp}
                onChange={(e) => setConfigBpjs({ plafonJp: parseNumber(e.target.value) })}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-3 pb-3 pt-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Plafon BPJS Kesehatan</label>
              <input
                type="number"
                value={configBpjs.plafonBpjsKes}
                onChange={(e) => setConfigBpjs({ plafonBpjsKes: parseNumber(e.target.value) })}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-2xl bg-indigo-600 p-6 lg:col-span-2">
            <div>
              <h2 className="text-xl font-black">Upload Excel</h2>
              <p className="text-xs text-indigo-100">Kolom Metode Pajak wajib ada per karyawan di file Excel</p>
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcel} className="text-xs file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-black file:text-indigo-600" />
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Masa Pajak</label>
            <select
              value={masaPajak}
              onChange={(e) => setMasaPajak(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 outline-none focus:border-indigo-500"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Bulan {i + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Tahun Payroll</label>
            <select
              value={tahunPayroll}
              onChange={(e) => setTahunPayroll(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 outline-none focus:border-indigo-500"
            >
              {availableTaxYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </section>

        {exportError && (
          <div className="whitespace-pre-line rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {exportError}
          </div>
        )}

        {employeeList.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 p-6">
              <h2 className="text-lg font-black uppercase tracking-widest">
                Variable Matrix (Masa {masaPajak}/{tahunPayroll})
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleDownloadAllSlip}
                  disabled={isExportingAllSlip || slipEligibleEmployees.length === 0}
                  className={`rounded-xl px-6 py-2 text-xs font-black ${
                    isExportingAllSlip || slipEligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-slate-700 text-slate-400'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {isExportingAllSlip ? 'Membuat ZIP...' : 'Download Semua Slip'}
                </button>
                <button onClick={openBpmpModal} className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-black">
                  Generate XML BPMP
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4 text-left">Pegawai</th>
                    <th className="p-4 text-left">Profile</th>
                    <th className="p-4 text-left">Basic Fixed</th>
                    <th className="p-4 text-center">THR / Bonus</th>
                    <th className="p-4 text-center">Lembur</th>
                    <th className="p-4 text-right">Tax</th>
                    <th className="p-4 text-right">THP</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {employeeList.map((emp) => {
                    const input = emp.monthlyInputs[masaPajak];
                    const result = emp.monthlyHasils[masaPajak];
                    const slipEligible = isSlipEligible(emp);
                    const isGeneratingSlip =
                      slipExportNik === emp.karyawan.nik;
                    return (
                      <tr key={emp.karyawan.nik} className="hover:bg-slate-800/50">
                        <td className="p-4">
                          <div className="font-bold">{emp.karyawan.namaLengkap}</div>
                          <div className="text-[10px] text-slate-500">{emp.karyawan.nik}</div>
                        </td>
                        <td className="p-4 text-[10px] text-slate-400">
                          <div>{emp.karyawan.metodePajak} • {emp.karyawan.residentStatus}</div>
                          <div>{emp.karyawan.statusIdentitas} • Aktif {emp.karyawan.bulanMulai}-{emp.karyawan.bulanSelesai}</div>
                        </td>
                        <td className="p-4">{formatCurrency(input.gajiPokok + input.tunjanganTetap)}</td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={input.thrAtauBonus || ''}
                            onChange={(e) => updateVariable(emp.karyawan.nik, masaPajak, { bonus: parseNumber(e.target.value) })}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-center outline-none"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            value={input.tunjanganVariabel || ''}
                            onChange={(e) => updateVariable(emp.karyawan.nik, masaPajak, { lembur: parseNumber(e.target.value) })}
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2 text-center outline-none"
                          />
                        </td>
                        <td className="p-4 text-right font-bold text-rose-400">{formatCurrency(result.pajakTerutang)}</td>
                        <td className="p-4 text-right font-black text-emerald-400">{formatCurrency(result.thpBersih)}</td>
                        <td className="p-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button onClick={() => setSelectedNik(emp.karyawan.nik)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-indigo-300">
                              Detail
                            </button>
                            <button
                              onClick={() => void handleDownloadSlip(emp)}
                              disabled={!slipEligible || isGeneratingSlip || isExportingAllSlip}
                              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                                !slipEligible || isGeneratingSlip || isExportingAllSlip
                                  ? 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-500'
                                  : 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                              }`}
                            >
                              {isGeneratingSlip ? 'Membuat...' : 'Slip PDF'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isBpmpModalOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <button
              aria-label="Tutup modal Generate XML BPMP"
              className="absolute inset-0"
              onClick={closeBpmpModal}
            />
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-emerald-400">Generate XML BPMP</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Atur masa pajak, tahun pajak, dan tanggal pemotongan sebelum download XML.
                  </p>
                </div>
                <button
                  onClick={closeBpmpModal}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300"
                >
                  Tutup
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Masa Pajak
                  </label>
                  <select
                    value={bpmpSettings.taxPeriodMonth}
                    onChange={(e) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-transparent text-sm outline-none focus:text-emerald-300"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Bulan {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Tahun Pajak
                  </label>
                  <select
                    value={bpmpSettings.taxPeriodYear}
                    onChange={(e) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-transparent text-sm outline-none focus:text-emerald-300"
                  >
                    {availableTaxYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Tanggal Pemotongan
                  </label>
                  <input
                    type="date"
                    value={bpmpSettings.withholdingDate}
                    onChange={(e) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-sm outline-none focus:text-emerald-300"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  NPWP Pemotong dan ID TKU tetap memakai data perusahaan di form utama.
                </p>
                <button
                  onClick={() => downloadXML(bpmpSettings)}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-xs font-black text-white"
                >
                  Download XML
                </button>
              </div>
            </div>
          </div>
        )}

        {activeEmp && activeInput && activeResult && (
          <div className="fixed inset-0 z-50 flex">
            <button className="flex-1 bg-black/70" onClick={() => setSelectedNik(null)} />
            <div className="h-full w-[640px] overflow-y-auto border-l border-slate-800 bg-slate-900 p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black">{activeEmp.karyawan.namaLengkap}</h3>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {activeEmp.karyawan.metodePajak} • {activeEmp.karyawan.residentStatus} • {activeEmp.karyawan.statusIdentitas}
                  </p>
                </div>
                <button onClick={() => setSelectedNik(null)} className="text-2xl text-slate-500">✕</button>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <h4 className="border-b border-amber-500/20 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
                    Income Override
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Gaji Pokok</label>
                      <input
                        type="number"
                        value={activeInput.gajiPokok}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { gajiPokok: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">
                        Tunjangan Tetap
                      </label>
                      <input
                        type="number"
                        value={activeInput.tunjanganTetap}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { tunjanganTetap: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                      <p className="mt-2 text-[10px] text-slate-500">
                        Original Excel: Rp {formatCurrency(activeInput.originalTunjangan ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">THR / Bonus</label>
                      <input
                        type="number"
                        value={activeInput.thrAtauBonus || ''}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { bonus: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Lembur / Variabel</label>
                      <input
                        type="number"
                        value={activeInput.tunjanganVariabel || ''}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { lembur: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Natura Taxable</label>
                      <input
                        type="number"
                        value={activeInput.naturaTaxable || ''}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { naturaTaxable: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">
                        Premi Asuransi Swasta ER
                      </label>
                      <input
                        type="number"
                        value={activeInput.premiAsuransiSwastaPerusahaan || ''}
                        onChange={(e) =>
                          updateVariable(activeEmp.karyawan.nik, masaPajak, {
                            premiAsuransiSwastaPerusahaan: parseNumber(e.target.value),
                          })
                        }
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-indigo-500/20 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">
                    BPJS Override
                  </h4>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Dasar Upah BPJS</label>
                    <input
                      type="number"
                      placeholder="Kosong = auto"
                      value={activeInput.dasarUpahBpjs ?? ''}
                      onChange={(e) =>
                        updateVariable(activeEmp.karyawan.nik, masaPajak, {
                          dasarUpahBpjs: parseNullableNumber(e.target.value),
                        })
                      }
                      className="w-full bg-transparent text-lg outline-none"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <h5 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Override Perusahaan</h5>
                      <div className="space-y-3">
                        {[
                          ['premiJkk', 'JKK'],
                          ['premiJkm', 'JKM'],
                          ['premiJht', 'JHT'],
                          ['premiBpjsKes', 'BPJS Kes'],
                          ['premiJp', 'JP'],
                        ].map(([key, label]) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="w-24 text-[11px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              placeholder="Auto"
                              value={(activeInput.overrideBpjsPerusahaan?.[key as keyof NonNullable<typeof activeInput.overrideBpjsPerusahaan>] as number | undefined) ?? ''}
                              onChange={(e) =>
                                updateVariable(activeEmp.karyawan.nik, masaPajak, {
                                  overrideBpjsPerusahaan: { [key]: parseNullableNumber(e.target.value) },
                                })
                              }
                              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <h5 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Override Karyawan</h5>
                      <div className="space-y-3">
                        {[
                          ['iuranJht', 'JHT'],
                          ['iuranBpjsKes', 'BPJS Kes'],
                          ['iuranJp', 'JP'],
                        ].map(([key, label]) => (
                          <div key={key} className="flex items-center gap-3">
                            <span className="w-24 text-[11px] font-bold text-slate-500">{label}</span>
                            <input
                              type="number"
                              placeholder="Auto"
                              value={(activeInput.overrideBpjsKaryawan?.[key as keyof NonNullable<typeof activeInput.overrideBpjsKaryawan>] as number | undefined) ?? ''}
                              onChange={(e) =>
                                updateVariable(activeEmp.karyawan.nik, masaPajak, {
                                  overrideBpjsKaryawan: { [key]: parseNullableNumber(e.target.value) },
                                })
                              }
                              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-emerald-500/20 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Personal Adjustments
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">DPLK Karyawan</label>
                      <input
                        type="number"
                        value={activeInput.dplkKaryawan || ''}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { dplk: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <label className="mb-2 block text-[10px] font-bold uppercase text-slate-500">Zakat Profesi</label>
                      <input
                        type="number"
                        value={activeInput.zakat || ''}
                        onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { zakat: parseNumber(e.target.value) })}
                        className="w-full bg-transparent text-lg outline-none"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-slate-700 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                    Result Snapshot
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Bruto Pajak</div>
                      <div className="mt-2 text-2xl font-black text-white">Rp {formatCurrency(activeResult.totalBruto)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">THP</div>
                      <div className="mt-2 text-2xl font-black text-emerald-400">Rp {formatCurrency(activeResult.thpBersih)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pajak Dipotong</div>
                      <div className="mt-2 text-2xl font-black text-rose-400">Rp {formatCurrency(activeResult.pajakDipotongDariKaryawan)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Pajak Ditanggung / Refund</div>
                      <div className="mt-2 text-2xl font-black text-indigo-400">
                        Rp {formatCurrency(activeResult.pajakDitanggungPerusahaan + activeResult.refundPajak)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-indigo-500/20 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">
                    Step-by-Step Calculation
                  </h4>
                  <div className="space-y-4">
                    {activeResult.logKalkulasi.map((log, idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <span className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold uppercase text-slate-400">
                            Step {idx + 1}
                          </span>
                          <span className="text-right text-lg font-black text-white">
                            {typeof log.nilai === 'number' ? `Rp ${formatCurrency(log.nilai)}` : log.nilai}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-indigo-300">{log.langkah}</h5>
                        <p className="mt-2 text-sm text-slate-400">{log.deskripsi}</p>
                        {log.rumus && (
                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Logic Formula</div>
                            <code className="break-all text-[11px] leading-relaxed text-emerald-400">{log.rumus}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Take Home Pay</div>
                  <div className="mt-2 text-3xl font-black text-emerald-400">Rp {formatCurrency(activeResult.thpBersih)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
