import { hitungPajakBulanan } from './lib/taxEngineBulanan';
import { hitungPajakNonPegawai } from './lib/taxEngineNonPegawai';
import { generateCoretaxXML, DataExportBulanIni } from './actions/exportXML';
import { DEFAULT_TARIF_BPJS } from './lib/constants';
import { DataKaryawan, DataPerusahaan, InputGajiBulanan, InputNonPegawai } from './types/payroll';

const perusahaan: DataPerusahaan = {
  namaPerusahaan: "PT Maju Mundur IT",
  npwpPemotong: "0029482015507000",
  idTku: "0029482015507000000000"
};

console.log("=====================================================");
console.log("🔥 UJI COBA MESIN CORETAX (SKENARIO LENGKAP) 🔥");
console.log("=====================================================\n");

// ============================================================================
// SKENARIO 1: PEGAWAI TETAP (Metode GROSS, PTKP K/3)
// ============================================================================
const empTetapGross: DataKaryawan = {
  idKaryawan: "EMP-002", nik: "3271112223330001", namaLengkap: "Budi (K/3)",
  statusPtkp: "K/3", // Status paling banyak tanggungan
  adaNPWP: true, tipeKaryawan: "TETAP", metodePajak: "GROSS" // Pajak potong gaji
};

const inputBudi: InputGajiBulanan = {
  bulan: 10, gajiPokok: 15000000, tunjanganTetap: 2000000, tunjanganVariabel: 0,
  thrAtauBonus: 0, dplkPerusahaan: 0, dplkKaryawan: 0, zakat: 0,
  konfigurasiTarif: DEFAULT_TARIF_BPJS
};

console.log(">>> SKENARIO 1: Pegawai Tetap | K/3 | Potong Gaji (GROSS)");
const hasilBudi = hitungPajakBulanan(empTetapGross, inputBudi);
console.log(`- Kategori TER    : Kategori ${hasilBudi.kategoriTER}`);
console.log(`- Total Bruto     : Rp ${hasilBudi.totalBruto.toLocaleString('id-ID')}`);
console.log(`- Rate TER        : ${(hasilBudi.rateTER * 100).toFixed(2)}%`);
console.log(`- Pajak Terutang  : Rp ${hasilBudi.pajakTerutang.toLocaleString('id-ID')} (Memotong Gaji)`);
console.log(`- THP Bersih      : Rp ${hasilBudi.thpBersih.toLocaleString('id-ID')}\n`);

// ============================================================================
// SKENARIO 2: NON-PEGAWAI / FREELANCER (Tanpa NPWP)
// ============================================================================
const inputFreelance: InputNonPegawai = {
  totalPendapatan: 50000000, // Bayaran Project 50 Juta
  adaNPWP: false             // Sengaja gak punya NPWP biar kena denda 20%
};

console.log(">>> SKENARIO 2: Freelancer | Rp 50 Juta | Tanpa NPWP");
const hasilFreelancer = hitungPajakNonPegawai(inputFreelance);
console.log(`- Dasar Pengenaan : Rp ${hasilFreelancer.dasarPengenaanPajak.toLocaleString('id-ID')} (50% dari Bruto)`);
console.log(`- Pajak Terutang  : Rp ${hasilFreelancer.pajakTerutang.toLocaleString('id-ID')} (Termasuk Denda 20%)`);
console.log(`- THP Bersih      : Rp ${hasilFreelancer.thpBersih.toLocaleString('id-ID')}\n`);

// ============================================================================
// SKENARIO 3: MENCETAK CORETAX BANYAK PEGAWAI SEKALIGUS
// ============================================================================
console.log(">>> SKENARIO 3: Mencetak XML Bulk...");
const dataExport: DataExportBulanIni[] = [
  { karyawan: empTetapGross, hasilKalkulasi: hasilBudi }
];
const xmlResult = generateCoretaxXML(perusahaan, 10, 2026, dataExport);
console.log("Status XML: Berhasil di-generate! (Panjang karakter: " + xmlResult.length + ")\n");