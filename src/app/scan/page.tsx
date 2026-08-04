'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Edit3, Check, Store } from 'lucide-react';
import { processAndCompressImage } from '@/lib/utils/image-compressor';
import { AIValidationEngine, ValidationResult } from '@/lib/ai/validation-engine';
import { createClient } from '@/lib/supabase';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
}

export default function ScanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // State untuk Toko / Meteran
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [isLoadingMeters, setIsLoadingMeters] = useState<boolean>(true);

  // State untuk Edit Manual
  const [isEditing, setIsEditing] = useState(false);
  const [manualValue, setManualValue] = useState<string>('');

  // 1. Ambil Daftar Toko Milik User Saat Halaman Dimuat
  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const { data, error } = await supabase
          .from('meters')
          .select('id, store_name, meter_number')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setMeters(data);
          setSelectedMeterId(data[0].id); // Set toko pertama sebagai default
        }
      } catch (err: any) {
        console.error('Gagal mengambil data toko:', err.message);
      } finally {
        setIsLoadingMeters(false);
      }
    };

    fetchMeters();
  }, [supabase]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setValidationResult(null);
    setIsEditing(false);

    try {
      // 1. Resize & Compress Gambar
      const compressedBlob = await processAndCompressImage(file);
      setPreviewUrl(URL.createObjectURL(compressedBlob));

      // 2. Ambil Bacaan Terakhir Asli dari Toko yang Dipilih
      let lastReadingValue = 0;
      if (selectedMeterId) {
        const { data: lastReading } = await supabase
          .from('meter_readings')
          .select('kwh')
          .eq('meter_id', selectedMeterId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastReading) {
          lastReadingValue = lastReading.kwh;
        }
      }

      // 3. Jalankan OCR via Gemini API Route
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

      // 4. Jalankan AI Validation Engine
      const validated = AIValidationEngine.validate(
        ocrData.rawText,
        ocrData.confidence,
        lastReadingValue
      );

      setValidationResult(validated);
      setManualValue(validated.validatedValue.toString());
    } catch (err: any) {
      console.error('Proses OCR Gagal:', err);
      alert(`Gagal membaca gambar: ${err.message || 'Silakan coba foto ulang.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Simpan Data ke Supabase
  const handleSave = async () => {
    if (!validationResult) return;

    if (!selectedMeterId && meters.length > 0) {
      alert('Pilih toko terlebih dahulu!');
      return;
    }

    const finalKwh = parseFloat(manualValue);
    if (isNaN(finalKwh) || finalKwh <= 0) {
      alert('Masukkan angka kWh yang valid.');
      return;
    }

    setIsSaving(true);
    try {
      // Coba ambil user Supabase (jika ada)
      let userId: string | undefined = undefined;
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) console.warn('getUser error', userErr);
        userId = userData?.user?.id;
      } catch (e) {
        console.warn('Supabase getUser failed:', e);
      }

      // Jika tidak ada session Supabase, fallback ke login lokal (LocalStorage)
      const activeStoreId = typeof window !== 'undefined' ? localStorage.getItem('active_store_id') : null;

      if (!userId && !activeStoreId) {
        // Tidak ada autentikasi sama sekali
        alert('Silakan masuk dahulu agar data tersimpan dan dapat tampil di dashboard.');
        router.push('/login');
        return;
      }

      const payload: Record<string, any> = {
        kwh: finalKwh,
        meter_value: finalKwh,
        confidence: isEditing ? 100 : validationResult.confidence,
        reading_date: new Date().toISOString().split('T')[0],
        reading_time: new Date().toTimeString().split(' ')[0],
        created_at: new Date().toISOString(),
        meter_id: selectedMeterId || activeStoreId,
      };

      if (userId) payload.user_id = userId;

      // Insert dan kembalikan row yang baru disimpan
      const { data: insertedRow, error: insertError } = await supabase
        .from('meter_readings')
        .insert([payload])
        .select()
        .single();

      console.log('Inserted meter_reading:', { payload, insertedRow, insertError });

      if (insertError) throw insertError;

      // Tampilkan ringkasan singkat ke user
      alert(`Tersimpan: ${insertedRow.kwh} kWh (meter: ${insertedRow.meter_id})`);

      // Refresh dashboard / halaman utama
      router.replace('/');
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
      <p className="text-xs text-slate-500">Ambil foto layar angka meteran PLN toko Anda dengan jelas.</p>

      {/* Selector Toko / Meteran */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <Store className="w-4 h-4 text-teal-600" /> Pilih Toko / Lokasi Meteran:
        </label>
        {isLoadingMeters ? (
          <div className="text-xs text-slate-400 py-1">Memuat daftar toko...</div>
        ) : meters.length > 0 ? (
          <select
            value={selectedMeterId}
            onChange={(e) => setSelectedMeterId(e.target.value)}
            className="w-full text-sm bg-white p-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 font-medium text-slate-800"
          >
            {meters.map((m) => (
              <option key={m.id} value={m.id}>
                {m.store_name} — ({m.meter_number})
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
            Belum ada toko terdaftar.{' '}
            <button
              onClick={() => router.push('/toko/tambah')}
              className="underline font-bold text-amber-800"
            >
              Tambah Toko Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Camera View / Preview Container */}
      <div className="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-slate-300">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview Meter" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-6 text-slate-400 space-y-2">
            <Camera className="w-12 h-12 mx-auto stroke-1" />
            <p className="text-xs">Arahkan kamera ke layar kWh meteran toko</p>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-teal-700 font-semibold flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-md transition"
              >
                {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                {isEditing ? 'Selesai' : 'Edit'}
              </button>

              <span
                className={`text-xs px-2 py-0.5 rounded font-bold ${
                  validationResult.confidence > 70
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {validationResult.confidence.toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="text-center py-2">
            {isEditing ? (
              <div className="flex items-center justify-center gap-2 max-w-[200px] mx-auto">
                <input
                  type="number"
                  step="0.1"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  className="w-full text-2xl font-bold text-center border-2 border-teal-500 rounded-lg p-1 focus:outline-none"
                  autoFocus
                />
                <span className="text-sm font-semibold text-slate-500">kWh</span>
              </div>
            ) : (
              <div className="text-3xl font-extrabold text-slate-900">
                {parseFloat(manualValue || '0').toFixed(1)}{' '}
                <span className="text-sm font-normal text-slate-500">kWh</span>
              </div>
            )}
          </div>

          {validationResult.correctionsMade.length > 0 && !isEditing && (
            <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
              <span className="font-semibold text-slate-700 block">Catatan Penyesuaian AI:</span>
              <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                {validationResult.correctionsMade.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

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
