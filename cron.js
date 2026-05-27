const cron = require('node-cron');
const db = require('./database.js');
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

// Helper to get current week start/end (Monday to Sunday)
function getCurrentWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const start = new Date(now.setDate(diff));
  start.setHours(0,0,0,0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23,59,59,999);
  
  return {
    startStr: start.toISOString().split('T')[0],
    endStr: end.toISOString().split('T')[0]
  };
}

// Run every day at 8:00 PM
cron.schedule('0 20 * * *', async () => {
  console.log('[CRON] Running daily progress notifications for Weekly Sprint...');
  try {
    const { startStr, endStr } = getCurrentWeek();
    const riders = await db.getAllRiders('active');
    const companyRiders = riders.filter(r => r.rider_type === 'company' && r.push_token && Expo.isExpoPushToken(r.push_token));
    
    if (companyRiders.length === 0) return;

    const logsResult = await db.getDailyLogsPaginated(startStr, endStr, 1, 99999);
    const logs = logsResult.data || [];
    
    const statsMap = {};
    for (const log of logs) {
      if (log.rider_id) {
        statsMap[log.rider_id] = (statsMap[log.rider_id] || 0) + (log.delivered_orders || 0);
      }
    }

    const leaderboard = companyRiders.map(r => ({
      ...r,
      total_orders: statsMap[r.id] || 0
    })).sort((a, b) => b.total_orders - a.total_orders);

    const messages = [];

    leaderboard.forEach((rider, index) => {
      const rank = index + 1;
      let title = '';
      let body = '';

      if (rank === 1) {
        title = '👑 You are Rank #1!';
        body = `Keep up the great work to secure the 40 SAR Weekly Sprint prize! You have ${rider.total_orders} orders.`;
      } else if (rank === 2) {
        const diff = leaderboard[0].total_orders - rider.total_orders + 1;
        title = '🥈 You are Rank #2!';
        body = `You only need ${diff} more orders to take 1st place and the 40 SAR prize!`;
      } else if (rank === 3) {
        const diff = leaderboard[1].total_orders - rider.total_orders + 1;
        title = '🥉 You are Rank #3!';
        body = `You are in the money! Complete ${diff} more orders to overtake Rank #2.`;
      } else if (rank <= 10) {
        const diff = leaderboard[2].total_orders - rider.total_orders + 1;
        title = `📈 You are Rank #${rank}!`;
        body = `You need ${diff} more orders to break into the Top 3 and win cash! Keep pushing!`;
      }

      if (title && body) {
        messages.push({
          to: rider.push_token,
          sound: 'default',
          title: title,
          body: body,
          data: { type: 'weekly_sprint_progress' },
        });
      }
    });

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('[CRON] Push error:', error);
      }
    }
    console.log(`[CRON] Sent progress notifications to ${messages.length} riders.`);
  } catch (err) {
    console.error('[CRON] Error in weekly sprint job:', err);
  }
});
