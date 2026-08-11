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
  BarChart3,
  Calendar,
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

interface DailyTrend {
  dateLabel: string;
  dayName: string;
  totalKwh: number;
}

interface MonthlyTrend {
  monthLabel: string;
  totalKwh: number;
}

interface StoreAnalysisItem {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
  hourlyRate: number;
  actualDailyKwh: number;
  dailyProjection: number;
  weeklyProjection: number;
  monthlyProjectionNextMonth: number;
  latestKwh: number;
  daysRemaining: number;
  monthlyCost: number;
  isSpikeDetected: boolean;
  spikePercent: number;
  todaySessions: TodayScanSession[];
  weeklyTrend: DailyTrend[];
  monthlyTrend: MonthlyTrend[];
}

// FUNGSI UTAMA: MENGAMBIL NAMA BULAN DEPAN & JUMLAH HARINYA SECARA OTOMATIS
const getNextMonthInfo = () => {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  const monthName = nextMonthDate.toLocaleDateString('id-ID', { month: 'long' });
  const daysInNextMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();

  return { monthName, daysInNextMonth };
};

export default function AnalysisPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('staff');
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [storeAnalysisList, setStoreAnalysisList] = useState<StoreAnalysisItem[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');

  // STATE UNTUK PILIHAN GRAFIK (daily = 7 Hari, monthly = 6 Bulan)
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');

  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [dailyEstKwh, setDailyEstKwh] = useState<number>(0);
  const [weeklyEstKwh, setWeeklyEstKwh] = useState<number>(0);
  const [monthlyEstKwh, setMonthlyEstKwh] = useState<number>(0);
  const [monthlyEstCost, setMonthlyEstCost] = useState<number>(0);

  const [nextMonthName, setNextMonthName] = useState<string>('');
  const [nextMonthDays, setNextMonthDays] = useState<number>(30);

  const [isSpike, setIsSpike] = useState<boolean>(false);
  const [spikePercent, setSpikePercent] = useState<number>(0);

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
  }, []);

  const handleSelectStore = (storeId: string) => {
    setSelectedMeterId(storeId);
    const targetStore = storeAnalysisList.find((m) => m.id === storeId);
    if (targetStore) {
      applyMetrics(
        targetStore.hourlyRate,
        targetStore.power_va,
        targetStore.isSpikeDetected,
        targetStore.spikePercent
      );
    }
  };

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

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { daysInNextMonth } = getNextMonthInfo();

      const detailedAnalysisList: StoreAnalysisItem[] = [];
      if (currentMeters.length > 0) {
        for (const m of currentMeters) {
          const { rate, latestKwh, actualDailyKwh, isSpikeDetected, spikePercent: calculatedSpikePct } = await calculateRateAndReadingForMeter(m.id);
          const storeTariff = getTariffRate(m.power_va || 1300);

          // 1. DATA 7 HARI TERAKHIR
          const { data: weekReadings } = await supabase
            .from('meter_readings')
            .select('kwh, meter_value, created_at')
            .eq('meter_id', m.id)
            .gte('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

          const trendMap: Record<string, { total: number; count: number; dateObj: Date }> = {};
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().slice(0, 10);
            trendMap[dateKey] = { total: 0, count: 0, dateObj: d };
          }

          if (weekReadings && weekReadings.length > 0) {
            weekReadings.forEach((r, idx) => {
              if (idx > 0) {
                const prevVal = Number(weekReadings[idx - 1].meter_value ?? weekReadings[idx - 1].kwh ?? 0);
                const currVal = Number(r.meter_value ?? r.kwh ?? 0);
                const diff = prevVal >= currVal ? prevVal - currVal : 0;
                
                const dateKey = new Date(r.created_at).toISOString().slice(0, 10);
                if (trendMap[dateKey]) {
                  trendMap[dateKey].total += diff;
                  trendMap[dateKey].count += 1;
                }
              }
            });
          }

          const weeklyTrend: DailyTrend[] = Object.entries(trendMap).map(([key, value]) => ({
            dateLabel: value.dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
            dayName: value.dateObj.toLocaleDateString('id-ID', { weekday: 'short' }),
            totalKwh: Number(value.total.toFixed(1)),
          }));

          // 2. DATA 6 BULAN TERAKHIR
          const { data: monthReadings } = await supabase
            .from('meter_readings')
            .select('kwh, meter_value, created_at')
            .eq('meter_id', m.id)
            .gte('created_at', sixMonthsAgo.toISOString())
            .order('created_at', { ascending: true });

          const monthlyTrendMap: Record<string, { total: number; monthLabel: string }> = {};
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = d.toLocaleDateString('id-ID', { month: 'short' });
            monthlyTrendMap[monthKey] = { total: 0, monthLabel };
          }

          if (monthReadings && monthReadings.length > 0) {
            monthReadings.forEach((r, idx) => {
              if (idx > 0) {
                const prevVal = Number(monthReadings[idx - 1].meter_value ?? monthReadings[idx - 1].kwh ?? 0);
                const currVal = Number(r.meter_value ?? r.kwh ?? 0);
                const diff = prevVal >= currVal ? prevVal - currVal : 0;

                const monthKey = new Date(r.created_at).toISOString().slice(0, 7);
                if (monthlyTrendMap[monthKey]) {
                  monthlyTrendMap[monthKey].total += diff;
                }
              }
            });
          }

          const monthlyTrend: MonthlyTrend[] = Object.values(monthlyTrendMap).map((item) => ({
            monthLabel: item.monthLabel,
            totalKwh: Number(item.total.toFixed(1)),
          }));

          // BREAKDOWN PINDAIAN HARI INI
          const formattedSessions: TodayScanSession[] = [];
          const todayReadings = (weekReadings || []).filter(
            (r) => new Date(r.created_at) >= startOfToday
          );

          if (todayReadings.length > 0) {
            todayReadings.forEach((r: any, idx: number) => {
              const val = Number(r.meter_value ?? r.kwh ?? 0);
              const timeStr = new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

              let consumed: number | null = null;
              if (idx > 0) {
                const prevVal = Number(todayReadings[idx - 1].meter_value ?? todayReadings[idx - 1].kwh ?? 0);
                if (prevVal >= val) {
                  consumed = prevVal - val;
                }
              }

              formattedSessions.push({
                id: r.id || `session-${idx}`,
                time: timeStr,
                kwh: val,
                consumptionFromPrev: consumed,
                sessionName: `Pindaian #${idx + 1}`,
              });
            });
          }

          const dailyProj = rate > 0 ? rate * 24 : actualDailyKwh;
          const weeklyProj = dailyProj * 7;
          const monthlyProjNextMonth = dailyProj * daysInNextMonth;

          const storeMonthlyCost = monthlyProjNextMonth * storeTariff;
          const daysLeft = dailyProj > 0 ? Math.floor(latestKwh / dailyProj) : 99;

          detailedAnalysisList.push({
            id: m.id,
            store_name: m.store_name,
            meter_number: m.meter_number,
            power_va: m.power_va || 1300,
            hourlyRate: rate,
            actualDailyKwh: actualDailyKwh,
            dailyProjection: dailyProj,
            weeklyProjection: weeklyProj,
            monthlyProjectionNextMonth: monthlyProjNextMonth,
            latestKwh: latestKwh,
            daysRemaining: daysLeft,
            monthlyCost: storeMonthlyCost,
            isSpikeDetected,
            spikePercent: calculatedSpikePct,
            todaySessions: formattedSessions,
            weeklyTrend,
            monthlyTrend,
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
        applyMetrics(
          activeItem.hourlyRate,
          activeItem.power_va,
          activeItem.isSpikeDetected,
          activeItem.spikePercent
        );
      } else if (targetMeterId) {
        const rateData = await calculateRateAndReadingForMeter(targetMeterId);
        const activeMeter = currentMeters.find((m) => m.id === targetMeterId);
        applyMetrics(
          rateData.rate,
          activeMeter?.power_va || 1300,
          rateData.isSpikeDetected,
          rateData.spikePercent
        );
      }
    } catch (err: any) {
      console.error('Gagal mengambil data analisis:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRateAndReadingForMeter = async (
    meterId: string
  ): Promise<{ rate: number; latestKwh: number; actualDailyKwh: number; isSpikeDetected: boolean; spikePercent: number }> => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data: todayReadings } = await supabase
      .from('meter_readings')
      .select('kwh, meter_value, created_at')
      .eq('meter_id', meterId)
      .gte('created_at', startOfToday.toISOString())
      .order('created_at', { ascending: true });

    const { data: readings } = await supabase
      .from('meter_readings')
      .select('kwh, meter_value, created_at')
      .eq('meter_id', meterId)
      .order('created_at', { ascending: false })
      .limit(10);

    let latestVal = 0;
    if (readings && readings.length > 0) {
      latestVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
    }

    let actualDailyKwh = 0;
    let accumulatedHourlyRate = 0;

    if (todayReadings && todayReadings.length >= 2) {
      const firstValToday = Number(todayReadings[0].meter_value ?? todayReadings[0].kwh ?? 0);
      const latestValToday = Number(todayReadings[todayReadings.length - 1].meter_value ?? todayReadings[todayReadings.length - 1].kwh ?? 0);

      if (firstValToday >= latestValToday) {
        actualDailyKwh = firstValToday - latestValToday;
      }

      const firstTime = new Date(todayReadings[0].created_at).getTime();
      const latestTime = new Date(todayReadings[todayReadings.length - 1].created_at).getTime();
      const totalHoursToday = (latestTime - firstTime) / (1000 * 60 * 60);

      if (totalHoursToday > 0 && actualDailyKwh > 0) {
        accumulatedHourlyRate = actualDailyKwh / totalHoursToday;
      }
    }

    let currentIntervalRate = 0;
    let isSpike = false;
    let spikePct = 0;

    if (readings && readings.length >= 2) {
      const validReadings: typeof readings = [readings[0]];
      for (let i = 1; i < readings.length; i++) {
        const prevTime = new Date(validReadings[validReadings.length - 1].created_at).getTime();
        const currTime = new Date(readings[i].created_at).getTime();
        const diffMinutes = (prevTime - currTime) / (1000 * 60);

        if (diffMinutes >= 5) {
          validReadings.push(readings[i]);
        }
      }

      if (validReadings.length >= 2) {
        const val1 = Number(validReadings[0].meter_value ?? validReadings[0].kwh ?? 0);
        const val2 = Number(validReadings[1].meter_value ?? validReadings[1].kwh ?? 0);
        const time1 = new Date(validReadings[0].created_at).getTime();
        const time2 = new Date(validReadings[1].created_at).getTime();
        const hoursLatest = (time1 - time2) / (1000 * 60 * 60);

        const consumedLatest = val2 >= val1 ? val2 - val1 : 0;
        currentIntervalRate = hoursLatest > 0 ? consumedLatest / hoursLatest : 0;

        if (validReadings.length >= 3) {
          const val3 = Number(validReadings[2].meter_value ?? validReadings[2].kwh ?? 0);
          const time3 = new Date(validReadings[2].created_at).getTime();
          const hoursPrev = (time2 - time3) / (1000 * 60 * 60);

          const consumedPrev = val3 >= val2 ? val3 - val2 : 0;
          const prevRate = hoursPrev > 0 ? consumedPrev / hoursPrev : 0;

          if (prevRate > 0 && currentIntervalRate > prevRate) {
            spikePct = Math.round(((currentIntervalRate - prevRate) / prevRate) * 100);
            if (spikePct >= 25) {
              isSpike = true;
            }
          }
        }
      }
    }

    const finalHourlyRate = accumulatedHourlyRate > 0 ? accumulatedHourlyRate : currentIntervalRate;

    return {
      rate: finalHourlyRate,
      latestKwh: latestVal,
      actualDailyKwh: actualDailyKwh,
      isSpikeDetected: isSpike,
      spikePercent: spikePct,
    };
  };

  const applyMetrics = (
    ratePerHour: number,
    powerVa: number = 1300,
    spikeDetected: boolean = false,
    spikePct: number = 0
  ) => {
    const { monthName, daysInNextMonth } = getNextMonthInfo();

    const dailyEst = ratePerHour * 24;
    const weeklyEst = dailyEst * 7;
    const monthlyKwh = dailyEst * daysInNextMonth;

    const tariff = getTariffRate(powerVa);
    const monthlyCost = monthlyKwh * tariff;

    setIsSpike(spikeDetected);
    setSpikePercent(spikePct);

    setNextMonthName(monthName);
    setNextMonthDays(daysInNextMonth);

    setHourlyRate(ratePerHour);
    setDailyEstKwh(dailyEst);
    setWeeklyEstKwh(weeklyEst);
    setMonthlyEstKwh(monthlyKwh);
    setMonthlyEstCost(monthlyCost);
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

    const headers = ['Nama Toko', 'Nomor Meter PLN', 'Daya (VA)', 'Laju Konsumsi (kWh/jam)', 'Pemakaian Riil Hari Ini (kWh)', 'Estimasi Harian (kWh)', `Estimasi Bulan ${nextMonthName} (${nextMonthDays}h) (kWh)`, 'Estimasi Biaya Bulanan (Rp)', 'Status Sisa Token'];
    const rows = storeAnalysisList.map((item) => [
      `"${item.store_name}"`,
      `"${item.meter_number || '-'}"`,
      item.power_va,
      item.hourlyRate.toFixed(2),
      item.actualDailyKwh.toFixed(1),
      item.dailyProjection.toFixed(2),
      item.monthlyProjectionNextMonth.toFixed(2),
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

  // BATAS MAKSIMUM UNTUK SKALA GRAFIK
  const maxWeeklyTrendKwh = selectedStoreObj?.weeklyTrend ? Math.max(...selectedStoreObj.weeklyTrend.map((t) => t.totalKwh), 1) : 1;
  const maxMonthlyTrendKwh = selectedStoreObj?.monthlyTrend ? Math.max(...selectedStoreObj.monthlyTrend.map((t) => t.totalKwh), 1) : 1;

  const potentialSavingsMonthly = monthlyEstCost * 0.15;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header Actions */}
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
              onChange={(e) => handleSelectStore(e.target.value)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* MATRIKS KONSUMSI SELURUH TOKO (SISA TOKEN & PROYEKSI BIAYA) */}
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
                          <th className="px-3 py-2.5">Laju Per Jam</th>
                          <th className="px-3 py-2.5">Sisa Token</th>
                          <th className="px-3 py-2.5">Est. Bulan Depan</th>
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
                            <td className="px-3 py-3 font-bold text-amber-700">
                              {item.latestKwh.toFixed(1)}{' '}
                              <span className="text-[9px] font-normal text-slate-500">kWh</span>
                            </td>
                            <td className="px-3 py-3 font-bold text-teal-800">
                              Rp {Math.round(item.monthlyCost).toLocaleString('id-ID')}
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
                                onClick={() => handleSelectStore(item.id)}
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

            {/* RIWAYAT TREN PEMAKAIAN (DENGAN DROPDOWN FILTER HARIAN / BULANAN) */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-700" />
                    <span>
                      {chartMode === 'daily' ? 'Tren Pemakaian 7 Hari Terakhir' : 'Tren Pemakaian 6 Bulan Terakhir'}:{' '}
                      <strong>{selectedStoreObj?.store_name}</strong>
                    </span>
                  </div>
                  
                  {/* DROPDOWN FILTER MODE GRAFIK */}
                  <select
                    value={chartMode}
                    onChange={(e) => setChartMode(e.target.value as 'daily' | 'monthly')}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="daily">Grafik Harian (7 Hari)</option>
                    <option value="monthly">Grafik Bulanan (6 Bulan)</option>
                  </select>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-2">
                {/* GRAFIK HARIAN (7 HARI TERAKHIR) */}
                {chartMode === 'daily' && (
                  !selectedStoreObj?.weeklyTrend || selectedStoreObj.weeklyTrend.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada data tren pindaian harian.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-7 gap-2 items-end h-32 pt-4 pb-2 border-b border-slate-100">
                        {selectedStoreObj.weeklyTrend.map((day, idx) => {
                          const barHeight = maxWeeklyTrendKwh > 0 ? (day.totalKwh / maxWeeklyTrendKwh) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                              <span className="text-[10px] font-bold text-slate-700 mb-1">
                                {day.totalKwh > 0 ? `${day.totalKwh}` : '-'}
                              </span>
                              <div className="w-full bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden max-w-[28px]">
                                <div
                                  className="w-full bg-teal-600 group-hover:bg-teal-700 transition-all duration-500 rounded-t-md"
                                  style={{ height: `${Math.max(barHeight, 5)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500 mt-1.5">{day.dayName}</span>
                              <span className="text-[8px] text-slate-400">{day.dateLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500 text-center font-medium pt-1">
                        * Konsumsi harian dihitung berdasarkan selisih pindaian kWh pada hari tersebut.
                      </p>
                    </div>
                  )
                )}

                {/* GRAFIK BULANAN (6 BULAN TERAKHIR) */}
                {chartMode === 'monthly' && (
                  !selectedStoreObj?.monthlyTrend || selectedStoreObj.monthlyTrend.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada data tren pindaian bulanan.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-6 gap-3 items-end h-32 pt-4 pb-2 border-b border-slate-100">
                        {selectedStoreObj.monthlyTrend.map((month, idx) => {
                          const barHeight = maxMonthlyTrendKwh > 0 ? (month.totalKwh / maxMonthlyTrendKwh) * 100 : 0;
                          return (
                            <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                              <span className="text-[10px] font-bold text-teal-800 mb-1">
                                {month.totalKwh > 0 ? `${month.totalKwh}` : '-'}
                              </span>
                              <div className="w-full bg-slate-100 rounded-t-md h-full flex items-end overflow-hidden max-w-[34px]">
                                <div
                                  className="w-full bg-teal-700 group-hover:bg-teal-800 transition-all duration-500 rounded-t-md"
                                  style={{ height: `${Math.max(barHeight, 5)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 mt-1.5">{month.monthLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-slate-500 text-center font-medium pt-1">
                        * Total akumulasi pemakaian kWh riil dalam kurun waktu 6 bulan terakhir.
                      </p>
                    </div>
                  )
                )}
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
                  Laju pindaian terbaru terdeteksi naik tinggi dibanding pindaian sebelumnya!
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
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" /> Breakdown Pindaian Hari Ini ({selectedStoreObj.store_name})
                    </span>
                    <span className="text-[11px] text-teal-700 font-normal">
                      {selectedStoreObj.todaySessions?.length || 0}x Pindaian Sukses
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2.5">
                  {!selectedStoreObj.todaySessions || selectedStoreObj.todaySessions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada pindaian tersimpan hari ini.</p>
                  ) : (
                    selectedStoreObj.todaySessions.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{s.sessionName}</span>
                            <span className="text-[10px] text-slate-400">Jam {s.time} WIB</span>
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

            {/* OVERVIEW METRIK BERSESUAIAN EXCEL */}
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

              <Card className="bg-amber-50/80 border border-amber-200">
                <CardContent className="p-3 text-center">
                  <div className="flex justify-center items-center gap-1 text-amber-700 mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase">Terpakai Hari Ini</span>
                  </div>
                  <div className="text-base font-extrabold text-amber-900">
                    {selectedStoreObj?.actualDailyKwh ? selectedStoreObj.actualDailyKwh.toFixed(1) : '0.0'}
                  </div>
                  <span className="text-[9px] text-amber-700 font-medium">kWh Jam Berjalan</span>
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

            {/* BLOCK DATA ESTIMASI LENGKAP - DINAMIS BULAN DEPAN */}
            <Card className="border-slate-200 bg-slate-100/80 shadow-xs">
              <CardContent className="p-4 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 block uppercase tracking-wider text-center">
                  Data Estimasi Proyeksi ({selectedStoreObj?.store_name})
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Harian</span>
                    <span className="font-extrabold text-slate-800">{dailyEstKwh.toFixed(2)} kWh</span>
                  </div>
                  <div className="border-x border-slate-200">
                    <span className="text-slate-500 block text-[10px] font-bold uppercase">Mingguan</span>
                    <span className="font-extrabold text-slate-800">{weeklyEstKwh.toFixed(2)} kWh</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-bold uppercase capitalize">
                      {nextMonthName || 'Bulanan'} ({nextMonthDays}h)
                    </span>
                    <span className="font-extrabold text-teal-800 block text-sm">
                      {monthlyEstKwh.toFixed(2)} kWh
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Recommendation for Budget - AUTOMATIC MONTH NAME */}
            <Card className="border-teal-200 bg-teal-50/50 shadow-sm">
              <CardContent className="p-4 flex items-start gap-3">
                <Cpu className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <span className="font-bold text-teal-900 block capitalize">
                    Anggaran Listrik Bulan {nextMonthName || 'Depan'} ({selectedStoreObj?.store_name}):
                  </span>
                  <p className="leading-relaxed">
                    Siapkan estimasi token <strong>{monthlyEstKwh.toFixed(0)} kWh</strong> atau sekitar <strong>Rp {Math.round(monthlyEstCost).toLocaleString('id-ID')}</strong> untuk operasional {nextMonthDays} hari ke depan berdasarkan pola konsumsi riil harian.
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
