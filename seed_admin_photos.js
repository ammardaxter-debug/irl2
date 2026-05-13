/**
 * One-time script to seed admin profile photos in Firebase.
 * Run this to ensure Abdullah, Saad, and Firas have professional avatars.
 */
const db = require('./database');

async function seedAdminPhotos() {
  await db.initDb();
  
  const admins = [
    {
      email: 'abdullah@irl.sa',
      name: 'Abdullah Khan',
      title: 'Operations Director',
      photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&h=256&auto=format&fit=crop'
    },
    {
      email: 'saad@irl.sa',
      name: 'Saad',
      title: 'Fleet Supervisor',
      photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=256&h=256&auto=format&fit=crop'
    },
    {
      email: 'firas@irl.sa',
      name: 'Firas Al Arifi',
      title: 'Admin Manager',
      photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=256&h=256&auto=format&fit=crop'
    }
  ];

  console.log('🚀 Seeding Admin Photos...');

  for (const admin of admins) {
    const emailKey = admin.email.replace(/\./g, '_dot_');
    await db.updateAdminProfile(emailKey, {
      name: admin.name,
      title: admin.title,
      photo_url: admin.photo_url
    });
    console.log(`✅ Seeded photo for ${admin.name} (${admin.email})`);
  }

  console.log('\n✨ Admin profiles are now ready with photos!');
  process.exit(0);
}

seedAdminPhotos().catch(err => {
  console.error('❌ Failed to seed:', err);
  process.exit(1);
});
