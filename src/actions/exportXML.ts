import { create } from 'xmlbuilder2';
import { 
  DataPerusahaan, 
  DataKaryawan, 
  HasilKalkulasiTetap 
} from '../types/payroll';

// Format Output dari Engine yang akan dibungkus
export interface DataExportBulanIni {
  karyawan: DataKaryawan;
  hasilKalkulasi: HasilKalkulasiTetap;
}

// ============================================================================
// FUNGSI UTAMA: GENERATE XML CORETAX (Format: MmPayrollBulk)
// ============================================================================
export function generateCoretaxXML(
  perusahaan: DataPerusahaan,
  masaPajakBulan: number, // 1 - 12
  masaPajakTahun: number, // Contoh: 2026
  dataPegawaiTetap: DataExportBulanIni[] // Array daftar gaji bulan ini
): string {

  // 1. Inisialisasi Root Tag dengan XML version & encoding (Standar DJP)
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('MmPayrollBulk', {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });

  // 2. Tambahkan Tag <TIN> (NPWP Perusahaan Pemotong)
  root.ele('TIN').txt(perusahaan.npwpPemotong).up();

  // 3. Buka Kumpulan Data Pegawai
  const listOfMmPayroll = root.ele('ListOfMmPayroll');

  // 4. Looping Semua Pegawai Tetap di Bulan Tersebut
  dataPegawaiTetap.forEach(({ karyawan, hasilKalkulasi }) => {
    
    // Validasi Dasar (Mencegah XML ditolak Coretax karena kosong)
    if (!karyawan.nik || karyawan.nik.length !== 16) {
      console.warn(`[Peringatan] Karyawan ${karyawan.namaLengkap} memiliki NIK tidak valid/kosong.`);
    }

    // Ambil tanggal hari ini sebagai WithholdingDate (Tanggal Potong)
    // Format Coretax: YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Mulai build data per individu
    const mmPayroll = listOfMmPayroll.ele('MmPayroll');
    
    mmPayroll.ele('TaxPeriodMonth').txt(masaPajakBulan.toString()).up();
    mmPayroll.ele('TaxPeriodYear').txt(masaPajakTahun.toString()).up();
    mmPayroll.ele('CounterpartOpt').txt('Resident').up(); // Asumsi WNI/Resident
    
    // Tag wajib untuk WNI (Passport di-set nil=true)
    mmPayroll.ele('CounterpartPassport', { 'xsi:nil': 'true' }).up();
    
    mmPayroll.ele('CounterpartTin').txt(karyawan.nik).up(); // NIK 16 Digit
    mmPayroll.ele('StatusTaxExemption').txt(karyawan.statusPtkp).up();
    mmPayroll.ele('Position').txt('Pegawai').up(); // Default posisi
    
    // TaxCertificate (DTP/ETC/NA)
    // Untuk Pegawai Tetap Normal, nilainya N/A
    mmPayroll.ele('TaxCertificate').txt('N/A').up(); 
    
    // Kode Objek Pajak Pegawai Tetap = 21-100-01
    mmPayroll.ele('TaxObjectCode').txt('21-100-01').up();
    
    // Angka Pajak Utama
    mmPayroll.ele('Gross').txt(Math.floor(hasilKalkulasi.totalBruto).toString()).up();
    
    // Rate Coretax dalam persen utuh (Bukan desimal). Contoh: 1.5% ditulis 1.5
    const ratePersen = (hasilKalkulasi.rateTER * 100).toString();
    mmPayroll.ele('Rate').txt(ratePersen).up();
    
    // ID TKU Perusahaan (22 Digit)
    mmPayroll.ele('IDPlaceOfBusinessActivity').txt(perusahaan.idTku).up();
    
    // Tanggal Potong
    mmPayroll.ele('WithholdingDate').txt(today).up();

    // Selesai tag MmPayroll individu
    mmPayroll.up(); 
  });

  // 5. Akhiri Dokumen & Return String XML
  // prettyPrint: true membuat XML punya line-break (mudah dibaca manusia)
  return root.end({ prettyPrint: true });
}