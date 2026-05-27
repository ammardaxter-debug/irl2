const fs = require('fs');

let content = fs.readFileSync('public/js/expenses.js', 'utf8');

const startTarget = "// 📝 SHEET 3: Summary 📝";
const endTarget = "for (let c=1;c<=4;c++){g3.getCell(c).font={name:'Calibri',size:12,bold:true,color:{argb:WH}};g3.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:DN}};g3.getCell(c).border=bdr;}";

const startIndex = content.indexOf(startTarget);
const endIndex = content.indexOf(endTarget, startIndex) + endTarget.length;

if (startIndex === -1 || endIndex <= startIndex) {
    console.error("Could not find replacement block");
    process.exit(1);
}

const newBlock = `// 📝 SHEET 3: Summary 📝
      const ws3 = wb.addWorksheet('Summary');
      const h3 = ['PERSON / RIDER NAME','OLDEST PENDING DATE','HISTORICAL TOTAL (SAR)','TOTAL SETTLED (SAR)','REMAINING BALANCE (SAR)','STATUS'];
      ws3.columns = [{width:28},{width:22},{width:24},{width:22},{width:26},{width:25}];
      addHeader(ws3, h3.length, allOutstandingLabel); setHdr(ws3, h3, 4);

      let r3 = 5, totalHist = 0, totalSettled = 0, totalRem = 0;
      const today = new Date();
      for (const rn of riders) {
        const pendingItems = riderMap[rn].pending;
        const pt = pendingItems.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        const st = riderMap[rn].settled.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        if (pt===0 && st===0) continue;
        
        let oldestDateStr = '-';
        let isFlagged = false;
        let diffDays = 0;
        if (pendingItems.length > 0) {
          const oldestItem = pendingItems.reduce((oldest, current) => {
            return new Date(current.expense_date || current.created_at) < new Date(oldest.expense_date || oldest.created_at) ? current : oldest;
          });
          const oldestDate = new Date(oldestItem.expense_date || oldestItem.created_at);
          oldestDateStr = formatReadableDate(oldestItem.expense_date || oldestItem.created_at);
          
          diffDays = Math.floor((today - oldestDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) isFlagged = true;
        }

        const hist = pt + st;
        const row = ws3.getRow(r3); const alt = (r3-5)%2===1;
        row.getCell(1).value = rn; row.getCell(1).font = {name:'Calibri',size:11,bold:true};
        row.getCell(2).value = oldestDateStr; row.getCell(2).font = {name:'Calibri',size:11};
        row.getCell(3).value = hist; row.getCell(3).numFmt='#,##0.00'; row.getCell(3).font={name:'Calibri',size:11}; row.getCell(3).alignment={horizontal:'right'};
        row.getCell(4).value = st; row.getCell(4).numFmt='#,##0.00'; row.getCell(4).font={name:'Calibri',size:11}; row.getCell(4).alignment={horizontal:'right'};
        row.getCell(5).value = pt; row.getCell(5).numFmt='#,##0.00'; row.getCell(5).alignment={horizontal:'right'};
        row.getCell(5).font = pt>0 ? {name:'Calibri',size:11,bold:true,color:{argb:RD}} : {name:'Calibri',size:11,bold:true,color:{argb:GT}};
        
        let status = pt === 0 ? 'All Settled' : (isFlagged ? \`Flagged (\${diffDays} days old)\` : 'Active Pending');
        row.getCell(6).value = status; row.getCell(6).font = {name:'Calibri',size:11, italic: true, color: {argb: isFlagged ? RD : 'FF6B7280'}};

        if (isFlagged) {
           for (let c=1;c<=6;c++) row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFEE2E2'}};
        } else if (alt) {
           for (let c=1;c<=6;c++) row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:AR}};
        }
        for (let c=1;c<=6;c++) row.getCell(c).border = bdr;
        totalHist += hist; totalSettled += st; totalRem += pt; r3++;
      }
      ws3.mergeCells(r3, 1, r3, 2);
      const g3 = ws3.getRow(r3);
      g3.getCell(1).value = 'GRAND TOTALS';
      g3.getCell(3).value = totalHist; g3.getCell(3).numFmt='#,##0.00'; g3.getCell(3).alignment={horizontal:'right'};
      g3.getCell(4).value = totalSettled; g3.getCell(4).numFmt='#,##0.00'; g3.getCell(4).alignment={horizontal:'right'};
      g3.getCell(5).value = totalRem; g3.getCell(5).numFmt='#,##0.00'; g3.getCell(5).alignment={horizontal:'right'};
      g3.getCell(6).value = '';
      for (let c=1;c<=6;c++){g3.getCell(c).font={name:'Calibri',size:12,bold:true,color:{argb:WH}};g3.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:DN}};g3.getCell(c).border=bdr;}`;

const newContent = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync('public/js/expenses.js', newContent, 'utf8');
console.log('Successfully patched expenses.js');
