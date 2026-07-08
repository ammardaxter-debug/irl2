const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('--- STARTING VERIFICATION TESTS ---');

  // Test 1: Verify auth_users table has mechanic seeded
  const { data: mechanic, error: mErr } = await supabase
    .from('auth_users')
    .select('*')
    .eq('email', 'mechanic@irl.sa')
    .single();

  if (mErr) {
    console.error('❌ Test 1 Failed: Mechanic user not found in auth_users:', mErr.message);
  } else {
    console.log('✅ Test 1 Passed: Mechanic user exists. Role:', mechanic.role);
  }

  // Test 2: Verify database helper functions are exported
  try {
    const db = require('../database');
    if (typeof db.createMaintenanceRequest === 'function' &&
        typeof db.getMyMaintenanceRequests === 'function' &&
        typeof db.getAllMaintenanceRequests === 'function' &&
        typeof db.updateMaintenanceRequest === 'function') {
      console.log('✅ Test 2 Passed: All maintenance functions are correctly exported from database.js');
    } else {
      console.error('❌ Test 2 Failed: One or more maintenance functions are not exported from database.js');
    }
  } catch (err) {
    console.error('❌ Test 2 Failed: Error loading database module:', err.message);
  }

  console.log('--- VERIFICATION TESTS COMPLETE ---');
}

runTests();
