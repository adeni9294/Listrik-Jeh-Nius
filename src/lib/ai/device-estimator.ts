export interface DeviceInput {
  name: string;
  wattage: number;
  avgHoursPerDay: number;
  count: number;
}

export interface DeviceContribution {
  deviceName: string;
  estimatedDailyKwh: number;
  percentageOfTotal: number;
}

export class SmartDeviceEstimator {
  public static calculateBreakdown(
    devices: DeviceInput[],
    actualAvgDailyKwh: number
  ): { contributions: DeviceContribution[]; insightMsg: string } {
    let totalEstimatedTheoreticalKwh = 0;

    const rawCalculations = devices.map((dev) => {
      // (Watt * Jam * Jumlah) / 1000 = kWh per hari
      const dailyKwh = (dev.wattage * dev.avgHoursPerDay * dev.count) / 1000;
      totalEstimatedTheoreticalKwh += dailyKwh;
      return {
        name: dev.name,
        dailyKwh,
      };
    });

    const contributions: DeviceContribution[] = rawCalculations.map((item) => {
      const percentage = totalEstimatedTheoreticalKwh > 0 
        ? (item.dailyKwh / totalEstimatedTheoreticalKwh) * 100 
        : 0;
      return {
        deviceName: item.name,
        estimatedDailyKwh: Number(item.dailyKwh.toFixed(2)),
        percentageOfTotal: Number(percentage.toFixed(1)),
      };
    });

    // Urutkan dari perangkat paling konsumtif
    contributions.sort((a, b) => b.percentageOfTotal - a.percentageOfTotal);

    let insightMsg = "Pola penggunaan perangkat Anda terpantau normal.";
    if (contributions.length > 0) {
      const topDevice = contributions[0];
      insightMsg = `Perangkat **${topDevice.deviceName}** diperkirakan menyedot hingga ${topDevice.percentageOfTotal}% dari total konsumsi harian Anda.`;
      
      if (topDevice.percentageOfTotal > 40) {
        insightMsg += ` Kurangi penggunaan ${topDevice.deviceName} sebanyak 1-2 jam per hari untuk menghemat hingga 15% biaya token bulan depan.`;
      }
    }

    return { contributions, insightMsg };
  }
}
