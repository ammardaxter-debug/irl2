const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = 'https://nbkummtlzmbrkfziohwk.supabase.co';
const supabaseKey = 'sb_secret_R0igamaumuJ4UNA61LZGXA_k9SKuENR';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = 'abdullah@irl.sa';
  const newPassword = 'IRL@Admin2026!';
  const hash = await bcrypt.hash(newPassword, 10);
  
  console.log(`Setting password hash for ${email}...`);
  const { data, error } = await supabase
    .from('auth_users')
    .update({ password_hash: hash })
    .eq('email', email);
    
  if (error) {
    console.error('Error updating password:', error);
  } else {
    console.log(`Successfully updated password for ${email} to '${newPassword}'`);
  }
}

main();
