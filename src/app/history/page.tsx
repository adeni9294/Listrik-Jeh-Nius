'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Filter,
  History,
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

  // State Filters
  const [selectedMeterId, setSelectedMeterId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days'); // 'today' | '7days' | '30days' | 'all'

  // State modal preview foto
  const [activePhoto, setActivePhoto] = useState<{
    url: string;
    title: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    const storeId = localStorage.getItem('active_store_id');

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
  }, [selectedMeterId, dateFilter]);

  const initHistory = async (roleParam?: string | null, activeStoreIdParam?: string | null) => {
    setLoading(true);
    try {
      const currentRole = roleParam ?? localStorage.getItem('user_role');
      const currentActiveStore = activeStoreIdParam ?? localStorage.getItem('active_store_id');

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

      // 2. Query data pembacaan meteran dengan Filter Tanggal
      let query = supabase.from('meter_readings').select('*');

      if (selectedMeterId !== 'all') {
        query = query.eq('meter_id', selectedMeterId);
      } else if (currentRole !== 'admin' && currentActiveStore) {
        query = query.eq('meter_id', currentActiveStore);
      }

      const now = new Date();
      if (dateFilter === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', startOfToday);
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', sevenDaysAgo);
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', thirtyDaysAgo);
      }

      let { data: readingsData, error } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !readingsData) {
        let fallbackQuery = supabase.from('readings').select('*');
        if (selectedMeterId !== 'all') {
          fallbackQuery = fallbackQuery.eq('meter_id', selectedMeterId);
        } else if (currentRole !== 'admin' && currentActiveStore) {
          fallbackQuery = fallbackQuery.eq('meter_id', currentActiveStore);
        }

        if (dateFilter === 'today') {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          fallbackQuery = fallbackQuery.gte('created_at', startOfToday);
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          fallbackQuery = fallbackQuery.gte('created_at', sevenDaysAgo);
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          fallbackQuery = fallbackQuery.gte('created_at', thirtyDaysAgo);
        }

        const fallbackRes = await fallbackQuery
          .order('created_at', { ascending: false })
          .limit(100);
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Header & Control Actions */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-teal-600" /> Riwayat Pembacaan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">Log pindaian & bukti foto meteran PLN</p>
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
        </div>
      </div>

      {/* Controls Bar Filter */}
      {isLoggedIn && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Filter className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Filter Periode:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 h-9 shadow-xs"
            >
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
              <option value="all">Semua Tanggal</option>
            </select>
          </div>

          {userRole === 'admin' && meterOptions.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <Store className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Filter Toko:</span>
              <select
                value={selectedMeterId}
                onChange={(e) => setSelectedMeterId(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 h-9 shadow-xs"
              >
                <option value="all">Semua Toko ({meterOptions.length})</option>
                {meterOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.store_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20 text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-base font-medium">Memuat tabel riwayat...</span>
        </div>
      ) : !isLoggedIn ? (
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Riwayat Terkunci</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk melihat log riwayat pindaian dan bukti foto meteran.
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
        /* TABEL RIWAYAT UNTUK DESKTOP & MOBILE */
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="p-4 bg-slate-50 border-b border-slate-200">
            <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between items-center">
              <span>Log Pindaian Listrik</span>
              <span className="text-[11px] text-teal-700 font-normal font-mono">Total {readings.length} Rekaman</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Waktu Scan</th>
                    <th className="py-3 px-4">Toko / ID PLN</th>
                    <th className="py-3 px-4 text-right">Sisa Meteran</th>
                    <th className="py-3 px-4 text-right">Pemakaian</th>
                    <th className="py-3 px-4 text-center">Bukti Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {readings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                        Belum ada data pindaian pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    readings.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatDate(row.created_at)}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Clock className="w-3 h-3" />
                            {formatTime(row.created_at)} WIB
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{row.store_name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            PLN ID: {row.meter_number}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="font-extrabold text-slate-900 text-sm sm:text-base inline-flex items-center gap-1">
                            <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                            {row.kwh_value.toFixed(1)} <span className="text-xs text-slate-400 font-normal">kWh</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {row.consumption !== undefined && row.consumption !== null ? (
                            <div className="text-xs sm:text-sm font-bold text-rose-600 inline-flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-lg">
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span>-{row.consumption.toFixed(1)} kWh</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300 italic">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {row.image_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActivePhoto({
                                  url: row.image_url!,
                                  title: row.store_name,
                                  date: `${formatDate(row.created_at)} ${formatTime(row.created_at)} WIB`,
                                })
                              }
                              className="relative group inline-block focus:outline-none"
                            >
                              <img
                                src={row.image_url}
                                alt="Bukti Foto"
                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition mx-auto shadow-xs"
                              />
                              <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 italic">-</span>
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

      {/* MODAL LIGHTBOX PREVIEW FOTO */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-4 p-5 relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{activePhoto.title}</h3>
                <p className="text-xs text-slate-400">{activePhoto.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition"
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
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
