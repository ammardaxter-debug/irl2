const XLSX = require('xlsx');
const path = require('path');
const db = require('./database');

async function importExpenses() {
  await db.initDb();
  const filePath = 'C:\\Users\\hp\\Downloads\\Expense Tracker\\IRL Expense Tracker (1).xlsx';
  const wb = XLSX.readFile(filePath);

  console.log('--- Cleaning Up Old Expense Data ---');
  const sqliteDb = db.getDb();
  sqliteDb.run("DELETE FROM company_funds");
  sqliteDb.run("DELETE FROM expenses");

  const riders = db.getAllRiders();
  
  // Name mapping helper
  const findRider = (name) => {
    if (!name) return null;
    const clean = name.toLowerCase().trim();
    
    // Exact match
    let match = riders.find(r => r.name.toLowerCase().trim() === clean);
    if (match) return match;
    
    // Partial match (e.g. "Ashraful Islam" -> "MD Ashraful Islam")
    match = riders.find(r => r.name.toLowerCase().includes(clean) || clean.includes(r.name.toLowerCase()));
    if (match) return match;

    // Special case aliases
    if (clean === 'ashraf ul islam' || clean === 'ashraful islam') return riders.find(r => r.name.includes('Ashraful'));
    if (clean === 'sajjad') return riders.find(r => r.name.includes('SAJJAD'));
    if (clean === 'dipak') return riders.find(r => r.name.includes('Dipak'));
    if (clean === 'azhar') return riders.find(r => r.name === 'AZHAR');
    if (clean === 'shabir') return riders.find(r => r.name.includes('Shabir'));
    if (clean === 'afaq') return riders.find(r => r.name.includes('Afaq'));
    if (clean === 'majid') return riders.find(r => r.name.includes('Majid'));
    if (clean === 'samsul') return riders.find(r => r.name.includes('Samsul'));
    if (clean === 'sojib') return riders.find(r => r.name.includes('Sojib'));
    
    return null;
  };

  const monthSheets = ['April 2026']; // Add more if they exist and are useful
  
  for (const sheetName of monthSheets) {
    console.log(`\nImporting Sheet: ${sheetName}`);
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // 1. Process Funds Received (Starts around row 10 in April)
    // Finding header row for funds
    let fundsStartRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i] && data[i][0] === 'Date' && (data[i][1] || '').includes('Description')) {
        fundsStartRow = i + 1;
        break;
      }
    }

    if (fundsStartRow !== -1) {
      console.log(`Processing Funds starting at row ${fundsStartRow + 1}`);
      for (let i = fundsStartRow; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0] || row[0] === 'TOTAL RECEIVED FROM IRL') break;
        if (typeof row[0] !== 'number' && isNaN(Date.parse(row[0]))) continue;
        
        let dateVal = row[0];
        if (typeof dateVal === 'number') {
           // Excel serial date to YYYY-MM-DD
           const date = new Date((dateVal - 25569) * 86400 * 1000);
           dateVal = date.toISOString().split('T')[0];
        }

        db.createFund({
          receive_date: dateVal,
          amount: parseFloat(row[4]) || 0,
          description: row[1] || 'IRL Transfer',
          notes: row[5] || null
        });
      }
    }

    // 2. Process Expenses (Starts around row 24 in April)
    let expStartRow = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i][0] === 'Date' && (data[i][1] || '').includes('Recipient')) {
          expStartRow = i + 1;
          break;
        }
    }

    if (expStartRow !== -1) {
       console.log(`Processing Expenses starting at row ${expStartRow + 1}`);
       for (let i = expStartRow; i < data.length; i++) {
         const row = data[i];
         if (!row || !row[0] || (typeof row[0] === 'string' && row[0].includes('TOTAL'))) break;
         
         let dateVal = row[0];
         if (typeof dateVal === 'number') {
            const date = new Date((dateVal - 25569) * 86400 * 1000);
            dateVal = date.toISOString().split('T')[0];
         }
         
         const name = row[1];
         const category = row[2];
         const amount = parseFloat(row[4]) || 0;
         const source = row[3] || 'IRL Funds';
         const notes = row[5] || null;

         const rider = findRider(name);
         const isDeductible = (category === 'Advance' || category === 'Food' || category === 'Cash Relay');

         db.createExpense({
           expense_date: dateVal,
           rider_id: rider ? rider.id : null,
           vendor_name: rider ? null : name,
           category: category,
           amount: amount,
           source: source,
           is_deductible: isDeductible,
           notes: notes
         });
       }
    }
  }

  console.log('\n✅ Expense & Funds Import Completed!');
}

importExpenses().catch(console.error);
