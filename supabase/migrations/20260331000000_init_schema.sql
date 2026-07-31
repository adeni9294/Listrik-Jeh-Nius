CREATE TYPE monitoring_mode AS ENUM ('BASIC', 'MEDIUM', 'HIGH');
CREATE TYPE health_status AS ENUM ('EFFICIENT', 'ATTENTION', 'ANOMALY');

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  monitoring_mode monitoring_mode DEFAULT 'BASIC',
  tariff_per_kwh DECIMAL(10,2) DEFAULT 1444.70,
  devices JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.meters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meter_number VARCHAR(50) NOT NULL,
  customer_name TEXT,
  power_va INT DEFAULT 1300,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.meter_readings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  meter_id UUID REFERENCES public.meters(id) ON DELETE CASCADE NOT NULL,
  reading_date DATE NOT NULL,
  reading_time TIME NOT NULL,
  meter_value DECIMAL(10,2) NOT NULL,
  photo_url TEXT,
  photo_deleted BOOLEAN DEFAULT FALSE,
  ocr_raw_result TEXT,
  ocr_confidence DECIMAL(5,2),
  daily_usage DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual read access" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow individual update access" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow individual reading access" ON public.meter_readings FOR ALL USING (auth.uid() = user_id);
