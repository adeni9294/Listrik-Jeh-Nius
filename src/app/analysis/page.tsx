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
  LogOut,
  LogIn,
  Lock,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate } from '@/lib/constants';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
}

interface TodayScanSession {
  id: string;
  time: string;
  kwh: number;
  consumptionFromPrev: number | null;
  sessionName: string;
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
  todaySessions: TodayScanSession[];
}

export default function AnalysisPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('staff');
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [storeAnalysisList, setStoreAnalysisList] = useState<StoreAnalysisItem[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');

  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyAvgKwh, setDailyAvgKwh] = useState<number>(0);
  const [monthlyEstKwh, setMonthlyEstKwh] = useState<number>(0);
  const [monthlyEstCost, setMonthlyEstCost] = useState<number>(0);

  const [isSpike, setIsSpike] = useState<boolean>(false);
  const [spikePercent, setSpikePercent] = useState<number>(0);

  const NORMAL_HOURLY_THRESHOLD = 10.0;

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    const storeId = localStorage.getItem('active_store_id');

    if (storeId && role) {
      setIsLoggedIn(true);
      setUserRole(role);
      setActiveStoreId(storeId);
      fetchAnalysisData(role, storeId);
    } else {
      setIsLoggedIn(false);
      setUserRole('staff');
      setActiveStoreId(null);
      setStoreAnalysisList([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAnalysisData = async (roleParam?: string | null, activeStoreIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? localStorage.getItem('user_role');
      const currentActiveStore = activeStoreIdParam ?? localStorage.getItem('active_store_id');

      if (!currentActiveStore && currentRole !== 'admin') {
        setStoreAnalysisList([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('meters')
        .select('id, store_name, meter_number, power_va')
        .order('created_at', { ascending: false });

      if (currentRole !== 'admin' && currentActiveStore) {
        query = query.eq('id', currentActiveStore);
      }

      const { data: metersData } = await query;
      let currentMeters = metersData || [];
      setMeters(currentMeters);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const detailedAnalysisList: StoreAnalysisItem[] = [];
      if (currentMeters.length > 0) {
        for (const m of currentMeters) {
          const { rate, latestKwh } = await calculateRateAndReadingForMeter(m.id);
          const storeTariff = getTariffRate(m.power_va || 1300);
          const storeMonthlyCost = rate * 24 * 30 * storeTariff;

          const dailyKwh = rate * 24;
          const daysLeft = dailyKwh > 0 ? Math.floor(latestKwh / dailyKwh) : 99;

          const { data: todayReadings } = await supabase
            .from('meter_readings')
            .select('id, kwh, meter_value, created_at')
            .eq('meter_id', m.id)
            .gte('created_at', startOfToday.toISOString())
            .order('created_at', { ascending: true });

          const formattedSessions: TodayScanSession[] = [];
          if (todayReadings && todayReadings.length > 0) {
            todayReadings.forEach((r, idx) => {
              const val = Number(r.meter_value ?? r.kwh ?? 0);
              const timeStr = new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

              let consumed: number | null = null;
              if (idx > 0) {
                const prevVal = Number(todayReadings[idx - 1].meter_value ?? todayReadings[idx - 1].kwh ?? 0);
                if (prevVal >= val) {
                  consumed = prevVal - val;
                }
              }

              const sessionLabel = idx === 0 ? 'Pindaian 1 (Pagi/Buka)' : idx === 1 ? 'Pindaian 2 (Siang)' : `Pindaian ${idx + 1} (Malam/Tutup)`;

              formattedSessions.push({
                id: r.id,
                time: timeStr,
                kwh: val,
                consumptionFromPrev: consumed,
                sessionName: sessionLabel,
              });
            });
          }

          detailedAnalysisList.push({
            id: m.id,
            store_name: m.store_name,
            meter_number: m.meter_number,
            power_va: m.power_va || 1300,
            hourlyRate: rate,
            latestKwh: latestKwh,
            daysRemaining: daysLeft,
            monthlyCost: storeMonthlyCost,
            todaySessions: formattedSessions,
          });
        }
      }

      detailedAnalysisList.sort((a, b) => a.daysRemaining - b.daysRemaining);
      setStoreAnalysisList(detailedAnalysisList);

      let targetMeterId = selectedMeterId;
      if ((!targetMeterId || targetMeterId === 'all') && detailedAnalysisList.length > 0) {
        targetMeterId = currentRole === 'admin'
          ? detailedAnalysisList[0].id
          : (currentActiveStore || detailedAnalysisList[0].id);
        setSelectedMeterId(targetMeterId);
      }

      const activeItem = detailedAnalysisList.find((m) => m.id === targetMeterId);

      if (activeItem) {
        applyMetrics(activeItem.hourlyRate, activeItem.monthlyCost);
      } else if (targetMeterId) {
        const rateData = await calculateRateAndReadingForMeter(targetMeterId);
        const activeMeter = currentMeters.find((m) => m.id === targetMeterId);
        const tariff = getTariffRate(activeMeter?.power_va || 1300);
        const monthlyCost = rateData.rate * 24 * 30 * tariff;
        applyMetrics(rateData.rate, monthlyCost);
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
      .limit(3);

    if (!readings || readings.length === 0) return { rate: 0, latestKwh: 0 };

    const latestVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
    if (readings.length < 2) return { rate: 0, latestKwh: latestVal };

    const oldestVal = Number(readings[readings.length - 1].meter_value ?? readings[readings.length - 1].kwh ?? 0);
    const latestTime = new Date(readings[0].created_at).getTime();
    const oldestTime = new Date(readings[readings.length - 1].created_at).getTime();

    const diffHours = (latestTime - oldestTime) / (1000 * 60 * 60);

    if (oldestVal >= latestVal && diffHours > 0) {
      const consumedKwh = oldestVal - latestVal;
      if (diffHours >= 0.25) {
        return { rate: consumedKwh / diffHours, latestKwh: latestVal };
      } else {
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

  const handleLogout = async () => {
    try {
      setIsLoggedIn(false);
      setActiveStoreId(null);
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    }
  };

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

  const selectedStoreObj = storeAnalysisList.find((m) => m.id === selectedMeterId) || storeAnalysisList[0];

  const deviceEstimates = [
    { name: 'AC & Pendingin Toko', usageKwh: (dailyAvgKwh * 0.42).toFixed(1), percent: 42, color: 'bg-teal-600' },
    { name: 'Kulkas / Showcase Minuman', usageKwh: (dailyAvgKwh * 0.28).toFixed(1), percent: 28, color: 'bg-emerald-600' },
    { name: 'Penerangan & Lampu Toko', usageKwh: (dailyAvgKwh * 0.18).toFixed(1), percent: 18, color: 'bg-amber-500' },
    { name: 'Komputer Kasir & Elektronik', usageKwh: (dailyAvgKwh * 0.12).toFixed(1), percent: 12, color: 'bg-indigo-500' },
  ];

  const potentialSavingsMonthly = monthlyEstCost * 0.15;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header & Control Actions */}
      <div className="flex justify-between items-start gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Analisis Pemakaian</h1>
          <p className="text-xs sm:text-sm text-slate-500">Laju konsumsi jam-jaman & instruksi hemat toko</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isLoggedIn ? (
            <Button
              onClick={handleLogout}
              size="sm"
              variant="outline"
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 text-xs font-semibold gap-1 px-3 h-9"
            >
              <LogOut className="w-4 h-4" /> Keluar
            </Button>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                variant="outline"
                className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold gap-1 px-3 h-9"
              >
                <LogIn className="w-4 h-4" /> Masuk
              </Button>
            </Link>
          )}

          {isLoggedIn && (
            <Button
              size="sm"
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold gap-1 px-3 h-9 shadow-sm"
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          )}

          {isLoggedIn && meters.length > 0 && userRole === 'admin' && (
            <select
              value={selectedMeterId}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-teal-500 h-9 outline-none"
            >
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
        <div className="flex justify-center items-center py-20 text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-base font-medium">Menghitung analisis energi...</span>
        </div>
      ) : !isLoggedIn ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Akses Analisis Terkunci</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk melihat analisis konsumsi dan proyeksi biaya energi toko Anda.
              </p>
            </div>
            <Link href="/login" className="inline-block">
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-8 py-2.5">
                <LogIn className="w-4 h-4 mr-1.5" /> Masuk ke Toko
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* LAYOUT DESKTOP 2 KOLOM */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* KOLOM UTAMA KIRI (2 SPAN DESKTOP) */}
          <div className="lg:col-span-2 space-y-6">
            
            {storeAnalysisList.length > 0 && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-teal-700" />
                      <span>Matriks Konsumsi Seluruh Toko</span>
                    </div>
                    <span className="text-xs font-normal text-slate-500">
                      Diurutkan berdasarkan risiko token habis
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2.5 rounded-l-md">Toko</th>
                          <th className="px-3 py-2.5">Daya</th>
                          <th className="px-3 py-2.5">Rata-Rata</th>
                          <th className="px-3 py-2.5">Status Risiko</th>
                          <th className="px-3 py-2.5 rounded-r-md text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {storeAnalysisList.map((item) => (
                          <tr
                            key={item.id}
                            className={`transition ${item.id === selectedMeterId ? 'bg-teal-50/60 font-medium' : 'hover:bg-slate-50'}`}
                          >
                            <td className="px-3 py-3 font-semibold text-slate-800">
                              <div>{item.store_name}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                ID: {item.meter_number || '-'}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-600">{item.power_va} VA</td>
                            <td className="px-3 py-3 font-bold text-slate-700">
                              {item.hourlyRate.toFixed(2)}{' '}
                              <span className="text-[9px] font-normal text-slate-500">kWh/j</span>
                            </td>
                            <td className="px-3 py-3">{getStatusBadge(item.daysRemaining)}</td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                size="sm"
                                variant={item.id === selectedMeterId ? 'default' : 'ghost'}
                                className={`h-8 text-xs px-2.5 ${
                                  item.id === selectedMeterId
                                    ? 'bg-teal-700 hover:bg-teal-800 text-white'
                                    : 'text-teal-700 hover:text-teal-800 hover:bg-teal-50'
                                }`}
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

            {/* Smart Device Estimator Breakdown */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-700" />
                    <span>Beban Operasional: <strong>{selectedStoreObj?.store_name}</strong></span>
                  </div>
                  <span className="text-xs font-normal text-slate-500">Per Hari</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                {deviceEstimates.map((device, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{device.name}</span>
                      <span className="text-slate-900 font-bold">
                        {device.usageKwh} kWh/hari ({device.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`${device.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${device.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Rekomendasi Hemat Energi */}
            <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
              <CardHeader className="pb-3 border-b border-emerald-100">
                <CardTitle className="text-sm flex items-center justify-between text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500 fill-amber-400" />
                    Rekomendasi Hemat Energi
                  </div>
                  {potentialSavingsMonthly > 0 && (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                      Potensi Hemat: ~Rp {Math.round(potentialSavingsMonthly).toLocaleString('id-ID')}/bln
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-3 text-xs text-slate-700">
                  <div className="p-2 bg-teal-100 rounded-lg text-teal-700 shrink-0 mt-0.5">
                    <Thermometer className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Atur Suhu AC ke Ideal (23°C - 24°C)</span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Menaikkan suhu AC dari 18°C ke 24°C menghemat hingga <strong>15-20% listrik AC</strong> tanpa mengurangi kenyamanan pengunjung.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs text-slate-700">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0 mt-0.5">
                    <Snowflake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Optimalkan Kondensor & Pintu Showcase</span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Bersihkan debu kompresor showcase sebulan sekali dan pastikan karet pintu rapat agar kompresor tidak bekerja nonstop.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs text-slate-700">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">Matikan Neon Box & Lampu Utama Saat Toko Tutup</span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Gunakan timer otomatis untuk mematikan lampu reklame toko pada pukul 22.00 hingga pagi hari.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KOLOM KANAN / SIDEBAR (1 SPAN DESKTOP) */}
          <div className="space-y-6">
            
            {/* BANNER PERINGATAN LONJAKAN */}
            {isSpike ? (
              <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl text-xs space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                    <TrendingUp className="w-4 h-4 text-rose-600" />
                    <span>LONJAKAN TERDETEKSI ({selectedStoreObj?.store_name})</span>
                  </div>
                  <span className="bg-rose-200 text-rose-900 font-extrabold px-2 py-0.5 rounded text-[10px]">
                    +{spikePercent}%
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed font-medium">
                  Pemakaian jam berjalan ({hourlyRate.toFixed(2)} kWh/jam) terdeteksi tinggi!
                </p>

                <div className="bg-white p-3 rounded-lg border border-rose-200 space-y-2 text-slate-800 font-medium">
                  <div className="flex items-start gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span><strong>AC Toko:</strong> Naikkan suhu remote ke <strong>23°C–24°C</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <span><strong>Showcase:</strong> Cek kerapatan pintu kulkas.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs flex items-center justify-between text-emerald-800 font-medium shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Pemakaian {selectedStoreObj?.store_name} normal ({hourlyRate.toFixed(2)} kWh/jam).</span>
                </div>
              </div>
            )}

            {/* TABEL PINDAIAN SESI HARI INI */}
            {selectedStoreObj && (
              <Card className="border-teal-200 bg-teal-50/30 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>📊 Breakdown Pindaian Hari Ini ({selectedStoreObj.store_name})</span>
                    <span className="text-[11px] text-teal-700 font-normal">
                      {selectedStoreObj.todaySessions?.length || 0}x Pindaian Sukses
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2.5">
                  {!selectedStoreObj.todaySessions || selectedStoreObj.todaySessions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada pindaian tersimpan hari ini.</p>
                  ) : (
                    selectedStoreObj.todaySessions.map((s, idx) => (
                      <div
                        key={s.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {idx === 0 ? (
                            <Sun className="w-4 h-4 text-amber-500" />
                          ) : idx === 1 ? (
                            <Sunset className="w-4 h-4 text-orange-500" />
                          ) : (
                            <Moon className="w-4 h-4 text-indigo-500" />
                          )}
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{s.sessionName}</span>
                            <span className="text-[10px] text-slate-400">Jam {s.time}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-extrabold text-slate-800 block">{s.kwh.toFixed(1)} kWh</span>
                          {s.consumptionFromPrev !== null && (
                            <span className="text-[10px] text-rose-600 font-bold block">
                              Terpakai: {s.consumptionFromPrev.toFixed(1)} kWh
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* 3 Overview Cards Spesifik Toko */}
            <div className="grid grid-cols-3 gap-2.5">
              <Card className={`border-slate-200 ${isSpike ? 'bg-rose-50/50 border-rose-300' : 'bg-slate-50'}`}>
                <CardContent className="p-3 text-center">
                  <div className={`flex justify-center items-center gap-1 mb-1 ${isSpike ? 'text-rose-600 font-bold' : 'text-teal-600'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Per Jam</span>
                  </div>
                  <div className={`text-base font-extrabold ${isSpike ? 'text-rose-700' : 'text-slate-800'}`}>
                    {hourlyRate.toFixed(2)}
                  </div>
                  <span className="text-[9px] text-slate-500">kWh/jam</span>
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
                  <span className="text-[9px] text-slate-500">kWh/24j</span>
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

            {/* AI Recommendation for Budget */}
            <Card className="border-teal-200 bg-teal-50/50 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <Cpu className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-teal-900 block">
                    Anggaran Listrik Bulan Depan ({selectedStoreObj?.store_name}):
                  </span>
                  <p className="leading-relaxed">
                    Siapkan estimasi token <strong>{monthlyEstKwh.toFixed(0)} kWh</strong> atau sekitar <strong>Rp {Math.round(monthlyEstCost).toLocaleString('id-ID')}</strong> untuk operasional 30 hari ke depan.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
