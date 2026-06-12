const XLSX = require('xlsx');
const db = require('./database');

function excelDateToISOString(serial) {
  if (!serial || isNaN(serial)) return null;
  // Excel base date is Dec 30, 1899 due to leap year bug in Lotus 1-2-3
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  
  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, '0');
  const day = String(date_info.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const cleanPhone = (p) => {
  if (!p) return '';
  return String(p).replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '');
};

function namesMatch(excelName, dbName) {
  if (!excelName || !dbName) return false;
  const eNorm = excelName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const dNorm = dbName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  if (eNorm === dNorm) return true;
  
  const eParts = eNorm.split(/\s+/).filter(x => x && x !== 'md' && x !== 'muhammad');
  const dParts = dNorm.split(/\s+/).filter(x => x && x !== 'md' && x !== 'muhammad');
  
  if (eParts.length === 0 || dParts.length === 0) return false;
  
  // If all main parts of excel name are in db name or vice versa
  const allEInD = eParts.every(p => dParts.includes(p));
  const allDInE = dParts.every(p => eParts.includes(p));
  
  return allEInD || allDInE;
}

async function runImport() {
  await db.initDb();
  const supabase = db.getDb();
  
  console.log('--- Phase 1: Cleaning up database duplicates ---');
  // Delete known duplicates
  // AD 7738 has duplicates: id 22 (null) and id 30 (MD Ashraful Islam)
  // BX 7759 has duplicates: id 29 (null), id 31 (null) and id 32 (MD Ratul)
  
  const { data: beforeBikes, error: errBefore } = await supabase.from('bikes').select('*');
  if (errBefore) throw errBefore;
  
  const duplicatesToDelete = [];
  const platesSeen = {};
  
  // Custom check to ensure we keep the duplicate that has an assigned rider, or the newest one
  beforeBikes.forEach(b => {
    const p = b.plate_number;
    if (!platesSeen[p]) {
      platesSeen[p] = [b];
    } else {
      platesSeen[p].push(b);
    }
  });
  
  for (const plate in platesSeen) {
    const list = platesSeen[plate];
    if (list.length > 1) {
      console.log(`Duplicate detected for plate "${plate}":`, list.map(b => `ID: ${b.id} (Rider: ${b.assigned_rider_name || 'None'})`));
      // Sort: items with assigned_rider_id first, then higher ID first
      list.sort((a, b) => {
        if (a.assigned_rider_id && !b.assigned_rider_id) return -1;
        if (!a.assigned_rider_id && b.assigned_rider_id) return 1;
        return b.id - a.id; // Newest first
      });
      // Keep list[0], delete the rest
      const keep = list[0];
      const toDelete = list.slice(1);
      toDelete.forEach(b => {
        duplicatesToDelete.push(b.id);
        console.log(`  -> Will delete ID: ${b.id}`);
      });
    }
  }
  
  if (duplicatesToDelete.length > 0) {
    const { error: deleteErr } = await supabase.from('bikes').delete().in('id', duplicatesToDelete);
    if (deleteErr) {
      console.error('Failed to delete duplicates:', deleteErr);
    } else {
      console.log(`Successfully deleted duplicate bike IDs: ${duplicatesToDelete.join(', ')}`);
    }
  } else {
    console.log('No duplicates found/to delete.');
  }

  console.log('\n--- Phase 2: Parsing Excel file ---');
  const filePath = "C:\\Users\\hp\\Downloads\\Bike fleet\\Fleet Report (1).xlsx";
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const excelBikes = [];
  
  // Section 1: Riders Authorization Register
  let inUnassignedSection = false;
  for (let i = 12; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    if (String(row[0]).includes('UNASSIGNED')) {
      inUnassignedSection = true;
      continue;
    }
    
    if (!inUnassignedSection) {
      if (row[0] !== undefined && row[0] !== '' && typeof row[0] === 'number') {
        const name = row[1] ? String(row[1]).trim() : '';
        const phone = row[2] ? String(row[2]).trim() : '';
        const iqama = row[3] ? String(row[3]).trim() : '';
        const plate = row[4] ? String(row[4]).trim() : '';
        const authStatus = row[5] ? String(row[5]).trim() : '';
        const expirySerial = row[6];
        const notes = row[9] ? String(row[9]).trim() : '';
        const store = row[10] ? String(row[10]).trim() : '';
        
        if (plate && plate !== 'Inactive') {
          excelBikes.push({
            plate,
            assignedRiderName: name,
            riderPhone: phone,
            riderIqama: iqama,
            authStatus,
            expiryDate: excelDateToISOString(expirySerial),
            notes: notes || '',
            store
          });
        }
      }
    } else {
      // Section 2: Unassigned and Assigned
      if (row[0] !== undefined && row[0] !== '' && typeof row[0] === 'number') {
        const plate = row[1] ? String(row[1]).trim() : '';
        const authStatus = row[2] ? String(row[2]).trim() : '';
        const notes = row[3] ? String(row[3]).trim() : '';
        
        // Only add if not already in Excel list
        if (plate && !excelBikes.some(eb => eb.plate === plate)) {
          let assignedRiderName = null;
          if (notes.includes('Shoaib Akhtar')) {
            assignedRiderName = 'Shoaib Akhtar';
          } else if (notes.includes('Qayum freelancer')) {
            assignedRiderName = 'Qayum freelancer';
          }
          
          excelBikes.push({
            plate,
            assignedRiderName,
            riderPhone: '',
            riderIqama: '',
            authStatus,
            expiryDate: null,
            notes: notes || '',
            store: ''
          });
        }
      }
    }
  }
  
  console.log(`Found ${excelBikes.length} unique bikes to upsert/sync.`);
  
  console.log('\n--- Phase 3: Fetching current state ---');
  const dbRiders = await db.getAllRiders('all');
  const dbBikes = await db.getAllBikes();
  
  console.log(`Database has ${dbRiders.length} riders and ${dbBikes.length} bikes currently.`);
  
  console.log('\n--- Phase 4: Syncing bikes and assignments ---');
  for (const eb of excelBikes) {
    // 1. Find or create the bike in DB
    let bike = dbBikes.find(b => b.plate_number === eb.plate);
    let bikeId;
    
    const bikeData = {
      plate_number: eb.plate,
      model: bike ? bike.model : 'Standard Bike',
      istimara_expiry: eb.expiryDate,
      status: eb.authStatus && eb.authStatus.toLowerCase() === 'retired' ? 'retired' : 'active',
      notes: eb.notes
    };
    
    if (bike) {
      bikeId = bike.id;
      await db.updateBike(bikeId, bikeData);
      console.log(`Updated bike "${eb.plate}" (ID: ${bikeId}) with expiry: ${eb.expiryDate}`);
    } else {
      const newBike = await db.createBike(bikeData);
      bikeId = newBike.id;
      dbBikes.push(newBike); // Add to local cache list
      console.log(`Created new bike "${eb.plate}" (ID: ${bikeId})`);
    }
    
    // 2. Handle Rider Assignment
    if (eb.assignedRiderName) {
      // Find matching rider
      let rider = null;
      
      if (eb.riderPhone) {
        const cleanP = cleanPhone(eb.riderPhone);
        rider = dbRiders.find(r => r.phone && cleanPhone(r.phone) === cleanP);
      }
      if (!rider && eb.riderIqama) {
        rider = dbRiders.find(r => r.iqama_number === eb.riderIqama);
      }
      if (!rider) {
        rider = dbRiders.find(r => namesMatch(eb.assignedRiderName, r.name));
      }
      
      if (rider) {
        console.log(`  -> Matching rider found: "${rider.name}" (ID: ${rider.id}) for plate "${eb.plate}"`);
        
        // Check if this bike is already assigned to this rider in DB
        // If not, perform the link:
        if (rider.bike_id !== String(bikeId) || bike.assigned_rider_id !== String(rider.id)) {
          // Clear the rider's old bike if any
          if (rider.bike_id && rider.bike_id !== String(bikeId)) {
            try {
              await db.updateBike(parseInt(rider.bike_id), { assigned_rider_id: null, assigned_rider_name: null });
              console.log(`     Cleared old bike assignment (ID: ${rider.bike_id}) for rider "${rider.name}"`);
            } catch (e) {
              console.error(`     Failed to clear old bike assignment for rider "${rider.name}":`, e.message);
            }
          }
          
          // Clear this bike's old rider if any
          if (bike && bike.assigned_rider_id && bike.assigned_rider_id !== String(rider.id)) {
            try {
              await db.updateRider(parseInt(bike.assigned_rider_id), { bike_id: null });
              console.log(`     Cleared old rider assignment (ID: ${bike.assigned_rider_id}) for bike "${eb.plate}"`);
            } catch (e) {
              console.error(`     Failed to clear old rider assignment for bike "${eb.plate}":`, e.message);
            }
          }
          
          // Perform new assignment
          await db.updateBike(bikeId, {
            assigned_rider_id: String(rider.id),
            assigned_rider_name: rider.name
          });
          await db.updateRider(rider.id, { bike_id: String(bikeId) });
          console.log(`     Linked Rider ID ${rider.id} (${rider.name}) <-> Bike ID ${bikeId} (${eb.plate})`);
          
          // Update local cache
          rider.bike_id = String(bikeId);
        } else {
          console.log(`     Assignment already correct in DB.`);
        }
      } else {
        console.log(`  -> No matching active rider in DB for: "${eb.assignedRiderName}" (Plate: ${eb.plate})`);
        // Just update the bike text fields
        await db.updateBike(bikeId, {
          assigned_rider_id: null,
          assigned_rider_name: eb.assignedRiderName
        });
      }
    } else {
      // Excel says unassigned.
      // Wait, is it assigned to someone in DB who is active?
      // Let's check if the bike currently has an assignment in DB.
      if (bike && bike.assigned_rider_id) {
        // If it was assigned in DB, should we keep it?
        // User request 9 says: "if a bike is already authorized to a rider keep it"
        // Meaning if a bike has an active rider assigned in DB, we should preserve it!
        console.log(`  -> Bike "${eb.plate}" is listed as Unassigned in Excel but has assignment in DB to rider ID ${bike.assigned_rider_id} (${bike.assigned_rider_name}). Keeping DB assignment.`);
      } else {
        // Clear assignment just in case
        await db.updateBike(bikeId, {
          assigned_rider_id: null,
          assigned_rider_name: null
        });
      }
    }
  }
  
  console.log('\n✅ Database import & sync complete!');
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
