import { db, LocalMeterReading } from './dexie-db';
import { supabase } from '@/lib/supabase/client';

export async function syncLocalDataToCloud() {
  if (!navigator.onLine) return;

  const pendingReadings = await db.readings.where('sync_status').equals('pending').toArray();

  for (const item of pendingReadings) {
    try {
      let publicPhotoUrl = item.photo_url;

      // Jika ada Blob foto lokal, upload ke Supabase Storage terlebih dahulu
      if (item.photo_blob) {
        const filePath = `${item.user_id}/${Date.now()}.webp`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meter-photos')
          .upload(filePath, item.photo_blob, { contentType: 'image/webp' });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('meter-photos').getPublicUrl(filePath);
          publicPhotoUrl = urlData.publicUrl;
        }
      }

      // Upsert data pencatatan ke Supabase Database
      const { error: dbError } = await supabase.from('meter_readings').insert({
        user_id: item.user_id,
        meter_id: item.meter_id,
        reading_date: item.reading_date,
        reading_time: item.reading_time,
        meter_value: item.meter_value,
        photo_url: publicPhotoUrl,
        ocr_raw_result: item.ocr_raw_result,
        ocr_confidence: item.ocr_confidence,
        daily_usage: item.daily_usage,
      });

      if (!dbError) {
        // Update status di lokal IndexedDB
        await db.readings.update(item.id!, {
          sync_status: 'synced',
          photo_url: publicPhotoUrl,
          photo_blob: undefined, // Hapus Blob lokal setelah berhasil sinkron untuk menghemat ruang penyimpanan
        });
      }
    } catch (err) {
      console.error('Gagal melakukan sinkronisasi ID:', item.id, err);
    }
  }
}
