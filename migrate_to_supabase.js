// ========================================
//  Firebase to Supabase Migration Script
// ========================================

const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Initialize Firebase
const saPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}
const fbDb = admin.database();

// 2. Initialize Supabase
const supabaseUrl = 'https://gyjipkxewpdkxpfciddo.supabase.co';
const supabaseKey = 'sb_secret_0WSEkcc8d674fto2ICVX8A_5r77HtC7'; // SERVICE_ROLE key
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to convert Firebase snapshot to array with numeric IDs
function snapshotToArray(snapshot) {
  const arr = [];
  if (!snapshot.exists()) return arr;
  snapshot.forEach(child => {
    // Attempt to keep the numeric ID if possible, otherwise Supabase will auto-generate
    const id = parseInt(child.key);
    if (!isNaN(id)) {
        arr.push({ id, ...child.val() });
    } else {
        arr.push({ ...child.val() });
    }
  });
  return arr;
}

// Convert empty string/invalid dates to NULL
function cleanDate(dateStr) {
    if (!dateStr || dateStr === '') return null;
    return dateStr;
}

async function migrate() {
  console.log("🚀 Starting migration from Firebase to Supabase...");
  
  // Test Supabase connection
  const { data: testData, error: testError } = await supabase.from('riders').select('id').limit(1);
  if (testError) {
      console.error("❌ Cannot connect to Supabase or schema is missing. Did you run the SQL script?");
      console.error(testError);
      process.exit(1);
  }
  
  try {
    // ------------------------------------
    // 1. Migrate Riders
    // ------------------------------------
    console.log("Migrating Riders...");
    const ridersSnap = await fbDb.ref('riders').once('value');
    const riders = snapshotToArray(ridersSnap).map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone || null,
      email: r.email || null,
      nationality: r.nationality || null,
      iqama_number: r.iqama_number || null,
      iqama_expiry: cleanDate(r.iqama_expiry),
      date_of_birth: cleanDate(r.date_of_birth),
      rider_type: r.rider_type || 'company',
      client_company: r.client_company || null,
      base_salary: r.base_salary || 1950,
      bank_name: r.bank_name || null,
      bank_account: r.bank_account || null,
      iban: r.iban || null,
      bike_id: r.bike_id || null,
      status: r.status || 'active',
      profile_photo: r.profile_photo || null,
      photo_url: r.photo_url || null,
      portal_enabled: r.portal_enabled || false,
      portal_password: r.portal_password || null,
      portal_password_plain: r.portal_password_plain || null,
      push_token: r.push_token || null,
      last_login: cleanDate(r.last_login),
      created_at: cleanDate(r.created_at) || new Date().toISOString(),
      updated_at: cleanDate(r.updated_at) || new Date().toISOString()
    }));
    
    if (riders.length > 0) {
        const { error } = await supabase.from('riders').upsert(riders);
        if (error) throw error;
        console.log(`✅ Migrated ${riders.length} riders.`);
    }

    // ------------------------------------
    // 2. Migrate Daily Logs
    // ------------------------------------
    console.log("Migrating Daily Logs...");
    const logsSnap = await fbDb.ref('daily_logs').once('value');
    const logs = snapshotToArray(logsSnap).map(l => ({
      id: l.id,
      rider_id: parseInt(l.rider_id) || null,
      rider_name: l.rider_name || null,
      log_date: l.log_date,
      attendance_status: l.attendance_status || 'Present',
      primary_orders: l.primary_orders || 0,
      associate_orders: l.associate_orders || 0,
      checkin_hours: l.checkin_hours || 0,
      checkin_minutes: l.checkin_minutes || 0,
      notes: l.notes || null,
      screenshot: l.screenshot || null,
      submitted_at: cleanDate(l.submitted_at),
      created_at: cleanDate(l.created_at) || new Date().toISOString(),
      updated_at: cleanDate(l.updated_at) || new Date().toISOString()
    })).filter(l => l.rider_id !== null && l.log_date); // Requires rider_id and date
    
    if (logs.length > 0) {
        // Upsert in batches of 500
        for (let i = 0; i < logs.length; i += 500) {
            const batch = logs.slice(i, i + 500);
            const { error } = await supabase.from('daily_logs').upsert(batch, { onConflict: 'rider_id, log_date', ignoreDuplicates: true });
            if (error) throw error;
        }
        console.log(`✅ Migrated ${logs.length} daily logs.`);
    }

    // ------------------------------------
    // 3. Migrate Expenses
    // ------------------------------------
    console.log("Migrating Expenses...");
    const expSnap = await fbDb.ref('expenses').once('value');
    const expenses = snapshotToArray(expSnap).map(e => ({
      id: e.id,
      expense_date: e.expense_date || null,
      category: e.category || null,
      amount: e.amount || 0,
      rider_id: e.rider_id ? parseInt(e.rider_id) : null,
      rider_name: e.rider_name || null,
      notes: e.notes || null,
      receipt_url: e.receipt_url || null,
      is_deductible: e.is_deductible === true || e.is_deductible === 1,
      deductionSettled: e.deductionSettled === true || e.deductionSettled === 1,
      settled_by: e.settled_by || null,
      settledBy: e.settledBy || null,
      settled_at: cleanDate(e.settled_at),
      settledDate: e.settledDate || null,
      source: e.source || null,
      request_id: e.request_id || null,
      created_at: cleanDate(e.created_at) || new Date().toISOString(),
      updated_at: cleanDate(e.updated_at)
    }));

    if (expenses.length > 0) {
        const { error } = await supabase.from('expenses').upsert(expenses);
        if (error) throw error;
        console.log(`✅ Migrated ${expenses.length} expenses.`);
    }

    // ------------------------------------
    // 4. Migrate Salary Advances
    // ------------------------------------
    console.log("Migrating Salary Advances...");
    const advSnap = await fbDb.ref('salary_advances').once('value');
    const advances = snapshotToArray(advSnap).map(a => ({
      id: a.id,
      rider_id: a.rider_id ? parseInt(a.rider_id) : null,
      rider_name: a.rider_name || null,
      amount: a.amount || 0,
      notes: a.notes || null,
      status: a.status || 'pending',
      category: a.category || null,
      description: a.description || null,
      deductionSettled: a.deductionSettled === true || a.deductionSettled === 1,
      settled_by: a.settled_by || null,
      settledBy: a.settledBy || null,
      settled_at: cleanDate(a.settled_at),
      settledDate: a.settledDate || null,
      cycle_start: a.cycle_start || null,
      cycle_end: a.cycle_end || null,
      source: a.source || null,
      request_id: a.request_id || null,
      admin_note: a.admin_note || null,
      processed_by: a.processed_by || null,
      created_at: cleanDate(a.created_at) || new Date().toISOString(),
      updated_at: cleanDate(a.updated_at)
    }));

    if (advances.length > 0) {
        const { error } = await supabase.from('salary_advances').upsert(advances);
        if (error) throw error;
        console.log(`✅ Migrated ${advances.length} salary advances.`);
    }

    // ------------------------------------
    // 5. Migrate Bonuses
    // ------------------------------------
    console.log("Migrating Bonuses...");
    const bonusSnap = await fbDb.ref('bonuses').once('value');
    const bonuses = snapshotToArray(bonusSnap).map(b => ({
      id: b.id,
      rider_id: b.rider_id ? parseInt(b.rider_id) : null,
      rider_name: b.rider_name || null,
      amount: b.amount || 0,
      reason: b.reason || null,
      notes: b.notes || null,
      created_at: cleanDate(b.created_at) || new Date().toISOString()
    }));

    if (bonuses.length > 0) {
        const { error } = await supabase.from('bonuses').upsert(bonuses);
        if (error) throw error;
        console.log(`✅ Migrated ${bonuses.length} bonuses.`);
    }

    // ------------------------------------
    // 6. Migrate Company Funds
    // ------------------------------------
    console.log("Migrating Company Funds...");
    const fundsSnap = await fbDb.ref('company_funds').once('value');
    const funds = snapshotToArray(fundsSnap).map(f => ({
      id: f.id,
      amount: f.amount || 0,
      source: f.source || null,
      receive_date: f.receive_date || null,
      notes: f.notes || null,
      created_at: cleanDate(f.created_at) || new Date().toISOString(),
      updated_at: cleanDate(f.updated_at)
    }));

    if (funds.length > 0) {
        const { error } = await supabase.from('company_funds').upsert(funds);
        if (error) throw error;
        console.log(`✅ Migrated ${funds.length} company funds.`);
    }

    // Helper to sanitize IDs to fit in 32-bit INT (max 2,147,483,647)
    // If an ID exceeds this, we let Supabase auto-generate a new one to prevent crashes.
    const safeId = (id) => {
        if (!id) return undefined;
        if (typeof id === 'number' && id > 2147483647) return undefined;
        return id;
    };

    // ------------------------------------
    // 7. Migrate Bikes
    // ------------------------------------
    console.log("Migrating Bikes...");
    const bikesSnap = await fbDb.ref('bikes').once('value');
    const bikes = snapshotToArray(bikesSnap).map(b => {
      const bData = {
        plate_number: b.plate_number || null,
        model: b.model || null,
        year: b.year || null,
        color: b.color || null,
        insurance_expiry: b.insurance_expiry || null,
        istimara_expiry: b.istimara_expiry || null,
        status: b.status || 'available',
        assigned_rider_id: b.assigned_rider_id ? parseInt(b.assigned_rider_id) : null,
        assigned_rider_name: b.assigned_rider_name || null,
        notes: b.notes || null,
        created_at: cleanDate(b.created_at) || new Date().toISOString(),
        updated_at: cleanDate(b.updated_at) || new Date().toISOString()
      };
      if (safeId(b.id)) bData.id = b.id;
      return bData;
    });

    if (bikes.length > 0) {
        const { error } = await supabase.from('bikes').upsert(bikes);
        if (error) throw error;
        console.log(`✅ Migrated ${bikes.length} bikes.`);
    }

    // ------------------------------------
    // 8. Migrate Rider Requests
    // ------------------------------------
    console.log("Migrating Rider Requests...");
    const requestsSnap = await fbDb.ref('rider_requests').once('value');
    const requests = snapshotToArray(requestsSnap).map(r => {
      const rData = {
        rider_id: r.rider_id ? parseInt(r.rider_id) : null,
        rider_name: r.rider_name || null,
        category: r.category || null,
        amount: r.amount || 0,
        description: r.description || null,
        status: r.status || 'pending',
        admin_note: r.admin_note || null,
        processed_by: r.processed_by || null,
        created_at: cleanDate(r.created_at) || new Date().toISOString(),
        updated_at: cleanDate(r.updated_at) || new Date().toISOString()
      };
      if (safeId(r.id)) rData.id = r.id;
      return rData;
    });

    if (requests.length > 0) {
        const { error } = await supabase.from('rider_requests').upsert(requests);
        if (error) throw error;
        console.log(`✅ Migrated ${requests.length} rider requests.`);
    }

    // ------------------------------------
    // 9. Migrate Notifications
    // ------------------------------------
    console.log("Migrating Notifications...");
    const notifsSnap = await fbDb.ref('notifications').once('value');
    const notifications = snapshotToArray(notifsSnap).map(n => {
      const nData = {
        rider_id: n.rider_id ? parseInt(n.rider_id) : null,
        type: n.type || null,
        title: n.title || null,
        message: n.message || null,
        read: n.read || false,
        read_at: cleanDate(n.read_at),
        processed_by_name: n.processed_by_name || null,
        processed_by_photo: n.processed_by_photo || null,
        created_at: cleanDate(n.created_at) || new Date().toISOString()
      };
      if (safeId(n.id)) nData.id = n.id;
      return nData;
    });

    if (notifications.length > 0) {
        const { error } = await supabase.from('notifications').upsert(notifications);
        if (error) throw error;
        console.log(`✅ Migrated ${notifications.length} notifications.`);
    }

    // ------------------------------------
    // 10. Migrate Payment Statuses
    // ------------------------------------
    console.log("Migrating Payment Statuses...");
    const psSnap = await fbDb.ref('payment_status').once('value');
    const paymentStatuses = [];
    if (psSnap.exists()) {
        psSnap.forEach(cycleSnap => {
            const cycleKey = cycleSnap.key;
            cycleSnap.forEach(riderSnap => {
                const riderId = riderSnap.key;
                const ps = riderSnap.val();
                paymentStatuses.push({
                    cycle_key: cycleKey,
                    rider_id: riderId,
                    status: ps.status || 'pending',
                    final_paid_amount: ps.final_paid_amount || null,
                    notes: ps.notes || null,
                    manual_deductions: ps.manual_deductions || 0,
                    manual_bonus: ps.manual_bonus || 0,
                    updated_at: cleanDate(ps.updated_at) || new Date().toISOString()
                });
            });
        });
    }

    if (paymentStatuses.length > 0) {
        const { error } = await supabase.from('payment_status').upsert(paymentStatuses, { onConflict: 'cycle_key, rider_id', ignoreDuplicates: true });
        if (error) throw error;
        console.log(`✅ Migrated ${paymentStatuses.length} payment statuses.`);
    }

    // ------------------------------------
    // 11. Migrate Payroll Locks
    // ------------------------------------
    console.log("Migrating Payroll Locks...");
    const locksSnap = await fbDb.ref('payroll_locks').once('value');
    const locks = [];
    if (locksSnap.exists()) {
        locksSnap.forEach(snap => {
            locks.push({
                cycle_key: snap.key,
                locked: snap.val().locked || false,
                locked_at: cleanDate(snap.val().locked_at) || new Date().toISOString()
            });
        });
    }

    if (locks.length > 0) {
        const { error } = await supabase.from('payroll_locks').upsert(locks);
        if (error) throw error;
        console.log(`✅ Migrated ${locks.length} payroll locks.`);
    }

    // ------------------------------------
    // 12. Migrate Admin Profiles
    // ------------------------------------
    console.log("Migrating Admin Profiles...");
    const adminsSnap = await fbDb.ref('admin_profiles').once('value');
    const admins = [];
    if (adminsSnap.exists()) {
        adminsSnap.forEach(snap => {
            admins.push({
                email_key: snap.key,
                name: snap.val().name || null,
                email: snap.val().email || null,
                role: snap.val().role || 'admin',
                photo_url: snap.val().photo_url || null,
                updated_at: cleanDate(snap.val().updated_at) || new Date().toISOString()
            });
        });
    }

    if (admins.length > 0) {
        const { error } = await supabase.from('admin_profiles').upsert(admins);
        if (error) throw error;
        console.log(`✅ Migrated ${admins.length} admin profiles.`);
    }

    // ------------------------------------
    // 13. Fix Sequences
    // ------------------------------------
    console.log("Resetting PostgreSQL sequences...");
    const tables = ['riders', 'daily_logs', 'expenses', 'salary_advances', 'bonuses', 'company_funds', 'bikes', 'rider_requests', 'notifications'];
    for (const table of tables) {
        const { error } = await supabase.rpc('reset_sequence', { table_name: table });
        // It's okay if this RPC doesn't exist yet, we will just warn
        if (error) {
            // We can do this manually by executing SQL via API, but REST doesn't support DO blocks easily.
            console.log(`⚠️ Sequence reset skipped for ${table} (will require manual adjustment or auto-increment will fail on new inserts)`);
        }
    }

    console.log("🎉 Migration completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
