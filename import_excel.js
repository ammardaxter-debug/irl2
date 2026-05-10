const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

async function importData() {
  await db.initDb();
  const filePath = path.join('C:', 'Users', 'hp', 'Downloads', 'IRL', 'IRL.xlsx');
  const wb = XLSX.readFile(filePath);

  console.log('--- Importing Riders ---');
  const wsRiders = wb.Sheets['👤 Riders'];
  const dataRiders = XLSX.utils.sheet_to_json(wsRiders, { header: 1 });
  
  // Create a map to store name -> id mapping
  const riderMap = {};

  // Rows 4 onwards contain rider data
  for (let i = 4; i < dataRiders.length; i++) {
    const row = dataRiders[i];
    if (!row || !row[1]) continue; // Skip empty rows or those without name

    const name = row[1].trim();
    const store = row[2] ? row[2].trim() : null;
    const phone = row[3] ? String(row[3]).trim().replace(/'/g, '') : null;
    const iqama = row[4] ? String(row[4]).trim().replace(/'/g, '') : null;
    const aiban = row[7] ? String(row[7]).trim() : null;
    const stc = row[8] ? String(row[8]).trim() : null;
    
    // We assume default company rider for imported data unless we know otherwise.
    // Bank name can be inferred if aiban is used vs stc
    let bankName = null;
    let bankAccount = null;
    
    if (stc) {
      bankName = 'STC Pay';
      bankAccount = stc;
    } else if (aiban) {
      bankName = 'Other';
      bankAccount = aiban;
    }

    const riderData = {
      name: name,
      client_company: store,
      phone: phone,
      iqama_number: iqama,
      bank_name: bankName,
      bank_account: bankAccount,
      rider_type: 'company'
    };

    try {
      const createdRider = await db.createRider(riderData);
      riderMap[name] = createdRider.id;
      console.log(`Imported Rider: ${name}`);
    } catch (e) {
      console.error(`Error importing rider ${name}:`, e.message);
    }
  }

  console.log('\n--- Importing Daily Logs ---');
  const wsLogs = wb.Sheets['📦 Daily Logs'];
  const dataLogs = XLSX.utils.sheet_to_json(wsLogs, { header: 1 });
  
  // Row index 1 has rider names
  const headerRow = dataLogs[1];
  if (!headerRow) {
    console.error('Could not find header row in Daily Logs');
    process.exit(1);
  }

  // Find column indices for each rider
  const riderCols = [];
  for (let col = 1; col < headerRow.length; col += 3) {
    const riderName = headerRow[col];
    if (riderName && typeof riderName === 'string' && riderName.trim() !== '' && riderName !== '📊 Daily\nTotal') {
      riderCols.push({ name: riderName.trim(), colIndex: col });
    }
  }
  
  // Process dates
  for (let i = 3; i < dataLogs.length; i++) {
    const row = dataLogs[i];
    if (!row || !row[0]) continue;
    
    let dateStr = row[0]; // e.g., "21 Mar  Sat"
    if (typeof dateStr !== 'string') continue;
    
    // Convert to YYYY-MM-DD
    const parts = dateStr.replace(/\s+/g, ' ').split(' ');
    if (parts.length < 2) continue;
    
    const day = parts[0];
    const monthStr = parts[1];
    
    // Map month to number
    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
    const month = months[monthStr];
    
    if (month === undefined) continue;
    
    // Using 2026 as default year from context
    const d = new Date(2026, month, parseInt(day));
    // Check if it's a valid date
    if (isNaN(d.getTime())) continue;

    // Adjust year correctly based on month logic to handle year end (e.g. Dec -> Jan flip)
    let year = 2026;
    if (month > 6) { // Just a heuristic in case it started past mid year, though dashboard shows Mar-Apr 2026
        // Let's assume year 2026 is correct for all
    }
    
    const dIso = new Date(year, month, parseInt(day));
    
    // Offset local timezone issue by grabbing parts directly
    const logDate = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    
    let dailyLogCount = 0;
    
    for (const r of riderCols) {
      const riderId = riderMap[r.name];
      if (!riderId) continue;
      
      const primary = parseInt(row[r.colIndex]) || 0;
      const assoc = parseInt(row[r.colIndex + 1]) || 0;
      let checkinRaw = row[r.colIndex + 2];
      
      let hrs = 0;
      let mins = 0;
      if (checkinRaw !== null && checkinRaw !== undefined) {
          const checkinStr = String(checkinRaw);
          const timeParts = checkinStr.split('.');
          hrs = parseInt(timeParts[0]) || 0;
          if (timeParts.length > 1) {
              mins = parseInt(timeParts[1]);
              // Decimal fraction like 11.5 could mean 11 hrs 50 mins or 11.5 hours = 11h 30m?
              // The screenshot and excel says 11.03, 11.47 -> these seem to be Hours.Minutes
              // e.g. 11.47 is 11 hours 47 mins
              if (timeParts[1].length === 1) {
                  // e.g. 11.5 -> 11 hrs, 50 mins
                  mins = mins * 10;
              }
          }
      }
      
      if (primary > 0 || assoc > 0 || hrs > 0 || mins > 0) {
        try {
          await db.createDailyLog({
            rider_id: riderId,
            log_date: logDate,
            primary_orders: primary,
            associate_orders: assoc,
            checkin_hours: hrs,
            checkin_minutes: mins
          });
          dailyLogCount++;
        } catch (err) {
            // Ignore unique constraints in case it's run twice
        }
      }
    }
    
    if (dailyLogCount > 0) {
      console.log(`Imported ${dailyLogCount} logs for ${logDate}`);
    }
  }

  console.log('\n✅ Import completed!');
}

importData().catch(console.error);
