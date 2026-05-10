const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

async function importLogs() {
  await db.initDb();
  const filePath = path.join('C:', 'Users', 'hp', 'Downloads', 'IRL', 'IRL.xlsx');
  const wb = XLSX.readFile(filePath);

  console.log('--- Loading existing riders ---');
  const riders = db.getAllRiders();
  const riderMap = {};
  for (const r of riders) {
    riderMap[r.name] = r.id;
  }
  
  console.log('Loaded', riders.length, 'riders.');

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
    
    let dateStr = row[0];
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
    
    let year = 2026;
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
          const checkinStr = String(checkinRaw).trim();
          if (checkinStr !== '') {
              const timeParts = checkinStr.split('.');
              hrs = parseInt(timeParts[0]) || 0;
              if (timeParts.length > 1) {
                  const minStr = timeParts[1];
                  mins = parseInt(minStr);
                  if (minStr.length === 1) {
                      mins = mins * 10;
                  }
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
            // Uniqueness exception expected if re-run
        }
      }
    }
    
    if (dailyLogCount > 0) {
      console.log(`Imported ${dailyLogCount} logs for ${logDate}`);
    }
  }

  console.log('\n✅ Import completed!');
}

importLogs().catch(console.error);
