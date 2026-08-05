'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, RefreshCw, Edit3, Check, Store, Image as ImageIcon, LogOut, LogIn, Lock } from 'lucide-react';
import Link from 'next/link';
import { processAndCompressImage } from '@/lib/utils/image-compressor';
import { AIValidationEngine, ValidationResult } from '@/lib/ai/validation-engine';
import { createClient } from '@/lib/supabase/client';
import { fetchMeterReadingsClient } from '@/lib/meterReadingsClient';

interface Meter {
  id: string;
  store_name: string;
  meter_number: string;
}

export default function ScanPage() {
  const router = useRouter();
  const supabase = createClient();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedFileBlob, setCompressedFileBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // State Auth & Data Toko
  const [meters, setMeters] = useState<Meter[]>([]);
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [isLoadingMeters, setIsLoadingMeters] = useState<boolean>(true);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // State untuk Edit Manual
  const [isEditing, setIsEditing] = useState(false);
  const [manualValue, setManualValue] = useState<string>('');

  useEffect(() => {
    const fetchMeters = async () => {
      try {
        const storedRole = localStorage.getItem('user_role');
        const storedStoreId = localStorage.getItem('active_store_id');
        
        // VALIDASI SESI LOGIN
        if (storedStoreId && storedRole) {
          setIsLoggedIn(true);
          setActiveStoreId(storedStoreId);
        } else {
          setIsLoggedIn(false);
          setActiveStoreId(null);
          setIsLoadingMeters(false);
          return;
        }

        let query = supabase
          .from('meters')
          .select('id, store_name, meter_number')
          .order('created_at', { ascending: false });

        if (storedRole !== 'admin' && storedStoreId) {
          query = query.eq('id', storedStoreId);
        }

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          setMeters(data);
          const activeExists = storedStoreId && data.some((m) => m.id === storedStoreId);
          setSelectedMeterId(activeExists ? storedStoreId! : data[0].id);
        }
      } catch (err: any) {
        console.error('Gagal mengambil data toko:', err.message);
      } font-medium {
        setIsLoadingMeters(false);
      }
    };

    fetchMeters();
  }, [supabase]);

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

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setValidationResult(null);
    setIsEditing(false);

    try {
      const compressedBlob = await processAndCompressImage(file);
      setCompressedFileBlob(compressedBlob);
      setPreviewUrl(URL.createObjectURL(compressedBlob));

      let lastReadingValue = 0;
      if (selectedMeterId) {
        try {
          const readings = await fetchMeterReadingsClient(selectedMeterId, 1);
          if (readings && readings.length > 0) {
            lastReadingValue = Number(readings[0].kwh ?? 0);
          }
        } catch (e) {
          console.warn('Gagal ambil last reading:', e);
          lastReadingValue = 0;
        }
      }

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

  const uploadImageToStorage = async (blob: Blob, meterId: string): Promise<string | null> => {
    try {
      const fileName = `${meterId}/${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('meter-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) {
        console.warn('Storage upload error (meter-images):', error.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('meter-images')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Gagal mengunggah foto:', err);
      return null;
    }
  };

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
      const currentActiveStore = localStorage.getItem('active_store_id');
      const meterId = selectedMeterId || currentActiveStore;

      if (!meterId) {
        alert('Silakan masuk dahulu agar data tersimpan dan dapat tampil di dashboard.');
        window.location.href = '/login';
        return;
      }

      let uploadedImageUrl: string | null = null;
      if (compressedFileBlob) {
        uploadedImageUrl = await uploadImageToStorage(compressedFileBlob, meterId);
      }

      const now = new Date();

      const payload = {
        meter_id: meterId,
        meter_value: finalKwh,
        kwh: finalKwh,
        confidence: isEditing ? 100 : validationResult.confidence,
        status: 'success',
        image_url: uploadedImageUrl,
        reading_date: now.toISOString().slice(0, 10),
        reading_time: now.toTimeString().split(' ')[0],
        created_at: now.toISOString(),
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('meter_readings')
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      alert(`Tersimpan: ${insertedRow.kwh} kWh`);
      window.location.href = '/';
    } catch (err: any) {
      console.error('Gagal menyimpan ke Supabase:', err);
      alert(`Gagal menyimpan data: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24 max-w-lg mx-auto">
      {/* Header Info & Actions */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pindai Meter Listrik</h1>
          <p className="text-xs text-slate-500">Ambil foto layar angka meteran PLN toko Anda dengan jelas.</p>
        </div>

        <div>
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
        </div>
      </div>

      {!isLoggedIn ? (
        /* TAMPILAN TERKUNCI JIKA LOGOUT */
        <Card className="border-dashed border-slate-300 bg-slate-50/80 my-8">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Fitur Pindai Terkunci</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Silakan masuk menggunakan Kode Toko / ID PLN Anda untuk dapat memindai meteran & menyimpan data.
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
        /* TAMPILAN KAMERA & PROSES JIKA LOGGED IN */
        <>
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
                className="w-full text-sm bg-white p-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 outline-none"
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
                <Camera className="w-12 h-12 mx-auto stroke-1 text-slate-400" />
                <p className="text-xs">Arahkan kamera ke layar kWh meteran toko</p>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
                <span className="text-xs font-semibold">Sedang membaca & memvalidasi angka...</span>
              </div>
            )}
          </div>

          {/* Control Actions */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCapture}
                className="hidden"
              />
              <div className="w-full bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 px-3 rounded-xl text-center text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5 transition">
                <Camera className="w-4 h-4" />
                {previewUrl ? 'Foto Ulang' : 'Buka Kamera'}
              </div>
            </label>

            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleCapture}
                className="hidden"
              />
              <div className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-3 rounded-xl text-center text-xs cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5 transition">
                <ImageIcon className="w-4 h-4 text-slate-500" />
                Pilih Galeri
              </div>
            </label>
          </div>

          {/* OCR & AI Validation Result Preview */}
          {validationResult && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-xs font-semibold text-slate-500">Hasil Pembacaan AI</span>
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition shadow-sm"
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
        </>
      )}
    </div>
  );
}
