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
  const snap = await fbDb.ref('expenses').limitToLast(5).once('value');
  console.log(JSON.stringify(snap.val(), null, 2));
  process.exit(0);
}

checkExpenses();
