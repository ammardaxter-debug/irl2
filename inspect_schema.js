const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}

const fbDb = admin.database();

async function checkExpenses() {
  const snap = await fbDb.ref('expenses').limitToLast(20).once('value');
  const data = snap.val();
  const keys = Object.keys(data || {});
  console.log(`Found ${keys.length} expenses.`);
  if (keys.length > 0) {
    console.log('Sample keys:', keys.slice(0, 3));
    console.log('Sample item:', JSON.stringify(data[keys[0]], null, 2));
    
    // Check for unique fields across all items
    const allFields = new Set();
    Object.values(data).forEach(item => {
      Object.keys(item).forEach(f => allFields.add(f));
    });
    console.log('All available fields in expenses:', Array.from(allFields));
  }
  process.exit(0);
}

checkExpenses();
