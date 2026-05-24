const fs = require('fs');
const b = fs.readFileSync('.env');
const str = Buffer.from(b).toString('utf16le');
str.split(/\r?\n/).forEach(line => {
  if(line.includes('=')) {
    const parts = line.split('=');
    process.env[parts[0].replace(/^\uFEFF/, '').trim()] = parts.slice(1).join('=').replace(/^\"|\"$/g, '').trim();
  }
});
const db = require('./database.js');
async function clearBikes() {
  await db.initDb();
  const bikes = await db.getAllBikes();
  console.log('Found ' + bikes.length + ' bikes to delete.');
  for (const bike of bikes) {
    await db.deleteBike(bike.id);
  }
  console.log('Deleted all bikes');
}
clearBikes().catch(console.error);
