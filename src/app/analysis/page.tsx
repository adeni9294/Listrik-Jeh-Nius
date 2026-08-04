"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Interfaces
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

// Dummy Data (Bisa diganti dengan data dari Supabase/Dexie DB)
const mockStores: StoreAnalysis[] = [
  {
    id: "1",
    name: "VB04",
    plnId: "14225887844",
    powerVa: 1300,
    remainingKwh: 1181.6,
    remainingRupiah: 1707058,
    avgUsageKwhHour: 22.38,
    daysRemaining: 2,
  },
  {
    id: "2",
    name: "Toko Cabang B",
    plnId: "32145698701",
    powerVa: 2200,
    remainingKwh: 450.0,
    remainingRupiah: 650000,
    avgUsageKwhHour: 12.50,
    daysRemaining: 10,
  },
  {
    id: "3",
    name: "Toko Gudang C",
    plnId: "98765432100",
    powerVa: 3500,
    remainingKwh: 85.0,
    remainingRupiah: 123000,
    avgUsageKwhHour: 30.50,
    daysRemaining: 1,
  },
];

export default function AnalysisPage() {
  const [stores] = useState<StoreAnalysis[]>(mockStores);

  // Sorting: Toko dengan hari tersisa paling sedikit ditaruh di paling atas
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

      {/* Tabel Perbandingan Agregat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matriks Konsumsi Semua Toko</CardTitle>
        </CardHeader>
        <CardContent>
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
                        ~ Rp {store.remainingRupiah.toLocaleString("id-ID")}
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
        </CardContent>
      </Card>
    </div>
  );
}
