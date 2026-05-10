const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}

const fbDb = admin.database();

async function checkData() {
  const collections = ['riders', 'daily_logs', 'expenses', 'funds', 'bonuses', 'salary_advances', 'bikes'];
  console.log('--- Firebase Data Check ---');
  for (const coll of collections) {
    const snap = await fbDb.ref(coll).once('value');
    console.log(`${coll}: ${snap.exists() ? snap.numChildren() : 0} items`);
  }
  process.exit(0);
}

checkData();
