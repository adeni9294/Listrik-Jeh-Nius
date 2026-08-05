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
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  // Mode Login: 'staff' atau 'admin'
  const [loginMode, setLoginMode] = useState<'staff' | 'admin'>('admin');

  // Input States
  const [identifier, setIdentifier] = useState(''); // Kode Toko, Nama Toko, atau Nomor Meter (Khusus Staff)
  const [password, setPassword] = useState(''); // Kata Sandi Staff ATAU PIN Master Admin
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PIN MASTER ADMIN (Ubah sesuai kebutuhan Anda)
  const MASTER_ADMIN_PIN = '456456';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanInput = identifier.trim();
      const cleanPassword = password.trim();

      if (!cleanPassword || (loginMode === 'staff' && !cleanInput)) {
        throw new Error('Mohon isi semua kolom yang diperlukan.');
      }

      // ----------------------------------------------------
      // 1. LOGIKA LOGIN SEBAGAI ADMIN / OWNER
      // ----------------------------------------------------
      if (loginMode === 'admin') {
        if (cleanPassword !== MASTER_ADMIN_PIN) {
          throw new Error('PIN Master Admin salah! Masukkan PIN yang benar.');
        }

        // Cari toko pertama di DB untuk dijadikan default active_store_id jika ada
        const { data: meters } = await supabase
          .from('meters')
          .select('id, store_name')
          .limit(1);

        const defaultStoreId = meters && meters.length > 0 ? meters[0].id : 'admin-global';
        const defaultStoreName = meters && meters.length > 0 ? meters[0].store_name : 'Semua Toko';

        // Bersihkan sesi lama & Set Sesi Admin Baru
        localStorage.clear();
        sessionStorage.clear();

        localStorage.setItem('active_store_id', defaultStoreId);
        localStorage.setItem('active_store_name', defaultStoreName);
        localStorage.setItem('user_role', 'admin');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('store_changed'));
        }

        window.location.href = '/';
        return;
      }

      // ----------------------------------------------------
      // 2. LOGIKA LOGIN SEBAGAI STAFF TOKO
      // ----------------------------------------------------
      const { data: meters, error } = await supabase
        .from('meters')
        .select('*')
        .or(
          `meter_number.ilike.%${cleanInput}%,store_name.ilike.%${cleanInput}%,name.ilike.%${cleanInput}%`
        );

      if (error || !meters || meters.length === 0) {
        throw new Error('Kode Toko, Nama Toko, atau Nomor Meter tidak ditemukan!');
      }

      const matchedMeter = meters[0];

      // Cek kecocokan password toko (jika kolom password diisi di DB)
      if (matchedMeter.password && matchedMeter.password.trim() !== cleanPassword) {
        throw new Error('Kata Sandi Toko / PIN salah!');
      }

      const userRole = matchedMeter.role || 'staff';

      // Set Sesi Staff
      localStorage.clear();
      sessionStorage.clear();

      localStorage.setItem('active_store_id', matchedMeter.id);
      localStorage.setItem(
        'active_store_name',
        matchedMeter.store_name || matchedMeter.name || 'Toko'
      );
      localStorage.setItem('active_meter_number', matchedMeter.meter_number || '');
      localStorage.setItem('user_role', userRole);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('store_changed'));
      }

      window.location.href = '/';
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Gagal masuk. Periksa kembali data Anda.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pt-10 max-w-sm mx-auto">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        {/* TAB NAVIGATION LOGIN MODE */}
        <div className="grid grid-cols-2 bg-slate-100 p-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              loginMode === 'admin'
                ? 'bg-white text-amber-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" /> Admin / Owner
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('staff');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
              loginMode === 'staff'
                ? 'bg-white text-teal-800 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Store className="w-4 h-4 text-teal-600" /> Staff Toko
          </button>
        </div>

        <CardHeader className="text-center pb-2 pt-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
              loginMode === 'admin'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-teal-50 text-teal-700'
            }`}
          >
            {loginMode === 'admin' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <Store className="w-6 h-6" />
            )}
          </div>
          <CardTitle className="text-lg font-bold text-slate-800">
            {loginMode === 'admin' ? 'Masuk Sesi Admin' : 'Masuk Listrik Jenius'}
          </CardTitle>
          <p className="text-xs text-slate-500">
            {loginMode === 'admin'
              ? 'Masukkan PIN Master Admin untuk akses semua toko'
              : 'Gunakan Kode Toko / ID Pelanggan PLN & Kata Sandi'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            {loginMode === 'staff' ? (
              /* FORM KHUSUS STAFF */
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
            ) : (
              /* INFO KHUSUS ADMIN */
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                🔑 <strong>Akses Admin:</strong> Memberikan kontrol global ke seluruh toko, ekspor CSV, dan pemantauan perbandingan pindaian.
              </div>
            )}

            {/* INPUT PASSWORD / PIN */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                {loginMode === 'admin' ? (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" /> PIN Master Admin
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi Toko / PIN
                  </>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={loginMode === 'admin' ? 'Masukkan Pin Admin' : '••••••••'}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 pr-9 text-slate-800 font-mono font-bold"
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
              {loginMode === 'admin' && (
                <span className="text-[10px] text-slate-400 block mt-1">
                  Default PIN: <strong className="font-mono text-slate-600">123456</strong>
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={`w-full font-bold text-xs py-5 rounded-xl flex items-center justify-center gap-2 mt-2 shadow-sm transition ${
                loginMode === 'admin'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : loginMode === 'admin' ? (
                <>
                  <ShieldCheck className="w-4 h-4" /> Masuk Sebagai Admin
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
