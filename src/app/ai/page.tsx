'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, CheckCircle2, AlertTriangle, ShoppingBag, Sparkles, RefreshCw, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
}

export default function AIPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || 'all') : 'all'
  );

  // Dynamic AI State Metrics
  const [totalRemainingKwh, setTotalRemainingKwh] = useState<number>(0);
  const [dailyAvgKwh, setDailyAvgKwh] = useState<number>(0);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isAnomalyDetected, setIsAnomalyDetected] = useState<boolean>(false);
  const [recommendedPurchaseRp, setRecommendedPurchaseRp] = useState<number>(100000);
  const [recommendedKwh, setRecommendedKwh] = useState<number>(69.2);

  const TARIF_PER_KWH = 1444.7; // Asumsi tarif PLN Non-Subsidi

  useEffect(() => {
    fetchAIInsights();
  }, [selectedMeterId]);

  const fetchAIInsights = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko jika belum di-load
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number')
          .order('created_at', { ascending: false });

        if (metersData) {
          setMeters(metersData);
        }
      }

      // 2. Query bacaan meteran
      let query = supabase
        .from('meter_readings')
        .select('kwh, created_at, meter_id')
        .order('created_at', { ascending: false });

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      }

      const { data: readings, error } = await query;

      if (error) throw error;

      if (!readings || readings.length === 0) {
        // Fallback nilai awal jika belum ada pindaian
        setTotalRemainingKwh(0);
        setDailyAvgKwh(4.2);
        setDaysLeft(0);
        setLoading(false);
        return;
      }

      // 3. Hitung Total Sisa kWh Terakhir
      if (selectedMeterId === 'all') {
        // Gabungan nilai pindaian terakhir dari tiap toko
        const latestByMeter = new Map<string, number>();
        readings.forEach((r) => {
          if (!latestByMeter.has(r.meter_id)) {
            latestByMeter.set(r.meter_id, r.kwh);
          }
        });
        const totalRem = Array.from(latestByMeter.values()).reduce((a, b) => a + b, 0);
        setTotalRemainingKwh(totalRem);
      } else {
        setTotalRemainingKwh(readings[0].kwh);
      }

      // 4. Hitung Rata-rata Konsumsi Harian & Deteksi Anomali
      let avgDaily = 4.2;
      if (readings.length >= 2) {
        const newest = readings[0];
        const oldest = readings[readings.length - 1];
        const diffTime = Math.abs(new Date(newest.created_at).getTime() - new Date(oldest.created_at).getTime());
        const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        const kwhUsed = Math.max(0, oldest.kwh - newest.kwh);
        avgDaily = kwhUsed / diffDays || 4.2;
      }

      const multiplier = selectedMeterId === 'all' ? Math.max(1, meters.length) : 1;
      const totalDailyUsage = avgDaily > 0 ? avgDaily : 4.2 * multiplier;
      setDailyAvgKwh(totalDailyUsage);

      // Hitung sisa hari
      const calculatedDaysLeft = Math.round(totalRemainingKwh / totalDailyUsage) || 0;
      setDaysLeft(calculatedDaysLeft);

      // Cek Anomali (misal jika pemakaian harian mendadak di atas 15 kWh per toko)
      setIsAnomalyDetected(totalDailyUsage > 15 * multiplier);

      // 5. Kalkulasi Rekomendasi Token Ideal (Untuk pemakaian ~20-30 hari)
      let idealRp = 100000;
      if (totalDailyUsage > 8) idealRp = 200000;
      if (totalDailyUsage > 15) idealRp = 500000;

      setRecommendedPurchaseRp(idealRp);
      setRecommendedKwh(Number((idealRp / TARIF_PER_KWH).toFixed(1)));

    } catch (err: any) {
      console.error('Gagal memuat insight AI:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header & Filter Dropdown */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AI Health & Insight</h1>
            <p className="text-xs text-slate-500">Rekomendasi optimasi daya real-time</p>
          </div>
        </div>

        {meters.length > 0 && (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-teal-500 mt-1"
          >
            <option value="all">Semua Toko ({meters.length})</option>
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.store_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Gemini AI sedang menganalisis kesehatan daya...</span>
        </div>
      ) : (
        <>
          {/* System Health Status Dynamic Card */}
          {!isAnomalyDetected ? (
            <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-emerald-900">Status Penggunaan: Normal & Efisien</h4>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Tidak terdeteksi adanya kebocoran arus atau anomali lonjakan listrik. Rata-rata pemakaian stabil di angka{' '}
                    <strong>{dailyAvgKwh.toFixed(1)} kWh/hari</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-amber-900">Peringatan: Pemakaian Lebih Tinggi Dari Biasanya</h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Konsumsi harian terdeteksi mencapai <strong>{dailyAvgKwh.toFixed(1)} kWh/hari</strong>. Periksa apakah ada peralatan pendingin/AC toko yang beroperasi nonstop tanpa jeda.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Token Purchase Advisor */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-500" /> Saran Pembelian Token AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Berdasarkan tren penggunaan harian, sisa token saat ini (<strong>{totalRemainingKwh.toFixed(1)} kWh</strong>) diprediksi habis dalam{' '}
                <strong className="text-slate-900">{daysLeft} hari lagi</strong>.
              </p>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="text-[11px] font-medium text-slate-500">Rekomendasi Nominal Isi Ulang Ideal:</div>
                <div className="text-lg font-extrabold text-teal-800">
                  Rp {recommendedPurchaseRp.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">(~{recommendedKwh} kWh)</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Perkiraan cukup untuk menjaga operasional toko tetap aman hingga{' '}
                  <strong>{Math.round(recommendedKwh / (dailyAvgKwh || 1))} hari ke depan</strong>.
                </div>
              </div>

              <Button
                onClick={() => alert('Fitur integrasi pembayaran token PLN akan segera hadir!')}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold gap-2 py-5 rounded-xl shadow-sm"
              >
                <ShoppingBag className="w-4 h-4" /> Beli Token PLN Sekarang
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
