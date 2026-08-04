// src/lib/meterReadingsClient.ts
import { createClient } from '@/lib/supabase/client';

export type Reading = {
  id: string;
  meter_id: string;
  meter_value: number;
  kwh: number;
  created_at: string;
  confidence_score?: number | null;
  status?: string | null;
  store_name?: string | null;
};

export async function fetchMeterReadingsClient(meterId = 'all', limit = 100): Promise<Reading[]> {
  const supabase = createClient();

  let query = supabase
    .from('meter_readings')
    .select(`
      id,
      meter_id,
      meter_value,
      kwh,
      created_at,
      confidence_score,
      status,
      meters ( store_name )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (meterId && meterId !== 'all') {
    query = query.eq('meter_id', meterId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    meter_id: String(r.meter_id),
    meter_value: Number(r.meter_value ?? 0),
    kwh: Number(r.kwh ?? 0),
    created_at: String(r.created_at),
    confidence_score: r.confidence_score ?? null,
    status: r.status ?? null,
    store_name: r.meters?.store_name ?? null,
  }));
}

/**
 * readings MUST be ordered by created_at DESC (latest first).
 * Returns 0 when fewer than 2 readings.
 */
export function computeDailyUsage(readings: Reading[]): number {
  if (!readings || readings.length < 2) return 0;
  const latest = readings[0];
  const previous = readings[1];
  const diff = Number(latest.kwh) - Number(previous.kwh);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}
