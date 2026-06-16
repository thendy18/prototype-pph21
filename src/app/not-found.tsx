import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex flex-1 w-full min-h-[75vh] items-center justify-center bg-[#343434] px-6 py-12 text-[#F7FFF7] font-sans">
      <div className="max-w-xl w-full rounded-[28px] border border-[#6CA6C1]/20 bg-[#2F3061]/60 p-8 md:p-12 text-center shadow-2xl backdrop-blur-sm">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#FFE66D]/10 text-[#FFE66D] ring-8 ring-[#FFE66D]/5 animate-pulse">
          <Compass className="h-10 w-10" />
        </div>
        <div className="text-[11px] font-black uppercase tracking-[0.35em] text-[#6CA6C1]">
          Error 404
        </div>
        <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-[#FFE66D]">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-[#F7FFF7]/85">
          Halaman yang Anda cari tidak ada atau telah dipindahkan.
          Silakan periksa kembali URL Anda atau kembali ke menu utama.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            className="h-11 rounded-2xl bg-[#FFE66D] px-6 text-sm font-black text-[#343434] hover:!bg-[#FFF7AA] hover:!text-[#343434] transition-all duration-200 shadow-lg shadow-[#FFE66D]/15 "
          >
            <Link href="/">Kembali ke Beranda</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
