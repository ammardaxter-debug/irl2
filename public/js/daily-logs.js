// ========================================
//  DAILY LOGS - Log & track rider data
// ========================================

const DailyLogs = {
  currentDate: null,

  async render() {
    if (!this.currentDate) this.currentDate = Utils.today();
    const container = document.getElementById('page-daily-logs');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:24px;">
         <div class="skeleton skeleton-row" style="width:300px; height:40px;"></div>
         <div class="skeleton skeleton-row" style="width:140px; height:40px;"></div>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:12px;">
         <div class="skeleton skeleton-card" style="height:80px;"></div>
         <div class="skeleton skeleton-card" style="height:80px;"></div>
         <div class="skeleton skeleton-card" style="height:80px;"></div>
      </div>
      <div style="margin-top:24px;">
         <div class="skeleton skeleton-row" style="width:200px; height:24px;"></div>
         <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:12px;">
            <div class="skeleton skeleton-card" style="height:80px;"></div>
            <div class="skeleton skeleton-card" style="height:80px;"></div>
         </div>
      </div>
    `;

    try {
      const [logged, missing] = await Promise.all([
        API.getDailyLogs(this.currentDate),
        API.getMissingLogs(this.currentDate)
      ]);
      container.innerHTML = this.buildHTML(logged, missing);
      this.attachEvents(logged, missing);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load logs: ${err.message}</p></div>`;
    }
  },

  buildHTML(logged, missing) {
    return `
      <!-- Page Header & Actions -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h1 style="font-size:24px; font-weight:bold; color:#0F0F0F;">Daily Logs</h1>
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="background:#FEF3C7; color:#D97706; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600;">${Utils.formatDate(this.currentDate)}</span>
          <button id="bulk-lodge-btn" style="background:#FFFFFF; color:#2563EB; border:1px solid #2563EB; border-radius:12px; padding:0 16px; height:36px; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            Bulk Lodge Data
          </button>
        </div>
      </div>

      <!-- Search Bar & Date Picker Row -->
      <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
        <div style="position:relative; width:100%;">
          <div style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#9CA3AF; pointer-events:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" id="logs-search" placeholder="Search riders by name..." style="width:100%; height:44px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; padding:0 16px 0 44px; font-size:14px; color:#0F0F0F; outline:none; transition:all 0.2s;" onfocus="this.style.background='#FFFFFF'; this.style.borderColor='#2563EB';" onblur="this.style.background='#F9FAFB'; this.style.borderColor='#E5E7EB';">
        </div>

        <div style="display:flex; justify-content:center;">
          <div style="display:flex; align-items:center; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:10px; padding:4px;">
            <button id="date-prev" style="width:32px; height:32px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6B7280; transition:all 0.2s;" onmouseover="this.style.background='#E5E7EB'" onmouseout="this.style.background='transparent'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <input type="date" id="date-picker" value="${this.currentDate}" max="${Utils.today()}" style="border:none; background:transparent; font-size:16px; font-weight:600; color:#0F0F0F; outline:none; text-align:center; cursor:pointer; padding:0 8px;">
            <button id="date-next" ${this.currentDate === Utils.today() ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} style="width:32px; height:32px; border:none; background:transparent; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#6B7280; transition:all 0.2s;" onmouseover="this.style.background='#E5E7EB'" onmouseout="this.style.background='transparent'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <style>
        .log-row-item {
          display: flex;
          align-items: center;
          height: 48px;
          padding: 0 16px;
          border-bottom: 1px solid #F3F4F6;
          transition: background 0.2s;
          cursor: pointer;
        }
        .log-row-item:hover {
          background: #F9FAFB;
        }
        .log-row-item:last-child {
          border-bottom: none;
        }
      </style>

      <!-- Not Logged Section -->
      <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:24px;">
        <div style="display:flex; align-items:center; gap:8px; padding:16px; border-bottom:1px solid #E5E7EB; background:#F9FAFB;">
          <div style="width:8px; height:8px; border-radius:50%; background:#F59E0B;"></div>
          <h2 style="font-size:16px; font-weight:600; color:#0F0F0F; margin:0;">Not Yet Logged</h2>
          <span style="background:#FEF3C7; color:#D97706; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${missing.length} pending</span>
        </div>
        <div id="missing-grid" style="display:flex; flex-direction:column;">
          ${missing.length === 0
            ? `<div style="padding:40px 20px; text-align:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <div style="font-size:15px; font-weight:500; color:#0F0F0F;">All riders logged for this date! 🎉</div>
              </div>`
            : missing.map(r => this.buildMissingCard(r)).join('')
          }
        </div>
      </div>

      <!-- Already Logged Section -->
      <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden; margin-bottom:24px;">
        <div style="display:flex; align-items:center; gap:8px; padding:16px; border-bottom:1px solid #E5E7EB; background:#F9FAFB;">
          <div style="width:8px; height:8px; border-radius:50%; background:#10B981;"></div>
          <h2 style="font-size:16px; font-weight:600; color:#0F0F0F; margin:0;">Logged Today</h2>
          <span style="background:#D1FAE5; color:#059669; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${logged.length} done</span>
        </div>
        <div id="logged-grid" style="display:flex; flex-direction:column;">
          ${logged.length === 0
            ? `<div style="padding:40px 20px; text-align:center;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:48px;height:48px;margin:0 auto 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div style="font-size:15px; font-weight:500; color:#0F0F0F;">No data logged yet for this date</div>
              </div>`
            : logged.map(l => this.buildLoggedCard(l)).join('')
          }
        </div>
      </div>
    `;
  },

  buildMissingCard(rider) {
    const avatarBg = rider.rider_type === 'company' ? '#2563EB' : '#7C3AED';
    const typeBadge = rider.rider_type === 'company' 
         ? `<span style="background:#EFF6FF; color:#2563EB; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Company</span>`
         : `<span style="background:#F5F3FF; color:#7C3AED; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Freelancer</span>`;
    const branchBadge = rider.store_warehouse ? `<span style="color:#9CA3AF; font-size:12px;">• ${Utils.escapeHtml(rider.store_warehouse)}</span>` : '';

    return `
      <div class="log-row-item pending-log log-entry-card" data-rider-id="${rider.id}" data-action="log" data-name="${Utils.escapeHtml(rider.name).toLowerCase()}">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${Utils.getInitials(rider.name)}</div>
          <div style="font-size:14px; font-weight:600; color:#0F0F0F;">${Utils.escapeHtml(rider.name)}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${typeBadge}
            ${branchBadge}
          </div>
        </div>
        <div>
          <button class="log-now-btn" data-rider-id="${rider.id}" data-rider-name="${Utils.escapeHtml(rider.name)}" style="background:#2563EB; color:white; border:none; height:28px; padding:0 12px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:4px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Log
          </button>
        </div>
      </div>
    `;
  },

  buildLoggedCard(log) {
    const totalMinutes = Utils.toMinutes(log.checkin_hours, log.checkin_minutes);
    const isLowCheckin = totalMinutes < 660; // < 11 hours
    const totalOrders = log.primary_orders + log.associate_orders;
    
    // Order Chip Logic (Example minimum: 20 orders is good, 15 borderline, <15 low)
    let orderBg = '#DCFCE7', orderColor = '#16A34A';
    if (totalOrders < 15) { orderBg = '#FEE2E2'; orderColor = '#DC2626'; }
    else if (totalOrders < 20) { orderBg = '#FEF3C7'; orderColor = '#D97706'; }

    // Checkin Chip Logic
    const checkinBg = isLowCheckin ? '#FEE2E2' : '#DCFCE7';
    const checkinColor = isLowCheckin ? '#DC2626' : '#16A34A';

    const avatarBg = log.rider_type === 'company' ? '#2563EB' : '#7C3AED';

    return `
      <div class="log-row-item logged log-entry-card" data-log-id="${log.id}" data-action="edit" data-name="${Utils.escapeHtml(log.rider_name).toLowerCase()}">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${Utils.getInitials(log.rider_name)}</div>
          <div style="font-size:14px; font-weight:600; color:#0F0F0F; ${log.attendance_status !== 'Present' ? 'opacity:0.5;' : ''}">${Utils.escapeHtml(log.rider_name)}</div>
          ${log.attendance_status !== 'Present' ? `<span style="background:#FEF3C7; color:#D97706; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">${log.attendance_status}</span>` : ''}
          ${log.absent_reason ? `<span style="color:#9CA3AF; font-size:12px; font-style:italic;">• ${Utils.escapeHtml(log.absent_reason)}</span>` : ''}
        </div>
        
        <div style="display:flex; align-items:center; gap:8px; ${log.attendance_status !== 'Present' ? 'opacity:0.5;' : ''}">
          <div style="background:${orderBg}; color:${orderColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px;">
            📦 ${totalOrders} Orders
          </div>
          <div style="background:${checkinBg}; color:${checkinColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px;">
            🕒 ${log.checkin_hours}:${String(log.checkin_minutes).padStart(2, '0')} Hrs
          </div>
          ${log.screenshot ? `
          <button class="view-proof-btn" data-log-id="${log.id}" style="background:transparent; border:none; color:#2563EB; cursor:pointer; padding:4px;" title="View Screenshot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>` : ''}
          <button style="background:transparent; border:none; color:#9CA3AF; cursor:pointer; padding:4px;" title="Edit Log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  attachEvents(logged, missing) {
    // Date navigation
    document.getElementById('date-prev')?.addEventListener('click', () => {
      this.currentDate = Utils.shiftDate(this.currentDate, -1);
      this.render();
    });

    document.getElementById('date-next')?.addEventListener('click', () => {
      if (this.currentDate >= Utils.today()) return;
      this.currentDate = Utils.shiftDate(this.currentDate, 1);
      this.render();
    });

    document.getElementById('date-picker')?.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected > Utils.today()) {
        this.currentDate = Utils.today();
      } else {
        this.currentDate = selected;
      }
      this.render();
    });

    // Log buttons for missing riders
    document.querySelectorAll('.log-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const riderId = parseInt(btn.dataset.riderId);
        const riderName = btn.dataset.riderName;
        this.openLogForm(riderId, riderName);
      });
    });

    // Edit logged entries
    document.querySelectorAll('[data-action="edit"]').forEach(card => {
      card.addEventListener('click', (e) => {
        // Ignore if they clicked the view proof button
        if (e.target.closest('.view-proof-btn')) return;
        const logId = parseInt(card.dataset.logId);
        const log = logged.find(l => l.id === logId);
        if (log) this.openEditForm(log);
      });
    });

    // View Proof button
    document.querySelectorAll('.view-proof-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = parseInt(btn.dataset.logId);
        const log = logged.find(l => l.id === logId);
        if (log && log.screenshot) {
          Utils.openModal('Screenshot Proof', `<div style="text-align:center;"><img src="${log.screenshot}" style="max-width:100%;max-height:70vh;border-radius:8px;"></div>`);
        }
      });
    });

    // Clicking missing card also opens log form
    document.querySelectorAll('[data-action="log"]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.log-now-btn')) return; // already handled by button
        const riderId = parseInt(card.dataset.riderId);
        const rider = missing.find(r => r.id === riderId);
        if (rider) this.openLogForm(riderId, rider.name);
      });
    });

    // Search filter
    document.getElementById('logs-search')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.log-entry-card').forEach(card => {
        const name = card.getAttribute('data-name') || '';
        card.style.display = name.includes(query) ? '' : 'none';
      });
    });

    // Bulk lodge button
    document.getElementById('bulk-lodge-btn')?.addEventListener('click', () => {
      this.openBulkLodgeModal(missing);
    });
  },

  // ── Log entry form ──
  openLogForm(riderId, riderName) {
    const html = `
      <form id="log-form">
        <div style="margin-bottom:20px">
          <p class="text-sm text-muted">Recording data for <strong>${Utils.escapeHtml(riderName)}</strong> on <strong>${Utils.formatDate(this.currentDate)}</strong></p>
        </div>
        <div class="form-grid">
          <div class="form-group" style="grid-column: 1/-1">
            <label class="form-label">Attendance Status</label>
            <div style="display:flex;gap:10px;">
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Present" checked> Present</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Absent"> Absent</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Week Off"> Week Off</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Leave"> Leave</label>
            </div>
          </div>
          <div id="stats-inputs" class="form-grid" style="grid-column: 1/-1">
            <div class="form-group">
              <label class="form-label">Primary Orders <span class="required">*</span></label>
              <input type="number" class="form-input" name="primary_orders" min="0" required placeholder="e.g. 25">
            </div>
            <div class="form-group">
              <label class="form-label">Associate Orders</label>
              <input type="number" class="form-input" name="associate_orders" min="0" placeholder="e.g. 3">
            </div>
            <div class="form-group">
              <label class="form-label">Check-in Hours (Online) <span class="required">*</span></label>
              <div class="time-input-group">
                <input type="number" class="form-input" name="checkin_hours" min="0" max="24" value="11" required style="width:80px">
                <span>hrs</span>
                <input type="number" class="form-input" name="checkin_minutes" min="0" max="59" value="2" required style="width:80px">
                <span>min</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes (Optional)</label>
              <input type="text" class="form-input" name="notes" placeholder="Any notes...">
            </div>
          </div>
          <div id="absent-reason-container" class="form-group" style="grid-column: 1/-1; display:none; animation: slideUp 200ms ease;">
            <label class="form-label" style="color:var(--danger)">Reason for Absence <span class="required">*</span></label>
            <input type="text" class="form-input" name="absent_reason" id="absent_reason_input" placeholder="e.g. Sick Leave, Bike Breakdown, No Show...">
          </div>
          <div class="form-actions" style="grid-column: 1/-1">
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn-save-log">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Save Log
            </button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal(`Log Data — ${riderName}`, html);

    // Toggle inputs
    const statusRadios = document.querySelectorAll('input[name="attendance_status"]');
    const statsInputs = document.getElementById('stats-inputs');
    const absentContainer = document.getElementById('absent-reason-container');
    const absentInput = document.getElementById('absent_reason_input');
    
    statusRadios.forEach(r => r.addEventListener('change', () => {
      if (r.value === 'Present') {
        statsInputs.style.opacity = '1';
        statsInputs.style.pointerEvents = 'auto';
        absentContainer.style.display = 'none';
        absentInput.required = false;
        absentInput.value = '';
      } else if (r.value === 'Absent') {
        statsInputs.style.opacity = '0.5';
        statsInputs.style.pointerEvents = 'none';
        absentContainer.style.display = 'block';
        absentInput.required = true;
        
        // Zero them out automatically
        document.querySelector('input[name="primary_orders"]').value = 0;
        document.querySelector('input[name="associate_orders"]').value = 0;
        document.querySelector('input[name="checkin_hours"]').value = 0;
        document.querySelector('input[name="checkin_minutes"]').value = 0;
      } else {
        // Week Off or Leave
        statsInputs.style.opacity = '0.5';
        statsInputs.style.pointerEvents = 'none';
        absentContainer.style.display = 'none';
        absentInput.required = false;
        absentInput.value = '';
        
        // Zero them out automatically
        document.querySelector('input[name="primary_orders"]').value = 0;
        document.querySelector('input[name="associate_orders"]').value = 0;
        document.querySelector('input[name="checkin_hours"]').value = 0;
        document.querySelector('input[name="checkin_minutes"]').value = 0;
      }
    }));

    document.getElementById('log-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('btn-save-log');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:white;margin-right:8px;"></span> Saving...';
      }

      const fd = new FormData(e.target);
      const data = {
        rider_id: riderId,
        log_date: this.currentDate,
        attendance_status: fd.get('attendance_status') || 'Present',
        primary_orders: parseInt(fd.get('primary_orders')) || 0,
        associate_orders: parseInt(fd.get('associate_orders')) || 0,
        checkin_hours: parseInt(fd.get('checkin_hours')) || 0,
        checkin_minutes: parseInt(fd.get('checkin_minutes')) || 0,
        notes: fd.get('notes'),
        absent_reason: fd.get('absent_reason') || ''
      };

      try {
        await API.createDailyLog(data);
        const totalMin = Utils.toMinutes(data.checkin_hours, data.checkin_minutes);
        if (totalMin < 660) {
          Utils.showToast(`⚠️ ${riderName}: Check-in below 11 hours!`, 'warning');
        } else {
          Utils.showToast(`Log saved for ${riderName}`, 'success');
        }
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Log
          `;
        }
      }
    });
  },

  // ── Edit existing log ──
  openEditForm(log) {
    const html = `
      <form id="edit-log-form">
        <div style="margin-bottom:20px">
          <p class="text-sm text-muted">Editing data for <strong>${Utils.escapeHtml(log.rider_name)}</strong> on <strong>${Utils.formatDate(log.log_date)}</strong></p>
        </div>
        <div class="form-grid">
          <div class="form-group" style="grid-column: 1/-1">
            <label class="form-label">Attendance Status</label>
            <div style="display:flex;gap:10px;">
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Present" ${log.attendance_status === 'Present' || !log.attendance_status ? 'checked' : ''}> Present</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Absent" ${log.attendance_status === 'Absent' ? 'checked' : ''}> Absent</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Week Off" ${log.attendance_status === 'Week Off' ? 'checked' : ''}> Week Off</label>
              <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="radio" name="attendance_status" value="Leave" ${log.attendance_status === 'Leave' ? 'checked' : ''}> Leave</label>
            </div>
          </div>
          <div id="edit-stats-inputs" class="form-grid" style="grid-column: 1/-1; ${log.attendance_status !== 'Present' && log.attendance_status ? 'opacity:0.5;pointer-events:none' : ''}">
            <div class="form-group">
              <label class="form-label">Primary Orders <span class="required">*</span></label>
              <input type="number" class="form-input" name="primary_orders" min="0" value="${log.primary_orders}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Associate Orders</label>
              <input type="number" class="form-input" name="associate_orders" min="0" value="${log.associate_orders}">
            </div>
            <div class="form-group">
              <label class="form-label">Check-in Hours (Online) <span class="required">*</span></label>
              <div class="time-input-group">
                <input type="number" class="form-input" name="checkin_hours" min="0" max="24" value="${log.checkin_hours}" required style="width:80px">
                <span>hrs</span>
                <input type="number" class="form-input" name="checkin_minutes" min="0" max="59" value="${log.checkin_minutes}" required style="width:80px">
                <span>min</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <input type="text" class="form-input" name="notes" value="${Utils.escapeHtml(log.notes || '')}">
            </div>
          </div>
          <div id="edit-absent-reason-container" class="form-group" style="grid-column: 1/-1; display:${log.attendance_status !== 'Present' && log.attendance_status ? 'block' : 'none'};">
            <label class="form-label" style="color:var(--danger)">Reason for Absence <span class="required">*</span></label>
            <input type="text" class="form-input" name="absent_reason" id="edit_absent_reason_input" value="${Utils.escapeHtml(log.absent_reason || '')}" placeholder="e.g. Sick Leave, Bike Breakdown, No Show...">
          </div>
          <div class="form-actions" style="grid-column: 1/-1">
            <button type="button" class="btn btn-danger" id="btn-delete-log" style="margin-right:auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete Log
            </button>
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-update-log">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Update Log
            </button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal(`Edit Log — ${log.rider_name}`, html);

    const editStatusRadios = document.querySelectorAll('input[name="attendance_status"]');
    const editStatsInputs = document.getElementById('edit-stats-inputs');
    const editAbsentContainer = document.getElementById('edit-absent-reason-container');
    const editAbsentInput = document.getElementById('edit_absent_reason_input');
    
    // Set initial required state
    if (log.attendance_status !== 'Present' && log.attendance_status) editAbsentInput.required = true;

    editStatusRadios.forEach(r => r.addEventListener('change', () => {
      if (r.value === 'Present') {
        editStatsInputs.style.opacity = '1';
        editStatsInputs.style.pointerEvents = 'auto';
        editAbsentContainer.style.display = 'none';
        editAbsentInput.required = false;
        editAbsentInput.value = '';
      } else if (r.value === 'Absent') {
        editStatsInputs.style.opacity = '0.5';
        editStatsInputs.style.pointerEvents = 'none';
        editAbsentContainer.style.display = 'block';
        editAbsentInput.required = true;
        
        // Zero them out automatically
        document.querySelector('#edit-log-form input[name="primary_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="associate_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_hours"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_minutes"]').value = 0;
      } else {
        // Week Off or Leave
        editStatsInputs.style.opacity = '0.5';
        editStatsInputs.style.pointerEvents = 'none';
        editAbsentContainer.style.display = 'none';
        editAbsentInput.required = false;
        editAbsentInput.value = '';
        
        // Zero them out automatically
        document.querySelector('#edit-log-form input[name="primary_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="associate_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_hours"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_minutes"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_minutes"]').value = 0;
      }
    }));

    document.getElementById('btn-delete-log')?.addEventListener('click', async () => {
      const confirmMsg = `Are you sure you want to permanently delete this log for ${log.rider_name}? This action cannot be undone.`;
      const confirmed = await Utils.confirm(confirmMsg, 'Delete Log', 'Yes, Delete', 'Cancel', true);
      if (confirmed) {
        try {
          Utils.showLoading('Deleting log');
          await API.deleteDailyLog(log.id);
          Utils.showToast('Log deleted successfully', 'success');
          Utils.closeModal();
          this.render();
        } catch (err) {
          Utils.showToast(err.message, 'error');
        } finally {
          Utils.hideLoading();
        }
      }
    });

    document.getElementById('edit-log-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('btn-update-log');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:white;margin-right:8px;"></span> Updating...';
      }

      const fd = new FormData(e.target);
      const data = {
        attendance_status: fd.get('attendance_status') || 'Present',
        primary_orders: parseInt(fd.get('primary_orders')) || 0,
        associate_orders: parseInt(fd.get('associate_orders')) || 0,
        checkin_hours: parseInt(fd.get('checkin_hours')) || 0,
        checkin_minutes: parseInt(fd.get('checkin_minutes')) || 0,
        notes: fd.get('notes'),
        absent_reason: fd.get('absent_reason') || ''
      };

      try {
        await API.updateDailyLog(log.id, data);
        Utils.showToast('Log updated successfully', 'success');
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Update Log
          `;
        }
      }
    });
  },

  // ── Bulk Lodge Data ──
  async openBulkLodgeModal() {
    Utils.showLoading('Loading riders');
    try {
      const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      const startDate = new Date(cycle.start + 'T00:00:00');
      const todayDate = new Date(); todayDate.setHours(0,0,0,0);
      const cycleEndDate = new Date(cycle.end + 'T00:00:00');
      const endDate = new Date(Math.min(todayDate, cycleEndDate));
      
      let expectedDays = 0;
      let currentD = new Date(startDate);
      while(currentD <= endDate) { expectedDays++; currentD.setDate(currentD.getDate() + 1); }

      const [riders, payroll] = await Promise.all([
        API.getRiders(),
        API.getPayroll(cycle.start, cycle.end)
      ]);

      const activeRiders = riders.filter(r => {
        if (r.status === 'inactive') return false;
        const stats = payroll.find(p => String(p.rider_id) === String(r.id));
        if (stats) {
          const loggedDays = stats.present_days + stats.absent_days + stats.weekoff_days;
          // Only show riders whose logged days are strictly less than the expected days up to today
          if (loggedDays >= expectedDays) return false;
        }
        return true;
      });
      Utils.hideLoading();

      const html = `
        <div style="margin-bottom:16px;">
          <p class="text-sm text-muted">Select a rider, then enter their data for all missing (unlodged) dates at once. This saves you from lodging one day at a time.</p>
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">Select Rider <span class="required">*</span></label>
          <select id="bulk-rider-select" class="form-control" required>
            <option value="">-- Choose a rider --</option>
            ${activeRiders.map(r => `<option value="${r.id}">${Utils.escapeHtml(r.name)} (${r.rider_type === 'company' ? 'Company' : 'Freelance'})</option>`).join('')}
          </select>
        </div>
        <div id="bulk-dates-area" style="min-height:60px;">
          <p class="text-sm text-muted" style="text-align:center; padding:20px;">Select a rider above to load their missing dates.</p>
        </div>
      `;

      Utils.openModal('Bulk Lodge Data', html, 'modal-xl');

      document.getElementById('bulk-rider-select')?.addEventListener('change', async (e) => {
        const riderId = parseInt(e.target.value);
        if (!riderId) return;
        await this.loadBulkDates(riderId);
      });
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast('Failed to load riders: ' + err.message, 'error');
    }
  },

  async loadBulkDates(riderId) {
    const area = document.getElementById('bulk-dates-area');
    if (!area) return;
    area.innerHTML = '<div style="text-align:center; padding:20px;"><div class="spinner"></div></div>';

    try {
      // Get all dates from the current Noon cycle up to today
      const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      const startDate = new Date(cycle.start + 'T00:00:00');
      
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      const cycleEndDate = new Date(cycle.end + 'T00:00:00');
      const endDate = new Date(Math.min(todayDate, cycleEndDate));
      
      const missingDates = [];
      let currentD = new Date(startDate);
      while(currentD <= endDate) {
         missingDates.push(Utils.toLocalDateStr(currentD));
         currentD.setDate(currentD.getDate() + 1);
      }
      missingDates.reverse(); // Show most recent dates first

      // Check which dates already have logs
      const allLogs = await API.request(`/daily-logs?rider_id=${riderId}`);
      const loggedDates = new Set((allLogs || []).map(l => l.log_date));
      const unlodged = missingDates.filter(d => !loggedDates.has(d));

      if (unlodged.length === 0) {
        area.innerHTML = '<div class="empty-state" style="padding:30px;"><p>All dates are already logged for this rider in the current cycle! 🎉</p></div>';
        return;
      }

      area.innerHTML = `
        <form id="bulk-lodge-form">
          <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
            <p class="text-sm"><strong>${unlodged.length}</strong> unlodged dates found in cycle (since ${cycle.start})</p>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-sm btn-outline" onclick="document.querySelectorAll('.bulk-row-check').forEach(c=>{c.checked=true; c.dispatchEvent(new Event('change'));})">Select All</button>
              <button type="button" class="btn btn-sm btn-outline" onclick="document.querySelectorAll('.bulk-row-check').forEach(c=>{c.checked=false; c.dispatchEvent(new Event('change'));})">Deselect All</button>
            </div>
          </div>
          <div class="table-container" style="max-height:400px; overflow-y:auto;">
            <table class="data-table" style="font-size:13px;">
              <thead style="position:sticky; top:0; z-index:2;">
                <tr>
                  <th style="width:32px;"><input type="checkbox" checked onchange="document.querySelectorAll('.bulk-row-check').forEach(c=>{c.checked=this.checked; c.dispatchEvent(new Event('change'));})"></th>
                  <th>Date</th>
                  <th>Attendance</th>
                  <th>Primary</th>
                  <th>Associate</th>
                  <th>Hrs</th>
                  <th>Min</th>
                </tr>
              </thead>
              <tbody>
                ${unlodged.map(date => `
                  <tr>
                    <td><input type="checkbox" class="bulk-row-check" checked data-date="${date}" onchange="(function(el){ const row = el.closest('tr'); const att = row.querySelector('select').value; row.querySelector('select').disabled = !el.checked; const isAbsent = att !== 'Present'; row.querySelectorAll('input[type=number]').forEach(i => i.disabled = (!el.checked || isAbsent)); })(this)"></td>
                    <td style="white-space:nowrap; font-weight:600;">${Utils.formatDate(date)}</td>
                    <td>
                      <select name="att_${date}" class="form-control" style="padding:4px 8px; font-size:12px; min-width:90px;" onchange="(function(el){
                        const isAbsent = el.value !== 'Present';
                        const row = el.closest('tr');
                        ['pri_${date}', 'asc_${date}', 'hrs_${date}', 'min_${date}'].forEach(name => {
                          const input = row.querySelector('[name=\\''+name+'\\']');
                          if(input) {
                            input.disabled = isAbsent;
                            if(isAbsent) input.value = '0';
                            else if(name.startsWith('hrs_')) input.value = '11';
                            else if(name.startsWith('min_')) input.value = '2';
                            else input.value = '';
                          }
                        });
                      })(this)">
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Week Off">Week Off / Day Off</option>
                      </select>
                    </td>
                    <td><input type="number" name="pri_${date}" class="form-control" style="padding:4px 8px; width:70px; font-size:12px;" required min="0" placeholder="Primary"></td>
                    <td><input type="number" name="asc_${date}" class="form-control" style="padding:4px 8px; width:70px; font-size:12px;" min="0" placeholder="Assoc."></td>
                    <td><input type="number" name="hrs_${date}" class="form-control" style="padding:4px 8px; width:60px; font-size:12px;" value="11" required min="0" max="24"></td>
                    <td><input type="number" name="min_${date}" class="form-control" style="padding:4px 8px; width:60px; font-size:12px;" value="2" required min="0" max="59"></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="form-actions mt-24">
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Submit All Selected
            </button>
          </div>
        </form>
      `;

      const bulkForm = document.getElementById('bulk-lodge-form');
      
      // Prevent accidental Enter key submission
      bulkForm?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          return false;
        }
      });

      bulkForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitBulkLodge(riderId);
      });
    } catch (err) {
      area.innerHTML = `<p style="color:var(--danger); padding:20px;">Error loading dates: ${err.message}</p>`;
    }
  },

  async submitBulkLodge(riderId) {
    const checkedBoxes = document.querySelectorAll('.bulk-row-check:checked');
    if (checkedBoxes.length === 0) {
      Utils.showToast('No dates selected', 'error');
      return;
    }

    Utils.showLoading('Saving records', `Submitting ${checkedBoxes.length} records`);
    let success = 0;
    let failed = 0;
    let emptyDays = [];

    // Preliminary validation
    for (const cb of checkedBoxes) {
      const date = cb.dataset.date;
      const att = document.querySelector(`[name="att_${date}"]`)?.value || 'Present';
      const pri = parseInt(document.querySelector(`[name="pri_${date}"]`)?.value) || 0;
      const asc = parseInt(document.querySelector(`[name="asc_${date}"]`)?.value) || 0;
      
      if (att === 'Present' && pri === 0 && asc === 0) {
        emptyDays.push(date);
      }
    }

    if (emptyDays.length > 0) {
      Utils.hideLoading();
      Utils.showToast(`Cannot save: ${emptyDays.length} selected days have 0 orders. Please fill them or uncheck them.`, 'error');
      return;
    }
    for (const cb of checkedBoxes) {
      const date = cb.dataset.date;
      const att = document.querySelector(`[name="att_${date}"]`)?.value || 'Present';
      const pri = parseInt(document.querySelector(`[name="pri_${date}"]`)?.value) || 0;
      const asc = parseInt(document.querySelector(`[name="asc_${date}"]`)?.value) || 0;
      const hrs = parseInt(document.querySelector(`[name="hrs_${date}"]`)?.value) || 0;
      const min = parseInt(document.querySelector(`[name="min_${date}"]`)?.value) || 0;

      try {
        await API.createDailyLog({
          rider_id: riderId,
          log_date: date,
          attendance_status: att,
          primary_orders: pri,
          associate_orders: asc,
          checkin_hours: hrs,
          checkin_minutes: min,
          notes: 'Bulk lodged'
        });
        success++;
      } catch (err) {
        failed++;
      }
    }

    Utils.hideLoading();
    Utils.closeModal();
    Utils.showToast(`Bulk lodge complete: ${success} saved, ${failed} failed`, success > 0 ? 'success' : 'error');
    this.render();
  }
};
