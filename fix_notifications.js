require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixNotificationPhotos() {
  // Update all notifications sent by Abdullah Khan to use his new photo URL
  const photoUrl = 'https://nbkummtlzmbrkfziohwk.supabase.co/storage/v1/object/public/rider-proofs/admin_profile_abdullah_irl_dot_sa_1779861655096.png';
  
  const { data, error } = await supabase
    .from('notifications')
    .update({ processed_by_photo: photoUrl })
    .eq('processed_by_name', 'Abdullah Khan')
    .is('processed_by_photo', null);
    
  if (error) {
    console.error('Error updating notifications:', error);
  } else {
    console.log('Successfully updated old notifications with Admin Photo!');
  }
}

fixNotificationPhotos();
