require('dotenv').config();
const fs = require('fs');
const db = require('./database.js'); // Assuming database.js exports updateAdminProfile

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

async function run() {
  db.initDb();
  const raw = fs.readFileSync('C:\\Users\\hp\\OneDrive\\Documents\\Supabase data\\admin_profiles_rows.csv', 'utf-8');
  const rows = parseCSV(raw);
  const headers = rows[0].map(h => h.trim());
  
  for(let i=1; i<rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx] !== undefined ? row[idx].trim() : '';
      if (val === '') val = null;
      obj[h] = val;
    });

    if (obj.photo_url && obj.photo_url.startsWith('data:image')) {
      console.log(`Uploading photo for ${obj.email_key}...`);
      await db.updateAdminProfile(obj.email_key, { photo_url: obj.photo_url });
      console.log(`Success for ${obj.email_key}`);
    }
  }
}
run();
