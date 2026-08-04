'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Store,
  LogIn,
  Loader2,
  PlusCircle,
  Lock,
  CreditCard,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [identifier, setIdentifier] = useState(''); // Mengakomodasi Kode Toko, Nama Toko, atau Nomor Meter
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanInput = identifier.trim();
      const cleanPassword = password.trim();

      if (!cleanInput || !cleanPassword) {
        throw new Error('Mohon isi semua kolom yang tersedia.');
      }

      // 1. Cari toko berdasarkan Kode/Nama Toko ATAU Nomor Meter (case-insensitive)
      const { data: meters, error } = await supabase
        .from('meters')
        .select('*')
        .or(
          `meter_number.ilike.%${cleanInput}%,store_name.ilike.%${cleanInput}%,name.ilike.%${cleanInput}%`
        );

      if (error || !meters || meters.length === 0) {
        throw new Error('Kode Toko, Nama Toko, atau Nomor Meter tidak ditemukan!');
      }

      // Ambil hasil pencocokan pertama
      const matchedMeter = meters[0];

      // 2. Cek kecocokan Kata Sandi Toko / PIN
      if (matchedMeter.password && matchedMeter.password.trim() !== cleanPassword) {
        throw new Error('Kata Sandi Toko / PIN salah!');
      }

      // 3. Tentukan Peran Pengguna (Admin vs Staff)
      const userRole = matchedMeter.role || 'staff';

      // 4. Simpan Session Toko Aktif & Role Pengguna ke LocalStorage
      localStorage.setItem('active_store_id', matchedMeter.id);
      localStorage.setItem(
        'active_store_name',
        matchedMeter.store_name || matchedMeter.name || 'Toko'
      );
      localStorage.setItem('active_meter_number', matchedMeter.meter_number || '');
      localStorage.setItem('user_role', userRole);

      // Dispatch Custom Event agar Header/Navigasi merespons perubahan toko secara real-time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('store_changed'));
      }

      // 5. Masuk ke Dashboard Utama
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Gagal masuk. Periksa kembali data Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pt-12 max-w-sm mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mx-auto mb-2">
            <Store className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-bold text-slate-800">
            Masuk Listrik Jenius
          </CardTitle>
          <p className="text-xs text-slate-500">
            Gunakan Kode Toko / ID Pelanggan PLN & Kata Sandi
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Kode Toko / Nomor Meter
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Contoh: VB04 atau 14028821992"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi Toko / PIN
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 pr-9 text-slate-800"
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
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl flex items-center justify-center gap-2 mt-2 shadow-sm transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Masuk ke Toko
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-2">Belum mendaftarkan toko?</p>
            <Link href="/toko/tambah">
              <Button
                variant="outline"
                className="w-full text-xs border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Daftar Toko Baru
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
