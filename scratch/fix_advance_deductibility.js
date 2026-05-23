/**
 * One-time fix: Correct advance expenses from rider requests
 * Uses the project's database.js module which reads env from Vercel env vars
 */

// Load .env manually
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const db = require('../database');

async function fix() {
  await db.initDb();
  const supabase = db.getDb();
  
  console.log('=== Starting Advance Deductibility Fix ===\n');

  // 1. Fix advance expenses to is_deductible=true
  console.log('Step 1: Fixing advance expenses to is_deductible=true...');
  const { data: wrongExpenses, error: e1 } = await supabase
    .from('expenses')
    .select('*')
    .eq('source', 'rider_request')
    .eq('category', 'Advance')
    .eq('is_deductible', false);

  if (e1) { console.error('Error:', e1); return; }
  console.log(`  Found ${(wrongExpenses || []).length} advance expenses with is_deductible=false`);

  for (const exp of (wrongExpenses || [])) {
    console.log(`  → Fixing expense #${exp.id}: ${exp.rider_name} - ${exp.amount} SAR`);
    const { error } = await supabase.from('expenses').update({
      is_deductible: true,
      updated_at: new Date().toISOString()
    }).eq('id', exp.id);
    if (error) console.error(`  Error fixing expense #${exp.id}:`, error);
    else console.log(`  ✅ Fixed expense #${exp.id}`);
  }

  // 2. Remove duplicate salary_advances from rider requests
  console.log('\nStep 2: Removing duplicate salary_advances from rider requests...');
  const { data: dupAdvances, error: e2 } = await supabase
    .from('salary_advances')
    .select('*')
    .eq('source', 'rider_request');

  if (e2) { console.error('Error:', e2); return; }
  console.log(`  Found ${(dupAdvances || []).length} salary_advances from rider requests`);

  for (const adv of (dupAdvances || [])) {
    const { data: matchingExpense } = await supabase
      .from('expenses')
      .select('id')
      .eq('source', 'rider_request')
      .eq('request_id', adv.request_id)
      .limit(1);
    
    if (matchingExpense && matchingExpense.length > 0) {
      console.log(`  → Removing salary_advance #${adv.id}: ${adv.rider_name} - ${adv.amount} SAR`);
      const { error } = await supabase.from('salary_advances').delete().eq('id', adv.id);
      if (error) console.error(`  Error:`, error);
      else console.log(`  ✅ Removed`);
    } else {
      console.log(`  ⚠️ Skipping advance #${adv.id}: no matching expense`);
    }
  }

  // 3. Check Dipak Turi duplicates
  console.log('\nStep 3: Checking Dipak Turi food expenses...');
  const { data: dipakExpenses, error: e3 } = await supabase
    .from('expenses')
    .select('*')
    .ilike('rider_name', '%Dipak%')
    .eq('category', 'Food');

  if (e3) { console.error('Error:', e3); return; }
  console.log(`  Found ${(dipakExpenses || []).length} entries:`);
  for (const exp of (dipakExpenses || [])) {
    console.log(`    #${exp.id} | ${exp.expense_date} | ${exp.amount} SAR | source=${exp.source || 'manual'} | deductible=${exp.is_deductible}`);
  }

  const autoEntry = (dipakExpenses || []).find(e => e.source === 'rider_request');
  const manualEntries = (dipakExpenses || []).filter(e => !e.source || e.source !== 'rider_request');
  
  if (autoEntry && manualEntries.length > 0) {
    for (const manual of manualEntries) {
      if (Number(manual.amount) === Number(autoEntry.amount) && manual.expense_date === autoEntry.expense_date) {
        console.log(`  → Removing duplicate manual #${manual.id}`);
        const { error } = await supabase.from('expenses').delete().eq('id', manual.id);
        if (error) console.error(`  Error:`, error);
        else console.log(`  ✅ Removed`);
      }
    }
  }

  console.log('\n=== Fix Complete ===');
}

fix().catch(console.error);
