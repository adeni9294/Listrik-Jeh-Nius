'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, Cpu, RefreshCw, Store, Camera } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fetchMeterReadingsClient, Reading } from '@/lib/meterReadingsClient';
import { computeConsumption } from '@/lib/consumption';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>(
    typeof window !== 'undefined' ? (localStorage.getItem('active_store_id') || 'all') : 'all'
  );
  const [historyData, setHistoryData] = useState<Reading[]>([]);
  const [anomalies, setAnomalies] = useState<Record<string, { valid: boolean; isRollover?: boolean; deltaKwh: number; deltaHours: number }>>({});

  useEffect(() => {
    fetchHistoryData();
  }, [selectedMeterId]);

  const fetchHistoryData = async () => {
    setLoading(true);
    try {
      const readings = await fetchMeterReadingsClient(selectedMeterId, 500); // latest first
      setHistoryData(readings);

      // derive meters list from readings if not present
      if (meters.length === 0) {
        const unique = Array.from(
          new Map(readings.map((r) => [r.meter_id, { id: r.meter_id, store_name: r.store_name ?? 'Toko', meter_number: '' }])).values()
        );
        setMeters(unique);
      }

      // Build anomaly map using computeConsumption (we need chronological scans oldest->newest)
      if (readings && readings.length > 1) {
        const scans = readings
          .map((r) => ({ id: r.id, kwh: Number(r.kwh ?? 0), created_at: r.created_at }))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const summary = computeConsumption(scans, { maxMeterValue: 99999 });
        const map: Record<string, { valid: boolean; isRollover?: boolean; deltaKwh: number; deltaHours: number }> = {};

        summary.intervals.forEach((it) => {
          const toId = (it.to as any).id;
          if (toId) {
            map[String(toId)] = {
              valid: it.valid,
              isRollover: it.isRollover === true,
              deltaKwh: it.deltaKwh,
              deltaHours: it.deltaHours,
            };
          }
        });

        setAnomalies(map);
      } else {
        setAnomalies({});
      }
    } catch (err: any) {
      console.error('Gagal mengambil data riwayat:', err.message || err);
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
          {historyData.map((item, index) => {
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

            const next = historyData[index + 1];
            const usage = next ? Math.max(0, next.kwh - item.kwh) : null; // array is DESC, so older (next) - newer (current)

            const meta = anomalies[item.id as string];

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
                        {item.store_name || 'Toko'}
                      </span>
                      {usage !== null && (
                        <span>
                          Pemakaian: <span className="font-semibold text-teal-700">-{usage.toFixed(1)} kWh</span>
                        </span>
                      )}

                      {/* Anomaly / Rollover badges */}
                      {meta && !meta.valid && (
                        <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-md border border-red-200">
                          Anomali ({meta.deltaKwh.toFixed(1)} kWh / {meta.deltaHours.toFixed(2)} jam)
                        </span>
                      )}
                      {meta && meta.isRollover && (
                        <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                          Rollover
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
                    <span className="text-[10px] text-slate-400 font-mono">{`Conf: ${
                      item.confidence_score ? Math.round(item.confidence_score * 100) : 90
                    }%`}</span>
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
