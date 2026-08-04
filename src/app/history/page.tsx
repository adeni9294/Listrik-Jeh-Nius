'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Calendar, Clock, Zap, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface TableReading {
  id: string;
  meter_id: string;
  store_name: string;
  meter_number: string;
  kwh_value: number;
  image_url?: string;
  created_at: string;
}

export default function HistoryPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<TableReading[]>([]);
  const [metersMap, setMetersMap] = useState<Record<string, { store_name: string; meter_number: string }>>({});
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');

  useEffect(() => {
    initHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const initHistory = async () => {
    setLoading(true);
    try {
      // 1. Ambil data Toko untuk Map ID -> Store Name (Menghindari Error JOIN Foreign Key)
      const { data: metersData } = await supabase
        .from('meters')
        .select('id, store_name, meter_number');

      const map: Record<string, { store_name: string; meter_number: string }> = {};
      if (metersData) {
        metersData.forEach((m) => {
          map[m.id] = {
            store_name: m.store_name || 'Toko',
            meter_number: m.meter_number || '-',
          };
        });
      }
      setMetersMap(map);

      // 2. Query data pembacaan meteran
      let query = supabase.from('meter_readings').select('*');

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      }

      let { data: readingsData, error } = await query.order('created_at', { ascending: false });

      // Fallback jika nama tabelnya di DB adalah 'readings'
      if (error || !readingsData) {
        const fallbackRes = await supabase.from('readings').select('*').order('created_at', { ascending: false });
        readingsData = fallbackRes.data || [];
      }

      if (readingsData) {
        const formatted: TableReading[] = readingsData.map((item: any) => {
          const storeInfo = map[item.meter_id] || { store_name: 'Toko', meter_number: '-' };
          return {
            id: item.id,
            meter_id: item.meter_id,
            store_name: storeInfo.store_name,
            meter_number: storeInfo.meter_number,
            kwh_value: Number(item.meter_value ?? item.kwh ?? item.value ?? 0),
            image_url: item.image_url || item.photo_url || null,
            created_at: item.created_at,
          };
        });

        setReadings(formatted);
      }
    } catch (err: any) {
      console.error('Gagal mengambil riwayat:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const meterOptions = Object.entries(metersMap).map(([id, info]) => ({
    id,
    store_name: info.store_name,
  }));

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header & Filter */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Pembacaan</h1>
          <p className="text-xs text-slate-500">Tabel log pindaian & bukti foto meteran</p>
        </div>

        {meterOptions.length > 0 && (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg p-2 font-semibold text-slate-800 focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Semua Toko ({meterOptions.length})</option>
            {meterOptions.map((m) => (
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
          <span className="text-sm">Memuat tabel riwayat...</span>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Waktu Scan</th>
                    <th className="py-2.5 px-3">Toko</th>
                    <th className="py-2.5 px-3 text-right">Sisa Meteran</th>
                    <th className="py-2.5 px-3 text-center">Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {readings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                        Belum ada data pindaian tersimpan di database.
                      </td>
                    </tr>
                  ) : (
                    readings.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        {/* Waktu Scan */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formatDate(row.created_at)}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime(row.created_at)}
                          </div>
                        </td>

                        {/* Nama Toko */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Store className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="truncate max-w-[100px]">{row.store_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{row.meter_number}</div>
                        </td>

                        {/* Sisa Meteran (kWh) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="font-extrabold text-slate-800 inline-flex items-center gap-0.5">
                            <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {row.kwh_value.toFixed(1)}
                          </div>
                          <span className="text-[10px] text-slate-400 block">kWh</span>
                        </td>

                        {/* Foto Thumbnail */}
                        <td className="py-2.5 px-3 text-center">
                          {row.image_url ? (
                            <a
                              href={row.image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block"
                            >
                              <img
                                src={row.image_url}
                                alt="Bukti"
                                className="w-8 h-8 object-cover rounded border border-slate-200 hover:scale-110 transition mx-auto"
                              />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
