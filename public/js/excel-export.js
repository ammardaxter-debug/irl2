// ========================================
// EXCELJS EXPORT - MONTHLY REPORT
// ========================================

const ExcelExport = {
  colors: {
    dark: '0F172A',
    blue: '2563EB',
    green: '16A34A',
    amber: 'D97706',
    red: 'DC2626',
    lightGray: 'F8FAFC',
    border: 'E2E8F0',
    white: 'FFFFFF',
    textMuted: '9CA3AF',
    textLight: '64748B'
  },

  // Helper: explicitly set a cell as a formatted SAR number
  setSAR(cell, value) {
    const num = parseFloat(value) || 0;
    cell.value = num;
    cell.numFmt = '#,##0.00';
  },

  getBranchName(company, rider) {
    if (!company) return 'Unassigned';
    if (company.includes('Noon Minutes') || company.includes('Noon Supermall')) {
      return (rider && rider.store_warehouse) ? rider.store_warehouse : 'Unassigned';
    }
    return company;
  },

  async generate(period, riders, payroll, allLogs, expenses, updateProgress) {
    if (typeof ExcelJS === 'undefined') {
      if (!updateProgress) Utils.showToast('ExcelJS library not loaded.', 'error');
      throw new Error('ExcelJS library not loaded.');
    }

    if (!updateProgress) Utils.showLoading('Building report', 'Generating Excel workbook...');
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Abdullah Khan — Inspiring Roads Logistics';
      workbook.title = 'IRL Monthly Payroll Report';
      workbook.company = 'Inspiring Roads Logistics';

      const activeRiders = (riders || []).filter(r => {
        if (r.status === 'active') return true;
        // Also include inactive riders if they have logs in this period
        return allLogs.some(l => {
          const l_id = l.rider_id !== undefined && l.rider_id !== null ? l.rider_id : (l.riderId || '');
          return String(l_id).trim() === String(r.id || '').trim();
        });
      });

      if (updateProgress) await updateProgress(1); // Building payroll summary
      else await new Promise(r => setTimeout(r, 10)); // Yield

      this.buildOverview(workbook.addWorksheet('Overview', { properties: { tabColor: { argb: 'FF1E3A5F' } } }), period, activeRiders, payroll, allLogs, expenses);
      this.buildUnsettledDeductions(workbook.addWorksheet('Unsettled Deductions', { properties: { tabColor: { argb: 'FFDC2626' } } }), activeRiders, expenses);
      this.buildPayrollSummary(workbook.addWorksheet('Payroll Summary', { properties: { tabColor: { argb: 'FF16A34A' } } }), period, activeRiders, payroll);
      
      if (updateProgress) await updateProgress(2); // Generating attendance grid
      await new Promise(r => setTimeout(r, 50));

      this.buildAttendanceGrid(workbook.addWorksheet('Attendance Grid', { properties: { tabColor: { argb: 'FF2563EB' } } }), period, activeRiders, allLogs);
      
      if (updateProgress) await updateProgress(3); // Finalizing report
      await new Promise(r => setTimeout(r, 50));

      this.buildOrdersBreakdown(workbook.addWorksheet('Orders Breakdown', { properties: { tabColor: { argb: 'FFD97706' } } }), period, activeRiders, payroll);
      this.buildDailyLogRaw(workbook.addWorksheet('Daily Log', { properties: { tabColor: { argb: 'FF6B7280' } } }), period, activeRiders, allLogs);

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const d = new Date(period.end + 'T00:00:00');
      const endMonth = monthNames[d.getMonth()] + d.getFullYear();
      
      const filename = `IRL_Payroll_Report_${endMonth}.xlsx`;
      
      // Manual download — more reliable than FileSaver.js
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

      if (updateProgress) await updateProgress(4); // Done
      if (!updateProgress) Utils.showToast('Excel report downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      if (!updateProgress) Utils.showToast('Failed to generate Excel: ' + err.message, 'error');
      throw err;
    } finally {
      if (!updateProgress) Utils.hideLoading();
    }
  },

  // ---------------------------------------------------------
  // SHEET 1: OVERVIEW
  // ---------------------------------------------------------

  buildOverview(ws, period, riders, payroll, allLogs, expenses) {
    ws.columns = [
      { width: 25 }, { width: 14 }, { width: 16 }, { width: 16 },
      { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }
    ];

    // --- MAIN HEADER ---
    ws.mergeCells('A1:H1');
    const h1 = ws.getCell('A1');
    h1.value = 'INSPIRING ROADS LOGISTICS';
    h1.font = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h1.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells('A2:H2');
    const h2 = ws.getCell('A2');
    h2.value = `Monthly Performance Report  |  Period: ${period.label}`;
    h2.font = { name: 'Calibri', size: 12, color: { argb: 'FFCBD5E1' } };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h2.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells('A3:H3');
    const h3 = ws.getCell('A3');
    h3.value = `Generated: ${new Date().toLocaleDateString('en-US', {dateStyle:'full'})}  |  System Prepared`;
    h3.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF94A3B8' } };
    h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h3.alignment = { vertical: 'middle', horizontal: 'center' };
    h3.border = { bottom: { style: 'thick', color: { argb: 'FF' + this.colors.blue } } };

    ws.getRow(1).height = 32; ws.getRow(2).height = 22; ws.getRow(3).height = 22;

    let totalOrders = 0, totalPayroll = 0, ridersWithWarnings = 0, companyCount = 0, flCount = 0;
    payroll.forEach(p => {
      totalOrders += (p.total_orders || 0);
      totalPayroll += (p.calculated_salary || 0);
      if ((p.deductions || 0) > 0 || (p.present_days || 0) < 26) ridersWithWarnings++;
      if (p.rider_type === 'company') companyCount++;
      else flCount++;
    });

    const createKPI = (cellHeader, cellValue, label, value, sub, valFormat) => {
      const ch = ws.getCell(cellHeader);
      ch.value = label;
      ch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a2744' } };
      ch.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      ch.alignment = { vertical: 'middle', horizontal: 'center' };

      const cv = ws.getCell(cellValue);
      cv.value = {
        richText: [
          { font: { name: 'Calibri', bold: true, size: 24, color: { argb: 'FF000000' } }, text: (valFormat === 'SAR' ? new Intl.NumberFormat('en-US').format(value) + ' SAR' : new Intl.NumberFormat('en-US').format(value)) + '\n' },
          { font: { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }, text: sub }
        ]
      };
      cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cv.border = { 
        bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } }, 
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }, 
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } } 
      };
      cv.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    };

    ws.getRow(4).height = 12; 
    ws.getRow(5).height = 24; 
    ws.getRow(6).height = 50; 
    ws.getRow(7).height = 20;

    ws.mergeCells('A5:B5'); ws.mergeCells('A6:B6');
    ws.mergeCells('C5:D5'); ws.mergeCells('C6:D6');
    ws.mergeCells('E5:F5'); ws.mergeCells('E6:F6');
    ws.mergeCells('G5:H5'); ws.mergeCells('G6:H6');

    createKPI('A5', 'A6', 'OPERATIONAL STRENGTH', payroll.length, `Active: ${companyCount} Staff | ${flCount} FL`, null);
    createKPI('C5', 'C6', 'SYSTEM THROUGHPUT', totalOrders, 'Total Orders Processed', 'NUM');
    createKPI('E5', 'E6', 'FINANCIAL DISBURSEMENT', totalPayroll, 'Total Payroll Liability', 'SAR');
    createKPI('G5', 'G6', 'OPERATIONAL EXCEPTIONS', ridersWithWarnings, 'Attendance/Debt Alerts', null);

    // --- 1. WAREHOUSE PERFORMANCE SNAPSHOT ---
    let rowNum = 9;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec1 = ws.getCell(`A${rowNum}`);
    sec1.value = ' PERFORMANCE BY LOGISTICS WAREHOUSE / HUB';
    sec1.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1e3a8a' } };
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
    sec1.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    const branchStats = {};
    payroll.forEach(p => {
      if (p.rider_type !== 'company') return;
      const rider = riders.find(r => String(r.id) === String(p.rider_id));
      const branch = this.getBranchName(p.client_company, rider);
      if (!branch || branch.toLowerCase() === 'other') return;
      
      if (!branchStats[branch]) branchStats[branch] = { riders: 0, orders: 0, present: 0, deductions: 0, payout: 0 };
      branchStats[branch].riders++;
      branchStats[branch].orders += (p.total_orders || 0);
      branchStats[branch].present += (p.present_days || 0);
      branchStats[branch].deductions += (p.deductions || 0);
      branchStats[branch].payout += (p.calculated_salary || 0);
    });

    rowNum++;
    const headerRow = ws.getRow(rowNum);
    headerRow.values = ['Warehouse / Zone', 'Total Riders', 'Avg Orders', 'Avg Days', 'Total Deductions', 'Total Payout'];
    headerRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(c => { 
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a2744' } }; 
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 24;

    rowNum++;
    let alt = false;
    let sumRiders=0, sumOrders=0, sumPresent=0, sumDed=0, sumPayout=0;
    const sortedBranches = Object.entries(branchStats).sort((a, b) => b[1].orders - a[1].orders);

    for (const [branch, stats] of sortedBranches) {
      const rRow = ws.getRow(rowNum);
      const avgOrders = stats.riders ? (stats.orders / stats.riders) : 0;
      const avgAtt = stats.riders ? (stats.present / stats.riders) : 0;
      
      rRow.values = [branch, stats.riders, avgOrders, avgAtt, 0, 0];
      for (let i = 1; i <= 6; i++) {
        const c = rRow.getCell(i);
        c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
        c.fill = { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: alt ? 'FFFFFFFF' : 'FFF3F4F6' } 
        };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      
      const c1 = rRow.getCell(1);
      c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      c1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1a2744' } };
      
      rRow.getCell(3).numFmt = '0.0';
      rRow.getCell(4).numFmt = '0.0';
      
      this.setSAR(rRow.getCell(5), stats.deductions);
      this.setSAR(rRow.getCell(6), stats.payout);
      rRow.height = 26;
      
      sumRiders += stats.riders; sumOrders += stats.orders; sumPresent += stats.present; sumDed += stats.deductions; sumPayout += stats.payout;
      rowNum++; alt = !alt;
    }

    const tRow = ws.getRow(rowNum);
    tRow.values = ['GRAND TOTALS', sumRiders, sumRiders ? (sumOrders/sumRiders) : 0, sumRiders ? (sumPresent/sumRiders) : 0, 0, 0];
    tRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    tRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a2744' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    tRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    tRow.getCell(3).numFmt = '0.0';
    tRow.getCell(4).numFmt = '0.0';
    this.setSAR(tRow.getCell(5), sumDed);
    this.setSAR(tRow.getCell(6), sumPayout);
    tRow.height = 28;

    // --- 2. TOP PERFORMERS RECOGNITION ---
    rowNum += 3;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec2 = ws.getCell(`A${rowNum}`);
    sec2.value = ' TOP PERFORMING RIDERS — RECOGNITION FOR EXCELLENCE';
    sec2.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF166534' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
    sec2.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    rowNum++;
    const topHeader = ws.getRow(rowNum);
    topHeader.values = ['Rank & Rider Name', 'Warehouse', 'Orders Logged', 'Attendance', 'Cycle Status', 'Net Payout'];
    topHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    topHeader.eachCell(c => { 
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } }; 
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    topHeader.height = 24;

    const topRiders = [...payroll]
      .sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0))
      .slice(0, 10);

    rowNum++;
    alt = false;
    topRiders.forEach((p, idx) => {
      const rider = riders.find(r => String(r.id) === String(p.rider_id));
      const tr = ws.getRow(rowNum);
      const warehouse = this.getBranchName(p.client_company, rider);
      
      tr.values = [
        `${idx + 1}. ${p.rider_name}`,
        warehouse,
        p.total_orders,
        p.present_days,
        (p.payment_status || 'pending').toUpperCase(),
        0
      ];
      
      for (let i = 1; i <= 6; i++) {
        const c = tr.getCell(i);
        c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
        c.fill = { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: alt ? 'FFFFFFFF' : 'FFF7FEE7' } 
        };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      
      const tc1 = tr.getCell(1);
      tc1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      tc1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF166534' } };
      
      this.setSAR(tr.getCell(6), p.calculated_salary);
      tr.height = 26;
      rowNum++; alt = !alt;
    });

    // --- 3. FREELANCER OPERATIONAL SUMMARY ---
    rowNum += 3;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec3 = ws.getCell(`A${rowNum}`);
    sec3.value = ' FREELANCER / EXTERNAL OPERATIONAL SUMMARY';
    sec3.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF7c2d12' } };
    sec3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };
    sec3.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    rowNum++;
    const flHeader = ws.getRow(rowNum);
    flHeader.values = ['Associate Name', 'Days Present', 'Orders Handled', 'Account Status', '', 'Net Payout'];
    flHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    flHeader.eachCell(c => { 
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7c2d12' } }; 
      c.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    flHeader.height = 24;

    rowNum++;
    alt = false;
    const freelancers = payroll.filter(p => p.rider_type !== 'company');
    if (freelancers.length === 0) {
      ws.mergeCells(`A${rowNum}:H${rowNum}`);
      ws.getCell(`A${rowNum}`).value = 'No external associate data for this cycle';
      ws.getCell(`A${rowNum}`).alignment = { horizontal: 'center' };
      rowNum++;
    } else {
      freelancers.forEach(p => {
        const fr = ws.getRow(rowNum);
        fr.values = [p.rider_name, p.present_days, p.total_orders, (p.payment_status || 'pending').toUpperCase(), '', 0];
        for (let i = 1; i <= 6; i++) {
          const c = fr.getCell(i);
          c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
          c.fill = { 
            type: 'pattern', 
            pattern: 'solid', 
            fgColor: { argb: alt ? 'FFFFFFFF' : 'FFFFF7ED' } 
          };
          c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          c.alignment = { vertical: 'middle', horizontal: i===1?'left':'center', indent: i===1?1:0 };
        }
        if (fr.getCell(1)) fr.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF000000' } };
        this.setSAR(fr.getCell(6), p.calculated_salary);
        fr.height = 26;
        rowNum++; alt = !alt;
      });
    }
    // --- 4. CRITICAL OPERATIONAL WARNINGS ---
    rowNum += 3;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec4 = ws.getCell(`A${rowNum}`);
    sec4.value = ' CRITICAL OPERATIONAL WARNINGS & EXCEPTIONS';
    sec4.font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF991B1B' } };
    sec4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    sec4.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    rowNum++;
    const warnHeader = ws.getRow(rowNum);
    warnHeader.values = ['Rider Name', 'Warehouse', 'Type', 'Warning Details', '', '', '', ''];
    warnHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    warnHeader.eachCell((c, col) => {
      if (col <= 8) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
    ws.mergeCells(`D${rowNum}:H${rowNum}`);
    warnHeader.height = 24;

    const ridersWithWarn = payroll.filter(p => p.warnings && p.warnings.length > 0);
    
    if (ridersWithWarn.length === 0) {
      rowNum++;
      ws.mergeCells(`A${rowNum}:H${rowNum}`);
      const noWarn = ws.getCell(`A${rowNum}`);
      noWarn.value = 'No operational warnings for this cycle ✅';
      noWarn.font = { name: 'Calibri', italic: true, size: 11, color: { argb: 'FF16A34A' } };
      noWarn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FEE7' } };
      noWarn.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(rowNum).height = 30;
    } else {
      let wAlt = false;
      ridersWithWarn.forEach(p => {
        const rider = riders.find(r => String(r.id) === String(p.rider_id)) || {};
        const warehouse = this.getBranchName(p.client_company, rider);
        
        p.warnings.forEach(w => {
          rowNum++;
          const wr = ws.getRow(rowNum);
          wr.values = [p.rider_name, warehouse, w.type.toUpperCase(), w.message, '', '', '', ''];
          ws.mergeCells(`D${rowNum}:H${rowNum}`);
          
          for (let i = 1; i <= 8; i++) {
            const c = wr.getCell(i);
            c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wAlt ? 'FFFFFFFF' : 'FFFEF2F2' } };
            c.border = { bottom: { style: 'thin', color: { argb: 'FFFECACA' } } };
            c.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          wr.getCell(1).font = { name: 'Calibri', size: 10, bold: true };
          wr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          wr.getCell(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFB91C1C' } };
          wr.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
          wr.height = 36;
          wAlt = !wAlt;
        });
      });
    }

    ws.views = [{ state: 'frozen', ySplit: 3 }];
    ws.autoFilter = 'A10:H10';
  },

  // ---------------------------------------------------------
  // SHEET 1B: UNSETTLED DEDUCTIONS
  // ---------------------------------------------------------
  buildUnsettledDeductions(ws, riders, expenses) {
    ws.columns = [
      { width: 25 }, { width: 18 }, { width: 16 }, { width: 14 },
      { width: 22 }, { width: 16 }, { width: 18 }, { width: 30 }
    ];

    // --- MAIN HEADER (Consistent with Overview) ---
    ws.mergeCells('A1:H1');
    const h1 = ws.getCell('A1');
    h1.value = 'RIDER DEDUCTIONS & ADVANCES — PENDING SETTLEMENT';
    h1.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h1.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells('A2:H2');
    const h2 = ws.getCell('A2');
    h2.value = `Master Debt Ledger  |  As of ${new Date().toLocaleDateString('en-US', {dateStyle:'medium'})}`;
    h2.font = { name: 'Calibri', size: 11, color: { argb: 'FFCBD5E1' } };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h2.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells('A3:H3');
    const h3 = ws.getCell('A3');
    h3.value = `Total Outstanding Balance for all active and inactive riders across all cycles.`;
    h3.font = { name: 'Calibri', italic: true, size: 10, color: { argb: 'FF94A3B8' } };
    h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    h3.alignment = { vertical: 'middle', horizontal: 'center' };
    h3.border = { bottom: { style: 'thick', color: { argb: 'FFDC2626' } } }; // Red border for debt

    ws.getRow(1).height = 28; ws.getRow(2).height = 20; ws.getRow(3).height = 20;

    const unsettled = expenses.filter(e => !e.deductionSettled && e.rider_id && (e.is_deductible === 1 || e.is_deductible === true));

    // Data Processing for Summary
    const riderSummary = {};
    let totalPending = 0;
    let oldestDays = 0;
    let oldestRider = '';

    unsettled.forEach(e => {
      const rider = riders.find(rid => String(rid.id) === String(e.rider_id));
      const rName = rider ? rider.name : 'Unknown';
      const warehouse = rider ? this.getBranchName(rider.client_company, rider) : 'Other';
      const amount = parseFloat(e.amount || 0);
      totalPending += amount;

      if (!riderSummary[rName]) {
        riderSummary[rName] = { name: rName, warehouse, advances: 0, other: 0, total: 0, count: 0, oldest: 9999999, oldestDate: null };
      }
      
      const isAdvance = (e.category || '').toLowerCase().includes('advance');
      if (isAdvance) riderSummary[rName].advances += amount;
      else riderSummary[rName].other += amount;
      riderSummary[rName].total += amount;
      riderSummary[rName].count++;

      const dObj = new Date(e.expense_date || e.created_at);
      const daysOut = Math.floor((new Date() - dObj) / (1000 * 60 * 60 * 24));
      if (daysOut > oldestDays) {
        oldestDays = daysOut;
        oldestRider = rName;
      }
      if (daysOut < riderSummary[rName].oldest) { // Actually oldest date is largest daysOut
         // We'll track largest daysOut
      }
      riderSummary[rName].oldest = Math.max(riderSummary[rName].oldest === 9999999 ? 0 : riderSummary[rName].oldest, daysOut);
    });

    const ridersSet = Object.keys(riderSummary);
    const avgAmount = ridersSet.length > 0 ? (totalPending / ridersSet.length) : 0;

    // --- KPI CARDS ---
    const createKPI = (cellHeader, cellValue, label, value, sub, color) => {
      const ch = ws.getCell(cellHeader);
      ch.value = label;
      ch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a2744' } };
      ch.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      ch.alignment = { vertical: 'middle', horizontal: 'center' };

      const cv = ws.getCell(cellValue);
      cv.value = {
        richText: [
          { font: { name: 'Calibri', bold: true, size: 20, color: { argb: color } }, text: value + '\n' },
          { font: { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } }, text: sub }
        ]
      };
      cv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F1' } };
      cv.border = { bottom: { style: 'medium', color: { argb: 'FFFCA5A5' } } };
      cv.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    };

    ws.getRow(5).height = 22; ws.getRow(6).height = 45;
    ws.mergeCells('A5:B5'); ws.mergeCells('A6:B6');
    ws.mergeCells('C5:D5'); ws.mergeCells('C6:D6');
    ws.mergeCells('E5:F5'); ws.mergeCells('E6:F6');
    ws.mergeCells('G5:H5'); ws.mergeCells('G6:H6');

    createKPI('A5', 'A6', 'TOTAL OUTSTANDING', `SAR ${new Intl.NumberFormat('en-US').format(totalPending)}`, 'Global Pending Deductions', 'FFDC2626');
    createKPI('C5', 'C6', 'ACTIVE DEBTORS', ridersSet.length.toString(), 'Total Riders with Debt', 'FF991B1B');
    createKPI('E5', 'E6', 'LONGEST AGING', `${oldestDays} Days`, `Oldest: ${oldestRider}`, 'FFB91C1C');
    createKPI('G5', 'G6', 'AVERAGE DEBT', `SAR ${Math.round(avgAmount)}`, 'Per-Rider Exposure', 'FFDC2626');

    // --- SECTION A: SUMMARY BY RIDER ---
    let rowNum = 8;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec1 = ws.getCell(`A${rowNum}`);
    sec1.value = ' RIDER DEBT SUMMARY (CUMULATIVE ADVANCES & DEDUCTIONS)';
    sec1.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };
    sec1.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    rowNum++;
    const sHeader = ws.getRow(rowNum);
    sHeader.values = ['Rider Name', 'Warehouse', 'Total Advances', 'Other Deductions', 'Total Outstanding', 'Items', 'Oldest Aging', 'Status'];
    sHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    sHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a2744' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    sHeader.height = 24;

    rowNum++;
    let alt = false;
    const sortedSummary = Object.values(riderSummary).sort((a, b) => b.total - a.total);
    
    sortedSummary.forEach(s => {
      const sr = ws.getRow(rowNum);
      const status = s.total > 1500 ? 'CRITICAL' : (s.oldest > 30 ? 'OVERDUE' : 'NORMAL');
      sr.values = [s.name, s.warehouse, 0, 0, 0, s.count, `${s.oldest} days`, status];
      
      for (let i = 1; i <= 8; i++) {
        const c = sr.getCell(i);
        c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alt ? 'FFFFFFFF' : 'FFFEF2F2' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFFECACA' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      
      sr.getCell(1).font = { bold: true };
      sr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      
      this.setSAR(sr.getCell(3), s.advances);
      this.setSAR(sr.getCell(4), s.other);
      this.setSAR(sr.getCell(5), s.total);
      
      const statCell = sr.getCell(8);
      if (status === 'CRITICAL') statCell.font = { bold: true, color: { argb: 'FFDC2626' } };
      else if (status === 'OVERDUE') statCell.font = { bold: true, color: { argb: 'FFB45309' } };

      sr.height = 24;
      rowNum++; alt = !alt;
    });

    // --- SECTION B: TRANSACTION LOG ---
    rowNum += 2;
    ws.mergeCells(`A${rowNum}:H${rowNum}`);
    const sec2 = ws.getCell(`A${rowNum}`);
    sec2.value = ' DETAILED TRANSACTION LOG (ALL UNSETTLED ITEMS)';
    sec2.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1a2744' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    sec2.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(rowNum).height = 24;

    rowNum++;
    const tHeader = ws.getRow(rowNum);
    tHeader.values = ['Rider Name', 'Warehouse', 'Category', 'Date Incurred', 'Cycle Period', 'Amount (SAR)', 'Aging', 'Notes'];
    tHeader.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    tHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    tHeader.height = 24;

    rowNum++;
    alt = false;
    unsettled.sort((a, b) => {
      const rA = riders.find(rid => String(rid.id) === String(a.rider_id))?.name || 'Unknown';
      const rB = riders.find(rid => String(rid.id) === String(b.rider_id))?.name || 'Unknown';
      if (rA !== rB) return rA.localeCompare(rB);
      return new Date(b.expense_date || b.created_at) - new Date(a.expense_date || a.created_at); // Latest first
    });

    unsettled.forEach(e => {
      const rider = riders.find(rid => String(rid.id) === String(e.rider_id)) || {};
      const rName = rider.name || 'Unknown';
      const warehouse = this.getBranchName(rider.client_company, rider);
      const dObj = new Date(e.expense_date || e.created_at);
      const daysOut = Math.floor((new Date() - dObj) / (1000 * 60 * 60 * 24));
      
      const day = dObj.getDate();
      let cycleStart, cycleEnd;
      if (day >= 21) {
        cycleStart = new Date(dObj.getFullYear(), dObj.getMonth(), 21);
        cycleEnd = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 20);
      } else {
        cycleStart = new Date(dObj.getFullYear(), dObj.getMonth() - 1, 21);
        cycleEnd = new Date(dObj.getFullYear(), dObj.getMonth(), 20);
      }
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const cycleStr = `${monthNames[cycleStart.getMonth()]} 21 – ${monthNames[cycleEnd.getMonth()]} 20`;

      const tr = ws.getRow(rowNum);
      tr.values = [rName, warehouse, e.category || '', dObj.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}), cycleStr, parseFloat(e.amount || 0), `${daysOut} days`, e.notes || ''];
      
      for (let i = 1; i <= 8; i++) {
        const c = tr.getCell(i);
        c.font = { name: 'Calibri', size: 10, color: { argb: 'FF000000' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alt ? 'FFFFFFFF' : 'FFF8FAFC' } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      tr.getCell(1).font = { bold: true };
      tr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      
      this.setSAR(tr.getCell(6), e.amount);
      
      const agingCell = tr.getCell(7);
      if (daysOut >= 30) agingCell.font = { color: { argb: 'FFDC2626' }, bold: true };
      else if (daysOut >= 15) agingCell.font = { color: { argb: 'FFD97706' }, bold: true };

      tr.height = 24;
      rowNum++; alt = !alt;
    });

    ws.views = [{ state: 'frozen', ySplit: 3 }];
    ws.autoFilter = 'A11:H11';
  },

  // ---------------------------------------------------------
  // SHEET 2: PAYROLL SUMMARY
  // ---------------------------------------------------------
  buildPayrollSummary(ws, period, riders, payroll) {
    ws.columns = [
      { width: 4 }, { width: 22 }, { width: 16 }, { width: 14 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 35 }
    ];

    ws.mergeCells('A1:R2');
    const titleCell = ws.getCell('A1');
    titleCell.value = `PAYROLL SUMMARY  |  ${period.label}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // --- KPI SCORECARDS (Premium Dashboard Style) ---
    const totalGross = payroll.reduce((s, p) => s + (p.calculated_salary || 0), 0);
    const totalDed = payroll.reduce((s, p) => s + (p.deductions || 0), 0);
    const totalBonus = payroll.reduce((s, p) => s + (p.total_bonuses || 0), 0);
    const totalNet = (totalGross + totalBonus) - totalDed;
    const totalAllNet = payroll.reduce((s, p) => s + ((p.calculated_salary||0) + (p.total_bonuses||0) - (p.deductions||0)), 0);

    const cards = [
      { label: 'GROSS PAYOUT', val: totalGross, color: 'FF' + this.colors.blue, col: 'B' },
      { label: 'TOTAL BONUSES', val: totalBonus, color: 'FF10B981', col: 'G' },
      { label: 'ALL DEDUCTIONS', val: totalDed, color: 'FFEF4444', col: 'K' }
    ];

    cards.forEach(c => {
      const startCol = c.col;
      const endCol = String.fromCharCode(c.col.charCodeAt(0) + 3); // 4 columns wide
      ws.mergeCells(`${startCol}4:${endCol}5`);
      const cell = ws.getCell(`${startCol}4`);
      cell.value = { richText: [
        { text: `${c.label}\n`, font: { size: 8, color: { argb: 'FF64748B' }, bold: true } },
        { text: `SAR ${c.val.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`, font: { bold: true, size: 10, color: { argb: 'FF1E293B' } } }
      ]};
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { 
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: c.color } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    let rowNum = 8;
    const companyRiders = payroll.filter(p => (p.rider_type || '').toLowerCase() === 'company');
    const flRiders = payroll.filter(p => (p.rider_type || '').toLowerCase() !== 'company');

    ws.getCell(`B${rowNum}`).value = `COMPANY RIDERS (${companyRiders.length})`;
    ws.getCell(`B${rowNum}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF' + this.colors.blue } };
    rowNum++;

    const compHeaderVals = ['#', 'Rider Name', 'Warehouse', 'Phone', 'Present', 'Absent', 'W.O', 'Att %', 'P. Orders', 'A. Orders', 'T. Orders', 'Base Salary', 'Bonuses', 'Deductions', 'Net Payout', 'Avg Check-in', 'Status', 'Warnings (System Generated)'];
    
    const headerRow = ws.getRow(rowNum);
    headerRow.values = compHeaderVals;
    headerRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    headerRow.height = 32;

    rowNum++;
    let cTotPresent=0, cTotAbsent=0, cTotOrders=0, cTotBase=0, cTotDed=0, cTotNet=0;

    const fillCompanyData = () => {
      companyRiders.forEach((p, i) => {
        const rRow = ws.getRow(rowNum);
        const rider = riders.find(r => String(r.id) === String(p.rider_id)) || {};
        const attRate = p.present_days / 26; // Target 26 days
        const branch = this.getBranchName(p.client_company, rider);
        
        const netPay = (p.calculated_salary || 0) + (p.total_bonuses || 0) - (p.deductions || 0);
        const warningsStr = (p.warnings || []).map(w => w.message).join(' | ');
        rRow.values = [
          i + 1, p.rider_name, branch, rider.phone || '',
          p.present_days, p.absent_days, p.weekoff_days || 0, attRate,
          p.total_primary_orders, p.total_associate_orders, p.total_orders,
          p.base_salary || 0, p.total_bonuses || 0, p.deductions || 0, netPay,
          p.avg_checkin || '-', (p.payment_status || 'pending').toUpperCase(),
          warningsStr
        ];
        rRow.height = 22;
        rRow.font = { name: 'Calibri', size: 10 };
        const alt = i % 2 === 1;
        rRow.eachCell((c, col) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (alt ? 'F8FAFC' : 'FFFFFF') } };
          c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          c.alignment = { vertical: 'middle', horizontal: col===2?'left':'center' };
        });

        let statusColor = 'FF16A34A'; // PAID
        if (p.payment_status === 'pending') statusColor = 'FFD97706';
        else if (p.payment_status === 'partial') statusColor = 'FF7C3AED';
        rRow.getCell(1).border = { left: { style: 'medium', color: { argb: statusColor } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

        if (p.present_days < 26 && p.present_days > 0) rRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        if (p.present_days === 0) rRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        if (p.absent_days > 2) rRow.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        if (p.total_orders < 520) rRow.getCell(11).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        if (p.deductions > 0) rRow.getCell(14).font = { name: 'Calibri', size: 10, color: { argb: 'FFDC2626' } };
        if (p.total_bonuses > 0) rRow.getCell(13).font = { name: 'Calibri', size: 10, color: { argb: 'FF16A34A' } };
        
        this.setSAR(rRow.getCell(12), p.base_salary || 0);
        this.setSAR(rRow.getCell(13), p.total_bonuses || 0);
        this.setSAR(rRow.getCell(14), p.deductions || 0);
        this.setSAR(rRow.getCell(15), netPay);

        const nCell = rRow.getCell(15);
        nCell.font = { name: 'Calibri', bold: true, size: 10 };
        if (netPay >= (p.base_salary||0)) nCell.font.color = { argb: 'FF16A34A' };
        else if (netPay > 0) nCell.font.color = { argb: 'FFD97706' };
        else if (netPay <= 0) nCell.font.color = { argb: 'FFDC2626' };

        const arCell = rRow.getCell(8);
        arCell.value = attRate;
        arCell.numFmt = '0.0%';
        if (attRate >= 1) arCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF16A34A' } };
        else if (attRate >= 0.85) arCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFD97706' } };
        else arCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFDC2626' } };

        const stCell = rRow.getCell(17);
        stCell.font = { name: 'Calibri', bold: true, size: 9 };
        if (p.payment_status === 'paid') { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; stCell.font.color = { argb: 'FF16A34A' }; }
        else if (p.payment_status === 'pending') { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; stCell.font.color = { argb: 'FFD97706' }; }
        else { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; stCell.font.color = { argb: 'FFDC2626' }; }

        const warnCell = rRow.getCell(18);
        warnCell.font = { name: 'Calibri', size: 9, italic: true };
        if (warningsStr) {
          warnCell.font.color = { argb: 'FFDC2626' };
          warnCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        }

        cTotPresent += p.present_days; cTotAbsent += (p.absent_days||0); cTotOrders += p.total_orders; 
        cTotBase += (p.base_salary||0); cTotDed += (p.deductions||0); cTotNet += netPay;

        rowNum++;
      });
    };

    fillCompanyData();

    // Company Totals
    const cTotBonus = companyRiders.reduce((s,p) => s + (p.total_bonuses||0), 0);
    const tRow = ws.getRow(rowNum);
    tRow.values = ['', 'COMPANY TOTALS', '', '', cTotPresent, cTotAbsent, '', '', '', '', cTotOrders, 0, 0, 0, 0, '', ''];
    tRow.font = { name: 'Calibri', bold: true, size: 10 };
    tRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
    tRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    this.setSAR(tRow.getCell(12), cTotBase); this.setSAR(tRow.getCell(13), cTotBonus); this.setSAR(tRow.getCell(14), cTotDed); this.setSAR(tRow.getCell(15), cTotNet);
    tRow.height = 24;
    rowNum += 3;

    // Freelancers
    ws.getCell(`B${rowNum}`).value = `FREELANCERS (${flRiders.length})`;
    ws.getCell(`B${rowNum}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF4C1D95' } };
    rowNum++;

    const flHeaderVals = ['#', 'Rider Name', 'Warehouse', 'Phone', 'Present', 'Absent', 'W.O', 'Orders', 'Rate/Order', 'Bonuses', 'Deductions', 'Net Payout', 'Avg Check-in', 'Status', 'Warnings (System Generated)'];
    const flHeaderRow = ws.getRow(rowNum);
    flHeaderRow.values = flHeaderVals;
    flHeaderRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    flHeaderRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });
    flHeaderRow.height = 32;
    rowNum++;

    flRiders.forEach((p, i) => {
      const rRow = ws.getRow(rowNum);
      const rider = riders.find(r => String(r.id) === String(p.rider_id)) || {};
      const branch = this.getBranchName(p.client_company, rider);
      
      const flNetPay = (p.calculated_salary || 0) + (p.total_bonuses || 0) - (p.deductions || 0);

      const warningsStr = (p.warnings || []).map(w => w.message).join(' | ');

      rRow.values = [
        i + 1, p.rider_name, branch, rider.phone || '',
        p.present_days, p.absent_days, p.weekoff_days || 0,
        p.total_orders, 6.8, p.total_bonuses || 0, p.deductions || 0, flNetPay,
        p.avg_checkin || '-', (p.payment_status || 'pending').toUpperCase(),
        warningsStr
      ];
      rRow.height = 22;
      rRow.font = { name: 'Calibri', size: 10 };
      const alt = i % 2 === 1;
      rRow.eachCell((c, col) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (alt ? 'F8FAFC' : 'FFFFFF') } };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: col===2?'left':'center' };
      });

      this.setSAR(rRow.getCell(9), 6.8);
      this.setSAR(rRow.getCell(10), p.total_bonuses || 0);
      this.setSAR(rRow.getCell(11), p.deductions || 0);
      this.setSAR(rRow.getCell(12), flNetPay);
      if (p.total_bonuses > 0) rRow.getCell(10).font = { name: 'Calibri', size: 10, color: { argb: 'FF16A34A' } };
      if (p.deductions > 0) rRow.getCell(11).font = { name: 'Calibri', size: 10, color: { argb: 'FFDC2626' } };
      rRow.getCell(12).font = { name: 'Calibri', bold: true, size: 10, color: { argb: flNetPay > 0 ? 'FF16A34A' : 'FFDC2626' } };

      const stCell = rRow.getCell(14);
      stCell.font = { name: 'Calibri', bold: true, size: 9 };
      if (p.payment_status === 'paid') { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; stCell.font.color = { argb: 'FF16A34A' }; }
      else if (p.payment_status === 'pending') { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; stCell.font.color = { argb: 'FFD97706' }; }
      else { stCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; stCell.font.color = { argb: 'FFDC2626' }; }

      const warnCell = rRow.getCell(15);
      warnCell.font = { name: 'Calibri', size: 9, italic: true };
      if (warningsStr) {
        warnCell.font.color = { argb: 'FFDC2626' };
        warnCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
      }

      rowNum++;
    });

    // Grand total
    rowNum += 2;
    ws.mergeCells(`A${rowNum}:D${rowNum}`);
    const gtRow = ws.getRow(rowNum);
    gtRow.getCell(1).value = 'GRAND TOTAL NET PAYOUT';
    gtRow.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= 17; c++) {
      gtRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
      gtRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' };
    }
    gtRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 2 };
    this.setSAR(gtRow.getCell(15), totalAllNet);
    gtRow.getCell(15).font = { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF10B981' } };
    gtRow.height = 28;

    ws.autoFilter = 'A9:R9';
    ws.views = [{ state: 'frozen', ySplit: 9 }];
  },

  // ---------------------------------------------------------
  // SHEET 3: ATTENDANCE GRID
  // ---------------------------------------------------------
  buildAttendanceGrid(ws, period, riders, allLogs) {
    const dates = [];
    const sD = new Date(period.start + 'T00:00:00');
    const eD = new Date(period.end + 'T00:00:00');
    for (let d = new Date(sD); d <= eD; d.setDate(d.getDate() + 1)) {
      dates.push({
        full: Utils.toLocalDateStr(d),
        dayObj: new Date(d)
      });
    }

    const totalCols = 3 + dates.length + 3;
    const colLetter = (n) => {
      let s = '';
      while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
      return s;
    };
    const lastCol = colLetter(totalCols);

    ws.mergeCells(`A1:${lastCol}2`);
    const titleCell = ws.getCell('A1');
    titleCell.value = `ATTENDANCE GRID  |  ${period.label}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = ws.getRow(4);
    const dayRow = ws.getRow(5);
    headerRow.height = 36;
    dayRow.height = 12;

    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 4;
    ws.getColumn(3).width = 14;

    headerRow.getCell(1).value = 'Rider Name';
    headerRow.getCell(2).value = 'Type';
    headerRow.getCell(3).value = 'Branch';

    for(let i=1; i<=3; i++) {
      headerRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      headerRow.getCell(i).font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      headerRow.getCell(i).alignment = { vertical: 'middle', horizontal: 'center' };
    }

    let colIdx = 4;
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dayNamesShort = ["S", "M", "T", "W", "T", "F", "S"];

    dates.forEach(date => {
      ws.getColumn(colIdx).width = 5;
      const c = headerRow.getCell(colIdx);
      const isWeekend = date.dayObj.getDay() === 5 || date.dayObj.getDay() === 6;
      
      c.value = `${date.dayObj.getDate()}\n${monthNamesShort[date.dayObj.getMonth()]}`;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isWeekend ? 'FF1E3A5F' : 'FF1E293B' } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      
      const dc = dayRow.getCell(colIdx);
      dc.value = dayNamesShort[date.dayObj.getDay()];
      dc.font = { name: 'Calibri', size: 8, color: { argb: 'FF6B7280' } };
      dc.alignment = { vertical: 'middle', horizontal: 'center' };
      
      colIdx++;
    });

    const sumColsStart = colIdx;
    ['Present', 'Absent', 'W.Off'].forEach((lbl, i) => {
      ws.getColumn(colIdx).width = 8;
      const c = headerRow.getCell(colIdx);
      c.value = lbl;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      colIdx++;
    });

    let rowNum = 6;
    const dailyTotals = new Array(dates.length).fill(0);

    const nowObj = new Date();
    nowObj.setHours(0,0,0,0);

    riders.forEach(r => {
      const rRow = ws.getRow(rowNum);
      rRow.height = 20;
      rRow.getCell(1).value = r.name;
      rRow.getCell(1).font = { name: 'Calibri', size: 10 };
      rRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      
      rRow.getCell(2).value = r.rider_type === 'company' ? 'Co' : 'FL';
      rRow.getCell(2).font = { name: 'Calibri', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
      rRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r.rider_type === 'company' ? 'FF2563EB' : 'FF7C3AED' } };
      rRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };

      rRow.getCell(3).value = this.getBranchName(r.client_company, r);
      rRow.getCell(3).font = { name: 'Calibri', size: 9, color: { argb: 'FF6B7280' } };
      rRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      let p=0, a=0, w=0;

      dates.forEach((date, i) => {
        const cCol = i + 4;
        const cell = rRow.getCell(cCol);
        const log = allLogs.find(l => {
          if (!l) return false;
          
          // 1. Normalize ID Match
          const l_id = l.rider_id !== undefined && l.rider_id !== null ? l.rider_id : (l.riderId !== undefined ? l.riderId : '');
          const idMatch = String(l_id).trim() === String(r.id || '').trim();
          
          // 2. Name Fallback (Just in case IDs are inconsistent)
          const l_name = (l.rider_name || l.riderName || '').toLowerCase().trim();
          const r_name = (r.name || '').toLowerCase().trim();
          const nameMatch = l_name === r_name;

          if (!idMatch && !nameMatch) return false;

          // 3. Normalize DB date to YYYY-MM-DD
          let raw = String(l.log_date || '').trim().replace(/\//g, '-');
          let l_date_norm = '';
          
          if (raw.includes('-')) {
            const parts = raw.split(' ')[0].split('-');
            if (parts.length === 3) {
              let y = parts[0], m = parts[1], d = parts[2];
              // If year is at the end (DD-MM-YYYY)
              if (y.length < 4 && d.length >= 2) {
                const temp = y; y = d; d = temp;
                if (y.length === 2) y = '20' + y; // Handle 2-digit year
              }
              l_date_norm = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }

          // Use startsWith to handle cases where log_date might have a time component
          return l_date_norm.startsWith(date.full);
        });
        
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Calibri', bold: true, size: 9 };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } }, right: { style: 'thin', color: { argb: 'FFF1F5F9' } } };

        if (date.dayObj.getTime() === nowObj.getTime()) {
          cell.border = { top: { style: 'medium', color: { argb: 'FF2563EB' } }, left: { style: 'medium', color: { argb: 'FF2563EB' } }, bottom: { style: 'medium', color: { argb: 'FF2563EB' } }, right: { style: 'medium', color: { argb: 'FF2563EB' } } };
        }

        if (log) {
          const status = (log.attendance_status || '').toLowerCase();
          if (status.includes('present') || status === 'p') {
            cell.value = 'P'; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF065F46' } };
            p++; dailyTotals[i]++;
          } else if (status.includes('off') || status.includes('week') || status === 'w') {
            cell.value = 'W'; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF1E40AF' } };
            w++;
          } else {
            cell.value = 'A'; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF991B1B' } };
            a++;
          }
        } else {
          if (date.dayObj <= nowObj) {
            cell.value = 'A'; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; cell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FF991B1B' } };
            a++;
          } else {
            cell.value = '-'; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF9CA3AF' } };
          }
        }
      });

      rRow.getCell(sumColsStart).value = p;
      rRow.getCell(sumColsStart+1).value = a;
      rRow.getCell(sumColsStart+2).value = w;

      for(let i=0; i<3; i++) {
        const c = rRow.getCell(sumColsStart+i);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
        c.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF0F172A' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      rowNum++;
    });

    // Daily Totals Row
    const tRow = ws.getRow(rowNum);
    tRow.height = 24;
    tRow.getCell(1).value = 'Daily Total Present';
    tRow.getCell(1).font = { name: 'Calibri', bold: true, size: 10 };
    tRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    
    dates.forEach((d, i) => {
      const c = tRow.getCell(i + 4);
      c.value = dailyTotals[i];
      c.font = { name: 'Calibri', bold: true, size: 9 };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      if (dailyTotals[i] < 25) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        c.font = { name: 'Calibri', bold: true, size: 9, color: { argb: 'FFDC2626' } };
      } else {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      }
    });

    ws.autoFilter = `A4:${lastCol}4`;
    ws.views = [{ state: 'frozen', ySplit: 5, xSplit: 3 }];
  },

  // ---------------------------------------------------------
  // SHEET 4: ORDERS BREAKDOWN
  // ---------------------------------------------------------
  buildOrdersBreakdown(ws, period, riders, payroll) {
    ws.columns = [
      { width: 8 }, { width: 22 }, { width: 16 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 },
      { width: 12 }, { width: 14 }, { width: 16 }
    ];

    ws.mergeCells('A1:K2');
    const titleCell = ws.getCell('A1');
    titleCell.value = `ORDERS BREAKDOWN & RANKING  |  ${period.label}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const companyRiders = payroll.filter(p => p.rider_type === 'company');
    const flRiders = payroll.filter(p => p.rider_type !== 'company');

    ws.getCell('A4').value = `COMPANY RIDERS RANKING`;
    ws.getCell('A4').font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF' + this.colors.blue } };

    const headerRow = ws.getRow(5);
    headerRow.values = ['Rank', 'Rider Name', 'Branch', 'Primary Orders', 'Associate Orders', 'Total Orders', 'Daily Avg', 'Target', 'Gap to Target', 'Achievement %', 'Performance Tier'];
    headerRow.height = 32;
    headerRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; });

    const sortedCo = [...companyRiders].sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0));

    let rowNum = 6;
    sortedCo.forEach((p, idx) => {
      const rRow = ws.getRow(rowNum);
      const rider = riders.find(r => String(r.id) === String(p.rider_id)) || {};
      const rank = idx + 1;
      const target = 520;
      const total = p.total_orders || 0;
      const dailyAvg = p.present_days ? (total / p.present_days) : 0;
      const gap = total - target;
      const ach = total / target;

      let tier = 'BRONZE'; let tierColor = 'FF78350F'; let tierBg = 'FFFFEDD5';
      if (total >= 600) { tier = 'ELITE'; tierColor = 'FFDB2777'; tierBg = 'FFFDF2F8'; }
      else if (total >= 520) { tier = 'GOLD'; tierColor = 'FFD97706'; tierBg = 'FFFFFBEB'; }
      else if (total >= 400) { tier = 'SILVER'; tierColor = 'FF475569'; tierBg = 'FFF8FAFC'; }

      rRow.values = [rank, p.rider_name, this.getBranchName(p.client_company, rider), p.total_primary_orders, p.total_associate_orders, total, 0, target, 0, 0, tier];
      rRow.height = 22;
      rRow.font = { name: 'Calibri', size: 10 };
      rRow.eachCell(c => { c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
      rRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const rkCell = rRow.getCell(1);
      rkCell.font = { name: 'Calibri', bold: true, size: 10 };
      if (rank <= 3) { rkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }; }
      else if (rank <= 10) { rkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; }

      const avgCell = rRow.getCell(7);
      avgCell.value = dailyAvg;
      avgCell.numFmt = '0.0';

      const gapCell = rRow.getCell(9);
      gapCell.value = gap;
      if (gap > 0) { gapCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } }; }
      else if (gap < 0) { gapCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } }; }
      else { gapCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF6B7280' } }; }

      const achCell = rRow.getCell(10);
      achCell.value = ach;
      achCell.numFmt = '0.0%';
      achCell.font = { name: 'Calibri', bold: true, size: 10 };
      if (ach >= 1) { achCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; achCell.font.color = { argb: 'FF16A34A' }; }
      else if (ach >= 0.85) { achCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; achCell.font.color = { argb: 'FFD97706' }; }
      else { achCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; achCell.font.color = { argb: 'FFDC2626' }; }

      const tierCell = rRow.getCell(11);
      tierCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tierBg } };
      tierCell.font = { name: 'Calibri', bold: true, size: 9, color: { argb: tierColor } };

      rowNum++;
    });

    rowNum += 2;
    ws.getCell(`A${rowNum}`).value = `FREELANCER ORDERS RANKING`;
    ws.getCell(`A${rowNum}`).font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF4C1D95' } };
    rowNum++;

    const flHeaderRow = ws.getRow(rowNum);
    flHeaderRow.values = ['Rank', 'Rider Name', 'Branch', 'Primary Orders', 'Associate Orders', 'Total Orders', 'Daily Avg'];
    flHeaderRow.height = 32;
    flHeaderRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    flHeaderRow.eachCell((c, cIdx) => { 
      if (cIdx <= 7) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4C1D95' } }; 
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; 
      }
    });
    rowNum++;

    const sortedFl = [...flRiders].sort((a, b) => (b.total_orders || 0) - (a.total_orders || 0));
    sortedFl.forEach((p, idx) => {
      const rRow = ws.getRow(rowNum);
      const rider = riders.find(r => String(r.id) === String(p.rider_id)) || {};
      const rank = idx + 1;
      const total = p.total_orders || 0;
      const dailyAvg = p.present_days ? (total / p.present_days) : 0;

      rRow.values = [rank, p.rider_name, this.getBranchName(p.client_company, rider), p.total_primary_orders, p.total_associate_orders, total, 0];
      rRow.height = 22;
      rRow.font = { name: 'Calibri', size: 10 };
      rRow.eachCell((c, cIdx) => { 
        if (cIdx <= 7) {
          c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }; 
          c.alignment = { vertical: 'middle', horizontal: 'center' }; 
        }
      });
      rRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      const rkCell = rRow.getCell(1);
      rkCell.font = { name: 'Calibri', bold: true, size: 10 };

      const avgCell = rRow.getCell(7);
      avgCell.value = dailyAvg;
      avgCell.numFmt = '0.0';

      rowNum++;
    });

    ws.autoFilter = 'A5:K5';
    ws.views = [{ state: 'frozen', ySplit: 5 }];
  },

  // ---------------------------------------------------------
  // SHEET 5: DAILY LOG RAW
  // ---------------------------------------------------------
  buildDailyLogRaw(ws, period, riders, allLogs) {
    ws.columns = [
      { width: 18 }, { width: 22 }, { width: 16 }, { width: 14 },
      { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }
    ];

    ws.mergeCells('A1:I2');
    const titleCell = ws.getCell('A1');
    titleCell.value = `RAW DAILY LOGS  |  ${period.label}`;
    titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + this.colors.dark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = ws.getRow(3);
    headerRow.values = ['Date', 'Rider Name', 'Branch', 'Status', 'Primary Orders', 'Associate Orders', 'Total Orders', 'Check-in Time', 'Online Hours'];
    headerRow.height = 24;
    headerRow.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; c.alignment = { vertical: 'middle', horizontal: 'center' }; });

    // Format helpers
    const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
    const fmtTime = (t) => {
      if (!t) return '-';
      const match = String(t).match(/(\d{1,2}):(\d{2})/);
      if (!match) return t;
      let h = parseInt(match[1]), m = match[2];
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    };

    const validLogs = allLogs.filter(l => riders.some(r => String(r.id) === String(l.rider_id)));
    validLogs.sort((a, b) => {
      if (a.log_date !== b.log_date) return (a.log_date || '').localeCompare(b.log_date || '');
      const rA = riders.find(r => String(r.id) === String(a.rider_id));
      const rB = riders.find(r => String(r.id) === String(b.rider_id));
      return (rA?.name || '').localeCompare(rB?.name || '');
    });

    let rowNum = 4;
    validLogs.forEach((l, idx) => {
      const r = riders.find(rid => String(rid.id) === String(l.rider_id)) || {};
      const total = (l.primary_orders || 0) + (l.associate_orders || 0);
      const onlineHrs = parseFloat(l.checkin_hours || l.online_hours || 0);
      const checkinTime = fmtTime(l.checkin_time || l.check_in_time);
      const alt = idx % 2 === 1;

      const row = ws.getRow(rowNum);
      row.values = [fmtDate(l.log_date), r.name || '-', this.getBranchName(r.client_company, r), l.attendance_status, l.primary_orders || 0, l.associate_orders || 0, total, checkinTime, 0];
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.eachCell(c => {
        c.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

      if (l.attendance_status === 'Present') row.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
      else if (l.attendance_status === 'Absent' || l.attendance_status === 'Missed') row.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      else if (l.attendance_status === 'Week Off' || l.attendance_status === 'Day Off') row.getCell(4).font = { name: 'Calibri', size: 10, color: { argb: 'FF2563EB' } };

      const hrCell = row.getCell(9);
      hrCell.value = onlineHrs;
      hrCell.numFmt = '0.0';
      if (onlineHrs >= 11) { hrCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } }; }
      else if (onlineHrs > 0) { hrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF16A34A' } }; }

      rowNum++;
    });

    ws.autoFilter = 'A3:I3';
    ws.views = [{ state: 'frozen', ySplit: 3 }];
  }
};
