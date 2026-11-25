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
- Fase pembelajar diturunkan dari hasil asesmen, tidak disimpan dan tidak dipilih, dan bertingkat:
  Fase 1 terbuka saat tes `kana-exit` lulus; Fase 2 saat skor terbaik simulasi JLPT N5 ≥ 80%;
  Fase 3 saat skor terbaik simulasi JLPT N4 ≥ 70% (target terukur di `docs/learning-plan.md` §4).
  Simulasi JLPT N5 hadir di v0.4 (sampai saat itu pembelajar berada paling tinggi di Fase 1);
  simulasi N4 belum dijadwalkan di roadmap.
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
- **Isi, berurutan:** nama panggilan; target menit per hari, dipilih dari 15, 20, 30, 45, atau
  60 menit (default 30); **uji cepat** kana dasar; daftar seed lemah — kartu huruf dari
  `seed/alan-weak.json` yang dapat dilatih dan belum punya data review setelah uji cepat, yaitu
  huruf di luar uji cepat (ぴ, しゃ, しゅ, しょ) ditambah seed yang dilewati dengan "Belum kenal";
  semua tercentang di awal dan bisa dibuang. っ tidak ditampilkan karena tidak pernah dilatih
  sendiri (dilatih lewat kata). Terakhir, pilihan bantuan romaji (`romajiAid`): Selalu tampil /
  Tampil saat diminta (default) / Tidak tampil. Tidak ada pilihan fase.
- **Uji cepat:** semua 92 kana dasar (46 hiragana + 46 katakana) — semua hiragana dulu, lalu semua
  katakana, masing-masing diacak sehingga urutan tabel tidak memberi petunjuk. Tiap huruf dijawab
  dengan mengetik romaji (varian yang diterima dihitung benar, lihat Sesi). Setiap jawaban adalah
  review sungguhan: dinilai otomatis dari benar-salah dan waktu jawab, lalu ditulis bersama
  log-nya lewat `commitReview`. Huruf yang sudah punya data review tidak ditanyakan lagi, jadi uji
  yang terputus (tab ditutup) dilanjutkan dari huruf yang belum dijawab. Tombol **"Belum kenal"**
  melewati huruf itu tanpa menulis review: huruf tetap berstatus baru dan nanti diperkenalkan
  dengan mnemonik di Materi baru.
- **Simpan** → `saveProfile` membuat profil (tema `system`, suara default) dengan seed yang
  dicentang sebagai `profile.weakSeeds`; seed itu diperkenalkan paling awal sebagai materi baru.
  Lalu dialihkan ke `/`.
- **Keadaan:** memuat; isi profil; uji berjalan (bila jawaban gagal disimpan: "Jawaban gagal
  disimpan. Coba jawab lagi."); menyimpan ("Menyimpan…"); error simpan ("Profil gagal disimpan.
  Coba lagi." di bawah tombol); gagal membaca data → layar "Terjadi kesalahan". Tidak ada keadaan
  kosong.

### Beranda — `/`

- **Isi:** judul "Beranda"; sapaan "Halo, {nama}"; streak ("{n} hari berturut-turut"; tanda bila
  hari pengampunan sudah terpakai minggu ini belum di v0.1); **"Perlu diulang: {n}"** — satu angka
  total item due dari `useLiveQuery` (rincian due per tipe — kana; kosakata dan kanji mulai v0.2 —
  belum di v0.1); satu tombol sesuai keadaan sesi hari ini:
  - **"Lanjutkan sesi"** bila ada baris `sessions` hari ini yang `completed: false`;
  - **"Sesi hari ini selesai."** disertai tombol **"Mulai sesi lagi"** bila sesi hari ini sudah
    selesai;
  - selain itu **"Mulai sesi hari ini"**.

  Kartu **"Tes keluar Fase 0"** dengan tautan **"Mulai tes"** ke `/tes/kana-exit`, tampil setelah
  setiap kana yang punya bunyi sendiri (っ, ッ, ー tidak dihitung) pernah diulang sekali, sampai tes
  itu lulus — pembelajar sendiri yang memilih kapan memulainya.
- **Peta 12 bulan (v0.3):** lima fase dengan posisi saat ini dan indikator on-track dari
  `progressSummary`. Belum di v0.1; menunggu ringkasan progres.
- **Keadaan:** memuat (kerangka); berhasil; error. Keadaan kosong — belum ada review sama sekali →
  "Mulai dari kana" sebagai label tombol — belum di v0.1.

### Sesi — `/sesi`

- **Tujuan:** menjalankan `SessionPlan` dari `planSession` satu aktivitas per waktu.
- **Susunan:** layar penuh, tanpa tab bawah atau sidebar. Bilah atas berisi tombol **"Keluar"**
  (kembali ke Beranda; sesi tetap belum selesai dan bisa dilanjutkan dari Beranda) dan baris
  progres "Bagian i dari n · {label} · Sisa n", dengan label **Ulangan**, **Huruf baru**, atau
  **Latihan** sesuai aktivitas; badan berisi aktivitas aktif; tidak ada navigasi lain. Progres
  waktu dan tombol jeda belum di v0.1.
- **Waktu sesi:** target menit harian dari profil menjadi waktu sesi yang direncanakan
  (`availableMin` untuk `planSession`).
- **Aktivitas** (urutan tampil): **Ulangan** kartu SRS yang due; **Materi baru** — unit
  kurikulum berikutnya (seed lemah lebih dulu), item diperkenalkan satu per satu, lalu langsung
  diuji. Di v0.1, kana baru tampil dulu sebagai **kartu kenalan** — huruf besar, romaji kecil,
  mnemonik bila ada, tombol "Dengar" (TTS) dan "Mengerti" — lalu drill pilihan ganda; kosakata
  baru langsung masuk latihan membaca tanpa kartu kenalan; **Produksi** — memakai item yang baru
  diperkenalkan: pada fase 0, kana diuji bergantian acak antara dikte (dengar, lalu pilih hurufnya
  dari grid) dan romaji→kana (grid), tanpa keyboard Jepang; fase berikutnya dapat memakai dikte
  ketik kana, susun kata, atau "isi jurnal hari ini" (v0.3) bila belum ada entri hari itu.
- **Alokasi waktu:** ulangan tidak pernah dipotong; ulangan due yang melebihi jatahnya memakai
  jatah materi baru; jumlah item baru per hari dikurangi bila tumpukan ulangan besar.
- **Rating** hibrida. Drill objektif (kana→romaji, romaji→kana grid, dikte, baca kata utuh, uji
  cepat onboarding, tes `kana-exit`) dinilai otomatis dari benar-salah dan waktu jawab: pilihan
  ganda paling tinggi "Bagus", jawaban ketik bisa mencapai "Mudah". Kartu ingatan terbuka (arti
  kosakata, tata bahasa) menampilkan empat tombol "Lagi / Sulit / Bagus / Mudah", masing-masing
  dengan interval berikutnya. Varian romaji yang diterima (を o/wo, ん n/nn, ふ fu/hu, し shi/si,
  dan seterusnya) dihitung benar.
- **Drill kana** punya empat mode: kana→romaji (pilihan ganda, lalu ketik); romaji→kana (grid);
  dikte — TTS membacakan kana, lalu pembelajar memilih hurufnya dari grid, tanpa keyboard Jepang;
  baca kata utuh — ketik romaji; bila salah, romaji yang benar ditampilkan. Jawaban yang cocok
  dengan anggota lain grup rawan tertukar (mis. ね dijawab "re") memajukan pasangan itu menjadi due
  sekarang dan menampilkan **drill kontras** langsung setelah umpan balik jawaban: dua huruf
  berdampingan, yang diminta disebut dalam romaji ("Pilih: ne" — pilih ね atau れ), posisi kedua
  huruf diacak setiap putaran, dan harus benar **tiga kali berturut-turut**; jawaban salah
  mengembalikan hitungan ke 0. Setelah itu sesi berlanjut ke drill berikutnya. Untuk grup lebih
  dari dua anggota, pasangannya adalah dua huruf yang benar-benar tertukar. Drill kontras hanya
  latihan dan tidak dicatat sebagai review.
- **Umpan balik jawaban:** jawaban benar menampilkan "Benar" lalu lanjut sendiri setelah jeda
  singkat; jawaban salah menampilkan jawaban yang benar dan menunggu tombol "Lanjut". Berlaku untuk
  semua drill objektif.
- **Jawaban salah:** item itu muncul lagi di akhir bagian yang sama sampai dijawab benar; setiap
  percobaan, benar maupun salah, tercatat sebagai review.
- **Persistensi:** setiap jawaban → review, log-nya, dan progres sesi ditulis dalam **satu**
  transaksi (`commitReview` bersama sesi). Menutup tab tidak menghilangkan progres dan tidak
  menghitung ganda. "Lanjutkan sesi" di Beranda membuka kembali bagian yang sedang berjalan dengan
  disaring: ulangan yang sudah tidak jatuh tempo dan huruf baru yang sudah punya catatan review
  dilewati; bagian latihan diulang dari awal.
- **Selesai:** judul "Sesi selesai", ringkasan "{n} jawaban, {m} benar.", dan tombol "Kembali ke
  Beranda". Ringkasan lengkap — item diulang, akurasi, item baru, menit aktual — belum di v0.1.
  Bila waktu habis sebelum semua aktivitas, yang belum dikerjakan adalah produksi; materi baru
  sudah dikurangi planner sejak awal bila tumpukan ulangan besar.
- **Keadaan:** memuat; rencana kosong (tanpa item due dan tanpa unit baru) → "Tidak ada yang perlu
  dilatih sekarang." dengan tombol "Kembali ke Beranda" (mulai v0.2 ditambah "Mau jelajah bebas?"
  dengan tautan ke `/belajar`); jawaban gagal disimpan → peringatan "Jawaban gagal disimpan. Coba
  jawab lagi." dan huruf yang sama ditanyakan lagi; jawaban tidak hilang.

### Tes keluar Fase 0 — `/tes/kana-exit`

- **Tujuan:** mengukur target fase 0 dari `docs/learning-plan.md` dan membuka fase 1.
- **Susunan:** layar penuh seperti `/sesi`, milik `session`; dimulai dari kartu "Tes keluar Fase 0"
  di Beranda.
- **Isi:** 50 kata acak dari kata latihan baca bawaan (kata tambahan sendiri tidak ikut), dengan
  pewaktu yang hanya menghitung waktu kata tampil. **Lulus** = 50 kata benar dengan total waktu
  tampil ≤ 2 menit. Setiap jawaban dinilai otomatis seperti drill objektif lain; hasil tes
  disimpan ke `assessments`.
- **Cara menjawab:** setiap kata tampil dengan tombol "Siap"; pewaktu hanya berjalan selama kata
  tampil. "Siap" menyembunyikan kata dan menghentikan pewaktu; pembelajar mengetik romaji kata itu
  lalu "Kirim"; kata berikutnya tampil dan pewaktu berjalan lagi. Yang diukur kecepatan membaca,
  bukan kecepatan mengetik. Romaji dicocokkan dengan varian yang diterima dari kana penyusun kata
  (`romajiMatches`), sama seperti drill "baca kata utuh".
- **Selama tes:** tidak ada umpan balik benar/salah per kata; setelah "Kirim" langsung kata
  berikutnya. Header menampilkan "Kata {n} dari 50" dan "Waktu tampil m:ss / 2:00".
- **Selalu sampai 50:** tes tetap berjalan sampai kata ke-50 walau sudah pasti tidak lulus; setiap
  jawaban tetap tercatat sebagai ulangan.
- **Keluar di tengah:** jawaban yang sudah dikirim tetap tercatat sebagai ulangan; tidak ada hasil
  tes yang disimpan.
- **Hasil:** "Lulus" (Fase 1 terbuka) atau "Belum lulus" dengan jumlah benar, total waktu tampil,
  dan daftar kata yang salah beserta romaji yang benar. Keduanya kembali ke Beranda; tes diulang
  dari kartu di Beranda.
- **Akses langsung lewat URL:** belum tersedia → "Tes ini terbuka setelah setiap kana pernah
  diulang sekali."; sudah lulus → "Kamu sudah lulus tes ini."; keduanya dengan tautan ke Beranda.
- **Keadaan:** memuat; berjalan — kata tampil (pewaktu dan nomor kata) atau mengetik (pewaktu
  berhenti); selesai — hasil di atas; jawaban gagal disimpan → "Jawaban gagal disimpan. Coba kirim
  lagi." dan kata yang sama ditanyakan lagi; hasil tes gagal disimpan → tombol "Simpan lagi".

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

- `romajiAid` (lihat aturan romaji di atas); target menit (pilihan sama dengan onboarding: 15,
  20, 30, 45, 60); pilihan suara TTS (daftar suara `ja-JP` perangkat; bila tidak ada, peringatan
  "Suara Jepang tidak tersedia di perangkat ini; dikte dilewati"); tema (ikuti sistem / terang /
  gelap; default ikuti sistem); **Ekspor data** → berkas JSON `wara-export-YYYY-MM-DD.json`.
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
