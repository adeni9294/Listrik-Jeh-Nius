export type MonitoringMode = 'BASIC' | 'MEDIUM' | 'HIGH';
export type HealthStatus = 'EFFICIENT' | 'ATTENTION' | 'ANOMALY';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  monitoring_mode: MonitoringMode;
  tariff_per_kwh: number;
  devices: DeviceConfig[];
}

export interface DeviceConfig {
  id?: string;
  name: string;
  wattage: number;
  avgHoursPerDay: number;
  count: number;
}

export interface MeterReading {
  id?: string;
  user_id: string;
  meter_id: string;
  reading_date: string;
  reading_time: string;
  meter_value: number;
  photo_url?: string;
  photo_deleted?: boolean;
  ocr_raw_result: string;
  ocr_confidence: number;
  daily_usage: number;
  predicted_usage?: number;
  created_at?: string;
}

export interface AIInsightSummary {
  intelligence_score: number;
  data_quality: number;
  prediction_confidence: number;
  estimated_token_kwh: number;
  estimated_days_left: number;
  health_status: HealthStatus;
  insight_text: string;
  recommended_purchase_amount: number;
}
