// src/lib/meterReadingsClient.ts

import { createClient } from "@/lib/supabase/client";
import { computeConsumption, Scan } from "./consumption";

const supabase = createClient();

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

function mapReading(r: any): Reading {
  return {
    id: String(r.id),
    meter_id: String(r.meter_id),
    meter_value: Number(r.meter_value ?? 0),
    kwh: Number(r.kwh ?? 0),
    created_at: String(r.created_at),
    confidence_score: r.confidence_score ?? null,
    status: r.status ?? null,
    store_name: r.meters?.store_name ?? null,
  };
}

/**
 * Semua histori
 */
export async function fetchMeterReadingsClient(
  meterId = "all",
  limit = 100
): Promise<Reading[]> {
  let query = supabase
    .from("meter_readings")
    .select(`
      id,
      meter_id,
      meter_value,
      kwh,
      created_at,
      confidence_score,
      status,
      meters(store_name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (meterId !== "all") {
    query = query.eq("meter_id", meterId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map(mapReading);
}

/**
 * Pembacaan terakhir
 */
export async function getLatestReading(
  meterId: string
): Promise<Reading | null> {
  const { data, error } = await supabase
    .from("meter_readings")
    .select(`
      id,
      meter_id,
      meter_value,
      kwh,
      created_at,
      confidence_score,
      status,
      meters(store_name)
    `)
    .eq("meter_id", meterId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data ? mapReading(data) : null;
}

/**
 * Detail berdasarkan id
 */
export async function getReadingById(id: string) {
  const { data, error } = await supabase
    .from("meter_readings")
    .select(`
      *,
      meters(store_name)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data ? mapReading(data) : null;
}

/**
 * Insert hasil OCR
 */
export async function insertReading(payload: any) {
  const { data, error } = await supabase
    .from("meter_readings")
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Update jika memang diperlukan
 */
export async function updateReading(
  id: string,
  payload: Partial<Reading>
) {
  const { data, error } = await supabase
    .from("meter_readings")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Hapus histori
 */
export async function deleteReading(id: string) {
  const { error } = await supabase
    .from("meter_readings")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Pemakaian hari ini
 *
 * Perubahan: gunakan computeConsumption untuk mendapatkan interval terbaru dan mengkalkulasi usage.
 */
export function computeDailyUsage(
  readings: Reading[]
): number {
  if (!Array.isArray(readings) || readings.length < 2) return 0;

  // Build scans chronological (oldest -> newest)
  const scans: Scan[] = readings
    .map(r => ({ kwh: Number(r.kwh ?? 0), created_at: r.created_at }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const summary = computeConsumption(scans);

  // latestInterval.deltaKwh adalah newer - older
  return summary.latestInterval ? Math.max(0, summary.latestInterval.deltaKwh) : 0;
}

/**
 * Total pemakaian dari seluruh histori
 */
export function getTotalUsage(
  readings: Reading[]
): number {
  if (!Array.isArray(readings) || readings.length < 2) return 0;

  const scans: Scan[] = readings
    .map(r => ({ kwh: Number(r.kwh ?? 0), created_at: r.created_at }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const summary = computeConsumption(scans);

  // jumlahkan deltaKwh hanya dari interval valid
  return summary.intervals.filter(i => i.valid).reduce((s, it) => s + Math.max(0, it.deltaKwh), 0);
}

/**
 * Statistik sederhana
 */
export function getStatistics(
  readings: Reading[]
) {
  const scans: Scan[] = (readings || [])
    .map(r => ({ kwh: Number(r.kwh ?? 0), created_at: r.created_at }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const summary = computeConsumption(scans);

  return {
    totalReading: readings.length,
    dailyUsage: summary.latestInterval ? Math.max(0, summary.latestInterval.deltaKwh) : 0,
    totalUsage: summary.intervals.filter(i => i.valid).reduce((s, it) => s + Math.max(0, it.deltaKwh), 0),
    latest: readings[0] ?? null,
    consumptionSummary: summary,
  };
}
