'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // SESUAIKAN DENGAN ALAMAT INSTANSI SUPABASE KAMU
import { useRouter } from 'next/navigation';

export default function TambahTokoPage() {
  const router = useRouter();
  const [storeName, setStoreName] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [powerVa, setPowerVa] = useState('1300');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Silakan login terlebih dahulu.');

      const { error } = await supabase.from('meters').insert([
        {
          user_id: user.id,
          store_name: storeName,
          meter_number: meterNumber,
          power_va: parseInt(powerVa),
        },
      ]);

      if (error) throw error;

      alert('Toko berhasil didaftarkan!');
      router.push('/'); // Kembali ke Dashboard Utama
      router.refresh();
    } catch (err: any) {
      alert(`Gagal menambah toko: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Daftarkan Toko / Meteran Baru</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nama Toko / Lokasi</label>
          <input
            type="text"
            required
            placeholder="Contoh: Toko Cabang Pasar Anyar"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nomor Meter / ID Pelanggan PLN</label>
          <input
            type="text"
            required
            placeholder="Contoh: 14028821992"
            value={meterNumber}
            onChange={(e) => setMeterNumber(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Daya Listrik (VA)</label>
          <select
            value={powerVa}
            onChange={(e) => setPowerVa(e.target.value)}
            className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          >
            <option value="900">900 VA</option>
            <option value="1300">1300 VA</option>
            <option value="2200">2200 VA</option>
            <option value="3500">3500 VA</option>
            <option value="5500">5500 VA &gt;</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Toko'}
        </button>
      </form>
    </div>
  );
}
