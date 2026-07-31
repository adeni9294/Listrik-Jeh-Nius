'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bot, CheckCircle2, AlertCircle, ShoppingBag, Sparkles } from 'lucide-react';

export default function AIPage() {
  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI Health & Insight</h1>
          <p className="text-xs text-slate-500">Rekomendasi optimasi daya real-time</p>
        </div>
      </div>

      {/* System Health Status */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-emerald-900">Status Penggunaan: Efisien</h4>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Tidak terdeteksi adanya kebocoran arus atau anomali lonjakan listrik dalam 7 hari terakhir. Pemakaian Anda stabil di angka 4.2 kWh/hari.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Token Purchase Advisor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-slate-800">
            <Sparkles className="w-4 h-4 text-amber-500" /> Saran Pembelian Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Berdasarkan tren penggunaan harian, sisa token Anda diprediksi habis dalam <strong className="text-slate-900">9 hari lagi</strong>.
          </p>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="text-[11px] text-slate-500">Rekomendasi Isi Ulang:</div>
            <div className="text-lg font-extrabold text-teal-800">
              Rp 100.000 <span className="text-xs font-normal text-slate-500">(~68.5 kWh)</span>
            </div>
            <div className="text-[10px] text-slate-500">Cukup untuk memenuhi kebutuhan listrik hingga 25 hari ke depan.</div>
          </div>

          <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold gap-2">
            <ShoppingBag className="w-4 h-4" /> Beli Token Sekarang
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
