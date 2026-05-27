const fs = require('fs');

let content = fs.readFileSync('public/js/expenses.js', 'utf8');

const targetStr = `      const riderMap = {};
      
      for (const e of riderExpenses) {
        const rName = e.rider_name || \`Rider #\${e.rider_id}\`;
        if (!riderMap[rName]) riderMap[rName] = { pending: [], settled: [] };
        if (e.deductionSettled) {
          const sDate = new Date(e.settledDate || e.expense_date || e.created_at);
          if (sDate >= activeStart && sDate <= activeEnd) {
             riderMap[rName].settled.push(e);
          }
        } else {
          riderMap[rName].pending.push(e);
        }
      }`;

const replaceStr = `      const riderMap = {};
      
      for (const e of riderExpenses) {
        let rName = e.rider_name || e.vendor_name;
        if (!rName || rName === 'Rider') {
            const foundRider = e.rider_id ? Expenses.riders.find(r => r.id == e.rider_id) : null;
            rName = foundRider ? foundRider.name : (e.rider_id ? \`Rider #\${e.rider_id}\` : (e.vendor_name || 'Non-Rider Deductible'));
        }
        
        if (!riderMap[rName]) riderMap[rName] = { pending: [], settled: [] };
        
        // Push ALL settled items so the summary can correctly calculate historical totals
        if (e.deductionSettled) {
          riderMap[rName].settled.push(e);
        } else {
          riderMap[rName].pending.push(e);
        }
      }`;

if (content.includes(targetStr)) {
    fs.writeFileSync('public/js/expenses.js', content.replace(targetStr, replaceStr), 'utf8');
    console.log('Successfully patched export grouping');
} else {
    console.error('Target string not found in expenses.js. Could not patch.');
    // Try to find it line by line
    const startIdx = content.indexOf('const riderMap = {};');
    if (startIdx > -1) {
        console.log("Found riderMap declaration at index: " + startIdx);
    }
}
