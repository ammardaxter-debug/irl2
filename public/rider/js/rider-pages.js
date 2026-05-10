// ========================================
//  Rider Portal — Page Renderers
// ========================================

const RiderPages = {

  // ==========================================
  // LOGIN PAGE
  // ==========================================
  renderLogin() {
    return `
      <div class="r-login-page">
        <div class="r-login-header">
          <div class="r-login-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/>
              <path d="M8 17.5h7M14 17.5L12 10h-2L8 8M12 10h3l2 4M6 8h3"/>
            </svg>
          </div>
          <div class="r-login-title">Inspiring Roads</div>
          <div class="r-login-subtitle">Rider Portal</div>
        </div>
        
        <div class="r-login-card">
          <h2>Welcome Back</h2>
          <p class="subtitle">Login to submit logs and view reports</p>
          
          <form id="r-login-form" autocomplete="off">
            <div class="r-form-group">
              <label class="r-form-label">Phone Number</label>
              <div class="r-input-wrapper">
                <svg class="r-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <input type="tel" class="r-form-input" id="r-login-phone" placeholder="05X XXX XXXX" required autocomplete="off" name="phone_number_nope">
              </div>
            </div>
            
            <div class="r-form-group">
              <label class="r-form-label">Password</label>
              <div class="r-input-wrapper">
                <svg class="r-input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input type="password" class="r-form-input" id="r-login-password" placeholder="••••••••" required autocomplete="new-password">
                <button type="button" class="r-input-toggle" id="r-login-toggle">👁</button>
              </div>
            </div>
            
            <button type="submit" class="r-btn r-btn-primary" id="r-login-submit">Login Securely</button>
          </form>
          

        </div>
      </div>
    `;
  },

  attachLoginEvents() {
    const toggle = document.getElementById('r-login-toggle');
    const pwd = document.getElementById('r-login-password');
    if (toggle && pwd) {
      toggle.addEventListener('click', () => {
        if (pwd.type === 'password') {
          pwd.type = 'text';
          toggle.textContent = '🙈';
        } else {
          pwd.type = 'password';
          toggle.textContent = '👁';
        }
      });
    }

    // Fetch and display company logo
    fetch('/api/settings/logo')
      .then(res => res.json())
      .then(data => {
        if (data.logo) {
          const logoContainer = document.querySelector('.r-login-logo');
          if (logoContainer) {
            logoContainer.innerHTML = `<img src="${data.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            logoContainer.style.background = 'transparent';
          }
        }
      })
      .catch(e => console.warn('Could not load company logo', e));

    document.getElementById('r-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('r-login-phone').value;
      const password = document.getElementById('r-login-password').value;
      const btn = document.getElementById('r-login-submit');
      
      try {
        btn.disabled = true;
        btn.innerHTML = '<div class="r-spinner"></div> Logging in...';
        await RiderAPI.login(phone, password);
        RiderApp.showToast('Login successful!', 'success');
        RiderApp.navigate('home');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Login Securely';
        RiderApp.showToast(err.message, 'error');
      }
    });
  },

  // ==========================================
  // HOME / DASHBOARD PAGE
  // ==========================================
  renderHome() {
    const rider = RiderAPI.getCachedRider() || {};
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    return `
      <div class="r-welcome">
        <div class="r-welcome-name">Hello, ${rider.name || 'Rider'}!</div>
        <div class="r-welcome-sub">${dateStr}</div>
      </div>
      
      <div class="r-card">
        <div class="r-card-header">
          <div class="r-card-title">Today's Status</div>
        </div>
        <div id="r-home-today-status">
          <div style="text-align:center; padding:20px;">
            <div class="r-spinner" style="border-color:#E2E8F0; border-top-color:var(--r-primary); margin:0 auto;"></div>
          </div>
        </div>
      </div>
      
      <div class="r-card">
        <div class="r-card-header">
          <div class="r-card-title">This Cycle Summary</div>
        </div>
        <div class="r-stats-grid" id="r-home-stats">
          <div class="r-stat-card"><div class="r-stat-value">-</div><div class="r-stat-label">Orders</div></div>
          <div class="r-stat-card"><div class="r-stat-value">-</div><div class="r-stat-label">Days Present</div></div>
          <div class="r-stat-card"><div class="r-stat-value">-</div><div class="r-stat-label">Days Absent</div></div>
          <div class="r-stat-card"><div class="r-stat-value">-</div><div class="r-stat-label">Avg Hrs/Day</div></div>
        </div>
      </div>
    `;
  },

  async attachHomeEvents() {
    try {
      const today = RiderApp.getTodayLocal();
      const cycleStart = today.substring(0, 8) + '01'; // simple cycle start for now
      
      const logs = await RiderAPI.getMyLogs(cycleStart, today);
      const todayLog = logs.find(l => l.log_date === today);
      
      // Update Today's Status
      const todayEl = document.getElementById('r-home-today-status');
      if (todayLog) {
        let badgeClass = 'r-chip-success';
        if (todayLog.attendance_status === 'Absent') badgeClass = 'r-chip-danger';
        else if (todayLog.attendance_status === 'Week Off') badgeClass = 'r-chip-warning';
        
        todayEl.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <span class="r-chip ${badgeClass}">${todayLog.attendance_status}</span>
            ${todayLog.attendance_status === 'Present' ? `<span style="font-size:13px; font-weight:600;">${todayLog.primary_orders + todayLog.associate_orders} Orders</span>` : ''}
          </div>
          ${todayLog.attendance_status === 'Present' ? `
            <div style="display:flex; gap:12px;">
              <button class="r-btn r-btn-outline r-btn-sm" style="flex:1;" onclick="RiderApp.navigate('log')">Edit Log</button>
            </div>
          ` : ''}
        `;
      } else {
        todayEl.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <span class="r-chip r-chip-warning">Not Logged Yet</span>
          </div>
          <button class="r-btn r-btn-primary" onclick="RiderApp.navigate('log')">Submit Today's Data</button>
        `;
      }
      
      // Update Stats
      const present = logs.filter(l => l.attendance_status === 'Present');
      const absent = logs.filter(l => l.attendance_status === 'Absent');
      const totalOrders = present.reduce((sum, l) => sum + (l.primary_orders || 0) + (l.associate_orders || 0), 0);
      const avgMins = present.length > 0 ? present.reduce((sum, l) => sum + ((l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0)), 0) / present.length : 0;
      
      document.getElementById('r-home-stats').innerHTML = `
        <div class="r-stat-card"><div class="r-stat-value" style="color:var(--r-primary)">${totalOrders}</div><div class="r-stat-label">Orders</div></div>
        <div class="r-stat-card"><div class="r-stat-value">${present.length}</div><div class="r-stat-label">Days Present</div></div>
        <div class="r-stat-card"><div class="r-stat-value" style="color:${absent.length > 0 ? 'var(--r-danger)' : 'var(--r-text)'}">${absent.length}</div><div class="r-stat-label">Days Absent</div></div>
        <div class="r-stat-card"><div class="r-stat-value">${Math.floor(avgMins/60)}<span style="font-size:14px">h</span></div><div class="r-stat-label">Avg/Day</div></div>
      `;
      
    } catch (err) {
      document.getElementById('r-home-today-status').innerHTML = `<p style="color:var(--r-danger)">Failed to load data.</p>`;
    }
  },

  // ==========================================
  // DAILY LOG PAGE
  // ==========================================
  renderLog() {
    return `
      <div class="r-card">
        <div class="r-card-header">
          <div class="r-card-title">Lodge Data</div>
        </div>
        
        <div id="r-log-locked-msg" style="display:none; background:#FEF2F2; color:#DC2626; padding:12px; border-radius:8px; font-size:13px; font-weight:500; margin-bottom:16px; border:1px solid #FECACA;">
          This data was lodged over 24 hours ago and can no longer be edited.
        </div>
        
        <form id="r-log-form">
          <div class="r-form-group">
            <label class="r-form-label">Date</label>
            <input type="date" class="r-form-input" id="r-log-date" value="${RiderApp.getTodayLocal()}" max="${RiderApp.getTodayLocal()}" required>
          </div>
          
          <div class="r-form-group">
            <label class="r-form-label">Status</label>
            <select class="r-form-select" id="r-log-status">
              <option value="Present">Present (Worked)</option>
              <option value="Absent">Absent</option>
              <option value="Week Off">Week Off</option>
            </select>
          </div>
          
          <div id="r-log-worked-fields">
            <div class="r-form-group">
              <label class="r-form-label">Total Orders Delivered</label>
              <input type="number" class="r-form-input" id="r-log-orders" placeholder="e.g. 24" min="0">
            </div>
            
            <div class="r-form-group">
              <label class="r-form-label">Online Hours</label>
              <div style="display:flex; gap:12px;">
                <input type="number" class="r-form-input" id="r-log-hrs" placeholder="Hrs" min="0" max="24" value="11">
                <input type="number" class="r-form-input" id="r-log-mins" placeholder="Mins" min="0" max="59" value="0">
              </div>
            </div>
            
            <div class="r-form-group">
              <label class="r-form-label">Screenshot Proof (Optional)</label>
              <div class="r-upload-zone" id="r-log-upload-zone">
                <input type="file" id="r-log-file" accept="image/*" style="display:none;">
                <input type="hidden" id="r-log-base64">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--r-primary)" stroke-width="2" style="width:32px;height:32px;margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <div style="font-size:13px; font-weight:600; color:var(--r-text);">Tap to upload screenshot</div>
                <div style="font-size:11px; color:var(--r-text-muted); margin-top:4px;">Max size 2MB. Image will be compressed.</div>
                <img id="r-log-preview" style="display:none; margin-top:12px;">
              </div>
            </div>
          </div>
          
          <div class="r-form-group" id="r-log-absent-fields" style="display:none;">
            <label class="r-form-label">Reason for Absence</label>
            <input type="text" class="r-form-input" id="r-log-reason" placeholder="e.g. Sick, Bike breakdown">
          </div>
          
          <button type="submit" class="r-btn r-btn-primary" id="r-log-submit" style="margin-top:24px;">Submit Data</button>
        </form>
      </div>
    `;
  },

  attachLogEvents() {
    const statusSelect = document.getElementById('r-log-status');
    const workedFields = document.getElementById('r-log-worked-fields');
    const absentFields = document.getElementById('r-log-absent-fields');
    
    // Toggle fields based on status
    statusSelect.addEventListener('change', () => {
      const isPresent = statusSelect.value === 'Present';
      const isAbsent = statusSelect.value === 'Absent';
      
      workedFields.style.display = isPresent ? 'block' : 'none';
      absentFields.style.display = isAbsent ? 'block' : 'none';
      
      if (isPresent) document.getElementById('r-log-orders').required = true;
      else document.getElementById('r-log-orders').required = false;
      
      if (isAbsent) document.getElementById('r-log-reason').required = true;
      else document.getElementById('r-log-reason').required = false;
    });
    
    // Initial trigger
    statusSelect.dispatchEvent(new Event('change'));

    // Check for existing log on date change
    const dateInput = document.getElementById('r-log-date');
    const submitBtn = document.getElementById('r-log-submit');
    const checkDate = async () => {
      try {
        const date = dateInput.value;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Checking...';
        
        // Ensure RiderAPI exposes getLogs (add it if missing, but we assume it's there based on search)
        // Wait, the previous search returned "return await this.request(`/my-logs?start=${start}&end=${end}`);"
        // Let's call it via RiderAPI.request directly to be safe.
        const logs = await RiderAPI.request(`/my-logs?start=${date}&end=${date}`);
        
        if (logs && logs.length > 0) {
          const log = logs[0];
          statusSelect.value = log.attendance_status || 'Present';
          statusSelect.dispatchEvent(new Event('change'));
          document.getElementById('r-log-orders').value = log.primary_orders || '';
          document.getElementById('r-log-hrs').value = log.checkin_hours || '';
          document.getElementById('r-log-mins').value = log.checkin_minutes || '';
          document.getElementById('r-log-reason').value = log.absent_reason || '';
          
          if (log.screenshot) {
            document.getElementById('r-log-preview').src = log.screenshot;
            document.getElementById('r-log-preview').style.display = 'block';
            document.getElementById('r-log-base64').value = log.screenshot;
          } else {
            document.getElementById('r-log-preview').style.display = 'none';
            document.getElementById('r-log-base64').value = '';
          }
          
          const created = new Date(log.created_at || new Date().toISOString());
          const diffHours = (new Date() - created) / (1000 * 60 * 60);
          const isLocked = diffHours > 24;
          
          document.getElementById('r-log-locked-msg').style.display = isLocked ? 'block' : 'none';
          statusSelect.disabled = isLocked;
          document.getElementById('r-log-orders').disabled = isLocked;
          document.getElementById('r-log-hrs').disabled = isLocked;
          document.getElementById('r-log-mins').disabled = isLocked;
          document.getElementById('r-log-reason').disabled = isLocked;
          const uploadZone = document.getElementById('r-log-upload-zone');
          uploadZone.style.pointerEvents = isLocked ? 'none' : 'auto';
          uploadZone.style.opacity = isLocked ? '0.6' : '1';
          
          if (isLocked) {
            submitBtn.textContent = 'Locked (Older than 24h)';
            submitBtn.disabled = true;
            submitBtn.style.background = 'var(--r-text-muted)';
            submitBtn.style.display = 'none'; // Completely hide submit button if locked
          } else {
            submitBtn.textContent = 'Update Data';
            submitBtn.disabled = false;
            submitBtn.style.background = 'var(--r-primary)';
            submitBtn.style.display = 'block';
          }
        } else {
          document.getElementById('r-log-locked-msg').style.display = 'none';
          statusSelect.disabled = false;
          document.getElementById('r-log-orders').disabled = false;
          document.getElementById('r-log-hrs').disabled = false;
          document.getElementById('r-log-mins').disabled = false;
          document.getElementById('r-log-reason').disabled = false;
          document.getElementById('r-log-upload-zone').style.pointerEvents = 'auto';
          document.getElementById('r-log-upload-zone').style.opacity = '1';
          
          submitBtn.textContent = 'Submit Data';
          submitBtn.disabled = false;
          submitBtn.style.background = 'var(--r-primary)';
          submitBtn.style.display = 'block';
          // Reset form somewhat, keeping the date
          document.getElementById('r-log-orders').value = '';
          document.getElementById('r-log-hrs').value = '11';
          document.getElementById('r-log-mins').value = '0';
          document.getElementById('r-log-reason').value = '';
          document.getElementById('r-log-preview').style.display = 'none';
          document.getElementById('r-log-base64').value = '';
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Data';
      }
    };
    
    dateInput.addEventListener('change', checkDate);
    checkDate(); // Run on mount

    // File Upload handling
    const uploadZone = document.getElementById('r-log-upload-zone');
    const fileInput = document.getElementById('r-log-file');
    const preview = document.getElementById('r-log-preview');
    const base64Input = document.getElementById('r-log-base64');
    
    uploadZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Compress to max 800px width/height to save database space
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6); // 60% quality
          base64Input.value = dataUrl;
          preview.src = dataUrl;
          preview.style.display = 'block';
          uploadZone.classList.add('has-image');
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    // Form submission
    document.getElementById('r-log-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('r-log-submit');
      
      const data = {
        log_date: document.getElementById('r-log-date').value,
        attendance_status: statusSelect.value,
        primary_orders: statusSelect.value === 'Present' ? parseInt(document.getElementById('r-log-orders').value || 0) : 0,
        associate_orders: 0, // Simplified for rider portal
        checkin_hours: statusSelect.value === 'Present' ? parseInt(document.getElementById('r-log-hrs').value || 0) : 0,
        checkin_minutes: statusSelect.value === 'Present' ? parseInt(document.getElementById('r-log-mins').value || 0) : 0,
        absent_reason: statusSelect.value === 'Absent' ? document.getElementById('r-log-reason').value : '',
        screenshot: base64Input.value || null
      };

      try {
        btn.disabled = true;
        btn.innerHTML = '<div class="r-spinner"></div> Submitting...';
        await RiderAPI.submitLog(data);
        RiderApp.showToast('Log submitted successfully!', 'success');
        setTimeout(() => RiderApp.navigate('home'), 1000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Submit Data';
        RiderApp.showToast(err.message, 'error');
      }
    });
  },

  // ==========================================
  // REPORTS PAGE
  // ==========================================
  renderReport() {
    // Current month by default
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    return `
      <div class="r-month-switcher">
        <button id="r-rep-prev"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div class="label" id="r-rep-month-label" data-value="${currentMonth}">${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button id="r-rep-next"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>

      <div id="r-rep-content">
        <div style="text-align:center; padding:40px;"><div class="r-spinner" style="border-top-color:var(--r-primary);margin:0 auto;"></div></div>
      </div>
    `;
  },

  async attachReportEvents() {
    const loadReport = async (monthStr) => {
      const content = document.getElementById('r-rep-content');
      content.innerHTML = '<div style="text-align:center; padding:40px;"><div class="r-spinner" style="border-top-color:var(--r-primary);margin:0 auto;"></div></div>';
      
      try {
        // Use Noon cycle: 21st of previous month to 20th of selected month
        const [y, m] = monthStr.split('-');
        let prevY = parseInt(y);
        let prevM = parseInt(m) - 1;
        if (prevM === 0) { prevM = 12; prevY--; }
        const start = `${prevY}-${String(prevM).padStart(2, '0')}-21`;
        const end = `${y}-${m}-20`;
        
        const report = await RiderAPI.getMonthlyReport(start, end);
        
        if (!report || report.logs.length === 0) {
          content.innerHTML = `<div class="r-empty"><p>No logs found for this month.</p></div>`;
          return;
        }

        // Build UI
        content.innerHTML = `
          <div class="r-card">
            <div class="r-card-header"><div class="r-card-title">Monthly Summary</div></div>
            <div class="r-stats-grid">
              <div class="r-stat-card"><div class="r-stat-value" style="color:var(--r-primary)">${report.total_orders}</div><div class="r-stat-label">Total Orders</div></div>
              <div class="r-stat-card"><div class="r-stat-value">${report.present_days}</div><div class="r-stat-label">Days Present</div></div>
              <div class="r-stat-card"><div class="r-stat-value">${report.calculated_salary}</div><div class="r-stat-label">Est. Salary (SAR)</div></div>
              <div class="r-stat-card"><div class="r-stat-value">${report.avg_checkin_hours}h</div><div class="r-stat-label">Avg Hours</div></div>
            </div>
          </div>
          
          <div class="r-card">
            <div class="r-card-header"><div class="r-card-title">Daily Logs</div></div>
            <div style="display:flex; flex-direction:column;">
              ${report.logs.map(l => `
                <div class="r-log-item">
                  <div class="r-log-date">
                    <span class="day">${parseInt(l.log_date.slice(8, 10))}</span>
                    <span class="month">${new Date(l.log_date).toLocaleDateString('en-US', {month:'short'})}</span>
                  </div>
                  <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span class="r-chip ${l.attendance_status === 'Present' ? 'r-chip-success' : (l.attendance_status === 'Absent' ? 'r-chip-danger' : 'r-chip-warning')}">${l.attendance_status}</span>
                      ${l.attendance_status === 'Present' ? `<span style="font-size:13px; font-weight:700;">${(l.primary_orders||0)+(l.associate_orders||0)} <span style="font-weight:500;color:var(--r-text-muted)">orders</span></span>` : ''}
                    </div>
                    ${l.attendance_status === 'Present' ? `<div style="font-size:12px; color:var(--r-text-muted);">🕒 ${l.checkin_hours}h ${l.checkin_minutes}m</div>` : ''}
                    ${l.absent_reason ? `<div style="font-size:12px; color:var(--r-text-muted); font-style:italic;">Reason: ${l.absent_reason}</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (err) {
        content.innerHTML = `<div class="r-empty"><p style="color:var(--r-danger)">Error loading report: ${err.message}</p></div>`;
      }
    };

    const label = document.getElementById('r-rep-month-label');
    document.getElementById('r-rep-prev').addEventListener('click', () => {
      let [y, m] = label.dataset.value.split('-').map(Number);
      m--; if(m === 0) { m = 12; y--; }
      const newMonth = `${y}-${String(m).padStart(2, '0')}`;
      label.dataset.value = newMonth;
      label.textContent = new Date(y, m-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      loadReport(newMonth);
    });

    document.getElementById('r-rep-next').addEventListener('click', () => {
      let [y, m] = label.dataset.value.split('-').map(Number);
      m++; if(m === 13) { m = 1; y++; }
      const newMonth = `${y}-${String(m).padStart(2, '0')}`;
      label.dataset.value = newMonth;
      label.textContent = new Date(y, m-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      loadReport(newMonth);
    });

    // Initial load
    loadReport(label.dataset.value);
  },

  // ==========================================
  // PROFILE PAGE
  // ==========================================
  renderProfile() {
    const rider = RiderAPI.getCachedRider() || {};
    
    return `
      <div class="r-profile-header">
        <div class="r-profile-avatar">
          ${rider.profile_photo ? `<img src="${rider.profile_photo}">` : `<div style="width:100%;height:100%;border-radius:50%;background:var(--r-bg);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="var(--r-primary)" style="width:40px;height:40px;"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.7-1.6-.7s-1.1.2-1.4.6L8.5 8.4c-.3.4-.5.9-.5 1.4v4.2h2v-3.4l1.8-1.7zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg></div>`}
        </div>
        <div class="r-profile-name">${rider.name || 'Rider Name'}</div>
        <div class="r-profile-role">${rider.rider_type === 'company' ? 'Company Rider' : 'Freelancer'} • ${rider.client_company || 'Inspiring Roads'}</div>
      </div>

      <div class="r-card">
        <div class="r-card-header"><div class="r-card-title">Personal Details</div></div>
        
        <form id="r-profile-form">
          <div class="r-form-group">
            <label class="r-form-label">Phone Number</label>
            <input type="tel" class="r-form-input" id="r-prof-phone" value="${rider.phone || ''}">
          </div>
          
          <div class="r-form-group">
            <label class="r-form-label">Date of Birth</label>
            <input type="date" class="r-form-input" id="r-prof-dob" value="${rider.date_of_birth || ''}">
          </div>

          <div class="r-form-group">
            <label class="r-form-label">Nationality</label>
            <input type="text" class="r-form-input" id="r-prof-nat" value="${rider.nationality || ''}">
          </div>
          
          <div class="r-section-title">Banking</div>
          
          <div class="r-form-group">
            <label class="r-form-label">Bank Name</label>
            <input type="text" class="r-form-input" id="r-prof-bank" value="${rider.bank_name || ''}">
          </div>
          
          <div class="r-form-group">
            <label class="r-form-label">IBAN / Account Number</label>
            <input type="text" class="r-form-input" id="r-prof-iban" value="${rider.bank_account || ''}">
          </div>
          
          <button type="submit" class="r-btn r-btn-primary" id="r-prof-save" style="margin-top:16px;">Save Changes</button>
        </form>
      </div>

      <div class="r-card">
        <div class="r-card-header"><div class="r-card-title">Security</div></div>
        <form id="r-pwd-form">
          <div class="r-form-group">
            <label class="r-form-label">Current Password</label>
            <input type="password" class="r-form-input" id="r-pwd-current" required>
          </div>
          <div class="r-form-group">
            <label class="r-form-label">New Password</label>
            <input type="password" class="r-form-input" id="r-pwd-new" required minlength="4">
          </div>
          <button type="submit" class="r-btn r-btn-outline" id="r-pwd-submit">Change Password</button>
        </form>
      </div>
      
      <button class="r-btn r-btn-danger" style="margin-bottom:24px;" onclick="RiderAPI.logout()">Logout Securely</button>
    `;
  },

  attachProfileEvents() {
    document.getElementById('r-profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('r-prof-save');
      
      const data = {
        phone: document.getElementById('r-prof-phone').value,
        date_of_birth: document.getElementById('r-prof-dob').value,
        nationality: document.getElementById('r-prof-nat').value,
        bank_name: document.getElementById('r-prof-bank').value,
        bank_account: document.getElementById('r-prof-iban').value
      };
      
      try {
        btn.disabled = true;
        btn.innerHTML = '<div class="r-spinner"></div> Saving...';
        await RiderAPI.updateProfile(data);
        RiderApp.showToast('Profile updated!', 'success');
      } catch (err) {
        RiderApp.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });

    document.getElementById('r-pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('r-pwd-submit');
      const current = document.getElementById('r-pwd-current').value;
      const newPwd = document.getElementById('r-pwd-new').value;
      
      try {
        btn.disabled = true;
        btn.innerHTML = '<div class="r-spinner" style="border-color:#E2E8F0;border-top-color:var(--r-text)"></div>';
        await RiderAPI.changePassword(current, newPwd);
        RiderApp.showToast('Password changed successfully!', 'success');
        document.getElementById('r-pwd-form').reset();
      } catch (err) {
        RiderApp.showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Change Password';
      }
    });
  }

};
