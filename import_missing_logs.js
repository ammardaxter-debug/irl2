const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const NEW_URL = 'https://nbkummtlzmbrkfziohwk.supabase.co';
const NEW_KEY = 'sb_secret_R0igamaumuJ4UNA61LZGXA_k9SKuENR';
const supabase = createClient(NEW_URL, NEW_KEY);
const CSV_DIR = 'C:\\Users\\hp\\OneDrive\\Documents\\Supabase data';

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

async function main() {
  console.log('Importing missing daily_logs...');
  const filePath = path.join(CSV_DIR, 'daily_logs_rows.csv');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(raw);
  
  const headers = rows[0].map(h => h.trim());
  const skipCols = new Set(['screenshot']);
  
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (skipCols.has(h)) return;
      let val = row[idx] !== undefined ? row[idx].trim() : '';
      if (val === '') val = null;
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      obj[h] = val;
    });
    return obj;
  });

  console.log(`Parsed ${data.length} total rows from CSV.`);

  let inserted = 0;
  let errors = 0;
  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from('daily_logs').upsert(batch, {
      onConflict: 'id',
      ignoreDuplicates: true
    });
    
    if (error) {
      console.log(`Batch error: ${error.message}`);
      for (const row of batch) {
        const { error: e2 } = await supabase.from('daily_logs').upsert([row], { onConflict: 'id', ignoreDuplicates: true });
        if (e2) errors++; else inserted++;
      }
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`Processed ${Math.min(i + batchSize, data.length)} / ${data.length} rows...\r`);
  }
  
  console.log(`\nMissing logs import completed. Processed ${inserted} rows (duplicates were ignored).`);
  
  // Also reset sequences again just in case
  await supabase.rpc('reset_seq'); // this might not exist, so I won't run it here.
}

main();
