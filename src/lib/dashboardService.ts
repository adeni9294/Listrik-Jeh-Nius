import {
  getHistory,
  getLatestReading,
  computeDailyUsage,
} from "./meterReadingsClient";

export async function getDashboardSummary(
  meterId: string
) {
  const history = await getHistory(meterId);

  const latest = await getLatestReading(meterId);

  return {
    latest,
    totalReading: history.length,
    dailyUsage: computeDailyUsage(history),
    history,
  };
}
