const xlsx = require('xlsx');
const fs = require('fs');

const filePath = "C:\\Users\\hp\\Downloads\\Vehicle list\\vehicle_list_excel_without_qr-code_2026-04-05-1 (1).xlsx";

try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  // header: 1 returns 2D array instead of objects
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  fs.writeFileSync('excel_dump.json', JSON.stringify(data, null, 2));
  console.log("Dumped to excel_dump.json");
} catch (e) {
  console.error("Error reading excel:", e.message);
}
