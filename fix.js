const fs = require('fs');
let code = fs.readFileSync('public/js/excel-export.js', 'utf8');

// The replacement logic:
const extractStr = "(typeof p.payment_status === 'string' ? p.payment_status : (p.payment_status && p.payment_status.status ? p.payment_status.status : 'pending'))";

// Replace only the specific patterns precisely
code = code.split("(p.payment_status || 'pending').toUpperCase()").join(extractStr + '.toUpperCase()');
code = code.split("p.payment_status === 'paid'").join(extractStr + " === 'paid'");
code = code.split("p.payment_status === 'pending'").join(extractStr + " === 'pending'");
code = code.split("p.payment_status === 'partial'").join(extractStr + " === 'partial'");

fs.writeFileSync('public/js/excel-export.js', code);
console.log('Fixed excel-export.js');
