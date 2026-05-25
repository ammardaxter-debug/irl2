const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../database');

async function runMigration() {
  console.log('🔄 Starting Base64 to Supabase Storage Migration...');
  
  await db.initDb();
  const supabase = db.getDb();
  
  // 1. Migrate riders profile pictures
  console.log('\n👤 Migrating rider profile pictures...');
  const riders = await db.getAllRiders('all');
  console.log(`Found ${riders.length} riders to inspect.`);
  for (const rider of riders) {
    if (rider.profile_photo && rider.profile_photo.startsWith('data:image')) {
      console.log(`  Updating profile photo for rider: ${rider.name} (ID: ${rider.id})...`);
      try {
        await db.updateRider(rider.id, { profile_photo: rider.profile_photo });
        console.log(`  ✅ Profile photo migrated!`);
      } catch (err) {
        console.error(`  ❌ Failed to migrate profile photo for ${rider.name}:`, err.message);
      }
    }
  }

  // 2. Migrate daily logs screenshots
  console.log('\n📝 Migrating daily logs screenshots...');
  const { data: logs, error: logsErr } = await supabase
    .from('daily_logs')
    .select('id, rider_id, screenshot, log_date')
    .like('screenshot', 'data:image%');
    
  if (logsErr) {
    console.error('Error fetching logs:', logsErr.message);
  } else {
    console.log(`Found ${logs.length} logs with base64 screenshots.`);
    for (const log of logs) {
      console.log(`  Uploading screenshot for log ID ${log.id} (Rider: ${log.rider_id}, Date: ${log.log_date})...`);
      try {
        await db.updateDailyLog(log.id, { screenshot: log.screenshot });
        console.log(`  ✅ Log screenshot migrated!`);
      } catch (err) {
        console.error(`  ❌ Failed to migrate log ${log.id}:`, err.message);
      }
    }
  }

  // 3. Migrate expenses receipts
  console.log('\n💵 Migrating expenses receipts...');
  const { data: expenses, error: expErr } = await supabase
    .from('expenses')
    .select('id, rider_id, receipt_url')
    .like('receipt_url', 'data:image%');

  if (expErr) {
    console.error('Error fetching expenses:', expErr.message);
  } else {
    console.log(`Found ${expenses.length} expenses with base64 receipts.`);
    for (const exp of expenses) {
      console.log(`  Uploading receipt for expense ID ${exp.id} (Rider: ${exp.rider_id})...`);
      try {
        await db.updateExpense(exp.id, { receipt_base64: exp.receipt_url });
        console.log(`  ✅ Expense receipt migrated!`);
      } catch (err) {
        console.error(`  ❌ Failed to migrate expense ${exp.id}:`, err.message);
      }
    }
  }

  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
