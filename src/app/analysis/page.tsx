'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, Zap, DollarSign, Tv } from 'lucide-react';

export default function AnalysisPage() {
  const deviceEstimates = [
    { name: 'AC (1/2 PK)', usageKwh: 1.8, cost: 2600, percent: 43 },
    { name: 'Kulkas 2 Pintu', usageKwh: 1.2, cost: 1730, percent: 28 },
    { name: 'Pompa Air & TV', usageKwh: 0.7, cost: 1010, percent: 17 },
    { name: 'Lampu & Lainnya', usageKwh: 0.5, cost: 720, percent: 12 },
  ];

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Analisis Pemakaian</h1>
        <p className="text-xs text-slate-500">Breakdown konsumsi listrik harian Anda</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-teal-900 text-white border-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-teal-200 text-xs font-medium">
              <Zap className="w-4 h-4" /> Rata-rata Harian
            </div>
            <div className="text-2xl font-black">4.2 <span className="text-xs font-normal opacity-80">kWh</span></div>
            <p className="text-[10px] text-teal-200/80">~Rp 6.060 / hari</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-none">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 text-xs font-medium">
              <DollarSign className="w-4 h-4 text-emerald-400" /> Estimasi Bulanan
            </div>
            <div className="text-2xl font-black text-emerald-400">126 <span className="text-xs font-normal text-white opacity-80">kWh</span></div>
            <p className="text-[10px] text-slate-400">~Rp 182.000 / bulan</p>
          </CardContent>
        </Card>
      </div>

      {/* Smart Device Estimator Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Tv className="w-4 h-4 text-teal-700" /> Estimasi Beban Alat Elektronik
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {deviceEstimates.map((device, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>{device.name}</span>
                <span className="text-slate-900">{device.usageKwh} kWh/hari ({device.percent}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-full rounded-full"
                  style={{ width: `${device.percent}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
