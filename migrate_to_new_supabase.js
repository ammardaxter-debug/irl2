/**
 * Migration Script v2: Handles large base64 fields and timeouts
 * - Uses batch size of 50 for large tables
 * - Strips screenshot/profile_photo from initial import (too large)
 * - Imports remaining tables after daily_logs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const NEW_URL = 'https://nbkummtlzmbrkfziohwk.supabase.co';
const NEW_KEY = 'sb_secret_R0igamaumuJ4UNA61LZGXA_k9SKuENR';

const supabase = createClient(NEW_URL, NEW_KEY);
const CSV_DIR = 'C:\\Users\\hp\\OneDrive\\Documents\\Supabase data';

// ─── CSV PARSER ───
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'; i += 2; continue;
        } else { inQuotes = false; i++; continue; }
      } else { currentField += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { currentRow.push(currentField); currentField = ''; i++; }
      else if (ch === '\r') { i++; }
      else if (ch === '\n') {
        currentRow.push(currentField); currentField = '';
        if (currentRow.length > 0 && currentRow.some(f => f.trim() !== '')) rows.push(currentRow);
        currentRow = []; i++;
      } else { currentField += ch; i++; }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some(f => f.trim() !== '')) rows.push(currentRow);
  }
  return rows;
}

function loadCSV(filename, skipCols = []) {
  const filePath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filePath)) { console.log(`  ⚠️ Not found: ${filename}`); return null; }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(raw);
  if (rows.length < 2) { console.log(`  ⚠️ ${filename} empty.`); return null; }
  const headers = rows[0].map(h => h.trim());
  const skipSet = new Set(skipCols);
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (skipSet.has(h)) return;
      let val = row[idx] !== undefined ? row[idx].trim() : '';
      if (val === '') val = null;
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      obj[h] = val;
    });
    return obj;
  });
  return data;
}

async function importTable(tableName, csvFile, options = {}) {
  const { conflictKey = 'id', batchSize = 200, skipCols = [], skipIfDone = false } = options;
  
  console.log(`\n📦 Importing ${tableName}...`);
  
  // Check if already imported
  if (skipIfDone) {
    const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (count && count > 0) {
      console.log(`   ⏭️ Already has ${count} rows, skipping.`);
      return;
    }
  }
  
  const data = loadCSV(csvFile, skipCols);
  if (!data) return;
  
  console.log(`   ${data.length} rows from ${csvFile} (batch size: ${batchSize})`);
  
  let inserted = 0, errors = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    try {
      const { error } = await supabase.from(tableName).upsert(batch, { 
        onConflict: conflictKey, ignoreDuplicates: true 
      });
      
      if (error) {
        console.log(`   ⚠️ Batch ${batchNum} error: ${error.message.substring(0, 100)}`);
        // Retry in smaller chunks of 10
        for (let j = 0; j < batch.length; j += 10) {
          const mini = batch.slice(j, j + 10);
          const { error: e2 } = await supabase.from(tableName).upsert(mini, {
            onConflict: conflictKey, ignoreDuplicates: true
          });
          if (e2) {
            // Last resort: one by one
            for (const row of mini) {
              const { error: e3 } = await supabase.from(tableName).upsert([row], {
                onConflict: conflictKey, ignoreDuplicates: true
              });
              if (e3) { errors++; } else { inserted++; }
            }
          } else { inserted += mini.length; }
        }
      } else {
        inserted += batch.length;
      }
      process.stdout.write(`   ✅ ${batchNum}/${totalBatches} (${inserted} rows)   \r`);
    } catch (err) {
      console.log(`   ❌ Batch ${batchNum} exception: ${err.message.substring(0, 80)}`);
      errors += batch.length;
    }
  }
  console.log(`\n   ✅ ${tableName}: ${inserted} inserted, ${errors} errors`);
}

async function main() {
  console.log('═══════════════════════════════════');
  console.log('  IRL — Supabase Migration v2');
  console.log('═══════════════════════════════════\n');

  // riders, bikes, company_funds already imported — skip if done
  await importTable('riders', 'riders_rows.csv', { 
    skipIfDone: true, batchSize: 10,
    skipCols: ['profile_photo']  // huge base64, skip for now
  });
  
  await importTable('bikes', 'bikes_rows.csv', { skipIfDone: true });
  await importTable('company_funds', 'company_funds_rows.csv', { skipIfDone: true });
  
  // daily_logs — strip screenshot column (huge base64)
  await importTable('daily_logs', 'daily_logs_rows.csv', { 
    batchSize: 100, skipCols: ['screenshot'], skipIfDone: true 
  });

  await importTable('expenses', 'expenses_rows.csv', { 
    batchSize: 100, skipCols: ['receipt_url']  // may contain large base64
  });

  await importTable('rider_requests', 'rider_requests_rows.csv', { batchSize: 50 });

  // notifications — large file, small batches
  await importTable('notifications', 'notifications_rows.csv', { 
    batchSize: 100, skipCols: ['processed_by_photo'] 
  });

  await importTable('payment_status', 'payment_status_rows.csv', { batchSize: 50 });
  await importTable('admin_profiles', 'admin_profiles_rows.csv', { 
    conflictKey: 'email_key', batchSize: 10,
    skipCols: ['photo_url']  // may contain large base64
  });
  await importTable('audit_logs', 'audit_logs_rows.csv', { batchSize: 50 });
  await importTable('app_config', 'app_config_rows.csv', { conflictKey: 'key', batchSize: 10 });

  // auth_users if present
  await importTable('auth_users', 'auth_users_rows.csv', { batchSize: 10 });

  console.log('\n═══════════════════════════════════');
  console.log('  ✅ Migration Complete!');
  console.log('═══════════════════════════════════');
  console.log('\n⚠️ Run this SQL in the new Supabase SQL Editor to reset sequences:');
  console.log(`
SELECT setval('riders_id_seq', COALESCE((SELECT MAX(id) FROM riders), 0) + 1, false);
SELECT setval('daily_logs_id_seq', COALESCE((SELECT MAX(id) FROM daily_logs), 0) + 1, false);
SELECT setval('expenses_id_seq', COALESCE((SELECT MAX(id) FROM expenses), 0) + 1, false);
SELECT setval('salary_advances_id_seq', COALESCE((SELECT MAX(id) FROM salary_advances), 0) + 1, false);
SELECT setval('bonuses_id_seq', COALESCE((SELECT MAX(id) FROM bonuses), 0) + 1, false);
SELECT setval('company_funds_id_seq', COALESCE((SELECT MAX(id) FROM company_funds), 0) + 1, false);
SELECT setval('bikes_id_seq', COALESCE((SELECT MAX(id) FROM bikes), 0) + 1, false);
SELECT setval('rider_requests_id_seq', COALESCE((SELECT MAX(id) FROM rider_requests), 0) + 1, false);
SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 0) + 1, false);
SELECT setval('payment_status_id_seq', COALESCE((SELECT MAX(id) FROM payment_status), 0) + 1, false);
SELECT setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs), 0) + 1, false);
  `);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
