const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixSchema() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adding vendor_name to expenses table...');
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_name TEXT;"
    }).catch(e => ({ error: e }));

    if (error) {
        console.log('RPC execute_sql failed (this is normal if not configured). Trying direct update...');
        // If RPC is not available, we can't run raw SQL from the client easily without a specific edge function.
        // However, we can try to update an existing record with a new property to see if Supabase auto-adds it (unlikely for SQL).
        console.log('Please run this in your Supabase SQL Editor:');
        console.log('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_name TEXT;');
    } else {
        console.log('✅ Column added successfully!');
    }
}

fixSchema();
