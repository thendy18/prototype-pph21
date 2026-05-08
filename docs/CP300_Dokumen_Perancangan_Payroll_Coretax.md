# DOKUMEN PERANCANGAN CP-300
## Sistem Informasi Payroll Coretax

## Informasi Dokumen

| Kolom | Isi |
| --- | --- |
| Judul Dokumen | Dokumen Perancangan CP-300 |
| Nama Sistem | Sistem Informasi Payroll Coretax |
| Nama Kelompok | [Isi Nama Kelompok] |
| Anggota Kelompok / NIM | [Isi Nama dan NIM] |
| Mata Kuliah / Progress | CP-300 Perancangan |
| Dosen Pembimbing | [Isi Nama Dosen Pembimbing] |
| Kelas | [Isi Kelas] |
| Tanggal Penyusunan | [Isi Tanggal] |
| Status Dokumen | Draft Word-Ready |
| Pendekatan Dokumen | As-Is + Gap |

## Petunjuk Penggunaan Dokumen

| Kolom | Isi |
| --- | --- |
| Tujuan Dokumen | Menyediakan dokumen perancangan formal yang dapat digunakan sebagai dasar akademik dan teknis untuk project Payroll Coretax. |
| Dasar Penyusunan | Disusun dari implementasi aktual project, lalu dilengkapi dengan penandaan gap desain dan rekomendasi lanjutan. |
| Bentuk Output | Naskah siap dipindahkan ke Microsoft Word. |
| Catatan Penting | Bagian yang belum ada di implementasi tidak ditulis seolah-olah sudah selesai, tetapi dicatat sebagai gap atau rekomendasi pengembangan. |

---

# BAB 1. ANALISIS PERSYARATAN

## 1.1 Latar Belakang

| Kolom | Isi |
| --- | --- |
| Permasalahan Utama | Pengelolaan payroll dan pemotongan PPh Pasal 21 membutuhkan ketelitian tinggi karena melibatkan data karyawan, komponen penghasilan, BPJS, metode pajak, dan kebutuhan pelaporan perpajakan. |
| Risiko Jika Manual | Kesalahan perhitungan, duplikasi kerja, sulit menyiapkan XML BPMP, dan sulit menghasilkan slip gaji secara konsisten. |
| Solusi yang Dibangun | Payroll Coretax dikembangkan sebagai sistem informasi internal untuk login user, pengelolaan user internal, input/import payroll, perhitungan PPh 21 dan BPJS, serta pembuatan dokumen output. |
| Platform | Aplikasi web berbasis Next.js, Supabase, dan modul kalkulasi internal. |

## 1.2 Tujuan Sistem

| No | Tujuan | Penjelasan |
| --- | --- | --- |
| 1 | Mendukung autentikasi dan otorisasi | Sistem memfasilitasi login user internal dengan role `master` dan `staff`. |
| 2 | Mendukung pengelolaan user internal | Master user dapat mengelola akun internal yang berhak mengakses aplikasi. |
| 3 | Mempermudah pengolahan payroll | Sistem memungkinkan import dan pengolahan data payroll karyawan secara lebih cepat dan konsisten. |
| 4 | Mengotomatisasi perhitungan | Sistem menghitung PPh 21, BPJS, dan take home pay berdasarkan data payroll. |
| 5 | Menyediakan export pajak | Sistem menghasilkan XML BPMP/Coretax dari data payroll yang aktif. |
| 6 | Menyediakan dokumen payroll | Sistem menghasilkan slip gaji PDF dan ZIP untuk distribusi hasil payroll. |

## 1.3 Ruang Lingkup Sistem

| No | Ruang Lingkup | Keterangan |
| --- | --- | --- |
| 1 | Login | Menggunakan akun yang terdaftar pada Supabase Auth. |
| 2 | Profil aplikasi | Pemeriksaan profil user pada tabel `app_users`. |
| 3 | Role | Pembatasan akses berdasarkan role `master` dan `staff`. |
| 4 | Manage staff | Fitur manajemen user internal pada halaman `/users`. |
| 5 | Payroll page | Halaman payroll utama pada route `/bulk`. |
| 6 | Import data | Import data payroll dari file Excel. |
| 7 | Kalkulasi | Perhitungan payroll, PPh 21 pegawai tetap, penyesuaian tahunan, pajak non-pegawai, dan BPJS. |
| 8 | Export XML | Pembentukan XML BPMP/Coretax. |
| 9 | Export slip | Pembentukan slip gaji PDF dan ZIP. |

## 1.4 Kebutuhan Fungsional

### 1.4.1 Kebutuhan Fungsional Modul Autentikasi dan Otorisasi

| No | Kebutuhan Fungsional | Penjelasan |
| --- | --- | --- |
| 1 | Halaman login | Sistem harus menyediakan halaman login untuk memasukkan email dan password. |
| 2 | Verifikasi kredensial | Sistem harus memverifikasi email dan password terhadap Supabase Auth. |
| 3 | Verifikasi profil aplikasi | Sistem harus memeriksa apakah user yang berhasil login memiliki profil pada tabel `app_users`. |
| 4 | Penolakan akun tidak terdaftar | Sistem harus menolak akses jika akun belum terdaftar di aplikasi. |
| 5 | Penolakan akun nonaktif | Sistem harus menolak akses jika akun berstatus nonaktif. |
| 6 | Redirect ke payroll | Sistem harus mengarahkan user yang valid dan aktif ke halaman payroll utama. |
| 7 | Pembedaan hak akses | Sistem harus membedakan hak akses role `master` dan `staff`. |
| 8 | Pembatasan akses users page | Sistem harus membatasi akses halaman `/users` hanya untuk role `master`. |

### 1.4.2 Kebutuhan Fungsional Modul Manajemen User

| No | Kebutuhan Fungsional | Penjelasan |
| --- | --- | --- |
| 1 | Buat user baru | Sistem harus memungkinkan master user membuat user baru. |
| 2 | Ubah role user | Sistem harus memungkinkan master user mengubah role user lain. |
| 3 | Ubah status aktif | Sistem harus memungkinkan master user mengaktifkan atau menonaktifkan user lain. |
| 4 | Reset password | Sistem harus memungkinkan master user mereset password user lain. |
| 5 | Lindungi master aktif terakhir | Sistem harus mencegah penghapusan atau penurunan role master aktif terakhir. |
| 6 | Lindungi akun sendiri | Sistem harus mencegah user menonaktifkan akunnya sendiri dari panel manajemen user. |

### 1.4.3 Kebutuhan Fungsional Modul Payroll

| No | Kebutuhan Fungsional | Penjelasan |
| --- | --- | --- |
| 1 | Input payroll | Sistem harus menerima input payroll melalui halaman utama payroll. |
| 2 | Import Excel | Sistem harus mendukung import data payroll dari file Excel. |
| 3 | Penyimpanan state payroll | Sistem harus menyimpan data payroll dalam state aplikasi per karyawan dan per bulan. |
| 4 | Perubahan variabel | Sistem harus memungkinkan perubahan variabel payroll secara manual dari antarmuka. |
| 5 | Recalculate | Sistem harus menghitung ulang hasil payroll jika terjadi perubahan input. |

### 1.4.4 Kebutuhan Fungsional Modul Perhitungan Pajak dan BPJS

| No | Kebutuhan Fungsional | Penjelasan |
| --- | --- | --- |
| 1 | Hitung pajak bulanan | Sistem harus menghitung PPh 21 pegawai tetap bulanan. |
| 2 | Hitung penyesuaian tahunan | Sistem harus menghitung penyesuaian tahunan pada masa pajak terakhir untuk kondisi tertentu. |
| 3 | Hitung pajak non-pegawai | Sistem harus menghitung pajak non-pegawai. |
| 4 | Hitung BPJS | Sistem harus menghitung komponen BPJS perusahaan dan karyawan. |
| 5 | Bentuk hasil kalkulasi | Sistem harus menghasilkan bruto, potongan, pajak, dan take home pay. |
| 6 | Simpan audit kalkulasi | Sistem harus menyimpan log audit perhitungan pada hasil kalkulasi. |

### 1.4.5 Kebutuhan Fungsional Modul Export

| No | Kebutuhan Fungsional | Penjelasan |
| --- | --- | --- |
| 1 | Generate XML BPMP | Sistem harus menghasilkan XML BPMP/Coretax berdasarkan data payroll periode aktif. |
| 2 | Validasi export XML | Sistem harus memvalidasi data export XML sebelum file dibentuk. |
| 3 | Download XML | Sistem harus memungkinkan download XML langsung di browser. |
| 4 | Bentuk slip PDF | Sistem harus membentuk slip gaji PDF untuk karyawan yang memenuhi syarat. |
| 5 | Download slip tunggal | Sistem harus memungkinkan download slip gaji per karyawan. |
| 6 | Download slip massal | Sistem harus memungkinkan download banyak slip gaji sekaligus dalam format ZIP. |

## 1.5 Kebutuhan Nonfungsional

| No | Aspek Nonfungsional | Kebutuhan |
| --- | --- | --- |
| 1 | Keamanan | Sistem harus memisahkan autentikasi user dengan data profil aplikasi. |
| 2 | Keamanan | Sistem harus membatasi akses fitur sensitif berdasarkan role. |
| 3 | Keamanan | Sistem harus memastikan hanya master user yang dapat mengelola user internal. |
| 4 | Keamanan | Sistem harus menggunakan session login tervalidasi sebelum user dapat mengakses route utama. |
| 5 | Kinerja | Sistem harus memproses kalkulasi payroll secara responsif di browser. |
| 6 | Kinerja | Sistem harus menghasilkan file XML dan PDF tanpa backend export terpisah. |
| 7 | Kemudahan Penggunaan | Sistem harus menyediakan navigasi yang sederhana antara halaman payroll dan users. |
| 8 | Kemudahan Penggunaan | Sistem harus menampilkan pesan kesalahan yang mudah dipahami. |
| 9 | Portabilitas | Sistem harus dapat diakses melalui browser modern. |
| 10 | Portabilitas | Sistem harus dapat dijalankan pada lingkungan yang mendukung Next.js dan Supabase. |
| 11 | Maintainability | Sistem harus memisahkan modul auth, user management, store payroll, engine kalkulasi, dan export service. |
| 12 | Maintainability | Sistem harus menggunakan tipe domain yang eksplisit untuk payroll, auth, dan slip gaji. |

## 1.6 Temuan Gap pada Tahap Analisis

| No | Gap | Dampak |
| --- | --- | --- |
| 1 | Data payroll belum dipersist ke database. | Data payroll masih dominan berada pada state client menggunakan Zustand. |
| 2 | Database aktual hanya mencakup `app_users`. | Data domain payroll belum tersimpan permanen. |
| 3 | Belum ada persistence histori payroll dan export. | Audit dan pelacakan historis masih terbatas. |
| 4 | Ada tipe domain yang belum dipakai aktif, seperti `InputPenyesuaianTahunan`. | Menunjukkan masih ada bagian desain domain yang belum terpakai pada implementasi. |

## 1.7 Catatan Diagram Bab 1

| Kolom | Isi |
| --- | --- |
| Diagram yang Disarankan | Use case diagram atau ringkasan alur fitur utama. |
| Aktor Utama | `Master User` dan `Staff User`. |
| Fitur yang Ditampilkan | Login, manage staff, payroll, export XML, dan export slip gaji. |

---

# BAB 2. SPESIFIKASI FUNGSIONAL

## 2.1 Modul Autentikasi dan Otorisasi

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Memastikan hanya user dengan akun valid di Supabase Auth dan profil aktif pada aplikasi yang dapat mengakses sistem. |
| Aktor | Master User; Staff User |
| Input | Email; Password; Session user aktif |
| Proses Inti | 1. User membuka halaman login.<br>2. Sistem menerima email dan password.<br>3. Sistem memverifikasi kredensial ke Supabase Auth.<br>4. Sistem mengambil profil user pada `app_users`.<br>5. Sistem memeriksa apakah profil tersedia dan aktif.<br>6. Sistem mengizinkan akses ke halaman payroll jika valid.<br>7. Sistem membatasi akses halaman `/users` hanya untuk role `master`. |
| Output | Pesan login berhasil/gagal; redirect ke `/bulk`; redirect ke `/unauthorized` untuk akses tanpa hak. |
| Aturan Bisnis | Akun yang berhasil login ke Supabase Auth tetapi belum memiliki profil aplikasi dianggap tidak valid; akun nonaktif tidak boleh masuk; role `staff` tidak boleh membuka halaman manajemen user. |

## 2.2 Modul Manajemen User Internal

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Mengelola akun internal yang dapat mengakses aplikasi payroll. |
| Aktor | Master User |
| Input | Nama lengkap user; email; password awal atau password baru; role; status aktif/nonaktif |
| Proses Inti | 1. Master user membuka halaman `Users`.<br>2. Sistem memverifikasi role master.<br>3. Sistem menampilkan daftar user internal.<br>4. Master user dapat membuat akun baru.<br>5. Master user dapat mengubah role user.<br>6. Master user dapat mengubah status aktif user.<br>7. Master user dapat mereset password user. |
| Output | Daftar user internal; pesan sukses/gagal create user; pesan sukses/gagal update role; pesan sukses/gagal update status; pesan sukses/gagal reset password. |
| Aturan Bisnis | Role akun master yang sedang login tidak dapat diubah dari panel ini; akun sendiri tidak dapat dinonaktifkan; sistem harus menjaga minimal satu master aktif; pembuatan user melibatkan pembuatan akun auth dan profil aplikasi. |

## 2.3 Modul Pengelolaan Payroll

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Memasukkan, mengimpor, mengubah, dan meninjau data payroll karyawan. |
| Aktor | Master User; Staff User |
| Input | File Excel payroll; data perusahaan untuk export; variabel payroll karyawan; konfigurasi tarif BPJS |
| Proses Inti | 1. User membuka halaman payroll.<br>2. User mengunggah file Excel atau memasukkan variabel payroll.<br>3. Sistem membaca dan memvalidasi data.<br>4. Sistem memetakan data menjadi struktur payroll per karyawan.<br>5. Sistem menyimpan data payroll di state aplikasi.<br>6. Sistem memicu perhitungan ulang ketika data berubah. |
| Output | Daftar atau matriks hasil payroll; nilai input bulanan per karyawan; hasil kalkulasi bulanan per karyawan. |
| Aturan Bisnis | Data payroll yang sedang diproses berada pada state aplikasi dan menjadi sumber utama perhitungan dan export selama sesi aktif. |

## 2.4 Modul Perhitungan Pajak dan BPJS

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Menghitung hasil payroll, PPh 21, dan BPJS berdasarkan data payroll karyawan. |
| Aktor | Master User; Staff User |
| Input | Data karyawan; input gaji bulanan; konfigurasi tarif; data non-pegawai; riwayat input bulanan |
| Proses Inti | 1. Sistem menentukan jalur perhitungan berdasarkan tipe karyawan.<br>2. Untuk pegawai tetap, sistem menjalankan engine pajak bulanan.<br>3. Untuk masa terakhir tertentu, sistem menjalankan penyesuaian tahunan.<br>4. Untuk non-pegawai, sistem menjalankan engine khusus non-pegawai.<br>5. Sistem menghitung komponen BPJS perusahaan dan karyawan.<br>6. Sistem mengembalikan hasil kalkulasi ke halaman payroll. |
| Output | Hasil kalkulasi payroll pegawai tetap; hasil kalkulasi pajak non-pegawai; hasil penyesuaian tahunan; log audit perhitungan. |
| Aturan Bisnis | Jalur perhitungan dipisahkan antara pegawai tetap dan non-pegawai; BPJS menjadi sub-proses dari jalur payroll tertentu; metode pajak memengaruhi bentuk hasil akhir. |

## 2.5 Modul Export XML BPMP

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Menghasilkan file XML BPMP/Coretax dari hasil payroll yang telah dihitung. |
| Aktor | Master User; Staff User |
| Input | Data perusahaan; data karyawan hasil payroll; pengaturan periode pajak |
| Proses Inti | 1. User memilih export XML dari halaman payroll.<br>2. Sistem membentuk payload export berdasarkan data payroll periode aktif.<br>3. Sistem memvalidasi header dan record XML.<br>4. Sistem membentuk dokumen XML.<br>5. Sistem memicu download file XML melalui browser. |
| Output | File XML BPMP/Coretax; pesan error apabila data export tidak valid. |
| Aturan Bisnis | Export XML hanya dapat dibentuk dari data payroll yang telah tersedia dan lolos validasi export. |

## 2.6 Modul Export Slip Gaji

| Aspek | Isi |
| --- | --- |
| Tujuan Modul | Menghasilkan slip gaji PDF per karyawan atau ZIP berisi banyak slip. |
| Aktor | Master User; Staff User |
| Input | Data payroll satu karyawan atau banyak karyawan; hasil perhitungan payroll |
| Proses Inti | 1. User memilih export slip gaji.<br>2. Sistem membentuk source slip dari data payroll.<br>3. Sistem membangun payload slip gaji.<br>4. Sistem merender PDF slip gaji.<br>5. Jika banyak slip dipilih, sistem menggabungkannya ke file ZIP.<br>6. Sistem memicu download file PDF atau ZIP di browser. |
| Output | File slip gaji PDF; file slip gaji ZIP; pesan error ketika slip tidak dapat dihasilkan. |
| Aturan Bisnis | Slip gaji PDF hanya tersedia untuk karyawan yang memenuhi kriteria pada modul slip gaji saat ini. |

## 2.7 Catatan Diagram Bab 2

| Kolom | Isi |
| --- | --- |
| Diagram yang Disarankan | Sequence diagram ringkas. |
| Skenario yang Ditampilkan | Login; akses manage staff; input payroll dan perhitungan; export XML; export slip gaji. |

---

# BAB 3. DESAIN DATABASE

## 3.1 Desain Database Aktual Saat Ini

| Kolom | Isi |
| --- | --- |
| Database Aktual | Supabase |
| Tabel Aplikasi yang Terdeteksi | `public.app_users` |
| Fungsi Utama | Menyimpan profil internal user aplikasi yang telah memiliki akun pada Supabase Auth |
| Cakupan Saat Ini | Fokus pada user internal, belum menyimpan domain payroll |

### 3.1.1 Struktur Tabel `app_users`

| Nama Kolom | Tipe Data | Keterangan |
| --- | --- | --- |
| `id` | uuid | Primary key dan foreign key ke `auth.users.id` |
| `email` | text | Email user, bersifat unik |
| `full_name` | text | Nama lengkap user |
| `role` | text | Role user, bernilai `master` atau `staff` |
| `is_active` | boolean | Penanda aktif atau nonaktif |
| `created_at` | timestamptz | Waktu pembuatan data |
| `updated_at` | timestamptz | Waktu perubahan terakhir |
| `created_by` | uuid | FK opsional ke `auth.users.id` |

### 3.1.2 Primary Key dan Foreign Key

| No | Jenis Relasi | Keterangan |
| --- | --- | --- |
| 1 | Primary Key | `id` menjadi primary key tabel `app_users`. |
| 2 | Foreign Key | `id` mereferensikan `auth.users(id)` dengan `on delete cascade`. |
| 3 | Foreign Key | `created_by` mereferensikan `auth.users(id)` dengan `on delete set null`. |

### 3.1.3 Constraint dan Index

| No | Jenis | Keterangan |
| --- | --- | --- |
| 1 | Unique | `email` harus unik. |
| 2 | Check Constraint | `role` hanya boleh bernilai `master` atau `staff`. |
| 3 | Index | Tersedia index untuk kolom `role`. |
| 4 | Index | Tersedia index untuk kolom `is_active`. |

### 3.1.4 Rule Keamanan Dasar

| No | Rule | Keterangan |
| --- | --- | --- |
| 1 | Row Level Security | Tabel `app_users` mengaktifkan row level security. |
| 2 | Policy Profil Sendiri | User terautentikasi dapat membaca profilnya sendiri. |
| 3 | Operasi Admin | Pengelolaan user dilakukan melalui Supabase admin client dari sisi server. |

## 3.2 Relasi Database Aktual

| No | Entitas | Hubungan |
| --- | --- | --- |
| 1 | `auth.users` | Menjadi sumber akun autentikasi. |
| 2 | `app_users` | Menjadi profil aplikasi internal. |
| 3 | Relasi Utama | `app_users.id` mereferensikan `auth.users.id`. |

## 3.3 Temuan Gap pada Database Aktual

| No | Gap Database | Dampak |
| --- | --- | --- |
| 1 | Belum ada tabel perusahaan | Data perusahaan masih dikelola di level UI/state. |
| 2 | Belum ada tabel master karyawan payroll | Data karyawan payroll belum dipersist permanen. |
| 3 | Belum ada tabel input gaji bulanan | Data input payroll belum tersimpan di database. |
| 4 | Belum ada tabel hasil kalkulasi payroll | Hasil payroll belum terdokumentasi permanen. |
| 5 | Belum ada histori export XML | Tidak ada log export XML yang persisten. |
| 6 | Belum ada histori slip gaji | Tidak ada log pembuatan slip gaji yang persisten. |

## 3.4 Desain Konseptual yang Direkomendasikan

| Nama Tabel Konseptual | Fungsi | Data yang Disimpan |
| --- | --- | --- |
| `companies` | Menyimpan identitas perusahaan | NPWP pemotong, ID TKU, nama perusahaan |
| `employees` | Menyimpan master karyawan payroll | ID karyawan, NIK, nama, status PTKP, resident status, tipe karyawan, jabatan |
| `payroll_inputs` | Menyimpan input payroll bulanan | Gaji pokok, tunjangan, bonus, natura, premi, potongan, konfigurasi tarif |
| `payroll_results` | Menyimpan hasil kalkulasi payroll | Bruto, potongan, PPh 21, BPJS, THP, status lebih bayar |
| `payroll_audit_logs` | Menyimpan audit langkah perhitungan | Langkah, deskripsi, nilai, rumus |
| `export_logs` | Menyimpan histori export | Periode, operator, waktu export, jenis dokumen |

## 3.5 Rekomendasi Penyajian Visual

| Kolom | Isi |
| --- | --- |
| Visual 1 | ERD aktual yang memuat `auth.users` dan `app_users`. |
| Visual 2 | ERD konseptual usulan pengembangan untuk modul payroll dan export. |
| Tujuan Penyajian | Membedakan implementasi aktual saat ini dan desain lanjutan yang direkomendasikan. |

---

# BAB 4. DOKUMEN DESAIN ARSITEKTUR

## 4.1 Gambaran Umum Arsitektur

| Kolom | Isi |
| --- | --- |
| Jenis Sistem | Aplikasi web berbasis Next.js |
| Mekanisme Auth | Supabase Auth |
| Database Aktual | Supabase `app_users` untuk user internal |
| Pola Pengolahan Payroll | Client-side payroll processing dengan Zustand dan tax engine |
| Pola Export | XML dan slip gaji dibentuk di browser dari state aktif |

## 4.2 Komponen Arsitektur Utama

| No | Komponen | Peran Utama |
| --- | --- | --- |
| 1 | Antarmuka Aplikasi Web | Menyediakan route dan komponen UI seperti login, payroll, users, unauthorized, dan detail karyawan. |
| 2 | Supabase Auth | Memverifikasi kredensial, menyimpan session, membuat akun auth, dan reset password. |
| 3 | Database User Internal | Menyimpan profil aplikasi, role, dan status aktif user. |
| 4 | Access Control | Menjaga route dan memastikan hanya user valid yang dapat mengakses halaman tertentu. |
| 5 | Payroll Store | Menyimpan state payroll, konfigurasi BPJS, input bulanan, dan hasil kalkulasi. |
| 6 | Calculation Engine | Menghitung pajak bulanan, penyesuaian tahunan, pajak non-pegawai, dan BPJS. |
| 7 | Export Service | Membentuk XML BPMP, slip gaji PDF, dan ZIP slip gaji. |

## 4.3 Hubungan Antar Komponen

| No | Hubungan | Penjelasan |
| --- | --- | --- |
| 1 | User ke Auth | User melakukan login melalui halaman login. |
| 2 | Auth ke Database User | Sistem memverifikasi profil aplikasi setelah login auth berhasil. |
| 3 | Access Control ke UI | Route payroll dan users ditampilkan berdasarkan status aktif dan role. |
| 4 | Payroll Page ke Payroll Store | Halaman payroll berinteraksi dengan store untuk menyimpan dan membaca data payroll. |
| 5 | Payroll Store ke Calculation Engine | Store memanggil engine saat data payroll diimpor atau diubah. |
| 6 | Payroll ke Export Service | Export XML dan slip menggunakan hasil payroll dari state aktif. |

## 4.4 Keputusan Desain Arsitektur

| No | Keputusan | Alasan |
| --- | --- | --- |
| 1 | Auth dilakukan di sisi server | Menjaga keamanan kredensial, session, dan operasi administrasi. |
| 2 | Perhitungan payroll dilakukan di sisi client | Memberikan interaksi cepat dan langsung pada halaman payroll. |
| 3 | Export dilakukan di browser | Mengurangi kebutuhan backend export terpisah dan memanfaatkan state aktif. |

## 4.5 Kelebihan Arsitektur Saat Ini

| No | Kelebihan | Penjelasan |
| --- | --- | --- |
| 1 | Modular | Auth, user management, payroll, engine, dan export sudah cukup terpisah. |
| 2 | Typed domain | Tipe domain cukup kaya untuk menjaga konsistensi proses bisnis. |
| 3 | Role access jelas | Pembatasan role `master` dan `staff` eksplisit dan mudah ditelusuri. |

## 4.6 Gap Arsitektur

| No | Gap Arsitektur | Dampak |
| --- | --- | --- |
| 1 | Belum ada persistence layer payroll | Data payroll belum tersimpan permanen. |
| 2 | Belum ada API backend khusus histori payroll | Audit jangka panjang masih terbatas. |
| 3 | Belum ada histori export persisten | Sulit melacak riwayat export operasional. |
| 4 | Perhitungan terikat ke state client | Kurang ideal untuk kerja multi-user dan audit historis. |

## 4.7 Rekomendasi Arsitektur Lanjutan

| No | Rekomendasi | Tujuan |
| --- | --- | --- |
| 1 | Tambahkan persistence layer payroll | Menyimpan input dan hasil payroll secara permanen. |
| 2 | Tambahkan service backend payroll | Mendukung audit dan orkestrasi yang lebih kuat. |
| 3 | Tambahkan log export | Mendukung pelacakan operasional dokumen. |

## 4.8 Catatan Diagram Bab 4

| Kolom | Isi |
| --- | --- |
| Diagram yang Disarankan | Diagram arsitektur sistem. |
| Komponen yang Ditampilkan | User, UI Next.js, Access Control, Supabase Auth, User Database, Payroll Store, Calculation Engine, dan Export Service. |

---

# BAB 5. DOKUMEN DESAIN ANTARMUKA PENGGUNA

## 5.1 Halaman Login

| Aspek | Isi |
| --- | --- |
| Tujuan Halaman | Menerima email dan password user internal sebelum masuk ke sistem payroll. |
| Elemen Inti | Input email; input password; tombol login; area pesan kesalahan login |
| Navigasi dan Interaksi | User memasukkan email dan password; sistem memverifikasi kredensial; jika valid dan aktif, user diarahkan ke payroll; jika gagal, sistem menampilkan error. |
| Output Sistem | Redirect ke `/bulk`; pesan kesalahan login |

## 5.2 Halaman Payroll / Bulk Page

| Aspek | Isi |
| --- | --- |
| Tujuan Halaman | Menjadi halaman utama pengolahan payroll setelah login. |
| Elemen Inti | Navigasi utama; upload Excel; kontrol periode pajak; tampilan data karyawan; form perubahan variabel; tombol export XML; tombol export slip |
| Navigasi dan Interaksi | User membuka halaman payroll; mengimpor data atau mengubah payroll; sistem menampilkan hasil perhitungan; user dapat memilih export XML atau slip; master user dapat melihat menu users. |
| Output Sistem | Ringkasan hasil payroll; data input bulanan; file XML BPMP; file slip gaji PDF atau ZIP |

## 5.3 Halaman User Management

| Aspek | Isi |
| --- | --- |
| Tujuan Halaman | Mengelola akun internal aplikasi oleh master user. |
| Elemen Inti | Form tambah user baru; daftar user internal; form ubah role; tombol enable/disable; form reset password |
| Navigasi dan Interaksi | Master user membuka menu users; sistem memverifikasi role; halaman menampilkan data user; master user menjalankan create, update role, update status, dan reset password. |
| Output Sistem | Daftar user; pesan sukses atau error pengelolaan user |

## 5.4 Halaman Unauthorized

| Aspek | Isi |
| --- | --- |
| Tujuan Halaman | Menampilkan penolakan akses saat user membuka route atau fitur tanpa hak akses yang sesuai. |
| Elemen Inti | Judul akses ditolak; pesan penjelasan; tombol kembali ke payroll |
| Navigasi dan Interaksi | User diarahkan ke halaman unauthorized ketika gagal melewati pembatasan role atau akses. |
| Output Sistem | Informasi bahwa user tidak memiliki hak akses |

## 5.5 Halaman Detail Karyawan

| Aspek | Isi |
| --- | --- |
| Status Relevansi | Halaman detail karyawan ada sebagai halaman sekunder pada project. |
| Fungsi | Menampilkan rincian data per karyawan. |
| Posisi dalam Sistem | Bukan alur utama inti dibanding login, payroll page, dan users page. |

## 5.6 Catatan Rancangan UI untuk Dokumen Word

| No | Kebutuhan Visual | Keterangan |
| --- | --- | --- |
| 1 | Screenshot halaman | Login, Payroll/Bulk, User Management, Unauthorized, dan bila perlu Detail Karyawan |
| 2 | Penanda elemen utama | Beri keterangan pada bagian penting di screenshot. |
| 3 | Ringkasan interaksi | Tambahkan penjelasan singkat alur penggunaan tiap halaman. |

---

# BAGIAN AKHIR PENDUKUNG

## A. Daftar Diagram yang Disarankan

| No | Nama Diagram | Tujuan |
| --- | --- | --- |
| 1 | Use Case Diagram | Menunjukkan aktor dan fitur utama sistem. |
| 2 | Sequence Diagram Login dan Akses Role | Menjelaskan alur autentikasi dan pembatasan role. |
| 3 | Sequence Diagram Manage Staff | Menjelaskan alur pengelolaan user internal. |
| 4 | Sequence Diagram Input Payroll, Perhitungan, dan Export | Menjelaskan alur utama bisnis payroll. |
| 5 | Class Diagram Domain Payroll dan Auth | Menjelaskan struktur class/DTO utama. |
| 6 | ERD Aktual dan ERD Konseptual | Menjelaskan desain database saat ini dan usulan lanjutan. |
| 7 | Diagram Arsitektur Sistem | Menjelaskan komponen dan hubungan antar subsistem. |

## B. Daftar Tabel yang Disarankan

| No | Nama Tabel | Isi |
| --- | --- | --- |
| 1 | Tabel kebutuhan fungsional | Merangkum fitur-fitur utama sistem. |
| 2 | Tabel kebutuhan nonfungsional | Merangkum kebutuhan keamanan, kinerja, portabilitas, dan maintainability. |
| 3 | Tabel struktur `app_users` | Menjelaskan database aktual. |
| 4 | Tabel perbandingan database aktual dan usulan | Menjelaskan gap persistence payroll. |
| 5 | Tabel modul sistem dan tanggung jawabnya | Menjelaskan pembagian komponen sistem. |

## C. Ringkasan Class / DTO / Engine Utama

| Kategori | Item | Deskripsi Singkat |
| --- | --- | --- |
| Tipe Auth | `AppUserProfile` | Profil user aplikasi lengkap |
| Tipe Auth | `CurrentUserProfile` | Profil user aktif yang dipakai pada sesi berjalan |
| Tipe Auth | `LoginFormState` | Status hasil submit form login |
| Tipe Payroll | `DataPerusahaan` | Data identitas perusahaan |
| Tipe Payroll | `DataKaryawan` | Data master karyawan payroll |
| Tipe Payroll | `KonfigurasiTarif` | Konfigurasi tarif payroll dan BPJS |
| Tipe Payroll | `InputGajiBulanan` | Data input payroll bulanan |
| Tipe Payroll | `InputNonPegawai` | Input pajak non-pegawai |
| Tipe Payroll | `HasilKalkulasiTetap` | Hasil kalkulasi payroll pegawai tetap |
| Tipe Payroll | `HasilKalkulasiNonPegawai` | Hasil kalkulasi non-pegawai |
| Tipe Payroll | `HasilPenyesuaianTahunan` | Hasil penyesuaian tahunan |
| Tipe Payroll | `LogAudit` | Audit langkah perhitungan |
| Tipe Slip | `SlipGajiSource` | Sumber data pembentuk slip |
| Tipe Slip | `SlipGajiPayload` | Payload final slip gaji |
| Tipe Slip | `SlipGajiLineItem` | Item rincian slip gaji |
| Engine / Service | `hitungPajakBulanan` | Engine pajak pegawai tetap bulanan |
| Engine / Service | `hitungPenyesuaianDesember` | Engine penyesuaian tahunan |
| Engine / Service | `hitungPajakNonPegawai` | Engine pajak non-pegawai |
| Engine / Service | `hitungKomponenBpjs` | Kalkulator BPJS |
| Engine / Service | `generateBpmpXml` | Generator XML BPMP |
| Engine / Service | `downloadSlipGajiPdf` | Export slip gaji per karyawan |
| Engine / Service | `downloadAllSlipGajiZip` | Export slip gaji massal |

## D. Asumsi Dokumen

| No | Asumsi | Keterangan |
| --- | --- | --- |
| 1 | Dasar dokumen | Dokumen disusun berdasarkan project aktual yang tersedia saat ini. |
| 2 | Format akademik | Struktur DCP-05 spesifik tidak tersedia di repo, sehingga format mengikuti deskripsi CP-300 yang diberikan. |
| 3 | Placeholder akademik | Nama kelompok, NIM, dosen, dan kelas masih placeholder dan perlu dilengkapi. |

## E. Catatan Gap Desain untuk Presentasi atau Bimbingan

| No | Gap | Penjelasan |
| --- | --- | --- |
| 1 | Database aktual terbatas | Database saat ini baru menangani user internal, belum menangani payroll. |
| 2 | Kalkulasi client-side | Perhitungan payroll, PPh 21, dan BPJS masih berjalan di client. |
| 3 | Export bergantung state aktif | XML dan slip gaji dibentuk dari state browser yang sedang aktif. |
| 4 | Tidak ada histori persisten | Histori payroll dan export belum tersimpan permanen. |

## Penutup

| Kolom | Isi |
| --- | --- |
| Kesimpulan | Payroll Coretax telah memiliki pondasi implementasi yang cukup jelas pada sisi autentikasi, otorisasi, manajemen user, kalkulasi payroll, dan export dokumen. |
| Catatan Pengembangan | Masih diperlukan penguatan pada persistence data payroll, histori export, dan arsitektur backend untuk kesiapan operasional yang lebih luas. |
| Fungsi Dokumen | Dokumen ini dapat digunakan sebagai dasar teknis dan akademik untuk menjelaskan kondisi sistem saat ini sekaligus arah pengembangannya. |
