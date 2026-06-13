// ========================================
//  FLEET MANAGEMENT — Premium Redesign
//  Bikes Tracking & Fleet Command Center
// ========================================

const Bikes = {
  bikes: [],
  searchQuery: '',
  currentFilter: 'all',
  currentView: 'grid',   // 'grid' | 'table'
  currentSort: 'plate',  // 'plate' | 'status' | 'expiry' | 'rider'
  selectedBikes: new Set(),

  // ── Lifecycle ──
  async render() {
    const container = document.getElementById('page-fleet');
    container.innerHTML = '<div class="skeleton" style="height:400px"></div>';

    try {
      this.bikes = await API.getBikes();
      container.innerHTML = this.buildHTML();
      this.attachEvents();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load fleet data: ${err.message}</p></div>`;
    }
  },

  // ── Process bike data with computed fields ──
  processBikes() {
    return this.bikes.map(b => {
      const daysUntilExpiry = Utils.daysUntil(b.insurance_expiry);
      const daysUntilAuthExpiry = Utils.daysUntil(b.authorization_expiry);

      let worstExpiry = Infinity;
      if (b.insurance_expiry || b.authorization_expiry) {
        if (b.insurance_expiry && b.authorization_expiry) {
          worstExpiry = Math.min(daysUntilExpiry, daysUntilAuthExpiry);
        } else if (b.insurance_expiry) {
          worstExpiry = daysUntilExpiry;
        } else {
          worstExpiry = daysUntilAuthExpiry;
        }
      }

      let healthStatus = 'ok';
      if (worstExpiry < 0) healthStatus = 'danger';
      else if (worstExpiry <= 30) healthStatus = 'warn';

      return { ...b, daysUntilExpiry, daysUntilAuthExpiry, worstExpiry, healthStatus };
    });
  },

  // ── Filter & sort ──
  filterAndSort(bikesWithStatus) {
    let filtered = [...bikesWithStatus];

    // Filter
    if (this.currentFilter === 'active') filtered = filtered.filter(b => b.status === 'active');
    if (this.currentFilter === 'maintenance') filtered = filtered.filter(b => b.status === 'maintenance');
    if (this.currentFilter === 'retired') filtered = filtered.filter(b => b.status === 'retired');
    if (this.currentFilter === 'expiring') filtered = filtered.filter(b => b.worstExpiry <= 30);
    if (this.currentFilter === 'unassigned') filtered = filtered.filter(b => !b.assigned_rider_id);
    if (this.currentFilter === 'assigned') filtered = filtered.filter(b => !!b.assigned_rider_id);

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(b =>
        (b.plate_number && b.plate_number.toLowerCase().includes(q)) ||
        (b.model && b.model.toLowerCase().includes(q)) ||
        (b.assigned_rider_name && b.assigned_rider_name.toLowerCase().includes(q))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (this.currentSort) {
        case 'plate': return (a.plate_number || '').localeCompare(b.plate_number || '');
        case 'status': return (a.status || '').localeCompare(b.status || '');
        case 'expiry': return (a.worstExpiry === Infinity ? 99999 : a.worstExpiry) - (b.worstExpiry === Infinity ? 99999 : b.worstExpiry);
        case 'rider': return (a.assigned_rider_name || 'zzz').localeCompare(b.assigned_rider_name || 'zzz');
        default: return 0;
      }
    });

    return filtered;
  },

  // ── Count helpers ──
  getCounts(all) {
    return {
      total: this.bikes.length,
      active: this.bikes.filter(b => b.status === 'active').length,
      maintenance: this.bikes.filter(b => b.status === 'maintenance').length,
      retired: this.bikes.filter(b => b.status === 'retired').length,
      assigned: this.bikes.filter(b => !!b.assigned_rider_id).length,
      unassigned: this.bikes.filter(b => !b.assigned_rider_id).length,
      expiring: all.filter(b => b.worstExpiry <= 30).length,
      expired: all.filter(b => b.worstExpiry < 0).length,
    };
  },

  // ═══════════════════════════════════════════
  //  MAIN HTML BUILDER
  // ═══════════════════════════════════════════
  buildHTML() {
    const allProcessed = this.processBikes();
    const filtered = this.filterAndSort(allProcessed);
    const c = this.getCounts(allProcessed);
    const utilPct = c.total > 0 ? Math.round((c.assigned / c.total) * 100) : 0;

    return `
      ${this.buildAlertBanner(allProcessed, c)}
      ${this.buildStatsRow(c, utilPct)}
      ${this.buildToolbar(c)}
      <div id="fleet-content" class="mt-24">
        ${this.currentView === 'grid' ? this.buildCardGrid(filtered) : this.buildTable(filtered)}
      </div>
      ${this.buildBulkBar()}
    `;
  },

  // ── Alert Banner ──
  buildAlertBanner(all, c) {
    const expired = all.filter(b => b.worstExpiry < 0);
    const expiringSoon = all.filter(b => b.worstExpiry >= 0 && b.worstExpiry <= 30);

    if (expired.length === 0 && expiringSoon.length === 0) return '';

    const messages = [];
    if (expired.length > 0) messages.push(`<strong>${expired.length} bike${expired.length > 1 ? 's have' : ' has'} expired documents</strong>`);
    if (expiringSoon.length > 0) messages.push(`${expiringSoon.length} bike${expiringSoon.length > 1 ? 's' : ''} expiring within 30 days`);

    return `
      <div class="fleet-alert-banner" id="fleet-alert">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <div style="width:36px; height:36px; border-radius:10px; background:rgba(225,29,72,0.1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div style="font-size:14px; color:#1e293b;">${messages.join(' · ')}</div>
            <div style="font-size:12px; color:#64748b; margin-top:2px;">Review and update documentation to stay compliant.</div>
          </div>
        </div>
        <button class="fleet-filter-chip active" data-filter="expiring" style="font-size:12px; height:32px; flex-shrink:0;">
          View All
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;
  },

  // ── Stats Row ──
  buildStatsRow(c, utilPct) {
    const utilColor = utilPct >= 80 ? '#059669' : utilPct >= 50 ? '#d97706' : '#e11d48';
    const circumference = 2 * Math.PI * 24;
    const offset = circumference - (utilPct / 100) * circumference;

    return `
      <div class="fleet-stats-grid">
        <!-- Total Fleet -->
        <div class="fleet-stat-card">
          <div style="border-top: 3px solid var(--primary-500); border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value">${c.total}</div>
              <div class="fleet-stat-label">Total Fleet</div>
            </div>
            <div class="fleet-stat-icon" style="background:var(--primary-50); color:var(--primary-600);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
          </div>
        </div>

        <!-- Active -->
        <div class="fleet-stat-card">
          <div style="border-top: 3px solid var(--success-500); border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value">${c.active}</div>
              <div class="fleet-stat-label">Active on Road</div>
            </div>
            <div class="fleet-stat-icon" style="background:var(--success-50); color:var(--success-600);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
        </div>

        <!-- Maintenance -->
        <div class="fleet-stat-card">
          <div style="border-top: 3px solid var(--warning-500); border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value">${c.maintenance}</div>
              <div class="fleet-stat-label">Maintenance</div>
            </div>
            <div class="fleet-stat-icon" style="background:var(--warning-50); color:var(--warning-600);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
          </div>
        </div>

        <!-- Unassigned -->
        <div class="fleet-stat-card ${c.unassigned > 0 ? 'fleet-stat-glow' : ''}">
          <div style="border-top: 3px solid var(--gray-400); border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value">${c.unassigned}</div>
              <div class="fleet-stat-label">Unassigned</div>
            </div>
            <div class="fleet-stat-icon" style="background:var(--gray-100); color:var(--gray-500);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
            </div>
          </div>
        </div>

        <!-- Docs Expiring -->
        <div class="fleet-stat-card ${c.expiring > 0 ? 'fleet-stat-pulse-danger' : ''}">
          <div style="border-top: 3px solid ${c.expiring > 0 ? 'var(--danger-500)' : 'var(--gray-300)'}; border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value" ${c.expiring > 0 ? 'style="color:var(--danger-600);"' : ''}>${c.expiring}</div>
              <div class="fleet-stat-label">Docs Expiring</div>
              ${c.expired > 0 ? `<div class="fleet-stat-sub" style="color:var(--danger-500);">${c.expired} already expired</div>` : ''}
            </div>
            <div class="fleet-stat-icon" style="background:${c.expiring > 0 ? 'var(--danger-50)' : 'var(--gray-100)'}; color:${c.expiring > 0 ? 'var(--danger-500)' : 'var(--gray-500)'};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
          </div>
        </div>

        <!-- Utilization -->
        <div class="fleet-stat-card">
          <div style="border-top: 3px solid ${utilColor}; border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value" style="color:${utilColor};">${utilPct}%</div>
              <div class="fleet-stat-label">Utilization</div>
              <div class="fleet-stat-sub">${c.assigned} of ${c.total} assigned</div>
            </div>
            <div class="fleet-util-ring">
              <svg viewBox="0 0 56 56" width="56" height="56">
                <circle cx="28" cy="28" r="24" stroke="#e2e8f0" stroke-width="4" fill="none"/>
                <circle cx="28" cy="28" r="24" stroke="${utilColor}" stroke-width="4" fill="none"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                  stroke-linecap="round" transform="rotate(-90 28 28)"
                  style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Toolbar ──
  buildToolbar(c) {
    const filters = [
      { key: 'all', label: 'All', count: c.total },
      { key: 'active', label: 'Active', count: c.active },
      { key: 'maintenance', label: 'Maintenance', count: c.maintenance },
      { key: 'assigned', label: 'Assigned', count: c.assigned },
      { key: 'unassigned', label: 'Unassigned', count: c.unassigned },
      { key: 'expiring', label: 'Expiring', count: c.expiring },
    ];

    return `
      <div class="fleet-toolbar mt-24">
        <div class="fleet-toolbar-left">
          <div class="search-bar" style="max-width:280px;">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="fleet-search" class="search-input" placeholder="Search plate, model, or rider..." value="${this.searchQuery}">
          </div>

          <div class="fleet-filters-row">
            ${filters.map(f => `
              <button class="fleet-filter-chip ${this.currentFilter === f.key ? 'active' : ''}" data-filter="${f.key}">
                ${f.label}
                <span class="fleet-filter-badge">${f.count}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="fleet-toolbar-right">
          <select id="fleet-sort" class="fleet-sort-select" title="Sort by">
            <option value="plate" ${this.currentSort === 'plate' ? 'selected' : ''}>Sort: Plate</option>
            <option value="status" ${this.currentSort === 'status' ? 'selected' : ''}>Sort: Status</option>
            <option value="expiry" ${this.currentSort === 'expiry' ? 'selected' : ''}>Sort: Expiry</option>
            <option value="rider" ${this.currentSort === 'rider' ? 'selected' : ''}>Sort: Rider</option>
          </select>

          <div class="fleet-view-toggle">
            <button class="fleet-view-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button class="fleet-view-btn ${this.currentView === 'table' ? 'active' : ''}" data-view="table" title="Table View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>

          <button class="btn btn-outline btn-sm" id="fleet-export-csv" title="Export CSV" style="height:36px; gap:6px; display:flex; align-items:center; padding: 0 12px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>

          ${App.isViewer() ? '' : `
          <button class="btn btn-primary btn-sm" id="btn-add-bike" style="height:36px; gap:6px; display:flex; align-items:center; padding: 0 14px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Bike
          </button>
          `}
        </div>
      </div>
    `;
  },

  // ═══════════════════════════════════════════
  //  CARD GRID VIEW
  // ═══════════════════════════════════════════
  buildCardGrid(bikes) {
    if (bikes.length === 0) return this.buildEmptyState();

    return `
      <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); align-items: start;">
        ${bikes.map((bike, i) => this.buildBikeCard(bike, i)).join('')}
      </div>
    `;
  },

  buildBikeCard(bike, index) {
    const statusInfo = this.getStatusInfo(bike.status);
    const authInfo = this.getAuthInfo(bike);
    const expiryBarPct = this.getExpiryBarPct(bike.worstExpiry);
    const expiryBarColor = bike.healthStatus === 'danger' ? '#ef4444' : bike.healthStatus === 'warn' ? '#f59e0b' : '#10b981';

    const assignedHtml = bike.assigned_rider_name
      ? `<div style="display:flex; align-items:center; gap:8px;">
           <div style="width:24px; height:24px; border-radius:6px; background:var(--primary-50); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">${Utils.getInitials(bike.assigned_rider_name)}</div>
           <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${Utils.escapeHtml(bike.assigned_rider_name)}</span>
         </div>`
      : `<span style="font-size:13px; color:var(--text-tertiary); font-style:italic;">Unassigned</span>`;

    return `
      <div class="fleet-card health-${bike.healthStatus}" style="animation-delay: ${index * 40}ms;" data-id="${bike.id}">
        <div class="fleet-card-gradient"></div>
        <div class="fleet-card-body">
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <div>
              <div class="fleet-card-plate">${Utils.escapeHtml(bike.plate_number)}</div>
              ${bike.model ? `<div style="font-size:12px; color:var(--text-tertiary); margin-top:2px;">${Utils.escapeHtml(bike.model)}</div>` : ''}
            </div>
            <div class="fleet-card-badges">
              <span class="fleet-badge ${statusInfo.badgeClass}">${statusInfo.label}</span>
              <span class="fleet-badge ${authInfo.badgeClass}">${authInfo.label}</span>
            </div>
          </div>

          <!-- Data Grid -->
          <div class="fleet-card-grid">
            <div>
              <div class="fleet-card-field-label">Authorization</div>
              <div class="fleet-card-field-value ${bike.daysUntilAuthExpiry <= 30 ? 'fleet-text-danger' : ''}">${bike.authorization_expiry ? Utils.formatDateShort(bike.authorization_expiry) : '—'}</div>
            </div>
            <div>
              <div class="fleet-card-field-label">Insurance</div>
              <div class="fleet-card-field-value ${bike.daysUntilExpiry <= 30 ? 'fleet-text-danger' : ''}">${bike.insurance_expiry ? Utils.formatDateShort(bike.insurance_expiry) : '—'}</div>
            </div>
            <div style="grid-column: 1 / -1;">
              <div class="fleet-card-field-label">Assigned To</div>
              ${assignedHtml}
            </div>
          </div>

          <!-- Expiry Bar -->
          ${(bike.authorization_expiry || bike.insurance_expiry) ? `
          <div class="fleet-card-expiry-bar" title="${bike.worstExpiry < 0 ? 'Expired!' : bike.worstExpiry + ' days remaining'}">
            <div class="fill" style="width:${expiryBarPct}%; background:${expiryBarColor};"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px;">
            <span style="font-size:10px; color:var(--text-tertiary);">Expiry Status</span>
            <span style="font-size:10px; font-weight:600; color:${expiryBarColor};">${bike.worstExpiry < 0 ? 'EXPIRED' : bike.worstExpiry + ' days left'}</span>
          </div>
          ` : ''}

          <!-- Actions -->
          ${App.isViewer() ? '' : `
          <div class="fleet-card-actions">
            ${bike.assigned_rider_id ? `
              <button class="fleet-action-btn fleet-action-danger btn-unassign-bike" data-id="${bike.id}" title="Unassign ${bike.assigned_rider_name}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                Unassign
              </button>
            ` : `
              <button class="fleet-action-btn fleet-action-primary btn-assign-bike" data-id="${bike.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Assign Rider
              </button>
            `}
            <button class="fleet-action-btn fleet-action-secondary btn-edit-bike" data-id="${bike.id}" title="Edit Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          `}
        </div>
      </div>
    `;
  },

  // ═══════════════════════════════════════════
  //  TABLE VIEW
  // ═══════════════════════════════════════════
  buildTable(bikes) {
    if (bikes.length === 0) return this.buildEmptyState();

    return `
      <div class="fleet-table-wrap">
        <table class="fleet-table">
          <thead>
            <tr>
              <th>Plate Number</th>
              <th>Model</th>
              <th>Status</th>
              <th>Authorization</th>
              <th>Auth Expiry</th>
              <th>Insurance Expiry</th>
              <th>Assigned Rider</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            ${bikes.map((bike, i) => {
              const statusInfo = this.getStatusInfo(bike.status);
              const authInfo = this.getAuthInfo(bike);
              const healthIcon = bike.healthStatus === 'danger'
                ? '<span class="health-dot danger"></span> Expired'
                : bike.healthStatus === 'warn'
                ? '<span class="health-dot warning"></span> Expiring'
                : '<span class="health-dot success"></span> Valid';

              return `
                <tr class="fleet-table-row" data-id="${bike.id}" style="animation-delay:${i * 20}ms;">
                  <td><strong style="font-family:'JetBrains Mono','Fira Code',monospace; font-size:13px; letter-spacing:0.3px;">${Utils.escapeHtml(bike.plate_number)}</strong></td>
                  <td style="color:var(--text-secondary);">${Utils.escapeHtml(bike.model || '—')}</td>
                  <td><span class="fleet-badge ${statusInfo.badgeClass}">${statusInfo.label}</span></td>
                  <td><span class="fleet-badge ${authInfo.badgeClass}">${authInfo.label}</span></td>
                  <td style="${bike.daysUntilAuthExpiry <= 30 ? 'color:var(--danger-600); font-weight:600;' : ''}">${bike.authorization_expiry ? Utils.formatDateShort(bike.authorization_expiry) : '—'}</td>
                  <td style="${bike.daysUntilExpiry <= 30 ? 'color:var(--danger-600); font-weight:600;' : ''}">${bike.insurance_expiry ? Utils.formatDateShort(bike.insurance_expiry) : '—'}</td>
                  <td>${bike.assigned_rider_name ? Utils.escapeHtml(bike.assigned_rider_name) : '<span style="color:var(--text-tertiary); font-style:italic;">Unassigned</span>'}</td>
                  <td>${healthIcon}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ── Empty State ──
  buildEmptyState() {
    if (this.bikes.length === 0) {
      return `
        <div class="empty-state" style="padding:80px 20px;">
          <div style="width:72px; height:72px; border-radius:16px; background:var(--primary-50); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" stroke-width="1.5" width="36" height="36"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
          </div>
          <p style="font-size:16px; font-weight:600; color:var(--text-primary); margin-bottom:8px;">No bikes in your fleet yet</p>
          <p style="color:var(--text-secondary);">Click "Add Bike" to start tracking your fleet.</p>
        </div>
      `;
    }
    return '<div class="empty-state" style="padding:40px 20px;"><p>No bikes match your search or filters.</p></div>';
  },

  // ── Bulk Actions Bar ──
  buildBulkBar() {
    return `<div class="fleet-bulk-bar" id="fleet-bulk-bar" style="display:none;">
      <span id="fleet-bulk-count">0 selected</span>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-sm" id="fleet-bulk-active" style="background:var(--success-600); color:#fff; border:none; height:32px; padding:0 14px; font-size:12px;">Set Active</button>
        <button class="btn btn-sm" id="fleet-bulk-maintenance" style="background:var(--warning-600); color:#fff; border:none; height:32px; padding:0 14px; font-size:12px;">Set Maintenance</button>
        <button class="btn btn-sm" id="fleet-bulk-cancel" style="background:transparent; color:var(--gray-300); border:1px solid var(--gray-600); height:32px; padding:0 14px; font-size:12px;">Cancel</button>
      </div>
    </div>`;
  },

  // ═══════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════
  getStatusInfo(status) {
    switch(status) {
      case 'active': return { label: 'Active', badgeClass: 'fleet-badge-green' };
      case 'maintenance': return { label: 'Maintenance', badgeClass: 'fleet-badge-amber' };
      case 'retired': return { label: 'Retired', badgeClass: 'fleet-badge-gray' };
      default: return { label: status || 'Unknown', badgeClass: 'fleet-badge-gray' };
    }
  },

  getAuthInfo(bike) {
    const days = Utils.daysUntil(bike.authorization_expiry);
    const hasAuth = !!bike.authorization_expiry;
    if (hasAuth && days >= 0) return { label: 'Authorized', badgeClass: 'fleet-badge-green' };
    if (hasAuth && days < 0) return { label: 'Auth Expired', badgeClass: 'fleet-badge-red' };
    return { label: 'Pending', badgeClass: 'fleet-badge-amber' };
  },

  getExpiryBarPct(days) {
    if (days === Infinity) return 100;
    if (days < 0) return 3; // Show a sliver for expired
    if (days > 365) return 100;
    return Math.max(3, Math.round((days / 365) * 100));
  },

  // ═══════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════
  attachEvents() {
    // Search
    document.getElementById('fleet-search')?.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value;
      this.softRender();
    }, 200));

    // Filters
    document.querySelectorAll('#page-fleet .fleet-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentFilter = chip.dataset.filter;
        this.softRender();
      });
    });

    // Sort
    document.getElementById('fleet-sort')?.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.softRender();
    });

    // View toggle
    document.querySelectorAll('.fleet-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.softRender();
      });
    });

    // Add Bike
    document.getElementById('btn-add-bike')?.addEventListener('click', () => this.openBikeForm(null));

    // Card clicks (Edit)
    document.querySelectorAll('.fleet-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // Don't open edit if clicking a button
        const bike = this.bikes.find(b => b.id === parseInt(card.dataset.id));
        if (bike) this.openBikeForm(bike);
      });
    });

    // Edit button clicks
    document.querySelectorAll('.btn-edit-bike').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bike = this.bikes.find(b => b.id === parseInt(btn.dataset.id));
        if (bike) this.openBikeForm(bike);
      });
    });

    // Table row clicks
    document.querySelectorAll('.fleet-table-row').forEach(row => {
      row.addEventListener('click', () => {
        const bike = this.bikes.find(b => b.id === parseInt(row.dataset.id));
        if (bike) this.openBikeForm(bike);
      });
    });

    // Assign Rider clicks
    document.querySelectorAll('.btn-assign-bike').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bikeId = parseInt(btn.dataset.id);
        const bike = this.bikes.find(b => b.id === bikeId);
        if (bike) this.openAssignDialog(bike);
      });
    });

    // Unassign Rider clicks
    document.querySelectorAll('.btn-unassign-bike').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bikeId = parseInt(btn.dataset.id);
        const bike = this.bikes.find(b => b.id === bikeId);
        const confirmed = await Utils.confirm(
          `Unassign bike ${bike.plate_number} from ${bike.assigned_rider_name}?`,
          'Unassign Bike',
          'Unassign',
          'Cancel',
          true
        );
        if (confirmed) {
          try {
            Utils.showLoading('Unassigning bike');
            await API.unassignBike(bikeId);
            Utils.showToast('Bike unassigned successfully', 'success');
            this.render();
          } catch (err) {
            Utils.showToast(err.message, 'error');
          } finally {
            Utils.hideLoading();
          }
        }
      });
    });

    // Export CSV
    document.getElementById('fleet-export-csv')?.addEventListener('click', () => this.exportCSV());

    // Bulk action buttons
    document.getElementById('fleet-bulk-active')?.addEventListener('click', () => this.bulkUpdateStatus('active'));
    document.getElementById('fleet-bulk-maintenance')?.addEventListener('click', () => this.bulkUpdateStatus('maintenance'));
    document.getElementById('fleet-bulk-cancel')?.addEventListener('click', () => {
      this.selectedBikes.clear();
      this.updateBulkBar();
    });

    // Alert banner close
    document.getElementById('fleet-alert-close')?.addEventListener('click', () => {
      document.getElementById('fleet-alert')?.remove();
    });
  },

  // Soft re-render (only content area + toolbar)
  softRender() {
    const container = document.getElementById('page-fleet');
    container.innerHTML = this.buildHTML();
    this.attachEvents();
  },

  // ═══════════════════════════════════════════
  //  PREMIUM BIKE DETAIL / EDIT DIALOG
  // ═══════════════════════════════════════════
  openBikeForm(bike) {
    const isEdit = !!bike;
    const isViewer = App.isViewer();

    // Process computed fields for display
    let healthStatus = 'ok', worstExpiry = Infinity;
    if (isEdit) {
      const daysAuth = Utils.daysUntil(bike.authorization_expiry);
      const daysIns = Utils.daysUntil(bike.insurance_expiry);
      if (bike.authorization_expiry || bike.insurance_expiry) {
        worstExpiry = Math.min(
          bike.authorization_expiry ? daysAuth : Infinity,
          bike.insurance_expiry ? daysIns : Infinity
        );
      }
      if (worstExpiry < 0) healthStatus = 'danger';
      else if (worstExpiry <= 30) healthStatus = 'warn';
    }

    const healthColors = { ok: '#10b981', warn: '#f59e0b', danger: '#ef4444' };
    const healthLabels = { ok: 'All Documents Valid', warn: 'Expiring Soon', danger: 'Documents Expired' };
    const hc = healthColors[healthStatus];

    const html = `
      <div class="fleet-dialog">
        <!-- Header with gradient -->
        ${isEdit ? `
        <div class="fleet-dialog-header" style="background: linear-gradient(135deg, ${hc}15, ${hc}05); border: 1px solid ${hc}30; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="font-family:'JetBrains Mono','Fira Code',monospace; font-size:22px; font-weight:700; color:var(--text-primary); letter-spacing:1px;">${Utils.escapeHtml(bike.plate_number)}</div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <span class="fleet-badge ${this.getStatusInfo(bike.status).badgeClass}">${this.getStatusInfo(bike.status).label}</span>
                <span class="fleet-badge ${this.getAuthInfo(bike).badgeClass}">${this.getAuthInfo(bike).label}</span>
                ${bike.model ? `<span class="fleet-badge fleet-badge-gray">${Utils.escapeHtml(bike.model)}</span>` : ''}
              </div>
            </div>
            <div style="text-align:center;">
              <div style="width:48px; height:48px; border-radius:50%; border:3px solid ${hc}; display:flex; align-items:center; justify-content:center;">
                <span style="font-size:14px; font-weight:700; color:${hc};">${worstExpiry === Infinity ? '✓' : (worstExpiry < 0 ? '!' : worstExpiry)}</span>
              </div>
              <div style="font-size:10px; color:${hc}; font-weight:600; margin-top:4px;">${worstExpiry === Infinity ? 'NO DOCS' : (worstExpiry < 0 ? 'EXPIRED' : 'DAYS')}</div>
            </div>
          </div>
          ${bike.assigned_rider_name ? `
          <div style="margin-top:16px; padding-top:12px; border-top:1px solid ${hc}20; display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:8px; background:var(--primary-100); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;">${Utils.getInitials(bike.assigned_rider_name)}</div>
            <div>
              <div style="font-size:12px; color:var(--text-tertiary);">Assigned to</div>
              <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${Utils.escapeHtml(bike.assigned_rider_name)}</div>
            </div>
          </div>
          ` : `
          <div style="margin-top:16px; padding-top:12px; border-top:1px solid ${hc}20; display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:8px; background:var(--gray-100); color:var(--gray-400); display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <span style="font-size:13px; color:var(--text-tertiary); font-style:italic;">Not assigned to any rider</span>
          </div>
          `}
        </div>
        ` : ''}

        <!-- Form -->
        <form id="bike-form">
          <div class="fleet-dialog-section">
            <div class="fleet-dialog-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Bike Information
            </div>
            <div class="form-grid" style="gap:16px;">
              <div class="form-group">
                <label>Plate Number <span class="required">*</span></label>
                <input type="text" id="bf-plate" class="form-control" ${isViewer ? 'disabled' : ''} required value="${isEdit ? Utils.escapeHtml(bike.plate_number) : ''}" placeholder="e.g. AH 5246" style="font-family:'JetBrains Mono','Fira Code',monospace; letter-spacing:1px;">
              </div>
              <div class="form-group">
                <label>Bike Model</label>
                <input type="text" id="bf-model" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit ? Utils.escapeHtml(bike.model || '') : ''}" placeholder="e.g. Honda CG 125">
              </div>
              <div class="form-group">
                <label>Status</label>
                <select id="bf-status" class="form-select" ${isViewer ? 'disabled' : ''}>
                  <option value="active" ${isEdit && bike.status === 'active' ? 'selected' : ''}>Active (On Road)</option>
                  <option value="maintenance" ${isEdit && bike.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                  <option value="retired" ${isEdit && bike.status === 'retired' ? 'selected' : ''}>Retired / Sold</option>
                </select>
              </div>
            </div>
          </div>

          <div class="fleet-dialog-section" style="margin-top:16px;">
            <div class="fleet-dialog-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Documents & Expiry
            </div>
            <div class="form-grid" style="gap:16px;">
              <div class="form-group">
                <label>Authorization Expiry</label>
                <input type="date" id="bf-auth-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.authorization_expiry ? bike.authorization_expiry : ''}">
              </div>
              <div class="form-group">
                <label>Insurance Expiry</label>
                <input type="date" id="bf-ins-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.insurance_expiry ? bike.insurance_expiry : ''}">
              </div>
            </div>
          </div>

          <div class="fleet-dialog-section" style="margin-top:16px;">
            <div class="fleet-dialog-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Notes
            </div>
            <textarea id="bf-notes" class="form-control" ${isViewer ? 'disabled' : ''} rows="3" placeholder="Maintenance history, service dates, or any notes..." style="resize:vertical; min-height:60px;">${isEdit ? Utils.escapeHtml(bike.notes || '') : ''}</textarea>
          </div>

          <!-- Action Bar -->
          <div class="fleet-dialog-actions" style="margin-top:24px;">
            ${isEdit && !isViewer ? `
            <button type="button" class="btn" id="bf-delete" style="background:var(--danger-50); color:var(--danger-600); border:1px solid var(--danger-200); height:40px; padding:0 16px; font-size:13px; display:flex; align-items:center; gap:6px; margin-right:auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete
            </button>
            ` : '<div></div>'}
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()" style="height:40px; padding:0 20px; font-size:13px;">Cancel</button>
            ${isViewer ? '' : `
            <button type="submit" class="btn btn-primary" style="height:40px; padding:0 24px; font-size:13px; gap:6px; display:flex; align-items:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              ${isEdit ? 'Save Changes' : 'Register Bike'}
            </button>
            `}
          </div>
        </form>
      </div>
    `;

    Utils.openModal(isEdit ? `Edit — ${bike.plate_number}` : 'Register New Bike', html);

    // Form submit
    document.getElementById('bike-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (App.isViewer()) return;

      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span>Saving...</span>'; }

      const payload = {
        plate_number: document.getElementById('bf-plate').value.trim(),
        model: document.getElementById('bf-model').value.trim(),
        status: document.getElementById('bf-status').value,
        insurance_expiry: document.getElementById('bf-ins-expiry').value || null,
        authorization_expiry: document.getElementById('bf-auth-expiry').value || null,
        notes: document.getElementById('bf-notes').value.trim(),
      };

      try {
        Utils.showLoading('Saving bike');
        if (isEdit) {
          await API.updateBike(bike.id, payload);
          Utils.showToast('Bike updated successfully', 'success');
        } else {
          await API.createBike(payload);
          Utils.showToast('New bike registered', 'success');
        }
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = isEdit ? 'Save Changes' : 'Register Bike'; }
      }
    });

    // Delete
    if (isEdit && !isViewer) {
      document.getElementById('bf-delete')?.addEventListener('click', async () => {
        const confirmed = await Utils.confirm(
          `Permanently delete bike ${bike.plate_number}? This cannot be undone.`,
          'Delete Bike',
          'Delete Forever',
          'Cancel',
          true
        );
        if (confirmed) {
          try {
            Utils.showLoading('Deleting');
            await API.deleteBike(bike.id);
            Utils.showToast('Bike deleted', 'success');
            Utils.closeModal();
            this.render();
          } catch (err) {
            Utils.showToast(err.message, 'error');
          } finally {
            Utils.hideLoading();
          }
        }
      });
    }
  },

  // ═══════════════════════════════════════════
  //  PREMIUM ASSIGN RIDER DIALOG
  // ═══════════════════════════════════════════
  async openAssignDialog(bike) {
    try {
      Utils.showLoading('Loading riders');
      const activeRiders = await API.getRiders('active');
      const availableRiders = activeRiders.filter(r => !r.bike_id);
      Utils.hideLoading();

      if (availableRiders.length === 0) {
        Utils.alert('All active riders already have a bike assigned.', 'No Riders Available');
        return;
      }

      const html = `
        <div class="fleet-dialog" style="min-width:0;">
          <div style="padding:4px 0 16px; border-bottom:1px solid var(--border-light); margin-bottom:20px;">
            <p style="font-size:14px; color:var(--text-secondary); margin:0;">
              Assign <strong style="font-family:'JetBrains Mono','Fira Code',monospace; color:var(--text-primary);">${Utils.escapeHtml(bike.plate_number)}</strong> to a rider
            </p>
          </div>

          <!-- Search -->
          <div style="position:relative; margin-bottom:16px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" stroke-width="2" width="16" height="16" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="assign-search" class="form-control" placeholder="Search riders..." style="padding-left:36px; height:40px;">
          </div>

          <!-- Rider Cards Grid -->
          <div class="fleet-rider-picker" id="rider-picker-grid">
            ${availableRiders.map(r => `
              <div class="fleet-rider-option" data-rider-id="${r.id}" data-name="${Utils.escapeHtml(r.name).toLowerCase()}">
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="width:36px; height:36px; border-radius:10px; background:var(--primary-50); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0;">
                    ${r.profile_photo || r.photo_url
                      ? `<img src="${r.profile_photo || r.photo_url}" style="width:36px; height:36px; border-radius:10px; object-fit:cover;">`
                      : Utils.getInitials(r.name)}
                  </div>
                  <div style="flex:1; min-width:0;">
                    <div style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(r.name)}</div>
                    <div style="font-size:11px; color:var(--text-tertiary);">${r.noon_id || 'No ID'}</div>
                  </div>
                  <span class="fleet-badge ${(r.rider_type || '').toLowerCase() === 'company' ? 'fleet-badge-blue' : 'fleet-badge-amber'}" style="font-size:10px;">${r.rider_type || 'N/A'}</span>
                </div>
                <div class="fleet-rider-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
            `).join('')}
          </div>

          <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px; padding-top:16px; border-top:1px solid var(--border-light);">
            <button class="btn btn-outline" onclick="Utils.closeModal()" style="height:40px; padding:0 20px;">Cancel</button>
            <button id="btn-confirm-assign" class="btn btn-primary" disabled style="height:40px; padding:0 24px; gap:6px; display:flex; align-items:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              Confirm Assignment
            </button>
          </div>
        </div>
      `;

      Utils.openModal('Assign Rider', html);

      let selectedRiderId = null;

      // Rider card selection
      document.querySelectorAll('.fleet-rider-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.fleet-rider-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedRiderId = opt.dataset.riderId;
          document.getElementById('btn-confirm-assign').disabled = false;
        });
      });

      // Search within rider picker
      document.getElementById('assign-search')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.fleet-rider-option').forEach(opt => {
          const name = opt.dataset.name || '';
          opt.style.display = name.includes(q) ? '' : 'none';
        });
      });

      // Confirm
      document.getElementById('btn-confirm-assign')?.addEventListener('click', async () => {
        if (!selectedRiderId) return;
        try {
          Utils.showLoading('Assigning bike');
          await API.assignBike(bike.id, selectedRiderId);
          Utils.showToast('Bike assigned successfully', 'success');
          Utils.closeModal();
          this.render();
        } catch (err) {
          Utils.showToast(err.message, 'error');
        } finally {
          Utils.hideLoading();
        }
      });

    } catch (err) {
      Utils.hideLoading();
      Utils.showToast(err.message, 'error');
    }
  },

  // ═══════════════════════════════════════════
  //  BULK ACTIONS
  // ═══════════════════════════════════════════
  updateBulkBar() {
    const bar = document.getElementById('fleet-bulk-bar');
    const count = this.selectedBikes.size;
    if (bar) {
      bar.style.display = count > 0 ? 'flex' : 'none';
      document.getElementById('fleet-bulk-count').textContent = `${count} selected`;
    }
  },

  async bulkUpdateStatus(newStatus) {
    if (this.selectedBikes.size === 0) return;
    const label = newStatus === 'active' ? 'Active' : 'Maintenance';
    const confirmed = await Utils.confirm(
      `Change ${this.selectedBikes.size} bike(s) to "${label}"?`,
      'Bulk Status Update',
      `Set to ${label}`,
      'Cancel',
      false
    );
    if (!confirmed) return;

    try {
      Utils.showLoading(`Updating ${this.selectedBikes.size} bikes`);
      for (const bikeId of this.selectedBikes) {
        await API.updateBike(bikeId, { status: newStatus });
      }
      this.selectedBikes.clear();
      Utils.showToast(`${this.selectedBikes.size || 'All'} bikes updated to ${label}`, 'success');
      this.render();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ═══════════════════════════════════════════
  //  CSV EXPORT
  // ═══════════════════════════════════════════
  exportCSV() {
    const allProcessed = this.processBikes();
    const rows = [
      ['Plate Number', 'Model', 'Status', 'Authorization Expiry', 'Insurance Expiry', 'Assigned Rider', 'Health Status', 'Notes']
    ];

    allProcessed.forEach(b => {
      rows.push([
        b.plate_number || '',
        b.model || '',
        b.status || '',
        b.authorization_expiry || '',
        b.insurance_expiry || '',
        b.assigned_rider_name || 'Unassigned',
        b.healthStatus === 'danger' ? 'Expired' : b.healthStatus === 'warn' ? 'Expiring' : 'Valid',
        (b.notes || '').replace(/,/g, ';')
      ]);
    });

    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Fleet_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    Utils.showToast('Fleet data exported as CSV', 'success');
  }
};
