'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw } from 'lucide-react';
import { processAndCompressImage } from '@/lib/utils/image-compressor';
import { AIValidationEngine, ValidationResult } from '@/lib/ai/validation-engine';
import { createClient } from '@/lib/supabase/client';

export default function ScanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setValidationResult(null);

    try {
      // 1. Resize & Compress Gambar
      const compressedBlob = await processAndCompressImage(file);
      setImageBlob(compressedBlob);
      setPreviewUrl(URL.createObjectURL(compressedBlob));

      // 2. Ambil Bacaan Terakhir Asli dari Supabase
      let lastReadingValue = 0;
      const { data: lastReading } = await supabase
        .from('meter_readings')
        .select('kwh')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastReading) {
        lastReadingValue = lastReading.kwh;
      }

      // 3. Jalankan OCR menggunakan Gemini 2.5 Flash (via API Route) ⚡
      const formData = new FormData();
      formData.append('image', compressedBlob);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal melakukan OCR dengan Gemini');
      }

      const ocrData = await res.json();

      // 4. Jalankan AI Validation Engine Bawaan
      const validated = AIValidationEngine.validate(
        ocrData.rawText,
        ocrData.confidence,
        lastReadingValue
      );

      setValidationResult(validated);
    } catch (err: any) {
      console.error('Proses OCR Gagal:', err);
      alert(`Gagal membaca gambar: ${err.message || 'Silakan coba foto ulang.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 🚀 FUNGSI PENYIMPANAN KE SUPABASE
  const handleSave = async () => {
    if (!validationResult) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('meter_readings').insert([
        {
          kwh: validationResult.validatedValue,
          confidence: validationResult.confidence,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      alert('Berhasil menyimpan data meteran!');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Gagal menyimpan ke Supabase:', err);
      alert(`Gagal menyimpan data: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-800">Pindai Meter Listrik</h1>
      <p className="text-xs text-slate-500">Ambil foto layar angka meteran PLN Anda dengan jelas.</p>

      {/* Camera View / Preview Container */}
      <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-slate-300">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview Meter" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-6 text-slate-400 space-y-2">
            <Camera className="w-12 h-12 mx-auto stroke-1" />
            <p className="text-xs">Arahkan kamera ke layar kwh meteran</p>
          </div>
        )}

        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
            <span className="text-xs font-semibold">Gemini AI sedang membaca & memvalidasi angka...</span>
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
          />
          <div className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 px-4 rounded-xl text-center text-sm cursor-pointer shadow-md">
            {previewUrl ? 'Ambil Ulang Foto' : 'Buka Kamera'}
          </div>
        </label>
      </div>

      {/* OCR & AI Validation Result Preview */}
      {validationResult && (
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-xs font-semibold text-slate-500">Hasil Pembacaan Gemini AI</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-bold ${
                validationResult.confidence > 70
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              Confidence: {validationResult.confidence.toFixed(0)}%
            </span>
          </div>

          <div className="text-center py-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {validationResult.validatedValue.toFixed(1)}{' '}
              <span className="text-sm font-normal text-slate-500">kWh</span>
            </div>
          </div>

          {validationResult.correctionsMade.length > 0 && (
            <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
              <span className="font-semibold text-slate-700 block">Catatan Penyesuaian AI:</span>
              <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                {validationResult.correctionsMade.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tombol Simpan Terhubung */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              'Konfirmasi & Simpan'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
