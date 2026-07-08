-- ====================================================================
-- LA Referral Commission System Schema Updates
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com)
-- ====================================================================

-- 1. Add referred_by_id column to riders table to track referral association
ALTER TABLE riders ADD COLUMN IF NOT EXISTS referred_by_id INTEGER REFERENCES riders(id) ON DELETE SET NULL;

-- 2. Create the la_commissions table to store commission records
CREATE TABLE IF NOT EXISTS la_commissions (
    id SERIAL PRIMARY KEY,
    cycle_key TEXT NOT NULL,
    la_rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
    la_rider_name TEXT,
    da_rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
    da_rider_name TEXT,
    da_entered_net NUMERIC DEFAULT 0,       -- Gross freelancer income entered (includes 5% commission)
    commission_amount NUMERIC DEFAULT 0,    -- 5% commission amount
    da_final_net NUMERIC DEFAULT 0,         -- 95% net payout to the DA
    status TEXT DEFAULT 'pending',          -- pending, paid, on-hold (matches DA status)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cycle_key, la_rider_id, da_rider_id)
);

-- 3. Enable RLS and add a policy for service role access
ALTER TABLE la_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON la_commissions;
CREATE POLICY "Service role full access" ON la_commissions FOR ALL USING (true) WITH CHECK (true);

-- 4. Add safety kit asset date columns to riders table
ALTER TABLE riders 
ADD COLUMN IF NOT EXISTS helmet_date TEXT,
ADD COLUMN IF NOT EXISTS gloves_date TEXT,
ADD COLUMN IF NOT EXISTS chest_safety_date TEXT,
ADD COLUMN IF NOT EXISTS foot_safety_date TEXT,
ADD COLUMN IF NOT EXISTS asset_history JSONB DEFAULT '[]'::jsonb;


-- ====================================================================
-- Bike Maintenance Request System Schema Updates
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com)
-- ====================================================================

-- 5. Create bike_maintenance_requests table
CREATE TABLE IF NOT EXISTS bike_maintenance_requests (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
  bike_id INTEGER REFERENCES bikes(id) ON DELETE CASCADE,
  selected_parts TEXT[] NOT NULL,
  description TEXT NOT NULL,
  shift_end_time TEXT NOT NULL,
  photos TEXT[] NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in-progress, resolved, cancelled
  mechanic_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS and add a policy for service role access
ALTER TABLE bike_maintenance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON bike_maintenance_requests;
CREATE POLICY "Service role full access" ON bike_maintenance_requests FOR ALL USING (true) WITH CHECK (true);
-- 7. Add scheduled time, missing parts, and resolution proof columns for mechanic details
ALTER TABLE bike_maintenance_requests 
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT,
  ADD COLUMN IF NOT EXISTS missing_part_desc TEXT,
  ADD COLUMN IF NOT EXISTS missing_part_photo TEXT,
  ADD COLUMN IF NOT EXISTS resolution_photo TEXT,
  ADD COLUMN IF NOT EXISTS rider_rating INTEGER,
  ADD COLUMN IF NOT EXISTS rider_feedback TEXT;
