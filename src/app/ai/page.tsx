'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShoppingBag,
  ExternalLink,
  BatteryCharging,
  Sparkles,
  Send,
  LogOut,
  LogIn,
  Lock,
  Clock,
  Activity,
  Calendar,
  Globe,
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

export default function AiPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');
  const [userRole, setUserRole] = useState<string>('staff');
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const [currentKwh, setCurrentKwh] = useState<number>(0);
  const [dailyKwh, setDailyKwh] = useState<number>(0);
  const [hourlyKwh, setHourlyKwh] = useState<number>(0);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [activeTariff, setActiveTariff] = useState<number>(1444.7);
  const [activePowerVa, setActivePowerVa] = useState<number>(1300);
  const [todaySessions, setTodaySessions] = useState<TodayScanSession[]>([]);

  const [healthStatus, setHealthStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  // Input Manual Token
  const [customAmount, setCustomAmount] = useState<number>(200000);

  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string }[]>([
    {
      sender: 'ai',
      text: 'Halo! Saya Asisten AI Kelistrikan Toko & Energi Global. Anda dapat bertanya tentang analisis daya toko ini maupun pengetahuan efisiensi energi global!',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    const storedStoreId = localStorage.getItem('active_store_id');
    const storedRole = localStorage.getItem('user_role');

    if (storedStoreId && storedRole) {
      setIsLoggedIn(true);
      setActiveStoreId(storedStoreId);
      setUserRole(storedRole);
      if (storedRole !== 'admin') {
        setSelectedMeterId(storedStoreId);
      }
      fetchAiInsight(storedRole, storedStoreId);
    } else {
      setIsLoggedIn(false);
      setActiveStoreId(null);
      setUserRole('staff');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchAiInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAiInsight = async (roleParam?: string | null, activeStoreIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? (localStorage.getItem('user_role') || 'staff');
      const currentStoreId = activeStoreIdParam ?? localStorage.getItem('active_store_id');

      if (!currentStoreId && currentRole !== 'admin') {
        setLoading(false);
        return;
      }

      let currentMeters = meters;
      if (currentMeters.length === 0) {
        let query = supabase.from('meters').select('id, store_name, meter_number, power_va');

        if (currentRole !== 'admin' && currentStoreId) {
          query = query.eq('id', currentStoreId);
        }

        const { data: metersData } = await query;
        if (metersData && metersData.length > 0) {
          setMeters(metersData);
          currentMeters = metersData;
        }
      }

      let targetMeterId = selectedMeterId;
      if (selectedMeterId === 'all') {
        if (currentRole !== 'admin' && currentStoreId) {
          targetMeterId = currentStoreId;
        } else if (currentMeters.length > 0) {
          targetMeterId = currentMeters[0].id;
        } else {
          const { data: firstMeter } = await supabase.from('meters').select('id').limit(1).single();
          targetMeterId = firstMeter?.id || '';
        }
      }

      if (!targetMeterId) {
        setLoading(false);
        return;
      }

      const activeMeterInfo = currentMeters.find((m) => m.id === targetMeterId);
      const powerVa = activeMeterInfo?.power_va || 1300;
      setActivePowerVa(powerVa);

      const currentTariffRate = getTariffRate(powerVa);
      setActiveTariff(currentTariffRate);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // AMBIL READINGS HARI INI
      const { data: todayReadings } = await supabase
        .from('meter_readings')
        .select('id, kwh, meter_value, created_at')
        .eq('meter_id', targetMeterId)
        .gte('created_at', startOfToday.toISOString())
        .order('created_at', { ascending: true });

      // AMBIL READINGS TERBARU SECARA UMUM
      const { data: readings } = await supabase
        .from('meter_readings')
        .select('kwh, meter_value, created_at')
        .eq('meter_id', targetMeterId)
        .order('created_at', { ascending: false })
        .limit(10);

      let latestReading = 0;
      if (readings && readings.length > 0) {
        latestReading = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
        setCurrentKwh(latestReading);
      }

      const formattedSessions: TodayScanSession[] = [];
      let actualDailyKwh = 0;
      let accumulatedHourlyRate = 0;

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

          formattedSessions.push({
            id: r.id,
            time: timeStr,
            kwh: val,
            consumptionFromPrev: consumed,
            sessionName: `Pindaian #${idx + 1}`,
          });
        });

        // KALKULASI PERSIS SEPERTI DASHBOARD & ANALISIS
        if (todayReadings.length >= 2) {
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
      }

      // KALKULASI FALLBACK JIKA DATA HARI INI KURANG
      let fallbackHourlyRate = 0;
      if (accumulatedHourlyRate === 0 && readings && readings.length >= 2) {
        const val1 = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
        const val2 = Number(readings[1].meter_value ?? readings[1].kwh ?? 0);
        const t1 = new Date(readings[0].created_at).getTime();
        const t2 = new Date(readings[1].created_at).getTime();
        const diffHours = (t1 - t2) / (1000 * 60 * 60);

        if (val2 >= val1 && diffHours > 0) {
          fallbackHourlyRate = (val2 - val1) / diffHours;
        }
      }

      const finalHourlyRate = accumulatedHourlyRate > 0 ? accumulatedHourlyRate : fallbackHourlyRate;
      const dailyProj = finalHourlyRate > 0 ? finalHourlyRate * 24 : actualDailyKwh;

      setHourlyKwh(finalHourlyRate);
      setDailyKwh(dailyProj);
      setTodaySessions(formattedSessions);

      if (dailyProj > 0) {
        const daysLeft = latestReading / dailyProj;
        setDaysRemaining(Number(daysLeft.toFixed(1)));

        if (daysLeft < 2) {
          setHealthStatus('critical');
        } else if (finalHourlyRate > 15) {
          setHealthStatus('warning');
        } else {
          setHealthStatus('normal');
        }
      } else {
        setDaysRemaining(0);
        setHealthStatus('normal');
      }

    } catch (err: any) {
      console.error('Gagal memproses AI insight:', err?.message || err);
    } finally {
      setLoading(false);
    }
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

  // Perhitungan Simulasi Token Fleksibel
  const simulatedKwh = customAmount > 0 && activeTariff > 0 ? customAmount / activeTariff : 0;
  const addedDays = dailyKwh > 0 ? simulatedKwh / dailyKwh : 0;
  
  // Tanggal Proyeksi
  const totalDaysLeft = daysRemaining + addedDays;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + Math.round(totalDaysLeft));
  const formattedExpiryDate = expiryDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isAiThinking) return;

    const userText = inputPrompt;
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setInputPrompt('');
    setIsAiThinking(true);

    const activeStoreObj = meters.find((m) => m.id === selectedMeterId) || meters[0];
    const activeStoreName = activeStoreObj?.store_name || 'Toko Ini';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          storeContext: {
            storeName: activeStoreName,
            powerVa: activePowerVa,
            tariffRate: activeTariff,
            currentKwh,
            dailyKwh,
            hourlyKwh,
            daysRemaining,
            todaySessions,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { sender: 'ai', text: data.reply }]);
        setIsAiThinking(false);
        return;
      }
    } catch (e) {
      console.warn('API Chatbot offline, menggunakan mode AI fallback cerdas:', e);
    }

    // Fallback Lokal Cerdas jika API Offline / Belum Dikonfigurasi
    setTimeout(() => {
      const q = userText.toLowerCase();
      let response = '';

      const maxSafeWatts = Math.round(activePowerVa * 0.8);

      const wattMatch = q.match(/(\d+)\s*(watt|w\b)/);
      const hourMatch = q.match(/(\d+)\s*(jam|hours|h\b)/);
      const qtyMatch = q.match(/(\d+)\s*(biji|buah|unit|pcs)/);

      const detectedWatt = wattMatch ? parseInt(wattMatch[1]) : null;
      const detectedHours = hourMatch ? parseInt(hourMatch[1]) : 24;
      const detectedQty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      // 1. DETEKSI PERTANYAAN PILIHAN HARGA / TARIF / TOKEN PER KWH
      if (q.includes('harga') || q.includes('tarif') || q.includes('kwh') || q.includes('berapa')) {
        response = `⚡ **Informasi Tarif Listrik PLN (${activeStoreName}):**\n\n` +
          `• **Daya Terpasang:** ${activePowerVa} VA\n` +
          `• **Tariff Rate PLN:** ~Rp ${Math.round(activeTariff).toLocaleString('id-ID')} / kWh\n\n` +
          `💡 *Setiap pembelian token sebesar Rp 100.000 akan mendapatkan sekitar **${(100000 / activeTariff).toFixed(1)} kWh**.*`;
      }
      // 2. DETEKSI PERTANYAAN SISA TOKEN / ESTIMASI HABIS
      else if (q.includes('sisa') || q.includes('habis') || q.includes('saran') || q.includes('token')) {
        response = `🔋 **Status Sisa Token (${activeStoreName}):**\n\n` +
          `• **Sisa Token:** ${currentKwh.toFixed(1)} kWh\n` +
          `• **Laju Konsumsi:** ${hourlyKwh.toFixed(2)} kWh/jam (${dailyKwh.toFixed(1)} kWh/hari)\n` +
          `• **Estimasi Bertahan:** ~**${daysRemaining} Hari** lagi\n\n` +
          `📅 Diprediksi akan habis pada tanggal **${formattedExpiryDate}**.`;
      }
      // 3. DETEKSI PERTANYAAN PINDAIAN / HASIL LOG HARI INI
      else if (q.includes('pindaian') || q.includes('scan') || q.includes('hari ini') || q.includes('log')) {
        response = `📊 **Log Pindaian Hari Ini (${activeStoreName}):**\n\n` +
          `• **Total Pindaian:** ${todaySessions.length}x Sukses\n` +
          `• **Laju Rata-Rata:** ${hourlyKwh.toFixed(2)} kWh/jam\n` +
          (todaySessions.length > 0 
            ? `• **Pindaian Terakhir:** ${todaySessions[todaySessions.length - 1].kwh.toFixed(1)} kWh (Jam ${todaySessions[todaySessions.length - 1].time} WIB)`
            : `• *Belum ada data pindaian tersimpan hari ini.*`);
      }
      // 4. DETEKSI KALKULASI WATT ELEKTRONIK
      else if (detectedWatt) {
        const totalWatt = detectedWatt * detectedQty;
        const dailyKwhCalc = (totalWatt * detectedHours) / 1000;
        const monthlyKwhCalc = dailyKwhCalc * 30;
        const dailyCost = dailyKwhCalc * activeTariff;
        const monthlyCost = monthlyKwhCalc * activeTariff;

        response = `⚡ **Analisis Kelistrikan Peralatan (${activeStoreName}):**\n\n` +
          `• **Total Beban:** ${detectedQty}x ${detectedWatt} W = **${totalWatt} Watt**\n` +
          `• **Konsumsi Alat:** ${dailyKwhCalc.toFixed(2)} kWh/hari (~Rp ${Math.round(dailyCost).toLocaleString('id-ID')}/hari)\n` +
          `• **Proyeksi Bulanan:** ${monthlyKwhCalc.toFixed(1)} kWh (~Rp ${Math.round(monthlyCost).toLocaleString('id-ID')}/bulan)\n\n` +
          `🔌 **Evaluasi Kapasitas PLN (${activePowerVa} VA):**\n` +
          `Batas aman penggunaan serentak toko Anda adalah **~${maxSafeWatts} Watt**.\n` +
          (totalWatt > maxSafeWatts 
            ? `⚠️ **Peringatan Overload:** Beban alat (${totalWatt} W) melampaui batas aman MCB (${maxSafeWatts} W).` 
            : `✅ **Aman:** Beban di bawah kapasitas maksimal MCB.`);
      } 
      // 5. RESPONS CHAT UMUM
      else {
        response = `Saya adalah Asisten AI Kelistrikan Toko (${activeStoreName} - ${activePowerVa} VA).\n\n` +
          `Saya dapat memberikan informasi seputar:\n` +
          `1. **Harga & Tarif PLN:** Ketik *"harga token per kwh"*.\n` +
          `2. **Sisa & Estimasi Token:** Ketik *"sisa token hari ini"*.\n` +
          `3. **Analisis Daya Alat:** Ketik *"AC 1 PK 800 Watt dinyalakan 12 jam"*.\n` +
          `4. **Tips Hemat Energi:** Pencegahan lonjakan & efisiensi operasional.`;
      }

      setMessages((prev) => [...prev, { sender: 'ai', text: response }]);
      setIsAiThinking(false);
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header Info & Actions */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-teal-600" /> AI Health & Intelligent Consult
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">Rekomendasi optimasi daya & konsultasi energi global</p>
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

          {isLoggedIn && meters.length > 0 && userRole === 'admin' && (
            <select
              value={selectedMeterId}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500 outline-none shadow-sm h-9"
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
          <span className="text-base font-medium">Analisis AI sedang berjalan...</span>
        </div>
      ) : !isLoggedIn ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Fitur AI Terkunci</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk berkonsultasi dengan Asisten AI dan melihat analisis daya.
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* KOLOM KIRI (SIMULATOR & HEALTH) */}
          <div className="space-y-6">
            
            {/* Status Kesehatan Energi AI */}
            <Card
              className={`border-l-4 shadow-sm ${
                healthStatus === 'critical'
                  ? 'border-l-rose-500 bg-rose-50/40'
                  : healthStatus === 'warning'
                  ? 'border-l-amber-500 bg-amber-50/40'
                  : 'border-l-emerald-500 bg-emerald-50/40'
              }`}
            >
              <CardContent className="p-5 flex items-start gap-3">
                {healthStatus === 'critical' ? (
                  <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                ) : healthStatus === 'warning' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1 text-xs sm:text-sm">
                  <span className="font-bold text-slate-800 text-base block">
                    {healthStatus === 'critical'
                      ? 'Status Penggunaan: Kritis (Sisa Token Rendah)'
                      : healthStatus === 'warning'
                      ? 'Status Penggunaan: Tinggi / Anomali Deteksi'
                      : 'Status Penggunaan: Normal & Efisien'}
                  </span>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {healthStatus === 'critical'
                      ? `Sisa token sebesar ${currentKwh.toFixed(1)} kWh diprediksi akan habis dalam ${daysRemaining} hari. Segera lakukan pengisian token.`
                      : `Laju konsumsi terdeteksi ${hourlyKwh.toFixed(2)} kWh/jam (rata-rata ${dailyKwh.toFixed(1)} kWh/hari). Tidak terdeteksi adanya kebocoran arus mendadak.`}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* LOG PINDAIAN HARI INI */}
            <Card className="border-teal-200 bg-teal-50/30 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-teal-600" /> Log Pindaian Hari Ini
                  </span>
                  <span className="text-[11px] text-teal-700 font-normal">
                    {todaySessions.length}x Pindaian Sukses
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2.5">
                {todaySessions.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada pindaian tersimpan hari ini.</p>
                ) : (
                  todaySessions.map((s) => (
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

            {/* Simulator & Saran Pembelian Token AI - DENGAN INPUT MANUAL & QUICK CHIPS */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <BatteryCharging className="w-5 h-5 text-amber-500" />
                    Saran Pembelian Token AI
                  </div>
                  <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full">
                    Interactive
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Berdasarkan tren harian, sisa token saat ini (<strong>{currentKwh.toFixed(1)} kWh</strong>) diprediksi habis dalam{' '}
                  <strong className={daysRemaining < 3 ? 'text-rose-600 font-extrabold' : 'text-teal-700'}>
                    {daysRemaining} hari
                  </strong>{' '}
                  lagi.
                </p>

                {/* Input Manual Nominal Token */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    Masukkan Nominal Pembelian (Rp):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      step="10000"
                      min="10000"
                      value={customAmount || ''}
                      onChange={(e) => setCustomAmount(Number(e.target.value))}
                      placeholder="Ketik nominal bebas..."
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800"
                    />
                  </div>
                </div>

                {/* Quick Select Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[50000, 100000, 200000, 500000, 1000000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomAmount(amt)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${
                        customAmount === amt
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      +{amt / 1000}rb
                    </button>
                  ))}
                </div>

                {/* Display Proyeksi Dynamic & Tanggal Habis */}
                <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 text-center space-y-1">
                  <span className="text-xs font-semibold text-slate-600 block">
                    Proyeksi Pembelian Rp {customAmount.toLocaleString('id-ID')}:
                  </span>
                  <div className="text-2xl font-black text-teal-900">
                    +{addedDays.toFixed(1)} Hari Operasional
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Mendapatkan ~{simulatedKwh.toFixed(1)} kWh (Laju: {dailyKwh.toFixed(1)} kWh/hari)
                  </p>
                  
                  <div className="pt-2 border-t border-teal-200/60 flex items-center justify-center gap-1.5 text-xs text-teal-900 font-medium mt-2">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>Prediksi Token Habis: <strong>{formattedExpiryDate}</strong></span>
                  </div>
                </div>

                {/* Action Button */}
                <a
                  href="https://www.tokopedia.com/pln/"
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full"
                >
                  <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-3 flex items-center justify-center gap-2 rounded-xl shadow-sm">
                    <ShoppingBag className="w-4 h-4" /> Beli Token PLN Sekarang
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>

          {/* KOLOM KANAN (CHATBOT ASISTEN AI FULL HEIGHT DESKTOP) */}
          <div>
            <Card className="border-slate-200 shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-600 fill-teal-100" />
                    Tanya Asisten AI Kelistrikan Toko
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                    <Globe className="w-3 h-3 text-teal-600" /> Global Knowledge Enabled
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 flex-1 flex flex-col justify-between">
                <div className="h-96 lg:h-[450px] overflow-y-auto border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/50 text-xs">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.sender === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-teal-700 text-white rounded-br-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs whitespace-pre-line'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isAiThinking && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 text-slate-500 p-3 rounded-2xl rounded-bl-none text-xs italic flex items-center gap-2 shadow-xs">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                        <span>Asisten AI sedang berpikir...</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Tanya AI (contoh: 'AC 1 PK berapa watt?' atau 'Harga token per kwh nya berapa')..."
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  />
                  <Button
                    size="sm"
                    className="bg-teal-700 hover:bg-teal-800 text-white px-5 rounded-xl h-auto"
                    onClick={handleSendMessage}
                    disabled={isAiThinking}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
