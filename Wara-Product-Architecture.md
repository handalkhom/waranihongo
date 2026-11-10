# Arsitektur Produk — Wara no Nihongo

Dokumen ini menjawab **apa isi produknya**: layar apa saja yang ada, modul mana pemiliknya, apa
yang ditampilkan dan dikerjakan tiap layar, konten apa yang dibutuhkannya, dan aturan produk yang
berlaku di semua layar. Ia berubah hanya bila sebuah layar atau fitur berubah. Keputusan
bertanggal, status, dan pertanyaan terbuka ada di `MEMORY.md`; cara kode bekerja ada di
`ARCHITECTURE.md`; profil dan rencana belajar pembelajar ada di `docs/learning-plan.md` dan
tidak diulang di sini.

## Sumber Kebenaran

| Topik | Acuan |
| --- | --- |
| Kebutuhan belajar: huruf lemah, grup rawan tertukar, perangkap tata bahasa, target per fase | `docs/learning-plan.md` §2–§3. Bila dokumen ini berbeda dari sana, **rencana belajar yang menang** |
| Bentuk data konten: field, enum, id | Skema Zod di `packages/content/src/schema/`. Bila dokumen ini berbeda, **skema yang menang** |
| Layar, modul, aturan produk | Dokumen ini |
| Cara kode bekerja | `ARCHITECTURE.md` |
| Aturan kerja, delegasi, verifikasi | `CLAUDE.md` |
| Keputusan bertanggal, status, pertanyaan terbuka | `MEMORY.md` |

## Cakupan

Aplikasi belajar bahasa Jepang **untuk satu pembelajar**, dipakai di HP dan laptop, berjalan
offline, dengan seluruh data di perangkat sampai v1.0.

**Termasuk (v0.1–v0.4):** onboarding, sesi harian 30 menit, drill kana, kosakata, tata bahasa,
dan kanji dengan SRS, jurnal kalimat anime, halaman progres dengan tes mingguan, pengaturan
dengan ekspor/impor, simulasi JLPT N5 (v0.4).

**Di luar cakupan sampai keputusan baru:** login dan multi-pengguna, sinkronisasi antar perangkat
(v1.0), notifikasi native dan aplikasi mobile (v1.x), berkas audio, koreksi jurnal otomatis.

**Aturan produk di semua layar:**

- Teks UI dan pesan validasi berbahasa Indonesia; konten Jepang dalam kana/kanji. Romaji tampil
  hanya sesuai pengaturan `romajiAid` (`always | on-demand | off`) dan otomatis menjadi `off`
  saat akurasi kana ≥ 95%.
- Setiap layar punya keadaan **memuat**, **kosong**, **berhasil**, dan **error** dengan tombol coba
  lagi. Tidak ada item due adalah keadaan kosong yang normal ("Semua sudah diulang hari ini"),
  bukan error.
- Setiap kana atau kanji pada kartu drill minimal 48 px dan dibungkus `lang="ja"`.
- Tombol jawaban drill minimal 56 px; kontrol lain 44 px di bawah `md`, 36 px mulai `md`.
- Tidak ada fitur yang mengirim data keluar perangkat. Ekspor adalah tindakan eksplisit pengguna.

## Pembelajar dan Dampaknya ke Produk

Ringkasan dari `docs/learning-plan.md`; ubah di sana, bukan di sini.

| Fakta | Dampak produk |
| --- | --- |
| Hiragana ~50%, katakana ~20% | Fase 0 singkat; batas item baru 20/hari khusus kana |
| Kosakata lisan di atas skor tes (salah baca, bukan salah arti) | Drill "baca kata utuh" sejak minggu 1 memakai kosakata anime yang sudah dikenal |
| Salah: ね ほ れ を ぴ, しゃ, っ; ン シ ツ ソ ノ | Seed "lemah" saat onboarding; grup rawan tertukar wajib; drill kontras berpasangan |
| Salah: に/で, kata sifat -na, から | Kartu tata bahasa ini `priority: true` di fase 1 |
| Cepat belajar, minta diukur objektif | Tes mingguan otomatis; fase terbuka dari data, bukan tanggal |
| Nonton anime hampir tiap hari | Jurnal 2–3 kalimat/hari dalam kana; ekspor mingguan untuk tutor |
| Tujuan termasuk kerja | Tag `register` pada kosakata; label peringatan untuk ungkapan kasar |

## Layar dan Modul

**Satu layar utama = satu modul**, kecuali `/` dan `/mulai` yang dimiliki `session`.

| Route | Modul | Layar |
| --- | --- | --- |
| `/mulai` | `session` | Onboarding (sekali) |
| `/` | `session` | Beranda |
| `/sesi` | `session` | Sesi berjalan (layar penuh) |
| `/belajar`, `/belajar/:type/:id` | `kana`, `vocab`, `grammar`, `kanji` (satu halaman daftar bersama di `src/components/`, detail per modul) | Jelajah konten |
| `/jurnal`, `/jurnal/baru`, `/jurnal/:id` | `journal` | Jurnal kalimat anime |
| `/progres` | `progress` | Progres dan tes mingguan |
| `/pengaturan` | `settings` | Pengaturan |

Navigasi: tab bawah di bawah `lg` (Beranda, Belajar, Jurnal, Progres, Pengaturan), sidebar
mulai `lg`. `/sesi` menyembunyikan keduanya. Tanpa baris profil, semua route dialihkan ke
`/mulai`; dengan profil, `/mulai` dialihkan ke `/`.

## Layar

### Onboarding — `/mulai`

- **Tujuan:** membuat baris profil dan menanam seed lemah.
- **Isi:** nama panggilan; target menit per hari (default 30); fase awal (default 0); daftar
  seed lemah dari `seed/alan-weak.json` ditampilkan sebagai kartu huruf yang bisa dicentang atau
  dibuang; pilihan `romajiAid` (default `on-demand`).
- **Simpan** → `saveProfile`, lalu setiap seed yang dicentang menjadi `ReviewState` dengan
  `seededWeak: true` lewat `commitReview` (tanpa log), lalu dialihkan ke `/`.
- **Keadaan:** awal, menyimpan, error (pesan di bawah tombol). Tidak ada keadaan kosong.

### Beranda — `/`

- **Isi:** sapaan dengan nama; streak ("{n} hari berturut-turut", dengan tanda bila hari
  pengampunan sudah terpakai minggu ini); jumlah due per tipe (kana, kosakata, kanji) dari
  `useLiveQuery`; tombol **"Mulai sesi hari ini"** (atau **"Lanjutkan sesi"** bila ada baris
  `sessions` hari ini yang `completed: false`); peta 12 bulan: lima fase dengan posisi saat ini dan
  indikator on-track dari `progressSummary`.
- **Keadaan:** memuat (kerangka); kosong — belum ada review sama sekali → "Mulai dari kana" sebagai
  label tombol; berhasil; error.

### Sesi — `/sesi`

- **Tujuan:** menjalankan `SessionPlan` dari `planSession` satu aktivitas per waktu.
- **Susunan:** bilah atas berisi progres waktu dan tombol jeda; badan berisi aktivitas aktif;
  tidak ada navigasi lain.
- **Aktivitas** (urutan dari planner): **Ulangan** kartu SRS — pertanyaan, jawaban terbuka, empat
  tombol rating "Lagi / Sulit / Bagus / Mudah", masing-masing menampilkan interval berikutnya;
  **Materi baru** — unit kurikulum berikutnya, item diperkenalkan satu per satu dengan mnemonik,
  contoh, dan TTS, lalu langsung diuji sekali; **Produksi** — dikte (TTS → ketik kana), susun
  kata, atau "isi jurnal hari ini" bila belum ada entri hari itu.
- **Drill kana** punya empat mode: kana→romaji (pilihan ganda, lalu ketik), romaji→kana (grid),
  dikte, baca kata utuh. Jawaban salah yang cocok dengan anggota grup rawan tertukar menampilkan
  **drill kontras**: dua huruf berdampingan, pilih yang diminta, tiga kali berturut-turut.
- **Persistensi:** setiap aktivitas selesai → `commitReview` dan `saveSession`. Menutup tab tidak
  menghilangkan progres; "Lanjutkan sesi" di Beranda melanjutkan dari aktivitas berikutnya.
- **Selesai:** ringkasan — item diulang, akurasi, item baru, menit aktual — dan tombol "Kembali ke
  Beranda". Bila waktu habis sebelum semua aktivitas, planner sudah menaruh materi baru terakhir,
  jadi yang terlewat adalah materi baru, bukan ulangan.
- **Keadaan:** tanpa item due dan tanpa unit baru → "Tidak ada yang perlu dipelajari hari ini.
  Mau jelajah bebas?" dengan tautan ke `/belajar`; error pada `commitReview` → aktivitas tetap di
  layar dengan tombol coba lagi; jawaban tidak hilang.

### Jelajah — `/belajar`, `/belajar/:type/:id`

- **Daftar:** filter `?type=` (kana, kosakata, tata bahasa, kanji) dan `?phase=`; tiap item
  menampilkan status SRS (baru, belajar, dikuasai, lemah) sebagai lencana. Item fase yang belum
  terbuka tampil redup dengan keterangan "Terbuka setelah {syarat}".
- **Detail:** huruf/kata/pola besar; mnemonik (kana, bisa diedit → `customContent`); contoh
  dengan TTS; untuk kanji: bacaan on/kun yang relevan saja dan kosakata pembawa; untuk tata
  bahasa: struktur, contoh, `pitfalls`; riwayat review item (log terakhir, interval berikutnya).
  Tombol **"Latih sekarang"** memulai drill satu item tanpa memengaruhi jadwal kecuali dijawab,
  dan satu-satunya jalan jelajah menyentuh SRS.
- **Keadaan:** memuat; kosong (filter tanpa hasil → "Tidak ada item untuk filter ini"); berhasil;
  error.

### Jurnal — `/jurnal`, `/jurnal/baru`, `/jurnal/:id`

- **Daftar:** entri per tanggal, terbaru di atas, filter `?status=` (`draft`, `needs_review`,
  `corrected`), tombol **"Ekspor minggu ini"** → teks rapi (tanggal, kalimat, tebakan, koreksi)
  disalin ke clipboard atau diunduh `.txt`.
- **Form entri** (RHF + Zod): sumber (anime, episode; opsional), **kalimat dalam kana** — wajib,
  ditolak bila mengandung huruf Latin dengan pesan "Tulis dalam kana, bukan romaji."; tebakan
  arti; konteks (opsional). Keyboard kana di layar untuk HP (grid kana, bukan IME).
- **Detail:** kalimat, tebakan, status; bagian **Koreksi** — kalimat benar, arti, catatan, diisi
  pembelajar dari hasil tutor; tombol "Tandai dikoreksi"; **"Kirim ke kosakata"** per kata yang
  ditandai (pilih rentang kana) → item `vocab` baru di `customContent` dengan `ReviewState` baru.
- **Keadaan:** kosong → "Belum ada entri. Tonton satu episode, catat tiga kalimat."; memuat;
  berhasil; error simpan dengan pesan di bawah tombol.

### Progres — `/progres`

- **Isi:** streak dan heatmap kalender; akurasi per grup rawan tertukar (daftar batang, grup
  terlemah di atas); kata dan kanji dikuasai per level; menit belajar per minggu; peta 12 bulan
  rinci dengan target tiap fase dari `docs/learning-plan.md` dan status on-track.
- **Tes mingguan:** kartu "Tes mingguan" muncul mulai Sabtu bila belum dikerjakan minggu itu —
  10 menit, 30 soal acak lintas modul dari item yang pernah dipelajari, hasil per modul disimpan
  ke `assessments` dan ditampilkan sebagai riwayat.
- **Keadaan:** kosong (belum ada sesi → "Progres muncul setelah sesi pertama"); memuat; berhasil;
  error. Grafik `aria-hidden` dengan tabel tersembunyi berisi angka yang sama.

### Pengaturan — `/pengaturan`

- `romajiAid`; target menit; pilihan suara TTS (daftar suara `ja-JP` perangkat; bila tidak ada,
  peringatan "Suara Jepang tidak tersedia di perangkat ini; dikte dilewati"); tema terang/gelap;
  **Ekspor data** → berkas JSON `wara-export-YYYY-MM-DD.json`; **Impor data** → pemilih berkas,
  validasi penuh dulu, lalu dialog "Impor akan mengganti seluruh data di perangkat ini. Lanjutkan?"
  dengan tombol "Batal" dan "Ganti"; berkas yang gagal validasi ditolak dengan pesan dan tidak
  mengubah apa pun.
- **Keadaan:** memuat; berhasil (pesan "Tersimpan" per perubahan); error.

## Konten per Rilis

| Rilis | Konten minimum |
| --- | --- |
| v0.1 | Hiragana dan katakana lengkap (dasar, dakuten/handakuten, kombinasi, っ, ー); 8 grup rawan tertukar; 40 kata latihan baca termasuk kosakata anime yang dikenal pembelajar; seed lemah; i18n id untuk semuanya |
| v0.2 | — (fitur) |
| v0.3 | 600 kosakata N5 dengan contoh dan `register`; ~60 kartu tata bahasa N5 dengan `pitfalls`; 100 kanji dengan kosakata pembawa; `curriculum.json` fase 1 |
| v0.4 | +600 kosakata N4; ~70 tata bahasa N4; kanji 100–300; bank soal simulasi N5 |

Konten adalah jalur kritis jadwal, bukan kode. Commit `content` diharapkan lebih banyak daripada
`feat`.

## Roadmap Rilis

| Rilis | Isi | Syarat selesai |
| --- | --- | --- |
| **v0.1 Kana** | monorepo, `core` (FSRS, planner, konfusi, kurikulum) dengan tes, konten kana, onboarding, Beranda, Sesi dengan 4 mode drill, Jelajah, Pengaturan (ekspor/impor), PWA | Pembelajar menyelesaikan sesi kana harian di HP, offline; `docs/qa-session.md` lulus |
| **v0.2 Jurnal + Progres** | Jurnal, ekspor mingguan, Progres, tes mingguan | Jurnal mingguan disetor ke tutor dari aplikasi |
| **v0.3 N5** | konten dan drill kosakata, tata bahasa, kanji; kurikulum fase 1; unlock antar fase | Fase 1 dijalani penuh dari aplikasi |
| **v0.4 N4 + Simulasi** | konten N4; simulasi JLPT N5 | Simulasi N5 tersedia |
| **v1.0 Sinkron** | backend (keputusan terbuka, `MEMORY.md`); TanStack Query; koreksi jurnal (opsional) | Progres sama di HP dan laptop |
| **v1.x Mobile** | `apps/mobile` (Expo) memakai `core` dan `content` | Notifikasi harian native |

## Cara Mengerjakan Sebuah Layar

Langkah kerja, bentuk delegasi, aturan tes, dan format laporan ada di `CLAUDE.md`; tidak
diulang di sini.