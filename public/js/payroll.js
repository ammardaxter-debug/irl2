// ========================================
//  PAYROLL - Salary calculation & view
// ========================================

const Payroll = {
  _initialized: false,

  async render() {
    if (!this._initialized) {
      window.addEventListener('cycleChanged', () => {
        if (App.currentPage === 'payroll') this.render();
      });
      this._initialized = true;
    }

    this.currentPeriod = Utils.getNoonCyclePeriod(Utils.getActiveDate());

    const container = document.getElementById('page-payroll');
    container.innerHTML = '<div class="skeleton" style="height:500px"></div>';

    try {
      const data = await API.getPayroll(this.currentPeriod.start, this.currentPeriod.end);
      // Load warning sent statuses
      const cycleKey = `${this.currentPeriod.start}_${this.currentPeriod.end}`;
      await WarningWhatsApp.loadSentStatuses(cycleKey);
      container.innerHTML = this.buildHTML(data);
      this.attachEvents();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load payroll: ${err.message}</p></div>`;
    }
  },

  buildHTML(data) {
    this._currentPayrollData = data;
    // Calculate totals
    const totalSalary = data.reduce((sum, r) => sum + r.calculated_salary, 0);
    const totalOrders = data.reduce((sum, r) => sum + r.total_orders, 0);
    const companyRiders = data.filter(r => r.rider_type === 'company');
    const freelancers = data.filter(r => r.rider_type === 'freelancer');
    const ridersWithWarnings = data.filter(r => r.warnings && r.warnings.length > 0);
    const hasAnyWarnings = ridersWithWarnings.length > 0;

    return `
      <style>
        .payroll-table {
          width: 100%;
          border-collapse: collapse;
          background: #FFFFFF;
        }
        .payroll-table th, .payroll-table td {
          padding: 0 16px;
          border-bottom: 1px solid #F3F4F6;
          white-space: nowrap;
        }
        .payroll-table th {
          height: 44px;
          background: #F9FAFB;
          font-size: 11px;
          text-transform: uppercase;
          color: #9CA3AF;
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .payroll-table tbody tr {
          height: 52px;
          transition: background 0.2s;
        }
        .payroll-table tbody tr:hover {
          background: #F9FAFB;
        }
        .payroll-table th:first-child, .payroll-table td:first-child {
          position: sticky;
          left: 0;
          background: inherit;
          z-index: 5;
        }
        .payroll-table th:first-child {
          z-index: 15;
        }
        .col-left { text-align: left; }
        .col-right { text-align: right; }
        .col-center { text-align: center; }
        .stat-card-new {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #E5E7EB;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .stat-card-new-title {
          font-size: 14px;
          color: #6B7280;
          font-weight: 500;
        }
        .stat-card-new-value {
          font-size: 24px;
          font-weight: 700;
          color: #0F0F0F;
        }
        @keyframes subtlePulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); max-height: 0; }
          to { opacity: 1; transform: translateY(0); max-height: 600px; }
        }
        @keyframes warningSlideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulseAmber {
          0%, 100% { border-left-color: #F59E0B; }
          50% { border-left-color: #DC2626; }
        }
        .warning-card-anim {
          animation-name: warningSlideIn;
          animation-duration: 0.4s;
          animation-timing-function: ease-out;
          animation-fill-mode: both;
        }
        .warning-card-border {
          border-left: 4px solid #F59E0B;
          animation: pulseAmber 2.5s ease-in-out infinite;
        }
        .wa-send-btn {
          background: #25D366; color: #fff; border: none; border-radius: 20px;
          padding: 6px 16px; font-size: 12px; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37,211,102,0.3);
        }
        .wa-send-btn:hover { transform: scale(1.02); box-shadow: 0 3px 8px rgba(37,211,102,0.4); }
        .wa-preview-link {
          color: #6B7280; font-size: 12px; cursor: pointer; text-decoration: underline;
          transition: color 0.2s; border: none; background: none; padding: 0;
        }
        .wa-preview-link:hover { color: #374151; }
        .wa-send-all-btn {
          background: #25D366; color: #fff; border: none; border-radius: 10px;
          padding: 8px 20px; font-size: 13px; font-weight: 600; cursor: pointer;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(37,211,102,0.3);
        }
        .wa-send-all-btn:hover { transform: scale(1.02); box-shadow: 0 4px 12px rgba(37,211,102,0.4); }
      </style>

      <!-- Page Header & Actions -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h1 style="font-size:24px; font-weight:bold; color:#0F0F0F;">Payroll</h1>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="background:#F0FDF4; color:#16A34A; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600;">Noon Cycle: 21st → 20th</span>
          ${App.isViewer() ? '' : `
          <button id="btn-lock-payroll" style="background:#2563EB; color:#FFFFFF; border:none; border-radius:12px; padding:0 16px; height:36px; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            🔓 Lock Payroll
          </button>
          <button id="bulk-msg-btn" onclick="Payroll.startBulkWhatsapp()" disabled style="background:#16A34A; color:#FFFFFF; border:none; border-radius:12px; padding:0 16px; height:36px; font-size:14px; font-weight:500; cursor:not-allowed; opacity:0.5; display:flex; align-items:center; gap:6px; transition:all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg> 
            <span id="bulk-msg-text">Bulk Messager</span>
          </button>
          `}
        </div>
      </div>

      <!-- Search Bar -->
      <div style="position:relative; width:100%; margin-bottom:24px;">
        <div style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#9CA3AF; pointer-events:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <input type="text" id="payroll-search" placeholder="Search riders by name..." style="width:100%; height:44px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; padding:0 16px 0 44px; font-size:14px; color:#0F0F0F; outline:none; transition:all 0.2s;" onfocus="this.style.background='#FFFFFF'; this.style.borderColor='#2563EB';" onblur="this.style.background='#F9FAFB'; this.style.borderColor='#E5E7EB';">
      </div>

      <!-- Summary Cards -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
        <div class="stat-card-new" style="border-top: 4px solid #7C3AED;">
          <div class="stat-card-new-title">Total Payroll</div>
          <div class="stat-card-new-value">${Utils.formatCurrency(totalSalary)}</div>
        </div>
        <div class="stat-card-new" style="border-top: 4px solid #2563EB;">
          <div class="stat-card-new-title">Total Orders</div>
          <div class="stat-card-new-value">${totalOrders.toLocaleString()}</div>
        </div>
        <div class="stat-card-new" style="border-top: 4px solid #16A34A;">
          <div class="stat-card-new-title">Active Riders</div>
          <div class="stat-card-new-value">${data.length}</div>
        </div>
        <div class="stat-card-new" id="warnings-stat-card" style="border-top: 4px solid #DC2626; ${hasAnyWarnings ? 'animation: subtlePulse 2s infinite; background:#FEF2F2;' : ''} cursor:pointer; transition:transform 0.15s, box-shadow 0.15s;" onclick="Payroll.toggleWarningsPanel()" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(220,38,38,0.15)';" onmouseout="this.style.transform=''; this.style.boxShadow='';" title="Click to view warning details">
          <div class="stat-card-new-title" style="${hasAnyWarnings ? 'color:#DC2626; font-weight:600;' : ''}">Warnings</div>
          <div class="stat-card-new-value" style="${hasAnyWarnings ? 'color:#DC2626;' : ''}">${ridersWithWarnings.length}</div>
          ${hasAnyWarnings ? '<div style="font-size:11px; color:#9CA3AF; margin-top:4px;">Click to view details</div>' : ''}
        </div>
      </div>

      <!-- Warnings Detail Panel (hidden by default) -->
      <div id="warnings-detail-panel" style="display:none; margin-bottom:24px; border-radius:16px; border:1px solid #FECACA; background:linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 40%, #FFFBEB 100%); overflow:hidden; animation: slideDown 300ms ease-out; box-shadow: 0 4px 20px rgba(220,38,38,0.08);">
        <div style="padding:16px 20px; border-bottom:1px solid #FECACA; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.7); backdrop-filter:blur(8px);">
          <div style="display:flex; align-items:center; gap:10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" style="width:20px;height:20px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span style="font-size:16px; font-weight:800; color:#991B1B;">Payroll Warnings</span>
            <span style="background:#DC2626; color:#fff; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:700;">${ridersWithWarnings.length}</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            ${(ridersWithWarnings.length > 0 && !App.isViewer()) ? `<button class="wa-send-all-btn" onclick="WarningWhatsApp.sendAllWarnings()">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
              Send All <span style="background:rgba(255,255,255,0.3); padding:1px 8px; border-radius:8px; font-size:11px;">${ridersWithWarnings.length}</span>
            </button>` : ''}
            <button onclick="Payroll.toggleWarningsPanel()" style="background:none; border:none; cursor:pointer; color:#9CA3AF; padding:6px; border-radius:8px; transition:all 0.2s;" onmouseover="this.style.background='#FEE2E2'; this.style.color='#DC2626';" onmouseout="this.style.background='none'; this.style.color='#9CA3AF';">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style="padding:12px 16px; display:flex; flex-direction:column; gap:10px; max-height:500px; overflow-y:auto;">
          ${ridersWithWarnings.length === 0 ? '<div style="text-align:center; padding:32px; color:#6B7280;">No warnings for this cycle \uD83C\uDF89</div>' : ridersWithWarnings.map((r, idx) => {
            const isSent = WarningWhatsApp.isSent(r.rider_id);
            const typeBadge = r.rider_type === 'company'
              ? '<span style="background:#EFF6FF; color:#2563EB; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:600;">Company</span>'
              : '<span style="background:#F5F3FF; color:#7C3AED; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:600;">Freelancer</span>';
            return `
            <div id="warning-card-${r.rider_id}" class="warning-card-anim warning-card-border" style="animation-delay:${idx * 80}ms; display:flex; align-items:flex-start; gap:12px; padding:14px 18px; background:#FFFFFF; border-radius:12px; border:1px solid #F3F4F6; box-shadow:0 1px 4px rgba(0,0,0,0.04); transition:all 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'; this.style.transform='';">
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                  <span style="font-size:14px; font-weight:700; color:#0F0F0F;">${Utils.escapeHtml(r.rider_name)}</span>
                  ${typeBadge}
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
                  ${r.warnings.map(w => {
                    let bg = '#FEF3C7', color = '#92400E', icon = '\uD83D\uDCCA';
                    if (w.type === 'attendance') { bg = '#FEE2E2'; color = '#991B1B'; icon = '\uD83D\uDCC5'; }
                    else if (w.type === 'orders') { bg = '#FEF3C7'; color = '#92400E'; icon = '\uD83D\uDCE6'; }
                    else if (w.type === 'checkin') { bg = '#FFEDD5'; color = '#9A3412'; icon = '\u23F0'; }
                    return '<span style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; background:'+bg+'; color:'+color+'; font-size:11px; font-weight:600;">'+icon+' '+Utils.escapeHtml(w.message)+'</span>';
                  }).join('')}
                </div>
                <div class="warning-card-actions" style="display:flex; align-items:center; gap:12px;">
                  ${App.isViewer() ? '' : `
                  <button class="wa-send-btn" onclick="WarningWhatsApp.directSend(${r.rider_id})">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    ${isSent ? 'Resend WhatsApp' : 'Send WhatsApp'}
                  </button>
                  <button class="wa-preview-link" onclick="WarningWhatsApp.prepareAndPreview(${r.rider_id})">Preview Message</button>
                  `}
                  ${isSent ? `
                    <div style="display:flex; align-items:center; gap:6px; color:#16A34A; font-weight:600; font-size:13px; margin-left:8px;">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"/></svg>
                      Sent
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `}).join('')}
        </div>
      </div>

      <!-- Company Riders Table -->
      ${companyRiders.length > 0 ? `
      <div style="margin-bottom:32px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h2 style="font-size:16px; font-weight:600; color:#0F0F0F; margin:0;">Company Riders</h2>
          <span style="background:#EFF6FF; color:#2563EB; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${companyRiders.length} riders · Base: SR 1,950</span>
        </div>
        <div style="width:100%; overflow-x:auto; border-radius:12px; border:1px solid #E5E7EB; background:#FFFFFF;">
          <table class="payroll-table">
            <thead>
              <tr>
                ${App.isViewer() ? '' : '<th class="col-center" style="width:40px"><input type="checkbox" onchange="Payroll.toggleSelectAll(this)" style="cursor:pointer;" /></th>'}
                <th class="col-left">Rider</th>
                <th class="col-center">Attendance</th>
                <th class="col-right">Orders</th>
                <th class="col-right">Base Salary</th>
                <th class="col-right">Deductions</th>
                <th class="col-right">Net Salary</th>
                <th class="col-center">Status</th>
                <th class="col-center" style="width:80px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${companyRiders.map(r => {
                const hasWarnings = r.warnings && r.warnings.length > 0;
                const warningTooltip = hasWarnings ? r.warnings.map(w => w.message).join(' | ') : '';
                
                const missedDays = 26 - r.present_days;
                let attColor = '#16A34A';
                if (missedDays > 0 && missedDays <= 2) attColor = '#D97706';
                if (missedDays >= 3) attColor = '#DC2626';
                
                const ordersColor = r.total_orders < 520 ? '#DC2626' : '#374151';
                const dedColor = (r.deductions || 0) > 0 ? '#DC2626' : '#9CA3AF';
                
                let netColor = '#16A34A';
                if (r.calculated_salary < r.total_salary) netColor = '#D97706';
                if (r.calculated_salary < (r.total_salary - 200)) netColor = '#DC2626'; // Arbitrary threshold for red
                if (r.payment_status !== 'paid') netColor = '#9CA3AF';

                return `
                  <tr class="payroll-row" data-name="${Utils.escapeHtml(r.rider_name).toLowerCase()}">
                    ${App.isViewer() ? '' : `
                    <td class="col-center">
                      <input type="checkbox" class="rider-checkbox" value="${r.rider_id}" onchange="Payroll.updateBulkButtonState()" style="cursor:pointer;" />
                    </td>
                    `}
                    <td class="col-left">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-weight:600; color:#0F0F0F; font-size:14px;">${Utils.escapeHtml(r.rider_name)}</span>
                        ${hasWarnings ? `<span title="${warningTooltip}" style="color:#D97706; cursor:help; font-size:14px;">⚠️</span>` : ''}
                      </div>
                    </td>
                    <td class="col-center">
                      <span style="font-weight:600; color:${attColor}; font-size:14px;">${r.present_days} <span style="font-size:12px; color:#9CA3AF;">/ 26</span></span>
                    </td>
                    <td class="col-right">
                      <span style="font-weight:600; color:${ordersColor}; font-size:14px;">${r.total_orders}</span>
                    </td>
                    <td class="col-right">
                      <span style="color:#374151; font-size:14px;">${Utils.formatCurrency(r.base_salary)}</span>
                    </td>
                    <td class="col-right">
                      <span style="color:${dedColor}; font-size:14px;">${(r.deductions || 0) > 0 ? '-' : ''}${Utils.formatCurrency(r.deductions || 0)}</span>
                    </td>
                    <td class="col-right">
                      <span style="font-weight:700; color:${netColor}; font-size:14px;">${r.payment_status === 'paid' ? Utils.formatCurrency(r.calculated_salary) : 'Pending'}</span>
                    </td>
                    <td class="col-center">
                    <td class="col-center">
                      ${App.isViewer() ? `
                        ${r.payment_status === 'paid' 
                          ? '<span style="background:#DCFCE7; color:#16A34A; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Paid</span>'
                          : r.payment_status === 'on-hold'
                            ? '<span style="background:#FEE2E2; color:#991B1B; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Hold</span>'
                            : '<span style="background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Pending</span>'}
                      ` : `
                        <button onclick="Payroll.openPaymentModal(${r.rider_id})" style="border:none; background:transparent; padding:0; cursor:pointer;" title="Click to update status">
                        ${r.payment_status === 'paid' 
                          ? '<span style="background:#DCFCE7; color:#16A34A; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Paid</span>'
                          : r.payment_status === 'on-hold'
                            ? '<span style="background:#FEE2E2; color:#991B1B; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Hold</span>'
                            : '<span style="background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Pending</span>'}
                        </button>
                      `}
                    </td>
                    <td class="col-center">
                      <div style="display:flex; justify-content:center; gap:4px;">
                        ${App.isViewer() ? '' : `
                        <button onclick="Payroll.openPaymentModal(${r.rider_id})" style="background:transparent; border:none; cursor:pointer; color:#6B7280; padding:4px;" title="Edit Payment Status">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        `}
                        <button onclick="Payroll.shareWhatsApp('${Utils.escapeHtml(r.rider_name).replace(/'/g, "\\'")}', '${r.phone || ''}', '${Utils.formatCurrency(r.total_salary)}', '${Utils.formatCurrency(r.deductions || 0)}', '${Utils.formatCurrency(r.calculated_salary)}', ${r.total_orders}, '${r.rider_type}', '${Payroll.currentPeriod.label}', '${r.payment_status}', JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(r.daily_logs || []))}')))" style="background:transparent; border:none; cursor:pointer; color:#16A34A; padding:4px;" title="WhatsApp Payslip">
                          <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        </button>
                        <button onclick="Payroll.downloadPayslip(${r.rider_id})" style="background:transparent; border:none; cursor:pointer; color:#6B7280; padding:4px;" title="Download PDF">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        ${App.isViewer() ? '' : `
                        <button onclick="Payroll.deleteRiderCycleData(${r.rider_id}, '${Utils.escapeHtml(r.rider_name).replace(/'/g, "\\'")}')" style="background:transparent; border:none; cursor:pointer; color:#EF4444; padding:4px;" title="Reset Cycle Data">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- Freelancers Table -->
      ${freelancers.length > 0 ? `
      <div style="margin-bottom:32px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h2 style="font-size:16px; font-weight:600; color:#0F0F0F; margin:0;">Freelancer Riders</h2>
          <span style="background:#F5F3FF; color:#7C3AED; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${freelancers.length} riders · SR 8/order</span>
        </div>
        <div style="width:100%; overflow-x:auto; border-radius:12px; border:1px solid #E5E7EB; background:#FFFFFF;">
          <table class="payroll-table">
            <thead>
              <tr>
                ${App.isViewer() ? '' : '<th class="col-center" style="width:40px"><input type="checkbox" onchange="Payroll.toggleSelectAll(this)" style="cursor:pointer;" /></th>'}
                <th class="col-left">Rider</th>
                <th class="col-right">Orders</th>
                <th class="col-right">Days</th>
                <th class="col-right">Bonus</th>
                <th class="col-right">Deductions</th>
                <th class="col-right">Net Salary</th>
                <th class="col-center">Status</th>
                <th class="col-center" style="width:80px">Action</th>
              </tr>
            </thead>
            <tbody>
              ${freelancers.map(r => {
                const hasWarnings = r.warnings && r.warnings.length > 0;
                const warningTooltip = hasWarnings ? r.warnings.map(w => w.message).join(' | ') : '';
                
                const dedColor = (r.deductions || 0) > 0 ? '#DC2626' : '#9CA3AF';
                let netColor = '#16A34A';
                if (r.calculated_salary < r.total_salary) netColor = '#D97706';
                if (r.payment_status !== 'paid') netColor = '#9CA3AF';

                return `
                  <tr class="payroll-row" data-name="${Utils.escapeHtml(r.rider_name).toLowerCase()}">
                    ${App.isViewer() ? '' : `
                    <td class="col-center">
                      <input type="checkbox" class="rider-checkbox" value="${r.rider_id}" onchange="Payroll.updateBulkButtonState()" style="cursor:pointer;" />
                    </td>
                    `}
                    <td class="col-left">
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-weight:600; color:#0F0F0F; font-size:14px;">${Utils.escapeHtml(r.rider_name)}</span>
                        ${hasWarnings ? `<span title="${warningTooltip}" style="color:#D97706; cursor:help; font-size:14px;">⚠️</span>` : ''}
                      </div>
                    </td>
                    <td class="col-right">
                      <span style="font-weight:600; color:#374151; font-size:14px;">${r.total_orders}</span>
                    </td>
                    <td class="col-right">
                      <span style="color:#374151; font-size:14px;">${r.present_days}</span>
                    </td>
                    <td class="col-right">
                      <span style="color:#16A34A; font-size:14px;">${r.bonuses > 0 ? '+' : ''}${Utils.formatCurrency(r.bonuses || 0)}</span>
                    </td>
                    <td class="col-right">
                      <span style="color:${dedColor}; font-size:14px;">${(r.deductions || 0) > 0 ? '-' : ''}${Utils.formatCurrency(r.deductions || 0)}</span>
                    </td>
                    <td class="col-right">
                      <span style="font-weight:700; color:${netColor}; font-size:14px;">${r.payment_status === 'paid' ? Utils.formatCurrency(r.calculated_salary) : 'Pending'}</span>
                    </td>
                    <td class="col-center">
                      ${App.isViewer() ? `
                        ${r.payment_status === 'paid' 
                          ? '<span style="background:#DCFCE7; color:#16A34A; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Paid</span>'
                          : r.payment_status === 'on-hold'
                            ? '<span style="background:#FEE2E2; color:#991B1B; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Hold</span>'
                            : '<span style="background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Pending</span>'}
                      ` : `
                        <button onclick="Payroll.openPaymentModal(${r.rider_id})" style="border:none; background:transparent; padding:0; cursor:pointer;" title="Click to update status">
                        ${r.payment_status === 'paid' 
                          ? '<span style="background:#DCFCE7; color:#16A34A; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Paid</span>'
                          : r.payment_status === 'on-hold'
                            ? '<span style="background:#FEE2E2; color:#991B1B; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Hold</span>'
                            : '<span style="background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">Pending</span>'}
                        </button>
                      `}
                    </td>
                    <td class="col-center">
                      <div style="display:flex; justify-content:center; gap:4px;">
                        ${App.isViewer() ? '' : `
                        <button onclick="Payroll.openPaymentModal(${r.rider_id})" style="background:transparent; border:none; cursor:pointer; color:#6B7280; padding:4px;" title="Edit Payment Status">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        `}
                        <button onclick="Payroll.shareWhatsApp('${Utils.escapeHtml(r.rider_name).replace(/'/g, "\\'")}', '${r.phone || ''}', '${Utils.formatCurrency(r.total_salary)}', '${Utils.formatCurrency(r.deductions || 0)}', '${Utils.formatCurrency(r.calculated_salary)}', ${r.total_orders}, '${r.rider_type}', '${Payroll.currentPeriod.label}', '${r.payment_status}', JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(r.daily_logs || []))}')))" style="background:transparent; border:none; cursor:pointer; color:#16A34A; padding:4px;" title="WhatsApp Payslip">
                          <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                        </button>
                        <button onclick="Payroll.downloadPayslip(${r.rider_id})" style="background:transparent; border:none; cursor:pointer; color:#6B7280; padding:4px;" title="Download PDF">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        ${App.isViewer() ? '' : `
                        <button onclick="Payroll.deleteRiderCycleData(${r.rider_id}, '${Utils.escapeHtml(r.rider_name).replace(/'/g, "\\'")}')" style="background:transparent; border:none; cursor:pointer; color:#EF4444; padding:4px;" title="Reset Cycle Data">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                        `}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      ${data.length === 0 ? `
        <div style="text-align:center; padding:80px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:64px;height:64px; margin:0 auto 16px;"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <div style="font-size:16px; font-weight:500; color:#0F0F0F;">No active riders to calculate payroll</div>
          <div style="font-size:14px; color:#6B7280; margin-top:8px;">Add riders first, then log their daily data</div>
        </div>
      ` : ''}
    `;
  },

  attachEvents() {
    // Search filter
    document.getElementById('payroll-search')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.payroll-row').forEach(row => {
        const name = row.getAttribute('data-name') || '';
        row.style.display = name.includes(query) ? '' : 'none';
      });
    });

    // Lock button
    const lockBtn = document.getElementById('btn-lock-payroll');
    if (lockBtn) {
      const cycleKey = `${this.currentPeriod.start}_${this.currentPeriod.end}`;
      API.getPayrollLockStatus(cycleKey).then(res => {
        if (res.locked) {
          lockBtn.innerHTML = '🔒 Locked';
          lockBtn.style.background = 'var(--danger)';
        }
      }).catch(() => {});

      lockBtn.addEventListener('click', async () => {
        const cycleKey = `${this.currentPeriod.start}_${this.currentPeriod.end}`;
        try {
          const status = await API.getPayrollLockStatus(cycleKey);
          if (status.locked) {
            if (confirm('Unlock payroll for editing?')) {
              await API.unlockPayroll(cycleKey);
              Utils.showToast('Payroll unlocked', 'success');
            }
          } else {
            if (confirm('Lock payroll? This prevents edits to daily logs for this cycle.')) {
              await API.lockPayroll(cycleKey);
              Utils.showToast('Payroll locked ✅', 'success');
            }
          }
          this.render();
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      });
    }
  },

  toggleWarningsPanel() {
    const panel = document.getElementById('warnings-detail-panel');
    if (!panel) return;
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      // Smooth scroll into view
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      panel.style.display = 'none';
    }
  },

  openPaymentModal(riderId) {
    if (App.isViewer()) return;
    const rider = this._currentPayrollData.find(r => r.rider_id === riderId);
    if (!rider) return Utils.showToast('Rider not found', 'error');

    const html = `
      <div class="form-grid">
        <div class="form-group" style="grid-column: 1/-1; text-align:center;">
          <p style="margin-bottom:8px; font-size:15px; color:var(--text-secondary)">Update payroll details for:<br><strong style="color:var(--text-primary); font-size:18px">${Utils.escapeHtml(rider.rider_name)}</strong></p>
          
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom: 20px; text-align:left;">
             <div>
               <label class="form-label">Manual Deductions (SR)</label>
               <input type="number" id="manual-deductions" class="form-control" value="${rider.manual_deductions || 0}" step="any" placeholder="0">
             </div>
             <div>
               <label class="form-label">Manual Bonus (SR)</label>
               <input type="number" id="manual-bonus" class="form-control" value="${rider.manual_bonus || 0}" step="any" placeholder="0">
             </div>
          </div>
          
          <div style="margin-bottom: 20px; text-align:left;">
             <label class="form-label">Notes</label>
             <input type="text" id="payment-notes" class="form-control" value="${Utils.escapeHtml(rider.notes || '')}" placeholder="Add optional notes...">
          </div>

          <div style="margin-bottom: 20px; text-align:left;">
             <label class="form-label">Final Paid Amount (SR)</label>
             <input type="number" id="final-paid-amount" class="form-control" value="${rider.calculated_salary || 0}" step="any" placeholder="Enter actual paid amount">
             <small style="color:var(--text-tertiary)">Calculated net is pre-filled. Adjust if you made manual payments or overrides.</small>
          </div>

          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-outline" style="${rider.payment_status === 'pending' ? 'background:var(--slate-100); border-color:var(--slate-500);' : ''} color:var(--slate-700)" onclick="Payroll._setPaymentStatus(${riderId}, 'pending')">
              ⏳ Save as Pending
            </button>
            <button class="btn btn-outline" style="${rider.payment_status === 'on-hold' ? 'background:var(--amber-50); border-color:var(--amber-500);' : ''} color:var(--amber-600)" onclick="Payroll._setPaymentStatus(${riderId}, 'on-hold')">
              ⛔ Put On-Hold
            </button>
            <button class="btn btn-success" style="${rider.payment_status === 'paid' ? 'background:var(--success-700);' : 'background:var(--success);'} color:white;" onclick="Payroll._setPaymentStatus(${riderId}, 'paid')">
              ✅ Lock & Mark Paid
            </button>
          </div>
        </div>
      </div>
    `;
    Utils.openModal('Update Payment Status', html);
  },

  async _setPaymentStatus(riderId, nextStatus) {
    const amtInput = document.getElementById('final-paid-amount');
    const finalPaidAmount = amtInput && nextStatus === 'paid' ? parseFloat(amtInput.value) || 0 : null;
    
    const dedInput = document.getElementById('manual-deductions');
    const manualDeductions = dedInput ? parseFloat(dedInput.value) || 0 : 0;
    
    const bonInput = document.getElementById('manual-bonus');
    const manualBonus = bonInput ? parseFloat(bonInput.value) || 0 : 0;
    
    const notesInput = document.getElementById('payment-notes');
    const notes = notesInput ? notesInput.value : '';

    Utils.closeModal();
    Utils.showLoading('Saving status');
    const cycleKey = `${this.currentPeriod.start}_${this.currentPeriod.end}`;
    try {
      await API.setPaymentStatus(riderId, cycleKey, nextStatus, finalPaidAmount, notes, manualDeductions, manualBonus);
      Utils.showToast(`Status updated to ${nextStatus.toUpperCase()}`, 'success');
      
      // Re-fetch to ensure the total calculations reflect the new manual deductions/bonuses
      this._currentPayrollData = await API.getPayroll(this.currentPeriod.start, this.currentPeriod.end);
      this.render();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  async deleteRiderCycleData(riderId, riderName) {
    if (App.isViewer()) return;
    const cycleKey = `${this.currentPeriod.start}_${this.currentPeriod.end}`;
    try {
      // 1. Check if payroll is locked first
      const status = await API.getPayrollLockStatus(cycleKey);
      if (status.locked) {
        Utils.showToast('Cannot delete cycle logs because this payroll cycle is locked.', 'error');
        return;
      }

      // 2. Destructive confirmation dialog
      const message = `Are you sure you want to permanently delete all logs and payment status overrides for ${riderName} for the cycle ${this.currentPeriod.label}? This will delete their daily logs, work hours, and payment status, allowing them to submit again. This action cannot be undone.`;
      const confirmed = await Utils.confirm(message, 'Reset Rider Cycle Data', 'Yes, Delete All', 'Cancel', true);
      
      if (!confirmed) return;

      Utils.showLoading('Resetting rider cycle data', `Deleting logs for ${riderName}...`);
      
      const result = await API.deleteRiderCycleData(riderId, this.currentPeriod.start, this.currentPeriod.end);
      
      Utils.hideLoading();
      
      if (result.success) {
        Utils.showToast(`Successfully reset cycle data for ${riderName}`, 'success');
        this.render(); // Refresh the dashboard/payroll tables
      } else {
        Utils.showToast(result.error || 'Failed to delete cycle data', 'error');
      }
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast(err.message || 'Error occurred while resetting cycle data', 'error');
    }
  },

  async openAddBonus() {
    const riders = this._currentPayrollData || [];
    const html = `
      <form id="bonus-form" class="form-grid">
        <div class="form-group">
          <label class="form-label">Rider <span class="required">*</span></label>
          <select class="form-select" name="rider_id" required>
            <option value="">Select rider</option>
            ${riders.map(r => `<option value="${r.rider_id}">${Utils.escapeHtml(r.rider_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Bonus Amount (SR) <span class="required">*</span></label>
          <input type="number" class="form-input" name="amount" min="1" required placeholder="e.g. 200">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Reason</label>
          <input type="text" class="form-input" name="reason" placeholder="e.g. Ramadan bonus, Top performer">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">🎁 Add Bonus</button>
        </div>
      </form>
    `;
    Utils.openModal('Add Bonus — ' + this.currentPeriod.label, html);
    document.getElementById('bonus-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        Utils.showLoading('Saving');
        await API.createBonus({
          rider_id: parseInt(fd.get('rider_id')),
          amount: parseFloat(fd.get('amount')),
          reason: fd.get('reason'),
          cycle_start: this.currentPeriod.start,
          cycle_end: this.currentPeriod.end
        });
        Utils.hideLoading();
        Utils.closeModal();
        Utils.showToast('Bonus added ✅', 'success');
        this.render();
      } catch (err) {
        Utils.hideLoading();
        Utils.showToast(err.message, 'error');
      }
    });
  },

  async openAddAdvance() {
    const riders = this._currentPayrollData || [];
    const html = `
      <form id="advance-form" class="form-grid">
        <div class="form-group">
          <label class="form-label">Rider <span class="required">*</span></label>
          <select class="form-select" name="rider_id" required>
            <option value="">Select rider</option>
            ${riders.map(r => `<option value="${r.rider_id}">${Utils.escapeHtml(r.rider_name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Advance Amount (SR) <span class="required">*</span></label>
          <input type="number" class="form-input" name="amount" min="1" required placeholder="e.g. 500">
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label class="form-label">Notes</label>
          <input type="text" class="form-input" name="notes" placeholder="e.g. Requested by rider for emergency">
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" style="background:var(--amber-500)">💰 Create Advance</button>
        </div>
      </form>
    `;
    Utils.openModal('Salary Advance — ' + this.currentPeriod.label, html);
    document.getElementById('advance-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        Utils.showLoading('Saving');
        await API.createAdvance({
          rider_id: parseInt(fd.get('rider_id')),
          amount: parseFloat(fd.get('amount')),
          notes: fd.get('notes'),
          cycle_start: this.currentPeriod.start,
          cycle_end: this.currentPeriod.end
        });
        Utils.hideLoading();
        Utils.closeModal();
        Utils.showToast('Advance created — will be deducted once approved', 'success');
        this.render();
      } catch (err) {
        Utils.hideLoading();
        Utils.showToast(err.message, 'error');
      }
    });
  },

  exportBankCSV() {
    const data = this._currentPayrollData || [];
    if (data.length === 0) return Utils.showToast('No payroll data', 'error');

    const unpaid = data.filter(r => r.payment_status !== 'paid');
    if (unpaid.length === 0) return Utils.showToast('All riders already marked as Paid', 'info');

    const header = 'Rider Name,Bank Name,IBAN / Account,Net Payout (SR)\n';
    const rows = unpaid.map(r => 
      `"${r.rider_name}","${r.bank_name || 'N/A'}","${r.bank_account || 'N/A'}",${r.calculated_salary}`
    ).join('\n');

    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IRL_Bank_Payment_${this.currentPeriod.start}_to_${this.currentPeriod.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast(`Exported ${unpaid.length} unpaid riders to CSV`, 'success');
  },

  async openMultiMonthCompare() {
    Utils.showLoading('Loading data');
    try {
      const current = this.currentPeriod;
      const prev1 = Utils.shiftPeriod(current.start, -1);
      const prev2 = Utils.shiftPeriod(prev1.start, -1);

      const [d1, d2, d3] = await Promise.all([
        API.getPayroll(current.start, current.end),
        API.getPayroll(prev1.start, prev1.end),
        API.getPayroll(prev2.start, prev2.end)
      ]);
      Utils.hideLoading();

      // Build comparison table
      const allRiderIds = [...new Set([...d1, ...d2, ...d3].map(r => r.rider_id))];
      const rows = allRiderIds.map(id => {
        const c = d1.find(r => r.rider_id === id);
        const p1 = d2.find(r => r.rider_id === id);
        const p2 = d3.find(r => r.rider_id === id);
        const name = (c || p1 || p2).rider_name;
        const cur = c ? c.total_orders : 0;
        const prv = p1 ? p1.total_orders : 0;
        const trend = cur > prv ? '📈' : cur < prv ? '📉' : '➡️';
        return `<tr>
          <td><strong>${Utils.escapeHtml(name)}</strong></td>
          <td>${p2 ? p2.total_orders : '—'}</td>
          <td>${p2 ? Utils.formatCurrency(p2.calculated_salary) : '—'}</td>
          <td>${p1 ? p1.total_orders : '—'}</td>
          <td>${p1 ? Utils.formatCurrency(p1.calculated_salary) : '—'}</td>
          <td><strong>${c ? c.total_orders : '—'}</strong></td>
          <td><strong>${c ? Utils.formatCurrency(c.calculated_salary) : '—'}</strong></td>
          <td style="font-size:18px">${trend}</td>
        </tr>`;
      }).join('');

      const html = `
        <div class="table-container" style="max-height:500px;overflow-y:auto;">
          <table class="data-table" style="font-size:12px">
            <thead style="position:sticky;top:0;z-index:2">
              <tr>
                <th>Rider</th>
                <th colspan="2">${prev2.label}</th>
                <th colspan="2">${prev1.label}</th>
                <th colspan="2">${current.label}</th>
                <th>Trend</th>
              </tr>
              <tr style="font-size:10px;color:var(--text-tertiary)">
                <th></th><th>Orders</th><th>Pay</th><th>Orders</th><th>Pay</th><th>Orders</th><th>Pay</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
      Utils.openModal('📊 3-Month Comparison', html);
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast(err.message, 'error');
    }
  },


  shareWhatsApp(name, phone, grossSalary, deductions, netPayout, totalOrders, riderType, periodLabel, paymentStatus, dailyLogs = []) {
    const typeLabel = riderType === 'company' ? 'Company Rider' : 'Freelancer';
    
    // Check if it's currently paid
    const isPending = paymentStatus !== 'paid';

    const messageLines = [
      `INSPIRING ROADS LOGISTICS`,
      `Payslip - ${periodLabel}`,
      `--------------------------------`,
      ``,
      `Rider: *${name}*`,
      `Type: ${typeLabel}`,
      `Total Orders: ${totalOrders}`,
      ``
    ];

    if (dailyLogs && dailyLogs.length > 0) {
      messageLines.push(`*Daily Breakdown:*`);
      dailyLogs.forEach(log => {
        // Format date from YYYY-MM-DD to MMM DD (e.g. Apr 21)
        const d = new Date(log.date);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        messageLines.push(`${dateStr}: ${log.orders} orders`);
      });
      messageLines.push(`--------------------------------`);
      messageLines.push(``);
    }

    if (!isPending) {
      messageLines.push(`Gross Salary: ${grossSalary}`);
    } else {
      messageLines.push(`Status: Pending final review`);
    }

    messageLines.push(`Deductions: ${deductions}`);
    messageLines.push(`--------------------------------`);
    
    if (!isPending) {
      messageLines.push(`*Net Payout: ${netPayout}*`);
    } else {
      messageLines.push(`*Net Payout: Pending*`);
    }

    messageLines.push(`--------------------------------`);
    messageLines.push(``);
    messageLines.push(`_This is an auto-generated payslip from Inspiring Roads Logistics._`);

    const message = messageLines.join('\n');

    const encoded = encodeURIComponent(message);
    
    if (phone) {
      // Clean phone number
      let cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.startsWith('05')) cleanPhone = '+966' + cleanPhone.substring(1);
      if (!cleanPhone.startsWith('+')) cleanPhone = '+966' + cleanPhone;
      window.open(`https://wa.me/${cleanPhone.replace('+', '')}?text=${encoded}`, '_blank');
    } else {
      // No phone, open WhatsApp with message only
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
      Utils.showToast('No phone number saved for this rider — opened WhatsApp without recipient', 'info');
    }
  },

  async downloadPayslip(riderId) {
    const mount = document.getElementById('print-mount');
    if (!mount) {
      Utils.showToast('Print engine not initialized. Refresh the page.', 'error');
      return;
    }
    
    try {
      let payrollData = this._currentPayrollData;
      if (!payrollData || payrollData.length === 0) {
        payrollData = await API.getPayroll(this.currentPeriod.start, this.currentPeriod.end);
      }
      const rider = payrollData.find(r => r.rider_id === riderId);
      if (!rider) throw new Error('Rider not found in payroll data');

      Utils.showLoading('Generating payslip', `Preparing ${rider.rider_name} · ${this.currentPeriod.label}`);

      const logs = await API.request(`/daily-logs/rider/${riderId}?start=${this.currentPeriod.start}&end=${this.currentPeriod.end}`);
      const periodLabel = this.currentPeriod.label;
      const companyName = rider.client_company || 'N/A';
      const isPaid = rider.payment_status === 'paid';
      const baseRateDisplay = rider.rider_type === 'company' 
        ? (rider.base_salary || 1950).toLocaleString() 
        : `${rider.per_order_rate || 0} / order`;

      const qrText = `IRL-${rider.rider_id}-${this.currentPeriod.start}-${isPaid ? 'SR' + rider.calculated_salary : 'PENDING'}`;
      let qrImg = '';
      if (typeof ReportsCenter !== 'undefined' && ReportsCenter.generateQRDataUrl) {
        qrImg = ReportsCenter.generateQRDataUrl(qrText);
      }

      const html = `
        <div class="print-page">
          <div style="background: #0f172a; padding: 40px; color: white; position: relative; border-bottom: 6px solid #3b82f6;">
            <h1 style="margin:0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">INSPIRING ROADS LOGISTICS</h1>
            <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px; font-weight: 500; letter-spacing: 1px;">OFFICIAL SALARY PAYSLIP</p>
            <div style="position: absolute; right: 40px; top: 40px; text-align: right;">
              <div style="font-weight: 700; font-size: 16px;">${periodLabel}</div>
              <div style="color: #94a3b8; font-size: 12px; margin-top: 6px;">Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
              <div style="color: #94a3b8; font-size: 12px; margin-top: 3px;">Riyadh, Kingdom of Saudi Arabia</div>
            </div>
            <div style="position: absolute; right: 40px; top: 105px;">
              ${isPaid 
                ? '<div style="background: #10b981; color: white; padding: 8px 20px; border-radius: 99px; font-weight: 800; font-size: 14px;">✓ PAID</div>' 
                : '<div style="background: #f59e0b; color: white; padding: 8px 20px; border-radius: 99px; font-weight: 800; font-size: 14px;">PENDING</div>'}
            </div>
          </div>

          <div style="padding: 40px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; display: flex; justify-content: space-between; margin-bottom: 40px;">
              <div>
                <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">Employee</div>
                <div style="font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 6px;">${Utils.escapeHtml(rider.rider_name)}</div>
                <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-top: 8px;">${rider.rider_type === 'company' ? 'Company Rider' : 'Freelancer'} &bull; ${Utils.escapeHtml(companyName)}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px; text-transform: uppercase;">Base / Rate</div>
                <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 6px;">SR ${baseRateDisplay}</div>
                <div style="font-size: 14px; font-weight: 500; color: #64748b; margin-top: 8px;">Phone: ${Utils.escapeHtml(rider.phone) || '—'}</div>
              </div>
            </div>

            <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Performance & Attendance Summary</h2>
            <div style="display: flex; gap: 12px; margin-bottom: 40px;">
              <div style="flex:1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: #2563eb;">${rider.total_orders}</div>
                <div style="font-size: 11px; font-weight: 700; color: #60a5fa; margin-top: 6px; text-transform: uppercase;">Total Orders</div>
              </div>
              <div style="flex:1; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: #059669;">${rider.present_days}</div>
                <div style="font-size: 11px; font-weight: 700; color: #34d399; margin-top: 6px; text-transform: uppercase;">Present Days</div>
              </div>
              <div style="flex:1; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: #e11d48;">${rider.absent_days || 0}</div>
                <div style="font-size: 11px; font-weight: 700; color: #fb7185; margin-top: 6px; text-transform: uppercase;">Absent</div>
              </div>
              <div style="flex:1; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center;">
                <div style="font-size: 28px; font-weight: 800; color: #d97706;">${rider.weekoff_days || 0}</div>
                <div style="font-size: 11px; font-weight: 700; color: #fbbf24; margin-top: 6px; text-transform: uppercase;">Week Off</div>
              </div>
            </div>

            <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Salary Calculation</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
              <thead>
                <tr style="background: #0f172a; color: white;">
                  <th style="padding: 16px 20px; text-align: left; font-size: 13px; font-weight: 600;">Description</th>
                  <th style="padding: 16px 20px; text-align: right; font-size: 13px; font-weight: 600;">Amount</th>
                </tr>
              </thead>
              <tbody style="background: #fff;">
                ${isPaid ? `
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500; color: #334155;">
                      ${rider.rider_type === 'company' ? 'Base Salary (Monthly)' : `Order Earnings (${rider.total_orders} &times; SR ${rider.per_order_rate || 0})`}
                    </td>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 700; color: #0f172a; text-align: right;">
                      SR ${rider.rider_type === 'company' ? (rider.base_salary || 0).toLocaleString() : (rider.total_orders * (rider.per_order_rate || 0)).toLocaleString()}
                    </td>
                  </tr>
                  ${rider.bonuses > 0 ? `
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500; color: #334155;">Manual Bonus</td>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 700; color: #059669; text-align: right;">+ SR ${rider.bonuses.toLocaleString()}</td>
                  </tr>` : ''}
                ` : `
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500; color: #334155;">Payment Status</td>
                    <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; font-style: italic; color: #d97706; text-align: right;">Pending &mdash; base salary hidden until payment is processed</td>
                  </tr>
                `}
                
                ${rider.deductions > 0 ? `
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 500; color: #334155;">Total Deductions (Advances / Expenses)</td>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 700; color: #e11d48; text-align: right;">- SR ${rider.deductions.toLocaleString()}</td>
                </tr>` : ''}

                ${isPaid ? `
                <tr style="background: #f0fdf4;">
                  <td style="padding: 20px; font-size: 16px; font-weight: 800; color: #059669;">NET PAYOUT</td>
                  <td style="padding: 20px; font-size: 20px; font-weight: 800; color: #059669; text-align: right;">SR ${rider.calculated_salary.toLocaleString()}</td>
                </tr>` : ''}
              </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px;" class="print-no-break">
              <div style="display: flex; align-items: center; gap: 16px;">
                ${qrImg ? `<img src="${qrImg}" style="width: 80px; height: 80px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px;" />` : ''}
                <div>
                  <div style="font-size: 11px; font-weight: 600; color: #64748b;">Verification Hash</div>
                  <div style="font-size: 12px; font-family: monospace; color: #334155; margin-top: 4px;">${qrText}</div>
                </div>
              </div>
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px 24px; text-align: center; min-width: 200px;">
                <div style="font-size: 12px; font-weight: 800; color: #64748b; text-transform: uppercase;">Computer Generated Document</div>
                <div style="font-size: 11px; font-weight: 500; color: #94a3b8; margin-top: 4px;">No physical signature required</div>
              </div>
            </div>

            <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
              <p style="margin: 0 0 4px 0; font-size: 11px; color: #94a3b8; font-style: italic;">* Deductions include Cash Advances, Food, Equipment, and other company-authorized expenses.</p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; font-style: italic;">* This document is generated securely by the Inspiring Roads Logistics System. For queries, contact HR.</p>
            </div>
          </div>
        </div>
        
        ${logs.length > 0 ? `
        <div class="print-page">
           <div style="padding: 40px;">
             <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px;">Daily Attendance & Orders Log</h2>
             <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Date</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Status</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Primary</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Assoc.</th>
                    <th style="padding: 12px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Total</th>
                    <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1;">Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  ${[...logs].sort((a, b) => a.log_date.localeCompare(b.log_date)).map(l => {
                    const isPresent = l.attendance_status === 'Present';
                    const isAbsent = l.attendance_status === 'Absent';
                    const totalOrd = (l.primary_orders || 0) + (l.associate_orders || 0);
                    const checkinStr = isPresent ? `${l.checkin_hours || 0}:${String(l.checkin_minutes || 0).padStart(2, '0')}` : '&mdash;';
                    const checkinH = l.checkin_hours || 0;
                    const lateWarning = isPresent && checkinH < 11 ? 'color: #e11d48; font-weight: 700;' : '';
                    const dayName = new Date(l.log_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                    
                    return `
                    <tr>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; color: #334155;">${dayName}, ${l.log_date}</td>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 600; color: ${isPresent ? '#059669' : (isAbsent ? '#e11d48' : '#d97706')}">${l.attendance_status || 'Present'}</td>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">${isPresent ? (l.primary_orders || 0) : '&mdash;'}</td>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">${isPresent ? (l.associate_orders || 0) : '&mdash;'}</td>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 700; color: #0f172a;">${isPresent ? totalOrd : '&mdash;'}</td>
                      <td style="padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b; ${lateWarning}">${checkinStr}</td>
                    </tr>
                    `;
                  }).join('')}
                </tbody>
             </table>
           </div>
        </div>
        ` : ''}
      `;

      mount.innerHTML = html;
      Utils.hideLoading();
      
      setTimeout(() => {
        document.title = `Payslip_${rider.rider_name.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}`;
        window.print();
        setTimeout(() => { document.title = 'Inspiring Roads Logistics — Rider Management'; }, 1000);
      }, 500);

    } catch (e) {
      console.error(e);
      Utils.showToast('Failed to generate template: ' + e.message, 'error');
      Utils.hideLoading();
    }
  },
  // ========================================
  // Mass Bulk Messaging System
  // ========================================
  toggleSelectAll(source) {
    const isChecked = source.checked;
    const table = source.closest('table');
    if (table) {
      const checkboxes = table.querySelectorAll('.rider-checkbox');
      checkboxes.forEach(cb => {
        // Only check visible checkboxes in case they used the search filter
        if (cb.closest('tr').style.display !== 'none') {
          cb.checked = isChecked;
        }
      });
    }
    this.updateBulkButtonState();
  },

  updateBulkButtonState() {
    const count = document.querySelectorAll('.rider-checkbox:checked').length;
    const btn = document.getElementById('bulk-msg-btn');
    const textSpan = document.getElementById('bulk-msg-text');
    if (btn && textSpan) {
      btn.disabled = count === 0;
      if (count > 0) {
         textSpan.textContent = `Send to ${count} Rider${count > 1 ? 's' : ''}`;
         btn.style.opacity = '1';
         btn.style.cursor = 'pointer';
      } else {
         textSpan.textContent = `Bulk Messager`;
         btn.style.opacity = '0.5';
         btn.style.cursor = 'not-allowed';
      }
    }
  },

  startBulkWhatsapp() {
    const selectedBoxes = document.querySelectorAll('.rider-checkbox:checked');
    if (selectedBoxes.length === 0) {
      return Utils.showToast('Please select at least one rider.', 'error');
    }
    
    const selectedIds = Array.from(selectedBoxes).map(cb => parseInt(cb.value));
    
    // Build queue only from selected riders
    this._bulkQueue = this._currentPayrollData
      .filter(r => selectedIds.includes(r.rider_id))
      .sort((a,b) => a.rider_type.localeCompare(b.rider_type));
      
    this._totalBulkCount = this._bulkQueue.length;
    this._currentBulkIndex = 1;
    this._bulkFailures = 0;
    
    this.renderBulkWhatsappModal();
  },

  renderBulkWhatsappModal() {
    if (this._bulkQueue.length === 0) {
      const successes = this._totalBulkCount - (this._bulkFailures || 0);
      Utils.openModal('Bulk Sender Complete 🎉', `<div class="empty-state"><p>Sent to ${successes} riders, ${this._bulkFailures || 0} failed</p><button class="btn btn-primary" style="margin-top:20px" onclick="Utils.closeModal()">Close Window</button></div>`);
      // Reset checkboxes
      document.querySelectorAll('.rider-checkbox:checked, input[type="checkbox"]').forEach(cb => cb.checked = false);
      this.updateBulkButtonState();
      return;
    }

    const rr = this._bulkQueue[0]; // Current rider object
    const typeLabel = rr.rider_type === 'company' ? 'Company' : 'Freelancer';
    
    const nameStr = rr.rider_name.replace(/'/g, "\\'");
    const phoneStr = rr.phone || '';
    const grossStr = Utils.formatCurrency(rr.total_salary);
    const dedStr = Utils.formatCurrency(rr.deductions || 0);
    const netStr = Utils.formatCurrency(rr.calculated_salary);
    const ordersStr = rr.total_orders;
    
    const html = `
      <div style="text-align:center; padding: 20px 10px;">
        <div style="font-size:14px; font-weight:600; color:var(--slate-500); margin-bottom:24px;">
           Sending <span style="background:var(--slate-100); padding:4px 12px; border-radius:12px; color:var(--slate-800)">${this._currentBulkIndex} of ${this._totalBulkCount}</span>...
        </div>
        
        <div style="background:var(--slate-50); border:1px solid var(--slate-200); border-radius:12px; padding:24px; margin-bottom:30px;">
          <h2 style="font-size:24px; font-weight:bold; color:var(--text-primary); margin-bottom:8px;">${Utils.escapeHtml(rr.rider_name)}</h2>
          <p style="color:var(--text-tertiary); font-size:14px; margin-bottom:20px;">${typeLabel} Rider  |  ${rr.present_days} Days Attended</p>
          
          <div style="display:flex; justify-content:center; gap:20px; align-items:center;">
             <div style="text-align:right">
               <div style="font-size:12px; color:var(--slate-400)">Total Orders</div>
               <div style="font-size:16px; font-weight:600; color:var(--slate-700)">${ordersStr}</div>
             </div>
             <div style="height:30px; width:1px; background:var(--slate-200)"></div>
             <div style="text-align:left">
               <div style="font-size:12px; color:var(--slate-400)">Net Payout</div>
               <div style="font-size:16px; font-weight:bold; color:var(--success)">${netStr}</div>
             </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; align-items:center;">
          <button class="btn btn-success" style="width:100%; max-width:300px; padding:14px; font-size:16px; font-weight:bold" 
            onclick="Payroll.processBulkNext('${nameStr}', '${phoneStr}', '${grossStr}', '${dedStr}', '${netStr}', ${ordersStr}, '${rr.rider_type}', '${encodeURIComponent(JSON.stringify(rr.daily_logs || []))}')">
            ${phoneStr ? 'Send via WhatsApp & Next' : 'Open WhatsApp Web & Next'}
          </button>
          
          <button class="btn btn-outline" style="width:100%; max-width:300px" onclick="Payroll.skipBulkNext()">
            Skip this Rider
          </button>
        </div>
      </div>
    `;

    Utils.openModal('Bulk WhatsApp Messager', html);
  },

  processBulkNext(name, phone, gross, ded, net, orders, type, dailyLogsEncoded) {
    let dailyLogs = [];
    try {
      if (dailyLogsEncoded) {
        dailyLogs = JSON.parse(decodeURIComponent(dailyLogsEncoded));
      }
    } catch (e) {
      console.error('Failed to parse daily logs for bulk whatsapp', e);
    }
    
    // 1. Trigger the standard WhatsApp share (which opens a new tab)
    this.shareWhatsApp(name, phone, gross, ded, net, orders, type, this.currentPeriod.label, 'paid', dailyLogs);
    
    // 2. Immediately pop from queue and render the next modal window
    this._bulkQueue.shift();
    this._currentBulkIndex++;
    
    setTimeout(() => {
      this.renderBulkWhatsappModal();
    }, 200);
  },

  skipBulkNext() {
    this._bulkQueue.shift();
    this._currentBulkIndex++;
    this._bulkFailures = (this._bulkFailures || 0) + 1;
    this.renderBulkWhatsappModal();
  }
};
