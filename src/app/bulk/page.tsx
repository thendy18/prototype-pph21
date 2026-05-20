'use client';

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
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
import { buildNominalOverridePreviewRows } from '../../lib/payrollOverrides';
import { usePayrollStore } from '../../store/usePayrollStore';
import { DataPerusahaan, KonfigurasiTarif } from '../../types/payroll';
import { SlipGajiSource } from '../../types/slipGaji';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

const SETTINGS_CARD_CLASS =
  'rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061]/70 p-4 shadow-lg shadow-black/20 transition-colors hover:border-[#6CA6C1]/70 focus-within:border-[#6CA6C1]/70';

const SETTINGS_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F7FFF7]/70';

const SETTINGS_CONTROL_CLASS =
  'flex h-12 items-center rounded-xl border border-[#6CA6C1]/35 bg-[#343434]/80 px-3 transition-colors hover:border-[#6CA6C1] hover:bg-[#343434] focus-within:border-[#6CA6C1] focus-within:bg-[#343434] focus-within:ring-2 focus-within:ring-[#6CA6C1]/25';

const SETTINGS_INPUT_CLASS =
  'h-auto border-none bg-transparent p-0 text-base font-semibold text-[#F7FFF7] shadow-none outline-none placeholder:text-[#6CA6C1]/60 focus-visible:ring-0';

const SETTINGS_SELECT_TRIGGER_CLASS =
  'h-12 w-full rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 font-mono text-sm font-medium text-[#F7FFF7] transition-all duration-200 hover:border-[#6CA6C1] hover:bg-[#343434] focus:ring-2 focus:ring-[#6CA6C1]/25 data-[state=open]:border-[#6CA6C1] data-[state=open]:bg-[#343434] [&_svg]:text-[#6CA6C1]';

const SETTINGS_SELECT_CONTENT_CLASS =
  'rounded-xl border border-[#6CA6C1]/30 bg-[#343434] font-mono text-[#F7FFF7] shadow-2xl shadow-black/40 [&_[data-slot=select-scroll-down-button]]:bg-[#343434] [&_[data-slot=select-scroll-down-button]]:text-[#6CA6C1] [&_[data-slot=select-scroll-up-button]]:bg-[#343434] [&_[data-slot=select-scroll-up-button]]:text-[#6CA6C1] [&_[data-slot=select-viewport]]:bg-[#343434]';

const SETTINGS_SELECT_ITEM_CLASS =
  'cursor-pointer rounded-lg font-mono text-sm !text-[#F7FFF7] hover:bg-[#2F3061] hover:!text-[#FFE66D] focus:bg-[#2F3061] focus:!text-[#FFE66D] data-[highlighted]:bg-[#2F3061] data-[highlighted]:!text-[#FFE66D] data-[state=checked]:bg-[#6CA6C1]/20 data-[state=checked]:!text-[#FFE66D] [&_svg]:!text-[#FFE66D]';

const TABLE_INPUT_CLASS =
  'h-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 text-center font-semibold text-[#F7FFF7] transition-colors placeholder:text-[#6CA6C1]/55 hover:border-[#6CA6C1] hover:bg-[#343434] focus-visible:border-[#6CA6C1] focus-visible:ring-2 focus-visible:ring-[#6CA6C1]/25';

const CURRENCY_INPUT_WRAP_CLASS =
  'flex h-10 items-center rounded-xl border border-[#6CA6C1]/35 bg-[#343434]/80 px-3 transition-colors hover:border-[#6CA6C1] hover:bg-[#343434] focus-within:border-[#6CA6C1] focus-within:bg-[#343434] focus-within:ring-2 focus-within:ring-[#6CA6C1]/25';

const CURRENCY_INPUT_CLASS =
  'h-auto border-none bg-transparent py-0 pl-0 pr-3 text-right font-semibold text-[#F7FFF7] caret-[#6CA6C1] shadow-none outline-none placeholder:text-[#6CA6C1]/55 focus-visible:ring-0';

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableCurrencyInput(value: string): number | null {
  const digits = value.replace(/\D/g, '');
  return digits === '' ? null : parseCurrencyInput(digits);
}

function formatCurrencyInputValue(
  value: number | null | undefined,
  options: { emptyZero?: boolean } = {}
): string {
  const { emptyZero = true } = options;
  if (value === null || value === undefined || (emptyZero && value === 0)) {
    return '';
  }

  return formatCurrency(value);
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

function isExcelFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    setNominalOverride,
    setSubjekPajakSejakAwalTahun,
    updateVariable,
  } = usePayrollStore();

  const [masaPajak, setMasaPajak] = useState(10);
  const [tahunPayroll, setTahunPayroll] = useState(new Date().getFullYear());
  const [selectedNik, setSelectedNik] = useState<string | null>(null);
  const [isBpmpModalOpen, setIsBpmpModalOpen] = useState(false);
  const [slipExportNik, setSlipExportNik] = useState<string | null>(null);
  const [isExportingAllSlip, setIsExportingAllSlip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [excelImportMessage, setExcelImportMessage] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [companyProfile, setCompanyProfile] = useState<DataPerusahaan>({
    namaPerusahaan: '',
    npwpPemotong: '',
    idTku: '',
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
  const activeOverrideRows = useMemo(
    () =>
      activeEmp && activeInput
        ? buildNominalOverridePreviewRows(activeInput, activeEmp.karyawan.tipeKaryawan)
        : [],
    [activeEmp, activeInput]
  );
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

  const setExcelFile = (file: File | null) => {
    if (!file) {
      setSelectedExcelFile(null);
      setExcelImportMessage(null);
      return;
    }

    if (!isExcelFile(file)) {
      setSelectedExcelFile(null);
      setExcelImportMessage(null);
      setExportError('Format file harus .xlsx atau .xls.');
      return;
    }

    setSelectedExcelFile(file);
    setExportError(null);
    setExcelImportMessage('File siap diimport. Klik Import Data untuk memproses.');
  };

  const handleExcelFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setExcelFile(e.target.files?.[0] ?? null);
  };

  const handleExcelDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(true);
  };

  const handleExcelDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
  };

  const handleExcelDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDraggingExcel(false);
    setExcelFile(e.dataTransfer.files?.[0] ?? null);
  };

  const clearExcelFile = () => {
    setExcelFile(null);
    if (excelInputRef.current) {
      excelInputRef.current.value = '';
    }
  };

  const importSelectedExcel = async () => {
    if (!selectedExcelFile) {
      setExportError('Pilih file Excel terlebih dahulu.');
      return;
    }

    setIsImportingExcel(true);
    setExportError(null);
    setExcelImportMessage(null);

    try {
      const buf = await selectedExcelFile.arrayBuffer();
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
      setExcelImportMessage(
        `Berhasil import ${data.length} baris dari ${selectedExcelFile.name}.`
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Gagal membaca file Excel.'
      );
    } finally {
      setIsImportingExcel(false);
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
    <div className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061] shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-[#6CA6C1]/20 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#FFE66D]">PayrollPro</h1>
              <p className="text-xs text-[#F7FFF7]/60">BPJS, PPh 21/26, audit log, dan export BPMP</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={loadDefaultBpjs}
                className="h-10 rounded-xl border border-[#6CA6C1]/50 bg-[#6CA6C1] px-4 text-xs font-bold text-[#343434] transition-colors hover:bg-[#FFE66D] focus-visible:ring-[#FFE66D]/30"
              >
                Load Defaults
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data1">
                  Nama Perusahaan
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.namaPerusahaan}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, namaPerusahaan: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="PT ..."
                    id="data1"
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data2">
                  NPWP Pemotong
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.npwpPemotong}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, npwpPemotong: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="TIN / NPWP"
                    id="data2"
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="data3">
                  ID TKU
                </FieldLabel>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <Input
                    value={companyProfile.idTku}
                    onChange={(e) => setCompanyProfile((prev) => ({ ...prev, idTku: e.target.value }))}
                    className={SETTINGS_INPUT_CLASS}
                    placeholder="ID TKU"
                    id="data3"
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="grid gap-4 border-t border-[#6CA6C1]/20 p-6 lg:grid-cols-4">
            {RATE_KEYS.map((key, i) => (
              <div key={key} className={SETTINGS_CARD_CLASS}>
                <Field className="space-y-3">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor={`rate${i}`}>
                    {formatLabel(key)}
                  </FieldLabel>
                  <div className={SETTINGS_CONTROL_CLASS}>
                    <Input
                      type="number"
                      step="0.01"
                      id={`rate${i}`}
                      value={((configBpjs[key] ?? 0) * 100).toFixed(2)}
                      onChange={(e) => setConfigBpjs({ [key]: parseNumber(e.target.value) / 100 } as Partial<KonfigurasiTarif>)}
                      className={SETTINGS_INPUT_CLASS}
                    />
                    <span className="ml-3 text-sm font-bold text-[#6CA6C1]">%</span>
                  </div>
                </Field>
              </div>
            ))}
          </div>

          <div className="grid gap-4 border-t border-[#6CA6C1]/20 p-6 md:grid-cols-3">
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS}>
                    Basis Upah BPJS
                  </FieldLabel>
                </div>

                <Select
                  value={configBpjs.basisUpahBpjs ?? 'GAJI_POKOK_PLUS_TUNJANGAN_TETAP'}
                  onValueChange={(value) =>
                    setConfigBpjs({
                      basisUpahBpjs: value as KonfigurasiTarif['basisUpahBpjs'],
                    })
                  }
                >
                  <SelectTrigger
                    id="basis-upah-bpjs"
                    className={SETTINGS_SELECT_TRIGGER_CLASS}
                  >
                    <SelectValue placeholder="Pilih basis upah" />
                  </SelectTrigger>

                  <SelectContent
                    className={SETTINGS_SELECT_CONTENT_CLASS}
                  >
                    <SelectGroup>
                      <SelectItem
                        value="GAJI_POKOK"
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Gaji Pokok
                      </SelectItem>

                      <SelectItem
                        value="GAJI_POKOK_PLUS_TUNJANGAN_TETAP"
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Gaji Pokok + Tunjangan Tetap
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="plafon-jp">
                    Plafon Jaminan Pensiun
                  </FieldLabel>
                </div>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <span className="mr-3 text-sm font-bold text-[#6CA6C1]">Rp</span>
                  <Input
                    id="plafon-jp"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInputValue(configBpjs.plafonJp, {
                      emptyZero: false,
                    })}
                    onChange={(e) => setConfigBpjs({ plafonJp: parseCurrencyInput(e.target.value) })}
                    className={SETTINGS_INPUT_CLASS}
                  />
                </div>
              </Field>
            </div>
            <div className={SETTINGS_CARD_CLASS}>
              <Field className="space-y-3">
                <div className="space-y-1">
                  <FieldLabel className={SETTINGS_LABEL_CLASS} htmlFor="plafon-bpjs-kes">
                    Plafon BPJS Kesehatan
                  </FieldLabel>
                </div>
                <div className={SETTINGS_CONTROL_CLASS}>
                  <span className="mr-3 text-sm font-bold text-[#6CA6C1]">Rp</span>
                  <Input
                    id="plafon-bpjs-kes"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInputValue(configBpjs.plafonBpjsKes, {
                      emptyZero: false,
                    })}
                    onChange={(e) => setConfigBpjs({ plafonBpjsKes: parseCurrencyInput(e.target.value) })}
                    className={SETTINGS_INPUT_CLASS}
                  />
                </div>
              </Field>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#FFE66D]/30 bg-[#FFE66D] p-5 text-[#343434] shadow-lg shadow-black/20 lg:col-span-2">
            <Field className="gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <FieldLabel
                    htmlFor="excel-upload"
                    className="text-xl font-black text-[#343434]"
                  >
                    Upload Excel
                  </FieldLabel>
                </div>
              </div>

              <Input
                ref={excelInputRef}
                id="excel-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelFileChange}
                className="sr-only"
              />

              <label
                htmlFor="excel-upload"
                onDragOver={handleExcelDragOver}
                onDragLeave={handleExcelDragLeave}
                onDrop={handleExcelDrop}
                className={`group flex cursor-pointer flex-col gap-4 rounded-2xl border-2 border-dashed p-5 transition-all sm:flex-row sm:items-center sm:justify-between ${
                  isDraggingExcel
                    ? 'border-[#2F3061] bg-[#F7FFF7]'
                    : 'border-[#343434]/30 bg-[#F7FFF7]/45 hover:border-[#2F3061] hover:bg-[#F7FFF7]/75'
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#343434] text-sm font-black text-[#FFE66D] shadow-lg shadow-black/15">
                    XLS
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-[#343434]">
                      {selectedExcelFile
                        ? selectedExcelFile.name
                        : 'Klik atau drag file Excel ke sini'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[#343434]/60">
                      {selectedExcelFile
                        ? `${formatFileSize(selectedExcelFile.size)} - Siap diproses`
                        : 'Mendukung .xlsx dan .xls'}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-[#343434] px-4 py-2 text-xs font-black text-[#F7FFF7] transition-colors group-hover:bg-[#2F3061]">
                  Pilih File
                </div>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-xs font-semibold text-[#343434]/70">
                  {excelImportMessage ?? 'Kolom Metode Pajak wajib ada per karyawan.'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedExcelFile && (
                    <Button
                      type="button"
                      onClick={clearExcelFile}
                      disabled={isImportingExcel}
                      className="h-10 rounded-xl border border-[#343434]/25 bg-[#F7FFF7]/60 px-4 text-xs font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#343434]/25"
                    >
                      Ganti File
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => void importSelectedExcel()}
                    disabled={!selectedExcelFile || isImportingExcel}
                    className={`h-10 rounded-xl px-5 text-xs font-black focus-visible:ring-[#343434]/25 ${
                      !selectedExcelFile || isImportingExcel
                        ? 'cursor-not-allowed bg-[#343434]/30 text-[#343434]/45'
                        : 'bg-[#343434] text-[#FFE66D] hover:bg-[#2F3061]'
                    }`}
                  >
                    {isImportingExcel ? 'Mengimport...' : 'Import Data'}
                  </Button>
                </div>
              </div>
            </Field>
          </div>
          <div className={SETTINGS_CARD_CLASS}>
            <Field className="space-y-3">
              <FieldLabel className={SETTINGS_LABEL_CLASS}>
                Masa Pajak
              </FieldLabel>
              <Select
                value={String(masaPajak)}
                onValueChange={(value) => setMasaPajak(Number(value))}
              >
                <SelectTrigger
                  id="masa-pajak"
                  className={SETTINGS_SELECT_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Pilih masa pajak" />
                </SelectTrigger>
                <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                  <SelectGroup>
                    {[...Array(12)].map((_, i) => (
                      <SelectItem
                        key={i + 1}
                        value={String(i + 1)}
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        Bulan {i + 1}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className={SETTINGS_CARD_CLASS}>
            <Field className="space-y-3">
              <FieldLabel className={SETTINGS_LABEL_CLASS}>
                Tahun Payroll
              </FieldLabel>
              <Select
                value={String(tahunPayroll)}
                onValueChange={(value) => setTahunPayroll(Number(value))}
              >
                <SelectTrigger
                  id="tahun-payroll"
                  className={SETTINGS_SELECT_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Pilih tahun payroll" />
                </SelectTrigger>
                <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                  <SelectGroup>
                    {availableTaxYears.map((year) => (
                      <SelectItem
                        key={year}
                        value={String(year)}
                        className={SETTINGS_SELECT_ITEM_CLASS}
                      >
                        {year}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        {exportError && (
          <div className="whitespace-pre-line rounded-2xl border border-[#FFE66D]/30 bg-[#FFE66D]/10 px-4 py-3 text-sm text-[#FFE66D]">
            {exportError}
          </div>
        )}

        {employeeList.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-[#6CA6C1]/25 bg-[#2F3061] shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[#6CA6C1]/20 p-6">
              <h2 className="text-lg font-black uppercase tracking-widest">
                Variable Matrix (Masa {masaPajak}/{tahunPayroll})
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleDownloadAllSlip}
                  disabled={isExportingAllSlip || slipEligibleEmployees.length === 0}
                  className={`h-10 rounded-xl px-6 text-xs font-black focus-visible:ring-[#FFE66D]/30 ${
                    isExportingAllSlip || slipEligibleEmployees.length === 0
                      ? 'cursor-not-allowed bg-[#343434]/70 text-[#F7FFF7]/40'
                      : 'bg-[#FFE66D] text-[#343434] hover:bg-[#F7FFF7]'
                  }`}
                >
                  {isExportingAllSlip ? 'Membuat ZIP...' : 'Download Semua Slip'}
                </Button>
                <Button
                  onClick={openBpmpModal}
                  className="h-10 rounded-xl border border-[#6CA6C1]/50 bg-[#6CA6C1] px-6 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
                >
                  Generate XML BPMP
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#343434]/60 text-[10px] font-black uppercase tracking-widest text-[#F7FFF7]/60">
                  <TableRow className="border-[#6CA6C1]/20 hover:bg-transparent">
                    <TableHead className="p-4 text-left">Pegawai</TableHead>
                    <TableHead className="p-4 text-left">Profile</TableHead>
                    <TableHead className="p-4 text-left">Basic Fixed</TableHead>
                    <TableHead className="p-4 text-center">THR / Bonus</TableHead>
                    <TableHead className="p-4 text-center">Lembur</TableHead>
                    <TableHead className="p-4 text-right">Tax</TableHead>
                    <TableHead className="p-4 text-right">THP</TableHead>
                    <TableHead className="p-4 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#6CA6C1]/20">
                  {employeeList.map((emp) => {
                    const input = emp.monthlyInputs[masaPajak];
                    const result = emp.monthlyHasils[masaPajak];
                    const slipEligible = isSlipEligible(emp);
                    const isGeneratingSlip =
                      slipExportNik === emp.karyawan.nik;
                    return (
                      <TableRow
                        key={emp.karyawan.nik}
                        className="border-[#6CA6C1]/20 hover:bg-[#343434]/45"
                      >
                        <TableCell className="p-4">
                          <div className="font-bold">{emp.karyawan.namaLengkap}</div>
                          <div className="text-[10px] text-[#F7FFF7]/50">{emp.karyawan.nik}</div>
                        </TableCell>
                        <TableCell className="p-4 text-[10px] text-[#F7FFF7]/65">
                          <div>{emp.karyawan.metodePajak} • {emp.karyawan.residentStatus}</div>
                          <div>{emp.karyawan.statusIdentitas} • Aktif {emp.karyawan.bulanMulai}-{emp.karyawan.bulanSelesai}</div>
                        </TableCell>
                        <TableCell className="p-4">{formatCurrency(input.gajiPokok + input.tunjanganTetap)}</TableCell>
                        <TableCell className="p-4">
                          <div className={CURRENCY_INPUT_WRAP_CLASS}>
                            <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrencyInputValue(input.thrAtauBonus)}
                              onChange={(e) =>
                                updateVariable(emp.karyawan.nik, masaPajak, {
                                  bonus: parseCurrencyInput(e.target.value),
                                })
                              }
                              className={CURRENCY_INPUT_CLASS}
                              placeholder="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-4">
                          <div className={CURRENCY_INPUT_WRAP_CLASS}>
                            <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                              Rp
                            </span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatCurrencyInputValue(input.tunjanganVariabel)}
                              onChange={(e) =>
                                updateVariable(emp.karyawan.nik, masaPajak, {
                                  lembur: parseCurrencyInput(e.target.value),
                                })
                              }
                              className={CURRENCY_INPUT_CLASS}
                              placeholder="0"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-4 text-right font-bold text-[#FFE66D]">{formatCurrency(result.pajakTerutang)}</TableCell>
                        <TableCell className="p-4 text-right font-black text-[#6CA6C1]">{formatCurrency(result.thpBersih)}</TableCell>
                        <TableCell className="p-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              onClick={() => setSelectedNik(emp.karyawan.nik)}
                              className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#6CA6C1] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                            >
                              Detail
                            </Button>
                            <Button
                              onClick={() => void handleDownloadSlip(emp)}
                              disabled={!slipEligible || isGeneratingSlip || isExportingAllSlip}
                              className={`h-9 rounded-lg px-3 text-xs font-bold focus-visible:ring-[#FFE66D]/30 ${
                                !slipEligible || isGeneratingSlip || isExportingAllSlip
                                  ? 'cursor-not-allowed border border-[#6CA6C1]/15 bg-[#343434]/50 text-[#F7FFF7]/35'
                                  : 'border border-[#FFE66D]/50 bg-[#FFE66D]/10 text-[#FFE66D] hover:bg-[#FFE66D] hover:text-[#343434]'
                              }`}
                            >
                              {isGeneratingSlip ? 'Membuat...' : 'Slip PDF'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
            <div className="relative z-10 w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-[#FFE66D]">Generate XML BPMP</h3>
                  <p className="mt-2 text-xs text-[#F7FFF7]/65">
                    Atur masa pajak, tahun pajak, dan tanggal pemotongan sebelum download XML.
                  </p>
                </div>
                <Button
                  onClick={closeBpmpModal}
                  className="h-9 rounded-lg border border-[#6CA6C1]/40 bg-[#343434]/80 px-3 text-xs font-bold text-[#F7FFF7] transition-colors hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Masa Pajak
                  </label>
                  <Select
                    value={String(bpmpSettings.taxPeriodMonth)}
                    onValueChange={(value) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodMonth: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih masa pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem
                            key={i + 1}
                            value={String(i + 1)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            Bulan {i + 1}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tahun Pajak
                  </label>
                  <Select
                    value={String(bpmpSettings.taxPeriodYear)}
                    onValueChange={(value) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        taxPeriodYear: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                      <SelectValue placeholder="Pilih tahun pajak" />
                    </SelectTrigger>
                    <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                      <SelectGroup>
                        {availableTaxYears.map((year) => (
                          <SelectItem
                            key={year}
                            value={String(year)}
                            className={SETTINGS_SELECT_ITEM_CLASS}
                          >
                            {year}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 px-4 pb-4 pt-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                    Tanggal Pemotongan
                  </label>
                  <Input
                    type="date"
                    value={bpmpSettings.withholdingDate}
                    onChange={(e) =>
                      setBpmpSettings((prev) => ({
                        ...prev,
                        withholdingDate: e.target.value,
                      }))
                    }
                    className={TABLE_INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-[#F7FFF7]/55">
                  NPWP Pemotong dan ID TKU tetap memakai data perusahaan di form utama.
                </p>
                <Button
                  onClick={() => downloadXML(bpmpSettings)}
                  className="h-11 rounded-xl bg-[#FFE66D] px-5 text-xs font-black text-[#343434] transition-colors hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                >
                  Download XML
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeEmp && activeInput && activeResult && (
          <div className="fixed inset-0 z-50 flex">
            <button className="flex-1 bg-black/70" onClick={() => setSelectedNik(null)} />
            <div className="h-full w-[640px] overflow-y-auto border-l border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7]">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-black">{activeEmp.karyawan.namaLengkap}</h3>
                  <p className="mt-2 text-[11px] text-[#F7FFF7]/65">
                    {activeEmp.karyawan.metodePajak} • {activeEmp.karyawan.residentStatus} • {activeEmp.karyawan.statusIdentitas}
                  </p>
                </div>
                <button onClick={() => setSelectedNik(null)} className="text-2xl text-[#F7FFF7]/55 transition-colors hover:text-[#FFE66D]">✕</button>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4 border-b border-[#6CA6C1]/25 pb-2">
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                        Status Pajak Tahunan
                      </h4>
                      <p className="mt-2 text-[11px] text-[#F7FFF7]/55">
                        Tentukan apakah karyawan sudah menjadi subjek pajak dalam negeri sejak 1 Januari.
                        Status ini dipakai untuk memutuskan apakah neto perlu disetahunkan pada masa pajak terakhir.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                    <Field className="space-y-3">
                      <FieldLabel className={SETTINGS_LABEL_CLASS}>
                        Subjek Pajak Sejak Awal Tahun
                      </FieldLabel>
                      <Select
                        value={
                          activeEmp.karyawan.subjekPajakSejakAwalTahun ? 'YA' : 'TIDAK'
                        }
                        onValueChange={(value) =>
                          setSubjekPajakSejakAwalTahun(
                            activeEmp.karyawan.nik,
                            value === 'YA'
                          )
                        }
                      >
                        <SelectTrigger className={SETTINGS_SELECT_TRIGGER_CLASS}>
                          <SelectValue placeholder="Pilih status subjek pajak" />
                        </SelectTrigger>
                        <SelectContent className={SETTINGS_SELECT_CONTENT_CLASS}>
                          <SelectGroup>
                            <SelectItem value="YA" className={SETTINGS_SELECT_ITEM_CLASS}>
                              YA
                            </SelectItem>
                            <SelectItem
                              value="TIDAK"
                              className={SETTINGS_SELECT_ITEM_CLASS}
                            >
                              TIDAK
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] leading-relaxed text-[#F7FFF7]/55">
                        YA berarti neto tidak disetahunkan hanya karena karyawan mulai bekerja di tengah
                        tahun. TIDAK dipakai untuk kasus khusus seperti subjek pajak yang baru dimulai
                        setelah awal tahun.
                      </p>
                    </Field>
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4 border-b border-[#FFE66D]/25 pb-2">
                    <div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                        Global Nominal Override
                      </h4>
                      <p className="mt-2 text-[11px] text-[#F7FFF7]/55">
                        Isi nominal manual untuk komponen yang ingin dikoreksi. Jika kolom override kosong,
                        sistem tetap memakai nilai asli atau hitung otomatis.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-[#2F3061]/80 text-[10px] font-black uppercase tracking-widest text-[#F7FFF7]/60">
                          <TableRow className="border-[#6CA6C1]/20 hover:bg-transparent">
                            <TableHead className="p-3 text-left">Kelompok</TableHead>
                            <TableHead className="p-3 text-left">Komponen</TableHead>
                            <TableHead className="p-3 text-right">Nilai Awal / Auto</TableHead>
                            <TableHead className="p-3 text-right">Override Nominal</TableHead>
                            <TableHead className="p-3 text-right">Nilai Dipakai</TableHead>
                            <TableHead className="p-3 text-center">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-[#6CA6C1]/20">
                          {activeOverrideRows.map((row) => {
                            const isOverridden = row.overrideValue !== undefined;

                            return (
                              <TableRow
                                key={row.key}
                                className={`border-[#6CA6C1]/20 hover:bg-[#2F3061]/45 ${
                                  isOverridden ? 'bg-[#FFE66D]/10' : ''
                                }`}
                              >
                                <TableCell className="p-3 text-[11px] font-bold text-[#F7FFF7]/50">
                                  {row.group}
                                </TableCell>
                                <TableCell className="p-3 text-[12px] text-[#F7FFF7]">{row.label}</TableCell>
                                <TableCell className="p-3 text-right font-bold text-[#F7FFF7]/65">
                                  Rp {formatCurrency(row.originalValue)}
                                </TableCell>
                                <TableCell className="p-3">
                                  <div className={CURRENCY_INPUT_WRAP_CLASS}>
                                    <span className="mr-3 text-sm font-bold text-[#6CA6C1]">
                                      Rp
                                    </span>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Kosong = auto"
                                      value={formatCurrencyInputValue(row.overrideValue, {
                                        emptyZero: false,
                                      })}
                                      onChange={(e) =>
                                        setNominalOverride(
                                          activeEmp.karyawan.nik,
                                          masaPajak,
                                          row.key,
                                          parseNullableCurrencyInput(e.target.value)
                                        )
                                      }
                                      className={CURRENCY_INPUT_CLASS}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="p-3 text-right font-black text-[#F7FFF7]">
                                  Rp {formatCurrency(row.finalValue)}
                                </TableCell>
                                <TableCell className="p-3 text-center">
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      setNominalOverride(
                                        activeEmp.karyawan.nik,
                                        masaPajak,
                                        row.key,
                                        null
                                      )
                                    }
                                    disabled={!isOverridden}
                                    className={`h-9 rounded-lg px-3 text-[11px] font-bold focus-visible:ring-[#6CA6C1]/30 ${
                                      isOverridden
                                        ? 'bg-[#6CA6C1] text-[#343434]'
                                        : 'cursor-not-allowed bg-[#343434]/50 text-[#F7FFF7]/35'
                                    }`}
                                  >
                                    Reset
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-[#6CA6C1]/25 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/80">
                    Result Snapshot
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Total Bruto Pajak</div>
                      <div className="mt-2 text-2xl font-black text-[#F7FFF7]">Rp {formatCurrency(activeResult.totalBruto)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">THP</div>
                      <div className="mt-2 text-2xl font-black text-[#6CA6C1]">Rp {formatCurrency(activeResult.thpBersih)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Pajak Dipotong</div>
                      <div className="mt-2 text-2xl font-black text-[#FFE66D]">Rp {formatCurrency(activeResult.pajakDipotongDariKaryawan)}</div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Pajak Ditanggung / Refund</div>
                      <div className="mt-2 text-2xl font-black text-[#6CA6C1]">
                        Rp {formatCurrency(activeResult.pajakDitanggungPerusahaan + activeResult.refundPajak)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="border-b border-[#6CA6C1]/25 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                    Step-by-Step Calculation
                  </h4>
                  <div className="space-y-4">
                    {activeResult.logKalkulasi.map((log, idx) => (
                      <div key={idx} className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-5">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <span className="rounded bg-[#2F3061] px-2 py-1 text-[9px] font-bold uppercase text-[#F7FFF7]/70">
                            Step {idx + 1}
                          </span>
                          <span className="text-right text-lg font-black text-[#F7FFF7]">
                            {typeof log.nilai === 'number' ? `Rp ${formatCurrency(log.nilai)}` : log.nilai}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-[#6CA6C1]">{log.langkah}</h5>
                        <p className="mt-2 text-sm text-[#F7FFF7]/65">{log.deskripsi}</p>
                        {log.rumus && (
                          <div className="mt-4 rounded-xl border border-[#6CA6C1]/20 bg-[#2F3061]/70 p-3">
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/45">Logic Formula</div>
                            <code className="break-all text-[11px] leading-relaxed text-[#FFE66D]">{log.rumus}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="rounded-2xl border border-[#FFE66D]/30 bg-[#343434]/80 p-6">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/55">Take Home Pay</div>
                  <div className="mt-2 text-3xl font-black text-[#FFE66D]">Rp {formatCurrency(activeResult.thpBersih)}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
