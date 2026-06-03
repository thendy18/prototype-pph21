'use client';

import { useMemo, useState, useTransition } from 'react';
import { DownloadIcon, FileArchiveIcon, FileTextIcon, LockIcon, XIcon } from 'lucide-react';

import {
  finalizePayrollPeriod,
  recordPayrollAuditEvent,
} from '@/actions/payrollHistoryActions';
import {
  downloadBpa1Xml,
  downloadBp26Xml,
  downloadBpmpXml,
  generateBpa1Xml,
  generateBp26Xml,
  generateBpmpXml,
} from '@/actions/exportXML';
import {
  downloadAllSlipGajiZip,
  downloadReceiptPembayaranPdf,
  downloadSlipGajiPdf,
} from '@/actions/exportSlipGaji';
import { Button } from '@/components/ui/button';
import type { DataPerusahaan } from '@/types/payroll';
import type {
  PayrollHistoryEmployeeSnapshot,
  PayrollHistorySummary,
  PayrollPeriodLockStatus,
} from '@/types/payrollHistory';
import type { SlipGajiSource } from '@/types/slipGaji';

type HistoryExportActionsProps = {
  companyProfile: DataPerusahaan;
  employees: PayrollHistoryEmployeeSnapshot[];
  initialLockStatus: PayrollPeriodLockStatus;
  periodMonth: number;
  periodYear: number;
  summary: PayrollHistorySummary;
};

type HistoryEmployeeSlipButtonProps = {
  companyName: string;
  periodMonth: number;
  periodYear: number;
  snapshot: PayrollHistoryEmployeeSnapshot;
};

type BpmpSettings = {
  taxPeriodMonth: number;
  taxPeriodYear: number;
  withholdingDate: string;
};

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildSlipSource(
  companyName: string,
  periodMonth: number,
  periodYear: number,
  snapshot: PayrollHistoryEmployeeSnapshot
): SlipGajiSource {
  return {
    namaPerusahaan: companyName,
    bulan: periodMonth,
    tahun: periodYear,
    karyawan: snapshot.karyawan,
    input: snapshot.input,
    hasil: snapshot.hasil,
  };
}

function isSlipEligible(snapshot: PayrollHistoryEmployeeSnapshot): boolean {
  return snapshot.karyawan.tipeKaryawan === 'TETAP' && snapshot.hasil.totalBruto > 0;
}

function isReceiptEligible(snapshot: PayrollHistoryEmployeeSnapshot): boolean {
  return snapshot.karyawan.tipeKaryawan === 'NON_PEGAWAI' && snapshot.hasil.totalBruto > 0;
}

export function HistoryExportActions({
  companyProfile,
  employees,
  initialLockStatus,
  periodMonth,
  periodYear,
  summary,
}: HistoryExportActionsProps) {
  const [lockStatus, setLockStatus] = useState(initialLockStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isBp26ModalOpen, setIsBp26ModalOpen] = useState(false);
  const [isBpa1ModalOpen, setIsBpa1ModalOpen] = useState(false);
  const [isExportingAllSlip, setIsExportingAllSlip] = useState(false);
  const [isFinalizing, startFinalizeTransition] = useTransition();
  const [bpmpSettings, setBpmpSettings] = useState<BpmpSettings>(() => ({
    taxPeriodMonth: periodMonth,
    taxPeriodYear: periodYear,
    withholdingDate: formatDateInputValue(new Date()),
  }));
  const [bp26Settings, setBp26Settings] = useState<BpmpSettings>(() => ({
    taxPeriodMonth: periodMonth,
    taxPeriodYear: periodYear,
    withholdingDate: formatDateInputValue(new Date()),
  }));
  const [bpa1Settings, setBpa1Settings] = useState<BpmpSettings>(() => ({
    taxPeriodMonth: periodMonth,
    taxPeriodYear: periodYear,
    withholdingDate: formatDateInputValue(new Date()),
  }));

  const slipEligibleEmployees = useMemo(
    () => employees.filter(isSlipEligible),
    [employees]
  );

  const exportableXmlEmployees = useMemo(
    () =>
      employees.filter(
        (snapshot) =>
          snapshot.karyawan.tipeKaryawan === 'TETAP' &&
          snapshot.karyawan.residentStatus === 'RESIDENT' &&
          snapshot.hasil.totalBruto > 0
      ),
    [employees]
  );

  const exportableBp26Employees = useMemo(
    () =>
      employees.filter(
        (snapshot) =>
          snapshot.karyawan.tipeKaryawan === 'TETAP' &&
          snapshot.karyawan.residentStatus === 'NON_RESIDENT' &&
          snapshot.hasil.totalBruto > 0
      ),
    [employees]
  );

  const exportableBpa1Employees = useMemo(
    () =>
      employees.filter(
        (snapshot) =>
          snapshot.karyawan.tipeKaryawan === 'TETAP' &&
          snapshot.karyawan.bulanSelesai === periodMonth &&
          snapshot.hasil.totalBruto > 0
      ),
    [employees, periodMonth]
  );

  const handleFinalize = () => {
    setMessage(null);
    setError(null);

    startFinalizeTransition(() => {
      void (async () => {
        const result = await finalizePayrollPeriod({
          companyProfile,
          periodMonth,
          periodYear,
          summary,
          note: 'Finalized from History Detail page',
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        setLockStatus({
          locked: true,
          lockedAt: new Date().toISOString(),
        });
        setMessage(result.success ?? 'Periode berhasil dikunci.');
      })();
    });
  };

  const openXmlModal = () => {
    setBpmpSettings({
      taxPeriodMonth: periodMonth,
      taxPeriodYear: periodYear,
      withholdingDate: formatDateInputValue(new Date()),
    });
    setError(null);
    setIsXmlModalOpen(true);
  };

  const openBp26Modal = () => {
    setBp26Settings({
      taxPeriodMonth: periodMonth,
      taxPeriodYear: periodYear,
      withholdingDate: formatDateInputValue(new Date()),
    });
    setError(null);
    setIsBp26ModalOpen(true);
  };

  const openBpa1Modal = () => {
    setBpa1Settings({
      taxPeriodMonth: periodMonth,
      taxPeriodYear: periodYear,
      withholdingDate: formatDateInputValue(new Date()),
    });
    setError(null);
    setIsBpa1ModalOpen(true);
  };

  const handleDownloadXml = () => {
    try {
      if (exportableXmlEmployees.length === 0) {
        throw new Error('Tidak ada karyawan aktif untuk export BPMP.');
      }

      const xml = generateBpmpXml(
        companyProfile,
        exportableXmlEmployees.map((snapshot) => ({
          karyawan: snapshot.karyawan,
          hasilKalkulasi: snapshot.hasil,
        })),
        {
          taxPeriodMonth: bpmpSettings.taxPeriodMonth,
          taxPeriodYear: bpmpSettings.taxPeriodYear,
          withholdingDate: bpmpSettings.withholdingDate,
          strict: true,
        }
      );

      downloadBpmpXml(
        xml,
        `BPMP_${periodYear}-${String(periodMonth).padStart(2, '0')}.xml`
      );
      setMessage('XML BPMP berhasil dibuat dari snapshot histori.');
      setError(null);
      setIsXmlModalOpen(false);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth,
        periodYear,
        description: `Generate XML BPMP dari histori masa ${periodMonth}/${periodYear}`,
        metadata: {
          employeeCount: exportableXmlEmployees.length,
          withholdingDate: bpmpSettings.withholdingDate,
        },
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Gagal export XML.'
      );
    }
  };

  const handleDownloadBp26Xml = () => {
    try {
      const data = employees
        .filter(
          (snapshot) =>
            snapshot.karyawan.tipeKaryawan === 'TETAP' &&
            snapshot.karyawan.residentStatus === 'NON_RESIDENT' &&
            snapshot.hasil.totalBruto > 0
        )
        .map((snapshot) => ({
          karyawan: snapshot.karyawan,
          hasilKalkulasi: snapshot.hasil,
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada pegawai asing non-resident untuk export BP26.');
      }

      const xml = generateBp26Xml(companyProfile, data, {
        taxPeriodMonth: bp26Settings.taxPeriodMonth,
        taxPeriodYear: bp26Settings.taxPeriodYear,
        withholdingDate: bp26Settings.withholdingDate,
        strict: true,
      });

      downloadBp26Xml(
        xml,
        `BP26_${periodYear}-${String(periodMonth).padStart(2, '0')}.xml`
      );
      setMessage('XML BP26 berhasil dibuat dari snapshot histori.');
      setError(null);
      setIsBp26ModalOpen(false);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth,
        periodYear,
        description: `Generate XML BP26 dari histori masa ${periodMonth}/${periodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: bp26Settings.withholdingDate,
        },
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Gagal export XML BP26.'
      );
    }
  };

  const handleDownloadBpa1Xml = () => {
    try {
      const data = employees
        .filter(
          (snapshot) =>
            snapshot.karyawan.tipeKaryawan === 'TETAP' &&
            snapshot.karyawan.bulanSelesai === bpa1Settings.taxPeriodMonth &&
            snapshot.hasil.totalBruto > 0
        )
        .map((snapshot) => ({
          karyawan: snapshot.karyawan,
          input: snapshot.input,
          hasilKalkulasi: snapshot.hasil,
          monthlyInputs: snapshot.monthlyInputs,
          monthlyHasils: snapshot.monthlyHasils,
        }));

      if (data.length === 0) {
        throw new Error('Tidak ada pegawai tetap pada masa pajak terakhir untuk export BPA1.');
      }

      const xml = generateBpa1Xml(companyProfile, data, {
        taxPeriodMonth: bpa1Settings.taxPeriodMonth,
        taxPeriodYear: bpa1Settings.taxPeriodYear,
        withholdingDate: bpa1Settings.withholdingDate,
        strict: true,
      });

      downloadBpa1Xml(
        xml,
        `BPA1_${periodYear}-${String(periodMonth).padStart(2, '0')}.xml`
      );
      setMessage('XML BPA1 berhasil dibuat dari snapshot histori.');
      setError(null);
      setIsBpa1ModalOpen(false);
      void recordPayrollAuditEvent({
        eventType: 'GENERATE_XML',
        companyProfile,
        periodMonth,
        periodYear,
        description: `Generate XML BPA1 dari histori masa ${periodMonth}/${periodYear}`,
        metadata: {
          employeeCount: data.length,
          withholdingDate: bpa1Settings.withholdingDate,
        },
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Gagal export XML BPA1.'
      );
    }
  };

  const handleDownloadAllSlip = async () => {
    if (slipEligibleEmployees.length === 0) {
      setError('Tidak ada pegawai TETAP yang eligible untuk slip gaji pada histori ini.');
      return;
    }

    setIsExportingAllSlip(true);
    setError(null);
    setMessage(null);

    try {
      await downloadAllSlipGajiZip(
        slipEligibleEmployees.map((snapshot) =>
          buildSlipSource(companyProfile.namaPerusahaan, periodMonth, periodYear, snapshot)
        ),
        periodMonth,
        periodYear
      );
      setMessage('ZIP slip gaji berhasil dibuat dari snapshot histori.');
      void recordPayrollAuditEvent({
        eventType: 'DOWNLOAD_SLIP',
        companyProfile,
        periodMonth,
        periodYear,
        description: `Download ZIP slip gaji dari histori masa ${periodMonth}/${periodYear}`,
        metadata: { employeeCount: slipEligibleEmployees.length },
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Gagal membuat ZIP slip gaji.'
      );
    } finally {
      setIsExportingAllSlip(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#FFE66D]/25 bg-[#2F3061] p-5 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#FFE66D]">
            Finalize & Export
          </div>
          <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
            Snapshot periode ini tetap bisa diaudit dan diunduh.
          </h2>
          <div className="mt-2 text-xs text-[#F7FFF7]/55">
            {lockStatus.locked
              ? `Locked${lockStatus.lockedAt ? ` pada ${formatDateTime(lockStatus.lockedAt)}` : ''}`
              : 'Belum dikunci. Finalize akan menandai periode ini sebagai locked.'}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-5 xl:min-w-[900px]">
          <Button
            type="button"
            disabled={lockStatus.locked || isFinalizing}
            onClick={handleFinalize}
            className={`h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
              lockStatus.locked || isFinalizing
                ? 'bg-[#343434]/80 text-[#F7FFF7]/35'
                : 'bg-[#FFE66D] text-[#343434] hover:bg-[#F7FFF7]'
            }`}
          >
            <LockIcon className="size-4" />
            {lockStatus.locked
              ? 'Locked'
              : isFinalizing
                ? 'Mengunci...'
                : 'Finalize / Lock'}
          </Button>
          <Button
            type="button"
            onClick={openXmlModal}
            className="h-12 rounded-2xl bg-[#6CA6C1] text-xs font-black uppercase tracking-[0.16em] text-[#343434] hover:bg-[#F7FFF7]"
          >
            <FileTextIcon className="size-4" />
            XML BPMP
          </Button>
          <Button
            type="button"
            disabled={exportableBpa1Employees.length === 0}
            onClick={openBpa1Modal}
            className={`h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
              exportableBpa1Employees.length === 0
                ? 'bg-[#343434]/80 text-[#F7FFF7]/35'
                : 'bg-[#343434]/80 text-[#6CA6C1] ring-1 ring-[#6CA6C1]/45 hover:bg-[#6CA6C1] hover:text-[#343434]'
            }`}
          >
            <FileTextIcon className="size-4" />
            XML BPA1
          </Button>
          <Button
            type="button"
            disabled={exportableBp26Employees.length === 0}
            onClick={openBp26Modal}
            className={`h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
              exportableBp26Employees.length === 0
                ? 'bg-[#343434]/80 text-[#F7FFF7]/35'
                : 'bg-[#343434]/80 text-[#6CA6C1] ring-1 ring-[#6CA6C1]/45 hover:bg-[#6CA6C1] hover:text-[#343434]'
            }`}
          >
            <FileTextIcon className="size-4" />
            XML BP26
          </Button>
          <Button
            type="button"
            disabled={isExportingAllSlip || slipEligibleEmployees.length === 0}
            onClick={() => void handleDownloadAllSlip()}
            className={`h-12 rounded-2xl text-xs font-black uppercase tracking-[0.16em] ${
              isExportingAllSlip || slipEligibleEmployees.length === 0
                ? 'bg-[#343434]/80 text-[#F7FFF7]/35'
                : 'bg-[#F7FFF7] text-[#343434] hover:bg-[#FFE66D]'
            }`}
          >
            <FileArchiveIcon className="size-4" />
            {isExportingAllSlip ? 'Membuat ZIP...' : 'Semua Slip'}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Eligible Slip
          </div>
          <div className="mt-2 text-xl font-black text-[#F7FFF7]">
            {slipEligibleEmployees.length} karyawan
          </div>
        </div>
        <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Export XML
          </div>
          <div className="mt-2 text-xl font-black text-[#6CA6C1]">
            {exportableXmlEmployees.length} record
          </div>
        </div>
        <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Export BPA1
          </div>
          <div className="mt-2 text-xl font-black text-[#6CA6C1]">
            {exportableBpa1Employees.length} record
          </div>
        </div>
        <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Export BP26
          </div>
          <div className="mt-2 text-xl font-black text-[#6CA6C1]">
            {exportableBp26Employees.length} record
          </div>
        </div>
        <div className="rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Total Pajak
          </div>
          <div className="mt-2 text-xl font-black text-[#FFE66D]">
            Rp {formatCurrency(summary.totalTax)}
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-[#6CA6C1]/25 bg-[#6CA6C1]/10 p-3 text-sm font-bold text-[#F7FFF7]">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
          {error}
        </div>
      )}

      {isXmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between gap-4 border-b border-[#6CA6C1]/20 pb-4">
              <div>
                <h3 className="text-xl font-black text-[#FFE66D]">
                  Generate XML BPMP
                </h3>
                <p className="mt-2 text-sm text-[#F7FFF7]/60">
                  XML dibuat dari snapshot histori periode ini.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="Tutup modal Generate XML BPMP"
                onClick={() => setIsXmlModalOpen(false)}
                className="h-10 w-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 p-0 text-[#F7FFF7] hover:bg-[#6CA6C1]/20 hover:text-[#F7FFF7]"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Masa Pajak
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={bpmpSettings.taxPeriodMonth}
                  onChange={(event) =>
                    setBpmpSettings((current) => ({
                      ...current,
                      taxPeriodMonth: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tahun Pajak
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={bpmpSettings.taxPeriodYear}
                  onChange={(event) =>
                    setBpmpSettings((current) => ({
                      ...current,
                      taxPeriodYear: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tanggal Potong
                </span>
                <input
                  type="date"
                  value={bpmpSettings.withholdingDate}
                  onChange={(event) =>
                    setBpmpSettings((current) => ({
                      ...current,
                      withholdingDate: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleDownloadXml}
                className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7]"
              >
                <DownloadIcon className="size-4" />
                Download XML
              </Button>
            </div>
          </div>
        </div>
      )}

      {isBp26ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between gap-4 border-b border-[#6CA6C1]/20 pb-4">
              <div>
                <h3 className="text-xl font-black text-[#FFE66D]">
                  Generate XML BP26
                </h3>
                <p className="mt-2 text-sm text-[#F7FFF7]/60">
                  XML dibuat dari pegawai tetap non-resident pada snapshot ini.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="Tutup modal Generate XML BP26"
                onClick={() => setIsBp26ModalOpen(false)}
                className="h-10 w-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 p-0 text-[#F7FFF7] hover:bg-[#6CA6C1]/20 hover:text-[#F7FFF7]"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Masa Pajak
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={bp26Settings.taxPeriodMonth}
                  onChange={(event) =>
                    setBp26Settings((current) => ({
                      ...current,
                      taxPeriodMonth: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tahun Pajak
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={bp26Settings.taxPeriodYear}
                  onChange={(event) =>
                    setBp26Settings((current) => ({
                      ...current,
                      taxPeriodYear: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tanggal Potong
                </span>
                <input
                  type="date"
                  value={bp26Settings.withholdingDate}
                  onChange={(event) =>
                    setBp26Settings((current) => ({
                      ...current,
                      withholdingDate: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/70 p-4 text-sm text-[#F7FFF7]/65">
              Ditemukan {exportableBp26Employees.length} record BP26 pada snapshot ini.
              TaxCertificate COD wajib memakai receipt, deemed, dan rate dari Excel.
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleDownloadBp26Xml}
                className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7]"
              >
                <DownloadIcon className="size-4" />
                Download XML BP26
              </Button>
            </div>
          </div>
        </div>
      )}

      {isBpa1ModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between gap-4 border-b border-[#6CA6C1]/20 pb-4">
              <div>
                <h3 className="text-xl font-black text-[#FFE66D]">
                  Generate XML BPA1
                </h3>
                <p className="mt-2 text-sm text-[#F7FFF7]/60">
                  XML A1Bulk dibuat dari snapshot histori masa pajak terakhir.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="Tutup modal Generate XML BPA1"
                onClick={() => setIsBpa1ModalOpen(false)}
                className="h-10 w-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 p-0 text-[#F7FFF7] hover:bg-[#6CA6C1]/20 hover:text-[#F7FFF7]"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Masa Akhir
                </span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={bpa1Settings.taxPeriodMonth}
                  onChange={(event) =>
                    setBpa1Settings((current) => ({
                      ...current,
                      taxPeriodMonth: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tahun Pajak
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={bpa1Settings.taxPeriodYear}
                  onChange={(event) =>
                    setBpa1Settings((current) => ({
                      ...current,
                      taxPeriodYear: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/60">
                  Tanggal Potong
                </span>
                <input
                  type="date"
                  value={bpa1Settings.withholdingDate}
                  onChange={(event) =>
                    setBpa1Settings((current) => ({
                      ...current,
                      withholdingDate: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-[#6CA6C1]/30 bg-[#343434] px-3 text-sm font-bold text-[#F7FFF7] outline-none focus:border-[#FFE66D]"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/70 p-4 text-sm text-[#F7FFF7]/65">
              Ditemukan {exportableBpa1Employees.length} record BPA1 pada snapshot ini.
              Histori lama yang belum menyimpan data 12 bulan tetap bisa export, tetapi angka tahunan mengikuti data snapshot yang tersedia.
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={handleDownloadBpa1Xml}
                className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7]"
              >
                <DownloadIcon className="size-4" />
                Download XML BPA1
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function HistoryEmployeeSlipButton({
  companyName,
  periodMonth,
  periodYear,
  snapshot,
}: HistoryEmployeeSlipButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slipEligible = isSlipEligible(snapshot);
  const receiptEligible = isReceiptEligible(snapshot);
  const eligible = slipEligible || receiptEligible;

  const handleDownloadSlip = async () => {
    if (!eligible) {
      setError('Dokumen PDF hanya tersedia untuk pegawai tetap atau bukan pegawai dengan bruto aktif.');
      return;
    }

    setIsDownloading(true);
    setError(null);

    try {
      const source = buildSlipSource(companyName, periodMonth, periodYear, snapshot);
      if (receiptEligible) {
        await downloadReceiptPembayaranPdf(source);
      } else {
        await downloadSlipGajiPdf(source);
      }
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Gagal membuat dokumen PDF.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mt-3">
      <Button
        type="button"
        disabled={!eligible || isDownloading}
        onClick={() => void handleDownloadSlip()}
        className={`h-10 rounded-xl px-4 text-xs font-black uppercase tracking-[0.16em] ${
          eligible && !isDownloading
            ? 'bg-[#6CA6C1] text-[#343434] hover:bg-[#F7FFF7]'
            : 'bg-[#343434]/80 text-[#F7FFF7]/35'
        }`}
      >
        <DownloadIcon className="size-4" />
        {isDownloading ? 'Membuat...' : receiptEligible ? 'Receipt PDF' : 'Slip PDF'}
      </Button>
      {error && <div className="mt-2 text-xs font-bold text-red-100">{error}</div>}
    </div>
  );
}
