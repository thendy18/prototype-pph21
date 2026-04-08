'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { usePayrollStore } from '../../store/usePayrollStore';
import { generateCoretaxXML } from '../../actions/exportXML';

export default function PayrollProPage() {
  const { 
    configBpjs, setConfigBpjs, loadDefaultBpjs, 
    employees, importExcel, updateVariable,
    metodePajakGlobal, setMetodePajakGlobal 
  } = usePayrollStore();

  const [masaPajak, setMasaPajak] = useState(10);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedNik, setSelectedNik] = useState<string | null>(null);

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    importExcel(data);
  };

  const downloadXML = () => {
    const data = Object.values(employees).map(e => ({ 
      karyawan: e.karyawan, 
      hasilKalkulasi: e.monthlyHasils[masaPajak] 
    }));
    const xml = generateCoretaxXML({ namaPerusahaan: "PT MAJU", npwpPemotong: "123", idTku: "456" }, masaPajak, 2026, data);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Coretax_Masa_${masaPajak}.xml`; a.click();
  };

  const formatLabel = (key: string) => {
    return key.replace('rate', '').replace(/([A-Z])/g, ' $1').replace('Perusahaan', '(Co)').replace('Karyawan', '(Emp)').trim();
  };

  const activeEmp = selectedNik ? employees[selectedNik] : null;

  return (
    <div className="flex bg-slate-950 min-h-screen font-mono text-slate-200 overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} bg-slate-900 border-r border-slate-800 flex flex-col sticky top-0 h-screen transition-all duration-300`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          {!sidebarCollapsed && <h1 className="text-xl font-bold text-indigo-400">Payroll<span className="text-white">Pro</span></h1>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hover:text-indigo-400">
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
           <div className="bg-indigo-600/10 border-l-4 border-indigo-500 px-4 py-3 rounded-r-lg text-indigo-400 text-sm font-bold">📊 Dashboard</div>
           <div className="px-4 py-3 text-slate-500 hover:bg-slate-800 rounded-lg text-sm transition cursor-pointer">👥 Employees</div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-[1600px] mx-auto space-y-8">
          
          {/* HEADER: CONFIGURATION & GLOBAL TOGGLE */}
          <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
            <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
              <div>
                <h3 className="text-lg font-bold text-slate-100">⚙️ Master Configuration</h3>
                <p className="text-xs text-slate-500">Settings for BPJS & Tax Methods</p>
              </div>
              
              <div className="flex items-center gap-6">
                {/* GLOBAL TOGGLE: GROSS VS GROSS UP */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button 
                    onClick={() => setMetodePajakGlobal('GROSS')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${metodePajakGlobal === 'GROSS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    GROSS
                  </button>
                  <button 
                    onClick={() => setMetodePajakGlobal('GROSS_UP')}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all ${metodePajakGlobal === 'GROSS_UP' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    GROSS UP
                  </button>
                </div>
                <button onClick={loadDefaultBpjs} className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-xl text-xs font-bold border border-slate-700 transition">✨ Load Defaults</button>
              </div>
            </div>

            <div className="p-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(configBpjs).filter(k => k.startsWith('rate') && !k.includes('Dplk') && !k.includes('Zakat')).map(key => (
                <div key={key} className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 focus-within:border-indigo-500 transition group">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1 group-focus-within:text-indigo-400">{formatLabel(key)}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.01" className="w-full bg-transparent text-lg font-mono text-slate-100 outline-none" 
                      value={((configBpjs as any)[key] * 100).toFixed(2)} 
                      onChange={(e) => setConfigBpjs({ [key]: Number(e.target.value)/100 })} />
                    <span className="text-slate-600 font-bold">%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* UPLOAD & MASA SELECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-indigo-600 rounded-2xl p-8 shadow-xl flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-xl">📤 Step 1: Upload Excel</h3>
                <p className="text-indigo-200 text-sm mt-1">Import employee master data for calculation</p>
              </div>
              <input type="file" onChange={handleExcel} className="text-xs text-indigo-100 file:bg-white file:text-indigo-600 file:px-6 file:py-2 file:rounded-lg file:border-0 file:font-black cursor-pointer" />
            </div>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 flex flex-col justify-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Selected Tax Period</label>
              <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-bold text-indigo-400 outline-none focus:border-indigo-500" value={masaPajak} onChange={(e) => setMasaPajak(Number(e.target.value))}>
                {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Bulan {i+1} - 2026</option>)}
              </select>
            </div>
          </div>

          {/* MAIN DATA TABLE */}
          {Object.keys(employees).length > 0 && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                <h3 className="font-bold text-slate-100 tracking-widest text-lg uppercase">Variable Matrix (Masa {masaPajak})</h3>
                <button onClick={downloadXML} className="bg-emerald-600 hover:bg-emerald-700 px-8 py-2.5 rounded-xl font-black text-xs text-white shadow-lg shadow-emerald-900/20">📄 EXPORT XML</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/50 text-[10px] text-slate-500 font-black uppercase tracking-widest border-b border-slate-800">
                    <tr>
                      <th className="p-6 text-left">Pegawai</th>
                      <th className="p-6 text-left">Basic Fixed</th>
                      <th className="p-6 text-center bg-amber-500/5 text-amber-500">THR / Bonus</th>
                      <th className="p-6 text-center bg-amber-500/5 text-amber-500">Lembur</th>
                      <th className="p-6 text-right">Tax ({metodePajakGlobal})</th>
                      <th className="p-6 text-right text-emerald-500">Net Salary</th>
                      <th className="p-6 text-center">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {Object.values(employees).map(emp => {
                      const inp = emp.monthlyInputs[masaPajak];
                      const res = emp.monthlyHasils[masaPajak];
                      return (
                        <tr key={emp.karyawan.nik} className="hover:bg-indigo-500/5 transition duration-200">
                          <td className="p-6">
                            <div className="font-bold text-slate-100">{emp.karyawan.namaLengkap}</div>
                            <div className="text-[10px] text-slate-600 mt-1">{emp.karyawan.nik}</div>
                          </td>
                          <td className="p-6 text-slate-400 font-mono text-xs">{(inp.gajiPokok + inp.tunjanganTetap).toLocaleString()}</td>
                          <td className="p-6 bg-amber-500/5">
                            <input type="number" className="w-full bg-slate-950 border border-amber-500/20 rounded-lg p-2 text-center text-xs text-slate-100 outline-none focus:border-amber-500" 
                              value={inp.thrAtauBonus || ''} 
                              onChange={(e) => updateVariable(emp.karyawan.nik, masaPajak, { bonus: Number(e.target.value) })} />
                          </td>
                          <td className="p-6 bg-amber-500/5">
                            <input type="number" className="w-full bg-slate-950 border border-amber-500/20 rounded-lg p-2 text-center text-xs text-slate-100 outline-none focus:border-amber-500" 
                              value={inp.tunjanganVariabel || ''} 
                              onChange={(e) => updateVariable(emp.karyawan.nik, masaPajak, { lembur: Number(e.target.value) })} />
                          </td>
                          <td className="p-6 text-right font-mono font-bold text-rose-500">{res.pajakTerutang.toLocaleString()}</td>
                          <td className="p-6 text-right font-mono font-black text-emerald-500 text-lg">{res.thpBersih.toLocaleString()}</td>
                          <td className="p-6 text-center">
                            <button onClick={() => setSelectedNik(emp.karyawan.nik)} className="bg-slate-800 p-2 rounded-lg text-indigo-400 border border-slate-700 hover:bg-slate-700 hover:text-white transition">👁️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* DRAWER: DETAILED AUDIT & PERSONAL ADJUSTMENTS */}
        {activeEmp && (
          <>
            {/* Backdrop Blur */}
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 animate-in fade-in" onClick={() => setSelectedNik(null)} />
            
            {/* Drawer Body */}
            <div className="fixed right-0 top-0 h-full w-[580px] bg-slate-900 border-l border-slate-800 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
              
              {/* 1. DRAWER HEADER */}
              <div className="p-8 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tighter uppercase">{activeEmp.karyawan.namaLengkap}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">{activeEmp.karyawan.metodePajak}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Masa {masaPajak} • 2026</span>
                    
                    {/* STRATEGY 3: Visual Badge Alert */}
                    {activeEmp.monthlyInputs[masaPajak].isOverridden && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-widest animate-pulse">
                        ⚠️ Manual Adjustment
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedNik(null)} className="text-slate-500 hover:text-white text-3xl">✕</button>
              </div>

              {/* 2. DRAWER CONTENT */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
                
                {/* SECTION A: INCOME OVERRIDE (GAJI & TUNJANGAN) */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] border-b border-amber-500/20 pb-2">
                    I. Income Override (Custom for this month)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Gaji Pokok Input */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 focus-within:border-amber-500 transition">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Gaji Pokok</label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-sm font-bold font-mono">Rp</span>
                        <input 
                          type="number" 
                          className={`w-full bg-transparent text-lg font-mono outline-none transition-colors ${
                            activeEmp.monthlyInputs[masaPajak].isOverridden ? 'text-amber-400 font-bold' : 'text-white'
                          }`}
                          value={activeEmp.monthlyInputs[masaPajak].gajiPokok} 
                          onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { gajiPokok: Number(e.target.value) })} 
                        />
                      </div>
                    </div>

                    {/* Tunjangan Tetap Input + Tooltip (STRATEGY 1) */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 focus-within:border-amber-500 transition relative group/tooltip">
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                        Tunj. Tetap 
                        <span className="cursor-help text-slate-600 text-[12px] hover:text-amber-500 transition-colors">ⓘ</span>
                        
                        {/* TOOLTIP CONTENT */}
                        <div className="absolute bottom-full left-0 mb-3 hidden group-hover/tooltip:block w-56 bg-slate-800 text-[10px] p-3 rounded-xl shadow-2xl border border-slate-700 z-50 animate-in fade-in zoom-in-95">
                          <p className="text-slate-500 font-bold mb-1 uppercase">Original Excel Data:</p>
                          <p className="text-white font-mono text-sm leading-none">
                            Rp {activeEmp.monthlyInputs[masaPajak].originalTunjangan?.toLocaleString()}
                          </p>
                        </div>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-sm font-bold font-mono">Rp</span>
                        <input 
                          type="number" 
                          className={`w-full bg-transparent text-lg font-mono outline-none transition-colors ${
                            activeEmp.monthlyInputs[masaPajak].isOverridden ? 'text-amber-400 font-bold' : 'text-white'
                          }`}
                          value={activeEmp.monthlyInputs[masaPajak].tunjanganTetap} 
                          onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { tunjanganTetap: Number(e.target.value) })} 
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 italic">*Changing values here will trigger color change and recalculate all taxes.</p>
                </div>

                {/* SECTION B: NOMINAL ADJUSTMENTS (DPLK & ZAKAT) */}
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-indigo-500/20 pb-2">II. Personal Adjustments (Nominal)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 focus-within:border-indigo-500 transition">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">DPLK Karyawan</label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-sm font-bold">Rp</span>
                        <input type="number" className="w-full bg-transparent text-lg font-mono text-white outline-none" 
                          value={activeEmp.monthlyInputs[masaPajak].dplkKaryawan || ''} 
                          placeholder="0" 
                          onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { dplk: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 focus-within:border-emerald-500 transition">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Zakat Profesi</label>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-sm font-bold">Rp</span>
                        <input type="number" className="w-full bg-transparent text-lg font-mono text-white outline-none" 
                          value={activeEmp.monthlyInputs[masaPajak].zakat || ''} 
                          placeholder="0" 
                          onChange={(e) => updateVariable(activeEmp.karyawan.nik, masaPajak, { zakat: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION C: DETAILED CALCULATION LOGS */}
                <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em] border-b border-indigo-500/20 pb-2">III. Step-by-Step Calculation</h4>
                  <div className="space-y-4">
                    {activeEmp.monthlyHasils[masaPajak].logKalkulasi.map((log, idx) => (
                      <div key={idx} className="bg-slate-950 rounded-2xl border border-slate-800 p-6 hover:border-slate-600 transition shadow-sm group">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-[9px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-bold uppercase">Step {idx + 1}</span>
                          <span className="text-lg font-black text-white font-mono">{typeof log.nilai === 'number' ? `Rp ${log.nilai.toLocaleString()}` : log.nilai}</span>
                        </div>
                        <h5 className="text-sm font-bold text-indigo-300 mb-2 group-hover:text-indigo-400 transition">{log.langkah}</h5>
                        <p className="text-sm text-slate-400 leading-relaxed font-sans">{log.deskripsi}</p>
                        {log.rumus && (
                          <div className="mt-5 bg-slate-900/80 p-4 rounded-xl border border-slate-800/50">
                            <span className="text-[10px] text-slate-600 font-bold uppercase block mb-2 tracking-widest">Logic Formula:</span>
                            <code className="text-[11px] text-emerald-400 font-mono leading-relaxed break-all">{log.rumus}</code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. DRAWER FOOTER (TAKE HOME PAY) */}
              <div className="p-10 bg-slate-950 border-t border-slate-800 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Take Home Pay</p>
                      <p className="text-3xl font-black text-emerald-500 font-mono tracking-tighter">Rp {activeEmp.monthlyHasils[masaPajak].thpBersih.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setSelectedNik(null)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 active:scale-95">Tutup Audit</button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}