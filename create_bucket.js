require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('rider-proofs', {
    public: true,
    fileSizeLimit: 10485760, // 10MB
  });
  if (error) {
    console.error('Error creating bucket:', error);
  } else {
    console.log('Bucket created:', data);
  }
}

createBucket();
