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
      return { ...b, daysUntilExpiry };
    });

    // Filtering
    let filtered = bikesWithStatus;
    if (this.currentFilter === 'active') filtered = filtered.filter(b => b.status === 'active');
    if (this.currentFilter === 'maintenance') filtered = filtered.filter(b => b.status === 'maintenance');
    if (this.currentFilter === 'expiring') filtered = filtered.filter(b => b.daysUntilExpiry <= 30 && b.daysUntilExpiry >= 0);

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
    const expiringSoon = bikesWithStatus.filter(b => b.daysUntilExpiry <= 30 && b.daysUntilExpiry >= 0).length;

    return `
      <!-- Stats Row -->
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
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
        <div class="card stat-card ${expiringSoon > 0 ? 'rose' : 'slate'}">
          <div class="stat-card-header"><span class="stat-card-label">Insurance Expiring</span></div>
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
          <button class="filter-chip ${this.currentFilter === 'expiring' ? 'active' : ''}" data-filter="expiring">Expiring Soon</button>
        </div>
        <button class="btn btn-primary" id="btn-add-bike">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Bike
        </button>
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
      
      if (bike.daysUntilExpiry < 0) {
         expiryClass = 'color: var(--danger-600); font-weight: bold;';
         healthDot = '<span class="health-dot danger" title="Insurance Expired!"></span>';
         expiryText = 'EXPIRED!';
      } else if (bike.daysUntilExpiry <= 30) {
         expiryClass = 'color: var(--warning-600); font-weight: bold;';
         healthDot = '<span class="health-dot warning" title="Expiring Soon"></span>';
         expiryText = `Expiring (${bike.daysUntilExpiry} days)`;
      }

      const statusBadge = bike.status === 'active' ? '<span class="badge badge-success">● Active</span>' :
                          bike.status === 'maintenance' ? '<span class="badge badge-warning">⚙ Maintenance</span>' :
                          '<span class="badge badge-slate">○ Retired</span>';

      return `
        <div class="card section-card bike-card" style="cursor: pointer; animation: slideUp 300ms ease both; animation-delay: ${index * 40}ms;" data-id="${bike.id}">
          <div class="section-header" style="margin-bottom: 16px;">
            <div style="display:flex; align-items:center; gap: 12px;">
              <div style="width: 48px; height: 48px; background: var(--slate-100); border-radius: 8px; display:flex; align-items:center; justify-content:center; color: var(--slate-500);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
              </div>
              <div>
                <h3 style="margin:0; font-size: 18px;">${Utils.escapeHtml(bike.plate_number)}</h3>
                <div style="font-size: 13px; color: var(--slate-500); margin-top:4px;">${Utils.escapeHtml(bike.model) || 'Unknown Model'}</div>
              </div>
            </div>
            ${statusBadge}
          </div>
          
          <div style="display:flex; flex-direction: column; gap: 8px; font-size: 14px; padding: 12px; background: var(--slate-50); border-radius: 8px;">
            <div style="display:flex; justify-content: space-between; align-items:center;">
              <span style="color: var(--slate-500)">Health Status:</span>
              <span style="${expiryClass} display:flex; align-items:center;">${healthDot} ${expiryText}</span>
            </div>
            <div style="display:flex; justify-content: space-between;">
              <span style="color: var(--slate-500)">Insurance Expiry:</span>
              <span style="${expiryClass}">${bike.insurance_expiry ? Utils.formatDateShort(bike.insurance_expiry) : '—'}</span>
            </div>
          </div>
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

    // Card Clicks
    document.querySelectorAll('.bike-card').forEach(card => {
      card.addEventListener('click', () => {
        const bike = this.bikes.find(b => b.id === parseInt(card.dataset.id));
        if (bike) this.openBikeForm(bike);
      });
    });
  },

  openBikeForm(bike) {
    const isEdit = !!bike;
    
    // We need to fetch riders to see who could be assigned this bike, if we were taking a rider-centric approach here.
    // However, the rider form is where bike assignment happens generally.
    // Here we'll just focus on the bike details.

    const html = `
      <form id="bike-form" class="form-grid">
        <div class="form-group">
          <label>Plate Number <span class="required">*</span></label>
          <input type="text" id="bf-plate" class="form-control" required value="${isEdit ? Utils.escapeHtml(bike.plate_number) : ''}" placeholder="e.g. ABC 1234">
        </div>
        <div class="form-group">
          <label>Bike Model</label>
          <input type="text" id="bf-model" class="form-control" value="${isEdit ? Utils.escapeHtml(bike.model || '') : ''}" placeholder="e.g. Honda 2023">
        </div>
        <div class="form-group">
          <label>Status</label>
          <select id="bf-status" class="form-select">
            <option value="active" ${isEdit && bike.status === 'active' ? 'selected' : ''}>Active (On Road)</option>
            <option value="maintenance" ${isEdit && bike.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
            <option value="retired" ${isEdit && bike.status === 'retired' ? 'selected' : ''}>Retired / Sold</option>
          </select>
        </div>
        <div class="form-group">
          <label>Insurance Start Date</label>
          <input type="date" id="bf-ins-start" class="form-control" value="${isEdit && bike.insurance_start ? bike.insurance_start : ''}">
        </div>
        <div class="form-group">
          <label>Insurance Expiry Date</label>
          <input type="date" id="bf-ins-expiry" class="form-control" value="${isEdit && bike.insurance_expiry ? bike.insurance_expiry : ''}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Notes</label>
          <input type="text" id="bf-notes" class="form-control" value="${isEdit ? Utils.escapeHtml(bike.notes || '') : ''}" placeholder="Any service notes...">
        </div>
        
        <div class="form-actions mt-24" style="grid-column: 1 / -1;">
          ${isEdit ? `<button type="button" class="btn btn-danger" id="bf-delete" style="margin-right: auto;">Delete Bike</button>` : '<div></div>'}
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Bike'}</button>
        </div>
      </form>
    `;

    Utils.openModal(isEdit ? 'Edit Bike' : 'Register New Bike', html);

    document.getElementById('bike-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
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

    if (isEdit) {
      document.getElementById('bf-delete')?.addEventListener('click', async () => {
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
