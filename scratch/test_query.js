const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('expenses').select('id, fund_id').limit(1);
  if (error) {
    console.error('Test query failed:', error.message);
  } else {
    console.log('Test query succeeded! Column fund_id exists. Data:', data);
  }
}

test();
