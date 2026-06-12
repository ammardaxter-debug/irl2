// ========================================
//  FLEET MANAGEMENT - Bikes Tracking
// ========================================

const Bikes = {
  bikes: [],
  searchQuery: '',
  currentFilter: 'all',

  async render() {
    const container = document.getElementById('page-fleet');
    container.innerHTML = '<div class="skeleton" style="height:300px"></div>';

    try {
      this.bikes = await API.getBikes();
      container.innerHTML = this.buildHTML();
      this.attachEvents();
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load fleet data: ${err.message}</p></div>`;
    }
  },

  buildHTML() {
    const today = new Date().toISOString().split('T')[0];
    
    // Process expiries
    const bikesWithStatus = this.bikes.map(b => {
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
      
      return { ...b, daysUntilExpiry, daysUntilAuthExpiry, worstExpiry };
    });

    // Filtering
    let filtered = bikesWithStatus;
    if (this.currentFilter === 'active') filtered = filtered.filter(b => b.status === 'active');
    if (this.currentFilter === 'maintenance') filtered = filtered.filter(b => b.status === 'maintenance');
    if (this.currentFilter === 'expiring') filtered = filtered.filter(b => b.worstExpiry <= 30 && b.worstExpiry >= 0);
    if (this.currentFilter === 'unassigned') filtered = filtered.filter(b => !b.assigned_rider_id);

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        (b.plate_number && b.plate_number.toLowerCase().includes(q)) ||
        (b.model && b.model.toLowerCase().includes(q))
      );
    }

    // Stats
    const activeStatus = this.bikes.filter(b => b.status === 'active').length;
    const maintenanceStatus = this.bikes.filter(b => b.status === 'maintenance').length;
    const expiringSoon = bikesWithStatus.filter(b => b.worstExpiry <= 30 && b.worstExpiry >= 0).length;
    const unassignedCount = this.bikes.filter(b => !b.assigned_rider_id).length;

    return `
      <!-- Stats Row -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <div class="card stat-card blue">
          <div class="stat-card-header"><span class="stat-card-label">Total Bikes</span></div>
          <div class="stat-card-value">${this.bikes.length}</div>
        </div>
        <div class="card stat-card green">
          <div class="stat-card-header"><span class="stat-card-label">Active / On Road</span></div>
          <div class="stat-card-value">${activeStatus}</div>
        </div>
        <div class="card stat-card orange">
          <div class="stat-card-header"><span class="stat-card-label">Maintenance</span></div>
          <div class="stat-card-value">${maintenanceStatus}</div>
        </div>
        <div class="card stat-card slate">
          <div class="stat-card-header"><span class="stat-card-label">Unassigned</span></div>
          <div class="stat-card-value">${unassignedCount}</div>
        </div>
        <div class="card stat-card ${expiringSoon > 0 ? 'rose' : 'slate'}">
          <div class="stat-card-header"><span class="stat-card-label">Docs Expiring</span></div>
          <div class="stat-card-value">${expiringSoon}</div>
        </div>
      </div>

      <!-- Controls -->
      <div class="page-controls mt-24">
        <div class="search-bar">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="bike-search" class="search-input" placeholder="Search plate or model..." value="${this.searchQuery}">
        </div>
        <div class="filters">
          <button class="filter-chip ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All Bikes</button>
          <button class="filter-chip ${this.currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
          <button class="filter-chip ${this.currentFilter === 'maintenance' ? 'active' : ''}" data-filter="maintenance">Maintenance</button>
          <button class="filter-chip ${this.currentFilter === 'unassigned' ? 'active' : ''}" data-filter="unassigned">Unassigned</button>
          <button class="filter-chip ${this.currentFilter === 'expiring' ? 'active' : ''}" data-filter="expiring">Expiring Soon</button>
        </div>
        ${App.isViewer() ? '' : `
        <button class="btn btn-primary" id="btn-add-bike">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Bike
        </button>
        `}
      </div>

      <!-- Bike Grid -->
      <div class="dashboard-grid mt-24" id="bikes-grid" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); align-items: start;">
        ${this.buildBikeCards(filtered)}
      </div>
    `;
  },

  buildBikeCards(bikes) {
    if (bikes.length === 0) {
      if (this.bikes.length === 0) {
        return `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px;"><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4M12 8v8"/></svg>
            <p style="margin-top: 16px;">No bikes in your fleet yet.</p>
            <p style="margin-top: 8px;">Click "Add New Bike" to start tracking.</p>
          </div>
        `;
      }
      return '<div class="empty-state" style="grid-column: 1 / -1;"><p>No bikes match your filters.</p></div>';
    }

    return bikes.map((bike, index) => {
      let expiryClass = '';
      let healthDot = '<span class="health-dot success"></span>';
      let expiryText = 'Valid & Secure';
      
      if (bike.worstExpiry < 0) {
         expiryClass = 'color: var(--danger-600); font-weight: bold;';
         healthDot = '<span class="health-dot danger" title="Document Expired!"></span>';
         expiryText = 'EXPIRED!';
      } else if (bike.worstExpiry <= 30) {
         expiryClass = 'color: var(--warning-600); font-weight: bold;';
         healthDot = '<span class="health-dot warning" title="Expiring Soon"></span>';
         expiryText = `Expiring (${bike.worstExpiry} days)`;
      }

      // Status Badge
      const statusBadge = bike.status === 'active' 
          ? `<span style="background:#F0FDF4; color:#16A34A; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Active</span>`
          : bike.status === 'maintenance' 
          ? `<span style="background:#FFFBEB; color:#D97706; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Maintenance</span>`
          : `<span style="background:#F3F4F6; color:#6B7280; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Retired</span>`;

      // Authorization Status Badge
      const authDays = Utils.daysUntil(bike.authorization_expiry);
      const hasAuth = !!bike.authorization_expiry;
      let authBadge = '';
      if (hasAuth && authDays >= 0) {
        authBadge = `<span style="background:#E6F4EA; color:#137333; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Authorized</span>`;
      } else if (hasAuth && authDays < 0) {
        authBadge = `<span style="background:#FCE8E6; color:#C5221F; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Expired</span>`;
      } else {
        authBadge = `<span style="background:#FEF7E0; color:#B06000; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px;">Pending</span>`;
      }

      const authAlert = bike.daysUntilAuthExpiry <= 30 ? 'color: var(--danger-600); font-weight: bold;' : '';
      const insAlert = bike.daysUntilExpiry <= 30 ? 'color: var(--danger-600); font-weight: bold;' : '';

      return `
        <div class="rider-card-new bike-card" style="cursor: pointer; animation: slideUp 300ms ease both; animation-delay: ${index * 30}ms;" data-id="${bike.id}">
          <div style="display:flex; align-items:center; gap: 12px; margin-bottom: 16px;">
            <div style="width:40px; height:40px; border-radius:8px; background:#F3F4F6; display:flex; align-items:center; justify-content:center; color:#6B7280;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:15px; font-weight:600; color:#0F0F0F; margin-bottom:4px;">${Utils.escapeHtml(bike.plate_number)}</div>
              <div style="display:flex; gap:6px; flex-wrap: wrap;">
                ${statusBadge}
                ${authBadge}
                ${bike.model ? `<span style="background:#F3F4F6; color:#6B7280; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">${Utils.escapeHtml(bike.model)}</span>` : ''}
              </div>
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom: 16px;">
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Health Status</div>
              <div style="font-size:13px; font-weight:500; ${expiryClass}">${healthDot} ${expiryText}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Assigned Rider</div>
              <div style="font-size:13px; font-weight:500; color:#374151;">${bike.assigned_rider_name || 'Unassigned'}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Authorization</div>
              <div style="font-size:13px; font-weight:500; ${authAlert ? authAlert : 'color:#374151;'}">${bike.authorization_expiry ? Utils.formatDateShort(bike.authorization_expiry) : '—'}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Insurance</div>
              <div style="font-size:13px; font-weight:500; ${insAlert ? insAlert : 'color:#374151;'}">${bike.insurance_expiry ? Utils.formatDateShort(bike.insurance_expiry) : '—'}</div>
            </div>
          </div>

          <!-- Quick Actions -->
          ${App.isViewer() ? '' : `
            <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; display: flex; gap: 8px;">
              ${bike.assigned_rider_id ? `
                <button class="btn btn-outline btn-sm btn-unassign-bike" data-id="${bike.id}" style="color: var(--danger-600); border-color: var(--danger-200); width: 100%; height: 32px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                  Unassign Rider
                </button>
              ` : `
                <button class="btn btn-outline btn-sm btn-assign-bike" data-id="${bike.id}" style="color: var(--primary-600); border-color: var(--primary-200); width: 100%; height: 32px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Assign Rider
                </button>
              `}
            </div>
          `}
        </div>
      `;
    }).join('');
  },

  attachEvents() {
    // Search
    const searchInput = document.getElementById('bike-search');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value;
      this.render(); // Simple re-render for now
    }, 200));

    // Filters
    document.querySelectorAll('#page-fleet .filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentFilter = chip.dataset.filter;
        this.render();
      });
    });

    // Add Bike
    document.getElementById('btn-add-bike')?.addEventListener('click', () => this.openBikeForm(null));

    // Card Clicks (Open Edit modal)
    document.querySelectorAll('.bike-card').forEach(card => {
      card.addEventListener('click', () => {
        const bike = this.bikes.find(b => b.id === parseInt(card.dataset.id));
        if (bike) this.openBikeForm(bike);
      });
    });

    // Assign Rider Clicks
    document.querySelectorAll('.btn-assign-bike').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Stop opening edit modal
        const bikeId = parseInt(btn.dataset.id);
        const bike = this.bikes.find(b => b.id === bikeId);
        
        try {
          Utils.showLoading('Loading active riders');
          const activeRiders = await API.getRiders('active');
          const availableRiders = activeRiders.filter(r => !r.bike_id);
          Utils.hideLoading();
          
          if (availableRiders.length === 0) {
            alert('All active riders already have a bike assigned.');
            return;
          }
          
          const html = `
            <div style="padding: 4px;">
              <p style="font-size: 14px; margin-bottom: 16px; color: #4B5563;">
                Assign bike <strong>${bike.plate_number}</strong> to a rider.
              </p>
              <div class="form-group" style="margin-bottom: 16px;">
                <label>Select Rider</label>
                <select id="assign-rider-select" class="form-select">
                  <option value="">-- Choose Rider --</option>
                  ${availableRiders.map(r => `<option value="${r.id}">${r.name} (${r.noon_id || 'No ID'})</option>`).join('')}
                </select>
              </div>
              <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button id="btn-confirm-assign" class="btn btn-primary" disabled>Confirm Assignment</button>
              </div>
            </div>
          `;
          
          Utils.openModal('Assign Rider to Bike', html);
          
          const select = document.getElementById('assign-rider-select');
          const confirmBtn = document.getElementById('btn-confirm-assign');
          
          select.addEventListener('change', () => {
            confirmBtn.disabled = !select.value;
          });
          
          confirmBtn.addEventListener('click', async () => {
            const riderId = select.value;
            try {
              Utils.showLoading('Assigning bike');
              await API.assignBike(bikeId, riderId);
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
      });
    });

    // Unassign Rider Clicks
    document.querySelectorAll('.btn-unassign-bike').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Stop opening edit modal
        const bikeId = parseInt(btn.dataset.id);
        const bike = this.bikes.find(b => b.id === bikeId);
        
        if (confirm(`Are you sure you want to unassign bike ${bike.plate_number} from ${bike.assigned_rider_name}?`)) {
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
  },

  openBikeForm(bike) {
    const isEdit = !!bike;
    const isViewer = App.isViewer();

    const html = `
      <form id="bike-form" class="form-grid">
        <div class="form-group">
          <label>Plate Number <span class="required">*</span></label>
          <input type="text" id="bf-plate" class="form-control" ${isViewer ? 'disabled' : ''} required value="${isEdit ? Utils.escapeHtml(bike.plate_number) : ''}" placeholder="e.g. ABC 1234">
        </div>
        <div class="form-group">
          <label>Bike Model</label>
          <input type="text" id="bf-model" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit ? Utils.escapeHtml(bike.model || '') : ''}" placeholder="e.g. Honda 2023">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="bf-status" class="form-select" ${isViewer ? 'disabled' : ''}>
            <option value="active" ${isEdit && bike.status === 'active' ? 'selected' : ''}>Active (On Road)</option>
            <option value="maintenance" ${isEdit && bike.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="retired" ${isEdit && bike.status === 'retired' ? 'selected' : ''}>Retired / Sold</option>
          </select>
        </div>
        <div class="form-group">
          <label>Insurance Start Date</label>
          <input type="date" id="bf-ins-start" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.insurance_start ? bike.insurance_start : ''}">
        </div>
        <div class="form-group">
          <label>Authorization Expiry</label>
          <input type="date" id="bf-auth-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.authorization_expiry ? bike.authorization_expiry : ''}">
        </div>
        <div class="form-group">
          <label>Insurance Expiry Date</label>
          <input type="date" id="bf-ins-expiry" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit && bike.insurance_expiry ? bike.insurance_expiry : ''}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Notes</label>
          <input type="text" id="bf-notes" class="form-control" ${isViewer ? 'disabled' : ''} value="${isEdit ? Utils.escapeHtml(bike.notes || '') : ''}" placeholder="Any service notes...">
        </div>
        
        <div class="form-actions mt-24" style="grid-column: 1 / -1;">
          ${isEdit && !isViewer ? `<button type="button" class="btn btn-danger" id="bf-delete" style="margin-right: auto;">Delete Bike</button>` : '<div></div>'}
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Close</button>
          ${isViewer ? '' : `<button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Bike'}</button>`}
        </div>
      </form>
    `;

    Utils.openModal(isEdit ? 'Edit Bike Details' : 'Register New Bike', html);

    document.getElementById('bike-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (App.isViewer()) return;
      
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
         submitBtn.disabled = true;
         submitBtn.innerText = 'Saving...';
      }
      
      const payload = {
        plate_number: document.getElementById('bf-plate').value.trim(),
        model: document.getElementById('bf-model').value.trim(),
        status: document.getElementById('bf-status').value,
        insurance_start: document.getElementById('bf-ins-start').value || null,
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
        if (submitBtn) {
           submitBtn.disabled = false;
           submitBtn.innerText = isEdit ? 'Save Changes' : 'Add Bike';
        }
      }
    });

    if (isEdit && !isViewer) {
      document.getElementById('bf-delete')?.addEventListener('click', async () => {
        if (App.isViewer()) return;
        if (confirm(`Are you sure you want to completely delete bike ${bike.plate_number}?`)) {
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
  }
};
