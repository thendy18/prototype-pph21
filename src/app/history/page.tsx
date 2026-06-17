import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  listPayrollAuditEvents,
  listPayrollPeriodHistories,
  listPayrollPeriodLocks,
} from '@/lib/payrollHistory';

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function shortUserId(value: string): string {
  return value ? `${value.slice(0, 8)}...` : '-';
}

const scrollPanelClass =
  'overflow-y-auto pr-2 [scrollbar-color:#6CA6C1_#343434] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-[#343434]/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6CA6C1]/55 [&::-webkit-scrollbar-thumb:hover]:bg-[#FFE66D]/70';

export default async function PayrollHistoryPage() {
  const [histories, locks, auditEvents] = await Promise.all([
    listPayrollPeriodHistories(),
    listPayrollPeriodLocks(),
    listPayrollAuditEvents(),
  ]);

  const findHistoryForLock = (lock: (typeof locks)[number]) =>
    histories.find(
      (history) =>
        history.companyNpwp === lock.companyNpwp &&
        history.periodMonth === lock.periodMonth &&
        history.periodYear === lock.periodYear
    );

  return (
    <main className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                Payroll Archive
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#FFE66D]">
                Histori Periode Payroll
              </h1>
            </div>
            <Button
              asChild
              className="h-11 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
            >
              <Link href="/bulk">Kembali ke Payroll</Link>
            </Button>
          </div>
        </section>

        {histories.length === 0 ? (
          <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-8 text-center shadow-xl shadow-black/20">
            <div className="mx-auto max-w-xl">
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                Belum Ada Snapshot
              </div>
              <h2 className="mt-3 text-2xl font-black text-[#F7FFF7]">
                Simpan histori pertama dari halaman Bulk Payroll.
              </h2>
              <p className="mt-3 text-sm text-[#F7FFF7]/60">
                Setelah data Excel diimport dan hasil payroll muncul, klik
                tombol Simpan Histori pada matrix payroll.
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061]/45 p-3 shadow-xl shadow-black/10">
            <div className="mb-3 flex flex-col gap-1 px-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#6CA6C1]">
                  Snapshot Tersimpan
                </div>
                <h2 className="mt-1 text-lg font-black text-[#F7FFF7]">
                  {histories.length} histori periode
                </h2>
              </div>
            </div>

            <div className={`${scrollPanelClass} grid max-h-[34rem] gap-4`}>
              {histories.map((history) => (
                <article
                  key={history.id}
                  className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-5 shadow-lg shadow-black/15 transition-colors hover:border-[#6CA6C1]/60"
                >
                  <div className="flex flex-col gap-4 border-b border-[#6CA6C1]/20 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-[#F7FFF7]">
                          {history.companyName || 'Perusahaan tanpa nama'}
                        </h2>
                        <span className="rounded-full border border-[#FFE66D]/35 bg-[#FFE66D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                          Masa {history.periodMonth}/{history.periodYear}
                        </span>
                        <span className="rounded-full border border-[#6CA6C1]/35 bg-[#6CA6C1]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                          {history.employeeCount} karyawan
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#F7FFF7]/55">
                        NPWP {history.companyNpwp || '-'} - ID TKU{' '}
                        {history.companyIdTku || '-'}
                      </p>
                    </div>
                    <div className="text-[11px] text-[#F7FFF7]/45">
                      Disimpan: {formatDateTime(history.createdAt)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/50">
                        Total Bruto
                      </div>
                      <div className="mt-2 text-xl font-black text-[#F7FFF7]">
                        Rp {formatCurrency(history.totalBruto)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/50">
                        Total Pajak
                      </div>
                      <div className="mt-2 text-xl font-black text-[#FFE66D]">
                        Rp {formatCurrency(history.totalTax)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/50">
                        Total THP
                      </div>
                      <div className="mt-2 text-xl font-black text-[#6CA6C1]">
                        Rp {formatCurrency(history.totalThp)}
                      </div>
                    </div>
                    <div className="flex items-stretch rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
                      <Button
                        asChild
                        className="h-auto min-h-16 w-full rounded-xl bg-[#FFE66D] text-xs font-black uppercase tracking-[0.2em] text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
                      >
                        <Link href={`/history/${history.id}`}>Detail</Link>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-[#FFE66D]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#FFE66D]">
                Finalized
              </div>
              <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
                Locked Periods
              </h2>
            </div>
            {locks.length === 0 ? (
              <p className="text-sm text-[#F7FFF7]/60">
                Belum ada periode yang dikunci.
              </p>
            ) : (
              <div className={`${scrollPanelClass} max-h-[27rem] space-y-3`}>
                {locks.slice(0, 8).map((lock) => {
                  const matchingHistory = findHistoryForLock(lock);

                  return (
                    <div
                      key={lock.id}
                      className="rounded-2xl border border-[#FFE66D]/20 bg-[#343434]/80 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-[#F7FFF7]">
                            {lock.companyName || 'Perusahaan tanpa nama'}
                          </div>
                          <div className="mt-1 text-xs text-[#F7FFF7]/55">
                            Masa {lock.periodMonth}/{lock.periodYear} -{' '}
                            {lock.employeeCount} karyawan
                          </div>
                        </div>
                        <span className="rounded-full border border-[#FFE66D]/35 bg-[#FFE66D]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFE66D]">
                          Locked
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-[#F7FFF7]/45">
                        {formatDateTime(lock.lockedAt)} - Pajak Rp{' '}
                        {formatCurrency(lock.totalTax)}
                      </div>
                      <div className="mt-4">
                        {matchingHistory ? (
                          <Button
                            asChild
                            className="h-10 rounded-xl bg-[#FFE66D] px-4 text-xs font-black uppercase tracking-[0.16em] text-[#343434] hover:bg-[#F7FFF7]"
                          >
                            <Link href={`/history/${matchingHistory.id}`}>
                              Detail
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            disabled
                            className="h-10 rounded-xl bg-[#343434]/80 px-4 text-xs font-black uppercase tracking-[0.16em] text-[#F7FFF7]/35"
                          >
                            Detail belum ada
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                Audit Trail
              </div>
              <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
                Aktivitas Terakhir
              </h2>
            </div>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-[#F7FFF7]/60">
                Belum ada aktivitas audit yang tercatat.
              </p>
            ) : (
              <div className={`${scrollPanelClass} max-h-[27rem] space-y-3`}>
                {auditEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#6CA6C1]/35 bg-[#6CA6C1]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
                        {event.eventType}
                      </span>
                      <span className="text-[11px] text-[#F7FFF7]/45">
                        Masa {event.periodMonth}/{event.periodYear}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[#F7FFF7]">
                      {event.description}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#F7FFF7]/45">
                      <span>
                        Oleh{' '}
                        <span className="font-semibold text-[#F7FFF7]/70">
                          {event.createdByName ??
                            event.createdByEmail ??
                            shortUserId(event.createdBy)}
                        </span>
                      </span>
                      {event.createdByEmail && (
                        <span className="text-[#6CA6C1]/80">
                          {event.createdByEmail}
                        </span>
                      )}
                      <span>{formatDateTime(event.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
