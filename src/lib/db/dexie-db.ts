import Dexie, { Table } from 'dexie';

export interface LocalMeterReading {
  id?: string;
  user_id: string;
  meter_id: string;
  reading_date: string;
  reading_time: string;
  meter_value: number;
  photo_blob?: Blob;
  photo_url?: string;
  ocr_raw_result: string;
  ocr_confidence: number;
  daily_usage: number;
  sync_status: 'synced' | 'pending' | 'failed';
  created_at: string;
}

export interface LocalDeviceConfig {
  id?: number;
  name: string;
  wattage: number;
  avgHoursPerDay: number;
  count: number;
}

class ListrikJeniusDB extends Dexie {
  readings!: Table<LocalMeterReading>;
  devices!: Table<LocalDeviceConfig>;

  constructor() {
    super('ListrikJeniusDB');
    this.version(1).stores({
      readings: '++id, user_id, reading_date, sync_status',
      devices: '++id, name'
    });
  }
}

export const db = new ListrikJeniusDB();
