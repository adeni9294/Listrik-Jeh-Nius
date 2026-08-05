'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Camera, TrendingDown, Cpu, Store, Plus, RefreshCw, LogIn, LogOut, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate } from '@/lib/constants';

interface MeterWithReading {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
  lastReading: number | null;
  hourlyRate: number;      // kWh / jam
  dailyProjection: number; // kWh / hari
  weeklyProjection: number;// kWh / minggu
  monthlyProjection: number;// kWh / bulan
  lastScanIntervalHours: number;
  confidence: number;
  todayScanCount: number;  // Jumlah pindaian khusus HARI INI
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
  const [remainingTokenKwh, setRemainingTokenKwh] = useState<number>(0);
  const [totalEstimatedRupiah, setTotalEstimatedRupiah] = useState<number>(0);
  const [avgHourlyRateAll, setAvgHourlyRateAll] = useState<number>(0);

  const [intelligenceScore, setIntelligenceScore] = useState<number>(0);
  const [totalTodayScans, setTotalTodayScans] = useState<number>(0);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    const storedStoreId = localStorage.getItem('active_store_id');
    const storedRole = localStorage.getItem('user_role');

    if (storedStoreId && storedRole) {
      setIsLoggedIn(true);
      setActiveStoreId(storedStoreId);
      setUserRole(storedRole);
    } else {
      setIsLoggedIn(false);
      setActiveStoreId(null);
      setUserRole('staff');
    }

    fetchDashboardData(storedRole || 'staff', storedStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async (roleParam?: string, storeIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? (localStorage.getItem('user_role') || 'staff');
      const currentStoreId = storeIdParam ?? localStorage.getItem('active_store_id');

      // 1. Ambil daftar toko dengan filter RBAC
      let query = supabase
        .from('meters')
        .select('id, name, store_name, meter_number, power_va, created_at, role');

      // BUKAN ADMIN: Kunci query hanya ke toko miliknya sendiri
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

      // Jika role staff, paksa selector toko ke tokonya saja (bukan 'all')
      if (currentRole !== 'admin' && meters[0]) {
        setSelectedMeterId(meters[0].id);
      }

      let accumLastReadings = 0;
      let accumHourlyRate = 0;
      let accumRupiah = 0;
      let globalTodayScanSum = 0;

      const computedMeters: MeterWithReading[] = [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // 2. Query data scan TERBARU & hitung scan HARI INI untuk tiap toko
      for (const m of meters) {
        const { data: readings, error: readErr } = await supabase
          .from('meter_readings')
          .select('id, kwh, meter_value, confidence, created_at')
          .eq('meter_id', m.id)
          .order('created_at', { ascending: false })
          .limit(2);

        if (readErr) console.warn(`Error fetching readings for ${m.id}:`, readErr);

        const { data: todayReadings } = await supabase
          .from('meter_readings')
          .select('id')
          .eq('meter_id', m.id)
          .gte('created_at', startOfToday.toISOString());

        const scanCountToday = todayReadings?.length || 0;
        globalTodayScanSum += scanCountToday;

        let lastVal: number | null = null;
        let hourlyRate = 0;
        let dailyProj = 0;
        let weeklyProj = 0;
        let monthlyProj = 0;
        let intervalHours = 0;
        let avgMeterConfidence = 85;

        if (readings && readings.length > 0) {
          lastVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
          avgMeterConfidence = Number(readings[0].confidence || 85);

          if (readings.length === 2) {
            const latest = {
              kwh: Number(readings[0].meter_value ?? readings[0].kwh ?? 0),
              time: new Date(readings[0].created_at).getTime(),
            };
            const previous = {
              kwh: Number(readings[1].meter_value ?? readings[1].kwh ?? 0),
              time: new Date(readings[1].created_at).getTime(),
            };

            const diffMs = latest.time - previous.time;
            intervalHours = diffMs / (1000 * 60 * 60);

            if (previous.kwh >= latest.kwh) {
              const consumedKwh = previous.kwh - latest.kwh;
              if (intervalHours >= 0.25) {
                hourlyRate = consumedKwh / intervalHours;
              } else if (intervalHours > 0) {
                hourlyRate = consumedKwh;
              }
            } else {
              hourlyRate = 0;
            }

            dailyProj = hourlyRate * 24;
            weeklyProj = dailyProj * 7;
            monthlyProj = dailyProj * 30;
          }
        }

        const storePowerVa = m.power_va || 1300;
        const tariff = getTariffRate(storePowerVa);

        if (lastVal !== null) {
          accumLastReadings += lastVal;
          accumRupiah += lastVal * tariff;
        }
        accumHourlyRate += hourlyRate;

        computedMeters.push({
          id: m.id,
          store_name: m.store_name || m.name,
          meter_number: m.meter_number,
          power_va: storePowerVa,
          lastReading: lastVal,
          hourlyRate,
          dailyProjection: dailyProj,
          weeklyProjection: weeklyProj,
          monthlyProjection: monthlyProj,
          lastScanIntervalHours: intervalHours,
          confidence: avgMeterConfidence,
          todayScanCount: scanCountToday,
        });
      }

      setMetersData(computedMeters);
      setTotalTodayScans(globalTodayScanSum);

      setRemainingTokenKwh(accumLastReadings);
      setTotalEstimatedRupiah(accumRupiah);

      const avgHourly = meters.length > 0 ? accumHourlyRate / meters.length : 0;
      setAvgHourlyRateAll(avgHourly);

      const totalDailyUsage = accumHourlyRate * 24;
      const estimatedDays = totalDailyUsage > 0
        ? Math.max(0, Math.floor(accumLastReadings / totalDailyUsage))
        : 0;
      setDaysLeft(estimatedDays);

      let calculatedScore = 85;
      if (estimatedDays <= 2) calculatedScore -= 30;
      else if (estimatedDays <= 5) calculatedScore -= 15;

      if (avgHourly > 15) calculatedScore -= 15;
      if (globalTodayScanSum >= 2) calculatedScore += 10;

      const finalScore = Math.min(99, Math.max(25, calculatedScore));
      setIntelligenceScore(finalScore);

    } catch (err: any) {
      console.error('Error fetching dashboard:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription
  useEffect(() => {
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
  }, [supabase]);

  // Perbaikan fungsi Logout: Hapus seluruh cache & reload total halaman
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

  const filteredMeters = selectedMeterId === 'all'
    ? metersData
    : metersData.filter(m => m.id === selectedMeterId);

  const displayTokenKwh = selectedMeterId === 'all'
    ? remainingTokenKwh
    : filteredMeters[0]?.lastReading ?? 0;

  const displayEstimatedRupiah = selectedMeterId === 'all'
    ? totalEstimatedRupiah
    : (filteredMeters[0]?.lastReading ?? 0) * getTariffRate(filteredMeters[0]?.power_va ?? 1300);

  const displayHourlyRate = selectedMeterId === 'all'
    ? avgHourlyRateAll
    : filteredMeters[0]?.hourlyRate ?? 0;

  const displayDaysLeft = selectedMeterId === 'all'
    ? daysLeft
    : (displayHourlyRate * 24 > 0 ? Math.max(0, Math.floor(displayTokenKwh / (displayHourlyRate * 24))) : 0);

  const displayTodayScans = selectedMeterId === 'all'
    ? totalTodayScans
    : filteredMeters[0]?.todayScanCount ?? 0;

  const getDisplayScore = () => {
    let score = 85;
    if (displayDaysLeft <= 2) score -= 30;
    else if (displayDaysLeft <= 5) score -= 15;
    if (displayHourlyRate > 15) score -= 15;
    if (displayTodayScans >= 2) score += 10;
    return Math.min(99, Math.max(25, score));
  };

  const currentDisplayScore = getDisplayScore();

  const getScanModeText = (count: number) => {
    if (count === 0) return { label: '0 Scan (No Data)', color: 'text-rose-300' };
    if (count === 1) return { label: '1 Scan (Basic Mode)', color: 'text-amber-300' };
    if (count === 2) return { label: '2 Scan (Optimal Mode)', color: 'text-emerald-300' };
    return { label: `${count} Scan (Advanced Mode)`, color: 'text-teal-200' };
  };

  const currentScanMode = getScanModeText(displayTodayScans);

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Info */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-1.5">
            Halo, Pengelola Toko 👋
            {userRole === 'admin' && (
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold border border-amber-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Admin
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">
            Monitoring: <span className="font-semibold text-teal-700">{metersData.length} Toko Terdaftar</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {isLoggedIn ? (
            <Button
              onClick={handleLogout}
              size="sm"
              variant="outline"
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 text-xs font-semibold gap-1 px-2.5 h-8"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </Button>
          ) : (
            <Link href="/login">
              <Button
                size="sm"
                variant="outline"
                className="bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold gap-1 px-2.5 h-8"
              >
                <LogIn className="w-3.5 h-3.5" /> Masuk
              </Button>
            </Link>
          )}

          <Link href="/toko/tambah">
            <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold gap-1 px-2.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Toko
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat analisis energi toko...</span>
        </div>
      ) : (
        <>
          {/* Energy Intelligence Score Card */}
          <Card className="bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 text-white shadow-xl border-none">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                    Energy Intelligence Score
                  </span>
                  <div className="text-4xl font-extrabold mt-1">
                    {currentDisplayScore}<span className="text-lg font-normal text-emerald-300">/100</span>
                  </div>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${
                    currentDisplayScore >= 80 
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/20'
                      : currentDisplayScore >= 60 
                      ? 'bg-amber-500/20 text-amber-200 border-amber-400/20'
                      : 'bg-rose-500/20 text-rose-200 border-rose-400/20'
                  }`}>
                    {currentDisplayScore >= 80 ? 'Excellent Efficiency' : currentDisplayScore >= 60 ? 'Need Attention' : 'Critical Status'}
                  </span>
                </div>

                <div className="text-right bg-teal-950/50 p-2.5 rounded-xl border border-teal-700/40">
                  <span className="text-[9px] font-bold tracking-widest text-teal-300 uppercase block">
                    Status Scan Hari Ini
                  </span>
                  <div className={`text-xs font-extrabold mt-1 ${currentScanMode.color}`}>
                    {currentScanMode.label}
                  </div>
                  <span className="text-[9px] text-teal-200 block mt-0.5">
                    {displayTodayScans === 0 ? 'Belum scan hari ini' : `${displayTodayScans}x Pindaian Sukses`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-amber-600 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-semibold">Total Sisa Token</span>
                </div>
                <div className="text-xl font-bold text-slate-800">
                  {displayTokenKwh.toFixed(1)} <span className="text-xs font-normal">kWh</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ~ Rp {Math.round(displayEstimatedRupiah).toLocaleString('id-ID')}
                </p>
              </CardContent>
            </Card>

            <Card className={`border-slate-200 ${displayDaysLeft <= 2 ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50'}`}>
              <CardContent className="p-4">
                <div className={`flex items-center space-x-2 mb-1 ${displayDaysLeft <= 2 ? 'text-rose-600' : 'text-teal-600'}`}>
                  {displayDaysLeft <= 2 ? <AlertTriangle className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-xs font-semibold">Estimasi Habis</span>
                </div>
                <div className={`text-xl font-bold ${displayDaysLeft <= 2 ? 'text-rose-700' : 'text-slate-800'}`}>
                  {displayDaysLeft} <span className="text-xs font-normal">Hari Lagi</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Laju: {displayHourlyRate.toFixed(2)} kWh/jam
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Selector Toko (Sesuai Hak Akses Role) */}
          {metersData.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Store className="w-4 h-4 text-teal-600" /> Filter Toko:
              </span>
              <select
                value={selectedMeterId}
                onChange={(e) => setSelectedMeterId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none shadow-sm"
              >
                {/* Opsi 'Semua Toko' HANYA muncul untuk Admin */}
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
          {filteredMeters.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-xs text-slate-500">Belum ada toko yang didaftarkan.</p>
                <Link href="/toko/tambah">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                    <Plus className="w-4 h-4 mr-1" /> Daftarkan Toko Pertama
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMeters.map((m) => {
                const storeTariff = getTariffRate(m.power_va);
                const storeEstimatedRupiah = (m.lastReading ?? 0) * storeTariff;

                return (
                  <Card key={m.id} className="border-slate-200 hover:border-teal-300 transition">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start border-b pb-2">
                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">{m.store_name}</h3>
                          <p className="text-[11px] text-slate-500">
                            PLN ID: <span className="font-mono text-slate-700">{m.meter_number}</span> • {m.power_va} VA
                          </p>
                        </div>
                        <span className="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full font-bold border border-teal-200">
                          Aktif
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded-xl">
                          <span className="text-slate-500 block text-[10px]">Sisa Meteran</span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            {m.lastReading !== null ? `${m.lastReading.toFixed(1)} kWh` : 'Belum Scan'}
                          </span>
                          {m.lastReading !== null && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              ~ Rp {Math.round(storeEstimatedRupiah).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        <div className="bg-teal-50 p-2.5 rounded-xl">
                          <span className="text-teal-700 block text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pemakaian Rata-Rata
                          </span>
                          <span className="font-extrabold text-teal-900 text-sm">
                            {m.hourlyRate.toFixed(2)} kWh/jam
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-100/70 p-2.5 rounded-xl grid grid-cols-3 gap-1 text-center text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[9px]">Sehari (24j)</span>
                          <span className="font-bold text-slate-700">{m.dailyProjection.toFixed(1)} kWh</span>
                        </div>
                        <div className="border-x border-slate-200">
                          <span className="text-slate-500 block text-[9px]">Seminggu</span>
                          <span className="font-bold text-slate-700">{m.weeklyProjection.toFixed(1)} kWh</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9px]">Sebulan (30h)</span>
                          <span className="font-bold text-slate-700">{m.monthlyProjection.toFixed(1)} kWh</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* AI Insight Box */}
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader className="p-4 pb-2 flex flex-row items-center space-x-2">
              <Cpu className="w-5 h-5 text-teal-700" />
              <CardTitle className="text-sm font-bold text-teal-900">AI Energy Insight</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-slate-700 space-y-2">
              <p>
                Rata-rata konsumsi listrik toko Anda saat ini adalah{' '}
                <strong>{displayHourlyRate.toFixed(2)} kWh/jam</strong> (sekitar{' '}
                <strong>{(displayHourlyRate * 24).toFixed(1)} kWh/hari</strong>).
              </p>
              <div className="p-2 bg-white rounded border border-teal-100 text-[11px] text-teal-800">
                💡 <strong>Rekomendasi :</strong> Lakukan pindaian minimal 3x sehari (pagi, siang & malam) untuk mengaktifkan <strong>Optimal Mode</strong> guna deteksi anomali yang lebih presisi.
              </div>
            </CardContent>
          </Card>

          {/* Action Button Scan */}
          <div className="pt-2">
            <Link href="/scan">
              <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-6 rounded-xl shadow-lg flex items-center justify-center space-x-2">
                <Camera className="w-5 h-5" />
                <span>Pindai Meter Listrik Sekarang</span>
              </Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
