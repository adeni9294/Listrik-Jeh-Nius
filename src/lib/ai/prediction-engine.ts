export interface PredictionOutput {
  predictedTomorrowKwh: number;
  predictedWeeklyKwh: number;
  predictedMonthlyKwh: number;
  estimatedDaysLeft: number;
  recommendedPurchaseAmount: number;
}

export class AIPredictionEngine {
  public static predict(
    readings: { date: string; usage: number }[],
    currentRemainingKwh: number,
    tariffPerKwh: number = 1444.70
  ): PredictionOutput {
    if (readings.length === 0) {
      return {
        predictedTomorrowKwh: 5.0,
        predictedWeeklyKwh: 35.0,
        predictedMonthlyKwh: 150.0,
        estimatedDaysLeft: Math.floor(currentRemainingKwh / 5.0),
        recommendedPurchaseAmount: 100000,
      };
    }

    // Weighted Moving Average (WMA) memberikan bobot lebih pada data terbaru
    let totalWeight = 0;
    let weightedUsageSum = 0;

    readings.slice(-14).forEach((item, index) => {
      const weight = index + 1;
      weightedUsageSum += item.usage * weight;
      totalWeight += weight;
    });

    const avgDailyKwh = weightedUsageSum / totalWeight;
    const predictedTomorrowKwh = Number(avgDailyKwh.toFixed(2));
    const predictedWeeklyKwh = Number((avgDailyKwh * 7).toFixed(2));
    const predictedMonthlyKwh = Number((avgDailyKwh * 30).toFixed(2));

    const estimatedDaysLeft = avgDailyKwh > 0 ? Math.floor(currentRemainingKwh / avgDailyKwh) : 99;

    // Hitung rekomendasi pengisian token (pembulatan ke nominal standar PLN: 20k, 50k, 100k, 200k, 500k, 1M)
    const neededKwhMonthly = predictedMonthlyKwh;
    const estimatedCostMonthly = neededKwhMonthly * tariffPerKwh;

    let recommendedPurchaseAmount = 100000;
    if (estimatedCostMonthly <= 50000) recommendedPurchaseAmount = 50000;
    else if (estimatedCostMonthly <= 100000) recommendedPurchaseAmount = 100000;
    else if (estimatedCostMonthly <= 200000) recommendedPurchaseAmount = 200000;
    else if (estimatedCostMonthly <= 500000) recommendedPurchaseAmount = 500000;
    else recommendedPurchaseAmount = 1000000;

    return {
      predictedTomorrowKwh,
      predictedWeeklyKwh,
      predictedMonthlyKwh,
      estimatedDaysLeft,
      recommendedPurchaseAmount,
    };
  }
}
