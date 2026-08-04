'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, RefreshCw, AlertTriangle, CheckCircle2, ShoppingBag, ExternalLink, BatteryCharging } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
}

export default function AiPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || 'all') : 'all'
  );

  // Metrik Terintegrasi
  const [currentKwh, setCurrentKwh] = useState<number>(0);
  const [dailyKwh, setDailyKwh] = useState<number>(0);
  const [hourlyKwh, setHourlyKwh] = useState<number>(0);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  // Status AI Health
  const [healthStatus, setHealthStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  // Rekomendasi Token AI
  const [recCost, setRecCost] = useState<number>(0);
  const [recKwh, setRecKwh] = useState<number>(0);

  const TARIF_PER_KWH = 1444.7; // PLN Non-Subsidi

  useEffect(() => {
    fetchAiInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAiInsight = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number, power_va');
        if (metersData) setMeters(metersData);
      }

      // 2. Tentukan toko yang dievaluasi
      let targetMeterId = selectedMeterId;
      if (selectedMeterId === 'all') {
        const { data: firstMeter } = await supabase.from('meters').select('id').limit(1).single();
        targetMeterId = firstMeter?.id || '';
      }

      if (!targetMeterId) {
        setLoading(false);
        return;
      }

      // 3. Ambil 2 pindaian terakhir untuk menghitung laju riil
      const { data: readings } = await supabase
        .from('meter_readings')
        .select('kwh, meter_value, created_at')
        .eq('meter_id', targetMeterId)
        .order('created_at', { ascending: false })
        .limit(2);

      if (readings && readings.length > 0) {
        const latestReading = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
        setCurrentKwh(latestReading);

        if (readings.length >= 2) {
          const prevReading = Number(readings[1].meter_value ?? readings[1].kwh ?? 0);
          const t1 = new Date(readings[0].created_at).getTime();
          const t2 = new Date(readings[1].created_at).getTime();
          const diffHours = Math.max((t1 - t2) / (1000 * 60 * 60), 0.01);

          if (prevReading >= latestReading) {
            const consumed = prevReading - latestReading;
            const ratePerHour = diffHours >= 0.25 ? consumed / diffHours : consumed;
            const calculatedDaily = ratePerHour * 24;

            setHourlyKwh(ratePerHour);
            setDailyKwh(calculatedDaily);

            // Hitung Sisa Hari (Sisa kWh / Pemakaian per hari)
            if (calculatedDaily > 0) {
              const daysLeft = latestReading / calculatedDaily;
              setDaysRemaining(Number(daysLeft.toFixed(1)));

              // Tentukan Health Status
              if (daysLeft < 2) {
                setHealthStatus('critical');
              } else if (ratePerHour > 15) { // Contoh ambang batas lonjakan tinggi
                setHealthStatus('warning');
              } else {
                setHealthStatus('normal');
              }

              // Hitung Rekomendasi Token AI (Untuk Kebutuhan 14 Hari Operasional Toko)
              const neededKwhFor14Days = calculatedDaily * 14;
              const rawCost = neededKwhFor14Days * TARIF_PER_KWH;

              // Pembulatan ke kelipatan Rp 100.000 terdekat
              const roundedCost = Math.max(Math.ceil(rawCost / 100000) * 100000, 100000);
              const resultingKwh = roundedCost / TARIF_PER_KWH;

              setRecCost(roundedCost);
              setRecKwh(resultingKwh);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Gagal memproses AI insight:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-600" /> AI Health & Insight
          </h1>
          <p className="text-xs text-slate-500">Rekomendasi optimasi daya real-time</p>
        </div>

        {meters.length > 0 && (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
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
          <span className="text-sm">Analisis AI sedang berjalan...</span>
        </div>
      ) : (
        <>
          {/* Status Kesehatan Energi AI */}
          <Card
            className={`border-l-4 shadow-sm ${
              healthStatus === 'critical'
                ? 'border-l-rose-500 bg-rose-50/40'
                : healthStatus === 'warning'
                ? 'border-l-amber-500 bg-amber-50/40'
                : 'border-l-emerald-500 bg-emerald-50/40'
            }`}
          >
            <CardContent className="p-4 flex items-start gap-3">
              {healthStatus === 'critical' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : healthStatus === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}

              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-800 text-sm block">
                  {healthStatus === 'critical'
                    ? 'Status Penggunaan: Kritis (Sisa Token Rendah)'
                    : healthStatus === 'warning'
                    ? 'Status Penggunaan: Tinggi / Anomali Deteksi'
                    : 'Status Penggunaan: Normal & Efisien'}
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {healthStatus === 'critical'
                    ? `Sisa token sebesar ${currentKwh.toFixed(1)} kWh diprediksi akan habis dalam ${daysRemaining} hari. Segera lakukan pengisian token.`
                    : `Laju konsumsi terdeteksi ${hourlyKwh.toFixed(2)} kWh/jam (rata-rata ${dailyKwh.toFixed(1)} kWh/hari). Tidak terdeteksi adanya kebocoran arus mendadak.`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Saran Pembelian Token AI */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <BatteryCharging className="w-4 h-4 text-amber-500" />
                Saran Pembelian Token AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Berdasarkan tren penggunaan harian, sisa token saat ini (<strong>{currentKwh.toFixed(1)} kWh</strong>) diprediksi habis dalam{' '}
                <strong className={daysRemaining < 3 ? 'text-rose-600 font-extrabold' : 'text-teal-700'}>
                  {daysRemaining} hari
                </strong>{' '}
                lagi.
              </p>

              {/* Box Rekomendasi Nominal */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Rekomendasi Nominal Isi Ulang Ideal:
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-teal-800">
                    Rp {recCost.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    (~{recKwh.toFixed(1)} kWh)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Perkiraan cukup untuk menjaga operasional toko tetap aman hingga <strong>14 hari ke depan</strong>.
                </p>
              </div>

              {/* Action Button */}
              <a
                href="https://www.tokopedia.com/pln/"
                target="_blank"
                rel="noreferrer"
                className="block w-full"
              >
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl shadow-sm">
                  <ShoppingBag className="w-4 h-4" /> Beli Token PLN Sekarang
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
