const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runMigration() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from .env");
        process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adding helmet_date, gloves_date, chest_safety_date, foot_safety_date to riders table...');
    const sql = `
        ALTER TABLE riders 
        ADD COLUMN IF NOT EXISTS helmet_date TEXT,
        ADD COLUMN IF NOT EXISTS gloves_date TEXT,
        ADD COLUMN IF NOT EXISTS chest_safety_date TEXT,
        ADD COLUMN IF NOT EXISTS foot_safety_date TEXT;
    `;
    
    let error = null;
    try {
        const { error: rpcError } = await supabase.rpc('execute_sql', { sql_query: sql });
        error = rpcError;
    } catch (e) {
        error = e;
    }

    if (error) {
        console.log('⚠️ RPC execute_sql failed. You will need to manually run this SQL in your Supabase SQL Editor:');
        console.log(sql);
        console.log('Error details:', error);
    } else {
        console.log('✅ Columns added successfully!');
    }
}

runMigration();
