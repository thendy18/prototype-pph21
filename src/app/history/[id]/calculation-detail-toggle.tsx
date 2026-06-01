'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { CalculatorIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

type CalculationDetailToggleProps = {
  children: ReactNode;
  employeeName: string;
  employeeMeta: string;
  logCount: number;
  taxLabel: string;
  thpLabel: string;
};

export function CalculationDetailToggle({
  children,
  employeeName,
  employeeMeta,
  logCount,
  taxLabel,
  thpLabel,
}: CalculationDetailToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-[#6CA6C1]/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6CA6C1]">
          Detail Hitungan
        </h3>
        <div className="mt-1 text-[11px] font-bold text-[#F7FFF7]/45">
          {logCount} step kalkulasi tersimpan
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="h-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 px-4 text-xs font-black text-[#F7FFF7] hover:bg-[#6CA6C1]/20 hover:text-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
      >
        <CalculatorIcon className="size-4" />
        Lihat detail hitungan
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex animate-in fade-in-0 duration-200"
        >
          <button
            type="button"
            aria-label="Tutup detail hitungan"
            onClick={() => setIsOpen(false)}
            className="hidden flex-1 animate-in fade-in-0 bg-black/70 duration-200 sm:block"
          />
          <aside className="h-full w-full animate-in slide-in-from-right-10 overflow-y-auto border-l border-[#6CA6C1]/30 bg-[#2F3061] p-6 text-[#F7FFF7] shadow-2xl shadow-black/40 duration-200 ease-out sm:w-[640px]">
            <div className="flex items-start justify-between gap-4 border-b border-[#6CA6C1]/20 pb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#6CA6C1]">
                  Step-by-Step Calculation
                </div>
                <h2 id={titleId} className="mt-2 text-xl font-black text-[#FFE66D]">
                  {employeeName}
                </h2>
                <p className="mt-2 text-xs text-[#F7FFF7]/55">{employeeMeta}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="Tutup detail hitungan"
                onClick={() => setIsOpen(false)}
                className="h-10 w-10 rounded-xl border-[#6CA6C1]/35 bg-[#343434]/80 p-0 text-[#F7FFF7] hover:bg-[#6CA6C1]/20 hover:text-[#F7FFF7] focus-visible:ring-[#6CA6C1]/30"
              >
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                  Step
                </div>
                <div className="mt-2 text-xl font-black text-[#F7FFF7]">
                  {logCount}
                </div>
              </div>
              <div className="rounded-2xl border border-[#FFE66D]/25 bg-[#343434]/80 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                  Pajak
                </div>
                <div className="mt-2 font-black text-[#FFE66D]">{taxLabel}</div>
              </div>
              <div className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/80 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F7FFF7]/45">
                  THP
                </div>
                <div className="mt-2 font-black text-[#6CA6C1]">{thpLabel}</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {logCount === 0 ? (
                <div className="rounded-2xl border border-[#6CA6C1]/20 bg-[#343434]/80 p-4 text-sm text-[#F7FFF7]/65">
                  Belum ada detail hitungan untuk karyawan ini.
                </div>
              ) : (
                children
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
