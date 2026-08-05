'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Calendar,
  Clock,
  Zap,
  Store,
  X,
  Eye,
  TrendingDown,
  LogOut,
  LogIn,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface TableReading {
  id: string;
  meter_id: string;
  store_name: string;
  meter_number: string;
  kwh_value: number;
  consumption?: number | null;
  image_url?: string;
  created_at: string;
}

export default function HistoryPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('staff');
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [readings, setReadings] = useState<TableReading[]>([]);
  const [metersMap, setMetersMap] = useState<
    Record<string, { store_name: string; meter_number: string }>
  >({});
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');

  // State untuk modal preview foto
  const [activePhoto, setActivePhoto] = useState<{
    url: string;
    title: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    const storeId = localStorage.getItem('active_store_id');

    // VALIDASI SESI LOGIN
    if (storeId && role) {
      setIsLoggedIn(true);
      setActiveStoreId(storeId);
      setUserRole(role);
      if (role !== 'admin') {
        setSelectedMeterId(storeId);
      }
      initHistory(role, storeId);
    } else {
      setIsLoggedIn(false);
      setActiveStoreId(null);
      setUserRole('staff');
      setReadings([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      initHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeterId]);

  const initHistory = async (roleParam?: string | null, activeStoreIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? localStorage.getItem('user_role');
      const currentActiveStore = activeStoreIdParam ?? localStorage.getItem('active_store_id');

      // GUARD KEAMANAN: Hentikan fetch jika tidak ada session login toko
      if (!currentActiveStore && currentRole !== 'admin') {
        setReadings([]);
        setLoading(false);
        return;
      }

      // 1. Ambil data Toko dengan filter RBAC
      let meterQuery = supabase
        .from('meters')
        .select('id, store_name, meter_number');

      if (currentRole !== 'admin' && currentActiveStore) {
        meterQuery = meterQuery.eq('id', currentActiveStore);
      }

      const { data: metersData } = await meterQuery;

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
      } else if (currentRole !== 'admin' && currentActiveStore) {
        query = query.eq('meter_id', currentActiveStore);
      }

      let { data: readingsData, error } = await query.order('created_at', {
        ascending: false,
      });

      // Fallback jika nama tabel di DB adalah 'readings'
      if (error || !readingsData) {
        let fallbackQuery = supabase.from('readings').select('*');
        if (selectedMeterId !== 'all') {
          fallbackQuery = fallbackQuery.eq('meter_id', selectedMeterId);
        } else if (currentRole !== 'admin' && currentActiveStore) {
          fallbackQuery = fallbackQuery.eq('meter_id', currentActiveStore);
        }
        const fallbackRes = await fallbackQuery.order('created_at', { ascending: false });
        readingsData = fallbackRes.data || [];
      }

      if (readingsData) {
        const formatted: TableReading[] = readingsData.map((item: any, index: number) => {
          const storeInfo = map[item.meter_id] || {
            store_name: 'Toko',
            meter_number: '-',
          };
          const currentKwh = Number(item.meter_value ?? item.kwh ?? item.value ?? 0);

          let consumption: number | null = null;
          const prevReading = readingsData.slice(index + 1).find((r: any) => r.meter_id === item.meter_id);
          if (prevReading) {
            const prevKwh = Number(prevReading.meter_value ?? prevReading.kwh ?? prevReading.value ?? 0);
            if (prevKwh >= currentKwh) {
              consumption = prevKwh - currentKwh;
            }
          }

          return {
            id: item.id,
            meter_id: item.meter_id,
            store_name: storeInfo.store_name,
            meter_number: storeInfo.meter_number,
            kwh_value: currentKwh,
            consumption,
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
      {/* Header & Control Actions */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Pembacaan</h1>
          <p className="text-xs text-slate-500">Log pindaian & bukti foto meteran</p>
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

          {isLoggedIn && meterOptions.length > 0 && userRole === 'admin' && (
            <select
              value={selectedMeterId}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-teal-500 outline-none h-8"
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
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12 text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Memuat tabel riwayat...</span>
        </div>
      ) : !isLoggedIn ? (
        /* TAMPILAN TERKUNCI JIKA LOGOUT */
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Riwayat Terkunci</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk melihat log riwayat pindaian dan bukti foto meteran.
              </p>
            </div>
            <Link href="/login" className="inline-block">
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-6 py-2">
                <LogIn className="w-4 h-4 mr-1.5" /> Masuk ke Toko
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        /* TAMPILAN TABEL TERSEDIA JIKA LOGGED IN */
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Waktu Scan</th>
                    <th className="py-2.5 px-3">Toko</th>
                    <th className="py-2.5 px-3 text-right">Sisa / Pemakaian</th>
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

                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800 flex items-center gap-1">
                            <Store className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="truncate max-w-[90px]">{row.store_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{row.meter_number}</div>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="font-extrabold text-slate-800 inline-flex items-center gap-0.5">
                            <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {row.kwh_value.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">kWh</span>
                          </div>

                          {row.consumption !== undefined && row.consumption !== null && (
                            <div className="text-[10px] font-semibold text-rose-600 flex items-center justify-end gap-0.5 mt-0.5">
                              <TrendingDown className="w-2.5 h-2.5" />
                              <span>-{row.consumption.toFixed(1)} kWh</span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {row.image_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActivePhoto({
                                  url: row.image_url!,
                                  title: row.store_name,
                                  date: `${formatDate(row.created_at)} ${formatTime(row.created_at)}`,
                                })
                              }
                              className="relative group inline-block focus:outline-none"
                            >
                              <img
                                src={row.image_url}
                                alt="Bukti"
                                className="w-8 h-8 object-cover rounded border border-slate-200 group-hover:opacity-80 transition mx-auto"
                              />
                              <div className="absolute inset-0 bg-black/30 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-3.5 h-3.5 text-white" />
                              </div>
                            </button>
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

      {/* MODAL LIGHTBOX PHOTO PREVIEW */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl space-y-3 p-4 relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{activePhoto.title}</h3>
                <p className="text-[11px] text-slate-400">{activePhoto.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="p-1 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-square flex items-center justify-center">
              <img
                src={activePhoto.url}
                alt="Bukti Foto Full"
                className="w-full h-full object-contain"
              />
            </div>

            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
