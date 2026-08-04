'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Camera, TrendingDown, Cpu, Store, Plus, RefreshCw, LogIn, LogOut, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  const [metersData, setMetersData] = useState<MeterWithReading[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');
  const [remainingTokenKwh, setRemainingTokenKwh] = useState<number>(0);
  const [avgHourlyRateAll, setAvgHourlyRateAll] = useState<number>(0);

  const [intelligenceScore, setIntelligenceScore] = useState<number>(88);
  const [dataQuality, setDataQuality] = useState<number>(92);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    const storedStoreId = localStorage.getItem('active_store_id');
    if (storedStoreId) setActiveStoreId(storedStoreId);

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko
      const { data: meters, error: metersError } = await supabase
        .from('meters')
        .select('id, name, store_name, meter_number, power_va, created_at')
        .order('created_at', { ascending: false });

      if (metersError) throw metersError;

      if (!meters || meters.length === 0) {
        setMetersData([]);
        setLoading(false);
        setTimeout(() => router.push('/toko/tambah'), 500);
        return;
      }

      const storedStoreId = localStorage.getItem('active_store_id');
      if (!storedStoreId) {
        const first = meters[0];
        localStorage.setItem('active_store_id', first.id);
        localStorage.setItem('active_store_name', first.store_name || 'Toko');
        setActiveStoreId(first.id);
      }

      let accumLastReadings = 0;
      let accumHourlyRate = 0;
      const computedMeters: MeterWithReading[] = [];

      // 2. Query 2 data scan TERBARU untuk setiap toko (Berdasarkan created_at DESC)
      for (const m of meters) {
        const { data: readings, error: readErr } = await supabase
          .from('meter_readings')
          .select('id, kwh, meter_value, created_at')
          .eq('meter_id', m.id)
          .order('created_at', { ascending: false })
          .limit(2);

        if (readErr) console.warn(`Error fetching readings for ${m.id}:`, readErr);

        let lastVal: number | null = null;
        let hourlyRate = 0;
        let dailyProj = 0;
        let weeklyProj = 0;
        let monthlyProj = 0;
        let intervalHours = 0;

        if (readings && readings.length > 0) {
          lastVal = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);

          if (readings.length === 2) {
            const latest = {
              kwh: Number(readings[0].meter_value ?? readings[0].kwh ?? 0),
              time: new Date(readings[0].created_at).getTime(),
            };
            const previous = {
              kwh: Number(readings[1].meter_value ?? readings[1].kwh ?? 0),
              time: new Date(readings[1].created_at).getTime(),
            };

            // Hitung selisih jam antar scan (misal jam 10:00 -> 12:30 = 2.5 jam)
            const diffMs = latest.time - previous.time;
            intervalHours = diffMs / (1000 * 60 * 60);

            // Cek Normal Pemakaian vs Top-Up Token
            if (previous.kwh >= latest.kwh) {
              const consumedKwh = previous.kwh - latest.kwh;

              // Batas aman: Jika scan < 15 menit (0.25 jam), jangan ekstrapolasi berlebihan
              if (intervalHours >= 0.25) {
                hourlyRate = consumedKwh / intervalHours;
              } else if (intervalHours > 0) {
                // Untuk tes cepat < 15 menit, hitung laju langsung tanpa pembagian jam mikro
                hourlyRate = consumedKwh;
              }
            } else {
              // Top-Up Token: pemakaian interval diset 0
              hourlyRate = 0;
            }

            dailyProj = hourlyRate * 24;
            weeklyProj = dailyProj * 7;
            monthlyProj = dailyProj * 30;
          }
        }

        if (lastVal !== null) accumLastReadings += lastVal;
        accumHourlyRate += hourlyRate;

        computedMeters.push({
          id: m.id,
          store_name: m.store_name || m.name,
          meter_number: m.meter_number,
          power_va: m.power_va || 1300,
          lastReading: lastVal,
          hourlyRate,
          dailyProjection: dailyProj,
          weeklyProjection: weeklyProj,
          monthlyProjection: monthlyProj,
          lastScanIntervalHours: intervalHours,
        });
      }

      setMetersData(computedMeters);
      setRemainingTokenKwh(accumLastReadings);

      const avgHourly = meters.length > 0 ? accumHourlyRate / meters.length : 0;
      setAvgHourlyRateAll(avgHourly);

      // Estimasi Hari Sisa Token berdasarkan laju hourly rate total (24 jam)
      const totalDailyUsage = accumHourlyRate * 24;
      const estimatedDays = totalDailyUsage > 0
        ? Math.max(0, Math.floor(accumLastReadings / totalDailyUsage))
        : 0;
      setDaysLeft(estimatedDays);

      setIntelligenceScore(Math.min(98, 75 + meters.length * 5));
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

  const handleLogout = () => {
    localStorage.removeItem('active_store_id');
    localStorage.removeItem('active_store_name');
    localStorage.removeItem('active_meter_number');
    router.push('/login');
  };

  const filteredMeters = selectedMeterId === 'all'
    ? metersData
    : metersData.filter(m => m.id === selectedMeterId);

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Info */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Halo, Pengelola Toko 👋</h1>
          <p className="text-xs text-slate-500">
            Monitoring: <span className="font-semibold text-teal-700">{metersData.length} Toko Terdaftar</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {activeStoreId ? (
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
          <Card className="bg-gradient-to-br from-teal-700 to-teal-900 text-white shadow-xl border-none">
            <CardContent className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs opacity-80 uppercase tracking-wider">Energy Intelligence Score</span>
                  <div className="text-4xl font-extrabold mt-1">
                    {intelligenceScore}<span className="text-lg font-normal">/100</span>
                  </div>
                  <span className="inline-block mt-2 px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 text-xs rounded-md border border-emerald-400/30">
                    {intelligenceScore > 80 ? 'Excellent Efficiency' : 'Good Efficiency'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs opacity-80">Data Quality</span>
                  <div className="text-lg font-bold text-teal-200">{dataQuality}%</div>
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
                  {remainingTokenKwh.toFixed(1)} <span className="text-xs font-normal">kWh</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  ~ Rp {Math.round(remainingTokenKwh * 1444.7).toLocaleString('id-ID')}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-teal-600 mb-1">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-semibold">Estimasi Habis</span>
                </div>
                <div className="text-xl font-bold text-slate-800">
                  {daysLeft} <span className="text-xs font-normal">Hari Lagi</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Laju: {avgHourlyRateAll.toFixed(2)} kWh/jam
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Selector Toko */}
          {metersData.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Store className="w-4 h-4 text-teal-600" /> Filter Toko:
              </span>
              <select
                value={selectedMeterId}
                onChange={(e) => setSelectedMeterId(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800 focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Semua Toko ({metersData.length})</option>
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
              {filteredMeters.map((m) => (
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

                    {/* Rata-Rata Per Jam & Sisa Meteran */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-500 block text-[10px]">Sisa Meteran</span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          {m.lastReading !== null ? `${m.lastReading.toFixed(1)} kWh` : 'Belum Scan'}
                        </span>
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

                    {/* Proyeksi Harian, Mingguan, Bulanan */}
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
              ))}
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
                <strong>{avgHourlyRateAll.toFixed(2)} kWh/jam</strong> (sekitar{' '}
                <strong>{(avgHourlyRateAll * 24).toFixed(1)} kWh/hari</strong>).
              </p>
              <div className="p-2 bg-white rounded border border-teal-100 text-[11px] text-teal-800">
                💡 <strong>Rekomendasi Gemini AI:</strong> Isi ulang token disarankan ketika sisa token berada di bawah{' '}
                <strong>15 kWh</strong> untuk mencegah mati listrik mendadak di jam operasional toko.
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
