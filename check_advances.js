require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Query expenses with category = 'Advance'
  const { data, error } = await supabase.from('expenses')
    .select('*')
    .eq('category', 'Advance');
  if (error) {
    console.error(error);
  } else {
    console.log("EXPENSE ADVANCES DATA:", JSON.stringify(data, null, 2));
  }
}

run();
