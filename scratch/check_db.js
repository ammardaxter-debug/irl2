const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: funds, error: fErr } = await supabase
    .from('company_funds')
    .select('*')
    .order('receive_date', { ascending: false });
  if (fErr) console.error('Funds Error:', fErr);
  else console.log('COMPANY FUNDS:\n', JSON.stringify(funds, null, 2));

  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
    .limit(30);
  if (eErr) console.error('Expenses Error:', eErr);
  else console.log('LATEST 30 EXPENSES:\n', JSON.stringify(expenses, null, 2));
}

run();
