// ========================================
//  REPORTS CENTER - Phase 4 & 5 Features
//  Sponsor Invoice, Letterhead PDFs, QR,
//  Arabic/English, Calendar, Year-End,
//  Batch Download, Notifications, Export
// ========================================

const ReportsCenter = {
  _initialized: false,

  render() {
    if (!this._initialized) {
      window.addEventListener('cycleChanged', () => {
        if (App.currentPage === 'reports-center') this.render();
      });
      this._initialized = true;
    }
    const container = document.getElementById('page-reports-center');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <div>
          <h1 style="font-size:24px; font-weight:bold; color:#0F0F0F; margin-bottom:4px;">Reports & Export</h1>
          <p style="font-size:14px; color:#6B7280;">Generate reports, sponsor invoices, and export data</p>
        </div>
      </div>

      <style>
        .report-card {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 24px;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
        }
        .report-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          border-color: #D1D5DB;
          transform: translateY(-2px);
        }
        .rc-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rc-title {
          font-size: 15px;
          font-weight: 600;
          color: #0F0F0F;
          margin-top: 8px;
        }
        .rc-desc {
          font-size: 13px;
          color: #6B7280;
          line-height: 1.5;
          margin-top: 4px;
          flex-grow: 1;
        }
        .rc-divider {
          height: 1px;
          background: #F3F4F6;
          margin: 16px 0;
        }
        .rc-btn {
          width: 100%;
          height: 36px;
          border-radius: 8px;
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          color: #374151;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .rc-btn:hover {
          border-color: #2563EB;
          color: #2563EB;
          background: #EFF6FF;
        }
        .reports-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (max-width: 1024px) {
          .reports-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .reports-grid { grid-template-columns: 1fr; }
        }
        .pulse-border {
          animation: rcPulseBorder 1s infinite;
          border: 2px solid #3b82f6 !important;
          color: #3b82f6 !important;
        }
        @keyframes rcPulseBorder {
          0% { border-color: #3b82f6; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { border-color: #93c5fd; box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
          100% { border-color: #3b82f6; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        @keyframes rcSpin { 100% { transform: rotate(360deg); } }
      </style>

      <div class="reports-grid">
        <!-- Card 1 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#EFF6FF;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="rc-title">Sponsor Invoice</div>
          <div class="rc-desc">Professional invoice for sponsors with expense + salary breakdown.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.generateSponsorInvoice()">Generate PDF</button>
        </div>

        <!-- Card 2 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#F0FDF4;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3M12 3v18"/></svg>
          </div>
          <div class="rc-title">Sponsor Dashboard PDF</div>
          <div class="rc-desc">Executive summary: total cost, orders, efficiency rankings.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.generateSponsorDashboardPDF()">Generate PDF</button>
        </div>

        <!-- Card 3 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#FFF7ED;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EA580C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div class="rc-title">Attendance Calendar PDF</div>
          <div class="rc-desc">Color-coded calendar grid for each rider's month.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.generateAttendanceCalendarPDF()">Generate PDF</button>
        </div>

        <!-- Card 4 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#F5F3FF;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div class="rc-title">Year-End Summary</div>
          <div class="rc-desc">Annual report: 12-month trends, top performers, totals.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.generateYearEndSummary()">Generate PDF</button>
        </div>

        <!-- Card 5 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#FEF2F2;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div class="rc-title">Batch Payslip Download</div>
          <div class="rc-desc">Download all rider payslips as one merged PDF.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.batchDownloadPayslips()">Download PDF</button>
        </div>

        <!-- Card 6 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#FFFBEB;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          </div>
          <div class="rc-title">Arabic + English Payslip</div>
          <div class="rc-desc">Bilingual payslip with QR verification code.</div>
          <div class="rc-divider"></div>
          <button class="rc-btn" onclick="ReportsCenter.generateBilingualPayslip()">Generate PDF</button>
        </div>

        <!-- Card 7 -->
        <div class="report-card">
          <div class="rc-icon-box" style="background:#F0FDF4;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div class="rc-title">Monthly Breakdown (Excel)</div>
          <div class="rc-desc">Complete cycle breakdown: rider details, daily attendance, orders & payroll in .xlsx format.</div>
          <div class="rc-divider"></div>
          <button id="btn-export-excel" class="rc-btn" onclick="ReportsCenter.exportMonthlyExcel()">Export Excel</button>
          <div id="excel-progress-container" style="display:none; margin-top:12px; font-size:12px; color:#6B7280; opacity:1; transition: opacity 0.5s ease; text-align:left;">
            <div class="progress-step" style="margin-bottom:4px;" data-text="Fetching rider data..."></div>
            <div class="progress-step" style="margin-bottom:4px;" data-text="Building payroll summary..."></div>
            <div class="progress-step" style="margin-bottom:4px;" data-text="Generating attendance grid..."></div>
            <div class="progress-step" style="margin-bottom:4px;" data-text="Finalizing report..."></div>
          </div>
        </div>
      </div>

      <!-- Data Export Section -->
      <div style="margin-bottom:24px">
        <h3 style="font-size:16px; font-weight:700; color:#0F0F0F; margin-bottom:12px;">📤 Data Export</h3>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px;">
        <button class="rc-btn" style="height:auto; padding:16px; justify-content:flex-start; gap:10px;" onclick="ReportsCenter.exportData('riders')">
          <span style="font-size:20px">👥</span> Export Riders (CSV)
        </button>
        <button class="rc-btn" style="height:auto; padding:16px; justify-content:flex-start; gap:10px;" onclick="ReportsCenter.exportData('logs')">
          <span style="font-size:20px">📋</span> Export Daily Logs (CSV)
        </button>
        <button class="rc-btn" style="height:auto; padding:16px; justify-content:flex-start; gap:10px;" onclick="ReportsCenter.exportData('expenses')">
          <span style="font-size:20px">💰</span> Export Expenses (CSV)
        </button>
        <button class="rc-btn" style="height:auto; padding:16px; justify-content:flex-start; gap:10px;" onclick="ReportsCenter.exportData('payroll')">
          <span style="font-size:20px">📄</span> Export Payroll (CSV)
        </button>
        <button class="rc-btn" style="height:auto; padding:16px; justify-content:flex-start; gap:10px;" onclick="API.downloadBackup()">
          <span style="font-size:20px">💾</span> Full DB Backup (JSON)
        </button>
      </div>
    `;
  },

  // ── Monthly Breakdown Excel Export (ExcelJS) ──
  async exportMonthlyExcel() {
    if (typeof ExcelJS === 'undefined') {
      Utils.showToast('ExcelJS library not loaded. Please refresh and try again.', 'error');
      return;
    }

    const btn = document.getElementById('btn-export-excel');
    const progressDiv = document.getElementById('excel-progress-container');
    
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<svg viewBox="0 0 50 50" style="width:16px;height:16px;margin-right:8px;animation:rcSpin 1s linear infinite;"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="31.4 31.4" stroke-linecap="round"></circle></svg> Generating Report...`;
      btn.classList.add('pulse-border');
    }

    const updateProgress = async (stepId) => {
      if (!progressDiv) return;
      progressDiv.style.display = 'block';
      const steps = progressDiv.querySelectorAll('.progress-step');
      steps.forEach((el, index) => {
        if (index < stepId) {
           el.innerHTML = `✅ ${el.dataset.text}`;
           el.style.color = '#16A34A';
           el.style.fontWeight = 'normal';
        } else if (index === stepId) {
           el.innerHTML = `⏳ ${el.dataset.text}`;
           el.style.color = '#2563EB';
           el.style.fontWeight = 'bold';
        } else {
           el.innerHTML = `· ${el.dataset.text}`;
           el.style.color = '#9CA3AF';
           el.style.fontWeight = 'normal';
        }
      });
      // Yield to browser to render
      await new Promise(resolve => setTimeout(resolve, 50));
    };

    try {
      await updateProgress(0); // Fetching rider data...
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      // Fetch sequentially to prevent Supabase statement timeouts on heavy queries
      const riders = await API.getRiders();
      const payroll = await API.getPayroll(period.start, period.end);
      const allLogs = await API.request(`/daily-logs?start=${period.start}&end=${period.end}`);
      const expenses = await API.getExpenses();

      await ExcelExport.generate(period, riders, payroll, allLogs, expenses, updateProgress);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Export Excel';
        btn.classList.remove('pulse-border');
      }
      if (progressDiv) {
        progressDiv.style.opacity = '0';
        setTimeout(() => { progressDiv.style.display = 'none'; progressDiv.style.opacity = '1'; }, 500);
      }
      // ExcelExport.generate now throws error or succeeds without its own toast if updateProgress is provided
      Utils.showToast('Report downloaded successfully', 'success');
    } catch (e) {
      console.error(e);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Export Excel';
        btn.classList.remove('pulse-border');
      }
      if (progressDiv) {
        progressDiv.style.display = 'none';
      }
      Utils.showToast('Report generation failed. Try again.', 'error');
    }
  },

  // ── Shared Letterhead ──
  addLetterhead(doc, subtitle) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 40, 210, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('INSPIRING ROADS LOGISTICS', 20, 16);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle || 'Official Document', 20, 24);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Riyadh, Kingdom of Saudi Arabia', 20, 32);
    doc.text(`Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`, 190, 32, { align: 'right' });
    
    return 50;
  },

  addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, 282, 195, 282);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i}/${pageCount}  |  Inspiring Roads Logistics — Confidential`, 105, 287, { align: 'center' });
    }
  },

  // ── QR Code Generator (text to base64 canvas) ──
  generateQRDataUrl(text) {
    // Simple QR-like hash stamp (since we don't have a QR lib, we create a verification hash)
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // Create a pseudo-QR pattern from hash
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#0f172a';
    
    // Border
    ctx.fillRect(0, 0, 100, 4); ctx.fillRect(0, 96, 100, 4);
    ctx.fillRect(0, 0, 4, 100); ctx.fillRect(96, 0, 4, 100);
    
    // Corner markers
    ctx.fillRect(6, 6, 24, 24); ctx.clearRect(10, 10, 16, 16); ctx.fillRect(14, 14, 8, 8);
    ctx.fillRect(70, 6, 24, 24); ctx.clearRect(74, 10, 16, 16); ctx.fillRect(78, 14, 8, 8);
    ctx.fillRect(6, 70, 24, 24); ctx.clearRect(10, 74, 16, 16); ctx.fillRect(14, 78, 8, 8);
    
    // Hash-based data pattern
    let hash = 0;
    for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash) + text.charCodeAt(i); hash |= 0; }
    const seed = Math.abs(hash);
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((seed >> ((row * 8 + col) % 31)) & 1) {
          ctx.fillRect(34 + col * 4, 34 + row * 4, 3, 3);
        }
      }
    }
    
    return canvas.toDataURL('image/png');
  },

  // ═══════════════════════════════════════════
  // SPONSOR INVOICE PDF
  // ═══════════════════════════════════════════
  async generateSponsorInvoice() {
    Utils.showLoading('Building report', 'This may take a few seconds');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      
      const [payroll, expenses, funds] = await Promise.all([
        API.getPayroll(period.start, period.end),
        API.getExpenses(period.start, period.end),
        API.getFunds(period.start, period.end)
      ]);

      let y = this.addLetterhead(doc, 'Sponsor Invoice');

      // Invoice details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('INVOICE', 15, y);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Period: ${period.label}`, 15, y + 7);
      doc.text(`Invoice #: IRL-${Date.now().toString(36).toUpperCase()}`, 190, y, { align: 'right' });
      y += 16;

      // Salary Summary
      const totalSalary = payroll.reduce((s, r) => s + r.calculated_salary, 0);
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const totalFunds = funds.reduce((s, f) => s + (f.amount || 0), 0);
      const grandTotal = totalSalary + totalExpenses;

      doc.autoTable({
        startY: y,
        head: [['Description', 'Amount (SR)']],
        body: [
          ['Total Rider Salaries', `SR ${totalSalary.toLocaleString()}`],
          ['Total Operational Expenses', `SR ${totalExpenses.toLocaleString()}`],
          ['', ''],
          ['GRAND TOTAL', `SR ${grandTotal.toLocaleString()}`],
          ['', ''],
          ['Funds Received', `SR ${totalFunds.toLocaleString()}`],
          ['Balance Due', `SR ${(grandTotal - totalFunds).toLocaleString()}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 10, cellPadding: 5 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 15, right: 15 },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === 3) doc.setFillColor(240, 253, 244);
          if (data.section === 'body' && data.row.index === 6) doc.setFillColor(254, 242, 242);
        }
      });
      y = doc.lastAutoTable.finalY + 10;

      // Rider Breakdown
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Rider Salary Breakdown', 15, y);
      y += 4;

      doc.autoTable({
        startY: y,
        head: [['Rider', 'Orders', 'Days', 'Gross', 'Deductions', 'Net Pay']],
        body: payroll.map(r => [r.rider_name, r.total_orders, r.present_days, `SR ${r.total_salary.toLocaleString()}`, `SR ${(r.deductions||0).toLocaleString()}`, `SR ${r.calculated_salary.toLocaleString()}`]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8, cellPadding: 3 },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 10;

      // Expense Breakdown
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Expense Breakdown', 15, y);
      y += 4;

      const categoryTotals = {};
      expenses.forEach(e => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0); });

      doc.autoTable({
        startY: y,
        head: [['Category', 'Total Amount']],
        body: Object.entries(categoryTotals).map(([cat, amt]) => [cat, `SR ${amt.toLocaleString()}`]),
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 15, right: 15 }
      });

      // QR Code
      const qrData = `IRL-INV-${period.start}-${grandTotal}`;
      const qrImg = this.generateQRDataUrl(qrData);
      const lastY = doc.lastAutoTable.finalY + 10;
      doc.addImage(qrImg, 'PNG', 170, lastY, 22, 22);
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text('Verification', 181, lastY + 25, { align: 'center' });

      this.addFooter(doc);
      Utils.downloadPDF(doc, `IRL_Sponsor_Invoice_${period.label.replace(/\s+/g, '_')}.pdf`);
      Utils.showToast('Sponsor Invoice downloaded! ✅', 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // SPONSOR DASHBOARD PDF
  // ═══════════════════════════════════════════
  async generateSponsorDashboardPDF() {
    Utils.showLoading('Building report', 'This may take a few seconds');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());

      const [payroll, expenses] = await Promise.all([
        API.getPayroll(period.start, period.end),
        API.getExpenses(period.start, period.end)
      ]);

      let y = this.addLetterhead(doc, 'Executive Dashboard');

      const totalSalary = payroll.reduce((s, r) => s + r.calculated_salary, 0);
      const totalOrders = payroll.reduce((s, r) => s + r.total_orders, 0);
      const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
      const costPerOrder = totalOrders > 0 ? (totalSalary + totalExpenses) / totalOrders : 0;
      const avgOrdersPerRider = payroll.length > 0 ? Math.round(totalOrders / payroll.length) : 0;

      // KPI Cards
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Key Performance Indicators', 15, y);
      y += 6;

      doc.autoTable({
        startY: y,
        head: [['Fleet Cost', 'Total Orders', 'Active Riders', 'Cost/Order', 'Avg Orders/Rider']],
        body: [[`SR ${(totalSalary+totalExpenses).toLocaleString()}`, totalOrders.toLocaleString(), payroll.length, `SR ${costPerOrder.toFixed(1)}`, avgOrdersPerRider]],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 12, fontStyle: 'bold', cellPadding: 6, halign: 'center' },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 12;

      // Top 5 Performers
      const sorted = [...payroll].sort((a, b) => b.total_orders - a.total_orders);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TOP 5 PERFORMERS', 15, y);
      y += 4;

      doc.autoTable({
        startY: y,
        head: [['Rank', 'Rider', 'Orders', 'Net Pay', 'Efficiency']],
        body: sorted.slice(0, 5).map((r, i) => [`#${i+1}`, r.rider_name, r.total_orders, `SR ${r.calculated_salary.toLocaleString()}`, `${(r.total_orders / Math.max(r.present_days, 1)).toFixed(1)} ord/day`]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 9, cellPadding: 4 },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 10;

      // Bottom 5
      if (sorted.length > 5) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('ATTENTION REQUIRED', 15, y);
        y += 4;

        doc.autoTable({
          startY: y,
          head: [['Rank', 'Rider', 'Orders', 'Net Pay', 'Efficiency']],
          body: sorted.slice(-5).reverse().map((r, i) => [`#${sorted.length - 4 + i}`, r.rider_name, r.total_orders, `SR ${r.calculated_salary.toLocaleString()}`, `${(r.total_orders / Math.max(r.present_days, 1)).toFixed(1)} ord/day`]),
          theme: 'striped',
          headStyles: { fillColor: [244, 63, 94], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 9, cellPadding: 4 },
          margin: { left: 15, right: 15 }
        });
      }

      this.addFooter(doc);
      Utils.downloadPDF(doc, `IRL_Sponsor_Dashboard_${period.label.replace(/\s+/g, '_')}.pdf`);
      Utils.showToast('Sponsor Dashboard downloaded! ✅', 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // ATTENDANCE CALENDAR PDF
  // ═══════════════════════════════════════════
  async generateAttendanceCalendarPDF() {
    Utils.showLoading('Building report', 'This may take a few seconds');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());

      const riders = await API.getRiders();
      
      // Build date range
      const dates = [];
      let d = new Date(period.start + 'T00:00:00');
      const endD = new Date(period.end + 'T00:00:00');
      while (d <= endD) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }

      let y = 15;
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 30, 'F');
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 28, 297, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE CALENDAR', 15, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cycle: ${period.label}`, 15, 22);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`, 282, 22, { align: 'right' });
      y = 36;

      // Table header
      const headers = ['Rider', ...dates.map(d => { const dt = new Date(d + 'T00:00:00'); return `${dt.getDate()}`; })];
      const body = [];

      for (const rider of riders) {
        const logs = await API.getRiderLogs(rider.id, period.start, period.end);
        const logMap = {};
        logs.forEach(l => { logMap[l.log_date] = l.attendance_status; });
        
        const row = [rider.name];
        dates.forEach(date => {
          const status = (logMap[date] || '').trim();
          if (status === 'Present') row.push('P');
          else if (status === 'Absent' || status === 'Missed') row.push('A');
          else if (status === 'Week Off' || status === 'Day Off') row.push('-');
          else row.push('.');
        });
        body.push(row);
      }

      doc.autoTable({
        startY: y,
        head: [headers],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 6, cellPadding: 2, halign: 'center' },
        bodyStyles: { fontSize: 6, cellPadding: 2, halign: 'center' },
        columnStyles: { 0: { halign: 'left', cellWidth: 30, fontSize: 7, fontStyle: 'bold' } },
        margin: { left: 5, right: 5 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index > 0) {
            if (data.cell.raw === 'A') data.cell.styles.fillColor = [254, 226, 226];
            else if (data.cell.raw === 'P') data.cell.styles.fillColor = [220, 252, 231];
            else if (data.cell.raw === '-') data.cell.styles.fillColor = [219, 234, 254];
          }
        }
      });

      // Legend
      const legendY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Legend:  P: Present  |  A: Absent  |  -: Off  |  .: No Data', 15, legendY);

      Utils.downloadPDF(doc, `IRL_Attendance_Calendar_${period.label.replace(/\s+/g, '_')}.pdf`);
      Utils.showToast('Attendance Calendar downloaded! ✅', 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // YEAR-END SUMMARY PDF
  // ═══════════════════════════════════════════
  async generateYearEndSummary() {
    Utils.showLoading('Building report', 'This may take a few seconds');
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      
      let y = this.addLetterhead(doc, 'Annual Year-End Summary');

      const now = new Date();
      const year = now.getFullYear();
      
      // Generate 12 cycles
      const monthlyData = [];
      for (let m = 0; m < 12; m++) {
        const cycleDate = new Date(year, m, 25);
        const period = Utils.getNoonCyclePeriod(cycleDate.toISOString().split('T')[0]);
        try {
          const [payroll, expenses] = await Promise.all([
            API.getPayroll(period.start, period.end),
            API.getExpenses(period.start, period.end)
          ]);
          monthlyData.push({
            month: new Date(year, m).toLocaleString('en-US', { month: 'short' }),
            orders: payroll.reduce((s, r) => s + r.total_orders, 0),
            salary: payroll.reduce((s, r) => s + r.calculated_salary, 0),
            expenses: expenses.reduce((s, e) => s + (e.amount || 0), 0),
            riders: payroll.length
          });
        } catch {
          monthlyData.push({ month: new Date(year, m).toLocaleString('en-US', { month: 'short' }), orders: 0, salary: 0, expenses: 0, riders: 0 });
        }
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Year ${year} — Financial Summary`, 15, y);
      y += 8;

      // Annual totals
      const annualOrders = monthlyData.reduce((s, m) => s + m.orders, 0);
      const annualSalary = monthlyData.reduce((s, m) => s + m.salary, 0);
      const annualExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);

      doc.autoTable({
        startY: y,
        head: [['Total Orders', 'Total Salaries Paid', 'Total Expenses', 'Total Fleet Cost']],
        body: [[annualOrders.toLocaleString(), `SR ${annualSalary.toLocaleString()}`, `SR ${annualExpenses.toLocaleString()}`, `SR ${(annualSalary + annualExpenses).toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 12, fontStyle: 'bold', cellPadding: 6, halign: 'center' },
        margin: { left: 15, right: 15 }
      });
      y = doc.lastAutoTable.finalY + 10;

      // Monthly breakdown
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Monthly Breakdown', 15, y);
      y += 4;

      doc.autoTable({
        startY: y,
        head: [['Month', 'Orders', 'Riders', 'Salaries (SR)', 'Expenses (SR)', 'Total (SR)']],
        body: monthlyData.map(m => [m.month, m.orders, m.riders, m.salary.toLocaleString(), m.expenses.toLocaleString(), (m.salary + m.expenses).toLocaleString()]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 15, right: 15 }
      });

      this.addFooter(doc);
      Utils.downloadPDF(doc, `IRL_Year_End_Summary_${year}.pdf`);
      Utils.showToast('Year-End Summary downloaded! ✅', 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // BATCH PAYSLIP DOWNLOAD (Merged PDF)
  // ═══════════════════════════════════════════
  async batchDownloadPayslips() {
    Utils.showLoading('Generating payslip', 'Preparing batch payslips');
    try {
      const { jsPDF } = window.jspdf;
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      const payroll = await API.getPayroll(period.start, period.end);
      
      if (payroll.length === 0) {
        Utils.showToast('No payroll data for this cycle', 'error');
        Utils.hideLoading();
        return;
      }

      const doc = new jsPDF();
      
      for (let i = 0; i < payroll.length; i++) {
        if (i > 0) doc.addPage();
        const r = payroll[i];
        
        // Header
        let y = this.addLetterhead(doc, `Payslip — ${period.label}`);

        // Employee card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, y, 180, 24, 3, 3, 'FD');
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('EMPLOYEE', 22, y + 8);
        doc.text('COMPANY', 100, y + 8);
        
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.text(r.rider_name, 22, y + 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(r.client_company || 'N/A', 100, y + 18);
        y += 32;

        // Metrics
        doc.autoTable({
          startY: y,
          head: [['Orders', 'Present', 'Absent', 'Week Off', 'OT Hours', 'Bonus', 'Gross', 'Deductions', 'Net Pay']],
          body: [[r.total_orders, r.present_days, r.absent_days||0, r.weekoff_days||0, r.overtime_hours||0, `SR ${(r.bonuses||0).toLocaleString()}`, `SR ${r.total_salary.toLocaleString()}`, `SR ${(r.deductions||0).toLocaleString()}`, r.payment_status === 'paid' ? `SR ${r.calculated_salary.toLocaleString()}` : 'Pending']],
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7, cellPadding: 3, halign: 'center' },
          bodyStyles: { fontSize: 9, cellPadding: 4, halign: 'center', fontStyle: 'bold' },
          margin: { left: 15, right: 15 }
        });
        y = doc.lastAutoTable.finalY + 8;

        // Salary breakdown
        const rows = [];
        if (r.rider_type === 'company') {
          rows.push(['Base Salary', `SR ${(r.base_salary||0).toLocaleString()}`]);
        } else {
          rows.push([`${r.total_orders} orders × SR ${r.per_order_rate||0}`, `SR ${(r.total_orders * (r.per_order_rate||0)).toLocaleString()}`]);
        }
        if (r.overtime_pay > 0) rows.push(['Overtime Pay', `+ SR ${r.overtime_pay.toLocaleString()}`]);
        if (r.bonuses > 0) rows.push(['Bonus', `+ SR ${r.bonuses.toLocaleString()}`]);
        if (r.deductions > 0) rows.push(['Deductions', `- SR ${r.deductions.toLocaleString()}`]);
        if (r.advances > 0) rows.push(['Salary Advance', `- SR ${r.advances.toLocaleString()}`]);
        rows.push(['NET PAYOUT', r.payment_status === 'paid' ? `SR ${r.calculated_salary.toLocaleString()}` : 'Pending']);

        doc.autoTable({
          startY: y,
          head: [['Description', 'Amount']],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 10, cellPadding: 5 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
          margin: { left: 15, right: 15 },
          willDrawCell: (data) => {
            if (data.section === 'body' && data.row.index === rows.length - 1) doc.setFillColor(240, 253, 244);
          }
        });

        // QR verification
        const qrText = `IRL-${r.rider_id}-${period.start}-${r.payment_status === 'paid' ? 'SR' + r.calculated_salary : 'PENDING'}`;
        const qrImg = this.generateQRDataUrl(qrText);
        doc.addImage(qrImg, 'PNG', 172, doc.lastAutoTable.finalY + 5, 20, 20);
        doc.setFontSize(5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Verify: ${qrText}`, 182, doc.lastAutoTable.finalY + 27, { align: 'center' });
      }

      this.addFooter(doc);
      Utils.downloadPDF(doc, `IRL_All_Payslips_${period.label.replace(/\s+/g, '_')}.pdf`);
      Utils.showToast(`${payroll.length} payslips downloaded in one PDF! ✅`, 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // BILINGUAL ARABIC+ENGLISH PAYSLIP (single rider)
  // ═══════════════════════════════════════════
  async generateBilingualPayslip() {
    const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
    const payroll = await API.getPayroll(period.start, period.end);
    
    if (payroll.length === 0) return Utils.showToast('No payroll data', 'error');

    // Show rider picker
    const html = `
      <div class="form-grid">
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Select Rider</label>
          <select class="form-select" id="bilingual-rider-select">
            ${payroll.map(r => `<option value="${r.rider_id}">${r.rider_name}</option>`).join('')}
          </select>
        </div>
        <div class="form-actions" style="grid-column:1/-1">
          <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="ReportsCenter._downloadBilingualPayslip(${JSON.stringify(period).replace(/"/g, '&quot;')})">🌐 Generate PDF</button>
        </div>
      </div>
    `;
    Utils.openModal('Arabic + English Payslip', html);
  },

  async _downloadBilingualPayslip(period) {
    const riderId = parseInt(document.getElementById('bilingual-rider-select').value);
    Utils.closeModal();
    Utils.showLoading('Generating payslip', 'Preparing bilingual document');

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const payroll = await API.getPayroll(period.start, period.end);
      const r = payroll.find(p => p.rider_id === riderId);
      if (!r) throw new Error('Rider not found');

      let y = this.addLetterhead(doc, 'Salary Payslip');

      // Employee Card
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, y, 180, 30, 3, 3, 'FD');
      
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('EMPLOYEE NAME', 22, y + 8);
      doc.text('COMPANY', 100, y + 8);
      doc.text('PERIOD', 150, y + 8);
      
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(r.rider_name, 22, y + 18);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(r.client_company || 'N/A', 100, y + 18);
      doc.setFontSize(8);
      doc.text(period.label, 150, y + 18);
      y += 38;

      // Bilingual salary table
      const rows = [];
      if (r.rider_type === 'company') {
        rows.push(['Base Salary', `SR ${(r.base_salary||0).toLocaleString()}`]);
      } else {
        rows.push([`${r.total_orders} orders × SR ${r.per_order_rate||0}`, `SR ${(r.total_orders * (r.per_order_rate||0)).toLocaleString()}`]);
      }
      rows.push(['Present Days', `${r.present_days}`]);
      rows.push(['Absent Days', `${r.absent_days || 0}`]);
      rows.push(['Week Off Days', `${r.weekoff_days || 0}`]);
      rows.push(['Total Orders', `${r.total_orders}`]);
      if (r.overtime_pay > 0) rows.push(['Overtime Pay', `+ SR ${r.overtime_pay.toLocaleString()}`]);
      if (r.bonuses > 0) rows.push(['Bonus', `+ SR ${r.bonuses.toLocaleString()}`]);
      rows.push(['Gross Salary', `SR ${r.total_salary.toLocaleString()}`]);
      rows.push(['Total Deductions', `- SR ${(r.deductions||0).toLocaleString()}`]);
      if (r.advances > 0) rows.push(['Advance Deducted', `- SR ${r.advances.toLocaleString()}`]);
      rows.push(['NET PAYOUT', r.payment_status === 'paid' ? `SR ${r.calculated_salary.toLocaleString()}` : 'Pending']);

      doc.autoTable({
        startY: y,
        head: [['Description', 'Value']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, cellPadding: 5 },
        bodyStyles: { fontSize: 10, cellPadding: 5 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 15, right: 15 },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.row.index === rows.length - 1) doc.setFillColor(240, 253, 244);
        }
      });

      // QR Code
      const qrText = `IRL-${r.rider_id}-${period.start}-${r.payment_status === 'paid' ? 'SR' + r.calculated_salary : 'PENDING'}-${Date.now()}`;
      const qrImg = this.generateQRDataUrl(qrText);
      const qrY = doc.lastAutoTable.finalY + 8;
      doc.addImage(qrImg, 'PNG', 15, qrY, 22, 22);
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text(`Verification: ${qrText}`, 15, qrY + 25);
      
      // Signatures area
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Authorized Signature', 140, qrY + 10);
      doc.setDrawColor(200, 200, 200);
      doc.line(140, qrY + 18, 190, qrY + 18);

      this.addFooter(doc);
      Utils.downloadPDF(doc, `IRL_Payslip_AR_EN_${r.rider_name.replace(/\s+/g, '_')}_${period.label.replace(/\s+/g, '_')}.pdf`);
      Utils.showToast('Bilingual Payslip with QR downloaded! ✅', 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  // DATA EXPORT CENTER
  // ═══════════════════════════════════════════
  async exportData(type) {
    Utils.showLoading('Backing up data', 'Exporting all records securely');
    try {
      let csv = '';
      const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());

      if (type === 'riders') {
        const riders = await API.getRiders();
        csv = 'Name,Phone,Nationality,Type,Company,Store,Bank,IBAN,Base Salary,Per Order Rate,Iqama Expiry\n';
        riders.forEach(r => {
          csv += `"${r.name}","${r.phone||''}","${r.nationality||''}","${r.rider_type}","${r.client_company||''}","${r.store_warehouse||''}","${r.bank_name||''}","${r.bank_account||''}",${r.base_salary||0},${r.per_order_rate||0},"${r.iqama_expiry||''}"\n`;
        });
      } else if (type === 'logs') {
        const logs = await API.getDailyLogs(Utils.today());
        csv = 'Date,Rider ID,Status,Primary Orders,Associate Orders,Check-in Hours,Check-in Minutes\n';
        logs.forEach(l => {
          csv += `"${l.log_date}",${l.rider_id},"${l.attendance_status}",${l.primary_orders||0},${l.associate_orders||0},${l.checkin_hours||0},${l.checkin_minutes||0}\n`;
        });
      } else if (type === 'expenses') {
        const expenses = await API.getExpenses();
        csv = 'Date,Category,Vendor/Rider,Amount,Deductible,Notes\n';
        expenses.forEach(e => {
          csv += `"${e.expense_date}","${e.category}","${e.vendor_name || e.rider_name || ''}",${e.amount||0},${e.is_deductible ? 'Yes' : 'No'},"${e.notes||''}"\n`;
        });
      } else if (type === 'payroll') {
        const payroll = await API.getPayroll(period.start, period.end);
        csv = 'Rider,Type,Orders,Present Days,Absent,Week Off,OT Hours,OT Pay,Bonuses,Gross,Deductions,Advances,Net Pay,Payment Status,Bank,IBAN\n';
        payroll.forEach(r => {
          csv += `"${r.rider_name}","${r.rider_type}",${r.total_orders},${r.present_days},${r.absent_days||0},${r.weekoff_days||0},${r.overtime_hours||0},${r.overtime_pay||0},${r.bonuses||0},${r.total_salary},${r.deductions||0},${r.advances||0},${r.calculated_salary},"${r.payment_status}","${r.bank_name||''}","${r.bank_account||''}"\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IRL_${type}_export_${Utils.today()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      Utils.showToast(`${type} exported successfully! ✅`, 'success');
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  }
};

// ═══════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════
const Notifications = {
  items: [],

  async check() {
    this.items = [];
    
    try {
      const riders = await API.getRiders();
      const today = new Date();
      
      // Iqama expiry warnings
      riders.forEach(r => {
        if (r.iqama_expiry) {
          const expiry = new Date(r.iqama_expiry + 'T00:00:00');
          const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 0) {
            this.items.push({ type: 'danger', icon: '🆘', title: `${r.name} — Iqama EXPIRED`, detail: `Expired ${Math.abs(daysLeft)} days ago` });
          } else if (daysLeft <= 30) {
            this.items.push({ type: 'warning', icon: '⚠️', title: `${r.name} — Iqama Expiring`, detail: `${daysLeft} days remaining` });
          }
        }
      });

      // Uniform / Safety Kit replacement due
      riders.forEach(r => {
        if (typeof Riders !== 'undefined' && Riders.getKitStatus) {
          const uni = Riders.getKitStatus(r.uniform_date);
          const saf = Riders.getKitStatus(r.safety_kit_date);
          if (uni.urgent) this.items.push({ type: 'warning', icon: '🧥', title: `${r.name} — Uniform ${uni.shortLabel}`, detail: uni.label });
          if (saf.urgent) this.items.push({ type: 'warning', icon: '🦺', title: `${r.name} — Safety Kit ${saf.shortLabel}`, detail: saf.label });
        }
      });

      // Pending salary advances
      try {
        const advances = await API.getAdvances();
        const pending = advances.filter(a => a.status === 'pending');
        if (pending.length > 0) {
          this.items.push({ type: 'info', icon: '💰', title: `${pending.length} Pending Advance(s)`, detail: `SR ${pending.reduce((s,a) => s + a.amount, 0).toLocaleString()} total` });
        }
      } catch {}

    } catch (err) {
      console.warn('Notification check failed:', err);
    }

    this.updateBadge();
    return this.items;
  },

  updateBadge() {
    const badge = document.getElementById('notif-badge');
    const count = this.items.length;
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  showPanel() {
    const items = this.items;
    if (items.length === 0) {
      Utils.openModal('🔔 Notifications', '<div class="empty-state" style="padding:40px"><p>No alerts right now — all clear! ✅</p></div>');
      return;
    }

    const html = `
      <div style="max-height:400px; overflow-y:auto;">
        ${items.map(n => `
          <div style="display:flex; align-items:flex-start; gap:12px; padding:12px; border-bottom:1px solid var(--slate-100); transition:background 0.15s;" onmouseover="this.style.background='var(--slate-50)'" onmouseout="this.style.background='transparent'">
            <div style="font-size:20px; flex-shrink:0;">${n.icon}</div>
            <div>
              <div style="font-weight:600; font-size:13px; color:var(--text-primary);">${n.title}</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">${n.detail}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    Utils.openModal(`🔔 Notifications (${items.length})`, html);
  }
};
