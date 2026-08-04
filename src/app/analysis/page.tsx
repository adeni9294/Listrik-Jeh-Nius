'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Clock,
  Zap,
  Wallet,
  RefreshCw,
  Cpu,
  Activity,
  AlertCircle,
  Lightbulb,
  Thermometer,
  ShieldCheck,
  Snowflake,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate, TARIF_PLN } from '@/lib/constants';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
}

export default function AnalysisPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('active_store_id') || 'all' : 'all'
  );

  // Metrik berbasis jam & estimasi token
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyAvgKwh, setDailyAvgKwh] = useState<number>(0);
  const [monthlyEstKwh, setMonthlyEstKwh] = useState<number>(0);
  const [monthlyEstCost, setMonthlyEstCost] = useState<number>(0);
  const [isTestInterval, setIsTestInterval] = useState<boolean>(false);

  // Status Lonjakan Jam Berjalan
  const [isSpike, setIsSpike] = useState<boolean>(false);
  const [spikePercent, setSpikePercent] = useState<number>(0);

  const NORMAL_HOURLY_THRESHOLD = 10.0; // Ambang batas normal (10 kWh/jam)

  useEffect(() => {
    fetchAnalysisData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      let currentMeters = meters;
      if (currentMeters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number, power_va')
          .order('created_at', { ascending: false });

        if (metersData) {
          setMeters(metersData);
          currentMeters = metersData;
        }
      }

      if (selectedMeterId === 'all') {
        let totalHourlyRate = 0;
        let totalMonthlyCost = 0;
        let countWithData = 0;

        if (currentMeters && currentMeters.length > 0) {
          for (const m of currentMeters) {
            const rate = await calculateHourlyRateForMeter(m.id);
            totalHourlyRate += rate;
            
            // Hitung estimasi biaya bulanan per toko sesuai daya VA-nya
            const storeTariff = getTariffRate(m.power_va || 1300);
            const storeMonthlyKwh = rate * 24 * 30;
            totalMonthlyCost += storeMonthlyKwh * storeTariff;

            if (rate > 0) countWithData++;
          }
        }

        const avgHourly = countWithData > 0 ? totalHourlyRate / countWithData : 0;
        applyMetrics(avgHourly, totalMonthlyCost, true);
      } else {
        const activeMeter = currentMeters.find((m) => m.id === selectedMeterId);
        const activePowerVa = activeMeter?.power_va || 1300;
        const tariff = getTariffRate(activePowerVa);

        const rate = await calculateHourlyRateForMeter(selectedMeterId);
        const monthlyCost = rate * 24 * 30 * tariff;
        applyMetrics(rate, monthlyCost, false);
      }
    } catch (err: any) {
      console.error('Gagal mengambil data analisis:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const calculateHourlyRateForMeter = async (meterId: string): Promise<number> => {
    const { data: readings } = await supabase
      .from('meter_readings')
      .select('kwh, meter_value, created_at')
      .eq('meter_id', meterId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (!readings || readings.length < 2) return 0;

    const latestVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
    const previousVal = Number(readings[1].meter_value ?? readings[1].kwh ?? 0);

    const latestTime = new Date(readings[0].created_at).getTime();
    const previousTime = new Date(readings[1].created_at).getTime();

    const diffHours = (latestTime - previousTime) / (1000 * 60 * 60);

    if (previousVal >= latestVal) {
      const consumedKwh = previousVal - latestVal;

      if (diffHours >= 0.25) {
        setIsTestInterval(false);
        return consumedKwh / diffHours;
      } else if (diffHours > 0) {
        setIsTestInterval(true);
        return consumedKwh;
      }
    }

    return 0;
  };

  const applyMetrics = (ratePerHour: number, calculatedMonthlyCost: number, isAllStores: boolean) => {
    const daily = ratePerHour * 24;
    const monthlyKwh = daily * 30;

    // Evaluasi Lonjakan Pemakaian
    if (ratePerHour > NORMAL_HOURLY_THRESHOLD) {
      const diffPercent = Math.round(
        ((ratePerHour - NORMAL_HOURLY_THRESHOLD) / NORMAL_HOURLY_THRESHOLD) * 100
      );
      setIsSpike(true);
      setSpikePercent(diffPercent);
    } else {
      setIsSpike(false);
      setSpikePercent(0);
    }

    setHourlyRate(ratePerHour);
    setDailyAvgKwh(daily);
    setMonthlyEstKwh(monthlyKwh);
    setMonthlyEstCost(calculatedMonthlyCost);
  };

  // Estimasi Beban Perangkat (Per Hari)
  const deviceEstimates = [
    {
      name: 'AC & Pendingin Toko',
      usageKwh: (dailyAvgKwh * 0.42).toFixed(1),
      percent: 42,
      color: 'bg-teal-600',
    },
    {
      name: 'Kulkas / Showcase Minuman',
      usageKwh: (dailyAvgKwh * 0.28).toFixed(1),
      percent: 28,
      color: 'bg-emerald-600',
    },
    {
      name: 'Penerangan & Lampu Toko',
      usageKwh: (dailyAvgKwh * 0.18).toFixed(1),
      percent: 18,
      color: 'bg-amber-500',
    },
    {
      name: 'Komputer Kasir & Perangkat Elektronik',
      usageKwh: (dailyAvgKwh * 0.12).toFixed(1),
      percent: 12,
      color: 'bg-indigo-500',
    },
  ];

  const potentialSavingsMonthly = monthlyEstCost * 0.15;

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header & Filter Dropdown */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analisis Pemakaian</h1>
          <p className="text-xs text-slate-500">Laju konsumsi jam-jaman & instruksi hemat toko</p>
        </div>

        {meters.length > 0 && (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-teal-500"
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
          <span className="text-sm">Menghitung analisis energi...</span>
        </div>
      ) : (
        <>
          {/* BANNER PERINGATAN LONJAKAN & CHECKLIST AKSI ANAK TOKO */}
          {isSpike ? (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-xs space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                  <TrendingUp className="w-4 h-4 text-rose-600" />
                  <span>LONJAKAN TERDETEKSI: {hourlyRate.toFixed(2)} kWh/jam</span>
                </div>
                <span className="bg-rose-200 text-rose-900 font-extrabold px-2 py-0.5 rounded text-[10px]">
                  +{spikePercent}%
                </span>
              </div>

              <p className="text-slate-700 leading-relaxed font-medium">
                Pemakaian di jam ini terdeteksi tinggi! Anak toko disarankan segera melakukan pengecekan berikut:
              </p>

              {/* Checklist Cepat Lapangan */}
              <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-2 text-slate-800 font-medium">
                <div className="flex items-start gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>AC Toko:</strong> Pastikan suhu remote dinaikkan ke <strong>23°C–24°C</strong> & pintu utama toko tertutup rapat.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Showcase Minuman:</strong> Cek apakah pintu kulkas/showcase renggang atau terbuka terlalu lama.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Penerangan:</strong> Matikan sebagian lampu sorot display/neon box luar jika siang hari cukup terang.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs flex items-center justify-between text-emerald-800 font-medium">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pemakaian jam berjalan dalam batas normal ({hourlyRate.toFixed(2)} kWh/jam).</span>
              </div>
            </div>
          )}

          {isTestInterval && !isSpike && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Interval pindaian kurang dari 15 menit. Proyeksi menggunakan pemakaian riil tanpa ekstrapolasi mikro.
              </span>
            </div>
          )}

          {/* 3 Overview Cards Utama */}
          <div className="grid grid-cols-3 gap-2">
            <Card className={`border-slate-200 ${isSpike ? 'bg-rose-50/50 border-rose-300' : 'bg-slate-50'}`}>
              <CardContent className="p-3 text-center">
                <div className={`flex justify-center items-center gap-1 mb-1 ${isSpike ? 'text-rose-600 font-bold' : 'text-teal-600'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase">Per Jam</span>
                </div>
                <div className={`text-base font-extrabold ${isSpike ? 'text-rose-700' : 'text-slate-800'}`}>
                  {hourlyRate.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500">kWh / jam</span>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-3 text-center">
                <div className="flex justify-center items-center gap-1 text-amber-600 mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase">Per Hari</span>
                </div>
                <div className="text-base font-extrabold text-slate-800">
                  {dailyAvgKwh.toFixed(1)}
                </div>
                <span className="text-[9px] text-slate-500">kWh / 24j</span>
              </CardContent>
            </Card>

            <Card className="bg-teal-900 text-white border-none shadow-md">
              <CardContent className="p-3 text-center">
                <div className="flex justify-center items-center gap-1 text-teal-200 mb-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase">Beli Token</span>
                </div>
                <div className="text-base font-extrabold text-teal-100">
                  {monthlyEstKwh.toFixed(0)} <span className="text-[10px]">kWh</span>
                </div>
                <span className="text-[9px] text-teal-300 block font-mono">
                  ~ Rp {Math.round(monthlyEstCost).toLocaleString('id-ID')}
                </span>
              </CardContent>
            </Card>
          </div>

          {/* Smart Device Estimator Breakdown */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <Activity className="w-4 h-4 text-teal-700" />
                Estimasi Beban Operasional Toko (Per Hari)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 pt-2">
              {deviceEstimates.map((device, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{device.name}</span>
                    <span className="text-slate-900 font-bold">
                      {device.usageKwh} kWh/hari ({device.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${device.color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${device.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Recommendation for Budget */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <Cpu className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1">
                <span className="font-bold text-teal-900 block">Rencana Anggaran Listrik Bulan Depan:</span>
                <p>
                  Berdasarkan laju <strong>{hourlyRate.toFixed(2)} kWh/jam</strong>, siapkan estimasi pembelian token sebesar <strong>{monthlyEstKwh.toFixed(0)} kWh</strong> atau sekitar <strong>Rp {Math.round(monthlyEstCost).toLocaleString('id-ID')}</strong> untuk operasional 30 hari ke depan.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rekomendasi Hemat Energi Panduan Umum */}
          <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
            <CardHeader className="pb-2 border-b border-emerald-100">
              <CardTitle className="text-sm flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
                  Rekomendasi Hemat Energi
                </div>
                {potentialSavingsMonthly > 0 && (
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Potensi Hemat: ~Rp {Math.round(potentialSavingsMonthly).toLocaleString('id-ID')}/bln
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="p-1.5 bg-teal-100 rounded-lg text-teal-700 shrink-0 mt-0.5">
                  <Thermometer className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Atur Suhu AC ke Ideal (23°C - 24°C)</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Menaikkan suhu AC dari 18°C ke 24°C menghemat hingga <strong>15-20% listrik AC</strong> tanpa mengurangi kenyamanan pengunjung.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="p-1.5 bg-blue-100 rounded-lg text-blue-700 shrink-0 mt-0.5">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Optimalkan Kondensor & Pintu Showcase</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bersihkan debu kompresor showcase sebulan sekali dan pastikan karet pintu rapat agar kompresor tidak bekerja nonstop.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">Matikan Neon Box & Lampu Utama Saat Toko Tutup</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gunakan *timer* otomatis untuk mematikan lampu reklame toko pada pukul 22.00 hingga pagi hari.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
