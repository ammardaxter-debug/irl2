const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log('Starting historical expenses-to-funds migration...');

  // Fetch all funds
  const { data: funds, error: fErr } = await supabase
    .from('company_funds')
    .select('id, receive_date, amount, source')
    .order('receive_date', { ascending: true });

  if (fErr) {
    console.error('Failed to fetch funds:', fErr);
    process.exit(1);
  }

  // Fetch all operational expenses (excluding Manual Deduction)
  const { data: expenses, error: eErr } = await supabase
    .from('expenses')
    .select('id, expense_date, category, amount, notes, fund_id')
    .order('expense_date', { ascending: true });

  if (eErr) {
    console.error('Failed to fetch expenses:', eErr);
    process.exit(1);
  }

  console.log(`Found ${funds.length} funds and ${expenses.length} expenses.`);

  let migratedCount = 0;
  for (const exp of expenses) {
    // Find the most recent fund deposit received on or before the expense date
    let matchedFund = null;
    for (const fund of funds) {
      if (fund.receive_date && exp.expense_date && fund.receive_date <= exp.expense_date) {
        matchedFund = fund;
      }
    }

    // If no fund found on or before, fallback to the first fund
    if (!matchedFund && funds.length > 0) {
      matchedFund = funds[0];
    }

    if (matchedFund) {
      if (exp.fund_id !== matchedFund.id) {
        const { error: uErr } = await supabase
          .from('expenses')
          .update({ fund_id: matchedFund.id })
          .eq('id', exp.id);

        if (uErr) {
          console.error(`Failed to link expense #${exp.id} (${exp.expense_date}) to fund #${matchedFund.id}:`, uErr.message);
        } else {
          migratedCount++;
        }
      }
    }
  }

  console.log(`Migration complete. Linked ${migratedCount} expenses to their corresponding fund deposits.`);
}

migrate();
