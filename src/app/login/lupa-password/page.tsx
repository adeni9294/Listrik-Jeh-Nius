'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, Eye, EyeOff, Lock, CreditCard, Store } from 'lucide-react';
import Link from 'next/link';

export default function LupaPasswordPage() {
  const supabase = createClient();

  const [meterNumber, setMeterNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const cleanMeter = meterNumber.trim();
      const cleanStore = storeName.trim();
      const cleanPass = newPassword.trim();

      if (!cleanMeter || !cleanStore || !cleanPass) {
        throw new Error('Mohon isi semua kolom yang tersedia.');
      }

      // 1. Verifikasi kecocokan ID PLN & Nama Toko
      const { data: meters, error } = await supabase
        .from('meters')
        .select('id, store_name, name')
        .eq('meter_number', cleanMeter)
        .or(`store_name.ilike.%${cleanStore}%,name.ilike.%${cleanStore}%`);

      if (error || !meters || meters.length === 0) {
        throw new Error('Kombinasi Nomor Meter & Nama Toko tidak ditemukan!');
      }

      const targetMeter = meters[0];

      // 2. Update Password Baru
      const { error: updateError } = await supabase
        .from('meters')
        .update({ password: cleanPass })
        .eq('id', targetMeter.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal mereset kata sandi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pt-12 max-w-sm mx-auto">
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold text-slate-800">Reset PIN / Sandi Toko</h1>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-700" /> Verifikasi Identitas Toko
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {success ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Kata sandi berhasil diperbarui! Mengalihkan ke halaman login...</span>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                  {errorMessage}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Nomor Meter PLN
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 14028821992"
                  value={meterNumber}
                  onChange={(e) => setMeterNumber(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" /> Nama Toko Terdaftar
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: VB04"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> Kata Sandi / PIN Baru
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Masukkan Kata Sandi Baru"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl shadow-sm mt-2 transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                  </>
                ) : (
                  'Simpan Kata Sandi Baru'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
