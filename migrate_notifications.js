/**
 * Migration script to backfill processed_by_photo for all existing notifications.
 */
const db = require('./database');

async function migrateNotifications() {
  await db.initDb();
  
  const adminPhotos = {
    'Abdullah Khan': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&h=256&auto=format&fit=crop',
    'Saad': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop',
    'Firas Al Arifi': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=256&h=256&auto=format&fit=crop',
    'Abdullah': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&h=256&auto=format&fit=crop'
  };

  console.log('🔍 Fetching all notifications...');
  const snapshot = await db.getDb().ref('notifications').once('value');
  if (!snapshot.exists()) {
    console.log('No notifications found.');
    process.exit(0);
  }

  const notifications = snapshot.val();
  let count = 0;

  for (const id in notifications) {
    const n = notifications[id];
    const name = n.processed_by_name;
    const photo = adminPhotos[name];

    if (name && photo && !n.processed_by_photo) {
      await db.getDb().ref(`notifications/${id}`).update({ processed_by_photo: photo });
      count++;
    }
  }

  console.log(`✅ Migration complete! Updated ${count} notifications with photos.`);
  process.exit(0);
}

migrateNotifications().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
