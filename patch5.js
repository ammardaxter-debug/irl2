const fs = require('fs');

let content = fs.readFileSync('public/js/expenses.js', 'utf8');

const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const riderMap = {};')) {
        if (i > 1400 && i < 1500) {
             startIdx = i;
        }
    }
    if (startIdx !== -1 && i > startIdx && lines[i].includes('} else {') && lines[i+1] && lines[i+1].includes('riderMap[rName].pending.push(e);')) {
        endIdx = i + 3;
        break;
    }
}

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find block boundaries. start:", startIdx, "end:", endIdx);
    process.exit(1);
}

const newBlock = "      const riderMap = {};\n" +
"      \n" +
"      for (const e of riderExpenses) {\n" +
"        let rName = e.rider_name || e.vendor_name;\n" +
"        if (!rName || rName === 'Rider') {\n" +
"            const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;\n" +
"            rName = foundRider ? foundRider.name : (e.rider_id ? 'Rider #' + e.rider_id : (e.vendor_name || 'Non-Rider Deductible'));\n" +
"        }\n" +
"        \n" +
"        if (!riderMap[rName]) riderMap[rName] = { pending: [], settled: [] };\n" +
"        \n" +
"        // Include ALL settled deductions historically to match the summary logic\n" +
"        if (e.deductionSettled) {\n" +
"          riderMap[rName].settled.push(e);\n" +
"        } else {\n" +
"          riderMap[rName].pending.push(e);\n" +
"        }\n" +
"      }";

const newLines = [...lines.slice(0, startIdx), ...newBlock.split('\n'), ...lines.slice(endIdx)];

fs.writeFileSync('public/js/expenses.js', newLines.join('\n'), 'utf8');
console.log('Successfully patched export logic line-by-line');
