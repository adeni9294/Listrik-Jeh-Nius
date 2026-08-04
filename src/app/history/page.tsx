'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Calendar, Clock, RefreshCw, Zap, Store, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface ReadingHistory {
  id: string;
  meter_id: string;
  meter_value: number;
  image_url?: string;
  created_at: string;
  meters?: {
    store_name: string;
    meter_number: string;
  };
}

export default function HistoryPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<ReadingHistory[]>([]);
  const [meters, setMeters] = useState<{ id: string; store_name: string }[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');

  useEffect(() => {
    fetchHistoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      // 1. Load daftar toko untuk filter
      if (meters.length === 0) {
        const { data: metersData } = await supabase
          .from('meters')
          .select('id, store_name')
          .order('created_at', { ascending: false });

        if (metersData) setMeters(metersData);
      }

      // 2. Query data riwayat pembacaan + Join ke tabel meters
      let query = supabase
        .from('meter_readings')
        .select(`
          id,
          meter_id,
          kwh,
          meter_value,
          image_url,
          created_at,
          meters (
            store_name,
            meter_number
          )
        `);

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Normalisasi data (mengantisipasi kolom kwh atau meter_value)
        const formattedData: ReadingHistory[] = data.map((item: any) => ({
          id: item.id,
          meter_id: item.meter_id,
          meter_value: Number(item.meter_value ?? item.kwh ?? 0),
          image_url: item.image_url,
          created_at: item.created_at,
          meters: Array.isArray(item.meters) ? item.meters[0] : item.meters,
        }));

        setReadings(formattedData);
      }
    } catch (err: any) {
      console.error('Gagal memuat riwayat:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Pembacaan</h1>
          <p className="text-xs text-slate-500">Catatan foto & angka meteran toko Anda</p>
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
          <span className="text-sm">Memuat catatan riwayat...</span>
        </div>
      ) : readings.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-xs text-slate-500">Belum ada riwayat pembacaan meteran.</p>
            <Link href="/scan">
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs gap-1">
                <Camera className="w-4 h-4" /> Pindai Meteran Sekarang
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {readings.map((item) => (
            <Card key={item.id} className="border-slate-200 hover:border-teal-300 transition shadow-sm">
              <CardContent className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Preview Foto Upload jika ada */}
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt="Scan Meteran"
                      className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-800 font-bold text-xs">
                      <Store className="w-3.5 h-3.5 text-teal-600" />
                      <span>{item.meters?.store_name || 'Toko'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> {formatDate(item.created_at)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {formatTime(item.created_at)}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono">
                      ID Meter: {item.meters?.meter_number || '-'}
                    </div>
                  </div>
                </div>

                {/* Angka kWh Hasil Scan */}
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1 text-amber-600 font-bold text-sm">
                    <Zap className="w-3.5 h-3.5 fill-amber-500" />
                    <span>{item.meter_value.toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">kWh</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
