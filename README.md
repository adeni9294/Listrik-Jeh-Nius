# ⚡ Listrik Jenius - PWA Energy Assistant

**Listrik Jenius** adalah Progressive Web Application (PWA) berbasis AI & OCR *offline-first* yang dirancang khusus untuk membantu pengguna listrik prabayar PLN mengontrol, memprediksi, dan mengoptimalkan penggunaan kWh harian.

## 🚀 Fitur Utama
- 📸 **AI Vision & OCR Scanner:** Pembacaan meteran listrik otomatis dari foto menggunakan Tesseract.js & AI Validation Engine.
- 📉 **Pemakaian & Prediksi Daya:** Estimasi sisa hari token dan prediksi konsumsi listrik harian.
- 🔌 **Smart Device Estimator:** Breakdown perkiraan pemakaian daya berdasarkan alat elektronik di rumah.
- 📶 **Offline-First Storage:** Tetap dapat mencatat & memindai meteran tanpa koneksi internet menggunakan IndexedDB (Dexie.js).
- 🏥 **AI Health Check:** Deteksi dini potensi anomali pemakaian daya dan saran pembelian token listrik.

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router), TypeScript
- **UI & Styling:** TailwindCSS, Lucide Icons, Shadcn UI
- **Local DB (Offline):** Dexie.js (IndexedDB)
- **Cloud Backend:** Supabase (Auth, PostgreSQL, Storage)
- **OCR Engine:** Tesseract.js & Browser Image Compression
