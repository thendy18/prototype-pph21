import type {
  PayrollHistoryEmployeeSnapshot,
  PayrollPeriodHistoryDetail,
} from '@/types/payrollHistory';

type ReconciliationViewProps = {
  current: PayrollPeriodHistoryDetail;
  previous: PayrollPeriodHistoryDetail | null;
};

type ReconciliationRow = {
  key: string;
  name: string;
  status: 'BARU' | 'KELUAR' | 'BERUBAH' | 'TETAP';
  currentBruto: number;
  previousBruto: number;
  currentTax: number;
  previousTax: number;
  currentThp: number;
  previousThp: number;
};

function formatCurrency(value: number): string {
  return value.toLocaleString('id-ID');
}

function formatDelta(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}Rp ${formatCurrency(value)}`;
}

function getDeltaClass(value: number): string {
  if (value > 0) return 'text-[#6CA6C1]';
  if (value < 0) return 'text-red-100';
  return 'text-[#F7FFF7]/45';
}

function getEmployeeName(snapshot?: PayrollHistoryEmployeeSnapshot): string {
  return snapshot?.karyawan.namaLengkap || 'Karyawan tanpa nama';
}

function toEmployeeMap(
  employees: PayrollHistoryEmployeeSnapshot[]
): Map<string, PayrollHistoryEmployeeSnapshot> {
  return new Map(employees.map((snapshot) => [snapshot.karyawan.nik, snapshot]));
}

function buildRows(
  current: PayrollPeriodHistoryDetail,
  previous: PayrollPeriodHistoryDetail
): ReconciliationRow[] {
  const currentByNik = toEmployeeMap(current.employeesSnapshot);
  const previousByNik = toEmployeeMap(previous.employeesSnapshot);
  const allNiks = new Set([...currentByNik.keys(), ...previousByNik.keys()]);

  return [...allNiks]
    .map((nik) => {
      const currentSnapshot = currentByNik.get(nik);
      const previousSnapshot = previousByNik.get(nik);
      const currentBruto = currentSnapshot?.hasil.totalBruto ?? 0;
      const previousBruto = previousSnapshot?.hasil.totalBruto ?? 0;
      const currentTax = currentSnapshot?.hasil.pajakTerutang ?? 0;
      const previousTax = previousSnapshot?.hasil.pajakTerutang ?? 0;
      const currentThp = currentSnapshot?.hasil.thpBersih ?? 0;
      const previousThp = previousSnapshot?.hasil.thpBersih ?? 0;
      const hasChanged =
        currentBruto !== previousBruto ||
        currentTax !== previousTax ||
        currentThp !== previousThp;
      const status: ReconciliationRow['status'] = !previousSnapshot
        ? 'BARU'
        : !currentSnapshot
          ? 'KELUAR'
          : hasChanged
            ? 'BERUBAH'
            : 'TETAP';

      return {
        key: nik,
        name: getEmployeeName(currentSnapshot ?? previousSnapshot),
        status,
        currentBruto,
        previousBruto,
        currentTax,
        previousTax,
        currentThp,
        previousThp,
      };
    })
    .sort((left, right) => {
      const order = { BARU: 0, KELUAR: 1, BERUBAH: 2, TETAP: 3 };
      const statusSort = order[left.status] - order[right.status];
      return statusSort || left.name.localeCompare(right.name);
    });
}

function SummaryDeltaCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
        {label}
      </div>
      <div className={`mt-2 text-xl font-black ${getDeltaClass(value)}`}>
        {formatDelta(value)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReconciliationRow['status'] }) {
  const className =
    status === 'BARU'
      ? 'border-[#6CA6C1]/35 bg-[#6CA6C1]/10 text-[#6CA6C1]'
      : status === 'KELUAR'
        ? 'border-red-200/35 bg-red-500/10 text-red-100'
        : status === 'BERUBAH'
          ? 'border-[#FFE66D]/35 bg-[#FFE66D]/10 text-[#FFE66D]'
          : 'border-[#F7FFF7]/20 bg-[#F7FFF7]/5 text-[#F7FFF7]/55';

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${className}`}
    >
      {status}
    </span>
  );
}

export function ReconciliationView({
  current,
  previous,
}: ReconciliationViewProps) {
  if (!previous) {
    const previousMonth = current.periodMonth === 1 ? 12 : current.periodMonth - 1;
    const previousYear =
      current.periodMonth === 1 ? current.periodYear - 1 : current.periodYear;

    return (
      <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
        <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
          Compare / Reconciliation
        </div>
        <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
          Belum ada snapshot bulan sebelumnya.
        </h2>
        <p className="mt-2 text-sm text-[#F7FFF7]/60">
          Sistem mencari histori masa {previousMonth}/{previousYear} untuk NPWP
          yang sama.
        </p>
      </section>
    );
  }

  const rows = buildRows(current, previous);
  const newCount = rows.filter((row) => row.status === 'BARU').length;
  const exitedCount = rows.filter((row) => row.status === 'KELUAR').length;
  const changedCount = rows.filter((row) => row.status === 'BERUBAH').length;

  return (
    <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
            Compare / Reconciliation
          </div>
          <h2 className="mt-2 text-xl font-black text-[#F7FFF7]">
            Masa {current.periodMonth}/{current.periodYear} vs{' '}
            {previous.periodMonth}/{previous.periodYear}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="BARU" />
          <StatusBadge status="KELUAR" />
          <StatusBadge status="BERUBAH" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <SummaryDeltaCard
          label="Delta Bruto"
          value={current.totalBruto - previous.totalBruto}
        />
        <SummaryDeltaCard
          label="Delta Pajak"
          value={current.totalTax - previous.totalTax}
        />
        <SummaryDeltaCard
          label="Delta THP"
          value={current.totalThp - previous.totalThp}
        />
        <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Baru / Keluar
          </div>
          <div className="mt-2 text-xl font-black text-[#F7FFF7]">
            {newCount} / {exitedCount}
          </div>
        </div>
        <div className="rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
            Berubah
          </div>
          <div className="mt-2 text-xl font-black text-[#FFE66D]">
            {changedCount}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/70">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-[#6CA6C1]/20 text-[10px] uppercase tracking-[0.16em] text-[#F7FFF7]/45">
            <tr>
              <th className="p-4">Karyawan</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Bruto</th>
              <th className="p-4 text-right">Delta Bruto</th>
              <th className="p-4 text-right">Pajak</th>
              <th className="p-4 text-right">Delta Pajak</th>
              <th className="p-4 text-right">THP</th>
              <th className="p-4 text-right">Delta THP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#6CA6C1]/10">
            {rows.map((row) => {
              const brutoDelta = row.currentBruto - row.previousBruto;
              const taxDelta = row.currentTax - row.previousTax;
              const thpDelta = row.currentThp - row.previousThp;

              return (
                <tr key={row.key} className="align-top">
                  <td className="p-4 font-black text-[#F7FFF7]">{row.name}</td>
                  <td className="p-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="p-4 text-right font-bold text-[#F7FFF7]">
                    Rp {formatCurrency(row.currentBruto)}
                  </td>
                  <td className={`p-4 text-right font-black ${getDeltaClass(brutoDelta)}`}>
                    {formatDelta(brutoDelta)}
                  </td>
                  <td className="p-4 text-right font-bold text-[#FFE66D]">
                    Rp {formatCurrency(row.currentTax)}
                  </td>
                  <td className={`p-4 text-right font-black ${getDeltaClass(taxDelta)}`}>
                    {formatDelta(taxDelta)}
                  </td>
                  <td className="p-4 text-right font-bold text-[#6CA6C1]">
                    Rp {formatCurrency(row.currentThp)}
                  </td>
                  <td className={`p-4 text-right font-black ${getDeltaClass(thpDelta)}`}>
                    {formatDelta(thpDelta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
