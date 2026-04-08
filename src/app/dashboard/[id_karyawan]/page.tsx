'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePayrollStore } from '../../../store/usePayrollStore';

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export default function DetailKaryawanPage() {
  const params = useParams();
  const router = useRouter();
  const { employees } = usePayrollStore();

  const idKaryawan = params?.id_karyawan as string;
  const emp = employees[idKaryawan];

  if (!emp) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="text-6xl">🔍</div>
        <p className="text-lg font-semibold">Karyawan tidak ditemukan.</p>
        <p className="text-sm text-slate-600">Data mungkin belum diupload atau NIK tidak valid.</p>
        <button
          onClick={() => router.push('/bulk')}
          className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition"
        >
          ← Kembali ke Upload
        </button>
      </div>
    );
  }

  const { karyawan, monthlyInputs, monthlyHasils } = emp;

  const totalPajak = Object.values(monthlyHasils).reduce((s, h) => s + h.pajakTerutang, 0);
  const totalBruto = Object.values(monthlyHasils).reduce((s, h) => s + h.totalBruto, 0);
  const totalTHP   = Object.values(monthlyHasils).reduce((s, h) => s + h.thpBersih, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">

      {/* ── HEADER ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-white transition text-xl"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">{karyawan.namaLengkap}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                {karyawan.tipeKaryawan === 'TETAP' ? 'Pegawai Tetap' : 'Non Pegawai'}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                {karyawan.metodePajak}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                PTKP: {karyawan.statusPtkp}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                NIK: {karyawan.nik}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Tahun Pajak</p>
          <p className="text-3xl font-black text-indigo-400">2026</p>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Total Bruto Setahun</p>
            <p className="text-2xl font-black text-white font-mono">{fmt(totalBruto)}</p>
          </div>
          <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-6">
            <p className="text-[10px] text-rose-400 uppercase font-bold tracking-widest mb-2">Total PPh 21 Setahun</p>
            <p className="text-2xl font-black text-rose-400 font-mono">{fmt(totalPajak)}</p>
          </div>
          <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-6">
            <p className="text-[10px] text-emerald-400 uppercase font-bold tracking-widest mb-2">Total THP Setahun</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{fmt(totalTHP)}</p>
          </div>
        </div>

        {/* ── TABLE 12 BULAN ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-8 py-5 border-b border-slate-800 bg-slate-800/30">
            <h2 className="font-black text-slate-100 tracking-widest text-sm uppercase">
              📅 Rincian Bulanan — 2026
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950/50 text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th className="p-5 text-left">Bulan</th>
                  <th className="p-5 text-right">Gaji Pokok</th>
                  <th className="p-5 text-right">Tunj. Tetap</th>
                  <th className="p-5 text-right bg-amber-500/5 text-amber-500">Bonus / THR</th>
                  <th className="p-5 text-right">Total Bruto</th>
                  <th className="p-5 text-center">TER</th>
                  <th className="p-5 text-right text-rose-500">PPh 21</th>
                  <th className="p-5 text-right text-emerald-500">THP Bersih</th>
                  <th className="p-5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((bulan) => {
                  const inp = monthlyInputs[bulan];
                  const res = monthlyHasils[bulan];
                  const isDesember = bulan === 12;
                  const isOverridden = inp?.isOverridden;

                  return (
                    <tr
                      key={bulan}
                      className={`hover:bg-indigo-500/5 transition duration-150 ${isDesember ? 'bg-indigo-600/5' : ''}`}
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isDesember ? 'text-indigo-400' : 'text-slate-200'}`}>
                            {BULAN[bulan - 1]}
                          </span>
                          {isDesember && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold uppercase">
                              Annual Adj.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-right font-mono text-slate-400 text-xs">
                        {fmt(inp?.gajiPokok ?? 0)}
                      </td>
                      <td className="p-5 text-right font-mono text-slate-400 text-xs">
                        {fmt(inp?.tunjanganTetap ?? 0)}
                      </td>
                      <td className="p-5 text-right font-mono text-xs bg-amber-500/5">
                        <span className={inp?.thrAtauBonus ? 'text-amber-400 font-bold' : 'text-slate-600'}>
                          {fmt(inp?.thrAtauBonus ?? 0)}
                        </span>
                      </td>
                      <td className="p-5 text-right font-mono text-slate-300 text-xs font-bold">
                        {fmt(res?.totalBruto ?? 0)}
                      </td>
                      <td className="p-5 text-center">
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">
                          {res?.kategoriTER ?? '-'} · {((res?.rateTER ?? 0) * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-5 text-right font-mono font-bold text-rose-500 text-xs">
                        {fmt(res?.pajakTerutang ?? 0)}
                      </td>
                      <td className="p-5 text-right font-mono font-black text-emerald-400">
                        {fmt(res?.thpBersih ?? 0)}
                      </td>
                      <td className="p-5 text-center">
                        {isOverridden ? (
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-bold">
                            ✏️ Override
                          </span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                            ✓ Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* FOOTER TOTAL */}
              <tfoot className="bg-slate-950/80 border-t-2 border-slate-700 text-xs font-black">
                <tr>
                  <td className="p-5 text-slate-400 uppercase tracking-widest text-[10px]">TOTAL</td>
                  <td className="p-5 text-right text-slate-300 font-mono">
                    {fmt(Object.values(monthlyInputs).reduce((s, i) => s + i.gajiPokok, 0))}
                  </td>
                  <td className="p-5 text-right text-slate-300 font-mono">
                    {fmt(Object.values(monthlyInputs).reduce((s, i) => s + i.tunjanganTetap, 0))}
                  </td>
                  <td className="p-5 text-right text-amber-400 font-mono bg-amber-500/5">
                    {fmt(Object.values(monthlyInputs).reduce((s, i) => s + i.thrAtauBonus, 0))}
                  </td>
                  <td className="p-5 text-right text-white font-mono">{fmt(totalBruto)}</td>
                  <td className="p-5" />
                  <td className="p-5 text-right text-rose-400 font-mono">{fmt(totalPajak)}</td>
                  <td className="p-5 text-right text-emerald-400 font-mono">{fmt(totalTHP)}</td>
                  <td className="p-5" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── NPWP WARNING ── */}
        {!karyawan.adaNPWP && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-amber-400 font-black text-sm">Karyawan Tidak Memiliki NPWP</p>
              <p className="text-amber-500/70 text-xs mt-1">
                Seluruh PPh 21 terkena denda <strong>+20%</strong> sesuai peraturan perpajakan yang berlaku.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
