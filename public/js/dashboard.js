// ========================================
//  DASHBOARD - Main overview page
// ========================================

const Dashboard = {
  _initialized: false,
  bikeSearchQuery: '',
  bikeAuthCollapsed: false,

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

    return `
      <!-- Smart Greeting -->
      ${this.buildGreeting(stats, period)}

      <!-- Rider Bike Authorizations & Expiries -->
      ${this.buildBikeAuthorizations(bikes, riders)}

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="card stat-card" style="border-top: 3px solid #2563EB; animation: slideUp 300ms ease both; animation-delay: 0ms">
          <div class="stat-card-header">
            <span class="stat-card-label">Total Riders</span>
            <div class="stat-card-icon" style="color: #2563EB;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div class="stat-card-value">${stats.total_active}</div>
          <div class="stat-card-sub">${stats.total_company} Company · ${stats.total_freelancer} Freelancer</div>
        </div>

        <div class="card stat-card" style="border-top: 3px solid #16A34A; animation: slideUp 300ms ease both; animation-delay: 80ms">
          <div class="stat-card-header">
            <span class="stat-card-label">Logged Today</span>
            <div class="stat-card-icon" style="color: #16A34A;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="color: ${stats.logged_today === 0 ? '#DC2626' : 'var(--text-primary)'};">${stats.logged_today}</div>
          <div class="stat-card-sub" style="color: ${stats.logged_today === 0 ? '#DC2626' : 'var(--text-tertiary)'};">out of ${stats.total_active} riders</div>
        </div>

        <div class="card stat-card" style="border-top: 3px solid #D97706; animation: slideUp 300ms ease both; animation-delay: 160ms">
          <div class="stat-card-header">
            <span class="stat-card-label">Pending Today</span>
            <div class="stat-card-icon" style="color: #D97706;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div class="stat-card-value">${stats.pending_today}</div>
          <div class="stat-card-sub">data not yet recorded</div>
        </div>

        <div class="card stat-card" style="border-top: 3px solid #DC2626; animation: slideUp 300ms ease both; animation-delay: 240ms">
          <div class="stat-card-header">
            <span class="stat-card-label">Low Check-in</span>
            <div class="stat-card-icon" style="color: #DC2626;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          </div>
          <div class="stat-card-value">${stats.low_checkins_today.length}</div>
          <div class="stat-card-sub">riders below 11 hrs today</div>
        </div>

        <div class="card stat-card" style="border-top: 3px solid #7C3AED; animation: slideUp 300ms ease both; animation-delay: 300ms">
          <div class="stat-card-header">
            <span class="stat-card-label">Period Orders</span>
            <div class="stat-card-icon" style="color: #7C3AED;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
          </div>
          <div class="stat-card-value">${stats.period_total_orders}</div>
          <div class="stat-card-sub">
            <span style="color:var(--slate-500)">Primary:</span> <strong>${stats.period_primary_orders}</strong>
            <span style="color:var(--slate-300); margin:0 4px">|</span>
            <span style="color:var(--slate-500)">Associate:</span> <strong>${stats.period_associate_orders}</strong>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="mb-24" style="animation: slideUp 300ms ease both; animation-delay: 320ms">
        <div style="margin-bottom: 16px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #0F0F0F;">
            Quick Actions
          </h2>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
          <button id="qa-log-today" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #2563EB; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">Log Today's Data</span>
          </button>
          <button id="qa-add-rider" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #16A34A; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">Add New Rider</span>
          </button>
          <button id="qa-view-payroll" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #7C3AED; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">View Payroll</span>
          </button>
          <button id="qa-monthly-report" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #DB2777; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">Monthly PDF</span>
          </button>
          <button id="qa-view-riders" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #F97316; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">All Riders</span>
          </button>
          <button id="qa-backup" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #6B7280; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">Download Backup</span>
          </button>
          <button id="qa-force-offline" style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; transition: all 0.2s;">
            <div style="color: #dc2626; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            </div>
            <span style="font-size: 13px; font-weight: 500; color: #374151;">Force Offline Rider</span>
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
      <div class="card section-card mt-24" style="animation: slideUp 300ms ease both; animation-delay: 800ms; border: 1px solid rgba(59,130,246,0.15); background: linear-gradient(135deg, #ffffff 0%, #f8faff 100%);">
        <div class="section-header">
          <h2 class="section-title" style="display:flex; align-items:center; gap:10px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>Communications Hub</span>
            <span style="background:linear-gradient(135deg,#25D366,#128C7E); color:white; font-size:10px; padding:3px 10px; border-radius:20px; font-weight:700; letter-spacing:0.5px;">WhatsApp Enabled</span>
          </h2>
          <span class="badge ${actionItems.length > 0 ? 'badge-danger' : 'badge-active'}" style="font-size:13px; padding:5px 14px;">${actionItems.length > 0 ? actionItems.length + ' Action(s) Required' : '✓ All Clear'}</span>
        </div>
        <div id="action-center-list" style="display:flex; flex-direction:column; gap:8px; max-height: 400px; overflow-y:auto; padding-right:4px;">
          ${actionItems.length === 0
            ? '<div class="empty-state" style="padding:40px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p style="margin-top:12px; font-size:15px; font-weight:600;">No pending actions — all systems healthy</p></div>'
            : actionItems.map((item, i) => `
              <div class="action-hub-item ${item.type}" style="display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:12px; background:${item.type === 'danger' ? 'var(--danger-50)' : 'var(--warning-50)'}; border:1px solid ${item.type === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)'}; animation: slideIn 200ms ease both; animation-delay:${i * 40}ms;">
                <div style="width:32px; height:32px; flex-shrink:0; border-radius:8px; background:${item.type === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)'}; display:flex; align-items:center; justify-content:center; color:${item.type === 'danger' ? 'var(--danger-600)' : 'var(--warning-600)'};">
                  <div style="width:18px; height:18px;">${item.icon}</div>
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-size:13px; font-weight:500; color:var(--text-primary); line-height:1.4;">${item.label}</div>
                  <span style="display:inline-block; margin-top:4px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:2px 8px; border-radius:4px; background:${item.type === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)'}; color:${item.type === 'danger' ? 'var(--danger-600)' : 'var(--warning-600)'}">${item.tag}</span>
                </div>
                ${item.phone
                  ? `<a href="https://wa.me/${item.phone}?text=${item.msg}" target="_blank" class="wa-action-btn" title="Send WhatsApp Message" style="flex-shrink:0; width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#25D366,#128C7E); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(37,211,102,0.3); transition:all var(--transition-fast); cursor:pointer;">
                      <svg viewBox="0 0 24 24" fill="white" style="width:20px; height:20px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    </a>`
                  : `<div style="flex-shrink:0; width:40px; height:40px; border-radius:50%; background:var(--gray-100); display:flex; align-items:center; justify-content:center; color:var(--gray-400); font-size:10px; font-weight:600;" title="No phone number on file">N/A</div>`
                }
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- Unsettled Rider Deductions -->
      <div class="card section-card mt-24" style="animation: slideUp 300ms ease both; animation-delay: 860ms;">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div>
            <h2 class="section-title" style="color:#0F0F0F; font-weight:700;">Unsettled Rider Deductions</h2>
            <div style="font-size:13px; color:#6B7280; margin-top:4px;">Amounts pending deduction from rider salaries</div>
          </div>
          ${(function() {
            const unsettled = expenses.filter(e => !e.deductionSettled && e.rider_id && (e.is_deductible === 1 || e.is_deductible === true))
            const total = unsettled.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
            return `<div style="font-size:16px; font-weight:700; color:#DC2626;">Total: SAR ${total.toLocaleString()}</div>`;
          })()}
        </div>
        <div class="table-container pt-8" style="overflow-x:auto;">
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
              html += `<tr style="background-color:#E0F2FE; border-bottom:2px solid #BAE6FD;">
                <td colspan="3" style="padding:10px 16px; font-weight:700; text-align:right; color:#0284C7; font-size:13px;">Subtotal for ${Utils.escapeHtml(group.name)}:</td>
                <td colspan="2" style="padding:10px 16px; font-weight:700; color:#0284C7; font-size:14px;">SR ${group.total.toLocaleString()}</td>
              </tr>`;
            });

            html += `</tbody></table>
              <div style="display:flex; gap:16px; margin-top:20px; padding-top:16px; border-top:1px solid #E5E7EB; flex-wrap:wrap;">
                <div style="background:#FEF2F2; border:1px solid #FECACA; padding:12px 16px; border-radius:8px; flex:1; min-width:180px;">
                  <div style="font-size:12px; color:#991B1B; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Total Unsettled</div>
                  <div style="font-size:18px; font-weight:800; color:#DC2626;">SAR ${totalUnsettled.toLocaleString()}</div>
                </div>
                <div style="background:#FFFBEB; border:1px solid #FDE68A; padding:12px 16px; border-radius:8px; flex:1; min-width:180px;">
                  <div style="font-size:12px; color:#B45309; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Riders w/ Pending Deductions</div>
                  <div style="font-size:18px; font-weight:800; color:#D97706;">${ridersCount}</div>
                </div>
                <div style="background:${oldestDays >= 31 ? '#FEF2F2' : '#F3F4F6'}; border:1px solid ${oldestDays >= 31 ? '#FECACA' : '#E5E7EB'}; padding:12px 16px; border-radius:8px; flex:1; min-width:180px;">
                  <div style="font-size:12px; color:${oldestDays >= 31 ? '#991B1B' : '#4B5563'}; font-weight:600; text-transform:uppercase; margin-bottom:4px;">Oldest Unresolved</div>
                  <div style="font-size:18px; font-weight:800; color:${oldestDays >= 31 ? '#DC2626' : '#111827'};">${oldestDays} days ago</div>
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
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; animation: fadeIn 500ms ease both;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; margin-top:2px;">
            ${icon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:bold; color:#0F0F0F; margin-bottom:4px;">
              ${greeting}, Abdullah
            </div>
            <div style="font-size:14px; color:#6B7280; line-height:1.6;">
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
    const activeRiders = riders.filter(r => r.status === 'active');
    let totalRiders = activeRiders.length;
    let authorizedCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;
    let missingCount = 0;

    activeRiders.forEach(r => {
      const riderBike = r.bike_id ? bikes.find(b => String(b.id) === String(r.bike_id)) : null;
      if (!r.bike_id || !riderBike) {
        missingCount++;
      } else {
        if (!riderBike.istimara_expiry) {
          missingCount++;
        } else {
          const days = Utils.daysUntil(riderBike.istimara_expiry);
          if (days < 0) {
            expiredCount++;
          } else if (days <= 30) {
            expiringSoonCount++;
          } else {
            authorizedCount++;
          }
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

    return `
      <div class="card section-card mt-24" style="margin-bottom: 24px; animation: slideUp 300ms ease both; animation-delay: 100ms; border: 1px solid var(--border-light);">
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" id="bike-auth-toggle">
          <h2 class="section-title" style="display:flex; align-items:center; gap:10px; margin:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:var(--primary-500);"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8a2 2 0 0 0-2 2v7.5"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
            <span>Rider Bike Authorizations & Expiries</span>
          </h2>
          <div style="display:flex; align-items:center; gap:12px;">
            <span class="badge" id="bike-auth-summary-badge" style="font-size:12px; font-weight:600; padding:3px 10px; ${badgeColor}">${summaryBadgeText}</span>
            <svg id="bike-auth-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px; height:18px; transition: transform 0.2s; transform: ${this.bikeAuthCollapsed ? 'rotate(-90deg)' : 'none'};"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        
        <div id="bike-auth-content-panel" style="display: ${this.bikeAuthCollapsed ? 'none' : 'block'}; padding-top: 16px;">
          <!-- Internal Grid for Stats -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:12px 14px; border-radius:10px; border-left: 4px solid var(--primary-500);">
              <div style="font-size:11px; color:var(--gray-500); font-weight:600; text-transform:uppercase;">Total Riders</div>
              <div style="font-size:20px; font-weight:800; color:var(--text-primary); margin-top:4px;" id="bike-stat-total">${totalRiders}</div>
            </div>
            <div style="background:#F0FDF4; border:1px solid #DCFCE7; padding:12px 14px; border-radius:10px; border-left: 4px solid var(--success-500);">
              <div style="font-size:11px; color:#15803D; font-weight:600; text-transform:uppercase;">Authorized</div>
              <div style="font-size:20px; font-weight:800; color:#166534; margin-top:4px;" id="bike-stat-authorized">${authorizedCount}</div>
            </div>
            <div style="background:#FFFDF5; border:1px solid #FEF3C7; padding:12px 14px; border-radius:10px; border-left: 4px solid var(--warning-500);">
              <div style="font-size:11px; color:#B45309; font-weight:600; text-transform:uppercase;">Expiring Soon</div>
              <div style="font-size:20px; font-weight:800; color:#92400E; margin-top:4px;" id="bike-stat-warning">${expiringSoonCount}</div>
            </div>
            <div style="background:#FEF2F2; border:1px solid #FEE2E2; padding:12px 14px; border-radius:10px; border-left: 4px solid var(--danger-500);">
              <div style="font-size:11px; color:#B91C1C; font-weight:600; text-transform:uppercase;">Expired</div>
              <div style="font-size:20px; font-weight:800; color:#991B1B; margin-top:4px;" id="bike-stat-expired">${expiredCount}</div>
            </div>
            <div style="background:#FFFBEB; border:1px solid #FDE68A; padding:12px 14px; border-radius:10px; border-left: 4px solid var(--orange-500);">
              <div style="font-size:11px; color:#C2410C; font-weight:600; text-transform:uppercase;">Missing Bike</div>
              <div style="font-size:20px; font-weight:800; color:#9A3412; margin-top:4px;" id="bike-stat-missing">${missingCount}</div>
            </div>
          </div>
          
          <!-- Search / Filter Bar -->
          <div style="margin-bottom: 14px; display:flex; gap:12px; align-items:center;">
            <div style="position:relative; flex:1;">
              <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--gray-400); width:16px; height:16px; display:flex; align-items:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" id="bike-search" placeholder="Search rider name, plate number, status, or type..." style="width:100%; padding:9px 12px 9px 36px; border:1px solid var(--border-medium); border-radius:10px; font-size:13px; outline:none; transition:border-color 0.15s;" value="${Utils.escapeHtml(this.bikeSearchQuery || '')}">
            </div>
          </div>
          
          <!-- Table Container -->
          <div class="table-container" style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 8px;">
            <table class="data-table" style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
              <thead style="position: sticky; top: 0; background: #F8FAFC; z-index: 1; border-bottom: 2px solid var(--border-light); box-shadow: 0 1px 0 var(--border-light);">
                <tr>
                  <th style="padding: 10px 12px;">Rider Name</th>
                  <th style="padding: 10px 12px;">Rider Type</th>
                  <th style="padding: 10px 12px;">Assigned Bike</th>
                  <th style="padding: 10px 12px;">Authorization Status</th>
                  <th style="padding: 10px 12px;">Expiry Date</th>
                  <th style="padding: 10px 12px;">Days Remaining</th>
                  <th style="padding: 10px 12px; text-align:center;">Alert</th>
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
    const activeRiders = riders.filter(r => r.status === 'active');
    const query = (searchQuery || '').toLowerCase().trim();
    
    return activeRiders.map(r => {
      const riderBike = r.bike_id ? bikes.find(b => String(b.id) === String(r.bike_id)) : null;
      
      let bikePlate = '';
      let bikeModel = '';
      let bikeInfo = '—';
      let expiryText = '—';
      let remainingText = '—';
      let statusBadge = '';
      let statusText = '';
      let rowStatusVal = '';
      
      if (!r.bike_id || !riderBike) {
        rowStatusVal = 'missing';
        if (r.rider_type === 'company') {
          statusBadge = `<span class="badge" style="background:#FDE8E8; color:#9B1C1C; border:1.5px solid #F87171; font-weight:700; font-size:11px;">Missing Bike (Critical)</span>`;
          statusText = 'Missing Bike (Critical)';
        } else {
          statusBadge = `<span class="badge" style="background:#F0F9FF; color:#0369A1; border:1.5px solid #7DD3FC; font-weight:600; font-size:11px;">Missing Bike</span>`;
          statusText = 'Missing Bike';
        }
      } else {
        bikePlate = riderBike.plate_number || 'No Plate';
        bikeModel = riderBike.model || 'Unknown';
        bikeInfo = `<strong>${Utils.escapeHtml(bikePlate)}</strong> <span style="color:var(--gray-500); font-size:12px;">(${Utils.escapeHtml(bikeModel)})</span>`;
        
        if (!riderBike.istimara_expiry) {
          rowStatusVal = 'unauthorized';
          statusBadge = `<span class="badge" style="background:#FDF2F2; color:#B91C1C; border:1.5px solid #F87171; font-weight:700; font-size:11px;">No Auth Date</span>`;
          statusText = 'No Auth Date';
        } else {
          const days = Utils.daysUntil(riderBike.istimara_expiry);
          expiryText = Utils.formatDateShort(riderBike.istimara_expiry);
          
          if (days < 0) {
            rowStatusVal = 'expired';
            const absDays = Math.abs(days);
            statusBadge = `<span class="badge" style="background:#FDE8E8; color:#9B1C1C; border:1.5px solid #F87171; font-weight:700; font-size:11px;">Expired</span>`;
            remainingText = `<span style="color:#DC2626; font-weight:700;">Expired ${absDays} day${absDays !== 1 ? 's' : ''} ago</span>`;
            statusText = 'Expired';
          } else if (days <= 30) {
            rowStatusVal = 'warning';
            statusBadge = `<span class="badge" style="background:#FEF3C7; color:#92400E; border:1.5px solid #FCD34D; font-weight:600; font-size:11px;">Expiring Soon</span>`;
            remainingText = `<span style="color:#D97706; font-weight:600;">${days} day${days !== 1 ? 's' : ''} left</span>`;
            statusText = 'Expiring Soon';
          } else {
            rowStatusVal = 'authorized';
            statusBadge = `<span class="badge" style="background:#DEF7EC; color:#03543F; border:1.5px solid #34D399; font-weight:600; font-size:11px;">Authorized</span>`;
            remainingText = `<span style="color:#16A34A; font-weight:600;">${days} day${days !== 1 ? 's' : ''} left</span>`;
            statusText = 'Authorized';
          }
        }
      }

      let actionHtml = '—';
      if (r.phone) {
        const cleanPhone = r.phone.replace(/[^0-9]/g, '');
        let msg = '';
        if (rowStatusVal === 'missing' && r.rider_type === 'company') {
          msg = `Dear ${r.name}, you do not have a bike assigned in the system. Please coordinate with the admin immediately. — Inspiring Roads Logistics`;
        } else if (rowStatusVal === 'expired') {
          const days = Math.abs(Utils.daysUntil(riderBike?.istimara_expiry));
          msg = `Dear ${r.name}, your bike ${bikePlate} authorization (Istimara) expired ${days} day(s) ago on ${expiryText}. Please coordinate renewal urgently. — Inspiring Roads Logistics`;
        } else if (rowStatusVal === 'warning') {
          const days = Utils.daysUntil(riderBike?.istimara_expiry);
          msg = `Dear ${r.name}, your bike ${bikePlate} authorization (Istimara) expires in ${days} day(s) on ${expiryText}. Please arrange for renewal. — Inspiring Roads Logistics`;
        }
        
        if (msg) {
          const encMsg = encodeURIComponent(msg);
          actionHtml = `
            <a href="https://wa.me/${cleanPhone}?text=${encMsg}" target="_blank" class="wa-action-btn" title="Send WhatsApp Warning" style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:linear-gradient(135deg,#25D366,#128C7E); color:white; box-shadow:0 1px 4px rgba(37,211,102,0.25);">
              <svg viewBox="0 0 24 24" fill="white" style="width:12px; height:12px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          `;
        }
      }

      const isVisible = !query || 
                        r.name.toLowerCase().includes(query) ||
                        bikePlate.toLowerCase().includes(query) ||
                        bikeModel.toLowerCase().includes(query) ||
                        statusText.toLowerCase().includes(query) ||
                        r.rider_type.toLowerCase().includes(query);

      return `
        <tr data-rider-name="${Utils.escapeHtml(r.name)}" 
            data-plate-number="${Utils.escapeHtml(bikePlate)}" 
            data-bike-model="${Utils.escapeHtml(bikeModel)}" 
            data-status="${Utils.escapeHtml(statusText)}" 
            data-rider-type="${Utils.escapeHtml(r.rider_type)}" 
            style="border-bottom: 1px solid var(--border-light); ${isVisible ? '' : 'display:none;'}">
          <td style="padding: 10px 12px; font-weight: 600; color: var(--text-primary);">${Utils.escapeHtml(r.name)}</td>
          <td style="padding: 10px 12px; text-transform: capitalize; color: var(--text-secondary);">${Utils.escapeHtml(r.rider_type)}</td>
          <td style="padding: 10px 12px; color: var(--text-primary);">${bikeInfo}</td>
          <td style="padding: 10px 12px;">${statusBadge}</td>
          <td style="padding: 10px 12px; color: var(--text-secondary);">${expiryText}</td>
          <td style="padding: 10px 12px;">${remainingText}</td>
          <td style="padding: 10px 12px; text-align:center;">${actionHtml}</td>
        </tr>
      `;
    }).join('');
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
    const query = e.target.value.toLowerCase().trim();
    this.bikeSearchQuery = query;
    
    const rows = document.querySelectorAll('#bike-auth-table-body tr');
    rows.forEach(row => {
      const riderName = row.getAttribute('data-rider-name')?.toLowerCase() || '';
      const plateNumber = row.getAttribute('data-plate-number')?.toLowerCase() || '';
      const bikeModel = row.getAttribute('data-bike-model')?.toLowerCase() || '';
      const status = row.getAttribute('data-status')?.toLowerCase() || '';
      const riderType = row.getAttribute('data-rider-type')?.toLowerCase() || '';
      
      const matches = riderName.includes(query) || 
                      plateNumber.includes(query) || 
                      bikeModel.includes(query) ||
                      status.includes(query) ||
                      riderType.includes(query);
                      
      if (matches) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }
};
