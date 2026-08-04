'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, LogIn, Loader2, PlusCircle, Lock, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [meterNumber, setMeterNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Cek kecocokan Nomor Meter DAN Password di database
      const { data: meter, error } = await supabase
        .from('meters')
        .select('*')
        .eq('meter_number', meterNumber.trim())
        .eq('password', password.trim())
        .single();

      if (error || !meter) {
        throw new Error('Nomor Meter atau Kata Sandi Toko salah!');
      }

      // 2. Jika valid, simpan session toko aktif ke LocalStorage
      localStorage.setItem('active_store_id', meter.id);
      localStorage.setItem('active_store_name', meter.name || meter.store_name);
      localStorage.setItem('active_meter_number', meter.meter_number);

      // 3. Masuk ke Dashboard Utama
      router.push('/');
      router.refresh();
    } catch (err: any) {
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
            Gunakan Nomor Meter & Kata Sandi Toko
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Nomor Meter / ID Pelanggan
              </label>
              <input
                type="text"
                required
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                placeholder="Contoh: 14028821992"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi Toko
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
              <Button variant="outline" className="w-full text-xs border-slate-200 text-slate-700 font-medium">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Daftar Toko Baru
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
