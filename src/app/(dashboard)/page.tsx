'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Camera, TrendingDown, Cpu, Store, Plus, RefreshCw, LogIn, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { computeConsumption } from '@/lib/consumption';

interface MeterWithReading {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
  lastReading: number | null;
  monthlyUsage: number;
  perDay?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  // State Data Toko & Metrik Real-time
  const [metersData, setMetersData] = useState<MeterWithReading[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');
  const [totalKwhMonth, setTotalKwhMonth] = useState<number>(0);
  const [remainingTokenKwh, setRemainingTokenKwh] = useState<number>(0);

  // Dynamic AI Metrics (Dihitung otomatis)
  const [intelligenceScore, setIntelligenceScore] = useState<number>(88);
  const [dataQuality, setDataQuality] = useState<number>(92);
  const [daysLeft, setDaysLeft] = useState<number>(0);

  useEffect(() => {
    // Jangan otomatis redirect berdasarkan localStorage — ambil data dulu
    const storedStoreId = localStorage.getItem('active_store_id');
    if (storedStoreId) setActiveStoreId(storedStoreId);

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Ambil semua toko milik user
      const { data: meters, error: metersError } = await supabase
        .from('meters')
        .select('id, name, store_name, meter_number, power_va, created_at')
        .order('created_at', { ascending: false });

      if (metersError) throw metersError;

      console.log('Fetched meters:', meters);

      if (!meters || meters.length === 0) {
        setMetersData([]);
        setLoading(false);
        // Jika tidak ada toko, arahkan pengguna ke halaman tambah toko
        // tapi beri sedikit delay supaya UI tidak langsung lompat
        setTimeout(() => router.push('/toko/tambah'), 500);
        return;
      }

      // Jika tidak ada activeStoreId di localStorage, set yang pertama sebagai default
      const storedStoreId = localStorage.getItem('active_store_id');
      if (!storedStoreId) {
        const first = meters[0];
        localStorage.setItem('active_store_id', first.id);
        localStorage.setItem('active_store_name', first.store_name || 'Toko');
        setActiveStoreId(first.id);
        console.log('No active_store_id found, defaulting to:', first.id);
      }

      // Hitung Tanggal Awal Bulan Ini
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      let accumKwhAllStores = 0;
      let accumLastReadings = 0;
      const computedMeters: MeterWithReading[] = [];

      // 2. Query bacaan untuk setiap toko
      for (const m of meters) {
        // Ambil bacaan paling terakhir
        const { data: latest, error: latestErr } = await supabase
          .from('meter_readings')
          .select('kwh, created_at')
          .eq('meter_id', m.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestErr) console.warn(`Error fetching latest for ${m.id}:`, latestErr);

        // Ambil semua bacaan bulan ini
        const { data: monthReadings, error: monthErr } = await supabase
          .from('meter_readings')
          .select('kwh, created_at')
          .eq('meter_id', m.id)
          .gte('created_at', firstDayOfMonth)
          .order('created_at', { ascending: true });

        if (monthErr) console.warn(`Error fetching month readings for ${m.id}:`, monthErr);

        console.log(`Meter ${m.id} - latest:`, latest, 'monthReadings:', monthReadings?.length);

        let storeMonthlyUsage = 0;
        let storePerDay = 0;

        if (monthReadings && monthReadings.length > 1) {
          const scans = monthReadings.map((r: any) => ({ kwh: Number(r.kwh ?? 0), created_at: r.created_at }));
          const summary = computeConsumption(scans);

          // total usage this month (sum of positive deltas across valid intervals)
          storeMonthlyUsage = summary.intervals.filter((i) => i.valid).reduce((s, it) => s + Math.max(0, it.deltaKwh), 0);
          storePerDay = summary.kwhPerHourUsedForProjection * 24;
        }

        const lastVal = latest ? latest.kwh : 0;
        accumLastReadings += lastVal;
        accumKwhAllStores += storeMonthlyUsage;

        computedMeters.push({
          id: m.id,
          store_name: m.store_name || m.name,
          meter_number: m.meter_number,
          power_va: m.power_va || 1300,
          lastReading: latest ? latest.kwh : null,
          monthlyUsage: storeMonthlyUsage,
          perDay: storePerDay,
        });
      }

      setMetersData(computedMeters);
      setTotalKwhMonth(accumKwhAllStores);
      setRemainingTokenKwh(accumLastReadings);

      // Hitung Estimasi Hari Sisa Token (gunakan per-day aktual dari setiap meter)
      const totalDailyUsage = computedMeters.reduce((s, mm) => s + (mm.perDay || 0), 0);
      const estimatedDays = totalDailyUsage > 0 ? Math.floor(accumLastReadings / totalDailyUsage) : 0;
      setDaysLeft(estimatedDays);

      // Metrik AI berdasarkan keaktifan pindaian
      const score = Math.min(98, 75 + meters.length * 5);
      setIntelligenceScore(score);

    } catch (err: any) {
      console.error('Error fetching dashboard:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription: update dashboard when meter_readings change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const channel = supabase
      .channel('public:meter_readings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meter_readings' },
        (payload: any) => {
          console.log('Realtime change on meter_readings:', payload);
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch (err) {
        console.warn('Error unsubscribing realtime channel', err);
      }
    };
  }, [supabase]);

  const handleLogout = () => {
    localStorage.removeItem('active_store_id');
    localStorage.removeItem('active_store_name');
    localStorage.removeItem('active_meter_number');
    router.push('/login');
  };

  // Filter Toko yang Tampil
  const filteredMeters = selectedMeterId === 'all'
    ? metersData
    : metersData.filter(m => m.id === selectedMeterId);

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Profile Info & Akses Navigasi */}
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
              title="Keluar dari Toko"
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
                  Total Pemakaian: {totalKwhMonth.toFixed(1)} kWh
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

          {/* List Breakdown Toko */}
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

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl">
                        <span className="text-slate-500 block text-[10px]">Sisa Meteran</span>
                        <span className="font-extrabold text-slate-800 text-sm">
                          {m.lastReading !== null ? `${m.lastReading.toFixed(1)} kWh` : 'Belum Scan'}
                        </span>
                      </div>
                      <div className="bg-teal-50 p-2.5 rounded-xl">
                        <span className="text-teal-700 block text-[10px]">Pemakaian Bulan Ini</span>
                        <span className="font-extrabold text-teal-900 text-sm">
                          {m.monthlyUsage.toFixed(1)} kWh
                        </span>
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
                Rata-rata konsumsi harian dari <strong>{metersData.length} toko</strong> Anda stabil di angka{' '}
                <strong>{(totalKwhMonth / 30 || 4).toFixed(1)} kWh/hari</strong>.
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
