import { getHistory, getLatestReading } from "./meterReadingsClient";
import { computeConsumption, Scan } from "./consumption";

export async function getDashboardSummary(meterId: string) {
  const history = await getHistory(meterId);
  const latest = await getLatestReading(meterId);

  const scans: Scan[] = (history || [])
    .map((h: any) => ({ kwh: Number(h.kwh ?? 0), created_at: h.created_at }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const consumptionSummary = computeConsumption(scans);

  return {
    latest,
    totalReading: history.length,
    dailyUsage: consumptionSummary.kwhPerHourUsedForProjection * 24,
    consumptionSummary,
    history,
  };
}
