const fs = require('fs');

let content = fs.readFileSync('public/js/expenses.js', 'utf8');

const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const riderMap = {};')) {
        // Find the specific riderMap block inside exportDeductionsExcel
        // exportDeductionsExcel is around line 1394
        if (i > 1400 && i < 1500) {
             startIdx = i;
        }
    }
    if (startIdx !== -1 && i > startIdx && lines[i].includes('} else {') && lines[i+1] && lines[i+1].includes('riderMap[rName].pending.push(e);')) {
        endIdx = i + 3; // } else { ... push(e); ... }
        break;
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find block boundaries. start:", startIdx, "end:", endIdx);
    process.exit(1);
}

const newBlock = \`      const riderMap = {};
      
      for (const e of riderExpenses) {
        let rName = e.rider_name || e.vendor_name;
        if (!rName || rName === 'Rider') {
            const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;
            rName = foundRider ? foundRider.name : (e.rider_id ? \\\`Rider #\${e.rider_id}\\\` : (e.vendor_name || 'Non-Rider Deductible'));
        }
        
        if (!riderMap[rName]) riderMap[rName] = { pending: [], settled: [] };
        
        // Include ALL settled deductions historically to match the summary logic
        if (e.deductionSettled) {
          riderMap[rName].settled.push(e);
        } else {
          riderMap[rName].pending.push(e);
        }
      }\`.split('\\n');

const newLines = [...lines.slice(0, startIdx), ...newBlock, ...lines.slice(endIdx)];

fs.writeFileSync('public/js/expenses.js', newLines.join('\\n'), 'utf8');
console.log('Successfully patched export logic line-by-line');
