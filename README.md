# 📍 iNDRIASTIGPSMAP — GPS Map & Timestamp Camera INDRI ASTI

Aplikasi Android profesional untuk dokumentasi lapangan dengan stempel GPS akurat, kompresi adaptif target 200 KB ultra-jernih, dan penyimpanan langsung ke album galeri Android (`Pictures/iNDRIASTIGPSMAP`).

Dibuat menggunakan **HTML, CSS, JavaScript, dan Capacitor**, dirancang untuk dibangun menjadi berkas APK Android secara otomatis melalui **GitHub Actions** di cloud tanpa memerlukan Android Studio atau Android SDK di komputer pengguna.

---

## ✨ Fitur Utama

1. **🛰️ Stempel & Telemetri GPS Akurat:**
   - Koordinat Latitude & Longitude real-time (bukan data palsu).
   - Akurasi GPS (dalam meter) & Elevasi ketinggian mdpl.
   - Arah kompas derajat & mata angin (contoh: `142° SE`).
   - Tanggal & waktu lokal Indonesia.
   - Peta radar kompas taktis 100% offline.
   - Catatan / keterangan survei kustom.

2. **📸 Viewfinder & Kamera Lapangan:**
   - Preview kamera langsung di layar.
   - Tombol ganti kamera depan & belakang.
   - Tombol senter / flash / torch (jika didukung perangkat).
   - Dukungan kamera native bawaan HP jika diperlukan.
   - Tampilan stempel langsung (*live watermark overlay*) sebelum memotret.

3. **🎯 Kompresi Adaptif Target Maksimal 200 KB:**
   - Menggunakan algoritma kompresi adaptif cerdas (penurunan kualitas dan resolusi bertahap).
   - Mempertahankan rasio aspek asli foto.
   - Tampilan pratinjau sebelum menyimpan, lengkap dengan informasi ukuran file riil (contoh: `184.2 KB`) dan status target.

4. **💾 Penyimpanan Langsung ke Galeri Android:**
   - Tersimpan langsung ke MediaStore Android di album publik `Pictures/iNDRIASTIGPSMAP`.
   - Format penamaan standar lapangan: `GEO_YYYYMMDD_HHMMSS.jpg` (contoh: `GEO_20261020_194512.jpg`).
   - Riwayat foto dapat langsung dilihat di tab galeri internal aplikasi.

5. **🔒 100% Privasi & Mandiri:**
   - Seluruh foto, koordinat, dan kompresi diproses secara lokal di perangkat.
   - Tidak ada pengiriman data ke server luar.
   - Tidak memerlukan akun atau login.
   - Kamera dan stempel tetap berfungsi saat offline / area blank spot.

---

## 📁 Struktur Berkas Proyek

```text
iNDRIASTIGPSMAP/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions CI/CD untuk build APK otomatis
├── android/                       # Proyek native Android Capacitor + Gradle Wrapper
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml # Izin Kamera, Lokasi, Penyimpanan
│   │   │   └── java/com/indriasti/gpsmap/
│   │   │       ├── MainActivity.java
│   │   │       └── NativeGalleryPlugin.java # Plugin MediaStore & Location Settings
│   │   └── build.gradle
│   ├── gradlew                    # Script Gradle Wrapper Linux/macOS
│   ├── gradlew.bat                # Script Gradle Wrapper Windows
│   └── gradle/wrapper/            # Gradle Wrapper JAR & Properties
├── www/                           # Direktori aset web hasil build
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── icon.svg
│   └── manifest.json
├── index.html                     # Tampilan utama aplikasi web
├── style.css                      # Gaya antarmuka modern & responsif
├── script.js                      # Logika kamera, GPS, kompresi, & watermark
├── package.json                   # Dependency Capacitor & script proyek
├── capacitor.config.json          # Konfigurasi Capacitor Android
├── build.js                       # Script sinkronisasi web ke www/
├── icon.svg                       # Ikon aplikasi vektor HD
├── manifest.json                  # Web App Manifest
└── README.md                      # Panduan lengkap penggunaan
```

---

## 🚀 Panduan Build APK via GitHub (Tanpa Android Studio)

Anda **tidak perlu** menginstal Android Studio, Java, atau Android SDK di komputer. Cukup ikuti 11 langkah mudah berikut:

### Langkah 1: Buat Repository GitHub Baru
1. Buka [GitHub.com](https://github.com) dan masuk ke akun Anda.
2. Klik tombol **New** (atau ikon **+** di pojok kanan atas -> *New repository*).
3. Beri nama repository, misalnya: `iNDRIASTIGPSMAP`.
4. Pilih opsi **Public** atau **Private**.
5. Klik **Create repository**.

### Langkah 2: Upload Seluruh File Proyek
Unggah seluruh folder dan berkas dari proyek `iNDRIASTIGPSMAP` ini ke repository GitHub Anda:

**Cara A (Melalui Terminal / Git Bash):**
```bash
cd C:\Users\User\iNDRIASTIGPSMAP
git init
git add .
git commit -m "Inisialisasi iNDRIASTIGPSMAP v1.0"
git branch -M main
git remote add origin https://github.com/USERNAME_ANDA/iNDRIASTIGPSMAP.git
git push -u origin main
```

**Cara B (Melalui Halaman Web GitHub):**
- Di halaman repository baru Anda, klik tautan **uploading an existing file**.
- Tarik (*drag & drop*) seluruh berkas dan folder (pastikan folder `.github`, `android`, `www`, `index.html`, dll. ikut terunggah).
- Klik tombol **Commit changes**.

### Langkah 3: Buka Tab Actions
- Pada halaman utama repository GitHub Anda, klik tab **Actions** di bilah menu atas.

### Langkah 4: Pilih Workflow "Build Android APK"
- Di menu bilah kiri, klik nama workflow: **Build Android APK**.

### Langkah 5: Jalankan Workflow
- Klik tombol **Run workflow** di sebelah kanan.
- Pastikan branch yang dipilih adalah `main` (atau `master`).
- Klik tombol hijau **Run workflow**.

### Langkah 6: Tunggu Proses Build Selesai
- GitHub Actions akan menjalankan mesin virtual Ubuntu untuk menyusun APK secara otomatis.
- Proses biasanya memakan waktu sekitar **2–4 menit**.
- Tanda centang hijau (**passed**) akan muncul jika proses kompilasi berhasil.

### Langkah 7: Unduh File APK
- Klik pada nama workflow yang selesai dijalankan.
- Gulir ke bagian paling bawah ke bagian **Artifacts**.
- Klik pada berkas **`iNDRIASTIGPSMAP-debug-apk`**.
- File ZIP akan otomatis terunduh ke komputer atau HP Anda.

### Langkah 8: Ekstrak File ZIP
- Ekstrak berkas `iNDRIASTIGPSMAP-debug-apk.zip` yang baru saja diunduh.
- Di dalamnya terdapat berkas instalasi **`app-debug.apk`**.

### Langkah 9: Pindahkan APK ke HP Android
- Pindahkan berkas `app-debug.apk` ke HP Android Anda (bisa melalui kabel USB, WhatsApp Web, Google Drive, atau Bluetooth).

### Langkah 10: Izinkan Instalasi dari Sumber Tak Dikenal
- Buka file `app-debug.apk` di HP Anda.
- Jika muncul peringatan keamanan *"Izinkan instalasi dari sumber ini"*, klik **Setelan (Settings)** dan aktifkan izin tersebut.

### Langkah 11: Buka Aplikasi & Berikan Izin
- Buka aplikasi **iNDRIASTIGPSMAP**.
- Berikan izin:
  - **Kamera**: Untuk mengambil foto dokumentasi.
  - **Lokasi / GPS**: Untuk membaca koordinat satelit dan akurasi.
  - **Media / Galeri**: Untuk menyimpan foto ke album `Pictures/iNDRIASTIGPSMAP`.
- Aplikasi siap digunakan di lapangan!

---

## 💡 Tips Penggunaan di Lapangan

- **Mencari Sinyal GPS:** Saat berada di dalam ruangan bertingkat, sinyal GPS satelit mungkin memerlukan waktu beberapa saat untuk mengunci (*lock*). Bawa perangkat ke dekat jendela atau ke luar ruangan untuk mendapatkan akurasi optimal (di bawah 10 meter).
- **Pengaturan Lokasi Mati:** Jika GPS dinonaktifkan di sistem Android, banner merah peringatan akan muncul di aplikasi dengan tombol langsung untuk membuka setelan lokasi HP.
- **Memotret Offline:** Dalam kondisi blank spot tanpa internet, Anda tetap dapat memotret. Koordinat satelit GNSS dan radar kompas tetap tercatat secara akurat pada watermark.
- **Kustomisasi Watermark:** Klik tombol roda gigi ⚙️ untuk menyesuaikan target ukuran kompresi (150 KB / 200 KB / 300 KB), mengubah catatan lapangan, atau mengatur elemen stempel yang ingin ditampilkan.

---

## 📜 Lisensi & Pengembang

Dibuat untuk kebutuhan survei teknis dan dokumentasi lapangan profesional:
**iNDRIASTIGPSMAP — GPS Map & Timestamp Camera INDRI ASTI**
Lisensi: MIT. Bebas digunakan dan dikembangkan lebih lanjut.
