const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Seeding mechanic user into auth_users...');
  const mechanic = {
    email: 'mechanic@irl.sa',
    name: 'IRL Mechanic',
    role: 'mechanic',
    password_hash: '$2b$10$I1uyB3k5vfTAbGnM8TakEuQNPhCWgkfkTZnwUWvGp5ArGjWVenWtq', // bcrypt hash for 'mechanic123'
    created_at: new Date().toISOString()
  };

  const { error } = await supabase.from('auth_users').upsert([mechanic], { onConflict: 'email' });
  if (error) {
    console.error('Error seeding mechanic:', error);
  } else {
    console.log('✅ Mechanic user seeded successfully! Email: mechanic@irl.sa, Password: mechanic123');
  }
}

main();
