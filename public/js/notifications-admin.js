// ========================================================
//  RIDER ALERTS & COMPLIANCE - Push & In-app Notifications
// ========================================================

const NotificationsAdmin = {
  selectedRiders: new Set(),
  riders: [],
  date: new Date(Date.now() + 3 * 3600000).toISOString().split('T')[0], // Default KSA timezone date
  searchQuery: '',
  filterCategory: 'all', // 'all', 'missing_log', 'missing_profile', 'compliant'
  loading: false,

  async render() {
    const root = document.getElementById('page-notifications');
    if (!root) return;

    root.innerHTML = `<div class="p-24 text-center"><div class="spinner" style="margin: 0 auto 12px auto;"></div><p class="text-secondary">Loading compliance dashboard...</p></div>`;
    this.selectedRiders.clear(); // Reset selections

    try {
      await this.loadData();
      this.renderUI(root);
      this.attachEventListeners();
    } catch (err) {
      Utils.showToast(err.message, 'error');
      root.innerHTML = `
        <div class="p-24">
          <div class="card" style="padding: 24px; border-color: var(--danger-100); background: var(--danger-50); color: var(--danger-600);">
            <h3 style="font-weight:700; margin-bottom: 8px;">Compliance Load Error</h3>
            <p>${Utils.escapeHtml(err.message)}</p>
          </div>
        </div>
      `;
    }
  },

  async loadData() {
    this.loading = true;
    try {
      const res = await API.getRidersCompliance(this.date);
      this.riders = res.compliance || [];
    } finally {
      this.loading = false;
    }
  },

  renderUI(root) {
    const totalCount = this.riders.length;
    const compliantCount = this.riders.filter(r => r.missing_fields.length === 0 && !r.missing_log).length;
    const missingFieldsCount = this.riders.filter(r => r.missing_fields.length > 0).length;
    
    // Cycle missing logic
    const cycleMissingCount = this.riders.filter(r => r.cycle_missing_days && r.cycle_missing_days > 0).length;
    
    // Expiry logic
    const today = new Date(this.date);
    let expiringCount = 0;
    this.riders.forEach(r => {
      let isExpiring = false;
      ['iqama_expiry', 'license_expiry', 'insurance_expiry'].forEach(field => {
        if (r[field]) {
          const exp = new Date(r[field]);
          const diffDays = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
          if (diffDays <= 15 && diffDays >= 0) isExpiring = true;
          if (diffDays < 0) isExpiring = true; // Expired!
        }
      });
      if (isExpiring) expiringCount++;
      r.isExpiring = isExpiring;
    });

    const filteredRiders = this.getFilteredRiders();

    root.innerHTML = `
      <div class="page-header" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <h1 class="page-title">Rider Alerts & Notifications</h1>
        <button class="btn btn-outline" id="refresh-compliance-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh Data
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">Active Riders</span>
            <div class="stat-card-icon" style="color: var(--primary-500)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
          </div>
          <div class="stat-card-value">${totalCount}</div>
          <div class="stat-card-sub">Total active fleet size</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">Compliant Fleet</span>
            <div class="stat-card-icon" style="color: var(--success-500)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="color: var(--success-600);">${compliantCount}</div>
          <div class="stat-card-sub">Profile fields & log correct</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">Missing Profile Data</span>
            <div class="stat-card-icon" style="color: var(--warning-500)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="color: var(--warning-600);">${missingFieldsCount}</div>
          <div class="stat-card-sub">Incomplete profiles</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">Missing Daily Logs</span>
            <div class="stat-card-icon" style="color: var(--danger-500)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="color: var(--danger-600);">${cycleMissingCount}</div>
          <div class="stat-card-sub">Cycle missing logs detected</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">Expiring Docs (<15 days)</span>
            <div class="stat-card-icon" style="color: var(--warning-500)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
          </div>
          <div class="stat-card-value" style="color: var(--warning-600);">${expiringCount}</div>
          <div class="stat-card-sub">Iqama, License, or Insurance</div>
        </div>
      </div>

      <!-- Controls & Filters Toolbar -->
      <div class="card" style="padding: 16px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div style="display: flex; gap: 16px; align-items: center; flex: 1; min-width: 320px;">
            <div class="search-box" style="max-width: 280px; flex: 1;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="compliance-search" placeholder="Search rider name, phone, ID..." value="${Utils.escapeHtml(this.searchQuery)}">
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Log Check Date:</span>
              <input type="date" id="compliance-date-picker" class="form-input" style="padding: 6px 12px; font-size: 13px;" value="${this.date}">
            </div>
          </div>

          <div style="display: flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: var(--radius-md); overflow-x: auto;">
            <button class="btn btn-sm ${this.filterCategory === 'all' ? 'btn-primary' : 'btn-ghost'}" id="filter-all-btn">All</button>
            <button class="btn btn-sm ${this.filterCategory === 'missing_log' ? 'btn-primary' : 'btn-ghost'}" id="filter-log-btn">Missing Logs</button>
            <button class="btn btn-sm ${this.filterCategory === 'missing_profile' ? 'btn-primary' : 'btn-ghost'}" id="filter-profile-btn">Missing Profile</button>
            <button class="btn btn-sm ${this.filterCategory === 'expiring' ? 'btn-primary' : 'btn-ghost'}" id="filter-expiring-btn">Expiring Docs</button>
            <button class="btn btn-sm ${this.filterCategory === 'compliant' ? 'btn-primary' : 'btn-ghost'}" id="filter-compliant-btn">Compliant</button>
          </div>
        </div>
      </div>

      <!-- Composer Panel Layout -->
      <div style="display: grid; grid-template-columns: ${App.isViewer() ? '1fr' : '5fr 3fr'}; gap: 24px; align-items: start;">
        
        <!-- Left: Rider Compliance Cards List -->
        <div class="card" style="padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
            <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0;">Riders List (${filteredRiders.length})</h3>
            ${App.isViewer() ? '' : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="select-all-riders" style="cursor: pointer;" ${filteredRiders.length > 0 && filteredRiders.every(r => this.selectedRiders.has(r.id)) ? 'checked' : ''}>
              <label for="select-all-riders" style="font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; user-select: none;">Select All</label>
            </div>
            `}
          </div>

          <div style="max-height: 580px; overflow-y: auto; padding-right: 4px;">
            ${filteredRiders.length === 0 ? `
              <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;margin: 0 auto 12px auto;color:var(--gray-300);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p>No active riders found matching parameters.</p>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 10px;" id="riders-list-wrapper">
                ${filteredRiders.map(r => this.buildRiderCardHtml(r)).join('')}
              </div>
            `}
          </div>
        </div>

        <!-- Right: Alert Message Composer -->
        ${App.isViewer() ? '' : `
        <div class="card" style="padding: 24px; position: sticky; top: calc(var(--header-height) + 24px);">
          <h3 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-top: 0; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px; color: var(--primary-500);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Alert Composer
          </h3>
          
          <div id="composer-selection-count" class="alert-item ${this.selectedRiders.size > 0 ? 'info' : 'warning'}" style="margin-bottom: 20px; padding: 8px 12px; font-size: 12px; border-radius: var(--radius-sm);">
            ${this.selectedRiders.size} riders selected for notification.
          </div>

          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Presets dropdown -->
            <div class="form-group">
              <label class="form-label" for="composer-preset">Select Template Preset</label>
              <select id="composer-preset" class="form-select">
                <option value="custom">-- Custom Message --</option>
                <option value="log_missing">Missing Cycle Logs Warning</option>
                <option value="profile_missing">Missing Profile Fields (IBAN/Noon ID)</option>
                <option value="extra_missing">Missing Emergency / License details</option>
                <option value="expiring_docs">Expiring Documents Warning</option>
                <option value="runaway">No Activity (Runaway) Suspension Warning</option>
                <option value="disabled" disabled>──────────────────────────</option>
                <option value="urdu_log_missing">Urdu - Daily Log Missing Warning ⚠️</option>
                <option value="urdu_cycle_missing">Urdu - Multiple Cycle Logs Missing 🚨</option>
                <option value="urdu_profile_missing">Urdu - Profile Incomplete Action 🔒</option>
                <option value="urdu_docs_expiring">Urdu - Document Expiring Notice 📅</option>
                <option value="urdu_inactive_warning">Urdu - Inactive Warning (Final) ⛔</option>
              </select>
            </div>

            <!-- Title Input -->
            <div class="form-group">
              <label class="form-label" for="composer-title">Notification Title <span style="color:var(--danger-500);">*</span></label>
              <input type="text" id="composer-title" class="form-input" placeholder="e.g. Profile Information Incomplete">
            </div>

            <!-- Message Textarea -->
            <div class="form-group">
              <label class="form-label" for="composer-message">Message Content <span style="color:var(--danger-500);">*</span></label>
              <textarea id="composer-message" class="form-textarea" placeholder="Type message body here..." style="min-height: 90px;"></textarea>
            </div>

            <!-- Lockscreen Phone Preview mockup -->
            <div style="margin-top: 4px;">
              <label class="form-label" style="margin-bottom: 8px; display: block;">Notification Lockscreen Preview</label>
              
              <div style="background: #0f172a; border-radius: 16px; border: 4px solid #334155; padding: 12px; color: #fff; font-family: system-ui, -apple-system, sans-serif;">
                <div style="width: 40px; height: 10px; background: #334155; border-radius: 5px; margin: 0 auto 12px auto;"></div>
                
                <!-- Notification pill -->
                <div style="background: rgba(30, 41, 59, 0.95); border-radius: 10px; padding: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; font-size: 9px; color: #94a3b8; font-weight: 600;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                      <div style="width: 12px; height: 12px; background: var(--primary-500); border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: white;">IRL</div>
                      <span>IRL EXPRESS</span>
                    </div>
                    <span>now</span>
                  </div>
                  <div id="preview-title" style="font-size: 11px; font-weight: 700; color: #f8fafc; margin-bottom: 1px;">Notification Title</div>
                  <div id="preview-message" style="font-size: 10px; color: #cbd5e1; line-height: 1.35; white-space: pre-wrap;">Alert body preview text...</div>
                </div>
              </div>
            </div>

            <!-- Send button -->
            <button class="btn btn-primary" id="send-broadcast-btn" style="width: 100%;" ${this.selectedRiders.size === 0 ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Send Alerts
            </button>
          </div>
        </div>
        `}

      </div>
    `;
  },

  buildRiderCardHtml(rider) {
    const isChecked = this.selectedRiders.has(String(rider.id));
    const hasPushToken = !!rider.push_token;
    const isViewer = App.isViewer();
    
    const missingFieldLabels = {
      'noon_id': 'Noon ID',
      'bank_details': 'Bank Account Info',
      'iqama': 'Iqama Details',
      'personal_info': 'Nationality/DOB',
      'emergency_contact': 'Emergency Contact',
      'drivers_license': 'Driver\'s License'
    };

    const hasMissingFields = rider.missing_fields.length > 0;
    const isCompliant = !hasMissingFields && !rider.missing_log;

    return `
      <div class="rider-compliance-card" style="display: flex; gap: 12px; padding: 12px; border: 1px solid ${isChecked ? 'var(--primary-300)' : 'var(--border-light)'}; border-radius: var(--radius-md); background: ${isChecked ? 'var(--primary-50)' : 'var(--bg-card)'}; align-items: center; transition: all 150ms;">
        
        ${isViewer ? '' : `
        <div style="display: flex; align-items: center;">
          <input type="checkbox" class="rider-select-cb" data-id="${rider.id}" style="width: 16px; height: 16px; cursor: pointer;" ${isChecked ? 'checked' : ''}>
        </div>
        `}

        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); cursor: pointer;" class="rider-name-link" data-id="${rider.id}">${Utils.escapeHtml(rider.name)}</span>
            <span style="font-size: 11px; color: var(--text-tertiary); font-weight: 500;">(Noon ID: ${Utils.escapeHtml(rider.noon_id || 'Not set')})</span>
            
            ${hasPushToken ? `
              <span title="Mobile token active (Push Notification enabled)" style="display: inline-flex; color: var(--success-500);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </span>
            ` : `
              <span title="No push token (In-app feed alert only)" style="display: inline-flex; color: var(--gray-400);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M18.84 12A8.9 8.9 0 0 0 20 8.77m-2-4a8.9 8.9 0 0 0-4-2M12 2a9 9 0 0 0-9 9m1.78 4A8.9 8.9 0 0 0 6 18.77m2 4a8.9 8.9 0 0 0 4 2M12 22a9 9 0 0 0 9-9"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </span>
            `}
          </div>

          <div style="font-size: 11.5px; color: var(--text-secondary); margin-bottom: 6px;">
            Phone: <strong style="color:var(--text-primary);">${Utils.escapeHtml(rider.phone || '—')}</strong>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            <!-- Daily Log Status -->
            ${rider.missing_log ? `
              <span class="badge" style="background: var(--danger-50); color: var(--danger-600); border: 1px solid var(--danger-100); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Log Missing
              </span>
            ` : `
              <span class="badge" style="background: var(--success-50); color: var(--success-600); border: 1px solid var(--success-100); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Log Submitted
              </span>
            `}

            <!-- Cycle Missing Logs -->
            ${rider.cycle_missing_days > 0 ? `
              <span class="badge" style="background: var(--danger-600); color: white; border: 1px solid var(--danger-700); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Missed ${rider.cycle_missing_days} cycle days
              </span>
            ` : ''}

            <!-- Expiring Documents -->
            ${rider.isExpiring ? `
              <span class="badge" style="background: var(--warning-500); color: white; border: 1px solid var(--warning-600); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Expiring Docs!
              </span>
            ` : ''}

            <!-- Missing fields badges -->
            ${rider.missing_fields.map(field => `
              <span class="badge" style="background: var(--warning-50); color: var(--warning-600); border: 1px solid var(--warning-100); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Missing: ${missingFieldLabels[field] || field}
              </span>
            `).join('')}

            ${isCompliant ? `
              <span class="badge" style="background: var(--success-50); color: var(--success-600); border: 1px solid var(--success-100); font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                Compliant
              </span>
            ` : ''}
          </div>
        </div>

        ${isViewer ? '' : `
        <div>
          <button class="btn btn-outline btn-sm quick-select-btn" data-id="${rider.id}" style="padding: 4px 8px; font-size: 11px;">
            Select
          </button>
        </div>
        `}
      </div>
    `;
  },

  getFilteredRiders() {
    return this.riders.filter(r => {
      const q = this.searchQuery.toLowerCase().trim();
      if (q) {
        const nameMatch = r.name.toLowerCase().includes(q);
        const phoneMatch = r.phone && r.phone.includes(q);
        const noonIdMatch = r.noon_id && r.noon_id.toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !noonIdMatch) return false;
      }

      if (this.filterCategory === 'missing_log') return r.cycle_missing_days > 0 || r.missing_log;
      if (this.filterCategory === 'missing_profile') return r.missing_fields.length > 0;
      if (this.filterCategory === 'expiring') return r.isExpiring;
      if (this.filterCategory === 'compliant') return r.missing_fields.length === 0 && (!r.cycle_missing_days || r.cycle_missing_days === 0);

      return true;
    });
  },

  attachEventListeners() {
    // 1. Refresh Button
    document.getElementById('refresh-compliance-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refresh-compliance-btn');
      btn.disabled = true;
      const origText = btn.innerHTML;
      btn.innerHTML = `<div class="spinner-sm" style="margin-right:6px;"></div>Loading...`;
      try {
        await this.loadData();
        this.renderUI(document.getElementById('page-notifications'));
        this.attachEventListeners();
        Utils.showToast('Compliance checks re-calculated', 'success');
      } catch (err) {
        Utils.showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    });

    // 2. Search Field
    const searchInput = document.getElementById('compliance-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.updateRiderList();
    });

    // 3. Date Picker
    const datePicker = document.getElementById('compliance-date-picker');
    datePicker?.addEventListener('change', async (e) => {
      this.date = e.target.value;
      const root = document.getElementById('page-notifications');
      root.innerHTML = `<div class="p-24 text-center"><div class="spinner" style="margin: 0 auto 12px auto;"></div><p class="text-secondary">Loading target date compliance...</p></div>`;
      try {
        await this.loadData();
        this.renderUI(root);
        this.attachEventListeners();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        root.innerHTML = `<div class="p-24 text-center" style="color:var(--danger)">Failed to update target date: ${err.message}</div>`;
      }
    });

    // 4. Tab filters
    const setupTabFilter = (btnId, cat) => {
      document.getElementById(btnId)?.addEventListener('click', () => {
        this.filterCategory = cat;
        ['filter-all-btn', 'filter-log-btn', 'filter-profile-btn', 'filter-expiring-btn', 'filter-compliant-btn'].forEach(id => {
          const btn = document.getElementById(id);
          if (btn) {
            btn.classList.toggle('btn-primary', id === btnId);
            btn.classList.toggle('btn-ghost', id !== btnId);
          }
        });
        this.updateRiderList();
      });
    };
    setupTabFilter('filter-all-btn', 'all');
    setupTabFilter('filter-log-btn', 'missing_log');
    setupTabFilter('filter-profile-btn', 'missing_profile');
    setupTabFilter('filter-expiring-btn', 'expiring');
    setupTabFilter('filter-compliant-btn', 'compliant');

    // 5. Select All Checkbox
    const selectAllCb = document.getElementById('select-all-riders');
    selectAllCb?.addEventListener('change', (e) => {
      const filtered = this.getFilteredRiders();
      if (e.target.checked) {
        filtered.forEach(r => this.selectedRiders.add(String(r.id)));
      } else {
        filtered.forEach(r => this.selectedRiders.delete(String(r.id)));
      }
      this.updateRiderList();
      this.onSelectionChanged();
    });

    // 6. Checked rows listeners
    const root = document.getElementById('page-notifications');
    root?.addEventListener('change', (e) => {
      if (e.target.classList.contains('rider-select-cb')) {
        const id = String(e.target.dataset.id);
        if (e.target.checked) {
          this.selectedRiders.add(id);
        } else {
          this.selectedRiders.delete(id);
        }
        this.onSelectionChanged();
        
        // Highlight row
        const card = e.target.closest('.rider-compliance-card');
        if (card) {
          card.style.background = e.target.checked ? 'var(--primary-50)' : 'var(--bg-card)';
          card.style.borderColor = e.target.checked ? 'var(--primary-300)' : 'var(--border-light)';
        }
      }
    });

    // 7. Quick Select Button
    root?.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-select-btn')) {
        const id = String(e.target.dataset.id);
        const cb = document.querySelector(`.rider-select-cb[data-id="${id}"]`);
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // 8. Link redirect to profile
    root?.addEventListener('click', (e) => {
      if (e.target.classList.contains('rider-name-link')) {
        const id = String(e.target.dataset.id);
        const rider = this.riders.find(r => String(r.id) === id);
        if (rider) {
          App.navigate('riders');
          setTimeout(() => {
            if (typeof Riders !== 'undefined' && Riders.openProfile) {
              Riders.openProfile(rider);
            }
          }, 350);
        }
      }
    });

    // 9. Composer Preset Selector
    const presetDropdown = document.getElementById('composer-preset');
    presetDropdown?.addEventListener('change', () => {
      this.applyPreset(presetDropdown.value);
    });

    // 10. Composer Input changes update phone preview
    const titleInput = document.getElementById('composer-title');
    const messageTextarea = document.getElementById('composer-message');
    
    const updatePreview = () => {
      const previewTitle = document.getElementById('preview-title');
      const previewMsg = document.getElementById('preview-message');
      
      if (previewTitle) previewTitle.textContent = titleInput.value.trim() || 'Notification Title';
      if (previewMsg) previewMsg.textContent = messageTextarea.value.trim() || 'Alert body preview text...';
    };

    titleInput?.addEventListener('input', updatePreview);
    messageTextarea?.addEventListener('input', updatePreview);

    // 11. Send Broadcast Trigger
    document.getElementById('send-broadcast-btn')?.addEventListener('click', () => this.sendBroadcastAlerts());
  },

  updateRiderList() {
    const listWrapper = document.getElementById('riders-list-wrapper') || document.querySelector('.card div[style*="max-height: 580px"]');
    if (!listWrapper) return;

    const filtered = this.getFilteredRiders();
    
    // Sync Select All checkbox
    const selectAllCb = document.getElementById('select-all-riders');
    if (selectAllCb) {
      selectAllCb.checked = filtered.length > 0 && filtered.every(r => this.selectedRiders.has(String(r.id)));
    }

    if (filtered.length === 0) {
      listWrapper.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;margin: 0 auto 12px auto;color:var(--gray-300);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <p>No active riders match compliance filters.</p>
        </div>
      `;
    } else {
      listWrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;" id="riders-list-wrapper">
          ${filtered.map(r => this.buildRiderCardHtml(r)).join('')}
        </div>
      `;
    }
  },

  onSelectionChanged() {
    const countEl = document.getElementById('composer-selection-count');
    const sendBtn = document.getElementById('send-broadcast-btn');
    const size = this.selectedRiders.size;

    if (countEl) {
      countEl.textContent = `${size} rider${size === 1 ? '' : 's'} selected for notification.`;
      countEl.className = `alert-item ${size > 0 ? 'info' : 'warning'}`;
    }

    if (sendBtn) {
      sendBtn.disabled = size === 0;
    }

    // Dynamic adjustment of preset greetings if selection size changes
    const presetSelect = document.getElementById('composer-preset');
    if (presetSelect && presetSelect.value !== 'custom') {
      this.applyPreset(presetSelect.value);
    }
  },

  applyPreset(preset) {
    const titleInput = document.getElementById('composer-title');
    const messageTextarea = document.getElementById('composer-message');
    if (!titleInput || !messageTextarea) return;

    if (preset === 'custom') {
      titleInput.value = '';
      messageTextarea.value = '';
    } else {
      let greeting = 'Rider';
      let missingFieldsStr = '';

      if (this.selectedRiders.size === 1) {
        const targetId = Array.from(this.selectedRiders)[0];
        const r = this.riders.find(x => String(x.id) === String(targetId));
        if (r) {
          greeting = r.name.split(' ')[0];
          
          const missingFieldLabels = {
            'noon_id': 'Noon ID',
            'bank_details': 'Bank Account Info',
            'iqama': 'Iqama Details',
            'personal_info': 'Nationality/Date of birth',
            'emergency_contact': 'Emergency Contact details',
            'drivers_license': 'Driver\'s License details'
          };
          missingFieldsStr = r.missing_fields.map(f => missingFieldLabels[f] || f).join(', ');
        }
      } else {
        greeting = 'Rider';
        missingFieldsStr = 'required compliance credentials';
      }

      if (preset === 'log_missing') {
        titleInput.value = 'Action Required: Missing Daily Logs';
        
        // Find maximum cycle missing days across selected riders if multiple
        let maxDays = 1;
        if (this.selectedRiders.size === 1) {
          const targetId = Array.from(this.selectedRiders)[0];
          const r = this.riders.find(x => String(x.id) === String(targetId));
          if (r && r.cycle_missing_days) maxDays = r.cycle_missing_days;
        } else {
          Array.from(this.selectedRiders).forEach(id => {
            const r = this.riders.find(x => String(x.id) === String(id));
            if (r && r.cycle_missing_days && r.cycle_missing_days > maxDays) maxDays = r.cycle_missing_days;
          });
        }
        
        messageTextarea.value = `Hi ${greeting},\n\nYou have missed submitting ${maxDays} daily delivery log(s) this cycle. Please open the Rider App, navigate to the portal, and submit your logs immediately to avoid any salary deductions!`;
      } 
      else if (preset === 'profile_missing') {
        titleInput.value = 'Incomplete Profile Information';
        messageTextarea.value = `Hi ${greeting},\n\nYour profile details are currently incomplete in our system. Please check your profile and fill in the missing fields: ${missingFieldsStr || 'Noon ID, Bank Account details, or Iqama Info'}.\n\nYou can edit these fields directly in the Rider App profile tab.`;
      } 
      else if (preset === 'extra_missing') {
        titleInput.value = 'Emergency Contact & Driver\'s License Required';
        messageTextarea.value = `Hi ${greeting},\n\nWe require emergency contact details and driver's license tracking for safety and compliance audit purposes. \n\nPlease open the Rider App, click the Profile tab, and fill in the "Emergency Contact & License" section. Thank you!`;
      }
      else if (preset === 'expiring_docs') {
        titleInput.value = 'URGENT: Document Expiring Soon!';
        messageTextarea.value = `Hi ${greeting},\n\nOur system detected that one of your essential documents (Iqama, Driver's License, or Bike Insurance) is expiring within the next 15 days!\n\nPlease renew your documents and update your profile in the Rider App immediately to avoid suspension.`;
      }
      else if (preset === 'runaway') {
        titleInput.value = 'FINAL WARNING: No Activity Detected';
        messageTextarea.value = `Hi ${greeting},\n\nYou have not submitted logs or shown activity for multiple consecutive days. This is a severe violation of company policy.\n\nPlease contact your supervisor immediately or your account will be suspended and legal action may be taken.`;
      }
      else if (preset === 'urdu_log_missing') {
        titleInput.value = '⚠️ URGENT: Aaj Ka Delivery Log Missing Hai!';
        messageTextarea.value = `Assalam-o-Alaikum ${greeting},\n\nAap ne aaj ka daily delivery log abhi tak submit nahi kiya hai. 📝\n\nAap se guzarish hai ke fauran Rider App open karein aur aaj ki total deliveries aur screenshot upload kar ke apna log submit karein. 📲\n\nYad rahe, agar log time par submit nahi hoga to attendance lagne me masla ho sakta hai aur salary deduction ho sakti hai. 💸\n\nShukriya! 🤝`;
      }
      else if (preset === 'urdu_cycle_missing') {
        titleInput.value = '🚨 WARNING: Pichle Dino Ke Logs Missing Hain!';
        let maxDays = 1;
        if (this.selectedRiders.size === 1) {
          const targetId = Array.from(this.selectedRiders)[0];
          const r = this.riders.find(x => String(x.id) === String(targetId));
          if (r && r.cycle_missing_days) maxDays = r.cycle_missing_days;
        } else {
          Array.from(this.selectedRiders).forEach(id => {
            const r = this.riders.find(x => String(x.id) === String(id));
            if (r && r.cycle_missing_days && r.cycle_missing_days > maxDays) maxDays = r.cycle_missing_days;
          });
        }
        messageTextarea.value = `Hi ${greeting},\n\nHamare system ke mutabik aap ke is cycle ke pichle ${maxDays} dino ke delivery logs abhi tak received nahi hue hain. 📉\n\nLogs missing hone ki wajah se aap ki performance report incomplete hai. Fauran Rider App open kar ke "Daily Log" section me jaaen aur tamam unlogged days ka data clear karein. 📅\n\nAgar koi masla ho to LA ya supervisor se rabta karein. Ise jald az jald poora karein taake salary delay na ho! ⏳\n\nJazakAllah! 🙏`;
      }
      else if (preset === 'urdu_profile_missing') {
        titleInput.value = '🔒 ACTION REQUIRED: Profile Details Mukammal Karein';
        messageTextarea.value = `Assalam-o-Alaikum ${greeting},\n\nAap ki profile details abhi tak system me mukammal nahi hain. 👤\n\nSalary transfer aur compliance ke liye in details ka hona lazmi hai. Meharbani kar ke fauran Rider App ke Profile tab me jaaen aur missing fields [${missingFieldsStr || 'Noon ID, Bank Account, ya Iqama Info'}] ko update karein. 💳\n\nApp par details enter karna asaan aur safe hai. Please ise aaj hi mukammal karein! 🚀\n\nBest regards,\nIRL Team`;
      }
      else if (preset === 'urdu_docs_expiring') {
        titleInput.value = '📅 Document Expire Hone Wala Hai — Renew Karein!';
        messageTextarea.value = `Hi ${greeting},\n\nAap ka Iqama, Driver's License, ya Bike Insurance aglay 15 dinon ke andar expire hone wala hai. ⚠️\n\nKaam jari rakhne ke liye documents ka valid hona zaroori hai. Fauran apne documents renew karwaen aur new copies Rider App me update karein. 📝\n\nExpiry ke baad system aap ki profile ko auto-suspend kar dega jis se aap duty nahi kar sakenge. Kisi bhi pareshani se bachne ke liye aaj hi renew karein! ⏱️\n\nShukriya!`;
      }
      else if (preset === 'urdu_inactive_warning') {
        titleInput.value = '⛔ FINAL WARNING: System Me Activity Nahi Hai!';
        messageTextarea.value = `Hi ${greeting},\n\nAap pichle kuch dino se duty par active nahi hain aur na hi koi log submit kiya hai. 🚫\n\nYe company policy ki khilaf-warzi hai. Agar aap kisi wajah se chutti par hain to apne supervisor ko fauran inform karein. 📞\n\nAgar aglay 24 ghante me aap ka koi response ya log nahi mila, to aap ki ID block (suspend) kar di jayegi aur legal action liya ja sakta hai. 🔒\n\nFauran supervisor se rabta karein!`;
      }
    }

    // Trigger input events to update mockup display
    titleInput.dispatchEvent(new Event('input'));
    messageTextarea.dispatchEvent(new Event('input'));
  },

  async sendBroadcastAlerts() {
    if (App.isViewer()) return;
    const titleInput = document.getElementById('composer-title');
    const messageTextarea = document.getElementById('composer-message');
    const sendBtn = document.getElementById('send-broadcast-btn');
    
    if (!titleInput || !messageTextarea || !sendBtn) return;
    
    const title = titleInput.value.trim();
    const message = messageTextarea.value.trim();
    const targetRiders = Array.from(this.selectedRiders);

    if (targetRiders.length === 0) {
      Utils.showToast('Please select at least one rider to alert.', 'warning');
      return;
    }
    if (!title || !message) {
      Utils.showToast('Notification Title and Message cannot be empty.', 'warning');
      return;
    }

    sendBtn.disabled = true;
    const origHtml = sendBtn.innerHTML;
    sendBtn.innerHTML = `<div class="spinner-sm" style="margin-right:6px;"></div>Sending...`;

    try {
      const res = await API.sendRiderNotification(targetRiders, title, message);
      
      const results = res.results || [];
      const pushCount = results.filter(r => r.success && r.push_sent).length;
      const inAppCount = results.filter(r => r.success).length;

      Utils.showToast(`Alerts broadcasted! Succeeded: ${inAppCount} in-app alerts logged, ${pushCount} push notifications sent via Expo.`, 'success');
      
      // Reset composer & clear selections
      titleInput.value = '';
      messageTextarea.value = '';
      this.selectedRiders.clear();
      
      const presetSelect = document.getElementById('composer-preset');
      if (presetSelect) presetSelect.value = 'custom';

      // Re-render UI
      const container = document.getElementById('page-notifications');
      this.renderUI(container);
      this.attachEventListeners();
    } catch (err) {
      Utils.showToast(`Failed to dispatch notifications: ${err.message}`, 'error');
      sendBtn.disabled = false;
      sendBtn.innerHTML = origHtml;
    }
  }
};
