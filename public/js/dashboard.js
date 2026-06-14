// ========================================
//  DASHBOARD - Main overview page
// ========================================

const Dashboard = {
  _initialized: false,
  bikeSearchQuery: '',
  bikeAuthCollapsed: false,
  bikeFilter: 'all',
  uniformSearchQuery: '',
  uniformTrackerCollapsed: false,
  uniformFilter: 'all',

  async render() {
    if (!this._initialized) {
      window.addEventListener('cycleChanged', () => {
        if (App.currentPage === 'dashboard') this.render();
      });
      // Silent auto-refresh every 5 minutes if on dashboard
      setInterval(() => {
        if (App.currentPage === 'dashboard') this.renderSilently();
      }, 5 * 60 * 1000);
      this._initialized = true;
    }
    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <div class="stats-grid" style="margin-bottom:24px;">
        <div class="skeleton skeleton-card" style="height:110px;"></div>
        <div class="skeleton skeleton-card" style="height:110px;"></div>
        <div class="skeleton skeleton-card" style="height:110px;"></div>
        <div class="skeleton skeleton-card" style="height:110px;"></div>
      </div>
      <div class="skeleton skeleton-card" style="height:300px;"></div>
    `;

    try {
      const activeDate = Utils.getActiveDate();
      const period = Utils.getNoonCyclePeriod(activeDate);
      const [stats, bikes, riders, expenses] = await Promise.all([
        API.getDashboardStats(period.start, period.end),
        API.getBikes(),
        API.getRiders(),
        API.getExpenses()
      ]);
      this.bikes = bikes;
      this.riders = riders;
      container.innerHTML = this.buildHTML(stats, period, bikes, riders, expenses);
      this.attachEvents();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load dashboard: ${err.message}</p></div>`;
    }
  },

  async renderSilently() {
    const container = document.getElementById('page-dashboard');
    if (!container) return;
    const searchInput = document.getElementById('bike-search');
    const isSearchFocused = (document.activeElement === searchInput);
    const searchVal = searchInput ? searchInput.value : '';
    try {
      const activeDate = Utils.getActiveDate();
      const period = Utils.getNoonCyclePeriod(activeDate);
      const [stats, bikes, riders, expenses] = await Promise.all([
        API.getDashboardStats(period.start, period.end),
        API.getBikes(),
        API.getRiders(),
        API.getExpenses()
      ]);
      if (searchInput) {
        this.bikeSearchQuery = searchVal;
      }
      this.bikes = bikes;
      this.riders = riders;
      container.innerHTML = this.buildHTML(stats, period, bikes, riders, expenses);
      this.attachEvents();
      if (isSearchFocused) {
        const newSearchInput = document.getElementById('bike-search');
        if (newSearchInput) {
          newSearchInput.focus();
          newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
        }
      }
    } catch (err) {
      console.error('Silent refresh failed:', err);
    }
  },

  buildHTML(stats, period, bikes = [], riders = [], expenses = []) {
    // Build unified action items for the Communications Hub
    const actionItems = [];

    // 1. Expiring Iqamas
    (stats.expiring_iqamas || []).forEach(r => {
      const days = Utils.daysUntil(r.iqama_expiry);
      const phone = r.phone ? r.phone.replace(/[^0-9]/g, '') : '';
      const msg = encodeURIComponent(`Urgent: Dear ${r.name}, your Iqama (ID document) expires in ${days} day(s) on ${Utils.formatDateShort(r.iqama_expiry)}. Please renew immediately and share updated copy with admin. — Inspiring Roads Logistics`);
      actionItems.push({
        type: 'danger',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        label: `<strong>${Utils.escapeHtml(r.name)}</strong> — Iqama expires in <strong>${days}</strong> day(s)`,
        tag: 'IQAMA',
        phone,
        msg
      });
    });

    // 2. Low Check-in Today
    (stats.low_checkins_today || []).forEach(l => {
      const rider = riders.find(r => String(r.id) === String(l.rider_id));
      const phone = rider && rider.phone ? rider.phone.replace(/[^0-9]/g, '') : '';
      const msg = encodeURIComponent(`Notice: Dear ${l.rider_name}, your check-in today was ${Utils.formatTime(l.checkin_hours, l.checkin_minutes)} which is below the required 11 hours minimum. Please ensure you meet the minimum shift requirement. — Inspiring Roads Logistics`);
      actionItems.push({
        type: 'warning',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        label: `<strong>${Utils.escapeHtml(l.rider_name)}</strong> — Low check-in: ${Utils.formatTime(l.checkin_hours, l.checkin_minutes)}`,
        tag: 'CHECK-IN',
        phone,
        msg
      });
    });

    // 3. Expired / Expiring Bike Insurance
    (bikes || []).forEach(b => {
      const days = Utils.daysUntil(b.insurance_expiry);
      if (days <= 30) {
        const assignedRider = riders.find(r => String(r.bike_id) === String(b.id));
        const phone = assignedRider && assignedRider.phone ? assignedRider.phone.replace(/[^0-9]/g, '') : '';
        const riderName = assignedRider ? assignedRider.name : 'Unassigned';
        const statusText = days < 0 ? 'EXPIRED' : `expires in ${days} day(s)`;
        const msg = encodeURIComponent(`Alert: Bike ${b.plate_number} insurance ${statusText}. ${assignedRider ? 'Rider: ' + riderName + '. ' : ''}Please coordinate renewal urgently. — Inspiring Roads Logistics`);
        actionItems.push({
          type: days < 0 ? 'danger' : 'warning',
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8a2 2 0 0 0-2 2v7.5"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
          label: `<strong>${Utils.escapeHtml(b.plate_number)}</strong> — Insurance ${statusText} <span style="color:var(--gray-400); font-size:12px;">(${riderName})</span>`,
          tag: 'FLEET',
          phone,
          msg
        });
      }
    });

    // 4. Expired / Pending Bike Authorizations
    (bikes || []).forEach(b => {
      const days = Utils.daysUntil(b.istimara_expiry);
      const assignedRider = riders.find(r => String(r.bike_id) === String(b.id));
      const phone = assignedRider && assignedRider.phone ? assignedRider.phone.replace(/[^0-9]/g, '') : '';
      const riderName = assignedRider ? assignedRider.name : 'Unassigned';
      
      if (!b.istimara_expiry) {
        actionItems.push({
          type: 'warning',
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
          label: `<strong>${Utils.escapeHtml(b.plate_number)}</strong> — No authorization date set <span style="color:var(--gray-400); font-size:12px;">(${riderName})</span>`,
          tag: 'BIKE AUTH',
          phone,
          msg: encodeURIComponent(`Alert: Bike ${b.plate_number} has no active authorization. ${assignedRider ? 'Rider: ' + riderName + '.' : ''} Please update authorization urgently. — Inspiring Roads Logistics`)
        });
      } else if (days <= 30) {
        const statusText = days < 0 ? 'EXPIRED' : `expires in ${days} day(s)`;
        actionItems.push({
          type: days < 0 ? 'danger' : 'warning',
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
          label: `<strong>${Utils.escapeHtml(b.plate_number)}</strong> — Authorization ${statusText} <span style="color:var(--gray-400); font-size:12px;">(${riderName})</span>`,
          tag: 'BIKE AUTH',
          phone,
          msg: encodeURIComponent(`Alert: Bike ${b.plate_number} authorization ${statusText}. ${assignedRider ? 'Rider: ' + riderName + '.' : ''} Please coordinate renewal urgently. — Inspiring Roads Logistics`)
        });
      }
    });

    // 5. Unassigned Company Bikes
    (bikes || []).forEach(b => {
      if (!b.assigned_rider_id) {
        actionItems.push({
          type: 'warning',
          icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>',
          label: `Company Bike <strong>${Utils.escapeHtml(b.plate_number)}</strong> is currently <strong>unassigned</strong>`,
          tag: 'UNASSIGNED BIKE',
          phone: '',
          msg: ''
        });
      }
    });

    return `
      <!-- Smart Greeting -->
      ${this.buildGreeting(stats, period)}
 
      <!-- Rider Bike Authorizations & Expiries -->
      ${this.buildBikeAuthorizations(bikes, riders)}
 
      <!-- Rider Uniform & Safety Kit Tracker -->
      ${this.buildUniformSafetyTracker(riders)}
 
      <!-- Stats Cards -->
      <div class="stats-grid" style="margin-bottom: 24px;">
        <div class="stats-card-premium primary" style="animation: slideUp 300ms ease both; animation-delay: 0ms">
          <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="stat-card-label" style="font-size:13px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Total Riders</span>
            <div class="stat-card-icon" style="color: var(--primary-500); width:20px; height:20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="font-size:28px; font-weight:800; color:var(--text-primary); line-height:1.2;">${stats.total_active}</div>
          <div class="stat-card-sub" style="font-size:12px; color:var(--text-tertiary); margin-top:8px; font-weight:500;">${stats.total_company} Company · ${stats.total_freelancer} Freelancer</div>
        </div>
 
        <div class="stats-card-premium success" style="animation: slideUp 300ms ease both; animation-delay: 80ms">
          <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="stat-card-label" style="font-size:13px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Logged Today</span>
            <div class="stat-card-icon" style="color: var(--success-500); width:20px; height:20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="font-size:28px; font-weight:800; color: ${stats.logged_today === 0 ? 'var(--danger-500)' : 'var(--text-primary)'}; line-height:1.2;">${stats.logged_today}</div>
          <div class="stat-card-sub" style="font-size:12px; color: ${stats.logged_today === 0 ? 'var(--danger-500)' : 'var(--text-tertiary)'}; margin-top:8px; font-weight:500;">out of ${stats.total_active} active DAs</div>
        </div>
 
        <div class="stats-card-premium warning" style="animation: slideUp 300ms ease both; animation-delay: 160ms">
          <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="stat-card-label" style="font-size:13px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Pending Today</span>
            <div class="stat-card-icon" style="color: var(--warning-500); width:20px; height:20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="font-size:28px; font-weight:800; color:var(--text-primary); line-height:1.2;">${stats.pending_today}</div>
          <div class="stat-card-sub" style="font-size:12px; color:var(--text-tertiary); margin-top:8px; font-weight:500;">daily logs outstanding</div>
        </div>
 
        <div class="stats-card-premium danger" style="animation: slideUp 300ms ease both; animation-delay: 240ms">
          <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="stat-card-label" style="font-size:13px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Low Check-in</span>
            <div class="stat-card-icon" style="color: var(--danger-500); width:20px; height:20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="font-size:28px; font-weight:800; color:var(--text-primary); line-height:1.2;">${stats.low_checkins_today.length}</div>
          <div class="stat-card-sub" style="font-size:12px; color:var(--text-tertiary); margin-top:8px; font-weight:500;">riders below 11 hrs today</div>
        </div>
 
        <div class="stats-card-premium purple" style="animation: slideUp 300ms ease both; animation-delay: 300ms">
          <div class="stat-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="stat-card-label" style="font-size:13px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Period Orders</span>
            <div class="stat-card-icon" style="color: var(--accent-500); width:20px; height:20px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="font-size:28px; font-weight:800; color:var(--text-primary); line-height:1.2;">${stats.period_total_orders}</div>
          <div class="stat-card-sub" style="font-size:12px; color:var(--text-secondary); margin-top:8px; font-weight:500;">
            Primary: <strong>${stats.period_primary_orders}</strong> · Assoc: <strong>${stats.period_associate_orders}</strong>
          </div>
        </div>
      </div>
 
      <!-- Quick Actions -->
      <div style="margin-bottom: 28px; animation: slideUp 300ms ease both; animation-delay: 320ms">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 16px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.01em;">
            Quick Actions
          </h2>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
          <button id="qa-log-today" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--primary-600); background: var(--primary-50);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Log Today's Data</span>
          </button>
          
          <button id="qa-add-rider" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--success-600); background: var(--success-50);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Add New Rider</span>
          </button>
 
          <button id="qa-view-payroll" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--accent-600); background: rgba(124, 58, 237, 0.08);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">View Payroll</span>
          </button>
 
          <button id="qa-monthly-report" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: #db2777; background: #fdf2f8;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Monthly PDF</span>
          </button>
 
          <button id="qa-view-riders" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--orange-500); background: var(--orange-50);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">All Riders</span>
          </button>
 
          <button id="qa-backup" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--gray-600); background: var(--gray-100);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Backup Data</span>
          </button>
 
          <button id="qa-force-offline" class="quick-action-btn-premium">
            <div class="icon-wrapper" style="color: var(--danger-600); background: var(--danger-50);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Force Offline</span>
          </button>
        </div>
      </div>

      <!-- Alerts Grid -->
      <div class="dashboard-grid">
        <!-- Iqama Alerts -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 400ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Iqama Expiry Alerts
            </h2>
          </div>
          <div class="alert-list">
            ${stats.expiring_iqamas.length === 0
              ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>No expiring iqamas</p></div>`
              : stats.expiring_iqamas.map(r => {
                  const days = Utils.daysUntil(r.iqama_expiry);
                  const cls = days <= 7 ? 'danger' : days <= 30 ? 'warning' : 'info';
                  return `<div class="alert-item ${cls}">
                    <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <span><strong>${Utils.escapeHtml(r.name)}</strong> — expires in ${days} day${days !== 1 ? 's' : ''} (${Utils.formatDateShort(r.iqama_expiry)})</span>
                  </div>`;
                }).join('')
            }
          </div>
        </div>

        <!-- Low Check-in Alerts -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 480ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Today's Low Check-in
            </h2>
          </div>
          <div class="alert-list">
            ${stats.low_checkins_today.length === 0
              ? `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>All check-in times are good</p></div>`
              : stats.low_checkins_today.map(l => {
                  return `<div class="alert-item danger">
                    <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span><strong>${Utils.escapeHtml(l.rider_name)}</strong> — ${Utils.formatTime(l.checkin_hours, l.checkin_minutes)} (below 11 hrs)</span>
                  </div>`;
                }).join('')
            }
          </div>
        </div>
      </div>

      <!-- Main Columns -->
      <div class="dashboard-grid">
        <!-- Top Riders Leaderboard -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 500ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Top Riders (Period)
            </h2>
          </div>
          <div class="table-container pt-8">
            ${stats.top_riders.length === 0
              ? `<div class="empty-state"><p>No orders logged this period yet</p></div>`
              : `<table class="data-table" style="width:100%; border-collapse:collapse;">
                  <tbody>
                    ${stats.top_riders.map((r, idx) => {
                       const medal = idx === 0 ? '👑' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : ''));
                       return `
                      <tr style="border-bottom: 1px solid var(--slate-100);">
                        <td style="font-size:20px; text-align:center; width:50px; padding:12px 6px;">${medal || `<span style="font-size:14px; color:var(--slate-400); font-weight:bold;">#${idx+1}</span>`}</td>
                        <td style="padding:12px 6px;">
                          <div style="font-weight:700; color:var(--slate-800); font-size:14px; margin-bottom:6px;">${Utils.escapeHtml(r.name)}</div>
                          <div>${Utils.getTierBadgeHtml(r.total)}</div>
                        </td>
                        <td style="text-align: right; padding:12px 6px;">
                           <div style="font-size:18px; font-weight:800; color:var(--primary-600);">${r.total}</div>
                           <div style="font-size:11px; color:var(--slate-400); font-weight:500; text-transform:uppercase;">Orders</div>
                        </td>
                      </tr>
                    `}).join('')}
                  </tbody>
                 </table>`
            }
          </div>
        </div>

        <!-- Activity Timeline -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 560ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Activity Feed
            </h2>
            <span class="badge badge-company" style="font-size:11px;">Live</span>
          </div>
          <div id="activity-timeline-list" style="max-height:320px; overflow-y:auto; padding-right:4px;">
            <div class="skeleton skeleton-row" style="height:50px;"></div>
            <div class="skeleton skeleton-row" style="height:50px;"></div>
            <div class="skeleton skeleton-row" style="height:50px;"></div>
          </div>
        </div>
      </div>

      <!-- Analytics Charts Row -->
      <div class="dashboard-grid mt-24" style="grid-template-columns: 1fr 1fr;">
        <!-- Expense Breakdown Chart -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 620ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
              Expense Breakdown
            </h2>
          </div>
          <div style="position: relative; height: 260px; display:flex; align-items:center; justify-content:center;">
            <canvas id="chart-expense-breakdown"></canvas>
          </div>
        </div>

        <!-- Cash Flow Chart -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 680ms">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Cash Flow (Monthly)
            </h2>
          </div>
          <div style="position: relative; height: 260px;">
            <canvas id="chart-cashflow"></canvas>
          </div>
        </div>
      </div>

      <!-- Orders Trend (Full Width) -->
      <div class="card section-card mt-24" style="animation: slideUp 300ms ease both; animation-delay: 740ms">
        <div class="section-header">
          <h2 class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            Daily Orders Trend (Current Period)
          </h2>
        </div>
        <div style="position: relative; height: 220px;">
          <canvas id="chart-daily-orders"></canvas>
        </div>
      </div>

      <!-- 1-Click Communications Hub -->
      <div class="glass-card mt-24 animate-slide-up" style="animation-delay: 800ms; padding: 24px; border-radius: 16px; background: linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,244,248,0.5) 100%);">
        <div class="section-header" style="margin-bottom: 20px;">
          <h2 class="section-title" style="display:flex; align-items:center; gap:10px; margin:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:var(--primary-500);"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span style="font-size:16px; font-weight:700;">Communications Hub</span>
            <span style="background:linear-gradient(135deg,#25D366,#128C7E); color:white; font-size:10px; padding:3px 10px; border-radius:20px; font-weight:700; letter-spacing:0.5px;">WhatsApp Enabled</span>
          </h2>
          <span class="badge ${actionItems.length > 0 ? 'badge-danger' : 'badge-active'}" style="font-size:13px; padding:5px 14px;">${actionItems.length > 0 ? actionItems.length + ' Action(s) Required' : '✓ All Clear'}</span>
        </div>
        <div id="action-center-list" style="display:flex; flex-direction:column; gap:10px; max-height: 400px; overflow-y:auto; padding-right:4px;">
          ${actionItems.length === 0
            ? '<div class="empty-state" style="padding:40px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p style="margin-top:12px; font-size:15px; font-weight:600;">No pending actions — all systems healthy</p></div>'
            : actionItems.map((item, i) => `
              <div class="action-hub-item ${item.type}" style="display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px; border-radius:12px; background:#ffffff; border:1px solid var(--border-light); box-shadow: var(--shadow-sm); transition: all 0.2s ease; animation: slideIn 200ms ease both; animation-delay:${i * 40}ms;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='var(--shadow-md)';" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)';">
                <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:0;">
                  <div style="width:36px; height:36px; flex-shrink:0; border-radius:10px; background:${item.type === 'danger' ? 'var(--danger-50)' : 'var(--warning-50)'}; display:flex; align-items:center; justify-content:center; color:${item.type === 'danger' ? 'var(--danger-600)' : 'var(--warning-600)'}; border:1px solid ${item.type === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)'};">
                    <div style="width:18px; height:18px;">${item.icon}</div>
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.4;">${item.label}</div>
                    <span style="display:inline-block; margin-top:4px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:2px 8px; border-radius:4px; background:${item.type === 'danger' ? 'var(--danger-50)' : 'var(--warning-50)'}; color:${item.type === 'danger' ? 'var(--danger-600)' : 'var(--warning-600)'}; border:1px solid ${item.type === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)'};">${item.tag}</span>
                  </div>
                </div>
                ${item.phone
                  ? `<a href="https://wa.me/${item.phone}?text=${item.msg}" target="_blank" class="wa-action-btn" title="Send WhatsApp Message" style="flex-shrink:0; width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#25D366,#128C7E); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(37,211,102,0.25); transition:all var(--transition-fast); cursor:pointer;">
                      <svg viewBox="0 0 24 24" fill="white" style="width:16px; height:16px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>`
                  : `<div style="flex-shrink:0; width:36px; height:36px; border-radius:50%; background:var(--gray-100); display:flex; align-items:center; justify-content:center; color:var(--gray-400); font-size:10px; font-weight:600;" title="No phone number on file">N/A</div>`
                }
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Unsettled Rider Deductions -->
      <div class="card section-card mt-24 animate-slide-up" style="animation-delay: 860ms; border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); padding: 24px;">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 20px;">
          <div>
            <h2 class="section-title" style="color:var(--text-primary); font-weight:700; margin:0; font-size:16px;">Unsettled Rider Deductions</h2>
            <div style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Amounts pending deduction from rider salaries</div>
          </div>
          ${(function() {
            const unsettled = expenses.filter(e => !e.deductionSettled && e.rider_id && (e.is_deductible === 1 || e.is_deductible === true))
            const total = unsettled.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            return `<div style="font-size:16px; font-weight:800; color:var(--danger-600);">Total: SAR ${total.toLocaleString()}</div>`;
          })()}
        </div>
        <div class="table-container pt-8" style="overflow-x:auto; border: 1px solid var(--border-light); border-radius: 12px;">
          ${(function() {
            const unsettled = expenses.filter(e => !e.deductionSettled && e.rider_id && (e.is_deductible === 1 || e.is_deductible === true))
              .sort((a, b) => new Date(a.expense_date || a.created_at) - new Date(b.expense_date || b.created_at)); // oldest first

            if (unsettled.length === 0) {
              return `<div class="empty-state" style="padding:40px;"><p>No unsettled rider deductions</p></div>`;
            }

            const grouped = {};
            let totalUnsettled = 0;
            let ridersCount = 0;
            let oldestDays = 0;

            unsettled.forEach(e => {
              if (!grouped[e.rider_id]) {
                const r = riders.find(rid => String(rid.id) === String(e.rider_id));
                grouped[e.rider_id] = { name: r ? r.name : 'Unknown Rider', items: [], total: 0 };
                ridersCount++;
              }
              grouped[e.rider_id].items.push(e);
              grouped[e.rider_id].total += parseFloat(e.amount || 0);
              totalUnsettled += parseFloat(e.amount || 0);
              
              const d = new Date(e.expense_date || e.created_at);
              const days = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
              if (days > oldestDays) oldestDays = days;
            });

            let html = `<table class="data-table" style="width:100%; border-collapse:collapse; text-align:left; min-width:600px;">
              <thead>
                <tr style="border-bottom:2px solid var(--gray-200); color:var(--gray-500); font-size:12px; text-transform:uppercase;">
                  <th style="padding:12px 16px;">Rider Name</th>
                  <th style="padding:12px 16px;">Category</th>
                  <th style="padding:12px 16px;">Date</th>
                  <th style="padding:12px 16px;">Amount</th>
                  <th style="padding:12px 16px; text-align:right;">Days Outstanding</th>
                </tr>
              </thead>
              <tbody>`;

            Object.keys(grouped).forEach(rId => {
              const group = grouped[rId];
              group.items.forEach((item, idx) => {
                const d = new Date(item.expense_date || item.created_at);
                const daysOut = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
                
                let daysStyle = 'color:#6B7280; font-weight:500;'; // 0-14 days grey
                if (daysOut >= 31) daysStyle = 'color:#DC2626; font-weight:700;'; // 31+ red bold
                else if (daysOut >= 15) daysStyle = 'color:#D97706; font-weight:600;'; // 15-30 amber
                
                // On click, go to expenses page -> rider deductions tab
                const navStr = `App.navigate('expenses'); setTimeout(() => { if (typeof Expenses !== 'undefined') { Expenses.currentTab = 'deductions'; Expenses.currentDeductionTab = 'pending'; Expenses.render(); } }, 200);`;

                html += `<tr style="border-bottom:1px solid var(--gray-100); cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#F3F4F6'" onmouseout="this.style.background='transparent'" onclick="${navStr}">
                  <td style="padding:12px 16px; font-weight:600; color:#111827;">${idx === 0 ? Utils.escapeHtml(group.name) : ''}</td>
                  <td style="padding:12px 16px; color:#4B5563;">${Utils.escapeHtml(item.category || '')}</td>
                  <td style="padding:12px 16px; color:#6B7280;">${Utils.formatDateShort(item.expense_date || item.created_at)}</td>
                  <td style="padding:12px 16px; font-weight:600; color:#0F0F0F;">SR ${parseFloat(item.amount || 0).toLocaleString()}</td>
                  <td style="padding:12px 16px; text-align:right;"><span style="${daysStyle}">${daysOut} days</span></td>
                </tr>`;
              });

              // Subtotal row
              html += `<tr style="background-color: rgba(37, 99, 235, 0.05); border-bottom: 2px solid rgba(37, 99, 235, 0.1);">
                <td colspan="3" style="padding:12px 16px; font-weight:700; text-align:right; color:var(--primary-700); font-size:13px;">Subtotal for ${Utils.escapeHtml(group.name)}:</td>
                <td colspan="2" style="padding:12px 16px; font-weight:700; color:var(--primary-700); font-size:14px;">SR ${group.total.toLocaleString()}</td>
              </tr>`;
            });

            html += `</tbody></table>
              </div>
              <div style="display:flex; gap:16px; margin-top:20px; padding-top:16px; border-top:1px solid var(--gray-200); flex-wrap:wrap;">
                <div style="background:var(--danger-50); border:1px solid var(--danger-100); padding:14px 16px; border-radius:12px; flex:1; min-width:180px; box-shadow: var(--shadow-sm);">
                  <div style="font-size:11px; color:var(--danger-600); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Total Unsettled</div>
                  <div style="font-size:20px; font-weight:800; color:var(--danger-600);">SAR ${totalUnsettled.toLocaleString()}</div>
                </div>
                <div style="background:var(--warning-50); border:1px solid var(--warning-100); padding:14px 16px; border-radius:12px; flex:1; min-width:180px; box-shadow: var(--shadow-sm);">
                  <div style="font-size:11px; color:var(--warning-600); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Riders w/ Pending Deductions</div>
                  <div style="font-size:20px; font-weight:800; color:var(--warning-600);">${ridersCount}</div>
                </div>
                <div style="background:${oldestDays >= 31 ? 'var(--danger-50)' : 'var(--gray-50)'}; border:1px solid ${oldestDays >= 31 ? 'var(--danger-100)' : 'var(--gray-200)'}; padding:14px 16px; border-radius:12px; flex:1; min-width:180px; box-shadow: var(--shadow-sm);">
                  <div style="font-size:11px; color:${oldestDays >= 31 ? 'var(--danger-600)' : 'var(--gray-600)'}; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Oldest Unresolved</div>
                  <div style="font-size:20px; font-weight:800; color:${oldestDays >= 31 ? 'var(--danger-600)' : 'var(--gray-800)'};">${oldestDays} days ago</div>
                </div>
              </div>`;
            return html;
          })()}
        </div>
      </div>
    `;
  },

  attachEvents() {
    document.getElementById('qa-log-today')?.addEventListener('click', () => App.navigate('daily-logs'));
    document.getElementById('qa-add-rider')?.addEventListener('click', () => {
      App.navigate('riders');
      setTimeout(() => Riders.openAddRider(), 200);
    });
    document.getElementById('qa-view-payroll')?.addEventListener('click', () => App.navigate('payroll'));
    document.getElementById('qa-view-riders')?.addEventListener('click', () => App.navigate('riders'));
    document.getElementById('qa-monthly-report')?.addEventListener('click', () => {
      if (typeof Reports !== 'undefined') {
        Reports.openMonthlyReportModal();
      } else {
        Utils.showToast('Reports module not loaded', 'error');
      }
    });
    document.getElementById('qa-backup')?.addEventListener('click', () => {
      API.downloadBackup();
      Utils.showToast('Backup download started', 'success');
    });
    document.getElementById('qa-force-offline')?.addEventListener('click', async () => {
      const riderIdStr = prompt('Enter Rider ID to force offline:');
      if (riderIdStr) {
        const id = parseInt(riderIdStr, 10);
        if (isNaN(id)) return Utils.showToast('Invalid Rider ID', 'error');
        try {
          await API.request(`/admin/force-offline/${id}`, { method: 'POST' });
          Utils.showToast('Rider forced offline successfully', 'success');
        } catch (err) {
          Utils.showToast(err.message, 'error');
        }
      }
    });

    document.getElementById('bike-auth-toggle')?.addEventListener('click', () => this.toggleBikeAuthPanel());
    document.getElementById('bike-search')?.addEventListener('input', (e) => this.handleBikeSearch(e));

    document.querySelectorAll('[data-bike-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.bikeFilter = chip.dataset.bikeFilter;
        this.applyBikeFilters();
      });
    });
    this.applyBikeFilters();

    // Uniform & Safety Kit tracker events
    document.getElementById('uniform-tracker-toggle')?.addEventListener('click', () => this.toggleUniformPanel());
    document.getElementById('uniform-search')?.addEventListener('input', (e) => {
      this.handleUniformSearch(e);
      // Reset checkboxes on search
      const selectAllCheckbox = document.getElementById('uniform-select-all');
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      document.querySelectorAll('.uniform-select-row').forEach(chk => {
        chk.checked = false;
        const row = chk.closest('tr');
        if (row) {
          row.classList.remove('selected-row');
          row.style.backgroundColor = '';
        }
      });
      const bulkToolbar = document.getElementById('uniform-bulk-actions');
      if (bulkToolbar) bulkToolbar.style.display = 'none';
    });

    document.querySelectorAll('[data-uniform-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.uniformFilter = chip.dataset.uniformFilter;
        this.applyUniformFilters();
        // Reset checkboxes on filter change
        const selectAllCheckbox = document.getElementById('uniform-select-all');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        document.querySelectorAll('.uniform-select-row').forEach(chk => {
          chk.checked = false;
          const row = chk.closest('tr');
          if (row) {
            row.classList.remove('selected-row');
            row.style.backgroundColor = '';
          }
        });
        const bulkToolbar = document.getElementById('uniform-bulk-actions');
        if (bulkToolbar) bulkToolbar.style.display = 'none';
      });
    });
    this.applyUniformFilters();

    // Selection and bulk actions
    const selectAllCheckbox = document.getElementById('uniform-select-all');
    const bulkToolbar = document.getElementById('uniform-bulk-actions');
    const selectedCountSpan = document.getElementById('uniform-selected-count');
    
    const updateBulkToolbar = () => {
      const checkedRows = document.querySelectorAll('.uniform-select-row:checked');
      if (checkedRows.length > 0) {
        if (bulkToolbar) bulkToolbar.style.display = 'flex';
        if (selectedCountSpan) selectedCountSpan.textContent = checkedRows.length;
      } else {
        if (bulkToolbar) bulkToolbar.style.display = 'none';
      }
    };

    selectAllCheckbox?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      const rows = document.querySelectorAll('#uniform-table-body tr');
      rows.forEach(row => {
        if (row.style.display !== 'none') {
          const chk = row.querySelector('.uniform-select-row');
          if (chk) {
            chk.checked = isChecked;
            row.classList.toggle('selected-row', isChecked);
            row.style.backgroundColor = isChecked ? '#EFF6FF' : '';
          }
        }
      });
      updateBulkToolbar();
    });

    document.getElementById('uniform-table-body')?.addEventListener('change', (e) => {
      if (e.target.classList.contains('uniform-select-row')) {
        const row = e.target.closest('tr');
        if (row) {
          row.classList.toggle('selected-row', e.target.checked);
          row.style.backgroundColor = e.target.checked ? '#EFF6FF' : '';
        }
        updateBulkToolbar();
        
        if (!e.target.checked && selectAllCheckbox) {
          selectAllCheckbox.checked = false;
        }
      }
    });

    document.getElementById('btn-bulk-copy-noon')?.addEventListener('click', () => {
      const checkedRows = document.querySelectorAll('.uniform-select-row:checked');
      const dataRows = [];
      
      checkedRows.forEach(chk => {
        const rId = parseInt(chk.dataset.riderId);
        const rider = this.riders?.find(r => r.id === rId);
        if (rider) {
          const noonId = rider.noon_id || rider.company_id || rider.rider_company_id || '';
          const store = rider.store_warehouse || '';
          dataRows.push(`${noonId}\t${rider.name}\t${rider.phone || ''}\t${rider.iqama_number || ''}\t${store}`);
        }
      });
      
      if (dataRows.length === 0) return;
      
      const tsvContent = `Noon ID\tName\tPhone Number\tIqama Number\tStore/Station\n` + dataRows.join('\n');
      navigator.clipboard.writeText(tsvContent).then(() => {
        Utils.showToast(`Copied Noon submission data for ${dataRows.length} riders!`, 'success');
      }).catch(err => {
        Utils.showToast('Failed to copy data', 'error');
      });
    });

    document.getElementById('btn-bulk-mark-uniform')?.addEventListener('click', async () => {
      const checkedRows = document.querySelectorAll('.uniform-select-row:checked');
      if (checkedRows.length === 0) return;
      
      const confirmed = await Utils.confirm(
        'Confirm Batch Uniform Update',
        `Are you sure you want to mark the ${checkedRows.length} selected riders as having received their uniform today? This will update their uniform expiry cycle for the next 6 months.`
      );
      
      if (!confirmed) return;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const btnMark = document.getElementById('btn-bulk-mark-uniform');
      const btnCopy = document.getElementById('btn-bulk-copy-noon');
      if (btnMark) btnMark.disabled = true;
      if (btnCopy) btnCopy.disabled = true;
      
      let successCount = 0;
      let failCount = 0;
      
      for (const chk of checkedRows) {
        const rId = parseInt(chk.dataset.riderId);
        const rider = this.riders?.find(r => r.id === rId);
        if (rider) {
          try {
            const history = [...(rider.asset_history || [])];
            history.push({
              type: 'uniform',
              date: todayStr,
              notes: 'Batch update via Dashboard',
              recorded_at: new Date().toISOString()
            });
            
            await API.updateRider(rId, {
              uniform_date: todayStr,
              asset_history: history
            });
            successCount++;
          } catch(err) {
            console.error(`Failed to update rider ${rId}:`, err);
            failCount++;
          }
        }
      }
      
      if (btnMark) btnMark.disabled = false;
      if (btnCopy) btnCopy.disabled = false;
      
      if (successCount > 0) {
        Utils.showToast(`Successfully updated uniform dates for ${successCount} riders!`, 'success');
        this.render();
      }
      if (failCount > 0) {
        Utils.showToast(`Failed to update ${failCount} riders.`, 'error');
      }
    });

    // Load charts asynchronously
    this.loadCharts();
    this.loadActivityTimeline();
  },

  buildGreeting(stats, period) {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    let icon = '<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    
    if (hour >= 12 && hour < 17) { 
      greeting = 'Good afternoon'; 
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="#F97316" stroke-width="2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/><circle cx="12" cy="12" r="4"/></svg>'; 
    }
    else if (hour >= 17 && hour < 21) { 
      greeting = 'Good evening'; 
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>'; 
    }
    else if (hour >= 21 || hour < 5) { 
      greeting = 'Good night'; 
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'; 
    }

    const orderText = stats.period_total_orders > 0
      ? `Your riders completed <strong>${stats.period_total_orders}</strong> orders this cycle.`
      : 'No orders logged this cycle yet.';

    const alertCount = (stats.expiring_iqamas?.length || 0) + (stats.low_checkins_today?.length || 0);
    const alertText = alertCount > 0
      ? `<span style="color:#DC2626; font-weight:600;">${alertCount} alert(s)</span> need your attention.`
      : '<span style="color:#16A34A; font-weight:600;">All systems healthy</span> — no alerts.';

    return `
      <div class="glass-card" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:28px; padding: 20px 24px; border-radius: 16px; animation: fadeIn 500ms ease both;">
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="width:40px; height:40px; border-radius: 12px; background: rgba(255,255,255,0.8); display:flex; align-items:center; justify-content:center; box-shadow: var(--shadow-sm);">
            ${icon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-bottom:4px; letter-spacing: -0.015em;">
              ${greeting}, Abdullah
            </div>
            <div style="font-size:14px; color:var(--text-secondary); line-height:1.5; font-weight: 500;">
              ${orderText} ${alertText}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async loadActivityTimeline() {
    const container = document.getElementById('activity-timeline-list');
    if (!container) return;

    try {
      const today = Utils.today();
      const [logs, expenses, funds] = await Promise.all([
        API.getDailyLogs(today),
        API.getExpenses(),
        API.getFunds()
      ]);

      const events = [];

      // Recent logs today
      logs.forEach(l => {
        events.push({
          time: l.created_at || today + 'T12:00:00',
          icon: '📋',
          color: 'var(--primary-100)',
          text: `<strong>${Utils.escapeHtml(l.rider_name)}</strong> daily log recorded`,
          sub: `${l.primary_orders || 0} primary, ${l.associate_orders || 0} associate orders`
        });
      });

      // Recent expenses (last 5)
      const recentExp = expenses.sort((a, b) => new Date(b.created_at || b.expense_date) - new Date(a.created_at || a.expense_date)).slice(0, 5);
      recentExp.forEach(e => {
        events.push({
          time: e.created_at || e.expense_date + 'T12:00:00',
          icon: '💸',
          color: 'var(--danger-100)',
          text: `Expense <strong>SR ${(e.amount || 0).toLocaleString()}</strong> — ${Utils.escapeHtml(e.category)}`,
          sub: e.rider_name || e.vendor_name || 'General'
        });
      });

      // Recent funds (last 3)
      const recentFunds = funds.sort((a, b) => new Date(b.created_at || b.receive_date) - new Date(a.created_at || a.receive_date)).slice(0, 3);
      recentFunds.forEach(f => {
        events.push({
          time: f.created_at || f.receive_date + 'T12:00:00',
          icon: '💰',
          color: 'var(--success-100)',
          text: `Fund received <strong>SR ${(f.amount || 0).toLocaleString()}</strong>`,
          sub: Utils.escapeHtml(f.description || 'Transfer')
        });
      });

      // Sort by time descending
      events.sort((a, b) => new Date(b.time) - new Date(a.time));
      const display = events.slice(0, 8);

      if (display.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:30px;"><p>No recent activity</p></div>';
        return;
      }

      container.innerHTML = display.map((ev, i) => {
        const timeStr = new Date(ev.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(ev.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `
          <div style="display:flex; gap:14px; padding:10px 0; border-bottom:1px solid var(--border-light); animation:slideIn 200ms ease both; animation-delay:${i * 50}ms;">
            <div style="width:36px; height:36px; flex-shrink:0; border-radius:10px; background:${ev.color}; display:flex; align-items:center; justify-content:center; font-size:16px;">${ev.icon}</div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; color:var(--text-primary); line-height:1.4;">${ev.text}</div>
              <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">${ev.sub}</div>
            </div>
            <div style="flex-shrink:0; text-align:right;">
              <div style="font-size:11px; font-weight:600; color:var(--text-secondary);">${timeStr}</div>
              <div style="font-size:10px; color:var(--text-tertiary);">${dateStr}</div>
            </div>
          </div>
        `;
      }).join('');

    } catch (e) {
      container.innerHTML = '<div style="padding:16px; font-size:13px; color:var(--text-tertiary); text-align:center;">Could not load activity.</div>';
    }
  },

  async loadCharts() {
    if (typeof Chart === 'undefined') return;

    const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
    const chartColors = {
      blue: 'rgba(59, 130, 246, 0.8)',
      green: 'rgba(16, 185, 129, 0.8)',
      purple: 'rgba(139, 92, 246, 0.8)',
      amber: 'rgba(245, 158, 11, 0.8)',
      rose: 'rgba(244, 63, 94, 0.8)',
      orange: 'rgba(249, 115, 22, 0.8)',
      teal: 'rgba(20, 184, 166, 0.8)',
      indigo: 'rgba(99, 102, 241, 0.8)'
    };

    const defaultOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true }
        }
      }
    };

    try {
      // 1. Expense Breakdown Doughnut
      const breakdown = await API.getExpenseBreakdown();
      const expCtx = document.getElementById('chart-expense-breakdown');
      if (expCtx && Object.keys(breakdown).length > 0) {
        const labels = Object.keys(breakdown);
        const values = Object.values(breakdown);
        const colors = [chartColors.blue, chartColors.rose, chartColors.amber, chartColors.purple, chartColors.green, chartColors.orange, chartColors.teal, chartColors.indigo];

        new Chart(expCtx, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: values,
              backgroundColor: colors.slice(0, labels.length),
              borderWidth: 2,
              borderColor: '#fff',
              hoverOffset: 6
            }]
          },
          options: {
            ...defaultOpts,
            cutout: '60%',
            plugins: {
              ...defaultOpts.plugins,
              legend: { ...defaultOpts.plugins.legend, position: 'right' }
            }
          }
        });
      } else if (expCtx) {
        expCtx.parentElement.innerHTML = '<div class="empty-state" style="padding:40px"><p>No expense data yet</p></div>';
      }
    } catch (e) { console.error('Expense chart error:', e); }

    try {
      // 2. Cash Flow Bar Chart
      const cashflow = await API.getCashflow();
      const cfCtx = document.getElementById('chart-cashflow');
      if (cfCtx && cashflow.length > 0) {
        new Chart(cfCtx, {
          type: 'bar',
          data: {
            labels: cashflow.map(c => c.month),
            datasets: [
              {
                label: 'Received',
                data: cashflow.map(c => c.received),
                backgroundColor: chartColors.green,
                borderRadius: 6,
                barPercentage: 0.6
              },
              {
                label: 'Spent',
                data: cashflow.map(c => c.spent),
                backgroundColor: chartColors.rose,
                borderRadius: 6,
                barPercentage: 0.6
              }
            ]
          },
          options: {
            ...defaultOpts,
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: { font: { family: 'Inter', size: 11 } }
              },
              x: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 11 } }
              }
            }
          }
        });
      } else if (cfCtx) {
        cfCtx.parentElement.innerHTML = '<div class="empty-state" style="padding:40px"><p>No financial data yet</p></div>';
      }
    } catch (e) { console.error('Cashflow chart error:', e); }

    try {
      // 3. Daily Orders Line Chart
      const dailyOrders = await API.getDailyOrdersChart(period.start, period.end);
      const doCtx = document.getElementById('chart-daily-orders');
      if (doCtx && dailyOrders.length > 0) {
        new Chart(doCtx, {
          type: 'line',
          data: {
            labels: dailyOrders.map(d => {
              const dt = new Date(d.date + 'T00:00:00');
              return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
              label: 'Total Orders',
              data: dailyOrders.map(d => d.orders),
              borderColor: chartColors.blue,
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 3,
              pointBackgroundColor: chartColors.blue,
              borderWidth: 2.5
            }]
          },
          options: {
            ...defaultOpts,
            scales: {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.04)' },
                ticks: { font: { family: 'Inter', size: 11 } }
              },
              x: {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 }
              }
            }
          }
        });
      } else if (doCtx) {
        doCtx.parentElement.innerHTML = '<div class="empty-state" style="padding:40px"><p>No order data this period</p></div>';
      }
    } catch (e) { console.error('Daily orders chart error:', e); }
  },

  buildBikeAuthorizations(bikes, riders) {
    let totalBikes = bikes.length;
    let authorizedCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let unassignedCount = 0;
    let pendingCount = 0;

    bikes.forEach(b => {
      if (!b.assigned_rider_id) {
        unassignedCount++;
      } else if (!b.istimara_expiry) {
        pendingCount++;
      } else {
        const days = Utils.daysUntil(b.istimara_expiry);
        if (days < 0) {
          expiredCount++;
        } else if (days <= 30) {
          expiringSoonCount++;
        } else {
          authorizedCount++;
        }
      }
    });

    const rowsHtml = this.buildBikeTableRows(bikes, riders, this.bikeSearchQuery);

    const summaryBadgeText = expiredCount > 0 
      ? `⚠️ ${expiredCount} Expired` 
      : (expiringSoonCount > 0 ? `⚠️ ${expiringSoonCount} Expiring Soon` : '✓ All Clear');
      
    const badgeColor = expiredCount > 0 
      ? 'background:#FDE8E8; color:#9B1C1C; border:1px solid #F87171;' 
      : (expiringSoonCount > 0 ? 'background:#FEF3C7; color:#92400E; border:1px solid #FCD34D;' : 'background:#DEF7EC; color:#03543F; border:1px solid #34D399;');

    let alertHtml = '';
    const totalNeedingAttention = expiredCount + expiringSoonCount + unassignedCount;
    if (totalNeedingAttention > 0) {
      alertHtml = `
        <div style="margin-bottom: 16px; padding: 12px 16px; border-radius: 12px; background: #FFF5F5; border: 1px solid #FEB2B2; display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #C53030; line-height: 1.5; animation: slideUp 200ms ease both;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; flex-shrink:0; color:#E53E3E; margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong>Fleet Attention Required:</strong> 
            There ${unassignedCount === 1 ? 'is' : 'are'} <strong style="text-decoration:underline; cursor:pointer;" onclick="Dashboard.setBikeFilter('unassigned')">${unassignedCount} unassigned bike(s)</strong> 
            and <strong style="text-decoration:underline; cursor:pointer;" onclick="Dashboard.setBikeFilter('unauthorized')">${expiredCount + expiringSoonCount} bike(s) with expired or expiring authorization</strong>. 
            Click any status filter below to filter the list.
          </div>
        </div>
      `;
    }

    return `
      <div class="card section-card mt-24" style="margin-bottom: 24px; animation: slideUp 300ms ease both; animation-delay: 100ms; border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding: 20px 24px;" id="bike-auth-toggle">
          <h2 class="section-title" style="display:flex; align-items:center; gap:10px; margin:0; font-size: 16px; font-weight: 700;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:var(--primary-500);"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8a2 2 0 0 0-2 2v7.5"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
            <span>Company Bike Fleet Overview (${totalBikes} Bikes)</span>
          </h2>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="badge" id="bike-auth-summary-badge" style="font-size:12px; font-weight:600; padding:3px 10px; border-radius: 8px; ${badgeColor}">${summaryBadgeText}</span>
            <svg id="bike-auth-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px; transition: transform 0.2s; transform: ${this.bikeAuthCollapsed ? 'rotate(-90deg)' : 'none'};"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        
        <div id="bike-auth-content-panel" style="display: ${this.bikeAuthCollapsed ? 'none' : 'block'}; padding: 0 24px 24px 24px;">
          ${alertHtml}
          
          <!-- Internal Grid for Stats -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--primary-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setBikeFilter('all')">
              <div style="font-size:10px; color:var(--gray-500); font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Total Bikes</div>
              <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-top:4px;" id="bike-stat-total">${totalBikes}</div>
            </div>
            <div style="background:#DEF7EC; border:1px solid #BCF0DA; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--success-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setBikeFilter('authorized')">
              <div style="font-size:10px; color:#03543F; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Authorized</div>
              <div style="font-size:22px; font-weight:800; color:#03543F; margin-top:4px;" id="bike-stat-authorized">${authorizedCount}</div>
            </div>
            <div style="background:#FFFDF5; border:1px solid #FCD34D; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--warning-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setBikeFilter('unauthorized')">
              <div style="font-size:10px; color:#B45309; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Expiring Soon</div>
              <div style="font-size:22px; font-weight:800; color:#92400E; margin-top:4px;" id="bike-stat-warning">${expiringSoonCount}</div>
            </div>
            <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--danger-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setBikeFilter('unauthorized')">
              <div style="font-size:10px; color:#B91C1C; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Expired</div>
              <div style="font-size:22px; font-weight:800; color:#991B1B; margin-top:4px;" id="bike-stat-expired">${expiredCount}</div>
            </div>
            <div style="background:#F1F5F9; border:1px solid #CBD5E1; padding:12px 14px; border-radius:12px; border-left: 4px solid #64748B; cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setBikeFilter('unassigned')">
              <div style="font-size:10px; color:#475569; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Unassigned</div>
              <div style="font-size:22px; font-weight:800; color:#334155; margin-top:4px;" id="bike-stat-unassigned">${unassignedCount}</div>
            </div>
          </div>
          
          <!-- Search / Filter Bar -->
          <div style="margin-bottom: 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content: space-between;">
            <div style="position:relative; width: 320px; min-width: 250px;">
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--gray-400); width:16px; height:16px; display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" id="bike-search" class="dashboard-search-input" placeholder="Search plate, model, rider or status..." value="${Utils.escapeHtml(this.bikeSearchQuery || '')}">
            </div>
            <div class="filters" style="display:flex; gap:8px;">
              <button class="filter-chip ${this.bikeFilter === 'all' ? 'active' : ''}" data-bike-filter="all" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">All</button>
              <button class="filter-chip ${this.bikeFilter === 'unauthorized' ? 'active' : ''}" data-bike-filter="unauthorized" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Needs Attention</button>
              <button class="filter-chip ${this.bikeFilter === 'unassigned' ? 'active' : ''}" data-bike-filter="unassigned" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Unassigned</button>
              <button class="filter-chip ${this.bikeFilter === 'authorized' ? 'active' : ''}" data-bike-filter="authorized" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Authorized</button>
            </div>
          </div>
          
          <!-- Table Container -->
          <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.02);">
            <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead style="position: sticky; top: 0; background: #F8FAFC; z-index: 1; border-bottom: 2px solid var(--border-light); box-shadow: 0 1px 0 var(--border-light);">
                <tr>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Bike (Plate & Model)</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Assigned Rider</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Rider Type</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Authorization Status</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Expiry Date</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Days Remaining</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary); text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody id="bike-auth-table-body">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  buildBikeTableRows(bikes, riders, searchQuery) {
    const sortedBikes = [...bikes].sort((a, b) => {
      // Sort priority:
      // 1. Expired (istimara_expiry < 0 days)
      // 2. Unassigned (no assigned rider id)
      // 3. Expiring soon (< 30 days)
      // 4. Authorized
      
      const getPriority = (bike) => {
        if (!bike.assigned_rider_id) return 1; // Unassigned on top
        if (!bike.istimara_expiry) return 3; // No expiry (pending)
        const days = Utils.daysUntil(bike.istimara_expiry);
        if (days < 0) return 0; // Expired has highest priority (0)
        if (days <= 30) return 2; // Expiring soon
        return 4; // Authorized at bottom
      };

      return getPriority(a) - getPriority(b);
    });

    return sortedBikes.map(bike => {
      const rider = bike.assigned_rider_id ? riders.find(r => String(r.id) === String(bike.assigned_rider_id)) : null;
      
      const bikePlate = bike.plate_number || 'No Plate';
      const bikeModel = bike.model || 'Standard Bike';
      const bikeInfo = `<div style="font-family:'JetBrains Mono','Fira Code',monospace; font-weight: 700; color: var(--text-primary); font-size: 14px;">${Utils.escapeHtml(bikePlate)}</div><div style="color:var(--text-tertiary); font-size:11px; margin-top: 2px;">${Utils.escapeHtml(bikeModel)}</div>`;
      
      let riderNameText = '—';
      let riderType = '—';
      let statusBadge = '';
      let expiryText = '—';
      let remainingText = '—';
      let actionHtml = '—';
      let rowStatusVal = 'authorized';

      if (!bike.assigned_rider_id) {
        rowStatusVal = 'unassigned';
        riderNameText = `<span style="color: var(--gray-400); font-style: italic; font-weight: 500;">Unassigned</span>`;
        statusBadge = `<span class="badge" style="background:#F1F5F9; color:#475569; border:1px solid #CBD5E1; font-weight:600; font-size:11px; border-radius: 6px;">Available</span>`;
        actionHtml = `<a href="javascript:void(0)" onclick="App.navigate('fleet'); Bikes.currentFilter = 'unassigned'; Bikes.render();" style="color:var(--primary-600); font-weight:700; text-decoration:none; font-size:12px; display: inline-flex; align-items: center; gap: 4px;">Assign Rider →</a>`;
      } else {
        riderNameText = `<span style="font-weight: 600; color: var(--text-primary);">${Utils.escapeHtml(rider ? rider.name : bike.assigned_rider_name || 'Assigned')}</span>`;
        riderType = rider ? Utils.escapeHtml(rider.rider_type) : 'Company';
      }

      if (bike.istimara_expiry) {
        const days = Utils.daysUntil(bike.istimara_expiry);
        expiryText = Utils.formatDateShort(bike.istimara_expiry);
        
        if (days < 0) {
          rowStatusVal = 'expired';
          const absDays = Math.abs(days);
          statusBadge = `<span class="badge" style="background:#FDE8E8; color:#9B1C1C; border:1px solid #F87171; font-weight:700; font-size:11px; border-radius: 6px;">Expired</span>`;
          remainingText = `<span style="color:#DC2626; font-weight:700;">Expired ${absDays}d ago</span>`;
        } else if (days <= 30) {
          rowStatusVal = 'warning';
          statusBadge = `<span class="badge" style="background:#FEF3C7; color:#92400E; border:1px solid #FCD34D; font-weight:600; font-size:11px; border-radius: 6px;">Expiring Soon</span>`;
          remainingText = `<span style="color:#D97706; font-weight:600;">${days}d left</span>`;
        } else {
          rowStatusVal = 'authorized';
          statusBadge = `<span class="badge" style="background:#DEF7EC; color:#03543F; border:1px solid #34D399; font-weight:600; font-size:11px; border-radius: 6px;">Authorized</span>`;
          remainingText = `<span style="color:#16A34A; font-weight:600;">${days}d left</span>`;
        }
      } else if (bike.assigned_rider_id) {
        rowStatusVal = 'unauthorized';
        statusBadge = `<span class="badge" style="background:#FFFDF5; color:#D97706; border:1px solid #FCD34D; font-weight:700; font-size:11px; border-radius: 6px;">Pending Doc</span>`;
      }

      if (rowStatusVal === 'expired' || rowStatusVal === 'warning' || rowStatusVal === 'unauthorized') {
        const phone = rider ? rider.phone : null;
        if (phone) {
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          let msg = '';
          if (rowStatusVal === 'expired') {
            const days = Math.abs(Utils.daysUntil(bike.istimara_expiry));
            msg = `Dear *${rider.name}*\n\nYour bike *${bikePlate}* authorization (Istimara) expired *${days} days ago* on *${expiryText}*.\n\nPlease coordinate renewal urgently.\n\n*If already authorized* please send a screenshot of the expiry date from your *Absher*:\n1 Open Absher\n2 Go to My Vehicles\n3 Select the bike\n4 Under Vehicle Details click Authorization Details\n5 Take screenshot and send it here\n\nInspiring Roads Logistics`;
          } else if (rowStatusVal === 'warning') {
            const days = Utils.daysUntil(bike.istimara_expiry);
            msg = `Dear *${rider.name}*\n\nYour bike *${bikePlate}* authorization (Istimara) will expire in *${days} days* on *${expiryText}*.\n\nPlease arrange renewal as soon as possible.\n\n*If already authorized* please send a screenshot of the expiry date from your *Absher*:\n1 Open Absher\n2 Go to My Vehicles\n3 Select the bike\n4 Under Vehicle Details click Authorization Details\n5 Take screenshot and send it here\n\nInspiring Roads Logistics`;
          } else if (rowStatusVal === 'unauthorized') {
            msg = `Dear *${rider.name}*\n\nYour bike *${bikePlate}* authorization (Istimara) is missing or pending in our system.\n\nPlease send a screenshot of the expiry date from your *Absher*:\n1 Open Absher\n2 Go to My Vehicles\n3 Select the bike\n4 Under Vehicle Details click Authorization Details\n5 Take screenshot and send it here\n\nInspiring Roads Logistics`;
          }
          
          if (msg) {
            const encMsg = encodeURIComponent(msg);
            actionHtml = `
              <div style="display:inline-flex; align-items:center; gap:8px;">
                <a href="https://wa.me/${cleanPhone}?text=${encMsg}" target="_blank" class="wa-action-btn" title="Send WhatsApp Warning" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#25D366,#128C7E); color:white; box-shadow:0 1px 4px rgba(37,211,102,0.25);">
                  <svg viewBox="0 0 24 24" fill="white" style="width:12px; height:12px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <button type="button" class="btn-copy" onclick="Dashboard.openBikeAuthModal(${bike.id})" title="Copy Noon Auth Data" style="border:1px solid var(--border-medium); background:white; color:var(--text-secondary); width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.2s;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            `;
          } else {
            actionHtml = `
              <button type="button" class="btn-copy" onclick="Dashboard.openBikeAuthModal(${bike.id})" title="Copy Noon Auth Data" style="border:1px solid var(--border-medium); background:white; color:var(--text-secondary); width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.2s;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            `;
          }
        }
      }

      return `
        <tr data-rider-name="${Utils.escapeHtml(rider ? rider.name : '')}" 
            data-plate-number="${Utils.escapeHtml(bikePlate)}" 
            data-bike-model="${Utils.escapeHtml(bikeModel)}" 
            data-status="${Utils.escapeHtml(rowStatusVal)}" 
            data-rider-type="${Utils.escapeHtml(riderType)}" 
            data-row-status-val="${rowStatusVal}"
            style="border-bottom: 1px solid var(--border-light); transition: background-color 0.15s; cursor: pointer;"
            class="hover-row"
            onclick="Bikes.openBikeForm(${JSON.stringify(bike).replace(/"/g, '&quot;')})">
          <td style="padding: 12px 16px; vertical-align: middle;">${bikeInfo}</td>
          <td style="padding: 12px 16px; vertical-align: middle;">${riderNameText}</td>
          <td style="padding: 12px 16px; text-transform: capitalize; color: var(--text-secondary); vertical-align: middle;">${riderType}</td>
          <td style="padding: 12px 16px; vertical-align: middle;">${statusBadge}</td>
          <td style="padding: 12px 16px; color: var(--text-secondary); vertical-align: middle;">${expiryText}</td>
          <td style="padding: 12px 16px; vertical-align: middle;">${remainingText}</td>
          <td style="padding: 12px 16px; text-align:center; vertical-align: middle;" onclick="event.stopPropagation();">${actionHtml}</td>
        </tr>
      `;
    }).join('');
  },

  setBikeFilter(filter) {
    this.bikeFilter = filter;
    this.applyBikeFilters();
    // Scroll the bike-auth panel into view and expand if collapsed
    if (this.bikeAuthCollapsed) {
      this.toggleBikeAuthPanel();
    }
    const elem = document.getElementById('bike-auth-toggle');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  toggleBikeAuthPanel() {
    this.bikeAuthCollapsed = !this.bikeAuthCollapsed;
    const panel = document.getElementById('bike-auth-content-panel');
    const chevron = document.getElementById('bike-auth-chevron');
    if (panel) {
      panel.style.display = this.bikeAuthCollapsed ? 'none' : 'block';
    }
    if (chevron) {
      chevron.style.transform = this.bikeAuthCollapsed ? 'rotate(-90deg)' : 'none';
    }
  },

  handleBikeSearch(e) {
    this.bikeSearchQuery = e.target.value;
    this.applyBikeFilters();
  },

  applyBikeFilters() {
    const query = (this.bikeSearchQuery || '').toLowerCase().trim();
    const filter = this.bikeFilter || 'all';
    
    // Update active filter chip class
    document.querySelectorAll('[data-bike-filter]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.bikeFilter === filter);
    });
    
    const rows = document.querySelectorAll('#bike-auth-table-body tr');
    rows.forEach(row => {
      const riderName = row.getAttribute('data-rider-name')?.toLowerCase() || '';
      const plateNumber = row.getAttribute('data-plate-number')?.toLowerCase() || '';
      const bikeModel = row.getAttribute('data-bike-model')?.toLowerCase() || '';
      const status = row.getAttribute('data-status')?.toLowerCase() || '';
      const riderType = row.getAttribute('data-rider-type')?.toLowerCase() || '';
      const rowStatusVal = row.getAttribute('data-row-status-val') || '';
      
      const matchesSearch = !query || 
                            riderName.includes(query) ||
                            plateNumber.includes(query) ||
                            bikeModel.includes(query) ||
                            status.includes(query) ||
                            riderType.includes(query);
                            
      let matchesFilter = true;
      if (filter === 'missing') {
        matchesFilter = (rowStatusVal === 'missing');
      } else if (filter === 'unauthorized') {
        matchesFilter = (rowStatusVal === 'unauthorized' || rowStatusVal === 'expired' || rowStatusVal === 'warning' || rowStatusVal === 'unassigned');
      } else if (filter === 'unassigned') {
        matchesFilter = (rowStatusVal === 'unassigned');
      } else if (filter === 'authorized') {
        matchesFilter = (rowStatusVal === 'authorized');
      }
      
      row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
    });
  },

  getExpiryDate(dateStr, daysToAdd = 180) {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + daysToAdd);
    return Utils.toLocalDateStr(d);
  },

  buildUniformSafetyTracker(riders) {
    const activeRiders = riders.filter(r => r.status === 'active');
    const totalRiders = activeRiders.length;
    let upToDateUniforms = 0;
    let expiredUniforms = 0;
    let expiredKits = 0;

    activeRiders.forEach(r => {
      // Uniform status
      if (!r.uniform_date) {
        expiredUniforms++;
      } else {
        const expDate = this.getExpiryDate(r.uniform_date);
        const days = Utils.daysUntil(expDate);
        if (days < 0) expiredUniforms++;
        else upToDateUniforms++;
      }

      // Safety kits status (Helmet, Gloves, Chest, Foot)
      const assets = [r.helmet_date, r.gloves_date, r.chest_safety_date, r.foot_safety_date];
      const hasExpiredAsset = assets.some(date => {
        if (!date) return true; // Missing is treated as expired
        const expDate = this.getExpiryDate(date);
        return Utils.daysUntil(expDate) < 0;
      });
      if (hasExpiredAsset) expiredKits++;
    });

    const rowsHtml = this.buildUniformTableRows(activeRiders);

    const summaryBadgeText = expiredUniforms > 0 
      ? `⚠️ ${expiredUniforms} Uniforms Expired` 
      : (expiredKits > 0 ? `⚠️ ${expiredKits} Kits Expired` : '✓ All Clear');
      
    const badgeColor = (expiredUniforms > 0 || expiredKits > 0)
      ? 'background:#FDE8E8; color:#9B1C1C; border:1px solid #F87171;' 
      : 'background:#DEF7EC; color:#03543F; border:1px solid #34D399;';

    return `
      <div class="card section-card mt-24" style="margin-bottom: 24px; animation: slideUp 300ms ease both; animation-delay: 150ms; border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding: 20px 24px;" id="uniform-tracker-toggle">
          <h2 class="section-title" style="display:flex; align-items:center; gap:10px; margin:0; font-size: 16px; font-weight: 700;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:var(--primary-500);"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
            <span>Rider Uniform & Safety Kit Tracker</span>
          </h2>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="badge" id="uniform-summary-badge" style="font-size:12px; font-weight:600; padding:3px 10px; border-radius: 8px; ${badgeColor}">${summaryBadgeText}</span>
            <svg id="uniform-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px; transition: transform 0.2s; transform: ${this.uniformTrackerCollapsed ? 'rotate(-90deg)' : 'none'};"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        
        <div id="uniform-tracker-content-panel" style="display: ${this.uniformTrackerCollapsed ? 'none' : 'block'}; padding: 0 24px 24px 24px;">
          <!-- Internal Grid for Stats -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--primary-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setUniformFilter('all')">
              <div style="font-size:10px; color:var(--gray-500); font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Active DAs</div>
              <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin-top:4px;">${totalRiders}</div>
            </div>
            <div style="background:#DEF7EC; border:1px solid #BCF0DA; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--success-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setUniformFilter('valid')">
              <div style="font-size:10px; color:#03543F; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Uniforms Valid</div>
              <div style="font-size:22px; font-weight:800; color:#03543F; margin-top:4px;">${upToDateUniforms}</div>
            </div>
            <div style="background:#FEF2F2; border:1px solid #FCA5A5; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--danger-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setUniformFilter('expired')">
              <div style="font-size:10px; color:#B91C1C; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Uniforms Expired</div>
              <div style="font-size:22px; font-weight:800; color:#991B1B; margin-top:4px;">${expiredUniforms}</div>
            </div>
            <div style="background:#FFFDF5; border:1px solid #FCD34D; padding:12px 14px; border-radius:12px; border-left: 4px solid var(--warning-500); cursor:pointer; transition: all 0.2s;" class="hover-scale" onclick="Dashboard.setUniformFilter('expired-kits')">
              <div style="font-size:10px; color:#B45309; font-weight:700; text-transform:uppercase; letter-spacing: 0.5px;">Kits Expired</div>
              <div style="font-size:22px; font-weight:800; color:#92400E; margin-top:4px;">${expiredKits}</div>
            </div>
          </div>

          <!-- Bulk Actions Toolbar -->
          <div id="uniform-bulk-actions" style="display:none; background:#EFF6FF; border:1px solid #BFDBFE; padding:12px 16px; border-radius:12px; margin-bottom:16px; align-items:center; justify-content:space-between; animation: slideDown 0.2s ease both;">
            <div style="font-size:13px; font-weight:600; color:#1E40AF;">
              <span id="uniform-selected-count">0</span> riders selected
            </div>
            <div style="display:flex; gap:10px;">
              <button type="button" id="btn-bulk-copy-noon" style="padding:6px 12px; font-size:12px; font-weight:600; background:#2563EB; color:white; border:none; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition: background 0.15s;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy TSV for Noon
              </button>
              <button type="button" id="btn-bulk-mark-uniform" style="padding:6px 12px; font-size:12px; font-weight:600; background:#10B981; color:white; border:none; border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition: background 0.15s;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Mark Uniform Issued Today
              </button>
            </div>
          </div>
          
          <!-- Search / Filter Bar -->
          <div style="margin-bottom: 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content: space-between;">
            <div style="position:relative; width: 320px; min-width: 250px;">
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--gray-400); width:16px; height:16px; display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" id="uniform-search" class="dashboard-search-input" placeholder="Search DA name, Noon ID, store or status..." value="${Utils.escapeHtml(this.uniformSearchQuery || '')}">
            </div>
            <div class="filters" style="display:flex; gap:8px;">
              <button class="filter-chip ${this.uniformFilter === 'all' ? 'active' : ''}" data-uniform-filter="all" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">All</button>
              <button class="filter-chip ${this.uniformFilter === 'expired' ? 'active' : ''}" data-uniform-filter="expired" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Expired Uniform</button>
              <button class="filter-chip ${this.uniformFilter === 'expired-kits' ? 'active' : ''}" data-uniform-filter="expired-kits" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Expired Kits</button>
              <button class="filter-chip ${this.uniformFilter === 'valid' ? 'active' : ''}" data-uniform-filter="valid" style="font-size:12px; padding: 6px 14px; border-radius: 8px; font-weight: 600;">Up to Date</button>
            </div>
          </div>
          
          <!-- Table Container -->
          <div class="table-container" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.02);">
            <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead style="position: sticky; top: 0; background: #F8FAFC; z-index: 1; border-bottom: 2px solid var(--border-light); box-shadow: 0 1px 0 var(--border-light);">
                <tr>
                  <th style="padding: 12px 16px; width: 40px; text-align:center; vertical-align: middle;">
                    <input type="checkbox" id="uniform-select-all" style="cursor:pointer; width:16px; height:16px; margin: 0; vertical-align: middle;">
                  </th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Rider (DA Name)</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Noon ID & Station</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Uniform Date</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Uniform Status</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Safety Kit Assets (6m Expiry)</th>
                  <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary); text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody id="uniform-table-body">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  buildUniformTableRows(riders) {
    const sortedRiders = [...riders].sort((a, b) => {
      // Sort priority: Expired uniforms or missing uniforms first, then expired kits, then up-to-date
      const getPriority = (rider) => {
        if (!rider.uniform_date) return 0;
        const uniformDays = Utils.daysUntil(this.getExpiryDate(rider.uniform_date));
        if (uniformDays < 0) return 0;

        const assets = [rider.helmet_date, rider.gloves_date, rider.chest_safety_date, rider.foot_safety_date];
        const hasExpiredAsset = assets.some(date => {
          if (!date) return true;
          return Utils.daysUntil(this.getExpiryDate(date)) < 0;
        });
        if (hasExpiredAsset) return 1;
        return 2;
      };
      return getPriority(a) - getPriority(b);
    });

    return sortedRiders.map(rider => {
      const noonId = rider.noon_id || rider.company_id || rider.rider_company_id || '—';
      const store = rider.store_warehouse || '—';
      
      // Uniform Status
      let uniformDateText = rider.uniform_date ? Utils.formatDateShort(rider.uniform_date) : '—';
      let uniformBadge = '';
      let uniformRowStatus = 'valid';
      
      if (!rider.uniform_date) {
        uniformRowStatus = 'expired';
        uniformBadge = `<span class="badge" style="background:#FCE8E6; color:#C5221F; border:1px solid #F1A9A0; font-weight:700; font-size:11px; border-radius: 6px;">Not Issued</span>`;
      } else {
        const expDate = this.getExpiryDate(rider.uniform_date);
        const days = Utils.daysUntil(expDate);
        const pct = Math.max(0, Math.min(100, (days / 180) * 100)); // percentage left
        
        let colorClass = '#10B981'; // Green
        if (days < 0) {
          colorClass = '#EF4444'; // Red
        } else if (days <= 30) {
          colorClass = '#F59E0B'; // Orange
        }
        
        const progressBar = `
          <div style="width: 100%; min-width: 100px; max-width: 150px; margin-top: 4px;">
            <div style="background:var(--gray-200); height:8px; border-radius:4px; overflow:hidden; width:100%; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(90deg, ${colorClass}, ${colorClass}dd); width:${pct}%; height:100%; border-radius:4px; box-shadow: 0 1px 4px -1px ${colorClass}; transition: width 0.3s ease;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-secondary); margin-top: 4px; font-weight: 600; letter-spacing:0.2px;">
              <span>${days < 0 ? 'Expired' : `${days}d left`}</span>
              <span>${Math.round(pct)}%</span>
            </div>
          </div>
        `;
        
        if (days < 0) {
          uniformRowStatus = 'expired';
          uniformBadge = `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span class="badge" style="background:#FCE8E6; color:#C5221F; border:1px solid #F1A9A0; font-weight:700; font-size:11px; border-radius: 6px; width:fit-content;">Expired (${Math.abs(days)}d ago)</span>
              ${progressBar}
            </div>
          `;
        } else {
          uniformBadge = `
            <div style="display:flex; flex-direction:column; gap:2px;">
              <span class="badge" style="background:#DEF7EC; color:#03543F; border:1px solid #34D399; font-weight:600; font-size:11px; border-radius: 6px; width:fit-content;">Valid</span>
              ${progressBar}
            </div>
          `;
        }
      }

      // Safety Kit Assets helper
      const getAssetBadge = (date, name, icon) => {
        if (!date) {
          return `<span title="${name}: Not Issued" style="background:#F1F5F9; color:#94A3B8; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px; opacity:0.65; border:1px solid #E2E8F0;">${icon} Missing</span>`;
        }
        const expDate = this.getExpiryDate(date);
        const days = Utils.daysUntil(expDate);
        if (days < 0) {
          return `<span title="${name}: Expired ${Math.abs(days)}d ago" style="background:#FDF2F2; color:#B91C1C; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px; border:1px solid #FEE2E2;">${icon} Expired</span>`;
        }
        return `<span title="${name}: ${days}d left" style="background:#F0FDF4; color:#15803D; padding:3px 8px; border-radius:6px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px; border:1px solid #DCFCE7;">${icon} ${days}d</span>`;
      };

      const helmetBadge = getAssetBadge(rider.helmet_date, 'Helmet', '🪖');
      const glovesBadge = getAssetBadge(rider.gloves_date, 'Gloves', '🧤');
      const chestBadge = getAssetBadge(rider.chest_safety_date, 'Chest Vest', '🦺');
      const footBadge = getAssetBadge(rider.foot_safety_date, 'Safety Shoes', '🥾');

      const assetsHtml = `
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${helmetBadge}
          ${glovesBadge}
          ${chestBadge}
          ${footBadge}
        </div>
      `;

      // Determine kit row status
      const kitExpired = [rider.helmet_date, rider.gloves_date, rider.chest_safety_date, rider.foot_safety_date].some(d => {
        if (!d) return true;
        return Utils.daysUntil(this.getExpiryDate(d)) < 0;
      });
      const kitStatusVal = kitExpired ? 'expired-kits' : 'valid';

      // Actions
      let actionHtml = '';
      if (rider.phone) {
        actionHtml = `
          <div style="display:inline-flex; align-items:center; gap:8px; justify-content:center;">
            <button type="button" class="wa-action-btn" title="Send WhatsApp Reminders" 
                    onclick="Dashboard.openWhatsAppTemplateModal(${rider.id})" 
                    style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border:none; border-radius:50%; background:linear-gradient(135deg,#25D366,#128C7E); color:white; box-shadow:0 1px 4px rgba(37,211,102,0.25); cursor:pointer;">
              <svg viewBox="0 0 24 24" fill="white" style="width:12px; height:12px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </button>
            <button type="button" class="btn-copy" onclick="Dashboard.openNoonSubmissionModal(${rider.id})" title="View Noon DA Info Modal" style="border:1px solid var(--border-medium); background:white; color:var(--text-secondary); width:28px; height:28px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition: all 0.2s;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          </div>
        `;
      }

      return `
        <tr data-rider-id="${rider.id}"
            data-rider-name="${Utils.escapeHtml(rider.name)}" 
            data-noon-id="${Utils.escapeHtml(noonId)}" 
            data-store="${Utils.escapeHtml(store)}" 
            data-uniform-status="${uniformRowStatus}" 
            data-kit-status="${kitStatusVal}"
            style="border-bottom: 1px solid var(--border-light); transition: background-color 0.15s; cursor: pointer;"
            class="hover-row"
            onclick="App.navigate('riders'); setTimeout(() => Riders.openEditRider(${rider.id}), 200);">
          <td style="padding: 12px 16px; vertical-align: middle; text-align:center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="uniform-select-row" data-rider-id="${rider.id}" style="cursor:pointer; width:16px; height:16px; margin: 0; vertical-align: middle;">
          </td>
          <td style="padding: 12px 16px; vertical-align: middle;">
            <div style="font-weight: 600; color: var(--text-primary); font-size: 14px;">${Utils.escapeHtml(rider.name)}</div>
          </td>
          <td style="padding: 12px 16px; vertical-align: middle;">
            <div style="font-weight: 700; color: var(--primary-700); font-family: monospace; font-size:13px;">${Utils.escapeHtml(noonId)}</div>
            <div style="color:var(--text-tertiary); font-size:11px; margin-top: 2px;">Station: ${Utils.escapeHtml(store)}</div>
          </td>
          <td style="padding: 12px 16px; vertical-align: middle; color: var(--text-secondary);">${uniformDateText}</td>
          <td style="padding: 12px 16px; vertical-align: middle;">${uniformBadge}</td>
          <td style="padding: 12px 16px; vertical-align: middle;">${assetsHtml}</td>
          <td style="padding: 12px 16px; text-align:center; vertical-align: middle;" onclick="event.stopPropagation();">${actionHtml}</td>
        </tr>
      `;
    }).join('');
  },

  copyNoonData(noonId, name, phone, iqama, store) {
    const dataStr = `Noon ID: ${noonId}\nName: ${name}\nPhone: ${phone}\nIqama: ${iqama}\nStore: ${store}`;
    navigator.clipboard.writeText(dataStr).then(() => {
      Utils.showToast('Copied Noon DA Submission Info to Clipboard!', 'success');
    }).catch(err => {
      Utils.showToast('Failed to copy info', 'error');
    });
  },

  copyBikeAuthData(plate, iqama, phone, dob, email) {
    const dobFormatted = dob ? Utils.formatDateShort(dob) : '—';
    const dataStr = `Iqama Number: ${iqama}\nPhone Number: ${phone}\nBike Plate: ${plate}\nDate of Birth: ${dobFormatted}\nEmail: ${email}`;
    navigator.clipboard.writeText(dataStr).then(() => {
      Utils.showToast('Copied Bike Authorization Details to Clipboard!', 'success');
    }).catch(err => {
      Utils.showToast('Failed to copy details', 'error');
    });
  },

  setUniformFilter(filter) {
    this.uniformFilter = filter;
    this.applyUniformFilters();
  },

  toggleUniformPanel() {
    this.uniformTrackerCollapsed = !this.uniformTrackerCollapsed;
    const panel = document.getElementById('uniform-tracker-content-panel');
    const chevron = document.getElementById('uniform-chevron');
    if (panel) {
      panel.style.display = this.uniformTrackerCollapsed ? 'none' : 'block';
    }
    if (chevron) {
      chevron.style.transform = this.uniformTrackerCollapsed ? 'rotate(-90deg)' : 'none';
    }
  },

  handleUniformSearch(e) {
    this.uniformSearchQuery = e.target.value;
    this.applyUniformFilters();
  },

  applyUniformFilters() {
    const query = (this.uniformSearchQuery || '').toLowerCase().trim();
    const filter = this.uniformFilter || 'all';
    
    document.querySelectorAll('[data-uniform-filter]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.uniformFilter === filter);
    });
    
    const rows = document.querySelectorAll('#uniform-table-body tr');
    rows.forEach(row => {
      const name = row.getAttribute('data-rider-name')?.toLowerCase() || '';
      const noonId = row.getAttribute('data-noon-id')?.toLowerCase() || '';
      const store = row.getAttribute('data-store')?.toLowerCase() || '';
      const uniformStatus = row.getAttribute('data-uniform-status') || '';
      const kitStatus = row.getAttribute('data-kit-status') || '';
      
      const matchesSearch = !query || 
                            name.includes(query) ||
                            noonId.includes(query) ||
                            store.includes(query);
                            
      let matchesFilter = true;
      if (filter === 'expired') {
        matchesFilter = (uniformStatus === 'expired');
      } else if (filter === 'expired-kits') {
        matchesFilter = (kitStatus === 'expired-kits');
      } else if (filter === 'valid') {
        matchesFilter = (uniformStatus === 'valid' && kitStatus === 'valid');
      }
      
      row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
    });
  },

  openWhatsAppTemplateModal(riderId) {
    const rider = this.riders?.find(r => r.id === riderId);
    if (!rider) return Utils.showToast('Rider not found', 'error');

    const bike = this.bikes?.find(b => parseInt(b.assigned_rider_id) === rider.id);
    const bikePlate = bike ? bike.plate_number : 'No Bike';

    // Predefined templates
    const templates = {
      uniform: `Dear *${rider.name}*\n\nYour Noon Uniform allowance cycle has completed and it is time for a new uniform issue.\n\n*If you already received it* please send a photo of yourself in the new uniform to the supervisor group.\n\nInspiring Roads Logistics`,
      safety: `Dear *${rider.name}*\n\nYour Safety Kit allowance (Helmet/Vest/Shoes/Gloves) is due for renewal or verification.\n\nPlease coordinate with the office to verify and get new safety equipment.\n\nInspiring Roads Logistics`,
      auth: `Dear *${rider.name}*\n\nYour bike *${bikePlate}* authorization (Istimara) requires urgent attention.\n\n*Please send a screenshot of the expiry date from your Absher*:\n1 Open Absher\n2 Go to My Vehicles\n3 Select the bike\n4 Under Vehicle Details click Authorization Details\n5 Take screenshot and send it here\n\nInspiring Roads Logistics`
    };

    const modalTitle = `<div style="font-size:16px; font-weight:700; color:#1E293B; display:flex; align-items:center; gap:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.5" style="width:18px; height:18px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      Send WhatsApp Notification
    </div>`;

    const bodyHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:13px; color:#64748B;">
          Sending reminder to <strong>${Utils.escapeHtml(rider.name)}</strong> (${rider.phone || 'No phone'}).
        </div>
        
        <div>
          <label style="font-size:12px; font-weight:600; color:#475569; display:block; margin-bottom:6px;">Select Template</label>
          <select id="wa-template-select" class="rider-form-select" style="width:100%; height:38px; border:1px solid #CBD5E1; border-radius:8px; padding:0 12px; font-size:13px; box-sizing:border-box;">
            <option value="uniform">Uniform Allowance Renewal</option>
            <option value="safety">Safety Kit Assets Renewal</option>
            <option value="auth">Bike Authorization Absher Screenshot Request</option>
            <option value="custom">Custom Blank Message</option>
          </select>
        </div>
        
        <div>
          <label style="font-size:12px; font-weight:600; color:#475569; display:block; margin-bottom:6px;">Message Preview</label>
          <textarea id="wa-message-text" class="rider-form-input" style="width:100%; height:160px; border:1px solid #CBD5E1; border-radius:8px; padding:12px; font-size:13px; font-family:sans-serif; resize:vertical; box-sizing:border-box; line-height:1.5;"></textarea>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
          <button type="button" onclick="Utils.closeModal()" style="height:38px; padding:0 16px; border:1px solid #CBD5E1; background:white; color:#475569; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">Cancel</button>
          <button type="button" id="btn-wa-send-submit" style="height:38px; padding:0 16px; border:none; background:linear-gradient(135deg,#25D366,#128C7E); color:white; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px; display:inline-flex; align-items:center; gap:6px; box-shadow: 0 4px 6px -1px rgba(37,211,102,0.2);">
            <svg viewBox="0 0 24 24" fill="white" style="width:14px; height:14px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send WhatsApp
          </button>
        </div>
      </div>
    `;

    Utils.openModal(modalTitle, bodyHtml, 'modal-md');

    const select = document.getElementById('wa-template-select');
    const textarea = document.getElementById('wa-message-text');
    const btnSend = document.getElementById('btn-wa-send-submit');

    if (textarea) {
      textarea.value = templates.uniform; // default
    }

    select?.addEventListener('change', (e) => {
      const type = e.target.value;
      if (textarea) {
        textarea.value = templates[type] || '';
      }
    });

    btnSend?.addEventListener('click', () => {
      const msg = textarea ? textarea.value : '';
      if (!msg.trim()) return Utils.showToast('Message cannot be empty', 'error');
      
      const cleanPhone = rider.phone.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank');
      Utils.closeModal();
    });
  },

  openNoonSubmissionModal(riderId) {
    const rider = this.riders?.find(r => r.id === riderId);
    if (!rider) return Utils.showToast('Rider not found', 'error');
    
    const noonId = rider.noon_id || rider.company_id || rider.rider_company_id || '—';
    const store = rider.store_warehouse || '—';
    const iqama = rider.iqama_number || '—';
    const phone = rider.phone || '—';
    
    const modalTitle = `<div style="font-size:16px; font-weight:700; color:#1E293B;">Noon Submission DA Info</div>`;
    const bodyHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:12px; color:#64748B;">
          Securely view and copy credentials for Noon submissions.
        </div>
        
        <div style="display:grid; grid-template-columns:1fr; gap:12px; background:#F8FAFC; border:1px solid #E2E8F0; padding:16px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Noon ID</div>
              <div style="font-size:14px; font-weight:700; color:#1E3A8A; font-family:monospace;">${Utils.escapeHtml(noonId)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(noonId)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Rider Name</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(rider.name)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(rider.name)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Phone Number</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(phone)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(phone)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Iqama Number</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B; font-family:monospace;">${Utils.escapeHtml(iqama)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(iqama)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:4px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Store / Station</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(store)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(store)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>
        </div>
        
        <div style="display:flex; gap:12px; justify-content:space-between; margin-top:8px;">
          <button type="button" id="btn-noon-copy-all" style="flex:1; height:38px; border:none; background:#2563EB; color:white; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 6px -1px rgba(37,99,235,0.2); transition: background 0.15s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy All for Noon Sheet
          </button>
          <button type="button" onclick="Utils.closeModal()" style="height:38px; padding:0 16px; border:1px solid #CBD5E1; background:white; color:#475569; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">Close</button>
        </div>
      </div>
    `;
    
    Utils.openModal(modalTitle, bodyHtml, 'modal-md');
    
    document.querySelectorAll('.btn-copy-field').forEach(btn => {
      btn.onclick = (e) => {
        const val = e.target.dataset.value;
        navigator.clipboard.writeText(val).then(() => {
          Utils.showToast('Copied to clipboard!', 'success');
        });
      };
    });
    
    document.getElementById('btn-noon-copy-all').onclick = () => {
      const tsv = `${noonId}\t${rider.name}\t${phone}\t${iqama}\t${store}`;
      navigator.clipboard.writeText(tsv).then(() => {
        Utils.showToast('Copied Tab-separated DA details to Clipboard!', 'success');
        Utils.closeModal();
      });
    };
  },

  openBikeAuthModal(bikeId) {
    const bike = this.bikes?.find(b => b.id === bikeId);
    if (!bike) return Utils.showToast('Bike not found', 'error');
    
    const rider = this.riders?.find(r => r.id === bike.assigned_rider_id);
    if (!rider) return Utils.showToast('No rider assigned to this bike', 'warning');
    
    const plate = bike.plate_number || '—';
    const iqama = rider.iqama_number || '—';
    const phone = rider.phone || '—';
    const email = rider.email || '—';
    const dob = rider.date_of_birth ? Utils.formatDateShort(rider.date_of_birth) : '—';
    
    const modalTitle = `<div style="font-size:16px; font-weight:700; color:#1E293B;">Bike Authorization DA Info</div>`;
    const bodyHtml = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <div style="font-size:12px; color:#64748B;">
          Credentials required to authorize bike <strong>${Utils.escapeHtml(plate)}</strong> to rider.
        </div>
        
        <div style="display:grid; grid-template-columns:1fr; gap:12px; background:#F8FAFC; border:1px solid #E2E8F0; padding:16px; border-radius:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Bike Plate Number</div>
              <div style="font-size:14px; font-weight:700; color:#1E3A8A; font-family:monospace;">${Utils.escapeHtml(plate)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(plate)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Iqama Number</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B; font-family:monospace;">${Utils.escapeHtml(iqama)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(iqama)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Phone Number</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(phone)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(phone)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #E2E8F0; padding-bottom:8px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Date of Birth</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(dob)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(dob)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:4px;">
            <div>
              <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase;">Email Address</div>
              <div style="font-size:14px; font-weight:600; color:#1E293B;">${Utils.escapeHtml(email)}</div>
            </div>
            <button class="btn-copy-field" data-value="${Utils.escapeHtml(email)}" style="border:1px solid #CBD5E1; background:white; padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600; color:#475569; transition: all 0.15s;">Copy</button>
          </div>
        </div>
        
        <div style="display:flex; gap:12px; justify-content:space-between; margin-top:8px;">
          <button type="button" id="btn-bike-auth-copy-all" style="flex:1; height:38px; border:none; background:#2563EB; color:white; font-size:13px; font-weight:600; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 4px 6px -1px rgba(37,99,235,0.2); transition: background 0.15s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy All Auth Details
          </button>
          <button type="button" onclick="Utils.closeModal()" style="height:38px; padding:0 16px; border:1px solid #CBD5E1; background:white; color:#475569; border-radius:8px; cursor:pointer; font-weight:600; font-size:13px;">Close</button>
        </div>
      </div>
    `;
    
    Utils.openModal(modalTitle, bodyHtml, 'modal-md');
    
    document.querySelectorAll('.btn-copy-field').forEach(btn => {
      btn.onclick = (e) => {
        const val = e.target.dataset.value;
        navigator.clipboard.writeText(val).then(() => {
          Utils.showToast('Copied to clipboard!', 'success');
        });
      };
    });
    
    document.getElementById('btn-bike-auth-copy-all').onclick = () => {
      const details = `Iqama Number: ${iqama}\nPhone Number: ${phone}\nBike Plate: ${plate}\nDate of Birth: ${dob}\nEmail: ${email}`;
      navigator.clipboard.writeText(details).then(() => {
        Utils.showToast('Copied Bike Authorization Details to Clipboard!', 'success');
        Utils.closeModal();
      });
    };
  }
};

