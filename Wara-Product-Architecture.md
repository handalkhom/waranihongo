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

**Termasuk (v0.1–v0.4):** onboarding dengan uji cepat kana, sesi harian 30 menit dengan drill
kana, tes keluar Fase 0, dan pengaturan dengan ekspor (v0.1); kosakata, tata bahasa, dan kanji
N5 dengan SRS, jelajah konten, dan impor data (v0.2); jurnal kalimat anime, halaman progres
dengan tes mingguan, dan peta 12 bulan (v0.3); konten N4 dan simulasi JLPT N5 (v0.4).

**Di luar cakupan sampai keputusan baru:** login dan multi-pengguna, sinkronisasi antar perangkat
(v1.0), notifikasi native dan aplikasi mobile (v1.x), berkas audio, koreksi jurnal otomatis.

**Aturan produk di semua layar:**

- Teks UI dan pesan validasi berbahasa Indonesia; konten Jepang dalam kana/kanji. Romaji tampil
  hanya sesuai pengaturan `romajiAid` (`always | on-demand | off`), yang bebas diubah pembelajar
  kapan saja (keputusan pemilik, lihat `MEMORY.md`): default `on-demand` di fase 0; otomatis
  menjadi `off` saat akurasi kana ≥ 95% pada 200 review kana terakhir; default `off` mulai fase 1.
  Pembelajar boleh menyalakannya kembali kapan saja.
- Fase pembelajar diturunkan dari data review dan asesmen, tidak disimpan dan tidak dipilih.
  Fase 1 terbuka saat tes `kana-exit` lulus.
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
| Hiragana ~50%, katakana ~20% | Fase 0 singkat; uji cepat kana saat onboarding menjadi review pertama; batas item baru 20/hari khusus kana |
| Kosakata lisan di atas skor tes (salah baca, bukan salah arti) | Drill "baca kata utuh" sejak minggu 1 memakai kosakata anime yang sudah dikenal |
| Salah: ね ほ れ を ぴ, しゃ, っ; ン シ ツ ソ ノ; salah baca た け に (たすける, まける, にがて dibaca keliru padahal katanya dikenal) | Seed "lemah": ね ほ れ を ぴ た け に, しゃ しゅ しょ, っ; ン シ ツ ソ ノ. 11 grup rawan tertukar wajib; drill kontras berpasangan |
| Salah: に/で, kata sifat -na, から | Kartu tata bahasa ini `priority: true` di fase 1 |
| Cepat belajar, minta diukur objektif | Tes `kana-exit` dan tes mingguan otomatis; fase diturunkan dari data review dan asesmen, bukan tanggal |
| Nonton anime hampir tiap hari | Jurnal 2–3 kalimat/hari dalam kana; ekspor mingguan untuk tutor |
| Tujuan termasuk kerja | Tag `register` pada kosakata; label peringatan untuk ungkapan kasar |

## Layar dan Modul

**Modul dua tingkat.** Modul daun `kana`, `vocab`, `grammar`, `kanji` memiliki drill dan tampilan
detail item mereka sendiri dan tidak mengimpor modul lain. Modul penyusun `session` dan `learn`
boleh memakai modul daun lewat `index.ts`-nya. `journal`, `progress`, `settings` berdiri sendiri.
**Satu layar utama dimiliki tepat satu modul**; modul daun tidak memiliki route sendiri.

| Route | Modul | Layar |
| --- | --- | --- |
| `/mulai` | `session` | Onboarding dengan uji cepat kana (sekali) |
| `/` | `session` | Beranda |
| `/sesi` | `session` (drill dari modul daun) | Sesi berjalan (layar penuh) |
| `/tes/kana-exit` | `session` | Tes keluar Fase 0 (layar penuh) |
| `/belajar`, `/belajar/:type/:id` | `learn` (detail dan "Latih sekarang" dari modul daun) | Jelajah konten (v0.2) |
| `/jurnal`, `/jurnal/baru`, `/jurnal/:id` | `journal` | Jurnal kalimat anime (v0.3) |
| `/progres` | `progress` | Progres dan tes mingguan (v0.3) |
| `/pengaturan` | `settings` | Pengaturan |

Navigasi: tab bawah di bawah `lg` (Beranda, Belajar, Jurnal, Progres, Pengaturan), sidebar
mulai `lg`; tab yang layarnya belum dirilis tidak ditampilkan. `/sesi` dan `/tes/kana-exit`
menyembunyikan keduanya. Tanpa baris profil, semua route dialihkan ke `/mulai`; dengan profil,
`/mulai` dialihkan ke `/`.

## Layar

### Onboarding — `/mulai`

- **Tujuan:** membuat baris profil dan memetakan kana yang sudah dikuasai.
- **Isi, berurutan:** nama panggilan; target menit per hari (default 30); **uji cepat** hiragana
  dan katakana dasar; daftar seed lemah dari `seed/alan-weak.json` untuk item yang tidak tercakup
  uji cepat (misalnya しゃ しゅ しょ dan っ), ditampilkan sebagai kartu huruf yang bisa dicentang
  atau dibuang; pilihan `romajiAid` (default `on-demand`). Tidak ada pilihan fase.
- **Uji cepat:** tiap huruf tampil sekali dan dijawab dengan mengetik romaji (varian yang diterima
  dihitung benar, lihat Sesi). Setiap jawaban adalah review sungguhan: dinilai otomatis dari
  benar-salah dan waktu jawab, lalu ditulis bersama log-nya lewat `commitReview`.
- **Simpan** → `saveProfile` dengan seed yang dicentang sebagai `profile.weakSeeds`; seed itu
  diperkenalkan paling awal sebagai materi baru. Lalu dialihkan ke `/`.
- **Keadaan:** awal, uji berjalan, menyimpan, error (pesan di bawah tombol). Tidak ada keadaan
  kosong.

### Beranda — `/`

- **Isi:** sapaan dengan nama; streak ("{n} hari berturut-turut", dengan tanda bila hari
  pengampunan sudah terpakai minggu ini); jumlah due per tipe (kana; kosakata dan kanji mulai
  v0.2) dari `useLiveQuery`; tombol **"Mulai sesi hari ini"** (atau **"Lanjutkan sesi"** bila ada
  baris `sessions` hari ini yang `completed: false`); kartu **"Tes keluar Fase 0"** setelah setiap
  kana pernah diulang sekali, sampai tes itu lulus — pembelajar sendiri yang memilih kapan
  memulainya.
- **Peta 12 bulan (v0.3):** lima fase dengan posisi saat ini dan indikator on-track dari
  `progressSummary`.
- **Keadaan:** memuat (kerangka); kosong — belum ada review sama sekali → "Mulai dari kana" sebagai
  label tombol; berhasil; error.

### Sesi — `/sesi`

- **Tujuan:** menjalankan `SessionPlan` dari `planSession` satu aktivitas per waktu.
- **Susunan:** bilah atas berisi progres waktu dan tombol jeda; badan berisi aktivitas aktif;
  tidak ada navigasi lain.
- **Aktivitas** (urutan tampil): **Ulangan** kartu SRS yang due; **Materi baru** — unit
  kurikulum berikutnya (seed lemah lebih dulu), item diperkenalkan satu per satu dengan mnemonik,
  contoh, dan TTS, lalu langsung diuji sekali; **Produksi** — memakai item yang baru diperkenalkan:
  dikte (TTS → ketik kana), susun kata, atau "isi jurnal hari ini" (v0.3) bila belum ada entri hari
  itu.
- **Alokasi waktu:** ulangan tidak pernah dipotong; ulangan due yang melebihi jatahnya memakai
  jatah materi baru; jumlah item baru per hari dikurangi bila tumpukan ulangan besar.
- **Rating** hibrida. Drill objektif (kana→romaji, romaji→kana grid, dikte, baca kata utuh, uji
  cepat onboarding, tes `kana-exit`) dinilai otomatis dari benar-salah dan waktu jawab: pilihan
  ganda paling tinggi "Bagus", jawaban ketik bisa mencapai "Mudah". Kartu ingatan terbuka (arti
  kosakata, tata bahasa) menampilkan empat tombol "Lagi / Sulit / Bagus / Mudah", masing-masing
  dengan interval berikutnya. Varian romaji yang diterima (を o/wo, ん n/nn, ふ fu/hu, し shi/si,
  dan seterusnya) dihitung benar.
- **Drill kana** punya empat mode: kana→romaji (pilihan ganda, lalu ketik), romaji→kana (grid),
  dikte, baca kata utuh. Jawaban yang cocok dengan anggota lain grup rawan tertukar memajukan
  pasangan itu menjadi due sekarang dan menampilkan **drill kontras**: dua huruf berdampingan, pilih
  yang diminta, tiga kali berturut-turut. Untuk grup lebih dari dua anggota, pasangannya adalah dua
  huruf yang benar-benar tertukar. Drill kontras hanya latihan dan tidak dicatat sebagai review.
- **Persistensi:** setiap aktivitas selesai → review, log-nya, dan progres sesi ditulis dalam
  **satu** transaksi (`commitReview` bersama sesi). Menutup tab tidak menghilangkan progres dan
  tidak menghitung ganda; "Lanjutkan sesi" di Beranda melanjutkan dari aktivitas berikutnya.
- **Selesai:** ringkasan — item diulang, akurasi, item baru, menit aktual — dan tombol "Kembali ke
  Beranda". Bila waktu habis sebelum semua aktivitas, yang belum dikerjakan adalah produksi;
  materi baru sudah dikurangi planner sejak awal bila tumpukan ulangan besar.
- **Keadaan:** tanpa item due dan tanpa unit baru → "Tidak ada yang perlu dipelajari hari ini."
  (mulai v0.2 ditambah "Mau jelajah bebas?" dengan tautan ke `/belajar`); error pada
  `commitReview` → aktivitas tetap di layar dengan tombol coba lagi; jawaban tidak hilang.

### Tes keluar Fase 0 — `/tes/kana-exit`

- **Tujuan:** mengukur target fase 0 dari `docs/learning-plan.md` dan membuka fase 1.
- **Susunan:** layar penuh seperti `/sesi`, milik `session`; dimulai dari kartu "Tes keluar Fase 0"
  di Beranda.
- **Isi:** 50 kata acak dari set kata latihan baca, dengan pewaktu yang hanya menghitung waktu
  kata tampil. **Lulus** = 50 kata benar dengan total waktu tampil ≤ 2 menit. Setiap jawaban
  dinilai otomatis seperti drill objektif lain; hasil tes disimpan ke `assessments`. Bila belum
  lulus, tes bisa diulang dari kartu yang sama.
- **Cara menjawab:** setiap kata tampil dengan tombol "Siap"; pewaktu hanya berjalan selama kata
  tampil. "Siap" menyembunyikan kata dan menghentikan pewaktu; pembelajar mengetik romaji kata itu
  lalu "Kirim"; kata berikutnya tampil dan pewaktu berjalan lagi. Yang diukur kecepatan membaca,
  bukan kecepatan mengetik. Romaji dicocokkan dengan varian yang diterima dari kana penyusun kata
  (`romajiMatches`), sama seperti drill "baca kata utuh".
- **Keadaan:** memuat; berjalan — kata tampil (pewaktu dan nomor kata) atau mengetik (pewaktu
  berhenti); selesai — lulus (fase 1 terbuka) atau belum lulus dengan daftar kata yang salah;
  error dengan tombol coba lagi.

### Jelajah — `/belajar`, `/belajar/:type/:id` (v0.2)

- **Pemilik:** `learn`, yang memakai tampilan detail dan drill dari modul daun.
- **Daftar:** filter `?type=` (kana, kosakata, tata bahasa, kanji) dan `?phase=`; tiap item
  menampilkan status SRS (baru, belajar, dikuasai, lemah) sebagai lencana. Item fase yang belum
  terbuka tampil redup dengan keterangan "Terbuka setelah {syarat}".
- **Detail** (tampilan detail milik modul daun item itu): huruf/kata/pola besar; mnemonik (kana,
  bisa diedit → `customContent`); contoh dengan TTS; untuk kanji: bacaan on/kun yang relevan saja
  dan kosakata pembawa; untuk tata bahasa: struktur, contoh, `pitfalls`; riwayat review item (log
  terakhir, interval berikutnya). Tombol **"Latih sekarang"** menampilkan drill modul daun untuk
  satu item tanpa memengaruhi jadwal kecuali dijawab, dan satu-satunya jalan jelajah menyentuh
  SRS.
- **Keadaan:** memuat; kosong (filter tanpa hasil → "Tidak ada item untuk filter ini"); berhasil;
  error.

### Jurnal — `/jurnal`, `/jurnal/baru`, `/jurnal/:id` (v0.3)

- **Daftar:** entri per tanggal, terbaru di atas, filter `?status=` (`draft`, `needs_review`,
  `corrected`), tombol **"Ekspor minggu ini"** → teks rapi (tanggal, kalimat, tebakan, koreksi)
  disalin ke clipboard atau diunduh `.txt`.
- **Form entri** (RHF + Zod): sumber (anime, episode; opsional), **kalimat dalam kana** — wajib,
  ditolak bila mengandung huruf Latin dengan pesan "Tulis dalam kana, bukan romaji."; tebakan
  arti; konteks (opsional). Keyboard kana di layar untuk HP (grid kana, bukan IME).
- **Detail:** kalimat, tebakan, status; bagian **Koreksi** — kalimat benar, arti, catatan, diisi
  pembelajar dari hasil tutor; tombol "Tandai dikoreksi"; **"Kirim ke kosakata"** per kata yang
  ditandai (pilih rentang kana) → item kosakata buatan pembelajar `vocab:custom:<uuid>` dengan
  arti berupa teks bebas tulisan pembelajar (bukan kunci i18n), disimpan di `customContent`
  dengan `ReviewState` baru.
- **Keadaan:** kosong → "Belum ada entri. Tonton satu episode, catat tiga kalimat."; memuat;
  berhasil; error simpan dengan pesan di bawah tombol.

### Progres — `/progres` (v0.3)

- **Isi:** streak dan heatmap kalender; akurasi per grup rawan tertukar (daftar batang, grup
  terlemah di atas); kata dan kanji dikuasai per level; menit belajar per minggu; peta 12 bulan
  rinci dengan target tiap fase dari `docs/learning-plan.md` dan status on-track.
- **Tes mingguan:** kartu "Tes mingguan" muncul mulai Sabtu bila belum dikerjakan minggu itu —
  10 menit, 30 soal acak lintas modul dari item yang pernah dipelajari, hasil per modul disimpan
  ke `assessments` dan ditampilkan sebagai riwayat.
- **Keadaan:** kosong (belum ada sesi → "Progres muncul setelah sesi pertama"); memuat; berhasil;
  error. Grafik `aria-hidden` dengan tabel tersembunyi berisi angka yang sama.

### Pengaturan — `/pengaturan`

- `romajiAid` (lihat aturan romaji di atas); target menit; pilihan suara TTS (daftar suara
  `ja-JP` perangkat; bila tidak ada, peringatan "Suara Jepang tidak tersedia di perangkat ini;
  dikte dilewati"); tema terang/gelap; **Ekspor data** → berkas JSON
  `wara-export-YYYY-MM-DD.json`.
- **Impor data (v0.2)** → pemilih berkas, validasi penuh dulu, lalu dialog "Impor akan mengganti
  seluruh data di perangkat ini. Lanjutkan?" dengan tombol "Batal" dan "Ganti"; berkas yang gagal
  validasi ditolak dengan pesan dan tidak mengubah apa pun.
- **Keadaan:** memuat; berhasil (pesan "Tersimpan" per perubahan); error.

## Konten per Rilis

| Rilis | Konten minimum |
| --- | --- |
| v0.1 | Hiragana dan katakana lengkap (dasar, dakuten/handakuten, kombinasi, っ, ー, dan katakana tambahan untuk kata serapan seperti ティ ファ ウィ); **11** grup rawan tertukar: ね/れ/わ, ほ/は/ま, に/こ, き/け, っ/つ, しゃ/しょ, ン/シ/ツ/ソ, ノ/メ, ク/タ, コ/ユ, ル/レ; **≥ 60** kata latihan baca termasuk kosakata anime yang dikenal pembelajar; seed lemah; i18n id untuk semuanya |
| v0.2 | 600 kosakata N5 dengan contoh dan `register`; ~60 kartu tata bahasa N5 dengan `pitfalls`; 100 kanji dengan kosakata pembawa; `curriculum.json` fase 1 |
| v0.3 | — (fitur) |
| v0.4 | +600 kosakata N4; ~70 tata bahasa N4; kanji 100–300; bank soal simulasi N5 |

Konten adalah jalur kritis jadwal, bukan kode: konten N5 ditulis paralel sejak v0.1 agar siap
saat v0.2. Commit `content` diharapkan lebih banyak daripada `feat`.

## Roadmap Rilis

| Rilis | Isi | Syarat selesai |
| --- | --- | --- |
| **v0.1 Kana** | monorepo, `core` (FSRS, planner, konfusi, kurikulum) dengan tes, konten kana, onboarding dengan uji cepat kana, Beranda sederhana (tanpa peta 12 bulan), Sesi dengan 4 mode drill kana dan drill kontras, tes `kana-exit`, Pengaturan minimal (`romajiAid`, target menit, suara TTS, tema, ekspor data), PWA, deploy ke Vercel | Pembelajar menyelesaikan sesi kana harian di HP, offline; `docs/qa-session.md` lulus |
| **v0.2 N5** | konten dan drill kosakata, tata bahasa, kanji; kurikulum fase 1; unlock antar fase; modul `learn` (Jelajah); impor data | Fase 1 dijalani penuh dari aplikasi |
| **v0.3 Jurnal + Progres** | Jurnal, ekspor mingguan, Progres, tes mingguan, peta 12 bulan (Beranda dan Progres) | Jurnal mingguan disetor ke tutor dari aplikasi |
| **v0.4 N4 + Simulasi** | konten N4; simulasi JLPT N5 | Simulasi N5 tersedia |
| **v1.0 Sinkron** | backend (keputusan terbuka, `MEMORY.md`); TanStack Query; koreksi jurnal (opsional) | Progres sama di HP dan laptop |
| **v1.x Mobile** | `apps/mobile` (Expo) memakai `core` dan `content` | Notifikasi harian native |

## Cara Mengerjakan Sebuah Layar

Langkah kerja, bentuk delegasi, aturan tes, dan format laporan ada di `CLAUDE.md`; tidak
diulang di sini.
