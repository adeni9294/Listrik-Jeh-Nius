'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Zap, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TambahTokoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [storeName, setStoreName] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [powerVa, setPowerVa] = useState('1300');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Cek User Authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Sesi Anda telah berakhir. Silakan login terlebih dahulu.');
      }

      // 2. Insert Toko / Meteran Baru ke Tabel `meters`
      const { error: insertError } = await supabase.from('meters').insert([
        {
          user_id: user.id,
          store_name: storeName,
          meter_number: meterNumber,
          power_va: parseInt(powerVa),
        },
      ]);

      if (insertError) throw insertError;

      // 3. Berhasil -> Redirect ke Dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Gagal menambah toko:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan data toko.');
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
            <Store className="w-4 h-4 text-teal-700" /> Informasi Toko & Meteran
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" /> Nama Toko / Lokasi
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Toko Cabang Pasar Anyar"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition"
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
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition font-mono"
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
                <option value="900">900 VA (R1 / B1)</option>
                <option value="1300">1300 VA (R1 / B1)</option>
                <option value="2200">2200 VA (R1 / B1)</option>
                <option value="3500">3500 VA (B2)</option>
                <option value="5500">5500 VA &gt; (B2)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-5 rounded-xl shadow-sm mt-2"
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
