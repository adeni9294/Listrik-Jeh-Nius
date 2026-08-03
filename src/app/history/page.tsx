'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, Cpu, RefreshCw, Store, Camera } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
}

interface ReadingHistoryItem {
  id: string;
  created_at: string;
  kwh: number;
  confidence: number | null;
  status: string | null;
  meter_id: string;
  store_name: string;
  dailyUsage: number | null;
}

export default function HistoryPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');
  const [historyData, setHistoryData] = useState<ReadingHistoryItem[]>([]);

  useEffect(() => {
    fetchHistoryData();
  }, [selectedMeterId]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      // 1. Ambil daftar toko jika belum di-load
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name, meter_number')
          .order('created_at', { ascending: false });

        if (metersData) {
          setMeters(metersData);
        }
      }

      // 2. Query data meter_readings dengan Join ke tabel meters
      let query = supabase
        .from('meter_readings')
        .select(`
          id,
          kwh,
          confidence_score,
          status,
          created_at,
          meter_id,
          meters (
            store_name
          )
        `)
        .order('created_at', { ascending: false });

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      }

      const { data: rawReadings, error } = await query;

      if (error) throw error;

      if (!rawReadings || rawReadings.length === 0) {
        setHistoryData([]);
        setLoading(false);
        return;
      }

      // 3. Format & Hitung Selisih Pemakaian Antar Scan
      const formattedItems: ReadingHistoryItem[] = rawReadings.map((item: any, index: number) => {
        let usage = null;

        // Bandingkan dengan bacaan sebelumnya jika ada (data diurutkan DESC)
        if (index < rawReadings.length - 1) {
          const previousKwh = rawReadings[index + 1].kwh;
          usage = Math.max(0, previousKwh - item.kwh); // Selisih sisa token/kWh
        }

        return {
          id: item.id,
          created_at: item.created_at,
          kwh: item.kwh,
          confidence: item.confidence_score ? Math.round(item.confidence_score * 100) : 90,
          status: item.status || 'VERIFIED',
          meter_id: item.meter_id,
          store_name: item.meters?.store_name || 'Toko',
          dailyUsage: usage,
        };
      });

      setHistoryData(formattedItems);
    } catch (err: any) {
      console.error('Gagal mengambil data riwayat:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header & Filter Dropdown */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Pembacaan</h1>
          <p className="text-xs text-slate-500">Catatan foto & angka kWh meteran toko Anda</p>
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
          <span className="text-sm">Memuat riwayat pembacaan...</span>
        </div>
      ) : historyData.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-xs text-slate-500">Belum ada riwayat pembacaan meteran.</p>
            <Link href="/scan">
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs">
                <Camera className="w-4 h-4 mr-1" /> Pindai Meteran Sekarang
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {historyData.map((item) => {
            const dateObj = new Date(item.created_at);
            const formattedDate = dateObj.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const formattedTime = dateObj.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <Card key={item.id} className="overflow-hidden border-slate-200 shadow-sm hover:border-teal-300 transition">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="space-y-1">
                    {/* Badge Nama Toko & Tanggal */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formattedDate}</span> • <span>{formattedTime}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-slate-900">
                        {item.kwh.toFixed(1)} <span className="text-xs font-normal text-slate-500">kWh</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 flex items-center gap-1">
                        <Store className="w-3 h-3 text-teal-600" />
                        {item.store_name}
                      </span>
                      {item.dailyUsage !== null && (
                        <span>
                          Pemakaian: <span className="font-semibold text-teal-700">-{item.dailyUsage.toFixed(1)} kWh</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {item.status === 'VERIFIED' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-200">
                        <Cpu className="w-3 h-3 text-amber-600" /> AI Adjusted
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      Conf: {item.confidence}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
