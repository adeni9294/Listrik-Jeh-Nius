'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import Link from 'next/link';

export default function TambahTokoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [storeName, setStoreName] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [powerVa, setPowerVa] = useState('11000'); // Default ke 11 kVA untuk standar retail
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

      // 1. Insert Toko / Meteran Baru beserta Kata Sandi & Role Default
      const { data: inserted, error: insertError } = await supabase
        .from('meters')
        .insert([
          {
            name: storeName.trim(),
            store_name: storeName.trim(),
            meter_number: meterNumber.trim(),
            power_va: parseInt(powerVa),
            password: password.trim(),
            role: 'staff', // Default role toko baru adalah staff
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

      // 2. Otomatis login dengan menyimpan session toko aktif ke LocalStorage
      if (inserted) {
        localStorage.setItem('active_store_id', inserted.id);
        localStorage.setItem(
          'active_store_name',
          inserted.name || inserted.store_name
        );
        localStorage.setItem('active_meter_number', inserted.meter_number || '');
        localStorage.setItem('user_role', 'staff');

        // Dispatch Custom Event agar komponen Navigasi/Header merespons perubahan toko
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('store_changed'));
        }
      }

      // 3. Berhasil -> Redirect ke Dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Gagal menambah toko:', err);
      setErrorMessage(
        err?.message || 'Terjadi kesalahan saat menyimpan data toko.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tambah Toko Baru</h1>
          <p className="text-xs text-slate-500">Daftarkan lokasi atau meteran PLN baru</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
            <Store className="w-4 h-4 text-teal-700" /> Informasi Toko & Keamanan
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-medium text-slate-800"
              />
            </div>

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
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-mono text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-slate-400" /> Daya Listrik Terpasang (VA)
              </label>
              <select
                value={powerVa}
                onChange={(e) => setPowerVa(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-semibold text-slate-800"
              >
                {/* Kategori Toko Modern / Minimarket */}
                <optgroup label="Toko Modern / Minimarket (B2)">
                  <option value="6600">6.600 VA (B2)</option>
                  <option value="7700">7.700 VA (B2)</option>
                  <option value="11000">11.000 VA / 11 kVA (B2)</option>
                  <option value="13900">13.900 VA / 13,9 kVA (B2)</option>
                  <option value="16500">16.500 VA / 16,5 kVA (B2)</option>
                  <option value="22000">22.000 VA / 22 kVA (B2)</option>
                  <option value="33000">33.000 VA / 33 kVA (B2)</option>
                  <option value="41500">41.500 VA / 41,5 kVA (B2)</option>
                </optgroup>

                {/* Kategori Usaha Kecil / Ruko */}
                <optgroup label="Usaha Kecil / Kelontong (B1 / R1)">
                  <option value="900">900 VA (R1 / B1)</option>
                  <option value="1300">1.300 VA (R1 / B1)</option>
                  <option value="2200">2.200 VA (R1 / B1)</option>
                  <option value="3500">3.500 VA (B1)</option>
                  <option value="5500">5.500 VA (B1)</option>
                </optgroup>
              </select>
            </div>

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
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition text-slate-800 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
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
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl shadow-sm mt-2 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan Toko...
                </>
              ) : (
                'Simpan Toko Baru'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
