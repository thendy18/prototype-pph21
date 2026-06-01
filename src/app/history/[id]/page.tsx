import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getPayrollPeriodLockStatus } from '@/actions/payrollHistoryActions';
import { Button } from '@/components/ui/button';
import {
  getPayrollPeriodHistoryDetail,
  getPreviousPayrollPeriodHistoryDetail,
} from '@/lib/payrollHistory';
import type { PayrollHistoryEmployeeSnapshot } from '@/types/payrollHistory';
import { CalculationDetailToggle } from './calculation-detail-toggle';
import {
  HistoryEmployeeSlipButton,
  HistoryExportActions,
} from './history-export-actions';
import { ReconciliationView } from './reconciliation-view';

type HistoryDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatCurrency(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString('id-ID');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getEmployeeTax(snapshot: PayrollHistoryEmployeeSnapshot): number {
  return snapshot.hasil.pajakTerutang ?? 0;
}

function getEmployeeThp(snapshot: PayrollHistoryEmployeeSnapshot): number {
  return snapshot.hasil.thpBersih ?? 0;
}

export default async function HistoryDetailPage({
  params,
}: HistoryDetailPageProps) {
  const { id } = await params;
  const history = await getPayrollPeriodHistoryDetail(id);

  if (!history) {
    notFound();
  }

  const companyProfile = {
    namaPerusahaan: history.companyName,
    npwpPemotong: history.companyNpwp,
    idTku: history.companyIdTku,
  };
  const lockStatus = await getPayrollPeriodLockStatus({
    companyNpwp: history.companyNpwp,
    periodMonth: history.periodMonth,
    periodYear: history.periodYear,
  });
  const previousHistory = await getPreviousPayrollPeriodHistoryDetail({
    companyNpwp: history.companyNpwp,
    periodMonth: history.periodMonth,
    periodYear: history.periodYear,
  });

  return (
    <main className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                Payroll Snapshot Detail
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#FFE66D]">
                {history.companyName || 'Perusahaan tanpa nama'}
              </h1>
              <p className="mt-2 text-sm text-[#F7FFF7]/65">
                Masa {history.periodMonth}/{history.periodYear} - disimpan{' '}
                {formatDateTime(history.createdAt)}
              </p>
            </div>
            <Button
              asChild
              className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
            >
              <Link href="/history">Kembali ke Histori</Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                Karyawan
              </div>
              <div className="mt-2 text-2xl font-black text-[#F7FFF7]">
                {history.employeeCount}
              </div>
            </div>
            <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                Total Bruto
              </div>
              <div className="mt-2 text-2xl font-black text-[#F7FFF7]">
                Rp {formatCurrency(history.totalBruto)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                Total Pajak
              </div>
              <div className="mt-2 text-2xl font-black text-[#FFE66D]">
                Rp {formatCurrency(history.totalTax)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                Total THP
              </div>
              <div className="mt-2 text-2xl font-black text-[#6CA6C1]">
                Rp {formatCurrency(history.totalThp)}
              </div>
            </div>
          </div>
        </section>

        <HistoryExportActions
          companyProfile={companyProfile}
          employees={history.employeesSnapshot}
          initialLockStatus={lockStatus}
          periodMonth={history.periodMonth}
          periodYear={history.periodYear}
          summary={history.summarySnapshot}
        />

        <ReconciliationView current={history} previous={previousHistory} />

        <section className="grid gap-4">
          {history.employeesSnapshot.map((snapshot) => (
            <article
              key={snapshot.karyawan.nik}
              className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-5 shadow-lg shadow-black/15"
            >
              <div className="flex flex-col gap-4 border-b border-[#6CA6C1]/20 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-[#F7FFF7]">
                      {snapshot.karyawan.namaLengkap}
                    </h2>
                    <span className="rounded-full border border-[#6CA6C1]/35 bg-[#6CA6C1]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                      {snapshot.karyawan.metodePajak}
                    </span>
                    <span className="rounded-full border border-[#FFE66D]/35 bg-[#FFE66D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                      {snapshot.karyawan.tipeKaryawan}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#F7FFF7]/55">
                    NIK {snapshot.karyawan.nik} - {snapshot.karyawan.statusPtkp} -{' '}
                    {snapshot.karyawan.residentStatus}
                  </p>
                </div>
                <div className="text-right text-xs text-[#F7FFF7]/55">
                  <div>Pajak Rp {formatCurrency(getEmployeeTax(snapshot))}</div>
                  <div className="mt-1 text-[#6CA6C1]">
                    THP Rp {formatCurrency(getEmployeeThp(snapshot))}
                  </div>
                  <HistoryEmployeeSlipButton
                    companyName={history.companyName}
                    periodMonth={history.periodMonth}
                    periodYear={history.periodYear}
                    snapshot={snapshot}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                    Gaji Pokok
                  </div>
                  <div className="mt-2 font-black text-[#F7FFF7]">
                    Rp {formatCurrency(snapshot.input.gajiPokok)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                    Tunjangan
                  </div>
                  <div className="mt-2 font-black text-[#F7FFF7]">
                    Rp {formatCurrency(snapshot.input.tunjanganTetap)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                    THR / Bonus
                  </div>
                  <div className="mt-2 font-black text-[#F7FFF7]">
                    Rp {formatCurrency(snapshot.input.thrAtauBonus)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                    Total Bruto
                  </div>
                  <div className="mt-2 font-black text-[#FFE66D]">
                    Rp {formatCurrency(snapshot.hasil.totalBruto)}
                  </div>
                </div>
              </div>

              <CalculationDetailToggle
                employeeName={snapshot.karyawan.namaLengkap}
                employeeMeta={`NIK ${snapshot.karyawan.nik} - ${snapshot.karyawan.statusPtkp} - ${snapshot.karyawan.residentStatus}`}
                logCount={(snapshot.hasil.logKalkulasi ?? []).length}
                taxLabel={`Rp ${formatCurrency(getEmployeeTax(snapshot))}`}
                thpLabel={`Rp ${formatCurrency(getEmployeeThp(snapshot))}`}
              >
                {(snapshot.hasil.logKalkulasi ?? []).map((log, index) => (
                  <div
                    key={`${snapshot.karyawan.nik}-${index}`}
                    className="rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/80 p-4"
                  >
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <span className="rounded bg-[#2F3061] px-2 py-1 text-[9px] font-bold uppercase text-[#F7FFF7]/70">
                        Step {index + 1}
                      </span>
                      <span className="text-right text-sm font-black text-[#F7FFF7]">
                        {typeof log.nilai === 'number'
                          ? `Rp ${formatCurrency(log.nilai)}`
                          : log.nilai}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-[#6CA6C1]">
                      {log.langkah}
                    </h4>
                    <p className="mt-2 text-sm text-[#F7FFF7]/65">
                      {log.deskripsi}
                    </p>
                    {log.rumus && (
                      <div className="mt-3 rounded-xl border border-[#6CA6C1]/20 bg-[#2F3061]/70 p-3">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#F7FFF7]/45">
                          Logic Formula
                        </div>
                        <code className="break-all text-[11px] leading-relaxed text-[#FFE66D]">
                          {log.rumus}
                        </code>
                      </div>
                    )}
                  </div>
                ))}
              </CalculationDetailToggle>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
