const fs = require('fs');
let content = fs.readFileSync('public/js/expenses.js', 'utf8');

// 1. Remove the paidByMap calculation block completely
const paidByStartStr = "      const sortedExpenses = [...expenses].sort((a, b) => new Date(a.expense_date || a.created_at) - new Date(b.expense_date || b.created_at));\n" +
"      const sortedFunds = [...funds].sort((a, b) => new Date(a.receive_date || a.created_at) - new Date(b.receive_date || b.created_at));\n" +
"      let currentCompanyBalance = 0;\n" +
"      let fundIndex = 0;\n" +
"      const paidByMap = {};\n" +
"      \n" +
"      for (const e of sortedExpenses) {\n" +
"        const eDate = new Date(e.expense_date || e.created_at);\n" +
"        while (fundIndex < sortedFunds.length) {\n" +
"          const fDate = new Date(sortedFunds[fundIndex].receive_date || sortedFunds[fundIndex].created_at);\n" +
"          if (fDate <= eDate) {\n" +
"            currentCompanyBalance += parseFloat(sortedFunds[fundIndex].amount) || 0;\n" +
"            fundIndex++;\n" +
"          } else {\n" +
"            break;\n" +
"          }\n" +
"        }\n" +
"        const amt = parseFloat(e.amount) || 0;\n" +
"        if (currentCompanyBalance >= amt) {\n" +
"          paidByMap[e.id] = 'Company';\n" +
"          currentCompanyBalance -= amt;\n" +
"        } else {\n" +
"          paidByMap[e.id] = 'Out of Pocket';\n" +
"          currentCompanyBalance -= amt;\n" +
"        }\n" +
"      }";

content = content.replace(paidByStartStr, "");

// 2. Replace paidByMap references in the rows
content = content.replace(/paidByMap\[e\.id\] \|\| 'Company'/g, "'Company'");

fs.writeFileSync('public/js/expenses.js', content, 'utf8');
console.log('Successfully patched Out of Pocket logic in excel export');
