export type Scan = {
  kwh: number;
  created_at: string | Date;
  id?: string | number;
};

export type IntervalResult = {
  from: Scan;
  to: Scan;
  deltaKwh: number;
  deltaHours: number;
  kwhPerHour: number;
  valid: boolean; // true kalau deltaHours>0 dan deltaKwh>=0
};

export type ConsumptionSummary = {
  scansCount: number;
  intervals: IntervalResult[]; // chronological (oldest -> newest)
  latestInterval?: IntervalResult; // interval antara 2 scan terbaru
  averageKwhPerHour: number; // rata-rata dari interval valid (0 kalau tidak ada)
  kwhPerHourUsedForProjection: number; // untuk proyeksi (rata-rata jika >1 interval valid, else latest valid)
  perDay: number;
  perWeek: number;
  perMonth: number;
};

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

function hoursBetween(a: string | Date, b: string | Date): number {
  const da = toDate(a).getTime();
  const db = toDate(b).getTime();
  return Math.abs(db - da) / (1000 * 60 * 60);
}

export function computeConsumption(scansInput: Scan[] = []): ConsumptionSummary {
  if (!Array.isArray(scansInput) || scansInput.length === 0) {
    return {
      scansCount: 0,
      intervals: [],
      averageKwhPerHour: 0,
      kwhPerHourUsedForProjection: 0,
      perDay: 0,
      perWeek: 0,
      perMonth: 0,
    };
  }

  // Filter & sort ascending by created_at (oldest -> newest)
  const scans = scansInput
    .filter(s => s && typeof s.kwh === 'number' && s.created_at)
    .map(s => ({ ...s }))
    .sort((a, b) => toDate(a.created_at).getTime() - toDate(b.created_at).getTime());

  const intervals: IntervalResult[] = [];

  for (let i = 1; i < scans.length; i++) {
    const prev = scans[i - 1];
    const curr = scans[i];
    const deltaKwh = curr.kwh - prev.kwh; // newer - older
    const deltaHours = hoursBetween(curr.created_at, prev.created_at);
    const valid = deltaHours > 0 && deltaKwh >= 0;
    const kwhPerHour = deltaHours > 0 ? deltaKwh / deltaHours : 0;

    intervals.push({
      from: prev,
      to: curr,
      deltaKwh,
      deltaHours,
      kwhPerHour,
      valid,
    });
  }

  const validIntervals = intervals.filter(i => i.valid);
  const averageKwhPerHour =
    validIntervals.length > 0
      ? validIntervals.reduce((s, it) => s + it.kwhPerHour, 0) / validIntervals.length
      : 0;

  const latestInterval = intervals.length > 0 ? intervals[intervals.length - 1] : undefined;

  // Rule: jika ada >1 valid interval gunakan rata-rata; jika cuma 1 valid interval gunakan interval itu
  const kwhPerHourUsedForProjection =
    validIntervals.length > 1
      ? averageKwhPerHour
      : validIntervals.length === 1
      ? validIntervals[validIntervals.length - 1].kwhPerHour
      : 0;

  const perDay = kwhPerHourUsedForProjection * 24;
  const perWeek = perDay * 7;
  const perMonth = perDay * 30;

  return {
    scansCount: scans.length,
    intervals,
    latestInterval,
    averageKwhPerHour,
    kwhPerHourUsedForProjection,
    perDay,
    perWeek,
    perMonth,
  };
}
