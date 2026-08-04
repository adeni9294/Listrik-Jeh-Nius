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
  Calculator,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getTariffRate } from '@/lib/constants';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
  power_va: number;
}

export default function AiPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('active_store_id') || 'all' : 'all'
  );

  // Metrik Terintegrasi
  const [currentKwh, setCurrentKwh] = useState<number>(0);
  const [dailyKwh, setDailyKwh] = useState<number>(0);
  const [hourlyKwh, setHourlyKwh] = useState<number>(0);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [activeTariff, setActiveTariff] = useState<number>(1444.7);

  // Status AI Health
  const [healthStatus, setHealthStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  // Rekomendasi Token AI & Simulator
  const [recCost, setRecCost] = useState<number>(0);
  const [recKwh, setRecKwh] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<number>(500000);

  // Chat AI State
  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string }[]>([
    {
      sender: 'ai',
      text: 'Halo! Saya Asisten AI Listrik Jenius. Ada yang ingin Anda tanyakan terkait konsumsi listrik toko?',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');

  useEffect(() => {
    fetchAiInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchAiInsight = async () => {
    setLoading(true);
    try {
      let currentMeters = meters;
      if (currentMeters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number, power_va');
        if (metersData) {
          setMeters(metersData);
          currentMeters = metersData;
        }
      }

      let targetMeterId = selectedMeterId;
      if (selectedMeterId === 'all') {
        const { data: firstMeter } = await supabase.from('meters').select('id').limit(1).single();
        targetMeterId = firstMeter?.id || '';
      }

      if (!targetMeterId) {
        setLoading(false);
        return;
      }

      const activeMeterInfo = currentMeters.find((m) => m.id === targetMeterId);
      const activePowerVa = activeMeterInfo?.power_va || 1300;
      const currentTariffRate = getTariffRate(activePowerVa);
      setActiveTariff(currentTariffRate);

      const { data: readings } = await supabase
        .from('meter_readings')
        .select('kwh, meter_value, created_at')
        .eq('meter_id', targetMeterId)
        .order('created_at', { ascending: false })
        .limit(2);

      if (readings && readings.length > 0) {
        const latestReading = Number(readings[0].meter_value ?? readings[0].kwh ?? 0);
        setCurrentKwh(latestReading);

        if (readings.length >= 2) {
          const prevReading = Number(readings[1].meter_value ?? readings[1].kwh ?? 0);
          const t1 = new Date(readings[0].created_at).getTime();
          const t2 = new Date(readings[1].created_at).getTime();
          const diffHours = Math.max((t1 - t2) / (1000 * 60 * 60), 0.01);

          if (prevReading >= latestReading) {
            const consumed = prevReading - latestReading;
            const ratePerHour = diffHours >= 0.25 ? consumed / diffHours : consumed;
            const calculatedDaily = ratePerHour * 24;

            setHourlyKwh(ratePerHour);
            setDailyKwh(calculatedDaily);

            if (calculatedDaily > 0) {
              const daysLeft = latestReading / calculatedDaily;
              setDaysRemaining(Number(daysLeft.toFixed(1)));

              if (daysLeft < 2) {
                setHealthStatus('critical');
              } else if (ratePerHour > 15) {
                setHealthStatus('warning');
              } else {
                setHealthStatus('normal');
              }

              const neededKwhFor14Days = calculatedDaily * 14;
              const rawCost = neededKwhFor14Days * currentTariffRate;
              const roundedCost = Math.max(Math.ceil(rawCost / 100000) * 100000, 100000);
              const resultingKwh = roundedCost / currentTariffRate;

              setRecCost(roundedCost);
              setRecKwh(resultingKwh);
              setCustomAmount(roundedCost);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Gagal memproses AI insight:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  // Kalkulasi Simulator Custom Token
  const simulatedKwh = customAmount / (activeTariff || 1444.7);
  const simulatedDays = dailyKwh > 0 ? (simulatedKwh / dailyKwh).toFixed(1) : '0';

  const handleSendMessage = () => {
    if (!inputPrompt.trim()) return;

    const userText = inputPrompt;
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setInputPrompt('');

    setTimeout(() => {
      let response = `Berdasarkan laju konsumsi ${hourlyKwh.toFixed(2)} kWh/jam, toko Anda memerlukan rata-rata ${dailyKwh.toFixed(1)} kWh per hari.`;
      if (userText.toLowerCase().includes('hemat') || userText.toLowerCase().includes('boros')) {
        response = 'Penyebab utama penggunaan tinggi biasanya berasal dari AC dan Showcase. Menaikkan suhu AC ke 24°C dapat menghemat hingga 15% energi harian.';
      } else if (userText.toLowerCase().includes('token') || userText.toLowerCase().includes('beli')) {
        response = `Diperkirakan token Rp ${recCost.toLocaleString('id-ID')} cukup untuk menjaga operasional toko aman selama 14 hari.`;
      }
      setMessages((prev) => [...prev, { sender: 'ai', text: response }]);
    }, 800);
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-teal-600" /> AI Health & Insight
          </h1>
          <p className="text-xs text-slate-500">Rekomendasi optimasi daya real-time</p>
        </div>

        {meters.length > 0 && (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
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
          <span className="text-sm">Analisis AI sedang berjalan...</span>
        </div>
      ) : (
        <>
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
            <CardContent className="p-4 flex items-start gap-3">
              {healthStatus === 'critical' ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : healthStatus === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}

              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-800 text-sm block">
                  {healthStatus === 'critical'
                    ? 'Status Penggunaan: Kritis (Sisa Token Rendah)'
                    : healthStatus === 'warning'
                    ? 'Status Penggunaan: Tinggi / Anomali Deteksi'
                    : 'Status Penggunaan: Normal & Efisien'}
                </span>
                <p className="text-slate-600 leading-relaxed">
                  {healthStatus === 'critical'
                    ? `Sisa token sebesar ${currentKwh.toFixed(1)} kWh diprediksi akan habis dalam ${daysRemaining} hari. Segera lakukan pengisian token.`
                    : `Laju konsumsi terdeteksi ${hourlyKwh.toFixed(2)} kWh/jam (rata-rata ${dailyKwh.toFixed(1)} kWh/hari). Tidak terdeteksi adanya kebocoran arus mendadak.`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Simulator & Saran Pembelian Token AI */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between text-slate-800">
                <div className="flex items-center gap-2">
                  <BatteryCharging className="w-4 h-4 text-amber-500" />
                  Saran Pembelian Token AI
                </div>
                <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full">
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

              {/* Simulator Pilihan Nominal Token */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Pilih Nominal untuk Simulasi Daya Tahan:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[200000, 500000, 1000000].map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant={customAmount === amt ? 'default' : 'outline'}
                      className={`text-xs ${
                        customAmount === amt
                          ? 'bg-teal-700 hover:bg-teal-800 text-white font-bold'
                          : 'text-slate-700'
                      }`}
                      onClick={() => setCustomAmount(amt)}
                    >
                      Rp {(amt / 1000).toLocaleString('id-ID')}rb
                    </Button>
                  ))}
                </div>
              </div>

              {/* Display Proyeksi Dynamic */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 text-center space-y-1">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Proyeksi Token Rp {customAmount.toLocaleString('id-ID')}:
                </span>
                <div className="text-xl font-extrabold text-teal-900">
                  +{simulatedDays} Hari Operasional
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Mendapatkan ~{simulatedKwh.toFixed(1)} kWh dengan laju {dailyKwh.toFixed(1)} kWh/hari
                </div>
              </div>

              {/* Action Button */}
              <a
                href="https://www.tokopedia.com/pln/"
                target="_blank"
                rel="noreferrer"
                className="block w-full"
              >
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl shadow-sm">
                  <ShoppingBag className="w-4 h-4" /> Beli Token PLN Sekarang
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Fitur Chatbot Asisten AI Interaktif */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
                <Sparkles className="w-4 h-4 text-teal-600 fill-teal-100" />
                Tanya Asisten AI Listrik
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
              <div className="h-40 overflow-y-auto border border-slate-100 rounded-lg p-3 space-y-2 bg-slate-50/50 text-xs">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-teal-700 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tanya AI (contoh: 'Kenapa toko boros?')..."
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button
                  size="sm"
                  className="bg-teal-700 hover:bg-teal-800 text-white px-3"
                  onClick={handleSendMessage}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
