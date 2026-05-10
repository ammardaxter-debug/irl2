const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}

const fbDb = admin.database();

async function listCollections() {
  const snap = await fbDb.ref('/').once('value');
  const data = snap.val();
  if (data) {
    console.log('Collections in root:', Object.keys(data));
  } else {
    console.log('Root is empty');
  }
  process.exit(0);
}

listCollections();
