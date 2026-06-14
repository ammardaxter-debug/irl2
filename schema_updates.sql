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
