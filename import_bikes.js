const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

const data = JSON.parse(fs.readFileSync('excel_dump.json', 'utf8'));

// Start of data rows
const dataRows = data.slice(24);

async function importBikes() {
  console.log(`Found ${dataRows.length} bikes in the excel dump. Commencing import...`);
  const bikesRef = db.ref('bikes');
  
  // Clear existing bikes to avoid duplicates for now (assuming clean slate for fleet)
  await bikesRef.remove();
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length < 20) continue; // Skip empty rows

    const plate = row[0]; // e.g. "د أ 7733"
    const brand = row[3]; // "بجاج بوكسر"
    const typeModel = row[4];
    const year = row[5];
    const vin = row[7];
    const color = row[8];
    const regExpiryHijri = row[11];
    const insStatus = row[16];
    const regStartHijri = row[18];

    // Combine for a nice model display
    const finalModel = `${brand} (${year}) - ${color}`;

    // Convert rough Hijri to Gregorian for our tracking (1447 -> 2026)
    let insStart = null;
    let insExpiry = null;
    
    if (regStartHijri && regStartHijri !== '-') {
      const [y, m, d] = regStartHijri.split('-');
      const gYear = parseInt(y) - 1447 + 2026;
      insStart = `${gYear}-${m}-${d}`;
    }
    
    if (regExpiryHijri && regExpiryHijri !== '-') {
      const [y, m, d] = regExpiryHijri.split('-');
      const gYear = parseInt(y) - 1447 + 2026;
      insExpiry = `${gYear}-${m}-${d}`;
    }

    const newId = Date.now() + i; // unique ID
    
    const bikeData = {
      plate_number: plate,
      model: finalModel,
      status: 'active', // Default to active since they are on the "valid" list
      insurance_start: insStart,
      insurance_expiry: insExpiry,
      notes: `VIN: ${vin} | Insurance: ${insStatus}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await bikesRef.child(newId.toString()).set(bikeData);
    console.log(`Imported: ${plate}`);
  }

  console.log('✅ Import complete!');
  process.exit(0);
}

importBikes().catch(err => {
  console.error("Error importing:", err);
  process.exit(1);
});
