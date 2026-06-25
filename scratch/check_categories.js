require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('expenses')
    .select('category, is_deductible, deductionSettled');
  if (error) {
    console.error(error);
    process.exit(1);
  }
  
  const counts = {};
  data.forEach(item => {
    const key = `${item.category} (deductible: ${item.is_deductible}, settled: ${item.deductionSettled})`;
    counts[key] = (counts[key] || 0) + 1;
  });
  
  console.log("EXPENSE CATEGORIES AND COUNTS:", counts);
  process.exit(0);
}

run();
