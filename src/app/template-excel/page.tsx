import Link from 'next/link';
import { DownloadIcon, FileSpreadsheetIcon, InfoIcon, ShieldAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

const templateHref = '/templates/template-input-coretax-final.xlsx';

const columnGroups = [
  {
    title: 'Profil Penerima',
    description:
      'Identitas, status pajak, periode aktif, dan metode pajak untuk semua jenis penerima.',
    columns: ['Jenis Penerima', 'Nama', 'NIK', 'Counterpart TIN', 'PTKP', 'Resident Status'],
  },
  {
    title: 'Payroll Tetap',
    description:
      'Komponen gaji pegawai tetap untuk hitung PPh 21/26, THP, slip PDF, dan BPMP.',
    columns: ['Gaji Pokok', 'Tunjangan Tetap', 'Dasar Upah BPJS', 'Jabatan'],
  },
  {
    title: 'BP21 Bukan Pegawai',
    description:
      'Data bruto, DPP/deemed, dokumen, dan TaxObjectCode untuk export XML BP21.',
    columns: ['Bruto', 'ID TKU Penerima', 'Deemed', 'TaxObjectCode', 'Document'],
  },
  {
    title: 'BPA1 Tahunan',
    description:
      'Override khusus bukti potong A1 pada masa pajak terakhir jika sistem perlu nilai tambahan.',
    columns: ['BPA1 Work For Second Employer', 'BPA1 TaxObjectCode', 'BPA1 Honorarium'],
  },
  {
    title: 'BP26 Non-Resident',
    description:
      'Identitas WPLN dan treaty metadata untuk pegawai asing non-resident.',
    columns: ['BP26 CounterpartTin', 'BP26 Country', 'BP26 Deemed', 'BP26 Rate'],
  },
];

const textColumns = [
  'NIK',
  'Counterpart TIN',
  'ID TKU Penerima',
  'DocumentNumber',
  'No Paspor',
  'BP26 CounterpartTin',
  'BP26 CounterpartReceiptNumber',
  'BP26 Kitas',
];

export default function TemplateExcelPage() {
  return (
    <main className="min-h-screen bg-[#343434] p-6 font-mono text-[#F7FFF7]">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
                <FileSpreadsheetIcon className="size-4" />
                Template Import
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[#FFE66D]">
                Template Excel Coretax Payroll
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#F7FFF7]/65">
                Pakai file ini untuk input pegawai tetap, bukan pegawai, BPA1, dan
                BP26 dalam satu workflow. Detail lengkap tiap kolom tersedia di
                sheet <span className="font-bold text-[#F7FFF7]">Keterangan Kolom</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="h-12 rounded-2xl bg-[#FFE66D] px-5 text-sm font-black text-[#343434] hover:bg-[#F7FFF7] focus-visible:ring-[#FFE66D]/30"
              >
                <a href={templateHref} download>
                  <DownloadIcon className="size-4" />
                  Download Template Excel
                </a>
              </Button>
              <Button
                asChild
                className="h-12 rounded-2xl border border-[#6CA6C1]/50 bg-[#343434]/80 px-5 text-sm font-black text-[#6CA6C1] hover:bg-[#6CA6C1] hover:text-[#343434] focus-visible:ring-[#6CA6C1]/30"
              >
                <Link href="/bulk">Ke Bulk Payroll</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          {[
            ['1', 'Isi sheet Data'],
            ['2', 'Import di Bulk Payroll'],
            ['3', 'Review hitungan & histori'],
            ['4', 'Export BPMP, BP21, BP26, BPA1'],
          ].map(([step, label]) => (
            <div
              key={step}
              className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061]/70 p-5 shadow-lg shadow-black/15"
            >
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#FFE66D] text-sm font-black text-[#343434]">
                {step}
              </div>
              <div className="mt-4 text-sm font-black text-[#F7FFF7]">{label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-[#6CA6C1]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
          <div className="mb-5 flex items-start gap-3">
            <InfoIcon className="mt-1 size-5 text-[#6CA6C1]" />
            <div>
              <h2 className="text-xl font-black text-[#F7FFF7]">Kategori Kolom</h2>
              <p className="mt-2 text-sm text-[#F7FFF7]/60">
                Template dibuat ringkas: satu sheet input untuk semua skenario,
                dengan kolom tambahan hanya saat jenis XML tertentu membutuhkan data khusus.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {columnGroups.map((group) => (
              <article
                key={group.title}
                className="rounded-2xl border border-[#6CA6C1]/25 bg-[#343434]/70 p-4"
              >
                <h3 className="text-sm font-black text-[#FFE66D]">{group.title}</h3>
                <p className="mt-2 min-h-16 text-xs leading-relaxed text-[#F7FFF7]/60">
                  {group.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.columns.map((column) => (
                    <span
                      key={column}
                      className="rounded-lg border border-[#6CA6C1]/25 bg-[#2F3061]/70 px-2 py-1 text-[10px] font-bold text-[#F7FFF7]/75"
                    >
                      {column}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[#FFE66D]/25 bg-[#2F3061] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3em] text-[#FFE66D]">
                <ShieldAlertIcon className="size-4" />
                Penting
              </div>
              <h2 className="mt-3 text-xl font-black text-[#F7FFF7]">
                Format kolom ID panjang sebagai Text.
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#F7FFF7]/65">
                Excel bisa merusak angka panjang menjadi scientific notation atau mengganti
                digit belakang menjadi nol. Format kolom ini sebagai Text sebelum isi data,
                atau awali nilai dengan apostrophe.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
              {textColumns.map((column) => (
                <div
                  key={column}
                  className="rounded-xl border border-[#FFE66D]/20 bg-[#343434]/70 px-3 py-2 text-xs font-bold text-[#F7FFF7]/80"
                >
                  {column}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
