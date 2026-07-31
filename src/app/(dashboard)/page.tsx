'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Camera, TrendingDown, AlertTriangle, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [dataQuality, setDataQuality] = useState(85);
  const [intelligenceScore, setIntelligenceScore] = useState(88);
  const [daysLeft, setDaysLeft] = useState(9);
  const [remainingTokenKwh, setRemainingTokenKwh] = useState(38.4);

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Profile Info */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Halo, Budi 👋</h1>
          <p className="text-xs text-slate-500">Monitoring Mode: <span className="font-semibold text-teal-700">MEDIUM (2x/hari)</span></p>
        </div>
        <div className="px-3 py-1 bg-teal-100 text-teal-800 text-xs font-bold rounded-full">
          High Accuracy
        </div>
      </div>

      {/* Energy Intelligence Score Card */}
      <Card className="bg-gradient-to-br from-teal-700 to-teal-900 text-white shadow-xl border-none">
        <CardContent className="p-5">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs opacity-80 uppercase tracking-wider">Energy Intelligence Score</span>
              <div className="text-4xl font-extrabold mt-1">{intelligenceScore}<span className="text-lg font-normal">/100</span></div>
              <span className="inline-block mt-2 px-2.5 py-0.5 bg-emerald-500/30 text-emerald-200 text-xs rounded-md border border-emerald-400/30">
                Excellent Efficiency
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs opacity-80">Data Quality</span>
              <div className="text-lg font-bold text-teal-200">{dataQuality}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Remaining Quick Display */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-amber-600 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-semibold">Sisa Token</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{remainingTokenKwh} <span className="text-xs font-normal">kWh</span></div>
            <p className="text-[10px] text-slate-500 mt-1">~ Rp {(remainingTokenKwh * 1444.7).toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-teal-600 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-semibold">Estimasi Habis</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{daysLeft} <span className="text-xs font-normal">Hari Lagi</span></div>
            <p className="text-[10px] text-slate-500 mt-1">Perkiraan: 9 Agustus 2026</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insight Box */}
      <Card className="border-teal-200 bg-teal-50/50">
        <CardHeader className="p-4 pb-2 flex flex-row items-center space-x-2">
          <Cpu className="w-5 h-5 text-teal-700" />
          <CardTitle className="text-sm font-bold text-teal-900">AI Energy Insight</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs text-slate-700 space-y-2">
          <p>
            Pemakaian listrik malam Anda menyumbang **62%** dari konsumsi harian.
          </p>
          <div className="p-2 bg-white rounded border border-teal-100 text-[11px] text-teal-800">
            💡 **Rekomendasi:** Pembelian token ideal berikutnya adalah **Rp 200.000** untuk kebutuhan 32 hari ke depan.
          </div>
        </CardContent>
      </Card>

      {/* FAB Quick Action Scan */}
      <div className="pt-4">
        <Link href="/scan">
          <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-6 rounded-xl shadow-lg flex items-center justify-center space-x-2">
            <Camera className="w-5 h-5" />
            <span>Pindai Meter Listrik Sekarang</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
