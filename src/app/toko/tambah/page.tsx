'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Store,
  Zap,
  CreditCard,
  ArrowLeft,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function TambahTokoPage() {
  const supabase = createClient();

  const [storeName, setStoreName] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [powerVa, setPowerVa] = useState('33000');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (!storeName.trim() || !meterNumber.trim() || !password.trim()) {
        throw new Error('Mohon lengkapi semua kolom yang wajib diisi.');
      }

      // 1. Insert Toko dengan Role 'staff'
      const { data: inserted, error: insertError } = await supabase
        .from('meters')
        .insert([
          {
            name: storeName.trim(),
            store_name: storeName.trim(),
            meter_number: meterNumber.trim(),
            power_va: parseInt(powerVa),
            password: password.trim(),
            role: 'staff',
          },
        ])
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Nomor Meter atau Nama Toko ini sudah terdaftar.');
        }
        throw insertError;
      }

      // 2. Bersihkan storage lama & simpan Sesi Akses Lokal Baru
      if (inserted) {
        localStorage.clear();
        sessionStorage.clear();

        localStorage.setItem('active_store_id', inserted.id);
        localStorage.setItem(
          'active_store_name',
          inserted.name || inserted.store_name
        );
        localStorage.setItem('active_meter_number', inserted.meter_number || '');
        localStorage.setItem('user_role', inserted.role || 'staff');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('store_changed'));
        }
      }

      // 3. Masuk ke Dashboard Utama dengan hard refresh
      window.location.href = '/';
    } catch (err: any) {
      console.error('Gagal menambah toko:', err);
      setErrorMessage(
        err?.message || 'Terjadi kesalahan saat menyimpan data toko.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 pt-10 sm:pt-16 max-w-md mx-auto">
      {/* Header Back Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9 text-slate-700 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800">Tambah Toko Baru</h1>
          <p className="text-xs text-slate-500">Daftarkan lokasi atau meteran PLN baru</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 pt-6 border-b border-slate-100">
          <CardTitle className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-700" /> Informasi Toko & Keamanan
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 p-6">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nama Toko */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Nama Toko / Lokasi / Kode
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: VB04 - Toko Pasar Anyar"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-medium text-slate-800"
              />
            </div>

            {/* Nomor Meter PLN (Tanpa Tombol Cek PLN Fiktif) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Nomor Meter / ID Pelanggan PLN
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 14028821992"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-mono text-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Nomor meter fisik atau ID pelanggan yang terpasang di lokasi toko.
              </p>
            </div>

            {/* Daya Listrik (VA) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-slate-400" /> Daya Listrik Terpasang (VA)
              </label>
              <select
                value={powerVa}
                onChange={(e) => setPowerVa(e.target.value)}
                className="w-full text-xs sm:text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-semibold text-slate-800"
              >
                <optgroup label="Bisnis / Menengah-Atas (Tegangan Rendah)">
                  <option value="33000">33.000 VA / 33 kVA (B-3)</option>
                  <option value="22000">22.000 VA / 22 kVA (B-2)</option>
                  <option value="16500">16.500 VA / 16,5 kVA (B-2)</option>
                  <option value="13900">13.900 VA / 13,9 kVA (B-2)</option>
                  <option value="11000">11.000 VA / 11 kVA (B-2)</option>
                  <option value="7700">7.700 VA (B-2)</option>
                  <option value="6600">6.600 VA (B-2)</option>
                </optgroup>
                <optgroup label="Usaha Kecil / Kelontong & Rumah Tangga">
                  <option value="5500">5.500 VA (B1 / R1)</option>
                  <option value="3500">3.500 VA (B1 / R1)</option>
                  <option value="2200">2.200 VA (R1 / B1)</option>
                  <option value="1300">1.300 VA (R1 / B1)</option>
                  <option value="900">900 VA (R1 / B1)</option>
                </optgroup>
              </select>
            </div>

            {/* Kata Sandi Toko */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi Toko / PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Buat Kata Sandi / PIN Toko"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition text-slate-800 pr-10 font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs sm:text-sm py-5 rounded-xl shadow-sm mt-2 transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan Toko...
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" /> Simpan Toko Baru
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
