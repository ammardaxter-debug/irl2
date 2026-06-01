// ========================================
// PAYROLL FINANCIAL EXCEL REPORT
// Displays Funds Received vs Net Paid to Riders
// ========================================

const PayrollFinancialExcel = {
  colors: {
    dark: '0F172A',
    blue: '2563EB',
    green: '16A34A',
    amber: 'D97706',
    red: 'DC2626',
    white: 'FFFFFF',
    light: 'F8FAFC',
    border: 'E2E8F0',
    muted: '64748B',
    greenBg: 'DCFCE7',
    redBg: 'FEF2F2',
    blueBg: 'DBEAFE',
    amberBg: 'FEF3C7'
  },

  get darkFill() { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } }; },
  get lightFill() { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.light } }; },
  
  fill(hex) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } }; },

  async generate(isAllTime = false, currentPeriod = null) {
    if (typeof ExcelJS === 'undefined') {
      Utils.showToast('ExcelJS library not loaded.', 'error');
      return;
    }

    Utils.showLoading('Generating Report', 'Gathering financial records...');

    try {
      // 1. Fetch Data based on mode
      let funds = [];
      let payouts = [];
      let label = 'All-Time History';

      if (isAllTime) {
        // Fetch all-time funds and all-time payouts
        funds = await API.getCycleTransfers('all'); // wait, the new API is getCycleTransfers
        payouts = await API.getExpenses(null, null);
      } else {
        if (!currentPeriod) throw new Error('Current cycle period is required.');
        const cycleKey = `${currentPeriod.start}_${currentPeriod.end}`;
        funds = await API.getCycleTransfers(cycleKey);
        payouts = await API.getExpenses(currentPeriod.start, currentPeriod.end);
        
        const s = new Date(currentPeriod.start + 'T00:00:00');
        const e = new Date(currentPeriod.end + 'T00:00:00');
        label = `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }

      // Filter payouts strictly to 'Rider Payroll' category
      // As per new auto-settlement logic, we create an exact expense when marked "Paid"
      const riderPayouts = payouts.filter(p => (p.category || '').toLowerCase() === 'rider payroll');

      // 2. Initialize Workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Inspiring Roads Logistics';
      
      const ws = wb.addWorksheet('Financial Summary', { properties: { tabColor: { argb: 'FF1E3A5F' } } });
      ws.columns = [
        { width: 20 }, // A: Date
        { width: 35 }, // B: Description / Entity
        { width: 25 }, // C: Reference / Notes
        { width: 18 }, // D: Amount In (Received)
        { width: 18 }  // E: Amount Out (Paid)
      ];

      // --- HEADER ---
      ws.mergeCells('A1:E1');
      const h1 = ws.getCell('A1');
      h1.value = 'INSPIRING ROADS LOGISTICS';
      h1.font = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FF' + this.colors.white } };
      h1.fill = this.darkFill;
      h1.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 36;

      ws.mergeCells('A2:E2');
      const h2 = ws.getCell('A2');
      h2.value = `PAYROLL FINANCIAL SUMMARY  |  ${label}`;
      h2.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFCBD5E1' } };
      h2.fill = this.darkFill;
      h2.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 26;

      ws.mergeCells('A3:E3');
      const h3 = ws.getCell('A3');
      h3.value = `Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}  |  Generated from Payroll Module`;
      h3.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF' + this.colors.muted } };
      h3.fill = this.darkFill;
      h3.alignment = { vertical: 'middle', horizontal: 'center' };
      h3.border = { bottom: { style: 'thick', color: { argb: 'FF' + this.colors.blue } } };
      ws.getRow(3).height = 22;

      // --- CALCULATIONS ---
      const totalReceived = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const totalPaid = riderPayouts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const netPosition = totalReceived - totalPaid;

      // --- KPI SCORECARDS ---
      ws.getRow(4).height = 10;
      ws.getRow(5).height = 45;

      const createKPI = (startCol, endCol, label, value, sub, isPositive) => {
        ws.mergeCells(`${startCol}5:${endCol}5`);
        const c = ws.getCell(`${startCol}5`);
        c.value = {
          richText: [
            { text: `${label}\n`, font: { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF475569' } } },
            { text: `SAR ${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`, font: { name: 'Calibri', bold: true, size: 16, color: { argb: isPositive ? 'FF16A34A' : (isPositive === false ? 'FFDC2626' : 'FF1E293B') } } }
          ]
        };
        c.fill = this.fill('F8FAFC');
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = { 
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, 
          bottom: { style: 'medium', color: { argb: isPositive ? 'FF16A34A' : (isPositive === false ? 'FFDC2626' : 'FF2563EB') } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      };

      createKPI('A', 'B', 'TOTAL FUNDS RECEIVED', totalReceived, '', true);
      createKPI('C', 'D', 'TOTAL NET PAID TO RIDERS', totalPaid, '', false);
      
      ws.getCell('E5').value = {
        richText: [
          { text: 'NET POSITION\n', font: { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF475569' } } },
          { text: `SAR ${netPosition.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`, font: { name: 'Calibri', bold: true, size: 16, color: { argb: netPosition >= 0 ? 'FF16A34A' : 'FFDC2626' } } }
        ]
      };
      ws.getCell('E5').fill = this.fill(netPosition >= 0 ? 'F0FDF4' : 'FEF2F2');
      ws.getCell('E5').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      ws.getCell('E5').border = { 
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, 
        bottom: { style: 'medium', color: { argb: netPosition >= 0 ? 'FF16A34A' : 'FFDC2626' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      ws.getRow(6).height = 20;

      // --- DETAILED TRANSACTIONS ---
      let r = 7;
      ws.mergeCells(`A${r}:E${r}`);
      const secHeader = ws.getCell(`A${r}`);
      secHeader.value = ' DETAILED TRANSACTION LOG';
      secHeader.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1E3A8A' } };
      secHeader.fill = this.fill('DBEAFE');
      secHeader.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(r).height = 24;
      r++;

      // Table Headers
      const tHeader = ws.getRow(r);
      tHeader.values = ['Date', 'Description / Rider', 'Reference Notes', 'Amount Received (+)', 'Amount Paid (-)'];
      tHeader.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      tHeader.eachCell(c => { 
        c.fill = this.darkFill; 
        c.alignment = { vertical: 'middle', horizontal: 'center' }; 
        c.border = { top: { style: 'thin', color: { argb: 'FF475569' } }, bottom: { style: 'thin', color: { argb: 'FF475569' } } };
      });
      ws.getRow(r).height = 26;
      r++;

      const items = [];
      funds.forEach(f => {
        items.push({
          date: new Date(f.transfer_date || f.created_at || new Date()),
          desc: f.description || 'Company Transfer',
          ref: f.notes || '',
          inflow: parseFloat(f.amount) || 0,
          outflow: 0
        });
      });

      riderPayouts.forEach(p => {
        items.push({
          date: new Date(p.expense_date || p.created_at || new Date()),
          desc: `Rider Payout: ${p.rider_name || 'Rider #'+p.rider_id}`,
          ref: p.notes || '',
          inflow: 0,
          outflow: parseFloat(p.amount) || 0
        });
      });

      // Sort by date oldest to newest
      items.sort((a, b) => a.date - b.date);

      if (items.length === 0) {
        ws.mergeCells(`A${r}:E${r}`);
        const noData = ws.getCell(`A${r}`);
        noData.value = 'No transactions recorded for this period.';
        noData.font = { italic: true, color: { argb: 'FF94A3B8' } };
        noData.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(r).height = 40;
      } else {
        let alt = false;
        items.forEach(item => {
          const row = ws.getRow(r);
          row.getCell(1).value = item.date;
          row.getCell(1).numFmt = 'MMM DD, YYYY';
          row.getCell(2).value = item.desc;
          row.getCell(3).value = item.ref;
          
          if (item.inflow > 0) {
            row.getCell(4).value = item.inflow;
            row.getCell(4).numFmt = '#,##0.00';
            row.getCell(4).font = { bold: true, color: { argb: 'FF16A34A' } };
          }
          if (item.outflow > 0) {
            row.getCell(5).value = item.outflow;
            row.getCell(5).numFmt = '#,##0.00';
            row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
          }

          for (let i = 1; i <= 5; i++) {
            const c = row.getCell(i);
            c.font = c.font || { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } };
            c.fill = this.fill(alt ? 'F8FAFC' : 'FFFFFF');
            c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
            c.alignment = { vertical: 'middle', horizontal: (i === 4 || i === 5) ? 'right' : (i === 1 ? 'center' : 'left'), indent: (i === 2 || i === 3) ? 1 : 0 };
          }
          row.height = 24;
          r++; alt = !alt;
        });

        // Totals Footer
        const fRow = ws.getRow(r);
        ws.mergeCells(`A${r}:C${r}`);
        const fLabel = fRow.getCell(1);
        fLabel.value = 'GRAND TOTALS';
        fLabel.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        fLabel.fill = this.darkFill;
        fLabel.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
        fLabel.border = { bottom: { style: 'thick', color: { argb: 'FF2563EB' } } };

        fRow.getCell(4).value = totalReceived;
        fRow.getCell(4).numFmt = '#,##0.00';
        fRow.getCell(4).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        fRow.getCell(4).fill = this.fill('16A34A');
        fRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        fRow.getCell(4).border = { bottom: { style: 'thick', color: { argb: 'FF2563EB' } } };

        fRow.getCell(5).value = totalPaid;
        fRow.getCell(5).numFmt = '#,##0.00';
        fRow.getCell(5).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        fRow.getCell(5).fill = this.fill('DC2626');
        fRow.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        fRow.getCell(5).border = { bottom: { style: 'thick', color: { argb: 'FF2563EB' } } };
        fRow.height = 30;
      }

      // --- FINALIZE & DOWNLOAD ---
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fileNameLabel = isAllTime ? 'All_Time' : currentPeriod.end;
      const filename = `IRL_Financial_Report_${fileNameLabel}.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      Utils.showToast('Financial report downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      Utils.showToast('Failed to generate Financial Report: ' + err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};
