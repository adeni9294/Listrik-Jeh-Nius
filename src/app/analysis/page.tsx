'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Building2,
  AlertTriangle,
  ArrowRight,
  Download,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate } from '@/lib/constants';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
}

interface StoreAnalysisItem {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
  hourlyRate: number;
  latestKwh: number;
  daysRemaining: number;
  monthlyCost: number;
}

export default function AnalysisPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('staff');
  const [meters, setMeters] = useState<Meter[]>([]);
  const [storeAnalysisList, setStoreAnalysisList] = useState<StoreAnalysisItem[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');

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
    const role = localStorage.getItem('user_role') || 'staff';
    const activeStoreId = localStorage.getItem('active_store_id');
    setUserRole(role);

    if (role !== 'admin' && activeStoreId) {
      setSelectedMeterId(activeStoreId);
    }

    fetchAnalysisData(role, activeStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAnalysisData = async (roleParam?: string, activeStoreIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? (localStorage.getItem('user_role') || 'staff');
      const currentActiveStore = activeStoreIdParam ?? localStorage.getItem('active_store_id');

      let query = supabase
        .from('meters')
        .select('id, store_name, meter_number, power_va')
        .order('created_at', { ascending: false });

      // RBAC: Kunci query hanya ke toko miliknya sendiri jika BUKAN Admin
      if (currentRole !== 'admin' && currentActiveStore) {
        query = query.eq('id', currentActiveStore);
      }

      const { data: metersData } = await query;
      let currentMeters = metersData || [];
      setMeters(currentMeters);

      // Ambil analisis detail untuk semua toko
      const detailedAnalysisList: StoreAnalysisItem[] = [];
      if (currentMeters.length > 0) {
        for (const m of currentMeters) {
          const { rate, latestKwh } = await calculateRateAndReadingForMeter(m.id);
          const storeTariff = getTariffRate(m.power_va || 1300);
          const storeMonthlyCost = rate * 24 * 30 * storeTariff;

          const dailyKwh = rate * 24;
          const daysLeft = dailyKwh > 0 ? Math.floor(latestKwh / dailyKwh) : 99;

          detailedAnalysisList.push({
            id: m.id,
            store_name: m.store_name,
            meter_number: m.meter_number,
            power_va: m.power_va || 1300,
            hourlyRate: rate,
            latestKwh: latestKwh,
            daysRemaining: daysLeft,
            monthlyCost: storeMonthlyCost,
          });
        }
      }

      detailedAnalysisList.sort((a, b) => a.daysRemaining - b.daysRemaining);
      setStoreAnalysisList(detailedAnalysisList);

      if (selectedMeterId === 'all' && currentRole === 'admin') {
        let totalHourlyRate = 0;
        let totalMonthlyCost = 0;
        let countWithData = 0;

        detailedAnalysisList.forEach((item) => {
          totalHourlyRate += item.hourlyRate;
          totalMonthlyCost += item.monthlyCost;
          if (item.hourlyRate > 0) countWithData++;
        });

        const avgHourly = countWithData > 0 ? totalHourlyRate / countWithData : 0;
        applyMetrics(avgHourly, totalMonthlyCost);
      } else {
        const activeTargetId = selectedMeterId === 'all' ? currentMeters[0]?.id : selectedMeterId;
        const activeItem = detailedAnalysisList.find((m) => m.id === activeTargetId);
        
        if (activeItem) {
          applyMetrics(activeItem.hourlyRate, activeItem.monthlyCost);
        } else if (activeTargetId) {
          const rateData = await calculateRateAndReadingForMeter(activeTargetId);
          const activeMeter = currentMeters.find((m) => m.id === activeTargetId);
          const tariff = getTariffRate(activeMeter?.power_va || 1300);
          const monthlyCost = rateData.rate * 24 * 30 * tariff;
          applyMetrics(rateData.rate, monthlyCost);
        }
      }
    } catch (err: any) {
      console.error('Gagal mengambil data analisis:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRateAndReadingForMeter = async (
    meterId: string
  ): Promise<{ rate: number; latestKwh: number }> => {
    const { data: readings } = await supabase
      .from('meter_readings')
      .select('kwh, meter_value, created_at')
      .eq('meter_id', meterId)
      .order('created_at', { ascending: false })
      .limit(2);

    if (!readings || readings.length === 0) return { rate: 0, latestKwh: 0 };

    const latestVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
    if (readings.length < 2) return { rate: 0, latestKwh: latestVal };

    const previousVal = Number(readings[1].meter_value ?? readings[1].kwh ?? 0);
    const latestTime = new Date(readings[0].created_at).getTime();
    const previousTime = new Date(readings[1].created_at).getTime();

    const diffHours = (latestTime - previousTime) / (1000 * 60 * 60);

    if (previousVal >= latestVal) {
      const consumedKwh = previousVal - latestVal;

      if (diffHours >= 0.25) {
        setIsTestInterval(false);
        return { rate: consumedKwh / diffHours, latestKwh: latestVal };
      } else if (diffHours > 0) {
        setIsTestInterval(true);
        return { rate: consumedKwh, latestKwh: latestVal };
      }
    }

    return { rate: 0, latestKwh: latestVal };
  };

  const applyMetrics = (ratePerHour: number, calculatedMonthlyCost: number) => {
    const daily = ratePerHour * 24;
    const monthlyKwh = daily * 30;

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

  // FUNGSI EXPORT DATA LAPORAN KE CSV
  const handleExportCSV = () => {
    if (storeAnalysisList.length === 0) return;

    const headers = ['Nama Toko', 'Nomor Meter PLN', 'Daya (VA)', 'Laju Konsumsi (kWh/jam)', 'Estimasi Biaya Bulanan (Rp)', 'Status Sisa Token'];
    const rows = storeAnalysisList.map((item) => [
      `"${item.store_name}"`,
      `"${item.meter_number || '-'}"`,
      item.power_va,
      item.hourlyRate.toFixed(2),
      Math.round(item.monthlyCost),
      `"${item.daysRemaining <= 2 ? 'Kritis' : item.daysRemaining <= 5 ? 'Warning' : 'Aman'} (${item.daysRemaining} hari)"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Analisis_Listrik_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (days: number) => {
    if (days <= 2) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
          <AlertCircle className="w-3 h-3" /> Kritis ({days} Hari)
        </span>
      );
    } else if (days <= 5) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" /> Warning ({days} Hari)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
        <ShieldCheck className="w-3 h-3" /> Aman ({days === 99 ? 'N/A' : `${days} Hari`})
      </span>
    );
  };

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
      {/* Header & Control Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analisis Pemakaian</h1>
          <p className="text-xs text-slate-500">Laju konsumsi jam-jaman & instruksi hemat toko</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold gap-1 px-2.5 h-8 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>

          {meters.length > 0 && userRole === 'admin' && (
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
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Menghitung analisis energi...</span>
        </div>
      ) : (
        <>
          {/* TABEL PERBANDINGAN SEMUA TOKO */}
          {storeAnalysisList.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-700" />
                    <span>Matriks Konsumsi Toko</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-500">
                    Urutan berdasarkan risiko token habis
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2 rounded-l-md">Toko</th>
                        <th className="px-3 py-2">Daya</th>
                        <th className="px-3 py-2">Rata-Rata</th>
                        <th className="px-3 py-2">Status Risiko</th>
                        <th className="px-3 py-2 rounded-r-md text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {storeAnalysisList.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            <div>{item.store_name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              ID: {item.meter_number || '-'}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{item.power_va} VA</td>
                          <td className="px-3 py-2.5 font-bold text-slate-700">
                            {item.hourlyRate.toFixed(2)}{' '}
                            <span className="text-[9px] font-normal text-slate-500">kWh/j</span>
                          </td>
                          <td className="px-3 py-2.5">{getStatusBadge(item.daysRemaining)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-teal-700 hover:text-teal-800 hover:bg-teal-50"
                              onClick={() => setSelectedMeterId(item.id)}
                            >
                              Detail <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* BANNER PERINGATAN LONJAKAN */}
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

          {/* Rekomendasi Hemat Energi */}
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
                    Gunakan timer otomatis untuk mematikan lampu reklame toko pada pukul 22.00 hingga pagi hari.
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
