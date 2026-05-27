const fs = require('fs');

let content = fs.readFileSync('public/js/expenses.js', 'utf8');

// 1. Fix the riderExpenses filter in exportDeductionsExcel
content = content.replace(
    /return !isMedical && \(e\.is_deductible === 1 \|\| e\.is_deductible === true\) && e\.rider_id;/,
    "return !isMedical && (e.is_deductible === 1 || e.is_deductible === true);"
);

// 2. Fix the name lookup in render()
const renderTarget = `              const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;
              let rName = e.rider_name || e.vendor_name;
              if (!rName || rName === 'Rider') rName = foundRider ? foundRider.name : (e.rider_id ? \`Rider #\${e.rider_id}\` : mapKey);`;

const renderReplace = `              const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;
              let rName = foundRider ? foundRider.name : (e.rider_name || e.vendor_name || (e.rider_id ? \`Rider #\${e.rider_id}\` : mapKey));`;

if (content.includes(renderTarget)) {
    content = content.replace(renderTarget, renderReplace);
    console.log("Replaced render target successfully.");
} else {
    // If it fails, maybe due to CRLF, use split lines approach
    const lines = content.split('\n');
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("let rName = e.rider_name || e.vendor_name;") && lines[i+1].includes("if (!rName || rName === 'Rider') rName = foundRider ? foundRider.name")) {
            lines[i] = "              let rName = foundRider ? foundRider.name : (e.rider_name || e.vendor_name || (e.rider_id ? `Rider #${e.rider_id}` : mapKey));";
            lines[i+1] = ""; // remove the if
            startIdx = i;
            break;
        }
    }
    if (startIdx !== -1) {
        content = lines.join('\n');
        console.log("Replaced render target via lines successfully.");
    } else {
        console.log("Could not find render target.");
    }
}

// 3. Fix the name lookup in exportDeductionsExcel()
const exportLines = content.split('\n');
let exportStart = -1;
for (let i = 0; i < exportLines.length; i++) {
    if (exportLines[i].includes("let rName = e.rider_name || e.vendor_name;") && exportLines[i+1].includes("if (!rName || rName === 'Rider') {")) {
        exportLines[i] = "        const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;";
        exportLines[i+1] = "        let rName = foundRider ? foundRider.name : (e.rider_name || e.vendor_name || (e.rider_id ? 'Rider #' + e.rider_id : 'Non-Rider Deductible'));";
        exportLines[i+2] = ""; // const foundRider ...
        exportLines[i+3] = ""; // rName = foundRider ...
        exportLines[i+4] = ""; // }
        exportStart = i;
        break;
    }
}
if (exportStart !== -1) {
    content = exportLines.join('\n');
    console.log("Replaced export target via lines successfully.");
} else {
    console.log("Could not find export target.");
}


fs.writeFileSync('public/js/expenses.js', content, 'utf8');
console.log('Patch complete.');
