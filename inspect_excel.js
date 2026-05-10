const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('C:', 'Users', 'hp', 'Downloads', 'IRL', 'IRL.xlsx');
const wb = XLSX.readFile(filePath);

console.log('Sheet names:', wb.SheetNames);
console.log('---');

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log('\n=== ' + name + ' === (' + data.length + ' rows)');
  // show first 8 rows
  data.slice(0, 8).forEach((row, i) => {
    console.log('Row ' + i + ':', JSON.stringify(row));
  });
});
