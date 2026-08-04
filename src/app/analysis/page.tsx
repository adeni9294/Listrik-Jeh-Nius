'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, DollarSign, Store, RefreshCw, Cpu, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
    typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || 'all') : 'all'
  );

  // Metrik Analisis Real
  const [dailyAvgKwh, setDailyAvgKwh] = useState<number>(0);
  const [monthlyEstKwh, setMonthlyEstKwh] = useState<number>(0);
  const [dailyAvgCost, setDailyAvgCost] = useState<number>(0);
  const [monthlyEstCost, setMonthlyEstCost] = useState<number>(0);

  const TARIF_PER_KWH = 1444.7; // Asumsi tarif PLN Non-Subsidi B-1 / R-1

  useEffect(() => {
    fetchAnalysisData();
  }, [selectedMeterId]);

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko jika belum di-load
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number, power_va')
          .order('created_at', { ascending: false });

        if (metersData) {
          setMeters(metersData);
        }
      }

      // 2. Tentukan filter query berdasarkan pilihan toko
      let query = supabase.from('meter_readings').select('kwh, created_at, meter_id');

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      }

      const { data: readings, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      if (!readings || readings.length < 2) {
        // Fallback jika data pindaian belum cukup (kurang dari 2 titik bacaan)
        const fallbackDaily = selectedMeterId === 'all' ? (meters.length || 1) * 4.2 : 4.2;
        setDailyAvgKwh(fallbackDaily);
        setMonthlyEstKwh(fallbackDaily * 30);
        setDailyAvgCost(fallbackDaily * TARIF_PER_KWH);
        setMonthlyEstCost(fallbackDaily * 30 * TARIF_PER_KWH);
        setLoading(false);
        return;
      }

      // 3. Hitung Selisih kWh & Rentang Hari
      const firstReading = readings[0];
      const lastReading = readings[readings.length - 1];

      const startDate = new Date(firstReading.created_at);
      const endDate = new Date(lastReading.created_at);

      // Hitung selisih hari (minimal 1 hari agar tidak bagi 0)
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const totalKwhUsed = Math.max(0, firstReading.kwh - lastReading.kwh);
      const avgDaily = diffDays > 0 ? totalKwhUsed / diffDays : 4.2;
      const estMonthly = avgDaily * 30;

      setDailyAvgKwh(avgDaily);
      setMonthlyEstKwh(estMonthly);
      setDailyAvgCost(avgDaily * TARIF_PER_KWH);
      setMonthlyEstCost(estMonthly * TARIF_PER_KWH);

    } catch (err: any) {
      console.error('Gagal mengambil data analisis:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Estimasi Proporsi Alat Listrik Toko (Dihitung Dinamis dari Rata-rata Harian)
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

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header & Filter Dropdown */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analisis Pemakaian</h1>
          <p className="text-xs text-slate-500">Breakdown & proyeksi konsumsi listrik toko Anda</p>
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
          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-teal-900 text-white border-none shadow-md">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-teal-200 text-xs font-medium">
                  <Zap className="w-4 h-4" /> Rata-rata Harian
                </div>
                <div className="text-2xl font-black">
                  {dailyAvgKwh.toFixed(1)} <span className="text-xs font-normal opacity-80">kWh</span>
                </div>
                <p className="text-[10px] text-teal-200/80">
                  ~ Rp {Math.round(dailyAvgCost).toLocaleString('id-ID')} / hari
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none shadow-md">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
                  <DollarSign className="w-4 h-4 text-emerald-400" /> Estimasi Bulanan
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  {monthlyEstKwh.toFixed(0)} <span className="text-xs font-normal text-white opacity-80">kWh</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  ~ Rp {Math.round(monthlyEstCost).toLocaleString('id-ID')} / bulan
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Smart Device Estimator Breakdown */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <Activity className="w-4 h-4 text-teal-700" />
                Estimasi Beban Operasional Toko
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

          {/* AI Recommendation for Analysis */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <Cpu className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 space-y-1">
                <span className="font-bold text-teal-900 block">Saran Efisiensi Operasional:</span>
                <p>
                  Penggunaan pendingin (AC/Showcase) diperkirakan mendominasi <strong>70%</strong> dari total beban energi toko. Pastikan suhu AC diatur di kisaran <strong>24°C - 25°C</strong> untuk menghemat listrik hingga 15% per bulan.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
