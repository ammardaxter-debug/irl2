const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

async function runImport() {
  await db.initDb();
  const filePath = path.join('C:', 'Users', 'hp', 'Downloads', 'IRL', 'IRL.xlsx');
  const wb = XLSX.readFile(filePath);

  console.log('--- Cleaning Up Old Data ---');
  // 1. Add store_warehouse column if not exists, and delete test riders
  console.log('Updating riders schema and cleaning test users...');
  const sqliteDb = db.getDb();
  try { sqliteDb.run("ALTER TABLE riders ADD COLUMN store_warehouse TEXT"); } catch(e) { }
  sqliteDb.run("DELETE FROM riders WHERE name IN ('Test', 'Ahmed Khan', 'Mohammed Ali')");
  
  // 2. Refresh schema
  console.log('Drop and recreate daily logs schema for the new column...');
  sqliteDb.run("DROP TABLE IF EXISTS payroll"); // Foreign key on riders, safe to wipe
  sqliteDb.run("DROP TABLE IF EXISTS daily_logs");
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rider_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      primary_orders INTEGER DEFAULT 0,
      associate_orders INTEGER DEFAULT 0,
      checkin_hours INTEGER DEFAULT 0,
      checkin_minutes INTEGER DEFAULT 0,
      attendance_status TEXT DEFAULT 'Present',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (rider_id) REFERENCES riders(id),
      UNIQUE(rider_id, log_date)
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rider_id INTEGER NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      total_primary_orders INTEGER DEFAULT 0,
      total_associate_orders INTEGER DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      present_days INTEGER DEFAULT 0,
      avg_checkin_hours REAL DEFAULT 0,
      base_salary REAL DEFAULT 0,
      calculated_salary REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (rider_id) REFERENCES riders(id),
      UNIQUE(rider_id, period_start, period_end)
    )
  `);

  // Save the state after manual db.run schema changes
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'data', 'inspiring_roads.db'), Buffer.from(sqliteDb.export()));

  // Load riders
  const dbRiders = db.getAllRiders();
  const riderMap = {};
  for (const r of dbRiders) {
    riderMap[r.name.trim()] = r.id;
  }
  
  console.log(`Loaded ${Object.keys(riderMap).length} valid riders.`);

  const wsAtt = wb.Sheets['📅 Attendance'];
  const wsLogs = wb.Sheets['📦 Daily Logs'];
  const dataAtt = XLSX.utils.sheet_to_json(wsAtt, { header: 1 });
  const dataLogs = XLSX.utils.sheet_to_json(wsLogs, { header: 1 });

  let logHeader = null;
  let logHeaderRowIdx = -1;
  for (let r = 0; r < 20; r++) {
    if (dataLogs[r] && typeof dataLogs[r][1] === 'string' && dataLogs[r][1].includes('Rider Name')) {
      logHeader = dataLogs[r];
      logHeaderRowIdx = r;
      break;
    } else if (dataLogs[r] && dataLogs[r].some(cell => typeof cell === 'string' && cell.includes('Ali Hassan'))) {
      // Sometimes headers are missing, we just find the row before it
      logHeader = dataLogs[r-1];
      logHeaderRowIdx = r-1;
      break;
    }
  }

  // Actually, wait, Daily Logs header has rider names directly in columns like col 1, col 4, etc.
  // The first row might not say "Rider Name". My previous script worked by just taking dataLogs[1].
  // Let me just find the row that has rider names in it.
  for (let r = 0; r < 20; r++) {
    if (dataLogs[r]) {
      const isRiderRow = dataLogs[r].some(val => typeof val === 'string' && riderMap[val.trim()] !== undefined);
      if (isRiderRow) {
        logHeader = dataLogs[r];
        logHeaderRowIdx = r;
        break;
      }
    }
  }

  if (!logHeader) {
     console.error('Could not find log header row');
     process.exit(1);
  }

  const logsColMap = {};
  for (let col = 1; col < logHeader.length; col++) {
    const rName = logHeader[col];
    if (rName && typeof rName === 'string' && rName.trim() !== '' && rName !== '📊 Daily\nTotal') {
      logsColMap[rName.trim()] = col; // e.g col 1, next is col 4
    }
  }

  // Parse Attendance dates dynamically
  let attHeaderRowIdx = -1;
  let dateRow = null;
  for (let r = 0; r < 20; r++) {
    if (dataAtt[r] && dataAtt[r][1] === 'Rider Name') {
      dateRow = dataAtt[r];
      attHeaderRowIdx = r;
      break;
    }
  }

  if (!dateRow) {
    console.error('Could not find attendance header row');
    process.exit(1);
  }

  const dateMap = {}; // ColIndex -> Date (YYYY-MM-DD)

  
  for (let c = 3; c < dateRow.length; c++) {
    const val = dateRow[c];
    if (typeof val === 'string' && val.includes('\n')) {
      const parts = val.replace(/\n/g, ' ').trim().split(' ');
      const day = parseInt(parts[0]);
      if (isNaN(day)) break;
      const monthStr = parts[1];
      const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
      const mIdx = months[monthStr];
      if (mIdx !== undefined) {
        const year = 2026;
        const logDate = `${year}-${String(mIdx+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        dateMap[c] = logDate;
      }
    }
  }

  console.log('--- Processing Attendance & Logs ---');
  let totalImported = 0;
  const dataStartRow = attHeaderRowIdx + 1;

  for (let i = dataStartRow; i < dataAtt.length; i++) {
    const row = dataAtt[i];
    if (!row || !row[1]) continue;
    
    let riderName = row[1];
    if (typeof riderName !== 'string') continue;
    riderName = riderName.trim();
    
    const riderId = riderMap[riderName];
    if (!riderId) {
      console.warn(`Warning: Rider "${riderName}" not found in DB!`);
      continue;
    }

    const storeName = row[2];
    if (storeName && storeName !== 'Store') {
       sqliteDb.run('UPDATE riders SET client_company = "Noon Minutes", store_warehouse = ? WHERE id = ?', [storeName, riderId]);
    }

    const logColIdx = logsColMap[riderName];

    // For this rider, loop through dates
    for (const colIdx of Object.keys(dateMap)) {
      const logDate = dateMap[colIdx];
      const attVal = row[colIdx];
      
      if (!attVal) continue; // blank means not entered
      
      let statusStr = String(attVal).trim();
      let status = 'Present'; // default
      if (statusStr.includes('Absent')) status = 'Absent';
      else if (statusStr.includes('Week Off') || statusStr.includes('Wk Off')) status = 'Week Off';
      else if (statusStr.includes('Leave')) status = 'Leave';
      
      let primary = 0;
      let assoc = 0;
      let hrs = 0;
      let mins = 0;
      
      // If present, fetch stats from dataLogs
      if (status === 'Present' && logColIdx !== undefined) {
        // Find row in dataLogs matching logDate
        for (let r = logHeaderRowIdx + 2; r < dataLogs.length; r++) {
          const lRow = dataLogs[r];
          if (!lRow || !lRow[0]) continue;
          
          let lDateStr = String(lRow[0]).replace(/\s+/g, ' ').trim();
          let expectedStr = '';
          const parts = logDate.split('-');
          const monthsRev = { '01':'Jan', '02':'Feb', '03':'Mar', '04':'Apr', '05':'May', '06':'Jun', '07':'Jul', '08':'Aug', '09':'Sep', '10':'Oct', '11':'Nov', '12':'Dec'};
          expectedStr = `${parseInt(parts[2])} ${monthsRev[parts[1]]}`;
          
          if (lDateStr.startsWith(expectedStr) || lDateStr.startsWith(`${parts[2]} ${monthsRev[parts[1]]}`) || lDateStr.startsWith(`${String(parts[2]).padStart(2,'0')} ${monthsRev[parts[1]]}`)) {
            primary = parseInt(lRow[logColIdx]) || 0;
            assoc = parseInt(lRow[logColIdx + 1]) || 0;
            const checkinRaw = lRow[logColIdx + 2];
            
            if (checkinRaw != null && checkinRaw !== '') {
              const strTime = String(checkinRaw).trim();
              const timeParts = strTime.split('.');
              hrs = parseInt(timeParts[0]) || 0;
              if (timeParts.length > 1) {
                  let minP = timeParts[1];
                  mins = parseInt(minP);
                  if (minP.length === 1) mins *= 10;
              }
            }
            break; // found date
          }
        }
      }

      // Insert log
      try {
        await db.createDailyLog({
          rider_id: riderId,
          log_date: logDate,
          attendance_status: status,
          primary_orders: primary,
          associate_orders: assoc,
          checkin_hours: hrs,
          checkin_minutes: mins
        });
        totalImported++;
      } catch (err) {
        // Unique constraint violation (shouldn't happen on fresh DB)
      }
    }
  }

  console.log(`\n✅ Import completed! Total Logs created: ${totalImported}`);
}

runImport().catch(console.error);
