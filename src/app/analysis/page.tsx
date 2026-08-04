'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Zap, Wallet, RefreshCw, Cpu, Activity, AlertCircle } from 'lucide-react';
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

  // Metrik berbasis jam & estimasi token
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyAvgKwh, setDailyAvgKwh] = useState<number>(0);
  const [monthlyEstKwh, setMonthlyEstKwh] = useState<number>(0);
  const [monthlyEstCost, setMonthlyEstCost] = useState<number>(0);
  const [isTestInterval, setIsTestInterval] = useState<boolean>(false);

  const TARIF_PER_KWH = 1444.7; // Tarif PLN Non-Subsidi B-1 / R-1

  useEffect(() => {
    fetchAnalysisData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAnalysisData = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko jika belum ter-load
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number, power_va')
          .order('created_at', { ascending: false });

        if (metersData) {
          setMeters(metersData);
        }
      }

      // 2. Hitung laju per jam berdasarkan 2 scan TERBARU
      if (selectedMeterId === 'all') {
        // Mode Semua Toko: Akumulasi rata-rata laju tiap toko
        const { data: allMeters } = await supabase.from('meters').select('id');
        let totalHourlyRate = 0;
        let countWithData = 0;

        if (allMeters && allMeters.length > 0) {
          for (const m of allMeters) {
            const rate = await calculateHourlyRateForMeter(m.id);
            totalHourlyRate += rate;
            if (rate > 0) countWithData++;
          }
        }

        const avgHourly = countWithData > 0 ? totalHourlyRate / countWithData : 0;
        applyMetrics(avgHourly);
      } else {
        // Mode Spesifik Toko
        const rate = await calculateHourlyRateForMeter(selectedMeterId);
        applyMetrics(rate);
      }
    } catch (err: any) {
      console.error('Gagal mengambil data analisis:', err.message);
    } fontally {
      setLoading(false);
    }
  };

  // Helper untuk menghitung kWh/jam dari 2 scan terakhir
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

    // Normal penggunaan (angka meteran berkurang)
    if (previousVal >= latestVal) {
      const consumedKwh = previousVal - latestVal;

      if (diffHours >= 0.25) {
        setIsTestInterval(false);
        return consumedKwh / diffHours; // kWh / Jam Riil
      } else if (diffHours > 0) {
        // Jika scan uji coba < 15 menit, gunakan nilai delta langsung tanpa pengali mikro
        setIsTestInterval(true);
        return consumedKwh;
      }
    }

    return 0; // Kasus Top-Up Token
  };

  const applyMetrics = (ratePerHour: number) => {
    const daily = ratePerHour * 24;
    const monthlyKwh = daily * 30;
    const monthlyCost = monthlyKwh * TARIF_PER_KWH;

    setHourlyRate(ratePerHour);
    setDailyAvgKwh(daily);
    setMonthlyEstKwh(monthlyKwh);
    setMonthlyEstCost(monthlyCost);
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
          <p className="text-xs text-slate-500">Laju konsumsi jam-jaman & estimasi budget token</p>
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
          {isTestInterval && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Interval pindaian kurang dari 15 menit. Proyeksi menggunakan pemakaian riil tanpa ekstrapolasi mikro.
              </span>
            </div>
          )}

          {/* 3 Overview Cards Utama */}
          <div className="grid grid-cols-3 gap-2">
            {/* 1. Laju Per Jam */}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-3 text-center">
                <div className="flex justify-center items-center gap-1 text-teal-600 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase">Per Jam</span>
                </div>
                <div className="text-base font-extrabold text-slate-800">
                  {hourlyRate.toFixed(2)}
                </div>
                <span className="text-[9px] text-slate-500">kWh / jam</span>
              </CardContent>
            </Card>

            {/* 2. Tren Per Hari */}
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

            {/* 3. Estimasi Beli Token Bulan Depan */}
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

          {/* AI Recommendation for Analysis */}
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
        </>
      )}
    </div>
  );
}
