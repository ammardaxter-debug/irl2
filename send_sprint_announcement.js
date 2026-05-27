require('dotenv').config();
const db = require('./database.js');
const { Expo } = require('expo-server-sdk');

async function announce() {
  await db.initDb();
  console.log('Fetching riders...');
  const riders = await db.getAllRiders('active');
  const companyRiders = riders.filter(r => r.rider_type === 'company' && r.push_token && Expo.isExpoPushToken(r.push_token));
  
  console.log(`Found ${companyRiders.length} company riders with push tokens.`);
  
  const expo = new Expo();
  const messages = companyRiders.map(rider => ({
    to: rider.push_token,
    sound: 'default',
    title: '🏁 The Weekly Sprint Starts Tomorrow!',
    body: 'Get ready to race! The Top 3 Company Riders will split a 75 SAR prize pool. Start delivering tomorrow to climb the leaderboard!',
    data: { type: 'announcement' }
  }));

  console.log('Sending pushes...');
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  for (let chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
      sent += chunk.length;
    } catch (error) {
      console.error(error);
    }
  }
  console.log(`Successfully sent ${sent} notifications. exiting.`);
  process.exit(0);
}

announce();
