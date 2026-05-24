const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function backfill() {
  console.log('Fetching riders...');
  const { data: riders } = await supabase.from('riders').select('id, name, bike_id');
  console.log('Fetching bikes...');
  const { data: bikes } = await supabase.from('bikes').select('id, assigned_rider_id');

  let updated = 0;
  for (const rider of riders) {
    if (rider.bike_id) {
      const bike = bikes.find(b => b.id == rider.bike_id);
      if (bike && bike.assigned_rider_id != rider.id) {
        console.log("Updating bike " + bike.id + " for rider " + rider.name + " (" + rider.id + ")");
        await supabase.from('bikes').update({ assigned_rider_id: String(rider.id), assigned_rider_name: rider.name }).eq('id', bike.id);
        updated++;
      }
    }
  }
  console.log("Backfill complete. Updated " + updated + " bikes.");
}
backfill();
