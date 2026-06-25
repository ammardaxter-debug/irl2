const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const NEW_URL = 'https://nbkummtlzmbrkfziohwk.supabase.co';
const NEW_KEY = 'sb_secret_R0igamaumuJ4UNA61LZGXA_k9SKuENR';
const supabase = createClient(NEW_URL, NEW_KEY);

async function main() {
  const users = [
    { email: 'abdullah@irl.sa', name: 'Abdullah Khan', role: 'admin', password_hash: '$2b$10$o1dzL4AcacwkxEWUTv/.n.te1zkkVciTmfcOnmV9mv6hRibNypRwa', created_at: '2026-05-14 13:47:55.779+00' },
    { email: 'firas@irl.sa', name: 'Firas Al Arifi', role: 'admin', password_hash: '$2b$10$svPKNgUy.A06VZuhdGr4GeZUgQBb.XhjY.McRp3JNx0S8lm30rR9i', created_at: '2026-05-14 13:49:27.491+00' },
    { email: 'saad@irl.sa', name: 'Saad', role: 'admin', password_hash: '$2b$10$hjyXqNeb3EaoNMn7J448R.CmVblVTBOs4q0pLDK3tUNM7MVkfWHIu', created_at: '2026-05-14 13:49:27.043+00' }
  ];

  const { error } = await supabase.from('auth_users').upsert(users);
  if (error) console.error('Error importing auth_users:', error);
  else console.log('Successfully imported auth_users!');
}
main();
