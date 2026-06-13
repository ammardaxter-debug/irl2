// ========================================
//  FLEET MANAGEMENT — Premium Redesign
//  Bikes Tracking & Fleet Command Center
// ========================================

const Bikes = {
  bikes: [],
  searchQuery: '',
  currentFilter: 'all',
  currentView: 'grid',      // 'grid' | 'table' | 'map'
  currentSort: 'plate',     // 'plate' | 'status' | 'expiry' | 'rider'
  selectedBikes: new Set(),
  _mapInstance: null,       // Map instance for Map tab
  _mapMarkers: {},          // Markers for Map tab
  _mapInterval: null,       // Periodic sync interval for Map tab
  _modalMapInstance: null,  // Map instance for individual tracking modal
  _modalMapInterval: null,  // Periodic sync interval for individual tracking modal
  _currentLogs: [],         // Local array for service logs during editing
  _hasFittedBounds: false,  // Track if map has done initial zoom fit

  // ── Lifecycle ──
  async render() {
    const container = document.getElementById('page-fleet');
    container.innerHTML = '<div class="skeleton" style="height:400px"></div>';

    // Reset tracking intervals
    this.cleanupMap();

    try {
      this.bikes = await API.getBikes();
      container.innerHTML = this.buildPageSkeleton();
      
      this.renderAlertBanner();
      this.renderStatsRow();
      this.renderToolbar();
      this.renderContent();
      this.renderBulkBar();
      
      this.attachEvents();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load fleet data: ${err.message}</p></div>`;
    }
  },

  // Cleanup Leaflet maps and intervals
  cleanupMap() {
    if (this._mapInterval) {
      clearInterval(this._mapInterval);
      this._mapInterval = null;
    }
    if (this._mapInstance) {
      try {
        this._mapInstance.remove();
      } catch (e) {
        console.warn('Error removing map instance:', e);
      }
      this._mapInstance = null;
    }
    this._mapMarkers = {};
    this._hasFittedBounds = false;
  },

  // ── Page Base Skeleton ──
  buildPageSkeleton() {
    return `
      <div id="fleet-alert-container"></div>
      <div id="fleet-stats-container"></div>
      <div id="fleet-toolbar-container" class="mt-24"></div>
      <div id="fleet-content-container" class="mt-24"></div>
      <div id="fleet-bulk-container"></div>
    `;
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
      else if (!b.authorization_expiry) healthStatus = 'warn'; // Missing authorization expiry is marked as warn (yellow alert)

      return { ...b, daysUntilExpiry, daysUntilAuthExpiry, worstExpiry, healthStatus };
    });
  },

  // ── Advanced Search & Filter & Sort ──
  filterAndSort(bikesWithStatus) {
    let filtered = [...bikesWithStatus];

    // Filter
    if (this.currentFilter === 'active') {
      filtered = filtered.filter(b => b.status === 'active' || b.status === 'available');
    } else if (this.currentFilter === 'maintenance') {
      filtered = filtered.filter(b => b.status === 'maintenance');
    } else if (this.currentFilter === 'retired') {
      filtered = filtered.filter(b => b.status === 'retired');
    } else if (this.currentFilter === 'expiring') {
      // Include expired, expiring, or missing authorization expiry under compliance alert filter
      filtered = filtered.filter(b => b.worstExpiry <= 30 || !b.authorization_expiry);
    } else if (this.currentFilter === 'unassigned') {
      filtered = filtered.filter(b => !b.assigned_rider_id);
    } else if (this.currentFilter === 'assigned') {
      filtered = filtered.filter(b => !!b.assigned_rider_id);
    }

    // Advanced search query tokenizer
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      const tokens = q.split(/\s+/);

      for (const token of tokens) {
        if (!token) continue;

        if (token.startsWith('status:')) {
          const statusVal = token.substring(7);
          filtered = filtered.filter(b => {
            const displayStatus = (b.status === 'available' ? 'active' : b.status) || '';
            return displayStatus.toLowerCase() === statusVal;
          });
        } else if (token.startsWith('health:')) {
          const healthVal = token.substring(7);
          filtered = filtered.filter(b => {
            const h = b.healthStatus || 'ok';
            return h.toLowerCase() === healthVal;
          });
        } else if (token === 'expired') {
          filtered = filtered.filter(b => b.worstExpiry < 0);
        } else if (token === 'expiring') {
          filtered = filtered.filter(b => b.worstExpiry >= 0 && b.worstExpiry <= 30);
        } else if (token === 'missing' || token === 'missing-auth') {
          filtered = filtered.filter(b => !b.authorization_expiry);
        } else if (token === 'unassigned') {
          filtered = filtered.filter(b => !b.assigned_rider_id);
        } else if (token === 'assigned') {
          filtered = filtered.filter(b => !!b.assigned_rider_id);
        } else {
          // General search
          filtered = filtered.filter(b =>
            (b.plate_number && b.plate_number.toLowerCase().includes(token)) ||
            (b.model && b.model.toLowerCase().includes(token)) ||
            (b.assigned_rider_name && b.assigned_rider_name.toLowerCase().includes(token)) ||
            (b.notes && b.notes.toLowerCase().includes(token))
          );
        }
      }
    }

    // Sort
    filtered.sort((a, b) => {
      // 1. Sort by Priority (High operational priority first; exclude retired bikes)
      const isHighA = a.status !== 'retired' && (!a.assigned_rider_id || !a.authorization_expiry || a.daysUntilAuthExpiry <= 30);
      const isHighB = b.status !== 'retired' && (!b.assigned_rider_id || !b.authorization_expiry || b.daysUntilAuthExpiry <= 30);

      const priorityA = isHighA ? 1 : 0;
      const priorityB = isHighB ? 1 : 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA; // 1 goes before 0 (High priority first)
      }

      // 2. Secondary sort by selected sort option
      switch (this.currentSort) {
        case 'plate': return (a.plate_number || '').localeCompare(b.plate_number || '');
        case 'status': {
          const statusA = a.status === 'available' ? 'active' : a.status || '';
          const statusB = b.status === 'available' ? 'active' : b.status || '';
          return statusA.localeCompare(statusB);
        }
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
      active: this.bikes.filter(b => b.status === 'active' || b.status === 'available').length,
      maintenance: this.bikes.filter(b => b.status === 'maintenance').length,
      retired: this.bikes.filter(b => b.status === 'retired').length,
      assigned: this.bikes.filter(b => !!b.assigned_rider_id).length,
      unassigned: this.bikes.filter(b => !b.assigned_rider_id).length,
      expiring: all.filter(b => b.worstExpiry <= 30 || !b.authorization_expiry).length,
      expired: all.filter(b => b.worstExpiry < 0).length,
    };
  },

  // ── Render Alert Banner ──
  renderAlertBanner() {
    const container = document.getElementById('fleet-alert-container');
    if (!container) return;

    const allProcessed = this.processBikes();
    const expired = allProcessed.filter(b => b.worstExpiry < 0);
    const expiringSoon = allProcessed.filter(b => b.worstExpiry >= 0 && b.worstExpiry <= 30);
    const missingAuth = allProcessed.filter(b => !b.authorization_expiry);

    if (expired.length === 0 && expiringSoon.length === 0 && missingAuth.length === 0) {
      container.innerHTML = '';
      return;
    }

    const messages = [];
    if (expired.length > 0) {
      messages.push(`<strong>${expired.length} bike${expired.length > 1 ? 's have' : ' has'} expired documents</strong>`);
    }
    if (missingAuth.length > 0) {
      messages.push(`<strong>${missingAuth.length} bike${missingAuth.length > 1 ? 's' : ''} missing authorization expiry</strong>`);
    }
    if (expiringSoon.length > 0) {
      messages.push(`${expiringSoon.length} bike${expiringSoon.length > 1 ? 's' : ''} expiring within 30 days`);
    }

    container.innerHTML = `
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
        <button class="fleet-filter-chip active" id="btn-view-expired" style="font-size:12px; height:32px; flex-shrink:0;">
          View All
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    `;

    document.getElementById('btn-view-expired')?.addEventListener('click', () => {
      this.currentFilter = 'expiring';
      this.updateView();
    });
  },

  // ── Render Stats Row ──
  renderStatsRow() {
    const container = document.getElementById('fleet-stats-container');
    if (!container) return;

    const allProcessed = this.processBikes();
    const c = this.getCounts(allProcessed);
    const utilPct = c.total > 0 ? Math.round((c.assigned / c.total) * 100) : 0;

    const compliancePct = c.total > 0 ? Math.round(((c.total - c.expiring) / c.total) * 100) : 100;
    const utilColor = utilPct >= 80 ? '#059669' : utilPct >= 50 ? '#d97706' : '#e11d48';
    const compColor = compliancePct >= 90 ? '#059669' : compliancePct >= 70 ? '#d97706' : '#e11d48';

    const circumference = 2 * Math.PI * 24;
    const utilOffset = circumference - (utilPct / 100) * circumference;

    container.innerHTML = `
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
              <div class="fleet-stat-label">Active / Available</div>
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

        <!-- Docs Compliance -->
        <div class="fleet-stat-card">
          <div style="border-top: 3px solid ${compColor}; border-radius: 16px 16px 0 0; margin: -20px -20px 16px -20px;"></div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div class="fleet-stat-value" style="color:${compColor};">${compliancePct}%</div>
              <div class="fleet-stat-label">Compliance</div>
              <span class="fleet-stat-badge-compliance" style="background:${c.expiring > 0 ? 'rgba(225,29,72,0.1)' : 'rgba(16,185,129,0.1)'}; color:${c.expiring > 0 ? '#E11D48' : '#10b981'};">
                ${c.expiring > 0 ? c.expiring + ' action needed' : 'All Docs Valid'}
              </span>
            </div>
            <div class="fleet-stat-icon" style="background:${c.expiring > 0 ? 'rgba(225,29,72,0.05)' : 'rgba(16,185,129,0.05)'}; color:${compColor};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
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
                  stroke-dasharray="${circumference}" stroke-dashoffset="${utilOffset}"
                  stroke-linecap="round" transform="rotate(-90 28 28)"
                  style="transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Render Toolbar ──
  renderToolbar() {
    const container = document.getElementById('fleet-toolbar-container');
    if (!container) return;

    const allProcessed = this.processBikes();
    const c = this.getCounts(allProcessed);

    const filters = [
      { key: 'all', label: 'All', count: c.total },
      { key: 'active', label: 'Active', count: c.active },
      { key: 'maintenance', label: 'Maintenance', count: c.maintenance },
      { key: 'assigned', label: 'Assigned', count: c.assigned },
      { key: 'unassigned', label: 'Unassigned', count: c.unassigned },
      { key: 'expiring', label: 'Expiring', count: c.expiring },
    ];

    container.innerHTML = `
      <div class="fleet-toolbar">
        <div class="fleet-toolbar-left">
          <!-- Premium Search Box -->
          <div class="search-box" style="max-width:320px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="fleet-search" placeholder="Search plate, model, or rider..." value="${Utils.escapeHtml(this.searchQuery)}">
            <button class="search-box-clear" id="fleet-search-clear" style="display: ${this.searchQuery ? 'flex' : 'none'};">✕</button>
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

          <!-- View Toggle with Map Option -->
          <div class="fleet-view-toggle">
            <button class="fleet-view-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
            <button class="fleet-view-btn ${this.currentView === 'table' ? 'active' : ''}" data-view="table" title="Table View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button class="fleet-view-btn ${this.currentView === 'map' ? 'active' : ''}" data-view="map" title="Map View">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
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

  // ── Render Content container ──
  renderContent() {
    const container = document.getElementById('fleet-content-container');
    if (!container) return;

    const allProcessed = this.processBikes();
    const filtered = this.filterAndSort(allProcessed);

    // Stop active map tracking intervals on tab/view switch
    this.cleanupMap();

    if (this.currentView === 'grid') {
      container.innerHTML = this.buildCardGrid(filtered);
    } else if (this.currentView === 'table') {
      container.innerHTML = this.buildTable(filtered);
    } else if (this.currentView === 'map') {
      container.innerHTML = this.buildMapViewHTML(filtered);
      setTimeout(() => this.initFleetMap(filtered), 50);
    }
  },

  // ── Card Grid View ──
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

    // Highlights matching plate, model, or rider name
    const highlightedPlate = this.highlightMatches(bike.plate_number, this.searchQuery);
    const highlightedModel = bike.model ? this.highlightMatches(bike.model, this.searchQuery) : '';
    const highlightedRider = bike.assigned_rider_name ? this.highlightMatches(bike.assigned_rider_name, this.searchQuery) : '';

    const assignedHtml = bike.assigned_rider_name
      ? `<div style="display:flex; align-items:center; gap:8px;">
           <div style="width:24px; height:24px; border-radius:6px; background:var(--primary-50); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">${Utils.getInitials(bike.assigned_rider_name)}</div>
           <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${highlightedRider}</span>
         </div>`
      : `<span style="font-size:13px; color:var(--text-tertiary); font-style:italic;">Unassigned</span>`;

    return `
      <div class="fleet-card health-${bike.healthStatus}" style="animation-delay: ${index * 30}ms;" data-id="${bike.id}">
        <div class="fleet-card-gradient"></div>
        <div class="fleet-card-body">
          <!-- Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <div>
              <div class="fleet-card-plate">${highlightedPlate}</div>
              ${bike.model ? `<div style="font-size:12px; color:var(--text-tertiary); margin-top:2px;">${highlightedModel}</div>` : ''}
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
              <div class="fleet-card-field-value ${!bike.authorization_expiry || bike.daysUntilAuthExpiry <= 30 ? 'fleet-text-danger' : ''}" style="${!bike.authorization_expiry ? 'font-weight:700;' : ''}">
                ${bike.authorization_expiry ? Utils.formatDateShort(bike.authorization_expiry) : 'MISSING'}
              </div>
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
              <button class="fleet-action-btn fleet-action-danger btn-unassign-bike" data-id="${bike.id}" title="Unassign rider">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                Unassign
              </button>
              <button class="fleet-action-btn fleet-action-primary btn-track-bike" data-id="${bike.id}" title="Track Live GPS Location">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                Track
              </button>
            ` : `
              <button class="fleet-action-btn fleet-action-primary btn-assign-bike" data-id="${bike.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Assign Rider
              </button>
            `}
            <button class="fleet-action-btn fleet-action-secondary btn-edit-bike" data-id="${bike.id}" title="Edit Details & Logs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          `}
        </div>
      </div>
    `;
  },

  // ── Table View ──
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
              <th>Actions</th>
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

              const highlightedPlate = this.highlightMatches(bike.plate_number, this.searchQuery);
              const highlightedModel = bike.model ? this.highlightMatches(bike.model, this.searchQuery) : '—';
              const highlightedRider = bike.assigned_rider_name ? this.highlightMatches(bike.assigned_rider_name, this.searchQuery) : '<span style="color:var(--text-tertiary); font-style:italic;">Unassigned</span>';

              return `
                <tr class="fleet-table-row" data-id="${bike.id}" style="animation-delay:${i * 15}ms;">
                  <td><strong style="font-family:'JetBrains Mono','Fira Code',monospace; font-size:13px; letter-spacing:0.3px;">${highlightedPlate}</strong></td>
                  <td style="color:var(--text-secondary);">${highlightedModel}</td>
                  <td><span class="fleet-badge ${statusInfo.badgeClass}">${statusInfo.label}</span></td>
                  <td><span class="fleet-badge ${authInfo.badgeClass}">${authInfo.label}</span></td>
                  <td style="${!bike.authorization_expiry || bike.daysUntilAuthExpiry <= 30 ? 'color:var(--danger-600); font-weight:700;' : ''}">${bike.authorization_expiry ? Utils.formatDateShort(bike.authorization_expiry) : 'MISSING'}</td>
                  <td style="${bike.daysUntilExpiry <= 30 ? 'color:var(--danger-600); font-weight:600;' : ''}">${bike.insurance_expiry ? Utils.formatDateShort(bike.insurance_expiry) : '—'}</td>
                  <td>${highlightedRider}</td>
                  <td>${healthIcon}</td>
                  <td>
                    <div style="display:flex; gap:6px; align-items:center;">
                      <button class="btn btn-outline btn-xs btn-edit-bike" data-id="${bike.id}" style="padding:2px 8px; height:26px; font-size:11px;">Edit</button>
                      ${bike.assigned_rider_id ? `
                        <button class="btn btn-outline btn-xs btn-track-bike" data-id="${bike.id}" style="padding:2px 8px; height:26px; font-size:11px; color:var(--success-700); border-color:var(--success-200); background:var(--success-50); font-weight:600;">Track</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ── Map Tab View HTML ──
  buildMapViewHTML(filtered) {
    return `
      <div class="fleet-map-wrap">
        <div id="fleet-map-canvas" class="fleet-map-canvas">
          <div style="position: absolute; top: 12px; right: 12px; z-index: 1000; display: flex; flex-direction: column; gap: 6px;">
            <button class="btn btn-sm" id="btn-recenter-map" style="background:#fff; border:1px solid var(--border-light); font-size:11px; height:32px; box-shadow:var(--shadow-sm); font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
              Recenter Map
            </button>
          </div>
        </div>
        <div class="fleet-map-sidebar">
          <div class="fleet-map-sidebar-header">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:14px; font-weight:700; color:var(--text-primary);">Locatable Bikes</span>
              <span class="fleet-filter-badge" id="map-locatable-badge" style="background:var(--success-500); color:#fff; font-size:10px;">0</span>
            </div>
            <div style="font-size:11px; color:var(--text-tertiary); margin-top:2px;">Bikes with active riders on road</div>
          </div>
          <div class="fleet-map-sidebar-list" id="fleet-map-sidebar-list">
            <div style="color:var(--text-tertiary); font-size:12px; text-align:center; padding:30px;">
              <div class="skeleton-pulse" style="width:24px; height:24px; border-radius:50%; margin:0 auto 10px;"></div>
              Loading locations...
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Load Map Tab View ──
  async initFleetMap(filteredBikes) {
    try {
      await this.loadLeaflet();

      const canvas = document.getElementById('fleet-map-canvas');
      if (!canvas) return; // Switched view rapidly

      this._mapInstance = L.map('fleet-map-canvas', {
        center: [24.7136, 46.6753],
        zoom: 11,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(this._mapInstance);

      this._mapMarkers = {};
      this._hasFittedBounds = false;

      // Initial sync
      await this.syncMapLocations(filteredBikes);

      // Periodically sync every 12 seconds
      this._mapInterval = setInterval(() => this.syncMapLocations(filteredBikes), 12000);

      document.getElementById('btn-recenter-map')?.addEventListener('click', () => {
        this.recenterMapToMarkers();
      });

    } catch (err) {
      console.error('Failed to init fleet map:', err);
      const canvas = document.getElementById('fleet-map-canvas');
      if (canvas) {
        canvas.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--danger-600); font-weight:600; font-size:13px; padding:20px; text-align:center;">Failed to load map canvas: ${err.message}</div>`;
      }
    }
  },

  // ── Sync Fleet Map Locations ──
  async syncMapLocations(filteredBikes) {
    try {
      const locations = await API.request('/admin/fleet-locations');
      const locationMap = {};
      locations.forEach(loc => {
        if (loc.id) locationMap[String(loc.id)] = loc;
      });

      const sidebarList = document.getElementById('fleet-map-sidebar-list');
      if (!sidebarList) return; // Switched page

      let sidebarHTML = '';
      let locatableCount = 0;
      const markersToFit = [];

      filteredBikes.forEach(b => {
        const loc = b.assigned_rider_id ? locationMap[String(b.assigned_rider_id)] : null;
        const isLocatable = loc && loc.lat && loc.lng;

        if (isLocatable) {
          locatableCount++;
          const pos = [loc.lat, loc.lng];
          markersToFit.push(pos);

          // Update marker or create
          if (this._mapMarkers[b.id]) {
            this._mapMarkers[b.id].setLatLng(pos);
          } else {
            const statusColor = b.healthStatus === 'danger' ? '#ef4444' : b.healthStatus === 'warn' ? '#f59e0b' : '#10b981';
            const iconHTML = `
              <div style="background:${statusColor}; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.35); position:relative; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; background:${statusColor}; width:100%; height:100%; border-radius:50%; animation:countdownPulse 1.8s infinite; opacity:0.35; pointer-events:none;"></div>
              </div>
            `;
            const customIcon = L.divIcon({
              html: iconHTML,
              className: 'custom-map-pin',
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });

            const marker = L.marker(pos, { icon: customIcon }).addTo(this._mapInstance);
            
            const statusInfo = this.getStatusInfo(b.status);
            const authInfo = this.getAuthInfo(b);
            const popupHTML = `
              <div style="font-family:'Inter',sans-serif; padding:10px; min-width:190px;">
                <div style="font-family:'JetBrains Mono',monospace; font-weight:700; font-size:14px; color:#0f172a; margin-bottom:2px;">${b.plate_number}</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:8px;">${b.model || 'Unknown Model'}</div>
                
                <div style="display:flex; gap:6px; margin-bottom:10px;">
                  <span class="fleet-badge ${statusInfo.badgeClass}" style="font-size:10px;">${statusInfo.label}</span>
                  <span class="fleet-badge ${authInfo.badgeClass}" style="font-size:10px;">${authInfo.label}</span>
                </div>
                
                <div style="border-top:1px solid #f1f5f9; padding-top:8px; margin-top:8px;">
                  <div style="font-size:9px; color:#94a3b8; font-weight:600; text-transform:uppercase;">Rider</div>
                  <div style="font-size:12px; font-weight:600; color:#1e293b; margin-top:2px;">${b.assigned_rider_name}</div>
                  <div style="font-size:11px; color:#64748b; margin-top:1px;">${loc.phone || 'No phone'}</div>
                </div>

                <div style="border-top:1px solid #f1f5f9; padding-top:8px; margin-top:8px; display:flex; justify-content:flex-end;">
                  <button class="btn btn-sm btn-primary" onclick="Bikes.openBikeFormFromMap(${b.id})" style="font-size:11px; height:26px; padding:0 10px;">Edit & Logs</button>
                </div>
              </div>
            `;
            marker.bindPopup(popupHTML);
            this._mapMarkers[b.id] = marker;
          }

          const healthDot = b.healthStatus === 'danger'
            ? '<span class="health-dot danger" style="position:static; display:inline-block; margin-right:4px;"></span>'
            : b.healthStatus === 'warn'
            ? '<span class="health-dot warning" style="position:static; display:inline-block; margin-right:4px;"></span>'
            : '<span class="health-dot success" style="position:static; display:inline-block; margin-right:4px;"></span>';

          sidebarHTML += `
            <div class="fleet-map-item" data-bike-id="${b.id}">
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <strong style="font-family:'JetBrains Mono',monospace; font-size:12px;">${b.plate_number}</strong>
                  ${healthDot}
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  Rider: ${b.assigned_rider_name}
                </div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-500)" stroke-width="2.5" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          `;
        }
      });

      // Update count badge
      const badge = document.getElementById('map-locatable-badge');
      if (badge) badge.textContent = locatableCount;

      if (locatableCount === 0) {
        sidebarList.innerHTML = `<div style="color:var(--text-tertiary); font-size:12px; text-align:center; padding:30px; font-style:italic;">No bikes are currently active on the map.</div>`;
      } else {
        sidebarList.innerHTML = sidebarHTML;

        // Click sidebar items to pan
        sidebarList.querySelectorAll('.fleet-map-item').forEach(item => {
          item.addEventListener('click', () => {
            sidebarList.querySelectorAll('.fleet-map-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const bikeId = parseInt(item.dataset.bikeId);
            const marker = this._mapMarkers[bikeId];
            if (marker) {
              this._mapInstance.setView(marker.getLatLng(), 15);
              marker.openPopup();
            }
          });
        });
      }

      // Initial fitbounds
      if (!this._hasFittedBounds && markersToFit.length > 0) {
        this._mapInstance.fitBounds(markersToFit, { padding: [40, 40] });
        this._hasFittedBounds = true;
      }

    } catch (err) {
      console.error('Error syncing locations:', err);
    }
  },

  recenterMapToMarkers() {
    if (!this._mapInstance) return;
    const coords = [];
    Object.values(this._mapMarkers).forEach(m => coords.push(m.getLatLng()));
    if (coords.length > 0) {
      this._mapInstance.fitBounds(coords, { padding: [40, 40] });
    } else {
      this._mapInstance.setView([24.7136, 46.6753], 11);
    }
  },

  openBikeFormFromMap(bikeId) {
    const bike = this.bikes.find(b => b.id === bikeId);
    if (bike) {
      if (this._mapInstance) {
        this._mapInstance.closePopup();
      }
      this.openBikeForm(bike);
    }
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
    return '<div class="empty-state" style="padding:60px 20px;"><p>No bikes match your search query or filters.</p></div>';
  },

  // ── Bulk Actions Bar ──
  buildBulkBar() {
    return `
      <div class="fleet-bulk-bar" id="fleet-bulk-bar" style="display:none;">
        <span id="fleet-bulk-count" style="font-weight:700;">0 selected</span>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm" id="fleet-bulk-active" style="background:var(--success-600); color:#fff; border:none; height:32px; padding:0 14px; font-size:12px; font-weight:600;">Set Active</button>
          <button class="btn btn-sm" id="fleet-bulk-maintenance" style="background:var(--warning-600); color:#fff; border:none; height:32px; padding:0 14px; font-size:12px; font-weight:600;">Set Maintenance</button>
          <button class="btn btn-sm" id="fleet-bulk-cancel" style="background:transparent; color:var(--gray-300); border:1px solid var(--gray-600); height:32px; padding:0 14px; font-size:12px;">Cancel</button>
        </div>
      </div>
    `;
  },

  renderBulkBar() {
    const container = document.getElementById('fleet-bulk-container');
    if (container) {
      container.innerHTML = this.buildBulkBar();
    }
  },

  // ── Dynamic Leaflet Loader ──
  async loadLeaflet() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Leaflet maps library'));
      document.head.appendChild(script);
    });
  },

  // ── Individual Live Tracking Modal ──
  async openIndividualTracking(bike) {
    if (!bike.assigned_rider_id) {
      Utils.alert('This bike has no rider assigned. Assign a rider to enable GPS tracking.', 'Cannot Track Bike');
      return;
    }

    try {
      Utils.showLoading('Locating rider');
      const locations = await API.request('/admin/fleet-locations');
      const loc = locations.find(l => String(l.id) === String(bike.assigned_rider_id));
      Utils.hideLoading();

      if (!loc || !loc.lat || !loc.lng) {
        const name = bike.assigned_rider_name || 'Rider';
        Utils.alert(`${name} is currently OFFLINE or hasn't synced location. GPS coordinates are unavailable.`, 'Rider Offline');
        return;
      }

      const html = `
        <div class="fleet-dialog" style="min-width: 0;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:12px; margin-bottom:16px;">
            <div>
              <h3 style="font-family:'JetBrains Mono',monospace; font-size:16px; font-weight:700; margin:0;">${bike.plate_number}</h3>
              <p style="font-size:12px; color:var(--text-secondary); margin:2px 0 0 0;">Model: ${bike.model || 'Unknown'}</p>
            </div>
            <div style="text-align:right;">
              <span class="fleet-badge ${loc.isOnline ? 'fleet-badge-green' : 'fleet-badge-gray'}">${loc.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; background:var(--gray-50); border:1px solid var(--border-light); padding:10px 12px; border-radius:10px; margin-bottom:12px;">
            <div style="width:36px; height:36px; border-radius:8px; background:var(--primary-50); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;">
              ${Utils.getInitials(bike.assigned_rider_name)}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:13px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bike.assigned_rider_name}</div>
              <div style="font-size:11px; color:var(--text-tertiary);">${loc.phone || 'No Phone'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px; font-weight:600; color:var(--text-secondary);">${loc.battery_level ? '🔋 ' + loc.battery_level + '%' : ''}</div>
              <div style="font-size:10px; color:var(--text-tertiary); margin-top:2px;">${loc.app_state ? 'App: ' + loc.app_state : ''}</div>
            </div>
          </div>

          <div id="modal-tracking-map" class="fleet-modal-map"></div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-tertiary); margin-top:12px; border-top:1px solid var(--border-light); padding-top:12px;">
            <span>Last Sync: <strong id="modal-tracking-sync-time">Just now</strong></span>
            <button class="btn btn-outline" onclick="Utils.closeModal()" style="height:32px; padding:0 16px; font-size:12px;">Close</button>
          </div>
        </div>
      `;

      Utils.openModal(`Track — ${bike.plate_number}`, html);

      // Start individual map initialization
      setTimeout(() => this.initIndividualModalMap(bike, loc), 100);

    } catch (err) {
      Utils.hideLoading();
      Utils.showToast(err.message, 'error');
    }
  },

  async initIndividualModalMap(bike, initialLoc) {
    try {
      await this.loadLeaflet();
      
      const mapCanvas = document.getElementById('modal-tracking-map');
      if (!mapCanvas) return; // Modal closed rapidly

      this._modalMapInstance = L.map('modal-tracking-map', {
        center: [initialLoc.lat, initialLoc.lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(this._modalMapInstance);

      // Custom marker icon
      const statusColor = bike.healthStatus === 'danger' ? '#ef4444' : bike.healthStatus === 'warn' ? '#f59e0b' : '#10b981';
      const iconHTML = `
        <div style="background:${statusColor}; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.35); position:relative; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; background:${statusColor}; width:100%; height:100%; border-radius:50%; animation:countdownPulse 1.8s infinite; opacity:0.35; pointer-events:none;"></div>
        </div>
      `;
      const customIcon = L.divIcon({
        html: iconHTML,
        className: 'custom-map-pin',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([initialLoc.lat, initialLoc.lng], { icon: customIcon }).addTo(this._modalMapInstance);
      marker.bindPopup(`<strong>${bike.plate_number}</strong><br>Rider: ${bike.assigned_rider_name}`).openPopup();

      // Accuracy circle
      const accuracyCircle = L.circle([initialLoc.lat, initialLoc.lng], {
        radius: 80,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1.5
      }).addTo(this._modalMapInstance);

      // Periodic updates for individual map (sync every 10s)
      this._modalMapInterval = setInterval(async () => {
        try {
          const locations = await API.request('/admin/fleet-locations');
          const loc = locations.find(l => String(l.id) === String(bike.assigned_rider_id));
          if (loc && loc.lat && loc.lng) {
            const pos = [loc.lat, loc.lng];
            marker.setLatLng(pos);
            accuracyCircle.setLatLng(pos);
            this._modalMapInstance.panTo(pos);
            
            const syncTime = document.getElementById('modal-tracking-sync-time');
            if (syncTime) syncTime.textContent = new Date().toLocaleTimeString();
          }
        } catch (e) {
          console.warn('Failed to update individual tracking location:', e);
        }
      }, 10000);

      // Handle modal closed to stop synchronization
      const observer = new MutationObserver(() => {
        if (!document.getElementById('modal-tracking-map')) {
          if (this._modalMapInterval) {
            clearInterval(this._modalMapInterval);
            this._modalMapInterval = null;
          }
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

    } catch (err) {
      console.error('Failed to init individual map:', err);
    }
  },

  // ── Parsers for serialized JSON service logs ──
  parseServiceLogs(notesText) {
    if (!notesText) return [];
    const trimmed = notesText.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.warn('Failed to parse notes as JSON service logs, treating as legacy note:', e);
      }
    }
    return [{
      date: new Date().toISOString().split('T')[0],
      category: 'General Note',
      cost: 0,
      notes: notesText
    }];
  },

  // ── Page Re-rendering view updates ──
  updateView() {
    this.renderAlertBanner();
    this.renderStatsRow();
    this.renderContent();

    // Sync search input if focus was not in it
    const searchInput = document.getElementById('fleet-search');
    if (searchInput && document.activeElement !== searchInput) {
      searchInput.value = this.searchQuery;
    }

    // Toggle active class on filter chips manually
    document.querySelectorAll('#page-fleet .fleet-filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === this.currentFilter);
    });

    // Toggle active class on view buttons manually
    document.querySelectorAll('.fleet-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.currentView);
    });

    this.updateBulkBar();
  },

  // ── Highlight regex parser helper ──
  highlightMatches(text, query) {
    if (!text) return '';
    if (!query) return Utils.escapeHtml(text);

    // Filter out modifier queries (status:, health:)
    const terms = query.toLowerCase().split(/\s+/).filter(t => t && !t.includes(':') && t !== 'expired' && t !== 'expiring' && t !== 'unassigned' && t !== 'assigned');
    if (terms.length === 0) return Utils.escapeHtml(text);

    let html = Utils.escapeHtml(text);

    terms.forEach(term => {
      const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');

      // Do not replace inside already formed HTML tags (e.g. mark tags)
      const parts = html.split(/(<\/?[^>]+>)/g);
      html = parts.map(part => {
        if (part.startsWith('<')) return part;
        return part.replace(regex, '<mark class="fleet-search-highlight">$1</mark>');
      }).join('');
    });

    return html;
  },

  // ── Status Mapping ──
  getStatusInfo(status) {
    const s = (status || '').toLowerCase();
    switch(s) {
      case 'active':
      case 'available':
        return { label: 'Active', badgeClass: 'fleet-badge-green' };
      case 'maintenance':
        return { label: 'Maintenance', badgeClass: 'fleet-badge-amber' };
      case 'retired':
        return { label: 'Retired', badgeClass: 'fleet-badge-gray' };
      default:
        return { label: status || 'Unknown', badgeClass: 'fleet-badge-gray' };
    }
  },

  getAuthInfo(bike) {
    const days = Utils.daysUntil(bike.authorization_expiry);
    const hasAuth = !!bike.authorization_expiry;
    if (hasAuth && days >= 0) return { label: 'Authorized', badgeClass: 'fleet-badge-green' };
    if (hasAuth && days < 0) return { label: 'Auth Expired', badgeClass: 'fleet-badge-red' };
    return { label: 'Missing Auth', badgeClass: 'fleet-badge-red' };
  },

  getExpiryBarPct(days) {
    if (days === Infinity) return 100;
    if (days < 0) return 3;
    if (days > 365) return 100;
    return Math.max(3, Math.round((days / 365) * 100));
  },

  // ═══════════════════════════════════════════
  //  EVENT BINDINGS
  // ═══════════════════════════════════════════
  attachEvents() {
    const container = document.getElementById('page-fleet');
    if (!container) return;

    // Search events (live typing - focus preserving)
    const searchInput = document.getElementById('fleet-search');
    const clearBtn = document.getElementById('fleet-search-clear');
    
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      if (clearBtn) clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      
      // Fast re-render of dynamic components
      this.renderContent();
      this.renderStatsRow();
    });

    // Clear search
    clearBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      if (clearBtn) clearBtn.style.display = 'none';
      this.updateView();
    });

    // Filter Chips
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.fleet-filter-chip');
      if (chip && chip.dataset.filter) {
        this.currentFilter = chip.dataset.filter;
        this.updateView();
      }
    });

    // Sort Dropdown
    document.getElementById('fleet-sort')?.addEventListener('change', (e) => {
      this.currentSort = e.target.value;
      this.updateView();
    });

    // View Toggles
    container.querySelectorAll('.fleet-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        this.updateView();
      });
    });

    // Add Bike
    document.getElementById('btn-add-bike')?.addEventListener('click', () => this.openBikeForm(null));

    // Card clicks (except buttons)
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.fleet-card');
      if (card && !e.target.closest('button')) {
        const bike = this.bikes.find(b => b.id === parseInt(card.dataset.id));
        if (bike) this.openBikeForm(bike);
      }
    });

    // Table rows clicks
    container.addEventListener('click', (e) => {
      const row = e.target.closest('.fleet-table-row');
      if (row && !e.target.closest('button')) {
        const bike = this.bikes.find(b => b.id === parseInt(row.dataset.id));
        if (bike) this.openBikeForm(bike);
      }
    });

    // Assign / Unassign / Track click delegation
    container.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-edit-bike');
      if (btnEdit) {
        e.stopPropagation();
        const bike = this.bikes.find(b => b.id === parseInt(btnEdit.dataset.id));
        if (bike) this.openBikeForm(bike);
        return;
      }

      const btnAssign = e.target.closest('.btn-assign-bike');
      if (btnAssign) {
        e.stopPropagation();
        const bike = this.bikes.find(b => b.id === parseInt(btnAssign.dataset.id));
        if (bike) this.openAssignDialog(bike);
        return;
      }

      const btnTrack = e.target.closest('.btn-track-bike');
      if (btnTrack) {
        e.stopPropagation();
        const bike = this.bikes.find(b => b.id === parseInt(btnTrack.dataset.id));
        if (bike) this.openIndividualTracking(bike);
        return;
      }

      const btnUnassign = e.target.closest('.btn-unassign-bike');
      if (btnUnassign) {
        e.stopPropagation();
        const bikeId = parseInt(btnUnassign.dataset.id);
        const bike = this.bikes.find(b => b.id === bikeId);
        this.confirmUnassign(bike);
        return;
      }
    });

    // Export CSV
    document.getElementById('fleet-export-csv')?.addEventListener('click', () => this.exportCSV());

    // Bulk buttons
    document.getElementById('fleet-bulk-active')?.addEventListener('click', () => this.bulkUpdateStatus('active'));
    document.getElementById('fleet-bulk-maintenance')?.addEventListener('click', () => this.bulkUpdateStatus('maintenance'));
    document.getElementById('fleet-bulk-cancel')?.addEventListener('click', () => {
      this.selectedBikes.clear();
      this.updateBulkBar();
    });
  },

  async confirmUnassign(bike) {
    const confirmed = await Utils.confirm(
      `Unassign bike ${bike.plate_number} from rider ${bike.assigned_rider_name}?`,
      'Unassign Bike',
      'Unassign',
      'Cancel',
      true
    );
    if (confirmed) {
      try {
        Utils.showLoading('Unassigning bike');
        await API.unassignBike(bike.id);
        Utils.showToast('Bike unassigned successfully', 'success');
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
      }
    }
  },

  // ═══════════════════════════════════════════
  //  TABBED BIKE DETAIL / EDIT DIALOG
  // ═══════════════════════════════════════════
  openBikeForm(bike) {
    const isEdit = !!bike;
    const isViewer = App.isViewer();

    // Set up local service logs state
    this._currentLogs = isEdit ? this.parseServiceLogs(bike.notes) : [];

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
    const hc = healthColors[healthStatus];

    const html = `
      <div class="fleet-dialog" style="min-width:0;">
        <!-- Header banner -->
        ${isEdit ? `
        <div class="fleet-dialog-header" style="background: linear-gradient(135deg, ${hc}15, ${hc}05); border: 1px solid ${hc}30; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
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
              <div style="width:48px; height:48px; border-radius:50%; border:3px solid ${hc}; display:flex; align-items:center; justify-content:center; background:#fff;">
                <span style="font-size:14px; font-weight:700; color:${hc};">${worstExpiry === Infinity ? '✓' : (worstExpiry < 0 ? '!' : worstExpiry)}</span>
              </div>
              <div style="font-size:10px; color:${hc}; font-weight:600; margin-top:4px;">${worstExpiry === Infinity ? 'NO DOCS' : (worstExpiry < 0 ? 'EXPIRED' : 'DAYS')}</div>
            </div>
          </div>
          ${bike.assigned_rider_name ? `
          <div style="margin-top:12px; padding-top:10px; border-top:1px solid ${hc}20; display:flex; align-items:center; gap:10px;">
            <div style="width:28px; height:28px; border-radius:6px; background:var(--primary-100); color:var(--primary-600); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">${Utils.getInitials(bike.assigned_rider_name)}</div>
            <div>
              <div style="font-size:11px; color:var(--text-tertiary);">Assigned to <span style="font-weight:600; color:var(--text-primary);">${Utils.escapeHtml(bike.assigned_rider_name)}</span></div>
            </div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <!-- Tab Buttons (Modal header area) -->
        <div class="fleet-modal-tabs">
          <button type="button" class="fleet-modal-tab-btn active" id="tab-btn-info">Info & Expiry</button>
          <button type="button" class="fleet-modal-tab-btn" id="tab-btn-logs">Service Logs (${this._currentLogs.length})</button>
        </div>

        <form id="bike-form">
          <!-- TAB 1: Info & Expiry -->
          <div id="tab-content-info" class="tab-content">
            <div class="fleet-dialog-section">
              <div class="fleet-dialog-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                Bike Information
              </div>
              <div class="form-grid" style="gap:16px;">
                <div class="form-group">
                  <label>Plate Number <span class="required">*</span></label>
                  <input type="text" id="bf-plate" class="form-control" ${isViewer ? 'disabled' : ''} required value="${isEdit ? Utils.escapeHtml(bike.plate_number) : ''}" placeholder="e.g. AH 5246" style="font-family:'JetBrains Mono',monospace; letter-spacing:1px;">
                </div>
                <div class="form-group">
                  <label>Bike Model</label>
                  <input type="text" id="bf-model" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit ? Utils.escapeHtml(bike.model || '') : ''}" placeholder="e.g. Honda CG 125">
                </div>
                <div class="form-group">
                  <label>Status</label>
                  <select id="bf-status" class="form-select" ${isViewer ? 'disabled' : ''}>
                    <option value="active" ${isEdit && (bike.status === 'active' || bike.status === 'available') ? 'selected' : ''}>Active (On Road)</option>
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
                  <label>Authorization Expiry (Istimara)</label>
                  <input type="date" id="bf-auth-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.authorization_expiry ? bike.authorization_expiry : ''}">
                </div>
                <div class="form-group">
                  <label>Insurance Expiry</label>
                  <input type="date" id="bf-ins-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.insurance_expiry ? bike.insurance_expiry : ''}">
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: Service Logs -->
          <div id="tab-content-logs" class="tab-content" style="display:none;">
            <!-- Service Logs loaded dynamically -->
          </div>

          <!-- Action Buttons -->
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

    Utils.openModal(isEdit ? `Edit Details — ${bike.plate_number}` : 'Register New Bike', html);

    // Tab switcher events
    const tabInfo = document.getElementById('tab-btn-info');
    const tabLogs = document.getElementById('tab-btn-logs');
    const contentInfo = document.getElementById('tab-content-info');
    const contentLogs = document.getElementById('tab-content-logs');

    tabInfo?.addEventListener('click', () => {
      tabInfo.classList.add('active');
      tabLogs.classList.remove('active');
      contentInfo.style.display = 'block';
      contentLogs.style.display = 'none';
    });

    tabLogs?.addEventListener('click', () => {
      tabLogs.classList.add('active');
      tabInfo.classList.remove('active');
      contentInfo.style.display = 'none';
      contentLogs.style.display = 'block';
      this.renderServiceLogsTabContent();
    });

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
        notes: JSON.stringify(this._currentLogs), // Save serialized array to notes column
      };

      try {
        Utils.showLoading('Saving bike details');
        if (isEdit) {
          await API.updateBike(bike.id, payload);
          Utils.showToast('Bike updated successfully', 'success');
        } else {
          await API.createBike(payload);
          Utils.showToast('New bike registered successfully', 'success');
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

    // Delete bike listener
    if (isEdit && !isViewer) {
      document.getElementById('bf-delete')?.addEventListener('click', async () => {
        const confirmed = await Utils.confirm(
          `Permanently delete bike ${bike.plate_number}? This action is irreversible.`,
          'Delete Bike',
          'Delete Forever',
          'Cancel',
          true
        );
        if (confirmed) {
          try {
            Utils.showLoading('Deleting');
            await API.deleteBike(bike.id);
            Utils.showToast('Bike deleted successfully', 'success');
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

  // Render Service Logs tab content inside modal
  renderServiceLogsTabContent() {
    const container = document.getElementById('tab-content-logs');
    if (!container) return;

    container.innerHTML = this.buildServiceLogsTabHTML(this._currentLogs);

    // Add log event
    document.getElementById('btn-add-service-log')?.addEventListener('click', () => {
      const category = document.getElementById('log-category').value;
      const cost = parseFloat(document.getElementById('log-cost').value) || 0;
      const date = document.getElementById('log-date').value || new Date().toISOString().split('T')[0];
      const notes = document.getElementById('log-notes').value.trim();

      this._currentLogs.push({ category, cost, date, notes });

      const tabLogs = document.getElementById('tab-btn-logs');
      if (tabLogs) tabLogs.textContent = `Service Logs (${this._currentLogs.length})`;

      this.renderServiceLogsTabContent();
      Utils.showToast('Service record drafted', 'success');
    });

    // Delete log event delegation
    container.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        this._currentLogs.splice(idx, 1);

        const tabLogs = document.getElementById('tab-btn-logs');
        if (tabLogs) tabLogs.textContent = `Service Logs (${this._currentLogs.length})`;

        this.renderServiceLogsTabContent();
        Utils.showToast('Service record removed', 'success');
      });
    });
  },

  // Service Logs tab HTML builder
  buildServiceLogsTabHTML(logs) {
    const totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
    const isViewer = App.isViewer();

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--primary-50); border:1.5px solid var(--primary-100); padding:12px; border-radius:12px; margin-bottom:16px;">
        <div>
          <div style="font-size:12px; color:var(--primary-600); font-weight:600;">Total Maintenance spent</div>
          <div style="font-size:20px; font-weight:700; color:var(--primary-700); margin-top:2px;">${totalCost.toLocaleString()} SAR</div>
        </div>
        <span class="fleet-badge fleet-badge-blue">${logs.length} record${logs.length !== 1 ? 's' : ''}</span>
      </div>

      <!-- Add service log card -->
      ${isViewer ? '' : `
      <div style="background:var(--gray-50); border:1px solid var(--border-light); padding:14px; border-radius:12px; margin-bottom:16px;">
        <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Service / Maintenance Record
        </div>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
          <div class="form-group">
            <label style="font-size:11px; margin-bottom:4px; font-weight:600;">Category</label>
            <select id="log-category" class="form-select" style="height:36px; font-size:12px; padding:0 8px;">
              <option value="Oil Change">Oil Change</option>
              <option value="Brake Replacement">Brake Replacement</option>
              <option value="Tyre Change">Tyre Change</option>
              <option value="General Repair">General Repair</option>
              <option value="Accident Repair">Accident Repair</option>
              <option value="Insurance renewal">Insurance renewal</option>
              <option value="Istimara renewal">Istimara renewal</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label style="font-size:11px; margin-bottom:4px; font-weight:600;">Cost (SAR)</label>
            <input type="number" id="log-cost" class="form-control" placeholder="0" style="height:36px; font-size:12px; padding:0 8px;" min="0" step="any">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label style="font-size:11px; margin-bottom:4px; font-weight:600;">Date</label>
            <input type="date" id="log-date" class="form-control" style="height:36px; font-size:12px; padding:0 8px;" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label style="font-size:11px; margin-bottom:4px; font-weight:600;">Description / Notes</label>
            <textarea id="log-notes" class="form-control" rows="2" placeholder="Describe the service..." style="font-size:12px; padding:6px 8px; min-height:44px; resize:vertical;"></textarea>
          </div>
        </div>
        <button type="button" id="btn-add-service-log" class="btn btn-primary" style="width:100%; height:32px; font-size:12px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px;">
          Add Record
        </button>
      </div>
      `}

      <!-- History Log List -->
      <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:8px; letter-spacing:0.5px;">
        History Log
      </div>
      <div class="fleet-service-list">
        ${logs.length === 0 ? `
          <div style="color:var(--text-tertiary); font-size:12px; text-align:center; padding:20px; font-style:italic;">No records registered.</div>
        ` : logs.map((l, idx) => `
          <div class="fleet-service-item">
            <div class="fleet-service-meta">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="fleet-service-type">${Utils.escapeHtml(l.category)}</span>
                <span class="fleet-service-date">${Utils.formatDateShort(l.date)}</span>
              </div>
              ${l.notes ? `<div class="fleet-service-notes">${Utils.escapeHtml(l.notes)}</div>` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="fleet-service-cost">${l.cost || 0} SAR</span>
              ${isViewer ? '' : `
                <button type="button" class="btn-delete-log" data-index="${idx}" title="Delete record" style="background:none; border:none; color:var(--danger-500); cursor:pointer; padding:2px; display:flex; align-items:center;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              `}
            </div>
          </div>
        `).reverse().join('')}
      </div>
    `;
  },

  // ── RIDER ASSIGNMENT DIALOG ──
  async openAssignDialog(bike) {
    try {
      Utils.showLoading('Loading riders list');
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

          <!-- Rider Selection Grid -->
          <div class="fleet-rider-picker" id="rider-picker-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:10px; max-height: 280px; overflow-y:auto; padding-right:4px;">
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

      document.querySelectorAll('.fleet-rider-option').forEach(opt => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.fleet-rider-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedRiderId = opt.dataset.riderId;
          document.getElementById('btn-confirm-assign').disabled = false;
        });
      });

      document.getElementById('assign-search')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.fleet-rider-option').forEach(opt => {
          const name = opt.dataset.name || '';
          opt.style.display = name.includes(q) ? '' : 'none';
        });
      });

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

  // ── Bulk Actions ──
  updateBulkBar() {
    const bar = document.getElementById('fleet-bulk-bar');
    const count = this.selectedBikes.size;
    if (bar) {
      bar.style.display = count > 0 ? 'flex' : 'none';
      const countLabel = document.getElementById('fleet-bulk-count');
      if (countLabel) countLabel.textContent = `${count} selected`;
    }
  },

  async bulkUpdateStatus(newStatus) {
    if (this.selectedBikes.size === 0) return;
    const label = newStatus === 'active' ? 'Active' : 'Maintenance';
    const confirmed = await Utils.confirm(
      `Change ${this.selectedBikes.size} bike(s) status to "${label}"?`,
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
      const numUpdated = this.selectedBikes.size;
      this.selectedBikes.clear();
      Utils.showToast(`${numUpdated} bikes updated to ${label}`, 'success');
      this.render();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ── CSV Export ──
  exportCSV() {
    const allProcessed = this.processBikes();
    const rows = [
      ['Plate Number', 'Model', 'Status', 'Authorization Expiry', 'Insurance Expiry', 'Assigned Rider', 'Health Status', 'Total Maintenance Cost (SAR)', 'Notes']
    ];

    allProcessed.forEach(b => {
      const logs = this.parseServiceLogs(b.notes);
      const totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost) || 0), 0);
      
      let notesSummary = '';
      if (logs.length > 0) {
        notesSummary = logs.map(l => `[${l.date}] ${l.category}: ${l.notes || ''} (${l.cost} SAR)`).join(' | ');
      }

      rows.push([
        b.plate_number || '',
        b.model || '',
        b.status === 'available' ? 'active' : (b.status || ''),
        b.authorization_expiry || '',
        b.insurance_expiry || '',
        b.assigned_rider_name || 'Unassigned',
        b.healthStatus === 'danger' ? 'Expired' : b.healthStatus === 'warn' ? 'Expiring' : 'Valid',
        totalCost,
        notesSummary.replace(/"/g, '""')
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
