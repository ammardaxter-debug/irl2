-- =============================================
-- IRL Logistics — Supabase PostgreSQL Schema
-- Updated for migration to new project
-- =============================================

-- 1. RIDERS (primary entity)
CREATE TABLE IF NOT EXISTS riders (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nationality TEXT,
  iqama_number TEXT,
  iqama_expiry TEXT,
  date_of_birth TEXT,
  rider_type TEXT DEFAULT 'company',
  client_company TEXT,
  base_salary NUMERIC DEFAULT 1950,
  bank_name TEXT,
  bank_account TEXT,
  iban TEXT,
  bike_id TEXT,
  status TEXT DEFAULT 'active',
  profile_photo TEXT,
  photo_url TEXT,
  portal_enabled BOOLEAN DEFAULT false,
  portal_password TEXT,
  portal_password_plain TEXT,
  push_token TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_lat NUMERIC,
  last_lng NUMERIC,
  last_location_update TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  kit_notes TEXT,
  uniform_date TEXT,
  safety_kit_date TEXT,
  noon_id TEXT,
  per_order_rate NUMERIC DEFAULT 0,
  store_warehouse TEXT,
  doc_vault TEXT,
  gps_status TEXT
);

-- 2. DAILY LOGS
CREATE TABLE IF NOT EXISTS daily_logs (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
  rider_name TEXT,
  log_date TEXT NOT NULL,
  attendance_status TEXT NOT NULL DEFAULT 'Present',
  primary_orders INTEGER DEFAULT 0,
  associate_orders INTEGER DEFAULT 0,
  checkin_hours INTEGER DEFAULT 0,
  checkin_minutes INTEGER DEFAULT 0,
  notes TEXT,
  screenshot TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow only one log per rider per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_logs_rider_date 
  ON daily_logs(rider_id, log_date);

-- 3. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  expense_date TEXT,
  category TEXT,
  amount NUMERIC DEFAULT 0,
  rider_id INTEGER,
  rider_name TEXT,
  notes TEXT,
  receipt_url TEXT,
  is_deductible BOOLEAN DEFAULT false,
  "deductionSettled" BOOLEAN DEFAULT false,
  settled_by TEXT,
  "settledBy" TEXT,
  settled_at TIMESTAMPTZ,
  "settledDate" TEXT,
  source TEXT,
  request_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  vendor_name TEXT
);

-- 4. SALARY ADVANCES
CREATE TABLE IF NOT EXISTS salary_advances (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER,
  rider_name TEXT,
  amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  category TEXT,
  description TEXT,
  "deductionSettled" BOOLEAN DEFAULT false,
  settled_by TEXT,
  "settledBy" TEXT,
  settled_at TIMESTAMPTZ,
  "settledDate" TEXT,
  cycle_start TEXT,
  cycle_end TEXT,
  source TEXT,
  request_id INTEGER,
  admin_note TEXT,
  processed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 5. BONUSES
CREATE TABLE IF NOT EXISTS bonuses (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER,
  rider_name TEXT,
  amount NUMERIC DEFAULT 0,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. COMPANY FUNDS
CREATE TABLE IF NOT EXISTS company_funds (
  id SERIAL PRIMARY KEY,
  amount NUMERIC DEFAULT 0,
  source TEXT,
  receive_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 7. BIKES
CREATE TABLE IF NOT EXISTS bikes (
  id SERIAL PRIMARY KEY,
  plate_number TEXT,
  model TEXT,
  year TEXT,
  color TEXT,
  insurance_expiry TEXT,
  istimara_expiry TEXT,
  status TEXT DEFAULT 'available',
  assigned_rider_id INTEGER,
  assigned_rider_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RIDER REQUESTS
CREATE TABLE IF NOT EXISTS rider_requests (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER,
  rider_name TEXT,
  category TEXT,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  status TEXT DEFAULT 'pending',
  admin_note TEXT,
  processed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  processed_by_name TEXT,
  processed_by_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PAYMENT STATUS (per cycle per rider)
CREATE TABLE IF NOT EXISTS payment_status (
  id SERIAL PRIMARY KEY,
  cycle_key TEXT NOT NULL,
  rider_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  final_paid_amount NUMERIC,
  notes TEXT,
  manual_deductions NUMERIC DEFAULT 0,
  manual_bonus NUMERIC DEFAULT 0,
  advance_deducted NUMERIC DEFAULT 0,
  cod_settled NUMERIC DEFAULT 0,
  other_deductions NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_key, rider_id)
);

-- 11. PAYROLL LOCKS
CREATE TABLE IF NOT EXISTS payroll_locks (
  cycle_key TEXT PRIMARY KEY,
  locked BOOLEAN DEFAULT true,
  locked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. ADMIN PROFILES
CREATE TABLE IF NOT EXISTS admin_profiles (
  email_key TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'admin',
  photo_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "user" TEXT DEFAULT 'System User',
  action TEXT,
  entity TEXT,
  description TEXT
);

-- 14. APP CONFIG
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. AUTH USERS (for admin login)
CREATE TABLE IF NOT EXISTS auth_users (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. LOCATION HISTORY (time-series rider positions)
CREATE TABLE IF NOT EXISTS location_history (
  id BIGSERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy NUMERIC,
  speed NUMERIC,
  battery_level NUMERIC,
  source TEXT,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT
);

-- 17. RIDER HEARTBEATS (app-alive signals)
CREATE TABLE IF NOT EXISTS rider_heartbeats (
  id BIGSERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id) ON DELETE CASCADE,
  battery_level NUMERIC,
  is_location_active BOOLEAN DEFAULT true,
  app_state TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_rider ON daily_logs(rider_id);
CREATE INDEX IF NOT EXISTS idx_expenses_rider ON expenses(rider_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_salary_advances_rider ON salary_advances(rider_id);
CREATE INDEX IF NOT EXISTS idx_notifications_rider ON notifications(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_requests_rider ON rider_requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);

-- =============================================
-- INDEXES for location tracking tables
-- =============================================
CREATE INDEX IF NOT EXISTS idx_location_history_rider ON location_history(rider_id);
CREATE INDEX IF NOT EXISTS idx_location_history_time ON location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_location_history_session ON location_history(session_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_rider ON rider_heartbeats(rider_id);
CREATE INDEX IF NOT EXISTS idx_heartbeats_time ON rider_heartbeats(received_at);

-- =============================================
-- Row Level Security (RLS) — disabled for server-side access
-- =============================================
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_heartbeats ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS, so permissive policies for safety:
CREATE POLICY "Service role full access" ON riders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON daily_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON salary_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bonuses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON company_funds FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON bikes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON rider_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payment_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON payroll_locks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON admin_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON app_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON auth_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON location_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON rider_heartbeats FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- RESET SEQUENCES (run after data import)
-- =============================================
-- SELECT setval('riders_id_seq', COALESCE((SELECT MAX(id) FROM riders), 0) + 1, false);
-- SELECT setval('daily_logs_id_seq', COALESCE((SELECT MAX(id) FROM daily_logs), 0) + 1, false);
-- SELECT setval('expenses_id_seq', COALESCE((SELECT MAX(id) FROM expenses), 0) + 1, false);
-- SELECT setval('salary_advances_id_seq', COALESCE((SELECT MAX(id) FROM salary_advances), 0) + 1, false);
-- SELECT setval('bonuses_id_seq', COALESCE((SELECT MAX(id) FROM bonuses), 0) + 1, false);
-- SELECT setval('company_funds_id_seq', COALESCE((SELECT MAX(id) FROM company_funds), 0) + 1, false);
-- SELECT setval('bikes_id_seq', COALESCE((SELECT MAX(id) FROM bikes), 0) + 1, false);
-- SELECT setval('rider_requests_id_seq', COALESCE((SELECT MAX(id) FROM rider_requests), 0) + 1, false);
-- SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 0) + 1, false);
-- SELECT setval('payment_status_id_seq', COALESCE((SELECT MAX(id) FROM payment_status), 0) + 1, false);
-- SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 0) + 1, false);
-- SELECT setval('auth_users_id_seq', COALESCE((SELECT MAX(id) FROM auth_users), 0) + 1, false);
-- SELECT setval('location_history_id_seq', COALESCE((SELECT MAX(id) FROM location_history), 0) + 1, false);
-- SELECT setval('rider_heartbeats_id_seq', COALESCE((SELECT MAX(id) FROM rider_heartbeats), 0) + 1, false);
