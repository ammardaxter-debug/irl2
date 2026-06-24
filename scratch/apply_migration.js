const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

async function applyMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Applying migration to add fund_id to expenses...');
  const sql = `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fund_id INTEGER REFERENCES company_funds(id) ON DELETE SET NULL;`;
  
  let result;
  try {
    result = await supabase.rpc('execute_sql', { sql_query: sql });
  } catch (e) {
    result = { error: e };
  }

  const error = result.error;
  const data = result.data;

  if (error) {
    console.error('RPC execute_sql failed:', error);
    console.log('\nPlease run the following SQL manually in your Supabase SQL Editor:');
    console.log(sql);
  } else {
    console.log('✅ Migration applied successfully!', data);
  }
}

applyMigration();
