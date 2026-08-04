// src/lib/constants.ts

/**
 * Tarif Dasar Listrik PLN Terbaru (Per kWh)
 * Referensi: Tarif Listrik Regulasi ESDM / PLN
 */
export const TARIF_PLN = {
  // Tarif Bisnis Kecil & Menengah (B-1 & B-2) -> Toko, Ruko, Minimarket (1.300 VA - 200 kVA)
  BISNIS_NON_SUBSIDI: 1444.7,

  // Rumah Tangga / Usaha Kecil 900 VA Non-Subsidi (R-1M)
  R1_NON_SUBSIDI_900: 1352.0,

  // Tarif Subsidi (R-1 / B-1 450 VA & 900 VA)
  SUBSIDI_900: 605.0,
} as const;

/**
 * Ambang batas normal konsumsi jam-jaman untuk deteksi lonjakan (Spike Alert)
 * Default: 10 kWh / jam untuk Toko Modern
 */
export const DEFAULT_HOURLY_THRESHOLD = 10.0;

/**
 * Helper untuk menentukan tarif berdasarkan daya (power_va)
 */
export const getTariffRate = (powerVa: number, isSubsidized: boolean = false): number => {
  if (isSubsidized && powerVa <= 900) {
    return TARIF_PLN.SUBSIDI_900;
  }
  if (powerVa === 900 && !isSubsidized) {
    return TARIF_PLN.R1_NON_SUBSIDI_900;
  }
  // Default untuk toko & minimarket (1.300 VA s/d 41.500 VA / B2)
  return TARIF_PLN.BISNIS_NON_SUBSIDI;
};
