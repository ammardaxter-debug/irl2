const db = require('../database.js');

process.env.SUPABASE_URL = "https://gyjipkxewpdkxpfciddo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_0WSEkcc8d674fto2ICVX8A_5r77HtC7";

async function run() {
  await db.initDb();
  const supabase = db.getDb();
  
  try {
    // 1. Fetch one rider to see available columns
    const { data: riders, error: riderErr } = await supabase.from('riders').select('*').limit(1);
    if (riderErr) {
      console.error("Error fetching rider:", riderErr.message);
    } else if (riders && riders.length > 0) {
      console.log("📊 Available columns in riders table:", Object.keys(riders[0]));
    } else {
      console.log("❓ No riders found in database to inspect columns.");
    }
    
    // 2. Fetch tracking status setting
    const { data: config, error: configErr } = await supabase.from('app_config').select('*').eq('key', 'tracking_status').single();
    if (configErr) {
      console.log("ℹ️ tracking_status setting is not set yet in app_config:", configErr.message);
    } else {
      console.log("⚙️ Current tracking_status in app_config:", config);
    }
  } catch (err) {
    console.error("Fatal error:", err);
  }
}

run();
