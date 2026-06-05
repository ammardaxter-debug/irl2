// ========================================
//  UTILS - Shared utility functions
// ========================================

const Utils = {
  // Global Active Date for Cycle Nav (defaults to today on init)
  _activeDate: null,
  
  getActiveDate() {
    if (!this._activeDate) {
      this._activeDate = this.today();
    }
    return this._activeDate;
  },

  cyclePrev() {
    this._activeDate = this.shiftPeriod(this.getActiveDate(), -1).start;
    window.dispatchEvent(new Event('cycleChanged'));
  },

  cycleNext() {
    this._activeDate = this.shiftPeriod(this.getActiveDate(), 1).start;
    window.dispatchEvent(new Event('cycleChanged'));
  },

  _loadingStartTime: 0,
  _loadingTimeout: null,

  // Global premium loading overlay
  showLoading(text = 'Loading', subtext = '') {
    const loader = document.getElementById('global-loading');
    const label = document.getElementById('loader-text');
    const subLabel = document.getElementById('loader-subtext');
    const avatarImg = document.getElementById('loader-avatar-img');
    const avatarFallback = document.getElementById('loader-avatar-fallback');

    if (avatarImg && avatarFallback) {
      const photoUrl = window.supervisorPhotoUrl || localStorage.getItem('irl_supervisor_photo');
      if (photoUrl) {
        window.supervisorPhotoUrl = photoUrl; // Cache in memory
        avatarImg.src = photoUrl;
        avatarImg.style.display = 'block';
        avatarFallback.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarFallback.style.display = 'flex';
      }
    }

    if (loader && label) {
      label.textContent = text;
      if (subLabel) {
        subLabel.textContent = subtext;
        subLabel.style.display = subtext ? 'block' : 'none';
      }
      loader.classList.add('active');
      this._loadingStartTime = Date.now();
      if (this._loadingTimeout) {
        clearTimeout(this._loadingTimeout);
        this._loadingTimeout = null;
      }
    }
  },
  
  hideLoading() {
    const loader = document.getElementById('global-loading');
    if (!loader) return;
    
    const elapsed = Date.now() - this._loadingStartTime;
    const remaining = Math.max(0, 600 - elapsed);
    
    if (this._loadingTimeout) clearTimeout(this._loadingTimeout);
    
    if (remaining > 0) {
      this._loadingTimeout = setTimeout(() => {
        loader.classList.remove('active');
      }, remaining);
    } else {
      loader.classList.remove('active');
    }
  },

  downloadPDF(doc, filename) {
    const safeFilename = filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
    const dataUri = doc.output('datauristring');
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = dataUri;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  },

  // Format date to display string (handles both YYYY-MM-DD and full ISO datetime)
  formatDate(dateStr) {
    if (!dateStr) return '—';
    // Extract just the date part if a full ISO timestamp is passed
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(datePart + 'T00:00:00');
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  },

  // Format date short (handles both YYYY-MM-DD and full ISO datetime)
  formatDateShort(dateStr) {
    if (!dateStr) return '—';
    const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const d = new Date(datePart + 'T00:00:00');
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  // Helper: format a Date object as YYYY-MM-DD using LOCAL time (not UTC)
  toLocalDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Get today's date in YYYY-MM-DD (local time)
  today() {
    return this.toLocalDateStr(new Date());
  },

  // Get initials from name
  getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },

  // Days until a date
  daysUntil(dateStr) {
    if (!dateStr) return Infinity;
    const target = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  },

  // Format hours and minutes
  formatTime(hours, minutes) {
    return `${hours}h ${minutes}m`;
  },

  // Convert hours/minutes to total minutes
  toMinutes(hours, minutes) {
    return (hours * 60) + minutes;
  },

  // Get Noon cycle period for a given date
  getNoonCyclePeriod(date) {
    const d = new Date(date + 'T00:00:00');
    const day = d.getDate();
    const month = d.getMonth();
    const year = d.getFullYear();

    let start, end;
    if (day >= 21) {
      start = new Date(year, month, 21);
      end = new Date(year, month + 1, 20);
    } else {
      start = new Date(year, month - 1, 21);
      end = new Date(year, month, 20);
    }

    return {
      start: this.toLocalDateStr(start),
      end: this.toLocalDateStr(end),
      label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    };
  },

  // Navigate period forward/back
  shiftPeriod(periodStart, direction) {
    const d = new Date(periodStart + 'T00:00:00');
    d.setMonth(d.getMonth() + direction);
    return this.getNoonCyclePeriod(this.toLocalDateStr(d));
  },

  // Navigate date forward/back
  shiftDate(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return this.toLocalDateStr(d);
  },

  // Show toast notification
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      toast.style.transition = 'all 300ms ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // Custom Alert Dialog replacing browser native alert()
  alert(message, title = 'Notification', buttonText = 'OK') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.style.zIndex = '9999';
      
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px; animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
          <div class="modal-header" style="border-bottom:none; padding-bottom:0;">
            <h2 class="modal-title" style="display:flex; align-items:center; gap:8px; font-size:18px; font-weight:700; color:#0f172a;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              ${this.escapeHtml(title)}
            </h2>
          </div>
          <div class="modal-body" style="padding-top:12px;">
            <p style="color:#4b5563; font-size:14px; line-height:1.5; margin-bottom:24px;">${this.escapeHtml(message)}</p>
            <div style="display:flex; justify-content:flex-end;">
              <button class="btn alert-ok-btn" style="background:var(--primary-600); color:white; border:none; padding:10px 24px; border-radius:10px; font-weight:600; cursor:pointer; transition:background 0.2s; font-size:14px;">${buttonText}</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      const cleanup = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
      };
      
      const okBtn = overlay.querySelector('.alert-ok-btn');
      okBtn.onclick = () => { cleanup(); resolve(); };
      
      // ESC key to close
      overlay.onkeydown = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve();
        }
      };
    });
  },

  // Custom Confirm Dialog replacing browser native confirm()
  confirm(message, title = 'Confirm Action', confirmText = 'Confirm', cancelText = 'Cancel', isDanger = true) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.style.zIndex = '9999';
      
      const btnColor = isDanger ? '#DC2626' : '#2563EB';
      const btnHover = isDanger ? '#B91C1C' : '#1D4ED8';
      
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px; animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="modal-header" style="border-bottom:none; padding-bottom:0;">
            <h2 class="modal-title" style="display:flex; align-items:center; gap:8px;">
              ${isDanger ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' : ''}
              ${this.escapeHtml(title)}
            </h2>
          </div>
          <div class="modal-body" style="padding-top:12px;">
            <p style="color:#4B5563; font-size:14px; line-height:1.5; margin-bottom:24px;">${this.escapeHtml(message)}</p>
            <div style="display:flex; justify-content:flex-end; gap:12px;">
              <button class="btn btn-outline confirm-cancel-btn">${cancelText}</button>
              <button class="btn confirm-ok-btn" style="background:${btnColor}; color:white; border:none; transition:background 0.2s;">${confirmText}</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      
      const cleanup = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
      };
      
      const okBtn = overlay.querySelector('.confirm-ok-btn');
      okBtn.onmouseover = () => okBtn.style.background = btnHover;
      okBtn.onmouseout = () => okBtn.style.background = btnColor;
      okBtn.onclick = () => { cleanup(); resolve(true); };
      
      overlay.querySelector('.confirm-cancel-btn').onclick = () => { cleanup(); resolve(false); };
    });
  },

  // Open modal
  openModal(title, bodyHtml, sizeClass) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalContent = overlay?.querySelector('.modal');
    
    // Remove previous size classes
    if (modalContent) {
      modalContent.classList.remove('modal-xl', 'modal-lg');
      if (sizeClass) modalContent.classList.add(sizeClass);
    }
    
    modalTitle.innerHTML = title;
    modalBody.innerHTML = bodyHtml;
    overlay.classList.add('active');
  },

  // Close modal
  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
  },

  // Debounce
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  // Format currency with Riyal symbol (﷼)
  formatCurrency(amount) {
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
    return `﷼ ${formatted}`;
  },

  // Escape HTML
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Get Gamified Tier based on total orders
  calculateTier(orders) {
    if (orders >= 600) return { name: 'Elite', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' };
    if (orders >= 450) return { name: 'Gold', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
    if (orders >= 250) return { name: 'Silver', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
    return { name: 'Bronze', color: '#78350f', bg: '#fff7ed', border: '#ffedd5' };
  },
  
  getTierBadgeHtml(orders) {
    const tier = this.calculateTier(orders || 0);
    return `<span style="background:${tier.bg}; color:${tier.color}; border:1px solid ${tier.border}; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; display:inline-flex; align-items:center;">${tier.name}</span>`;
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  },

  // Custom Prompt Dialog
  prompt(message, title = 'Input Required', placeholder = '', confirmText = 'Submit', cancelText = 'Cancel') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.style.zIndex = '9999';
      
      overlay.innerHTML = `
        <div class="modal" style="max-width:450px; animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          <div class="modal-header" style="border-bottom:none; padding-bottom:0;">
            <h2 class="modal-title" style="font-size:20px; font-weight:700;">${this.escapeHtml(title)}</h2>
          </div>
          <div class="modal-body" style="padding-top:12px;">
            <p style="color:#4B5563; font-size:14px; margin-bottom:12px;">${this.escapeHtml(message)}</p>
            <textarea id="custom-prompt-input" class="input" style="width:100%; min-height:100px; padding:12px; border-radius:12px; border:1.5px solid #E5E7EB; margin-bottom:24px; font-family:inherit; font-size:14px; resize:none;" placeholder="${this.escapeHtml(placeholder)}"></textarea>
            <div style="display:flex; justify-content:flex-end; gap:12px;">
              <button class="btn btn-outline prompt-cancel-btn">${cancelText}</button>
              <button class="btn prompt-ok-btn" style="background:#0F0F0F; color:white; border:none; padding:10px 24px; border-radius:10px; font-weight:600; cursor:pointer;">${confirmText}</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#custom-prompt-input');
      input.focus();
      
      const cleanup = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
      };
      
      overlay.querySelector('.prompt-ok-btn').onclick = () => { 
        const val = input.value.trim();
        cleanup(); 
        resolve(val); 
      };
      
      overlay.querySelector('.prompt-cancel-btn').onclick = () => { 
        cleanup(); 
        resolve(null); 
      };

      // Handle Escape key
      overlay.onkeydown = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      };
    });
  }
};
