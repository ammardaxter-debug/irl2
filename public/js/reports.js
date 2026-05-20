// ========================================
//  REPORTS - PDF Generation Utility
// ========================================

const Reports = {
  async generateExpenseReport(period) {
    Utils.showLoading('Building report', 'This may take a few seconds');
    
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) throw new Error('PDF library not loaded. Check your internet connection and refresh.');
      
      const doc = new jsPDF('p', 'mm', 'a4');
      
      let start, end, title, lastStart, lastEnd, expenseEnd, expenseDateLabel;
      const now = new Date();
      
      if (period === 'this_month') {
        const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        start = cycle.start;
        end = cycle.end;
        
        // Expense-specific end: last day of the NEXT month after cycle start (21st→next month end)
        const _sObj = new Date(start + 'T00:00:00');
        const _expLastDay = new Date(_sObj.getFullYear(), _sObj.getMonth() + 2, 0);
        expenseEnd = `${_expLastDay.getFullYear()}-${String(_expLastDay.getMonth() + 1).padStart(2, '0')}-${String(_expLastDay.getDate()).padStart(2, '0')}`;
        expenseDateLabel = `${start} to ${expenseEnd}`;
        
        const cycleEndDate = new Date(end + 'T00:00:00');
        let monthName = cycleEndDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        title = `Financial Report — Cycle ${monthName} (${start} to ${end})`;
        
        const lastCycle = Utils.shiftPeriod(cycle.start, -1);
        lastStart = lastCycle.start;
        lastEnd = lastCycle.end;
      } else if (period === 'last_month') {
        const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        const lastCycle = Utils.shiftPeriod(cycle.start, -1);
        
        start = lastCycle.start;
        end = lastCycle.end;
        
        // Expense-specific end: last day of the NEXT month after cycle start
        const _sObj2 = new Date(start + 'T00:00:00');
        const _expLastDay2 = new Date(_sObj2.getFullYear(), _sObj2.getMonth() + 2, 0);
        expenseEnd = `${_expLastDay2.getFullYear()}-${String(_expLastDay2.getMonth() + 1).padStart(2, '0')}-${String(_expLastDay2.getDate()).padStart(2, '0')}`;
        expenseDateLabel = `${start} to ${expenseEnd}`;
        
        const lastCycleEndDate = new Date(end + 'T00:00:00');
        let monthName = lastCycleEndDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        title = `Financial Report — Cycle ${monthName} (${start} to ${end})`;
      } else {
        start = null; end = null; expenseEnd = null; expenseDateLabel = null;
        title = `Complete Financial History Report`;
      }

      const [expenses, funds, globalStats] = await Promise.all([
        API.getExpenses(start, expenseEnd || end),
        API.getFunds(start, end),
        API.getExpenseStats()
      ]);

      let lastTotalExp = null, lastTotalFunds = null;
      if (lastStart && lastEnd) {
        const _lsObj = new Date(lastStart + 'T00:00:00');
        const _lExpLastDay = new Date(_lsObj.getFullYear(), _lsObj.getMonth() + 2, 0);
        const lastExpenseEnd = `${_lExpLastDay.getFullYear()}-${String(_lExpLastDay.getMonth() + 1).padStart(2, '0')}-${String(_lExpLastDay.getDate()).padStart(2, '0')}`;
        const [lastExpenses, lastFundsArray] = await Promise.all([
          API.getExpenses(lastStart, lastExpenseEnd),
          API.getFunds(lastStart, lastEnd)
        ]);
        lastTotalExp = lastExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        lastTotalFunds = lastFundsArray.reduce((sum, f) => sum + (f.amount || 0), 0);
      }

      // ═══════════════════════════════════════════
      // HEADER BANNER
      // ═══════════════════════════════════════════
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 45, 'F');
      
      // Accent stripe
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 42, 210, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('INSPIRING ROADS LOGISTICS', 20, 18);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Financial Audit & Expense Statement', 20, 26);
      
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}`, 20, 34);

      // ═══════════════════════════════════════════
      // REPORT TITLE
      // ═══════════════════════════════════════════
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title.toUpperCase(), 20, 58);
      
      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(20, 62, 190, 62);
      
      let currentY = 70;

      // ═══════════════════════════════════════════
      // SUMMARY BOX
      // ═══════════════════════════════════════════
      const totalExp = expenses.reduce((sum, e) => {
        if (e.category === 'Manual Deduction') return sum;
        return sum + (e.amount || 0);
      }, 0);
      const totalFunds = funds.reduce((sum, f) => sum + (f.amount || 0), 0);
      const net = totalFunds - totalExp;

      // Summary card background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, currentY, 170, 56, 3, 3, 'FD');
      
      // Column headers - Row 1 (Cycle Info)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('CYCLE RECEIVED', 35, currentY + 10);
      doc.text('CYCLE EXPENSES', 90, currentY + 10);
      doc.text('CYCLE NET STATUS', 150, currentY + 10);
      
      // Column values - Row 1
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      
      doc.setTextColor(5, 150, 105);
      doc.text(totalFunds.toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 35, currentY + 20);
      
      doc.setTextColor(225, 29, 72);
      doc.text(totalExp.toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 90, currentY + 20);
      
      if (net >= 0) {
        doc.setTextColor(5, 150, 105);
        doc.text('+' + net.toLocaleString('en-US') + ' SAR', 150, currentY + 20);
      } else {
        doc.setTextColor(225, 29, 72);
        doc.text('-' + Math.abs(net).toLocaleString('en-US') + ' SAR', 150, currentY + 20);
      }

      // Comparative (vs Last Month)
      if (lastTotalExp !== null && lastTotalFunds !== null) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        
        // Income diff
        const incDiff = totalFunds - lastTotalFunds;
        doc.setTextColor(incDiff >= 0 ? 5 : 225, incDiff >= 0 ? 150 : 29, incDiff >= 0 ? 105 : 72);
        doc.text(`vs ${lastTotalFunds.toLocaleString()} SAR last mo`, 35, currentY + 26);
        
        // Exp diff
        const expDiff = totalExp - lastTotalExp;
        doc.setTextColor(expDiff <= 0 ? 5 : 225, expDiff <= 0 ? 150 : 29, expDiff <= 0 ? 105 : 72);
        doc.text(`vs ${lastTotalExp.toLocaleString()} SAR last mo`, 90, currentY + 26);
      } else {
        // Status indicator fallback
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const statusText = net >= 0 ? 'SURPLUS' : 'DEFICIT';
        doc.text(statusText, 150, currentY + 26);
      }

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(25, currentY + 31, 185, currentY + 31);

      // Row 2 (Global Info)
      const gStats = globalStats || {
        total_received: 0,
        total_expenses: 0,
        remaining_irl: 0,
        from_my_pocket: 0
      };

      // Headers - Row 2
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('GLOBAL RECEIVED', 35, currentY + 38);
      doc.text('GLOBAL EXPENSES', 90, currentY + 38);
      if (gStats.from_my_pocket > 0) {
        doc.text('GLOBAL OUT OF POCKET', 150, currentY + 38);
      } else {
        doc.text('GLOBAL REMAINING', 150, currentY + 38);
      }

      // Column values - Row 2
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');

      // Global Received
      doc.setTextColor(5, 150, 105);
      doc.text((gStats.total_received || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 35, currentY + 48);

      // Global Expenses
      doc.setTextColor(225, 29, 72);
      doc.text((gStats.total_expenses || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 90, currentY + 48);

      // Global Balance (Remaining or Out of Pocket)
      if (gStats.from_my_pocket > 0) {
        doc.setTextColor(225, 29, 72);
        doc.text((gStats.from_my_pocket || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 150, currentY + 48);
      } else {
        doc.setTextColor(5, 150, 105);
        doc.text((gStats.remaining_irl || 0).toLocaleString('en-US', { minimumFractionDigits: 0 }) + ' SAR', 150, currentY + 48);
      }

      // Sub-text - Row 2
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('ALL-TIME', 35, currentY + 53);
      doc.text('ALL-TIME', 90, currentY + 53);
      if (gStats.from_my_pocket > 0) {
        doc.text('OWNER COVERED', 150, currentY + 53);
      } else {
        doc.text('UNSPENT BALANCE', 150, currentY + 53);
      }
      
      currentY += 68;

      // ═══════════════════════════════════════════
      // SECTION 1: FUNDS RECEIVED
      // ═══════════════════════════════════════════
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('1. FUNDS RECEIVED FROM COMPANY', 20, currentY);
      
      currentY += 3;

      if (funds.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No funds received in this period.', 25, currentY + 8);
        currentY += 18;
      } else {
        const fundsData = funds.map(f => [
          f.receive_date || '-',
          f.description || 'IRL Transfer',
          (f.amount || 0).toLocaleString('en-US') + ' SAR',
          f.notes || '-'
        ]);

        doc.autoTable({
          startY: currentY + 2,
          head: [['Date', 'Source / Description', 'Amount', 'Notes']],
          body: fundsData,
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246], 
            textColor: 255, 
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4
          },
          bodyStyles: { fontSize: 9, cellPadding: 3 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 30 },
            2: { cellWidth: 35, fontStyle: 'bold', halign: 'right' }
          },
          margin: { left: 20, right: 20 }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      }

      // ═══════════════════════════════════════════
      // SECTION 2: PENDING DEDUCTIONS (Advances / Food)
      // ═══════════════════════════════════════════
      // Aggregate deductible expenses by rider (EXCLUDE medical — company-covered)
      const deductions = {};
      const companyCovered = [];
      expenses.forEach(e => {
        const isMedical = (e.category || '').toLowerCase().includes('medical');
        if (isMedical) {
           companyCovered.push(e);
        } else if (e.is_deductible && e.rider_name) {
           if (!deductions[e.rider_name]) {
              deductions[e.rider_name] = { total: 0, items: [] };
           }
           deductions[e.rider_name].total += parseFloat(e.amount) || 0;
           deductions[e.rider_name].items.push(`${e.category}: ${e.amount} SAR`);
        }
      });
      
      const deductionRows = Object.keys(deductions).map(rider => {
        return [
           rider,
           deductions[rider].total.toLocaleString('en-US') + ' SAR',
           deductions[rider].items.join(', ')
        ];
      });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`2. PENDING RIDER DEDUCTIONS${expenseDateLabel ? ' (' + expenseDateLabel + ')' : ''}`, 20, currentY);
      
      currentY += 3;
      
      if (deductionRows.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No rider deductions recorded in this period.', 25, currentY + 8);
        currentY += 18;
      } else {
        doc.autoTable({
          startY: currentY + 2,
          head: [['Rider Name', 'Total to Deduct', 'Breakdown Summary (Why)']],
          body: deductionRows,
          theme: 'grid',
          headStyles: { 
            fillColor: [225, 29, 72], // Red header for deductions
            textColor: 255, 
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4
          },
          bodyStyles: { fontSize: 9, cellPadding: 3 },
          alternateRowStyles: { fillColor: [254, 242, 242] }, // Light red alt rows
          columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 35, fontStyle: 'bold', textColor: [225, 29, 72] }
          },
          margin: { left: 20, right: 20 }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      }

      // Check page break
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // ═══════════════════════════════════════════
      // SECTION 3: COMPANY-COVERED EXPENSES (Medical)
      // ═══════════════════════════════════════════
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`3. COMPANY-COVERED EXPENSES${expenseDateLabel ? ' (' + expenseDateLabel + ')' : ''}`, 20, currentY);

      currentY += 3;

      if (companyCovered.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No company-covered expenses (medical) in this period.', 25, currentY + 8);
        currentY += 18;
      } else {
        const ccTotal = companyCovered.reduce((s, e) => s + (e.amount || 0), 0);
        const ccData = companyCovered.map(e => {
          const dateStr = Utils.formatDateShort(e.expense_date) || '-';
          return [
            dateStr,
            e.category || '-',
            e.rider_name || e.vendor_name || 'General',
            (e.amount || 0).toLocaleString('en-US') + ' SAR',
            e.notes || '-'
          ];
        });
        // Add total row
        ccData.push(['', '', 'TOTAL COMPANY-COVERED', ccTotal.toLocaleString('en-US') + ' SAR', '']);

        doc.autoTable({
          startY: currentY + 2,
          head: [['Date', 'Category', 'Recipient', 'Amount', 'Notes']],
          body: ccData,
          theme: 'grid',
          headStyles: {
            fillColor: [5, 150, 105], // Green header — company paid
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4
          },
          bodyStyles: { fontSize: 9, cellPadding: 3 },
          alternateRowStyles: { fillColor: [240, 253, 244] }, // Light green rows
          columnStyles: {
            0: { cellWidth: 25 },
            3: { cellWidth: 30, fontStyle: 'bold', halign: 'right' }
          },
          margin: { left: 20, right: 20 },
          willDrawCell: (data) => {
            if (data.section === 'body' && data.row.index === ccData.length - 1) {
              doc.setFillColor(220, 252, 231);
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });
        currentY = doc.lastAutoTable.finalY + 12;
      }

      // Check page break explicitly before big table
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // ═══════════════════════════════════════════
      // SECTION 4: FULL EXPENSES LOG
      // ═══════════════════════════════════════════
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`4. FULL OPERATIONAL EXPENSES LOG${expenseDateLabel ? ' (' + expenseDateLabel + ')' : ''}`, 20, currentY);
      
      currentY += 3;

      if (expenses.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No expenses in this period.', 25, currentY + 8);
      } else {
        const expData = expenses.map(e => {
          const dateStr = Utils.formatDateShort(e.expense_date) || '-';
          const timeStr = e.created_at ? new Date(e.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
          return [
            timeStr ? `${dateStr}\n${timeStr}` : dateStr,
            e.category || '-',
            e.rider_name || e.vendor_name || 'General',
            e.is_deductible ? 'YES' : 'NO',
            (e.amount || 0).toLocaleString('en-US') + ' SAR',
            e.notes || '-'
          ];
        });

        doc.autoTable({
          startY: currentY + 2,
          head: [['Date / Time', 'Category', 'Recipient', 'Deduct.', 'Amount', 'Notes']],
          body: expData,
          theme: 'grid',
          headStyles: { 
            fillColor: [15, 23, 42], 
            textColor: 255, 
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 4
          },
          bodyStyles: { fontSize: 8, cellPadding: 3 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 25 },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 28, fontStyle: 'bold', halign: 'right' }
          },
          margin: { left: 20, right: 20 },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 3) {
              if (data.cell.raw === 'YES') {
                data.cell.styles.textColor = [225, 29, 72];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [5, 150, 105];
              }
            }
          }
        });
      }

      // ═══════════════════════════════════════════
      // SECTION 3: ANNEXURE A (RECEIPTS)
      // ═══════════════════════════════════════════
      const receiptsList = [
        ...funds.filter(f => f.receipt_base64).map(f => ({ ...f, display_type: 'Income (Fund)', display_name: f.description || 'IRL Transfer', display_date: f.receive_date })),
        ...expenses.filter(e => e.receipt_base64).map(e => ({ ...e, display_type: `Expense (${e.category})`, display_name: e.rider_name || e.vendor_name || 'General', display_date: e.expense_date }))
      ];

      if (receiptsList.length > 0) {
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('ANNEXURE A: CERTIFIED RECEIPTS', 20, 20);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(20, 23, 190, 23);
        
        let ry = 35;
        
        for(let i = 0; i < receiptsList.length; i++) {
          const rec = receiptsList[i];
          
          if (ry > 200) {
            doc.addPage();
            ry = 20;
          }
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(`Verified ${rec.display_type}: ${rec.amount.toLocaleString('en-US')} SAR`, 20, ry);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          const timeStr = rec.created_at ? new Date(rec.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
          doc.text(`Recorded: ${Utils.formatDate(rec.display_date)} ${timeStr ? 'at ' + timeStr : ''} | Info: ${Utils.escapeHtml(rec.display_name)}`, 20, ry + 5);
          
          try {
             doc.addImage(rec.receipt_base64, 'JPEG', 20, ry + 10, 80, 80);
             ry += 105;
          } catch(e) {
             doc.setTextColor(225, 29, 72);
             doc.text('[Attached Receipt Image Format Unsupported]', 20, ry + 15);
             ry += 30;
          }
        }
      }

      // ═══════════════════════════════════════════
      // FOOTER ON ALL PAGES
      // ═══════════════════════════════════════════
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(20, 282, 190, 282);
        
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${pageCount}  |  Inspiring Roads Logistics — Confidential Financial Document`,
          105, 287, { align: 'center' }
        );
      }

      const filename = `IRL_Financial_Report_${period}_${Utils.today()}.pdf`;
      Utils.downloadPDF(doc, filename);
      
      Utils.showToast('Report generated successfully!', 'success');
      Utils.hideLoading();
      
    } catch (err) {
      console.error('PDF Error:', err);
      Utils.showToast('Failed to generate PDF: ' + err.message, 'error');
      Utils.hideLoading();
    }
  },

  // ========================================
  //  MONTHLY PERFORMANCE REPORT
  // ========================================

  openMonthlyReportModal() {
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7);
    
    // We'll let them pick a month
    const html = `
      <form id="monthly-report-form" class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1;">
          <p class="text-sm text-muted" style="margin-bottom: 16px;">This will crunch attendance, completed orders, and performance data for all riders across the selected month and export a professional PDF profile.</p>
          <label>Select Report Month <span class="required">*</span></label>
          <input type="month" id="mr-month" class="form-control" value="${currentMonthStr}" max="${currentMonthStr}" required>
        </div>
        
        <div class="form-actions mt-24" style="grid-column: 1 / -1;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" style="background:var(--accent-600);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            Generate Report
          </button>
        </div>
      </form>
    `;

    Utils.openModal('Monthly Performance PDF', html);

    document.getElementById('monthly-report-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const monthStr = document.getElementById('mr-month').value;
      if (!monthStr) return;
      Utils.closeModal();
      this.generateMonthlyPerformanceReport(monthStr);
    });
  },

  async generateMonthlyPerformanceReport(monthStr) {
    Utils.showLoading('Building report', 'This may take a few seconds');
    
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) throw new Error('PDF library not loaded.');

      // Calculate start and end bounds (21st of prev month to 20th of chosen month)
      const [yStr, mStr] = monthStr.split('-');
      const y = parseInt(yStr);
      const m = parseInt(mStr);
      
      let prevMonth = m - 1;
      let prevYear = y;
      if (prevMonth === 0) {
        prevMonth = 12;
        prevYear -= 1;
      }
      
      const startDate = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-21`;
      const endDate = `${y}-${mStr}-20`;
      const dateLabelText = `${startDate} to ${endDate}`;

      // Fetch the payroll data for this specific month range
      const stats = await API.request(`/payroll?start=${startDate}&end=${endDate}`);
      
      const doc = new jsPDF('p', 'mm', 'a4');

      // ──────────────────────────────────────────
      // PAGE 1: EXECUTIVE SUMMARY
      // ──────────────────────────────────────────
      
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 45, 'F');
      
      doc.setFillColor(219, 39, 119); // vibrant pink/magenta accent
      doc.rect(0, 42, 210, 3, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('INSPIRING ROADS LOGISTICS', 20, 18);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Official Monthly Performance & Operations Report', 20, 26);
      
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Period: ${dateLabelText}`, 20, 34);

      // TITLE
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fleet Performance Summary`, 20, 60);
      
      // Kpi Stats Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, 70, 170, 30, 3, 3, 'FD');
      
      const activeRiders = stats.length;
      const totalPrimaryAll = stats.reduce((sum, r) => sum + r.total_primary_orders, 0);
      const totalAssociateAll = stats.reduce((sum, r) => sum + r.total_associate_orders, 0);
      const totalPayoutAll = stats.reduce((sum, r) => sum + r.calculated_salary, 0);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('ACTIVE RIDERS', 28, 80);
      doc.text('PRIMARY ORDERS', 72, 80);
      doc.text('ASSOC. ORDERS', 118, 80);
      doc.text('EST TOTAL PAYOUT', 160, 80);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${activeRiders}`, 28, 92);
      
      doc.setTextColor(59, 130, 246);
      doc.text(`${totalPrimaryAll.toLocaleString()}`, 72, 92);
      
      doc.setTextColor(147, 51, 234);
      doc.text(`${totalAssociateAll.toLocaleString()}`, 118, 92);
      
      doc.setTextColor(5, 150, 105);
      doc.text(`SR ${totalPayoutAll.toLocaleString()}`, 160, 92);

      // Ranking Section
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Top 7 Performing Riders', 20, 115);

      // Sort riders by orders
      const sortedRiders = [...stats].sort((a, b) => b.total_orders - a.total_orders).slice(0, 7);
      
      let curY = 125;
      
      for (let i = 0; i < sortedRiders.length; i++) {
        const rr = sortedRiders[i];
        
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(20, curY, 170, 16, 2, 2, 'F');
        
        const isTop3 = i < 3;
        
        // Large bold rank text
        doc.setTextColor(15, 23, 42); // Dark slate
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`#${i + 1}`, 26, curY + 11.5);
        
        let textStartX = 42;

        // Name and Stats
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.setFont('helvetica', isTop3 ? 'bold' : 'normal');
        doc.text(rr.rider_name, textStartX, curY + 10);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(`Type: ${rr.rider_type === 'company' ? 'Company' : 'Freelance'}`, textStartX + 50, curY + 10);
        
        doc.text(`Attendance: ${rr.present_days} days`, textStartX + 85, curY + 10);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`${rr.total_orders} Orders`, 185, curY + 10, { align: 'right' });
        
        curY += 20;
      }

      // Attention Required Section
      const poorRiders = [...stats].filter(r => r.present_days < 20 || r.total_orders < 250)
                                   .sort((a,b) => a.total_orders - b.total_orders).slice(0, 5);
      
      if (poorRiders.length > 0) {
        doc.addPage();
        let attnY = 20;

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Attention Required', 20, 16);
        
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text('Riders with Low Orders (< 250) or Low Attendance (< 20 days)', 20, 35);
        
        const attnData = poorRiders.map(r => [
          r.rider_name,
          r.client_company || 'N/A',
          `${r.present_days} days`,
          `${r.total_orders} orders`
        ]);

        doc.autoTable({
          startY: 42,
          head: [['Rider Name', 'Company', 'Attendance', 'Total Orders']],
          body: attnData,
          theme: 'grid',
          headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 10, cellPadding: 4 },
          bodyStyles: { fontSize: 10, cellPadding: 4 },
          margin: { left: 20, right: 20 }
        });
      }

      // ──────────────────────────────────────────
      // PAGE 2+: EXPERT EMPLOYEE BREAKDOWN
      // ──────────────────────────────────────────
      
      const allRoster = [...stats].sort((a,b) => a.rider_name.localeCompare(b.rider_name));
      
      let pageY = 280; // force new page on first loop

      for (const rider of allRoster) {
         // Check if we need a new page before starting a new rider
         if (pageY > 230) {
            doc.addPage();
            
            // Draw mini header for subsequent pages
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Employee Daily Performance Details', 20, 13);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(dateLabelText, 190, 13, { align: 'right' });
            
            pageY = 30;
         }

         // Fetch daily logs specifically for this rider within the period
         const logs = await API.request(`/daily-logs/rider/${rider.rider_id}?start=${startDate}&end=${endDate}`);
         
         // Rider Banner
         doc.setFillColor(241, 245, 249);
         doc.rect(15, pageY, 180, 12, 'F');
         
         doc.setTextColor(15, 23, 42);
         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.text(`${rider.rider_name} (${rider.client_company || 'N/A'})`, 18, pageY + 8);
         
         doc.setFontSize(9);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(100, 116, 139);
         doc.text(`Total Orders: ${rider.total_orders}  |  Days Present: ${rider.present_days}`, 190, pageY + 8, { align: 'right' });
         
         let dailyData = [];
         
         if (logs.length === 0) {
            dailyData = [['-','No logs recorded during this period','-','-','-']];
         } else {
            // Sort logs chronologically
            const sorted = [...logs].sort((a,b) => a.log_date.localeCompare(b.log_date));
            dailyData = sorted.map(l => {
              const totalOrdStr = l.attendance_status === 'Present' ? String((l.primary_orders || 0) + (l.associate_orders || 0)) : '-';
              const checkinStr = l.attendance_status === 'Present' ? `${l.checkin_hours || 0}:${String(l.checkin_minutes || 0).padStart(2,'0')}` : '-';
              return [
                l.log_date,
                l.attendance_status,
                l.attendance_status === 'Present' ? String(l.primary_orders || 0) : '-',
                l.attendance_status === 'Present' ? String(l.associate_orders || 0) : '-',
                totalOrdStr,
                checkinStr
              ];
            });
         }

         doc.autoTable({
           startY: pageY + 16,
           head: [['Date', 'Status', 'Primary', 'Assoc.', 'Total Orders', 'Check-in']],
           body: dailyData,
           theme: 'grid',
           headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, cellPadding: 2, halign: 'center' },
           bodyStyles: { fontSize: 8, cellPadding: 3, halign: 'center' },
           margin: { left: 15, right: 15 },
           didParseCell: (data) => {
              if (data.section === 'body' && data.column.index === 1) {
                 if (data.cell.raw === 'Absent') {
                    data.cell.styles.textColor = [225, 29, 72];
                    data.cell.styles.fontStyle = 'bold';
                 } else if (data.cell.raw === 'Present') {
                    data.cell.styles.textColor = [5, 150, 105];
                 }
              }
              if (data.section === 'body' && data.column.index === 4 && data.cell.raw !== '-') {
                 data.cell.styles.fontStyle = 'bold';
              }
           }
         });
         
         pageY = doc.lastAutoTable.finalY + 12;
      }

      // FOOTER PAGES
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 285, 195, 285);
        
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Page ${i} of ${pageCount}  |  Inspiring Roads Logistics — Official Internal Document`,
          105, 290, { align: 'center' }
        );
      }

      // Download Native
      let fileName = `Attendance_Report_${monthStr}.pdf`;
      Utils.downloadPDF(doc, fileName);
      
      Utils.showToast('Monthly Report downloaded successfully!', 'success');
      
    } catch (err) {
      console.error('PDF Error:', err);
      Utils.showToast('Failed to generate report: ' + err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  openSponsorReportModal() {
    const html = `
      <form id="sponsor-report-form" class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1;">
          <p class="text-sm text-muted" style="margin-bottom: 16px;">Generate a clean, organized financial report for your sponsor. Choose your preferred format below.</p>
          <label class="form-label" style="font-weight:600;">Report Period <span class="required">*</span></label>
          
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="sr-period" value="current" checked>
              <span>Current Cycle</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="sr-period" value="last">
              <span>Last Cycle</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="sr-period" value="all">
              <span>All Time (Full History)</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="radio" name="sr-period" value="custom">
              <span>Custom Range</span>
            </label>
          </div>
        </div>
        
        <div id="sr-custom-dates" style="display:none; grid-column: 1 / -1; display:flex; gap:16px;">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Start Date</label>
            <input type="date" id="sr-start" class="form-control">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">End Date</label>
            <input type="date" id="sr-end" class="form-control">
          </div>
        </div>

        <div class="form-group" style="grid-column: 1 / -1; margin-top:8px;">
          <label class="form-label" style="font-weight:600;">Export Format</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:14px 16px; border:2px solid #E5E7EB; border-radius:12px; transition:all 0.2s;" id="sr-format-pdf-label">
              <input type="radio" name="sr-format" value="pdf" checked>
              <div>
                <div style="font-weight:600; font-size:14px; color:#0F172A;">PDF Report</div>
                <div style="font-size:12px; color:#64748B; margin-top:2px;">Printable summary document</div>
              </div>
            </label>
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; padding:14px 16px; border:2px solid #E5E7EB; border-radius:12px; transition:all 0.2s;" id="sr-format-excel-label">
              <input type="radio" name="sr-format" value="excel">
              <div>
                <div style="font-weight:600; font-size:14px; color:#0F172A;">Excel Workbook</div>
                <div style="font-size:12px; color:#64748B; margin-top:2px;">Multi-sheet, filterable & organized</div>
              </div>
            </label>
          </div>
        </div>
        
        <div class="form-actions mt-24" style="grid-column: 1 / -1; display:flex; justify-content:flex-end; gap:12px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="sr-submit-btn" style="background:#1E3A8A; border-color:#1E3A8A;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            <span id="sr-submit-text">Generate PDF</span>
          </button>
        </div>
      </form>
    `;

    Utils.openModal('Sponsor Report', html);
    
    // Initial state
    document.getElementById('sr-custom-dates').style.display = 'none';

    // Format selection visual toggle
    const updateFormatStyle = () => {
      const val = document.querySelector('input[name="sr-format"]:checked').value;
      const pdfLabel = document.getElementById('sr-format-pdf-label');
      const excelLabel = document.getElementById('sr-format-excel-label');
      pdfLabel.style.borderColor = val === 'pdf' ? '#2563EB' : '#E5E7EB';
      pdfLabel.style.background = val === 'pdf' ? '#EFF6FF' : 'transparent';
      excelLabel.style.borderColor = val === 'excel' ? '#16A34A' : '#E5E7EB';
      excelLabel.style.background = val === 'excel' ? '#F0FDF4' : 'transparent';
      document.getElementById('sr-submit-text').textContent = val === 'pdf' ? 'Generate PDF' : 'Generate Excel';
      const btn = document.getElementById('sr-submit-btn');
      btn.style.background = val === 'pdf' ? '#1E3A8A' : '#16A34A';
      btn.style.borderColor = val === 'pdf' ? '#1E3A8A' : '#16A34A';
    };
    document.querySelectorAll('input[name="sr-format"]').forEach(r => r.addEventListener('change', updateFormatStyle));
    updateFormatStyle();

    document.querySelectorAll('input[name="sr-period"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
          document.getElementById('sr-custom-dates').style.display = 'flex';
          document.getElementById('sr-start').required = true;
          document.getElementById('sr-end').required = true;
        } else {
          document.getElementById('sr-custom-dates').style.display = 'none';
          document.getElementById('sr-start').required = false;
          document.getElementById('sr-end').required = false;
        }
      });
    });

    document.getElementById('sponsor-report-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const period = document.querySelector('input[name="sr-period"]:checked').value;
      const format = document.querySelector('input[name="sr-format"]:checked').value;
      let start, end;
      
      if (period === 'current') {
        const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        start = cycle.start;
        end = cycle.end;
      } else if (period === 'last') {
        const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        const lastCycle = Utils.shiftPeriod(cycle.start, -1);
        start = lastCycle.start;
        end = lastCycle.end;
      } else if (period === 'all') {
        start = null;
        end = null;
      } else {
        start = document.getElementById('sr-start').value;
        end = document.getElementById('sr-end').value;
      }
      
      Utils.closeModal();
      if (format === 'excel') {
        SponsorExcel.generate(start, end);
      } else {
        this.generateSponsorReport(start, end);
      }
    });
  },

  async generateSponsorReport(start, end) {
    Utils.showLoading('Generating Sponsor Report...', 'This may take a few seconds');
    
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) throw new Error('PDF library not loaded.');

      const [expenses, funds] = await Promise.all([
        API.getExpenses(start, end),
        API.getFunds(start, end)
      ]);

      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Calculate start and end date labels for header
      let monthYear = 'All Time';
      let cycleText = 'Complete Historical Record';
      if (start && end) {
        const startObj = new Date(start + 'T00:00:00');
        const endObj = new Date(end + 'T00:00:00');
        monthYear = startObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        cycleText = `${startObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }

      // ─────────────────────────────────────────────────────────────────
      // HELPER: Draw Header, Footer, Watermark on each page
      // ─────────────────────────────────────────────────────────────────
      const addPageDecorations = (pageNum) => {
        // Watermark
        doc.setTextColor(240, 240, 240);
        doc.setFontSize(60);
        doc.setFont('helvetica', 'bold');
        doc.text('CONFIDENTIAL', 105, 150, { angle: 45, align: 'center' });

        // Dark header bar
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 210, 25, 'F');
        
        // Footer
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, 285, 195, 285);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(`INSPIRING ROADS LOGISTICS  |  CONFIDENTIAL`, 20, 290);
        doc.text(`Page ${pageNum}`, 190, 290, { align: 'right' });
      };

      // ─────────────────────────────────────────────────────────────────
      // DATA PREPARATION
      // ─────────────────────────────────────────────────────────────────
      const totalFunds = funds.reduce((sum, f) => sum + (f.amount || 0), 0);
      
      // Separate Company vs Deductions
      const companyExpenses = [];
      const pendingDeductions = [];
      const settledDeductions = [];
      let totalCompany = 0;
      let totalActualDeductions = 0;
      let totalManualDeductions = 0;

      expenses.forEach(e => {
        const cat = (e.category || '').toLowerCase();
        const isMedical = cat.includes('medical') || cat.includes('health');
        const isManual = e.category === 'Manual Deduction';
        
        // Medical is ALWAYS company covered. Other company covered ones are not deductible.
        if (isMedical || !(e.is_deductible === 1 || e.is_deductible === true) || !e.rider_id) {
          companyExpenses.push(e);
          if (!isManual) totalCompany += parseFloat(e.amount) || 0;
        } else {
          // Rider deductible
          if (!isManual) {
            totalActualDeductions += parseFloat(e.amount) || 0;
          } else {
            totalManualDeductions += parseFloat(e.amount) || 0;
          }
          
          if (e.deductionSettled) {
            settledDeductions.push(e);
          } else {
            pendingDeductions.push(e);
          }
        }
      });

      const totalCashExpenses = totalCompany + totalActualDeductions;
      const netBalance = totalFunds - totalCashExpenses;

      // ─────────────────────────────────────────────────────────────────
      // PAGE 1: SUMMARY
      // ─────────────────────────────────────────────────────────────────
      addPageDecorations(1);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SPONSOR FINANCIAL REPORT', 20, 16);

      let currentY = 40;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.text('INSPIRING ROADS LOGISTICS', 20, currentY);
      
      currentY += 8;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(`Expense & Deduction Report — ${monthYear}`, 20, currentY);
      
      currentY += 8;
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      doc.text(`Prepared by: Abdullah Khan (Supervisor)`, 20, currentY);
      currentY += 5;
      doc.text(`Generated: ${generatedDate}`, 20, currentY);
      currentY += 5;
      doc.text(`Cycle: ${cycleText}`, 20, currentY);

      currentY += 20;
      
      // Financial Summary Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, currentY, 170, 85, 4, 4, 'FD');
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL SUMMARY', 25, currentY + 10);
      
      doc.setDrawColor(203, 213, 225);
      doc.line(25, currentY + 14, 185, currentY + 14);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      
      const lines = [
        { label: 'Total Funds Received:', value: `SAR ${totalFunds.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, bold: true },
        { label: 'Total Expenses (Cash Equivalent):', value: `SAR ${totalCashExpenses.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, bold: true },
        { label: '     - Company-Paid:', value: `SAR ${totalCompany.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, italic: true },
        { label: '     - Rider Deductions (Cash Spent):', value: `SAR ${totalActualDeductions.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, italic: true },
        { label: 'Total Manual Debts (No Cash Impact):', value: `SAR ${totalManualDeductions.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, bold: false }
      ];

      let ly = currentY + 25;
      lines.forEach(l => {
        doc.setTextColor(71, 85, 105);
        if (l.bold) {
           doc.setFont('helvetica', 'bold');
           doc.setTextColor(15, 23, 42);
        } else if (l.italic) {
           doc.setFont('helvetica', 'italic');
        } else {
           doc.setFont('helvetica', 'normal');
        }
        
        doc.text(l.label, 25, ly);
        
        doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(l.value, 185, ly, { align: 'right' });
        
        ly += 10;
      });

      doc.setDrawColor(203, 213, 225);
      doc.line(25, ly - 3, 185, ly - 3);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Net Balance Remaining:', 25, ly + 5);
      
      if (netBalance >= 0) {
        doc.setTextColor(22, 163, 74);
        doc.text(`SAR +${netBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, 185, ly + 5, { align: 'right' });
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text(`SAR ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, 185, ly + 5, { align: 'right' });
      }

      // ─────────────────────────────────────────────────────────────────
      // PAGE 2: RIDER DEDUCTIONS
      // ─────────────────────────────────────────────────────────────────
      doc.addPage();
      addPageDecorations(2);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RIDER DEDUCTIONS', 20, 16);

      currentY = 40;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text('RIDER DEDUCTIONS — PENDING COLLECTION', 20, currentY);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Amounts to be deducted from rider salaries', 20, currentY + 5);

      if (pendingDeductions.length === 0) {
         doc.text('No pending deductions for this period.', 20, currentY + 20);
         currentY += 30;
      } else {
         // Group pending by rider
         const pRiders = {};
         pendingDeductions.forEach(e => {
            const rName = e.rider_name || `Rider #${e.rider_id}`;
            if (!pRiders[rName]) pRiders[rName] = [];
            pRiders[rName].push(e);
         });

         const pRows = [];
         Object.keys(pRiders).sort().forEach(rName => {
            let rTotal = 0;
            pRiders[rName].forEach(e => {
               rTotal += parseFloat(e.amount) || 0;
               pRows.push([
                  rName,
                  e.category || '-',
                  Utils.formatDate(e.expense_date),
                  `SAR ${parseFloat(e.amount).toLocaleString()}`,
                  'PENDING'
               ]);
            });
            // Subtotal row
            pRows.push([
               { content: `Subtotal for ${rName}`, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' } },
               { content: `SAR ${rTotal.toLocaleString()}`, styles: { fontStyle: 'bold' } },
               ''
            ]);
         });

         doc.autoTable({
           startY: currentY + 10,
           head: [['RIDER NAME', 'CATEGORY', 'DATE', 'AMOUNT', 'STATUS']],
           body: pRows,
           theme: 'grid',
           headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
           bodyStyles: { fontSize: 9 },
           columnStyles: {
             0: { cellWidth: 50 },
             3: { fontStyle: 'bold' },
             4: { textColor: [217, 119, 6], fontStyle: 'bold' } // Amber for PENDING
           },
           margin: { left: 20, right: 20 },
           didParseCell: (data) => {
              if (data.row.raw[0] && data.row.raw[0].content && data.row.raw[0].content.startsWith('Subtotal')) {
                 data.cell.styles.fillColor = [241, 245, 249];
              }
           }
         });
         
         currentY = doc.lastAutoTable.finalY + 5;
         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(15, 23, 42);
         const totalPending = pendingDeductions.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
         doc.text(`TOTAL PENDING DEDUCTIONS: SAR ${totalPending.toLocaleString()}`, 190, currentY + 5, { align: 'right' });
         currentY += 20;
      }

      if (currentY > 200) { doc.addPage(); addPageDecorations(doc.internal.getNumberOfPages()); currentY = 40; }

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('RIDER DEDUCTIONS — ALREADY SETTLED THIS CYCLE', 20, currentY);
      
      if (settledDeductions.length === 0) {
         doc.setFontSize(10);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(100, 116, 139);
         doc.text('No settled deductions for this period.', 20, currentY + 15);
         currentY += 25;
      } else {
         const sRows = settledDeductions.map(e => [
            e.rider_name || `Rider #${e.rider_id}`,
            e.category || '-',
            Utils.formatDate(e.expense_date),
            `SAR ${parseFloat(e.amount).toLocaleString()}`,
            '✓ SETTLED',
            e.settledDate ? Utils.formatDate(e.settledDate.split('T')[0]) : '-',
            e.settledBy || '-'
         ]);

         doc.autoTable({
           startY: currentY + 10,
           head: [['RIDER NAME', 'CATEGORY', 'DATE', 'AMOUNT', 'STATUS', 'SETTLED ON', 'SETTLED BY']],
           body: sRows,
           theme: 'grid',
           headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
           bodyStyles: { fontSize: 8 },
           columnStyles: {
             0: { cellWidth: 40 },
             4: { textColor: [22, 163, 74], fontStyle: 'bold' } // Green for SETTLED
           },
           margin: { left: 20, right: 20 }
         });
         
         currentY = doc.lastAutoTable.finalY + 5;
         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(15, 23, 42);
         const totalSettled = settledDeductions.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
         doc.text(`TOTAL SETTLED: SAR ${totalSettled.toLocaleString()}`, 190, currentY + 5, { align: 'right' });
         currentY += 20;
      }

      // ─────────────────────────────────────────────────────────────────
      // PAGE 3: COMPANY EXPENSES BREAKDOWN
      // ─────────────────────────────────────────────────────────────────
      doc.addPage();
      const page3Num = doc.internal.getNumberOfPages();
      addPageDecorations(page3Num);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPANY-COVERED EXPENSES', 20, 16);

      currentY = 40;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text('COMPANY-COVERED EXPENSES', 20, currentY);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Paid by IRL — not deducted from riders', 20, currentY + 5);

      if (companyExpenses.length === 0) {
         doc.text('No company expenses for this period.', 20, currentY + 20);
         currentY += 30;
      } else {
         const cRows = companyExpenses.map(e => [
            Utils.formatDate(e.expense_date),
            e.category || '-',
            e.vendor_name || e.rider_name || '-',
            `SAR ${parseFloat(e.amount).toLocaleString()}`,
            e.notes || '-'
         ]);

         doc.autoTable({
           startY: currentY + 10,
           head: [['DATE', 'CATEGORY', 'RECIPIENT / ITEM', 'AMOUNT', 'NOTES']],
           body: cRows,
           theme: 'grid',
           headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
           bodyStyles: { fontSize: 9 },
           columnStyles: {
             0: { cellWidth: 25 },
             3: { fontStyle: 'bold' }
           },
           margin: { left: 20, right: 20 }
         });
         
         currentY = doc.lastAutoTable.finalY + 15;
         
         // Subtotals
         doc.setFontSize(12);
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(15, 23, 42);
         doc.text('Expense Breakdown by Category', 20, currentY);
         currentY += 8;

         const catTotals = {};
         companyExpenses.forEach(e => {
            const cat = e.category || 'Other';
            if (!catTotals[cat]) catTotals[cat] = 0;
            catTotals[cat] += parseFloat(e.amount) || 0;
         });

         doc.setFontSize(10);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(71, 85, 105);
         Object.keys(catTotals).sort().forEach(cat => {
            doc.text(cat, 20, currentY);
            doc.text(`SAR ${catTotals[cat].toLocaleString()}`, 100, currentY, { align: 'right' });
            currentY += 6;
         });

         doc.setDrawColor(203, 213, 225);
         doc.line(20, currentY, 100, currentY);
         currentY += 6;
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(15, 23, 42);
         doc.text('TOTAL COMPANY EXPENSES:', 20, currentY);
         doc.text(`SAR ${totalCompany.toLocaleString()}`, 100, currentY, { align: 'right' });
      }

      // ─────────────────────────────────────────────────────────────────
      // PAGE 4: FUNDS RECEIVED LOG
      // ─────────────────────────────────────────────────────────────────
      doc.addPage();
      const page4Num = doc.internal.getNumberOfPages();
      addPageDecorations(page4Num);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('FUNDS RECEIVED', 20, 16);

      currentY = 40;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.text('FUNDS RECEIVED FROM COMPANY', 20, currentY);

      if (funds.length === 0) {
         doc.setFontSize(10);
         doc.setFont('helvetica', 'normal');
         doc.setTextColor(100, 116, 139);
         doc.text('No funds received during this period.', 20, currentY + 15);
      } else {
         const fRows = funds.map(f => [
            Utils.formatDate(f.receive_date),
            f.description || '-',
            `SAR ${parseFloat(f.amount).toLocaleString()}`,
            f.notes || '-'
         ]);

         doc.autoTable({
           startY: currentY + 10,
           head: [['DATE', 'SOURCE', 'AMOUNT', 'NOTES']],
           body: fRows,
           theme: 'grid',
           headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
           bodyStyles: { fontSize: 9 },
           columnStyles: {
             0: { cellWidth: 25 },
             2: { fontStyle: 'bold' }
           },
           margin: { left: 20, right: 20 }
         });
         
         currentY = doc.lastAutoTable.finalY + 5;
         doc.setFontSize(11);
         doc.setFont('helvetica', 'bold');
         doc.setTextColor(15, 23, 42);
         doc.text(`TOTAL RECEIVED: SAR ${totalFunds.toLocaleString()}`, 190, currentY + 5, { align: 'right' });
      }

      // ─────────────────────────────────────────────────────────────────
      // OUTPUT
      // ─────────────────────────────────────────────────────────────────
      const filename = `IRL_Sponsor_Report_${monthYear.replace(/ /g, '_')}.pdf`;
      Utils.downloadPDF(doc, filename);
      
      Utils.showToast('Sponsor Report generated successfully!', 'success');
      Utils.hideLoading();
      
    } catch (err) {
      console.error('PDF Error:', err);
      Utils.showToast('Failed to generate Sponsor Report: ' + err.message, 'error');
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SPONSOR EXCEL WORKBOOK - Multi-Sheet Organized Report
  // ═══════════════════════════════════════════════════════════════

  async generateSponsorExcel(start, end) {
    Utils.showLoading('Building Excel Report...', 'Organizing data into separate sheets');
    try {
      if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS library not loaded.');

      const [expenses, funds] = await Promise.all([
        API.getExpenses(start, end),
        API.getFunds(start, end)
      ]);

      let periodLabel = 'All Time';
      if (start && end) {
        const s = new Date(start+'T00:00:00'); const e = new Date(end+'T00:00:00');
        periodLabel = `${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${e.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
      }

      // ── DATA PREPARATION ──
      const totalFunds = funds.reduce((s,f) => s + (f.amount||0), 0);
      const companyExp = [], pendingDed = [], settledDed = [];
      let totCompany=0, totActualDed=0, totManualDed=0;

      expenses.forEach(exp => {
        const cat = (exp.category||'').toLowerCase();
        const isMed = cat.includes('medical') || cat.includes('health');
        const isManual = exp.category === 'Manual Deduction';
        if (isMed || !(exp.is_deductible===1||exp.is_deductible===true) || !exp.rider_id) {
          companyExp.push(exp);
          if (!isManual) totCompany += parseFloat(exp.amount)||0;
        } else {
          if (!isManual) totActualDed += parseFloat(exp.amount)||0;
          else totManualDed += parseFloat(exp.amount)||0;
          if (exp.deductionSettled) settledDed.push(exp); else pendingDed.push(exp);
        }
      });
      const totCash = totCompany + totActualDed;
      const netBal = totalFunds - totCash;

      // ── COLORS ──
      const C = { dark:'FF0F172A', blue:'FF2563EB', green:'FF16A34A', amber:'FFD97706', red:'FFDC2626', white:'FFFFFFFF', light:'FFF8FAFC', border:'FFE2E8F0', muted:'FF64748B' };
      const darkFill = { type:'pattern', pattern:'solid', fgColor:{argb:C.dark} };
      const lightFill = { type:'pattern', pattern:'solid', fgColor:{argb:C.light} };
      const blueFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFDBEAFE'} };
      const greenFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFDCFCE7'} };
      const amberFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFBEB'} };
      const redFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFEF2F2'} };
      const thinBorder = { top:{style:'thin',color:{argb:C.border}}, bottom:{style:'thin',color:{argb:C.border}}, left:{style:'thin',color:{argb:C.border}}, right:{style:'thin',color:{argb:C.border}} };

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Inspiring Roads Logistics';
      wb.title = 'IRL Sponsor Financial Report';

      // ── HELPER: Add branded header to any sheet ──
      const addHeader = (ws, title, cols) => {
        ws.mergeCells(1,1,1,cols);
        const h1 = ws.getCell('A1');
        h1.value = 'INSPIRING ROADS LOGISTICS';
        h1.font = { name:'Calibri', bold:true, size:16, color:{argb:C.white} };
        h1.fill = darkFill; h1.alignment = { vertical:'middle', horizontal:'center' };
        ws.getRow(1).height = 30;

        ws.mergeCells(2,1,2,cols);
        const h2 = ws.getCell('A2');
        h2.value = `${title}  |  Period: ${periodLabel}`;
        h2.font = { name:'Calibri', size:11, color:{argb:'FFCBD5E1'} };
        h2.fill = darkFill; h2.alignment = { vertical:'middle', horizontal:'center' };
        ws.getRow(2).height = 22;

        ws.mergeCells(3,1,3,cols);
        const h3 = ws.getCell('A3');
        h3.value = `Generated: ${new Date().toLocaleDateString('en-US',{dateStyle:'full'})}  |  Prepared by: Abdullah Khan`;
        h3.font = { name:'Calibri', italic:true, size:9, color:{argb:C.muted} };
        h3.fill = darkFill; h3.alignment = { vertical:'middle', horizontal:'center' };
        h3.border = { bottom:{style:'thick',color:{argb:C.blue}} };
        ws.getRow(3).height = 20;
      };

      // ── HELPER: Style a header row ──
      const styleHeaderRow = (ws, rowNum, cols) => {
        const row = ws.getRow(rowNum);
        row.height = 24;
        for (let i=1; i<=cols; i++) {
          const c = row.getCell(i);
          c.font = { name:'Calibri', bold:true, size:10, color:{argb:C.white} };
          c.fill = darkFill;
          c.alignment = { vertical:'middle', horizontal:'center' };
          c.border = thinBorder;
        }
      };

      // ── HELPER: Style data rows with zebra ──
      const styleDataRows = (ws, startRow, endRow, cols) => {
        for (let r=startRow; r<=endRow; r++) {
          const row = ws.getRow(r);
          row.height = 20;
          for (let c=1; c<=cols; c++) {
            const cell = row.getCell(c);
            cell.font = { name:'Calibri', size:10 };
            cell.border = thinBorder;
            cell.alignment = { vertical:'middle' };
            if ((r-startRow)%2===1) cell.fill = lightFill;
          }
        }
      };

      // ════════════════════════════════════════════
      // SHEET 1: DASHBOARD
      // ════════════════════════════════════════════
      const wsDash = wb.addWorksheet('Dashboard', { properties:{ tabColor:{argb:'FF1E3A5F'} } });
      wsDash.columns = [{width:30},{width:20},{width:20},{width:20},{width:20},{width:20}];
      addHeader(wsDash, 'Financial Dashboard', 6);

      // KPI Cards
      let r = 5;
      wsDash.mergeCells(r,1,r,6);
      const secTitle = wsDash.getCell(`A${r}`);
      secTitle.value = '  FINANCIAL SUMMARY';
      secTitle.font = { name:'Calibri', bold:true, size:12, color:{argb:'FF1E3A8A'} };
      secTitle.fill = blueFill; wsDash.getRow(r).height = 28;

      const kpis = [
        ['Total Funds Received', totalFunds, greenFill, C.green],
        ['Total Expenses (Cash)', totCash, redFill, C.red],
        ['  - Company-Paid', totCompany, lightFill, C.muted],
        ['  - Rider Deductions (Cash)', totActualDed, lightFill, C.muted],
        ['Manual Debts (No Cash Impact)', totManualDed, amberFill, C.amber],
        ['Net Balance Remaining', netBal, netBal>=0 ? greenFill : redFill, netBal>=0 ? C.green : C.red],
      ];
      r++;
      kpis.forEach(([label, val, fill, color]) => {
        const row = wsDash.getRow(r);
        row.height = 26;
        wsDash.mergeCells(r,1,r,3);
        const lc = row.getCell(1);
        lc.value = label; lc.font = { name:'Calibri', size:12, bold:label.startsWith('  ') ? false : true }; lc.fill = fill; lc.border = thinBorder; lc.alignment = { vertical:'middle' };
        wsDash.mergeCells(r,4,r,6);
        const vc = row.getCell(4);
        vc.value = val; vc.numFmt = '#,##0.00 "SAR"'; vc.font = { name:'Calibri', size:14, bold:true, color:{argb:color} }; vc.fill = fill; vc.border = thinBorder; vc.alignment = { vertical:'middle', horizontal:'right' };
        r++;
      });

      // Category Breakdown
      r += 2;
      wsDash.mergeCells(r,1,r,6);
      const sec2 = wsDash.getCell(`A${r}`);
      sec2.value = '  EXPENSE BREAKDOWN BY CATEGORY';
      sec2.font = { name:'Calibri', bold:true, size:12, color:{argb:'FF1E3A8A'} };
      sec2.fill = blueFill; wsDash.getRow(r).height = 28;
      r++;

      const catMap = {};
      expenses.forEach(e => {
        if (e.category === 'Manual Deduction') return;
        const cat = e.category || 'Other';
        if (!catMap[cat]) catMap[cat] = { count:0, total:0 };
        catMap[cat].count++;
        catMap[cat].total += parseFloat(e.amount)||0;
      });

      wsDash.getRow(r).values = ['Category', '', 'Count', '', 'Total Amount', ''];
      wsDash.mergeCells(r,1,r,2); wsDash.mergeCells(r,3,r,4); wsDash.mergeCells(r,5,r,6);
      styleHeaderRow(wsDash, r, 6); r++;
      const catStart = r;
      Object.keys(catMap).sort().forEach(cat => {
        const row = wsDash.getRow(r);
        wsDash.mergeCells(r,1,r,2); wsDash.mergeCells(r,3,r,4); wsDash.mergeCells(r,5,r,6);
        row.getCell(1).value = cat;
        row.getCell(3).value = catMap[cat].count; row.getCell(3).alignment = { horizontal:'center', vertical:'middle' };
        row.getCell(5).value = catMap[cat].total; row.getCell(5).numFmt = '#,##0.00 "SAR"'; row.getCell(5).alignment = { horizontal:'right', vertical:'middle' };
        r++;
      });
      styleDataRows(wsDash, catStart, r-1, 6);

      // ════════════════════════════════════════════
      // SHEET 2: COMPANY EXPENSES
      // ════════════════════════════════════════════
      const wsComp = wb.addWorksheet('Company Expenses', { properties:{ tabColor:{argb:'FF2563EB'} } });
      wsComp.columns = [{width:14},{width:20},{width:25},{width:30},{width:16}];
      addHeader(wsComp, 'Company-Paid Expenses', 5);

      r = 5;
      wsComp.getRow(r).values = ['Date','Category','Recipient / Vendor','Notes','Amount'];
      styleHeaderRow(wsComp, r, 5); r++;
      const compStart = r;
      companyExp.forEach(e => {
        const row = wsComp.getRow(r);
        row.getCell(1).value = e.expense_date ? new Date(e.expense_date+'T00:00:00') : '';
        row.getCell(1).numFmt = 'MMM DD, YYYY';
        row.getCell(2).value = e.category || 'Other';
        row.getCell(3).value = e.rider_name || e.vendor_name || 'General';
        row.getCell(4).value = e.notes || '';
        row.getCell(5).value = parseFloat(e.amount)||0; row.getCell(5).numFmt = '#,##0.00';
        r++;
      });
      if (companyExp.length > 0) {
        styleDataRows(wsComp, compStart, r-1, 5);
        const totRow = wsComp.getRow(r);
        totRow.height = 26;
        wsComp.mergeCells(r,1,r,4);
        totRow.getCell(1).value = 'TOTAL COMPANY EXPENSES';
        totRow.getCell(1).font = { name:'Calibri', bold:true, size:11 }; totRow.getCell(1).alignment = { horizontal:'right', vertical:'middle' }; totRow.getCell(1).fill = lightFill; totRow.getCell(1).border = thinBorder;
        totRow.getCell(5).value = totCompany; totRow.getCell(5).numFmt = '#,##0.00 "SAR"'; totRow.getCell(5).font = { name:'Calibri', bold:true, size:12 }; totRow.getCell(5).fill = lightFill; totRow.getCell(5).border = thinBorder;
      }
      wsComp.autoFilter = { from:'A5', to:`E${Math.max(r,6)}` };

      // ════════════════════════════════════════════
      // SHEET 3: RIDER BREAKDOWN
      // ════════════════════════════════════════════
      const wsRider = wb.addWorksheet('Rider Breakdown', { properties:{ tabColor:{argb:'FFD97706'} } });
      wsRider.columns = [{width:22},{width:14},{width:20},{width:14},{width:14},{width:28}];
      addHeader(wsRider, 'Expenses Per Rider', 6);

      // Group ALL rider-related expenses by rider
      const riderGroups = {};
      expenses.forEach(e => {
        if (!e.rider_id) return;
        const name = e.rider_name || `Rider #${e.rider_id}`;
        if (!riderGroups[name]) riderGroups[name] = [];
        riderGroups[name].push(e);
      });

      r = 5;
      Object.keys(riderGroups).sort().forEach(riderName => {
        const items = riderGroups[riderName];
        // Rider section header
        wsRider.mergeCells(r,1,r,6);
        const rh = wsRider.getCell(`A${r}`);
        rh.value = `  ${riderName}`;
        rh.font = { name:'Calibri', bold:true, size:12, color:{argb:C.white} };
        rh.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF334155'} };
        wsRider.getRow(r).height = 26; r++;

        wsRider.getRow(r).values = ['Category','Date','Status','Deductible','Amount','Notes'];
        styleHeaderRow(wsRider, r, 6); r++;
        const grpStart = r;
        let riderTotal = 0;
        items.forEach(e => {
          const row = wsRider.getRow(r);
          row.getCell(1).value = e.category || 'Other';
          row.getCell(2).value = e.expense_date ? new Date(e.expense_date+'T00:00:00') : '';
          row.getCell(2).numFmt = 'MMM DD, YYYY';
          const isDeductible = e.is_deductible===1||e.is_deductible===true;
          row.getCell(3).value = isDeductible ? (e.deductionSettled ? 'Settled' : 'Pending') : 'Company Paid';
          row.getCell(4).value = isDeductible ? 'Yes' : 'No';
          row.getCell(5).value = parseFloat(e.amount)||0; row.getCell(5).numFmt = '#,##0.00';
          row.getCell(6).value = e.notes || '';
          riderTotal += parseFloat(e.amount)||0;
          r++;
        });
        styleDataRows(wsRider, grpStart, r-1, 6);

        // Rider subtotal
        const st = wsRider.getRow(r);
        wsRider.mergeCells(r,1,r,4);
        st.getCell(1).value = `Subtotal for ${riderName}`;
        st.getCell(1).font = { name:'Calibri', bold:true, size:10, italic:true };
        st.getCell(1).alignment = { horizontal:'right', vertical:'middle' };
        st.getCell(1).fill = amberFill; st.getCell(1).border = thinBorder;
        st.getCell(5).value = riderTotal; st.getCell(5).numFmt = '#,##0.00 "SAR"';
        st.getCell(5).font = { name:'Calibri', bold:true }; st.getCell(5).fill = amberFill; st.getCell(5).border = thinBorder;
        st.getCell(6).fill = amberFill; st.getCell(6).border = thinBorder;
        st.height = 22; r += 2;
      });

      // ════════════════════════════════════════════
      // SHEET 4: PENDING DEDUCTIONS
      // ════════════════════════════════════════════
      const wsPend = wb.addWorksheet('Pending Deductions', { properties:{ tabColor:{argb:'FFDC2626'} } });
      wsPend.columns = [{width:22},{width:20},{width:14},{width:16},{width:28}];
      addHeader(wsPend, 'Pending Rider Deductions', 5);

      r = 5;
      wsPend.getRow(r).values = ['Rider Name','Category','Date','Amount','Notes'];
      styleHeaderRow(wsPend, r, 5); r++;
      const pendStart = r;
      // Group by rider
      const pendByRider = {};
      pendingDed.forEach(e => { const n=e.rider_name||`Rider #${e.rider_id}`; if(!pendByRider[n]) pendByRider[n]=[]; pendByRider[n].push(e); });
      let grandPending = 0;
      Object.keys(pendByRider).sort().forEach(name => {
        let sub = 0;
        pendByRider[name].forEach(e => {
          const row = wsPend.getRow(r);
          row.getCell(1).value = name;
          row.getCell(2).value = e.category||'Other';
          row.getCell(3).value = e.expense_date ? new Date(e.expense_date+'T00:00:00') : '';
          row.getCell(3).numFmt = 'MMM DD, YYYY';
          row.getCell(4).value = parseFloat(e.amount)||0; row.getCell(4).numFmt = '#,##0.00';
          row.getCell(5).value = e.notes||'';
          sub += parseFloat(e.amount)||0; r++;
        });
        // Subtotal
        const st = wsPend.getRow(r);
        wsPend.mergeCells(r,1,r,3);
        st.getCell(1).value = `Subtotal: ${name}`; st.getCell(1).font = { name:'Calibri', bold:true, italic:true }; st.getCell(1).alignment = { horizontal:'right', vertical:'middle' }; st.getCell(1).fill = redFill; st.getCell(1).border = thinBorder;
        st.getCell(4).value = sub; st.getCell(4).numFmt = '#,##0.00 "SAR"'; st.getCell(4).font = { name:'Calibri', bold:true }; st.getCell(4).fill = redFill; st.getCell(4).border = thinBorder;
        st.getCell(5).fill = redFill; st.getCell(5).border = thinBorder;
        grandPending += sub; r++;
      });
      if (pendingDed.length > 0) styleDataRows(wsPend, pendStart, r-1, 5);
      // Grand total
      const gp = wsPend.getRow(r);
      wsPend.mergeCells(r,1,r,3);
      gp.getCell(1).value = 'TOTAL PENDING'; gp.getCell(1).font = { name:'Calibri', bold:true, size:12 }; gp.getCell(1).alignment = { horizontal:'right', vertical:'middle' }; gp.getCell(1).fill = darkFill; gp.getCell(1).font = { name:'Calibri', bold:true, size:12, color:{argb:C.white} }; gp.getCell(1).border = thinBorder;
      gp.getCell(4).value = grandPending; gp.getCell(4).numFmt = '#,##0.00 "SAR"'; gp.getCell(4).font = { name:'Calibri', bold:true, size:12, color:{argb:C.white} }; gp.getCell(4).fill = darkFill; gp.getCell(4).border = thinBorder;
      gp.getCell(5).fill = darkFill; gp.getCell(5).border = thinBorder;
      wsPend.autoFilter = { from:'A5', to:`E${Math.max(r,6)}` };

      // ════════════════════════════════════════════
      // SHEET 5: SETTLED DEDUCTIONS
      // ════════════════════════════════════════════
      const wsSettle = wb.addWorksheet('Settled Deductions', { properties:{ tabColor:{argb:'FF16A34A'} } });
      wsSettle.columns = [{width:22},{width:20},{width:14},{width:16},{width:16},{width:24}];
      addHeader(wsSettle, 'Settled Rider Deductions', 6);

      r = 5;
      wsSettle.getRow(r).values = ['Rider Name','Category','Date','Amount','Settled By','Notes'];
      styleHeaderRow(wsSettle, r, 6); r++;
      const settStart = r;
      settledDed.forEach(e => {
        const row = wsSettle.getRow(r);
        row.getCell(1).value = e.rider_name||`Rider #${e.rider_id}`;
        row.getCell(2).value = e.category||'Other';
        row.getCell(3).value = e.expense_date ? new Date(e.expense_date+'T00:00:00') : '';
        row.getCell(3).numFmt = 'MMM DD, YYYY';
        row.getCell(4).value = parseFloat(e.amount)||0; row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).value = e.settledBy||'Payroll';
        row.getCell(6).value = e.notes||''; r++;
      });
      if (settledDed.length > 0) {
        styleDataRows(wsSettle, settStart, r-1, 6);
        const totalSettled = settledDed.reduce((s,e) => s+(parseFloat(e.amount)||0), 0);
        const ts = wsSettle.getRow(r);
        wsSettle.mergeCells(r,1,r,3);
        ts.getCell(1).value = 'TOTAL SETTLED'; ts.getCell(1).font = { name:'Calibri', bold:true, size:11 }; ts.getCell(1).alignment = { horizontal:'right', vertical:'middle' }; ts.getCell(1).fill = greenFill; ts.getCell(1).border = thinBorder;
        ts.getCell(4).value = totalSettled; ts.getCell(4).numFmt = '#,##0.00 "SAR"'; ts.getCell(4).font = { name:'Calibri', bold:true, size:11 }; ts.getCell(4).fill = greenFill; ts.getCell(4).border = thinBorder;
        ts.getCell(5).fill = greenFill; ts.getCell(5).border = thinBorder;
        ts.getCell(6).fill = greenFill; ts.getCell(6).border = thinBorder;
      }
      wsSettle.autoFilter = { from:'A5', to:`F${Math.max(r,6)}` };

      // ════════════════════════════════════════════
      // SHEET 6: FUNDS RECEIVED
      // ════════════════════════════════════════════
      const wsFunds = wb.addWorksheet('Funds Received', { properties:{ tabColor:{argb:'FF059669'} } });
      wsFunds.columns = [{width:14},{width:30},{width:16},{width:30}];
      addHeader(wsFunds, 'Funds Received from Company', 4);

      r = 5;
      wsFunds.getRow(r).values = ['Date','Source / Description','Amount','Notes'];
      styleHeaderRow(wsFunds, r, 4); r++;
      const fundsStart = r;
      funds.forEach(f => {
        const row = wsFunds.getRow(r);
        row.getCell(1).value = f.receive_date ? new Date(f.receive_date+'T00:00:00') : '';
        row.getCell(1).numFmt = 'MMM DD, YYYY';
        row.getCell(2).value = f.description||'Fund Transfer';
        row.getCell(3).value = parseFloat(f.amount)||0; row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).value = f.notes||''; r++;
      });
      if (funds.length > 0) {
        styleDataRows(wsFunds, fundsStart, r-1, 4);
        const tf = wsFunds.getRow(r);
        wsFunds.mergeCells(r,1,r,2);
        tf.getCell(1).value = 'TOTAL RECEIVED'; tf.getCell(1).font = { name:'Calibri', bold:true, size:12 }; tf.getCell(1).alignment = { horizontal:'right', vertical:'middle' }; tf.getCell(1).fill = greenFill; tf.getCell(1).border = thinBorder;
        tf.getCell(3).value = totalFunds; tf.getCell(3).numFmt = '#,##0.00 "SAR"'; tf.getCell(3).font = { name:'Calibri', bold:true, size:12 }; tf.getCell(3).fill = greenFill; tf.getCell(3).border = thinBorder;
        tf.getCell(4).fill = greenFill; tf.getCell(4).border = thinBorder;
      }
      wsFunds.autoFilter = { from:'A5', to:`D${Math.max(r,6)}` };

      // ── DOWNLOAD ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IRL_Sponsor_Report_${periodLabel.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);

      Utils.showToast('Sponsor Excel Report downloaded!', 'success');
      Utils.hideLoading();
    } catch (err) {
      console.error('Excel Error:', err);
      Utils.showToast('Failed to generate Excel: ' + err.message, 'error');
      Utils.hideLoading();
    }
  }
};
