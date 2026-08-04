"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// Impor service database yang ada di proyek Anda
import { getStores } from "@/lib/dashboardService"; // Atau atur import dari lib/db/dexie-db atau supabase

interface StoreAnalysis {
  id: string;
  name: string;
  plnId: string;
  powerVa: number;
  remainingKwh: number;
  remainingRupiah: number;
  avgUsageKwhHour: number;
  daysRemaining: number;
}

export default function AnalysisPage() {
  const [stores, setStores] = useState<StoreAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStoreData() {
      try {
        setIsLoading(true);
        // Mengambil data toko asli dari Supabase / Dexie
        const data = await getStores(); 
        
        // Pemetaan data jika struktur dari database berbeda dengan tampilan
        const formattedData: StoreAnalysis[] = data.map((item: any) => {
          const avgUsage = item.avgUsageKwhHour || 1;
          const daysLeft = Math.floor(item.remainingKwh / (avgUsage * 24));
          
          return {
            id: item.id,
            name: item.name || item.toko_name,
            plnId: item.plnId || item.id_pelanggan,
            powerVa: item.powerVa || item.daya,
            remainingKwh: item.remainingKwh || item.sisa_kwh,
            remainingRupiah: item.remainingRupiah || (item.sisa_kwh * 1444.7), // Estimasi tarif PLN
            avgUsageKwhHour: avgUsage,
            daysRemaining: daysLeft > 0 ? daysLeft : 0,
          };
        });

        setStores(formattedData);
      } catch (error) {
        console.error("Gagal mengambil data toko:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoreData();
  }, []);

  // Sorting otomatis berdasarkan tingkat urgensi (hari tersisa)
  const sortedStores = [...stores].sort(
    (a, b) => a.daysRemaining - b.daysRemaining
  );

  const getStatusBadge = (days: number) => {
    if (days <= 2) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          🚨 Critical ({days} Hari)
        </span>
      );
    } else if (days <= 5) {
      return (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          ⚠️ Warning ({days} Hari)
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        ✅ Aman ({days} Hari)
      </span>
    );
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analisis Toko</h1>
          <p className="text-sm text-muted-foreground">
            Perbandingan penggunaan energi dan prioritas isi ulang token.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matriks Konsumsi Semua Toko</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Memuat data toko...
            </div>
          ) : sortedStores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada toko yang terdaftar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 rounded-l-md">Toko</th>
                    <th className="px-4 py-3">Daya</th>
                    <th className="px-4 py-3">Sisa Token</th>
                    <th className="px-4 py-3">Rata-Rata / Jam</th>
                    <th className="px-4 py-3">Status Risk</th>
                    <th className="px-4 py-3 rounded-r-md text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedStores.map((store) => (
                    <tr key={store.id} className="hover:bg-muted/50 transition">
                      <td className="px-4 py-3 font-medium">
                        <div>{store.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {store.plnId}
                        </div>
                      </td>
                      <td className="px-4 py-3">{store.powerVa} VA</td>
                      <td className="px-4 py-3 font-semibold">
                        {store.remainingKwh} kWh
                        <div className="text-xs font-normal text-muted-foreground">
                          ~ Rp {Math.round(store.remainingRupiah).toLocaleString("id-ID")}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {store.avgUsageKwhHour} kWh/jam
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(store.daysRemaining)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline">
                          Detail
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
