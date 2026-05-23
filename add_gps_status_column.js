const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
    const supabaseUrl = 'https://gyjipkxewpdkxpfciddo.supabase.co';
    const supabaseKey = 'sb_secret_0WSEkcc8d674fto2ICVX8A_5r77HtC7';
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adding gps_status column to riders table in Supabase...');
    const query = "ALTER TABLE riders ADD COLUMN IF NOT EXISTS gps_status TEXT;";
    
    try {
        const { data, error } = await supabase.rpc('execute_sql', {
            sql_query: query
        });

        if (error) {
            console.error('❌ RPC execute_sql failed. Error details:', error);
            console.log('\nPlease run the following SQL command manually in your Supabase Dashboard SQL Editor:\n');
            console.log(query);
        } else {
            console.log('✅ Column gps_status added successfully!');
        }
    } catch (e) {
        console.error('❌ Exception caught during RPC execution:', e);
    }
    process.exit(0);
}

runMigration();
