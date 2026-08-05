// src/lib/constants.ts

/**
 * Tarif Dasar Listrik PLN Terbaru (Per kWh)
 * Referensi: Regulasi Kementerian ESDM / PT PLN (Persero)
 */
export const TARIF_PLN = {
  // Rumah Tangga & Bisnis Kecil (1.300 VA - 2.200 VA)
  BISNIS_KECIL_1300_2200: 1444.7,

  // Bisnis / Rumah Tangga Menengah (3.500 VA - 5.500 VA)
  BISNIS_MENENGAH_3500_5500: 1699.53,

  // Rumah Tangga 900 VA Non-Subsidi (R-1M)
  R1_NON_SUBSIDI_900: 1352.0,

  // Tarif Subsidi (900 VA R-1 Subsidi)
  SUBSIDI_900: 605.0,
} as const;

/**
 * Ambang batas normal konsumsi jam-jaman untuk deteksi lonjakan (Spike Alert)
 * Default: 10 kWh / jam untuk Toko Modern
 */
export const DEFAULT_HOURLY_THRESHOLD = 10.0;

/**
 * Helper untuk menentukan tarif berdasarkan daya terpasang (power_va)
 */
export const getTariffRate = (powerVa: number, isSubsidized: boolean = false): number => {
  if (isSubsidized && powerVa <= 900) {
    return TARIF_PLN.SUBSIDI_900;
  }
  if (powerVa === 900 && !isSubsidized) {
    return TARIF_PLN.R1_NON_SUBSIDI_900;
  }
  if (powerVa >= 3500) {
    return TARIF_PLN.BISNIS_MENENGAH_3500_5500;
  }
  
  // Default untuk toko & ruko standar (1.300 VA s.d. 2.200 VA)
  return TARIF_PLN.BISNIS_KECIL_1300_2200;
};
