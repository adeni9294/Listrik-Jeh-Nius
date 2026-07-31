'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

export default function HistoryPage() {
  // Mock data histori
  const historyData = [
    {
      id: '1',
      date: '31 Jul 2026',
      time: '08:00 AM',
      value: 38.4,
      dailyUsage: 4.2,
      confidence: 94,
      status: 'VERIFIED',
    },
    {
      id: '2',
      date: '30 Jul 2026',
      time: '08:15 AM',
      value: 42.6,
      dailyUsage: 4.5,
      confidence: 88,
      status: 'VERIFIED',
    },
    {
      id: '3',
      date: '29 Jul 2026',
      time: '07:50 AM',
      value: 47.1,
      dailyUsage: 5.1,
      confidence: 65,
      status: 'CORRECTED_BY_AI',
    },
  ];

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Riwayat Pembacaan</h1>
          <p className="text-xs text-slate-500">Catatan foto & angka kwh meteran Anda</p>
        </div>
      </div>

      <div className="space-y-3">
        {historyData.map((item) => (
          <Card key={item.id} className="overflow-hidden border-slate-100 shadow-sm">
            <CardContent className="p-4 flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{item.date}</span> • <span>{item.time}</span>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {item.value} <span className="text-xs font-normal text-slate-500">kWh</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Pemakaian harian: <span className="font-semibold text-teal-700">-{item.dailyUsage} kWh</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
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
        ))}
      </div>
    </div>
  );
}
