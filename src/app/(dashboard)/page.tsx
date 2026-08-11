'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Zap,
  Camera,
  TrendingDown,
  Cpu,
  Store,
  Plus,
  RefreshCw,
  LogIn,
  LogOut,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Lock,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate } from '@/lib/constants';

interface TodayScanSession {
  id: string;
  time: string;
  kwh: number;
  consumptionFromPrev: number | null;
  sessionName: string;
}

interface MeterWithReading {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
  lastReading: number | null;
  hourlyRate: number;
  actualDailyKwh: number;
  dailyProjection: number;
  weeklyProjection: number;
  monthlyProjection: number;
  lastScanIntervalHours: number;
  confidence: number;
  todayScanCount: number;
  todaySessions: TodayScanSession[];
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('staff');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [metersData, setMetersData] = useState<MeterWithReading[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');

  useEffect(() => {
    const storedStoreId = localStorage.getItem('active_store_id');
    const storedRole = localStorage.getItem('user_role');

    if (storedStoreId && storedRole) {
      setIsLoggedIn(true);
      setActiveStoreId(storedStoreId);
      setUserRole(storedRole);
      fetchDashboardData(storedRole, storedStoreId);
    } else {
      setIsLoggedIn(false);
      setActiveStoreId(null);
      setUserRole('staff');
      setMetersData([]);
      setLoading(false);
    }
  }, []);

  const fetchDashboardData = async (roleParam?: string, storeIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? (localStorage.getItem('user_role') || 'staff');
      const currentStoreId = storeIdParam ?? localStorage.getItem('active_store_id');

      if (!currentStoreId && currentRole !== 'admin') {
        setMetersData([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('meters')
        .select('id, name, store_name, meter_number, power_va, created_at, role');

      if (currentRole !== 'admin' && currentStoreId) {
        query = query.eq('id', currentStoreId);
      }

      const { data: meters, error: metersError } = await query.order('created_at', { ascending: false });

      if (metersError) throw metersError;

      if (!meters || meters.length === 0) {
        setMetersData([]);
        setLoading(false);
        return;
      }

      if (currentRole !== 'admin' && meters[0]) {
        setSelectedMeterId(meters[0].id);
      } else if (currentRole === 'admin') {
        setSelectedMeterId('all');
      }

      const computedMeters: MeterWithReading[] = [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      for (const m of meters) {
        // Ambil 10 pindaian terakhir untuk pemfilteran interval valid
        const { data: readings } = await supabase
          .from('meter_readings')
          .select('id, kwh, meter_value, confidence, created_at')
          .eq('meter_id', m.id)
          .order('created_at', { ascending: false })
          .limit(10);

        // Ambil seluruh pindaian hari ini (diurutkan kronologis dari awal hari)
        const { data: todayReadings } = await supabase
          .from('meter_readings')
          .select('id, kwh, meter_value, created_at')
          .eq('meter_id', m.id)
          .gte('created_at', startOfToday.toISOString())
          .order('created_at', { ascending: true });

        const scanCountToday = todayReadings?.length || 0;

        const formattedSessions: TodayScanSession[] = [];
        let actualDailyKwh = 0;

        if (todayReadings && todayReadings.length > 0) {
          todayReadings.forEach((r, idx) => {
            const val = Number(r.meter_value ?? r.kwh ?? 0);
            const dateObj = new Date(r.created_at);
            const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            let consumed: number | null = null;
            if (idx > 0) {
              const prevVal = Number(todayReadings[idx - 1].meter_value ?? todayReadings[idx - 1].kwh ?? 0);
              if (prevVal >= val) {
                consumed = prevVal - val;
              }
            }

            const sessionLabel = `Pindaian #${idx + 1}`;

            formattedSessions.push({
              id: r.id,
              time: timeStr,
              kwh: val,
              consumptionFromPrev: consumed,
              sessionName: sessionLabel,
            });
          });

          // HITUNG PEMAKAIAN RIIL HARI INI: Pindaian Pertama vs Pindaian Terakhir Hari Ini
          if (todayReadings.length >= 2) {
            const firstValToday = Number(todayReadings[0].meter_value ?? todayReadings[0].kwh ?? 0);
            const latestValToday = Number(todayReadings[todayReadings.length - 1].meter_value ?? todayReadings[todayReadings.length - 1].kwh ?? 0);
            if (firstValToday >= latestValToday) {
              actualDailyKwh = firstValToday - latestValToday;
            }
          }
        }

        let lastVal: number | null = null;
        let hourlyRate = 0;
        let intervalHours = 0;
        let avgMeterConfidence = 85;

        if (readings && readings.length > 0) {
          lastVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
          avgMeterConfidence = Number(readings[0].confidence || 85);
        }

        // PEMBARUAN LOGIKA LAJU PER JAM: Akumulasi Riil Hari Ini / Total Jam Hari Ini
        if (todayReadings && todayReadings.length >= 2) {
          const firstTime = new Date(todayReadings[0].created_at).getTime();
          const latestTime = new Date(todayReadings[todayReadings.length - 1].created_at).getTime();
          const totalHoursToday = (latestTime - firstTime) / (1000 * 60 * 60);

          if (totalHoursToday > 0 && actualDailyKwh > 0) {
            hourlyRate = actualDailyKwh / totalHoursToday;
            intervalHours = totalHoursToday;
          }
        } else if (readings && readings.length >= 2) {
          // Fallback jika baru 1 pindaian hari ini
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
            const latest = Number(validReadings[0].meter_value ?? validReadings[0].kwh ?? 0);
            const previousValid = Number(validReadings[1].meter_value ?? validReadings[1].kwh ?? 0);

            const diffMs = new Date(validReadings[0].created_at).getTime() - new Date(validReadings[1].created_at).getTime();
            intervalHours = diffMs / (1000 * 60 * 60);

            if (previousValid >= latest && intervalHours > 0) {
              hourlyRate = (previousValid - latest) / intervalHours;
            }
          }
        }

        // PENYESUAIAN METRIK: Proyeksi berbasis pemakaian riil harian (Fallback ke laju * 24 jika pindaian < 2)
        const dailyBaseForProjection = actualDailyKwh > 0 ? actualDailyKwh : hourlyRate * 24;
        const dailyProj = dailyBaseForProjection;
        const weeklyProj = dailyBaseForProjection * 7;
        const monthlyProj = dailyBaseForProjection * 30;

        const storePowerVa = m.power_va || 1300;

        computedMeters.push({
          id: m.id,
          store_name: m.store_name || m.name,
          meter_number: m.meter_number,
          power_va: storePowerVa,
          lastReading: lastVal,
          hourlyRate,
          actualDailyKwh,
          dailyProjection: dailyProj,
          weeklyProjection: weeklyProj,
          monthlyProjection: monthlyProj,
          lastScanIntervalHours: intervalHours,
          confidence: avgMeterConfidence,
          todayScanCount: scanCountToday,
          todaySessions: formattedSessions,
        });
      }

      setMetersData(computedMeters);

    } catch (err: any) {
      console.error('Error fetching dashboard:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const channel = supabase
      .channel('public:meter_readings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meter_readings' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing channel', err);
      }
    };
  }, [supabase, isLoggedIn]);

  const handleLogout = async () => {
    try {
      setActiveStoreId(null);
      setIsLoggedIn(false);
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

  const isAllMode = selectedMeterId === 'all';
  const filteredMeters = isAllMode
    ? metersData
    : metersData.filter((m) => m.id === selectedMeterId);

  const displayTokenKwh = filteredMeters.reduce((acc, curr) => acc + (curr.lastReading || 0), 0);

  const displayEstimatedRupiah = filteredMeters.reduce((acc, curr) => {
    const tariff = getTariffRate(curr.power_va);
    return acc + (curr.lastReading || 0) * tariff;
  }, 0);

  const displayHourlyRate = filteredMeters.reduce((acc, curr) => acc + curr.hourlyRate, 0);

  // Perhitungan Estimasi Habis berdasarkan Total Pemakaian Riil Harian
  const totalDailyKwh = filteredMeters.reduce((acc, curr) => acc + curr.dailyProjection, 0);
  const displayDaysLeft = totalDailyKwh > 0 ? Math.max(0, Math.floor(displayTokenKwh / totalDailyKwh)) : 0;

  const displayTodayScans = filteredMeters.reduce((acc, curr) => acc + curr.todayScanCount, 0);

  const getDisplayScore = () => {
    let score = 85;
    if (displayDaysLeft <= 2) score -= 30;
    else if (displayDaysLeft <= 5) score -= 15;
    if (displayHourlyRate > 15 * (isAllMode ? Math.max(1, filteredMeters.length) : 1)) score -= 15;
    if (displayTodayScans >= 2 * (isAllMode ? Math.max(1, filteredMeters.length) : 1)) score += 10;
    return Math.min(99, Math.max(25, score));
  };

  const currentDisplayScore = getDisplayScore();

  const getScanModeText = (count: number) => {
    if (count === 0) return { label: '0 Scan (No Data)', color: 'text-rose-300' };
    if (isAllMode) return { label: `${count} Scan Global`, color: 'text-emerald-300' };
    if (count === 1) return { label: '1 Scan (Basic)', color: 'text-amber-300' };
    if (count === 2) return { label: '2 Scan (Optimal)', color: 'text-emerald-300' };
    return { label: `${count} Scan (Active)`, color: 'text-teal-200' };
  };

  const currentScanMode = getScanModeText(displayTodayScans);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header Info */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-1.5">
            Halo, {userRole === 'admin' ? 'Owner / Pengawas' : 'Pengelola Toko'} 👋
            {isLoggedIn && userRole === 'admin' && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitoring: <span className="font-semibold text-teal-700">{isLoggedIn ? `${metersData.length} Toko Terdaftar` : 'Silakan Masuk'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            <Link href="/toko/tambah">
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold gap-1 px-3 h-9">
                <Plus className="w-4 h-4" /> Tambah Toko
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-base font-medium">Memuat data energi...</span>
        </div>
      ) : !isLoggedIn ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Akses Dashboard Terkunci</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk melihat ringkasan konsumsi listrik toko Anda.
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
          
          {/* KOLOM KIRI (2 SPAN PADA DESKTOP) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card Score & Status Scan */}
            <Card className="bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 text-white shadow-xl border-none">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
                      Energy Intelligence Score {isAllMode ? '(Global)' : ''}
                    </span>
                    <div className="text-5xl font-extrabold mt-2">
                      {currentDisplayScore}<span className="text-xl font-normal text-emerald-300">/100</span>
                    </div>
                    <span className={`inline-block mt-3 px-3 py-1 text-xs font-semibold rounded-md border ${
                      currentDisplayScore >= 80 
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/20'
                        : currentDisplayScore >= 60 
                        ? 'bg-amber-500/20 text-amber-200 border-amber-400/20'
                        : 'bg-rose-500/20 text-rose-200 border-rose-400/20'
                    }`}>
                      {currentDisplayScore >= 80 ? 'Excellent Efficiency' : currentDisplayScore >= 60 ? 'Need Attention' : 'Critical Status'}
                    </span>
                  </div>

                  <div className="text-right bg-teal-950/50 p-3.5 rounded-xl border border-teal-700/40">
                    <span className="text-[10px] font-bold tracking-widest text-teal-300 uppercase block">
                      Status Scan Hari Ini
                    </span>
                    <div className={`text-sm font-extrabold mt-1 ${currentScanMode.color}`}>
                      {currentScanMode.label}
                    </div>
                    <span className="text-[10px] text-teal-200 block mt-1">
                      {displayTodayScans === 0 ? 'Belum scan hari ini' : `${displayTodayScans}x Pindaian Sukses`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="p-5">
                  <div className="flex items-center space-x-2 text-amber-600 mb-1">
                    <Zap className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">{isAllMode ? 'Total Sisa Token' : 'Sisa Token Toko'}</span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-800">
                    {displayTokenKwh.toFixed(1)} <span className="text-sm font-normal">kWh</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ~ Rp {Math.round(displayEstimatedRupiah).toLocaleString('id-ID')}
                  </p>
                </CardContent>
              </Card>

              <Card className={`border-slate-200 ${displayDaysLeft <= 2 ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50'}`}>
                <CardContent className="p-5">
                  <div className={`flex items-center space-x-2 mb-1 ${displayDaysLeft <= 2 ? 'text-rose-600' : 'text-teal-600'}`}>
                    {displayDaysLeft <= 2 ? <AlertTriangle className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    <span className="text-xs font-bold uppercase">Estimasi Habis</span>
                  </div>
                  <div className={`text-2xl font-extrabold ${displayDaysLeft <= 2 ? 'text-rose-700' : 'text-slate-800'}`}>
                    {displayDaysLeft} <span className="text-sm font-normal">Hari Lagi</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Laju: {displayHourlyRate.toFixed(2)} kWh/jam
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Selector Toko */}
            {metersData.length > 0 && (
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-teal-600" /> Filter Toko Terpilih:
                </span>
                <select
                  value={selectedMeterId}
                  onChange={(e) => setSelectedMeterId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none shadow-sm"
                >
                  {userRole === 'admin' && (
                    <option value="all">Semua Toko ({metersData.length})</option>
                  )}
                  {metersData.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.store_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Breakdown Toko */}
            <div className="space-y-4">
              {filteredMeters.map((m) => {
                const storeTariff = getTariffRate(m.power_va);
                const storeEstimatedRupiah = (m.lastReading ?? 0) * storeTariff;

                return (
                  <Card key={m.id} className="border-slate-200 hover:border-teal-300 transition shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-start border-b pb-3">
                        <div>
                          <h3 className="font-bold text-slate-800 text-base">{m.store_name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            PLN ID: <span className="font-mono text-slate-700 font-semibold">{m.meter_number}</span> • {m.power_va} VA
                          </p>
                        </div>
                        <span className="text-xs bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full font-bold border border-teal-200">
                          Aktif
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <span className="text-slate-500 block text-xs">Sisa Meteran</span>
                          <span className="font-extrabold text-slate-800 text-base">
                            {m.lastReading !== null ? `${m.lastReading.toFixed(1)} kWh` : 'Belum Scan'}
                          </span>
                          {m.lastReading !== null && (
                            <span className="block text-xs text-slate-400 mt-0.5">
                              ~ Rp {Math.round(storeEstimatedRupiah).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        <div className="bg-teal-50 p-3 rounded-xl">
                          <span className="text-teal-700 block text-xs flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5" /> Pemakaian Rata-Rata
                          </span>
                          <span className="font-extrabold text-teal-900 text-base">
                            {m.hourlyRate.toFixed(2)} kWh/jam
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-100/70 p-3 rounded-xl grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold">
                            {m.actualDailyKwh > 0 ? 'Terpakai Hari Ini' : 'Estimasi Sehari'}
                          </span>
                          <span className="font-extrabold text-slate-800">{m.dailyProjection.toFixed(1)} kWh</span>
                        </div>
                        <div className="border-x border-slate-200">
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Seminggu</span>
                          <span className="font-extrabold text-slate-800">{m.weeklyProjection.toFixed(1)} kWh</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Sebulan (30h)</span>
                          <span className="font-extrabold text-slate-800">{m.monthlyProjection.toFixed(1)} kWh</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* KOLOM KANAN (DESKTOP SIDEBAR 1 SPAN) */}
          <div className="space-y-6">
            
            {/* RIWAYAT PINDAIAN HARI INI (TIME-SERIES LOG) */}
            {filteredMeters.map((m) => (
              <Card key={`sessions-${m.id}`} className="border-teal-200 bg-teal-50/30 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" /> Riwayat Pindaian Hari Ini ({m.store_name})
                    </span>
                    <span className="text-[11px] text-teal-700 font-normal">
                      {m.todaySessions.length}x Pindaian
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2.5">
                  {m.todaySessions.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada pindaian tersimpan hari ini.</p>
                  ) : (
                    m.todaySessions.map((s) => (
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
            ))}

            {/* AI Energy Insight */}
            <Card className="border-teal-200 bg-teal-50/50 shadow-sm">
              <CardHeader className="p-5 pb-2 flex flex-row items-center space-x-2">
                <Cpu className="w-5 h-5 text-teal-700" />
                <CardTitle className="text-sm font-bold text-teal-900">AI Energy Insight</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 text-xs text-slate-700 space-y-3">
                <p className="leading-relaxed">
                  Rata-rata konsumsi listrik {isAllMode ? 'gabungan seluruh toko' : 'toko ini'} saat ini adalah{' '}
                  <strong>{displayHourlyRate.toFixed(2)} kWh/jam</strong> (dengan akumulasi riil hari ini{' '}
                  <strong>{totalDailyKwh.toFixed(1)} kWh</strong>).
                </p>
                <div className="p-3 bg-white rounded-xl border border-teal-100 text-xs text-teal-800 leading-relaxed">
                  💡 <strong>Rekomendasi Pembelian Token:</strong> Proyeksi bulanan toko disarankan menyiapkan sekitar <strong>{(totalDailyKwh * 30).toFixed(0)} kWh</strong> per bulan untuk menjaga kelancaran operasional toko.
                </div>
              </CardContent>
            </Card>

            {/* Action Button Scan */}
            <div>
              <Link href="/scan">
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-6 rounded-xl shadow-lg flex items-center justify-center space-x-2 text-sm">
                  <Camera className="w-5 h-5" />
                  <span>Pindai Meter Listrik Sekarang</span>
                </Button>
              </Link>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
