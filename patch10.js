const fs = require('fs');
let content = fs.readFileSync('public/js/expenses.js', 'utf8');

const lines = content.split('\n');
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const sortedExpenses = [...expenses].sort')) {
        startIdx = i;
    }
    if (startIdx !== -1 && i > startIdx && lines[i].includes("paidByMap[e.id] = 'Out of Pocket';") && lines[i+1].includes("currentCompanyBalance") && lines[i+2].includes("}") && lines[i+3].includes("}")) {
        endIdx = i + 4; // includes the second }
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx)];
    content = newLines.join('\n');
    console.log("Deleted paidByMap calculation safely.");
} else {
    console.log("Could not find paidByMap calculation block.", startIdx, endIdx);
}

content = content.replace(/paidByMap\[e\.id\] \|\| 'Company'/g, "'Company'");

fs.writeFileSync('public/js/expenses.js', content, 'utf8');
console.log('Patch complete.');
