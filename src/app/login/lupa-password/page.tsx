'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function LupaPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [meterNumber, setMeterNumber] = useState('');
  const [storeName, setStoreName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Verifikasi kecocokan ID PLN & Nama Toko
      const { data: meter, error } = await supabase
        .from('meters')
        .select('id')
        .eq('meter_number', meterNumber.trim())
        .ilike('store_name', `%${storeName.trim()}%`)
        .single();

      if (error || !meter) {
        throw new Error('Kombinasi Nomor Meter & Nama Toko tidak ditemukan!');
      }

      // 2. Update Password Baru
      const { error: updateError } = await supabase
        .from('meters')
        .update({ password: newPassword.trim() })
        .eq('id', meter.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Meter PLN
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Toko Terdaftar
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi / PIN Baru
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan Kata Sandi Baru"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl shadow-sm mt-2 transition"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
