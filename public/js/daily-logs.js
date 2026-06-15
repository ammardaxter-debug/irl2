// ========================================
//  DAILY LOGS - Log, track & verify rider data
// ========================================

const DailyLogs = {
  currentDate: null,
  currentPage: 1,
  limit: 15,
  searchQuery: '',
  cycleSearchQuery: '',
  activeTab: 'all', // 'all', 'verified', 'pending' for logged feed
  activeCycleRiders: [],
  activeCycleLogs: [],
  bikesList: [],
  
  async render() {
    if (!this.currentDate) this.currentDate = Utils.today();
    const container = document.getElementById('page-daily-logs');
    
    // Reset search and page on fresh render (tab navigate)
    this.currentPage = 1;
    this.searchQuery = '';
    this.cycleSearchQuery = '';
    this.activeTab = 'all';

    container.innerHTML = this.buildShellHTML();
    this.attachShellEvents();
    
    // Load all required data
    await this.loadCycleTracker();
    await this.loadGridData();
  },

  buildShellHTML() {
    return `
      <!-- Page Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; animation: fadeIn var(--transition-base) both;">
        <div>
          <h1 style="font-size:24px; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em; margin-bottom:4px;">Daily Submissions & Auditing</h1>
          <div style="font-size:13px; color:var(--text-secondary); font-weight:500;">Verify rider self-submitted metrics, audit screenshots, and nudge missing logs</div>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
          <span id="date-label" style="background:var(--warning-50); color:var(--warning-600); border: 1px solid var(--warning-100); padding:6px 14px; border-radius:20px; font-size:12px; font-weight:700; letter-spacing:0.2px;">${Utils.formatDate(this.currentDate)}</span>
          <button id="logs-refresh-btn" class="header-action-btn" title="Refresh Logs" style="border-radius:12px; height:38px; width:38px; padding:0; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:16px;height:16px;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
          <button id="bulk-lodge-btn" style="background:var(--primary-600); color:white; border:none; border-radius:12px; padding:0 18px; height:38px; font-size:13px; font-weight:700; cursor:pointer; display:${App.isViewer() ? 'none' : 'flex'}; align-items:center; gap:8px; transition:all var(--transition-fast); box-shadow:var(--shadow-glow-primary);" onmouseover="this.style.background='var(--primary-700)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='var(--primary-600)'; this.style.transform='none';">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:15px;height:15px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            Bulk Override
          </button>
        </div>
      </div>

      <!-- Noon Cycle Compliance Tracker (Top Section) -->
      <div id="cycle-tracker-section" class="glass-card" style="border-radius:16px; padding:20px; margin-bottom:28px; border:1px solid var(--border-light); animation: slideUp 400ms ease both; animation-delay: 50ms;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div>
            <h2 id="cycle-label" style="font-size:16px; font-weight:800; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" stroke-width="2.2" style="width:18px;height:18px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Noon Cycle Compliance Tracker
            </h2>
            <div id="cycle-dates-sub" style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Loading cycle details...</div>
          </div>
          <div style="display:flex; gap:12px; align-items:center;">
            <input type="text" id="cycle-search" class="dashboard-search-input" placeholder="Search cycle compliance..." style="padding-left:36px; height:36px; max-width:240px; font-size:12px; background:rgba(255,255,255,0.7);">
          </div>
        </div>

        <!-- Cycle Statistics Overview -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:16px; margin-bottom:20px;">
          <div style="background:rgba(255,255,255,0.6); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.4); display:flex; align-items:center; gap:12px;">
            <div style="background:var(--primary-50); color:var(--primary-600); width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/></svg>
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Compliance Rate</div>
              <div id="cycle-stat-rate" style="font-size:18px; font-weight:800; color:var(--text-primary);">--%</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.6); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.4); display:flex; align-items:center; gap:12px;">
            <div style="background:var(--success-50); color:var(--success-600); width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Verified Logs</div>
              <div id="cycle-stat-verified" style="font-size:18px; font-weight:800; color:var(--text-primary);">0</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.6); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.4); display:flex; align-items:center; gap:12px;">
            <div style="background:var(--warning-50); color:var(--warning-600); width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Pending Audit</div>
              <div id="cycle-stat-pending" style="font-size:18px; font-weight:800; color:var(--text-primary);">0</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.6); padding:12px 16px; border-radius:12px; border:1px solid rgba(255,255,255,0.4); display:flex; align-items:center; gap:12px;">
            <div style="background:var(--danger-50); color:var(--danger-600); width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Missing Logs</div>
              <div id="cycle-stat-missing" style="font-size:18px; font-weight:800; color:var(--text-primary);">0</div>
            </div>
          </div>
        </div>

        <!-- Scrollable Riders Compliance Grid -->
        <div id="cycle-riders-list" style="max-height: 240px; overflow-y: auto; padding-right: 4px; display:flex; flex-direction:column; gap:8px;">
          <div style="padding:20px; text-align:center; color:var(--text-secondary);">
            <span class="spinner" style="width:20px; height:20px; margin-right:8px;"></span> Loading cycle compliance details...
          </div>
        </div>
      </div>

      <!-- Date picker and Search Row -->
      <div style="display:flex; flex-direction:row; gap:16px; margin-bottom:24px; align-items:center; flex-wrap:wrap; animation: fadeIn var(--transition-base) both; animation-delay: 100ms;">
        <div style="position:relative; flex:1; min-width:280px;">
          <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--gray-400); width:18px; height:18px; display:flex; align-items:center; pointer-events:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width:15px;height:15px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input type="text" id="logs-search" class="dashboard-search-input" placeholder="Search daily feed by rider name..." style="padding-left:40px; height:42px;">
        </div>

        <div style="display:flex; justify-content:center; flex-shrink:0;">
          <div style="display:flex; align-items:center; background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:12px; padding:4px; box-shadow:var(--shadow-xs);">
            <button id="date-prev" style="width:34px; height:34px; border:none; background:transparent; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); transition:all var(--transition-fast);" onmouseover="this.style.background='var(--gray-50)'; this.style.color='var(--text-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)';">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <input type="date" id="date-picker" value="${this.currentDate}" max="${Utils.today()}" style="border:none; background:transparent; font-size:14px; font-weight:700; color:var(--text-primary); outline:none; text-align:center; cursor:pointer; padding:0 12px; font-family:inherit;">
            <button id="date-next" ${this.currentDate === Utils.today() ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} style="width:34px; height:34px; border:none; background:transparent; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-secondary); transition:all var(--transition-fast);" onmouseover="this.style.background='var(--gray-50)'; this.style.color='var(--text-primary)';" onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)';">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Audit Workspace (Two Columns) -->
      <div style="display: grid; grid-template-columns: 380px 1fr; gap: 24px; animation: slideUp 400ms ease both; animation-delay:150ms;">
        
        <!-- Left Column: Missing Submissions -->
        <div class="glass-card" style="border-radius:16px; overflow:hidden; border: 1px solid var(--border-light); height: fit-content;">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid var(--border-light); background:rgba(248,250,252,0.85);">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:8px; height:8px; border-radius:50%; background:var(--danger-500); box-shadow: 0 0 8px var(--danger-400);"></div>
              <h2 style="font-size:14px; font-weight:800; color:var(--text-primary); margin:0; text-transform:uppercase; letter-spacing:0.5px;">Missing Submissions</h2>
            </div>
            <span id="missing-count" style="background:var(--danger-50); color:var(--danger-600); border: 1px solid var(--danger-100); padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">0 riders</span>
          </div>
          <div id="missing-grid" style="display:flex; flex-direction:column; max-height:600px; overflow-y:auto; background:white;">
            <div style="padding:20px; text-align:center;">
              <span class="spinner" style="width:24px; height:24px;"></span>
            </div>
          </div>
        </div>

        <!-- Right Column: Auditing & Verification Feed -->
        <div class="glass-card" style="border-radius:16px; overflow:hidden; border: 1px solid var(--border-light);">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 20px; border-bottom:1px solid var(--border-light); background:rgba(248,250,252,0.85); flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:8px; height:8px; border-radius:50%; background:var(--success-500); box-shadow: 0 0 8px var(--success-400);"></div>
              <h2 style="font-size:14px; font-weight:800; color:var(--text-primary); margin:0; text-transform:uppercase; letter-spacing:0.5px;">Verification & Audit Feed</h2>
            </div>
            
            <!-- Filter Tabs inside Audit feed -->
            <div style="display:flex; background:var(--gray-100); padding:3px; border-radius:8px; gap:2px; font-size:11px;">
              <button class="feed-tab-btn active" data-tab="all" style="border:none; padding:4px 10px; border-radius:6px; font-weight:700; cursor:pointer; background:var(--bg-card); color:var(--primary-600); transition:all var(--transition-fast);">All (<span id="feed-count-all">0</span>)</button>
              <button class="feed-tab-btn" data-tab="pending" style="border:none; padding:4px 10px; border-radius:6px; font-weight:700; cursor:pointer; background:transparent; color:var(--text-secondary); transition:all var(--transition-fast);">Pending (<span id="feed-count-pending">0</span>)</button>
              <button class="feed-tab-btn" data-tab="verified" style="border:none; padding:4px 10px; border-radius:6px; font-weight:700; cursor:pointer; background:transparent; color:var(--text-secondary); transition:all var(--transition-fast);">Verified (<span id="feed-count-verified">0</span>)</button>
            </div>
          </div>
          
          <div id="logged-grid" style="display:flex; flex-direction:column; background:white; min-height: 300px;">
            <div style="padding:20px; text-align:center;">
              <span class="spinner" style="width:24px; height:24px;"></span>
            </div>
          </div>
          <div id="logged-pagination"></div>
        </div>
      </div>

      <style>
        .compliance-tooltip {
          position: relative;
        }
        .compliance-dot-btn {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .compliance-dot-btn:hover {
          transform: scale(1.4);
          z-index: 2;
          box-shadow: 0 0 6px rgba(0,0,0,0.2);
        }
        .audit-card {
          border-bottom: 1px solid var(--border-light);
          padding: 16px 20px;
          transition: all var(--transition-fast);
        }
        .audit-card:hover {
          background: var(--gray-25);
        }
        .audit-card:last-child {
          border-bottom: none;
        }
        .audit-metric-pill {
          background: var(--gray-100);
          color: var(--text-primary);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .nudge-btn {
          border: 1px solid #25D366;
          background: rgba(37, 211, 102, 0.05);
          color: #25D366;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all var(--transition-fast);
        }
        .nudge-btn:hover {
          background: #25D366;
          color: white;
          box-shadow: 0 4px 10px rgba(37, 211, 102, 0.2);
        }
        .verify-btn {
          border: 1px solid var(--primary-600);
          background: rgba(37, 99, 235, 0.05);
          color: var(--primary-600);
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all var(--transition-fast);
        }
        .verify-btn:hover {
          background: var(--primary-600);
          color: white;
          box-shadow: var(--shadow-glow-primary);
        }
        .action-icon-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .cycle-rider-row {
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 10px 14px; 
          border-radius: 12px; 
          background: rgba(255,255,255,0.7); 
          border: 1px solid rgba(15,23,42,0.04); 
          transition: all var(--transition-fast);
        }
        .cycle-rider-row:hover {
          background: white;
          box-shadow: var(--shadow-sm);
          border-color: rgba(59,130,246,0.15);
        }
      </style>
    `;
  },

  async loadCycleTracker() {
    const trackerContainer = document.getElementById('cycle-riders-list');
    if (!trackerContainer) return;

    try {
      const cycle = Utils.getNoonCyclePeriod(this.currentDate);
      const dates = [];
      const cur = new Date(cycle.start + 'T00:00:00');
      const endD = new Date(cycle.end + 'T00:00:00');
      
      const todayDateStr = Utils.today();
      const todayLimit = new Date(todayDateStr + 'T00:00:00');
      const elapsedLimit = new Date(Math.min(endD, todayLimit));
      
      let totalExpectedDays = 0;
      let countCur = new Date(cycle.start + 'T00:00:00');
      while (countCur <= elapsedLimit) {
        totalExpectedDays++;
        countCur.setDate(countCur.getDate() + 1);
      }

      while (cur <= endD) {
        dates.push(Utils.toLocalDateStr(cur));
        cur.setDate(cur.getDate() + 1);
      }

      // Format cycle dates sublabel
      const subEl = document.getElementById('cycle-dates-sub');
      if (subEl) {
        subEl.innerText = `Cycle: ${Utils.formatDate(cycle.start)} to ${Utils.formatDate(cycle.end)} (${dates.length} days total, ${totalExpectedDays} elapsed)`;
      }

      // Fetch active riders, bikes, and cycle logs
      const [riders, bikes, cycleLogs] = await Promise.all([
        API.getRiders('active'),
        API.getBikes(),
        API.request(`/daily-logs?start=${cycle.start}&end=${cycle.end}`)
      ]);

      this.activeCycleRiders = riders || [];
      this.activeCycleLogs = cycleLogs || [];
      this.bikesList = bikes || [];

      // Create bike mapping for quick plate number lookup
      this.bikeMap = {};
      this.bikesList.forEach(b => {
        if (b.assigned_rider_id) {
          this.bikeMap[b.assigned_rider_id] = b;
        }
      });

      this.renderCycleRidersList();
    } catch(err) {
      console.error(err);
      trackerContainer.innerHTML = `<div style="padding:20px; text-align:center; color:var(--danger)">Error loading tracker: ${err.message}</div>`;
    }
  },

  renderCycleRidersList() {
    const trackerContainer = document.getElementById('cycle-riders-list');
    if (!trackerContainer) return;

    const cycle = Utils.getNoonCyclePeriod(this.currentDate);
    const dates = [];
    const cur = new Date(cycle.start + 'T00:00:00');
    const endD = new Date(cycle.end + 'T00:00:00');
    while (cur <= endD) {
      dates.push(Utils.toLocalDateStr(cur));
      cur.setDate(cur.getDate() + 1);
    }

    const todayDateStr = Utils.today();
    const todayLimit = new Date(todayDateStr + 'T00:00:00');
    const elapsedLimit = new Date(Math.min(endD, todayLimit));
    
    let totalExpectedDays = 0;
    let countCur = new Date(cycle.start + 'T00:00:00');
    while (countCur <= elapsedLimit) {
      totalExpectedDays++;
      countCur.setDate(countCur.getDate() + 1);
    }

    // Filter riders in tracker based on search query
    const filteredRiders = this.activeCycleRiders.filter(r => {
      const q = this.cycleSearchQuery.toLowerCase().trim();
      return !q || r.name.toLowerCase().includes(q) || (r.noon_id && r.noon_id.toLowerCase().includes(q));
    });

    if (filteredRiders.length === 0) {
      trackerContainer.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary);">No riders matching search query</div>`;
      return;
    }

    let grandTotalLogged = 0;
    let grandTotalVerified = 0;
    let grandTotalPending = 0;

    const ridersHTML = filteredRiders.map(rider => {
      const riderLogs = this.activeCycleLogs.filter(l => String(l.rider_id) === String(rider.id));
      let submittedCount = 0;
      let verifiedCount = 0;

      const dotsHTML = dates.map(dateStr => {
        const log = riderLogs.find(l => l.log_date === dateStr);
        const logDateObj = new Date(dateStr + 'T00:00:00');
        
        let color = '#E2E8F0'; // Default gray for future days
        let tooltipText = `${Utils.formatDate(dateStr)}: Future`;
        let cursorStyle = 'default';

        if (log) {
          submittedCount++;
          grandTotalLogged++;
          const isVerified = log.notes && log.notes.includes('[Verified]');
          if (isVerified) {
            verifiedCount++;
            grandTotalVerified++;
            color = '#10B981'; // Green for verified
            tooltipText = `${Utils.formatDate(dateStr)}: Verified (${log.attendance_status})`;
          } else {
            grandTotalPending++;
            color = '#F59E0B'; // Orange for pending verification
            tooltipText = `${Utils.formatDate(dateStr)}: Pending Audit (${log.attendance_status})`;
          }
          cursorStyle = 'pointer';
        } else if (logDateObj <= elapsedLimit) {
          color = '#FCA5A5'; // Soft red for past days with missing logs
          tooltipText = `${Utils.formatDate(dateStr)}: Missing Submission`;
          cursorStyle = 'pointer';
        }

        return `<button class="compliance-dot-btn" style="background:${color}; cursor:${cursorStyle};" title="${tooltipText}" onclick="DailyLogs.selectDateAndRider('${dateStr}', '${Utils.escapeHtml(rider.name)}')"></button>`;
      }).join('');

      const pct = totalExpectedDays > 0 ? (submittedCount / totalExpectedDays) * 100 : 0;
      const ratioColor = pct >= 90 ? 'var(--success-600)' : (pct >= 75 ? 'var(--warning-600)' : 'var(--danger-600)');
      
      const assignedBike = this.bikeMap[rider.id];
      const bikeText = assignedBike ? `• Bike ${assignedBike.plate_number}` : '• No Bike';

      return `
        <div class="cycle-rider-row">
          <div style="display:flex; flex-direction:column; gap:2px; min-width:200px; flex-shrink:0;">
            <div style="font-weight:700; font-size:13px; color:var(--text-primary); cursor:pointer; display:flex; align-items:center; gap:6px;" onclick="DailyLogs.filterByRider('${Utils.escapeHtml(rider.name)}')">
              ${Utils.escapeHtml(rider.name)}
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--primary-600)" stroke-width="2.5" style="width:12px;height:12px;opacity:0;transition:opacity var(--transition-fast);" class="rider-hover-icon"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <div style="font-size:11px; color:var(--text-secondary);">ID: ${rider.noon_id || 'N/A'} • ${rider.store_warehouse || 'No Store'} ${bikeText}</div>
          </div>
          <div style="display:flex; gap:3px; flex-wrap:wrap; max-width:500px; justify-content:flex-start; flex:1; padding:0 12px;">
            ${dotsHTML}
          </div>
          <div style="font-weight:800; font-size:12px; color:${ratioColor}; min-width:80px; text-align:right; flex-shrink:0;">
            ${submittedCount}/${totalExpectedDays} days (${Math.round(pct)}%)
          </div>
        </div>
      `;
    }).join('');

    trackerContainer.innerHTML = ridersHTML;

    // Attach styling hover behavior for rider names
    trackerContainer.querySelectorAll('.cycle-rider-row').forEach(row => {
      row.addEventListener('mouseenter', () => {
        const icon = row.querySelector('.rider-hover-icon');
        if (icon) icon.style.opacity = '1';
      });
      row.addEventListener('mouseleave', () => {
        const icon = row.querySelector('.rider-hover-icon');
        if (icon) icon.style.opacity = '0';
      });
    });

    // Update global cycle stats
    const totalExpectedSubmissions = this.activeCycleRiders.length * totalExpectedDays;
    const globalRate = totalExpectedSubmissions > 0 ? (this.activeCycleLogs.length / totalExpectedSubmissions) * 100 : 0;
    const missingSubmissionsCount = Math.max(0, totalExpectedSubmissions - this.activeCycleLogs.length);

    const statRate = document.getElementById('cycle-stat-rate');
    const statVerified = document.getElementById('cycle-stat-verified');
    const statPending = document.getElementById('cycle-stat-pending');
    const statMissing = document.getElementById('cycle-stat-missing');

    if (statRate) statRate.innerText = `${Math.round(globalRate)}%`;
    if (statVerified) statVerified.innerText = grandTotalVerified;
    if (statPending) statPending.innerText = grandTotalPending;
    if (statMissing) statMissing.innerText = missingSubmissionsCount;
  },

  selectDateAndRider(dateStr, riderName) {
    this.currentDate = dateStr;
    this.currentPage = 1;
    this.searchQuery = riderName;

    // Update controls visually
    const picker = document.getElementById('date-picker');
    if (picker) picker.value = dateStr;
    const label = document.getElementById('date-label');
    if (label) label.innerText = Utils.formatDate(dateStr);
    const searchInput = document.getElementById('logs-search');
    if (searchInput) searchInput.value = riderName;

    this.loadGridData();
  },

  filterByRider(riderName) {
    this.searchQuery = riderName;
    const searchInput = document.getElementById('logs-search');
    if (searchInput) searchInput.value = riderName;
    this.currentPage = 1;
    this.loadGridData();
  },

  async loadGridData() {
    const missingGrid = document.getElementById('missing-grid');
    const loggedGrid = document.getElementById('logged-grid');
    const loggedPagination = document.getElementById('logged-pagination');
    
    if (!missingGrid || !loggedGrid) return;

    missingGrid.innerHTML = `
      <div style="padding:30px; text-align:center;">
        <span class="spinner" style="width:24px; height:24px;"></span>
      </div>
    `;
    loggedGrid.innerHTML = `
      <div style="padding:30px; text-align:center;">
        <span class="spinner" style="width:24px; height:24px;"></span>
      </div>
    `;
    if (loggedPagination) loggedPagination.innerHTML = '';

    try {
      // Fetch missing and logged for selected date
      const [res, missing] = await Promise.all([
        API.getDailyLogs(this.currentDate, 1, 1000, ''), // Fetch all daily logs first for local tabs filtering
        API.getMissingLogs(this.currentDate)
      ]);

      const allLoggedLogs = res.logs || [];
      const totalLoggedCount = res.total || 0;

      // Filter missing list client-side based on search query
      const filteredMissing = missing.filter(r => {
        const q = this.searchQuery.toLowerCase().trim();
        return !q || (r.name && r.name.toLowerCase().includes(q)) || (r.noon_id && r.noon_id.toLowerCase().includes(q));
      });

      // Update counters
      const missingCountEl = document.getElementById('missing-count');
      if (missingCountEl) missingCountEl.innerText = `${filteredMissing.length} riders`;

      // Filter logged logs based on search query AND active verification tab
      const searchFilteredLogged = allLoggedLogs.filter(l => {
        const q = this.searchQuery.toLowerCase().trim();
        const matchesSearch = !q || (l.rider_name && l.rider_name.toLowerCase().includes(q));
        
        const isVerified = l.notes && l.notes.includes('[Verified]');
        if (this.activeTab === 'verified') {
          return matchesSearch && isVerified;
        } else if (this.activeTab === 'pending') {
          return matchesSearch && !isVerified;
        }
        return matchesSearch;
      });

      // Calculate totals for verification filter tabs
      const countAll = allLoggedLogs.filter(l => !this.searchQuery || l.rider_name.toLowerCase().includes(this.searchQuery.toLowerCase().trim())).length;
      const countVerified = allLoggedLogs.filter(l => (l.notes && l.notes.includes('[Verified]')) && (!this.searchQuery || l.rider_name.toLowerCase().includes(this.searchQuery.toLowerCase().trim()))).length;
      const countPending = countAll - countVerified;

      document.getElementById('feed-count-all').innerText = countAll;
      document.getElementById('feed-count-verified').innerText = countVerified;
      document.getElementById('feed-count-pending').innerText = countPending;

      // Implement client-side pagination for searchFilteredLogged
      const totalFiltered = searchFilteredLogged.length;
      const totalPages = Math.ceil(totalFiltered / this.limit) || 1;
      if (this.currentPage > totalPages) this.currentPage = totalPages;

      const offset = (this.currentPage - 1) * this.limit;
      const paginatedLogged = searchFilteredLogged.slice(offset, offset + this.limit);

      // Render missing list
      if (filteredMissing.length === 0) {
        missingGrid.innerHTML = `
          <div style="padding:40px 20px; text-align:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" stroke-width="1.8" style="width:40px;height:40px;margin:0 auto 12px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary);">All riders have submitted! 🎉</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">No missing daily logs for today.</div>
          </div>
        `;
      } else {
        missingGrid.innerHTML = filteredMissing.map(r => this.buildMissingCard(r)).join('');
      }

      // Render logged list
      if (paginatedLogged.length === 0) {
        loggedGrid.innerHTML = `
          <div style="padding:40px 20px; text-align:center; color:var(--text-secondary);">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" stroke-width="1.8" style="width:40px;height:40px;margin:0 auto 12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary);">No submissions match filters</div>
            <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">Check your search query or filters.</div>
          </div>
        `;
      } else {
        loggedGrid.innerHTML = paginatedLogged.map(l => this.buildLoggedCard(l)).join('');
      }

      // Render pagination controls
      if (totalPages > 1 && loggedPagination) {
        loggedPagination.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-top:1px solid #E5E7EB; background:#F9FAFB; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
            <div style="font-size:12px; color:#6B7280;">
              Showing <span style="font-weight:700; color:#111827;">${offset + 1}</span> to <span style="font-weight:700; color:#111827;">${Math.min(offset + this.limit, totalFiltered)}</span> of <span style="font-weight:700; color:#111827;">${totalFiltered}</span> submissions
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button id="page-prev" ${this.currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background:#FFFFFF; border:1px solid #D1D5DB; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; color:#374151; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s;">
                Previous
              </button>
              <span style="font-size:12px; color:#374151;">Page <span style="font-weight:700;">${this.currentPage}</span> of ${totalPages}</span>
              <button id="page-next" ${this.currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="background:#FFFFFF; border:1px solid #D1D5DB; border-radius:6px; padding:6px 12px; font-size:12px; font-weight:700; color:#374151; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all 0.2s;">
                Next
              </button>
            </div>
          </div>
        `;
      }

      this.attachGridEvents(paginatedLogged, missing, totalFiltered);
    } catch (err) {
      console.error(err);
      loggedGrid.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:var(--danger)"><p>Failed to load logs: ${err.message}</p></div>`;
      missingGrid.innerHTML = '';
    }
  },

  buildMissingCard(rider) {
    const avatarBg = rider.rider_type === 'company' ? '#2563EB' : '#7C3AED';
    const typeBadge = rider.rider_type === 'company' 
         ? `<span style="background:var(--primary-50); color:var(--primary-600); font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Company</span>`
         : `<span style="background:var(--accent-50); color:var(--accent-600); font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Freelancer</span>`;
    const branchBadge = rider.store_warehouse ? `<span style="color:var(--text-secondary); font-size:12px;">• ${Utils.escapeHtml(rider.store_warehouse)}</span>` : '';

    return `
      <div class="log-row-item pending-log log-entry-card" data-rider-id="${rider.id}" data-action="log" data-name="${Utils.escapeHtml(rider.name).toLowerCase()}">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${Utils.getInitials(rider.name)}</div>
          <div style="font-size:14px; font-weight:600; color:var(--text-primary);">${Utils.escapeHtml(rider.name)}</div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${typeBadge}
            ${branchBadge}
          </div>
        </div>
        <div>
          <button class="log-now-btn" data-rider-id="${rider.id}" data-rider-name="${Utils.escapeHtml(rider.name)}" style="background:var(--primary-600); color:white; border:none; height:28px; padding:0 12px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:4px;">
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
    let orderBg = 'var(--success-50)', orderColor = 'var(--success-600)';
    if (totalOrders < 15) { orderBg = 'var(--danger-50)'; orderColor = 'var(--danger-600)'; }
    else if (totalOrders < 20) { orderBg = 'var(--warning-50)'; orderColor = 'var(--warning-600)'; }

    // Checkin Chip Logic
    const checkinBg = isLowCheckin ? 'var(--danger-50)' : 'var(--success-50)';
    const checkinColor = isLowCheckin ? 'var(--danger-600)' : 'var(--success-600)';

    const avatarBg = log.rider_type === 'company' ? '#2563EB' : '#7C3AED';

    return `
      <div class="log-row-item logged log-entry-card" data-log-id="${log.id}" data-action="edit" data-name="${Utils.escapeHtml(log.rider_name).toLowerCase()}">
        <div style="display:flex; align-items:center; gap:12px; flex:1;">
          <div style="width:32px;height:32px;border-radius:50%;background:${avatarBg};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;">${Utils.getInitials(log.rider_name)}</div>
          <div style="font-size:14px; font-weight:600; color:var(--text-primary); ${log.attendance_status !== 'Present' ? 'opacity:0.5;' : ''}">${Utils.escapeHtml(log.rider_name)}</div>
          ${log.attendance_status !== 'Present' ? `<span style="background:var(--warning-50); color:var(--warning-600); padding:2px 6px; border-radius:4px; font-size:11px; font-weight:600;">${log.attendance_status}</span>` : ''}
          ${log.absent_reason ? `<span style="color:var(--text-secondary); font-size:12px; font-style:italic;">• ${Utils.escapeHtml(log.absent_reason)}</span>` : ''}
        </div>
        
        <div style="display:flex; align-items:center; gap:8px; ${log.attendance_status !== 'Present' ? 'opacity:0.5;' : ''}">
          <div style="background:${orderBg}; color:${orderColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px;">
            📦 ${totalOrders} Orders
          </div>
          <div style="background:${checkinBg}; color:${checkinColor}; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px;">
            🕒 ${log.checkin_hours}:${String(log.checkin_minutes).padStart(2, '0')} Hrs
          </div>
          ${log.screenshot ? `
          <button class="view-proof-btn" data-log-id="${log.id}" style="background:transparent; border:none; color:var(--primary-600); cursor:pointer; padding:4px;" title="View Screenshot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </button>` : ''}
          <button style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;" title="Edit Log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  attachShellEvents() {
    // Logs refresh button
    document.getElementById('logs-refresh-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('logs-refresh-btn');
      if (btn) {
        btn.classList.add('rotating');
        setTimeout(() => btn.classList.remove('rotating'), 800);
      }
      this.render();
    });

    // Date navigation
    document.getElementById('date-prev')?.addEventListener('click', () => {
      this.currentDate = Utils.shiftDate(this.currentDate, -1);
      this.currentPage = 1;
      const label = document.getElementById('date-label');
      if (label) label.innerText = Utils.formatDate(this.currentDate);
      const picker = document.getElementById('date-picker');
      if (picker) picker.value = this.currentDate;
      this.loadCycleTracker();
      this.loadGridData();
    });

    document.getElementById('date-next')?.addEventListener('click', () => {
      if (this.currentDate >= Utils.today()) return;
      this.currentDate = Utils.shiftDate(this.currentDate, 1);
      this.currentPage = 1;
      const label = document.getElementById('date-label');
      if (label) label.innerText = Utils.formatDate(this.currentDate);
      const picker = document.getElementById('date-picker');
      if (picker) picker.value = this.currentDate;
      this.loadCycleTracker();
      this.loadGridData();
    });

    document.getElementById('date-picker')?.addEventListener('change', (e) => {
      const selected = e.target.value;
      this.currentDate = selected > Utils.today() ? Utils.today() : selected;
      this.currentPage = 1;
      const label = document.getElementById('date-label');
      if (label) label.innerText = Utils.formatDate(this.currentDate);
      const picker = document.getElementById('date-picker');
      if (picker) picker.value = this.currentDate;
      this.loadCycleTracker();
      this.loadGridData();
    });

    // Search input (Daily logs feed filter)
    const searchInput = document.getElementById('logs-search');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1; // reset page when search changes
      this.loadGridData();
    }, 200));

    // Cycle compliance search input
    const cycleSearchInput = document.getElementById('cycle-search');
    cycleSearchInput?.addEventListener('input', Utils.debounce((e) => {
      this.cycleSearchQuery = e.target.value;
      this.renderCycleRidersList();
    }, 150));

    // Bulk override button
    document.getElementById('bulk-lodge-btn')?.addEventListener('click', () => {
      this.openBulkLodgeModal();
    });

    // Feed tabs filter event delegation
    document.querySelectorAll('.feed-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.feed-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--primary-600)';
        
        this.activeTab = btn.dataset.tab;
        this.currentPage = 1;
        this.loadGridData();
      });
    });
  },

  attachGridEvents(logged, missing, total) {
    const totalPages = Math.ceil(total / this.limit) || 1;
    
    // Pagination button clicks
    document.getElementById('page-prev')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadGridData();
      }
    });

    document.getElementById('page-next')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.loadGridData();
      }
    });

    // Verify Submission clicks
    document.querySelectorAll('.verify-now-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const logId = btn.dataset.logId;
        const notes = btn.dataset.logNotes || '';
        await this.verifyLog(logId, notes);
      });
    });

    // WhatsApp quick nudge clicks (Missing lists)
    document.querySelectorAll('.whatsapp-nudge-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const phone = btn.dataset.phone;
        const name = btn.dataset.name;
        this.nudgeRiderWhatsApp(phone, name);
      });
    });

    // WhatsApp audit chat clicks (Logged list)
    document.querySelectorAll('.whatsapp-audit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const phone = btn.dataset.phone;
        const name = btn.dataset.name;
        const dateStr = btn.dataset.date;
        const orders = btn.dataset.orders;
        const hours = btn.dataset.hours;
        this.auditRiderWhatsApp(phone, name, dateStr, orders, hours);
      });
    });

    // Override manual log click
    document.querySelectorAll('.override-log-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const riderId = parseInt(btn.dataset.riderId);
        const riderName = btn.dataset.riderName;
        this.openLogForm(riderId, riderName);
      });
    });

    // Edit logged entries
    document.querySelectorAll('.edit-log-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.dataset.logId;
        const log = logged.find(l => String(l.id) === logId);
        if (log) this.openEditForm(log);
      });
    });

    // View Proof button
    document.querySelectorAll('.view-proof-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = btn.dataset.logId;
        const log = logged.find(l => String(l.id) === logId);
        if (log && log.screenshot) {
          Utils.openModal('Screenshot Proof', `<div style="text-align:center; padding:10px;"><img src="${log.screenshot}" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:var(--shadow-lg);"></div>`);
        }
      });
    });

    // Delete Log button (Direct)
    document.querySelectorAll('.delete-log-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const logId = btn.dataset.logId;
        const riderName = btn.dataset.riderName;
        const confirmed = await Utils.confirm(`Are you sure you want to permanently delete this log for ${riderName}? This action cannot be undone.`, 'Delete Log', 'Yes, Delete', 'Cancel', true);
        if (confirmed) {
          try {
            Utils.showLoading('Deleting log');
            await API.deleteDailyLog(logId);
            Utils.showToast('Log deleted successfully', 'success');
            await this.loadGridData();
            await this.loadCycleTracker();
          } catch (err) {
            Utils.showToast(err.message, 'error');
          } finally {
            Utils.hideLoading();
          }
        }
      });
    });
  },

  // ── Verification Action ──
  async verifyLog(logId, currentNotes) {
    try {
      Utils.showLoading('Verifying submission');
      let newNotes = currentNotes || '';
      if (!newNotes.includes('[Verified]')) {
        newNotes = (newNotes.trim() + ' [Verified]').trim();
      }
      
      await API.updateDailyLog(logId, { notes: newNotes });
      Utils.showToast('Log verified successfully', 'success');
      await this.loadGridData();
      await this.loadCycleTracker();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    } finally {
      Utils.hideLoading();
    }
  },

  // ── WhatsApp Messaging Helpers ──
  formatWhatsAppPhone(phone) {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('00')) clean = clean.substring(2);
    if (clean.startsWith('0')) clean = '966' + clean.substring(1);
    if (clean.length === 9 && clean.startsWith('5')) clean = '966' + clean;
    return clean;
  },

  nudgeRiderWhatsApp(phone, name) {
    const cleanPhone = this.formatWhatsAppPhone(phone);
    if (!cleanPhone) {
      Utils.showToast('No valid phone number found for this rider', 'error');
      return;
    }
    const dateFormatted = Utils.formatDate(this.currentDate);
    const msg = `*Inspiring Roads Logistics*\n\nDear *${name}*,\n\nWe noticed that you have *not submitted* your daily log for *${dateFormatted}* yet.\n\nPlease open the *IRL Rider App* and submit your orders and check-in hours urgently to avoid any payroll issues.\n\nThank you!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  auditRiderWhatsApp(phone, name, dateStr, orders, hours) {
    const cleanPhone = this.formatWhatsAppPhone(phone);
    if (!cleanPhone) {
      Utils.showToast('No valid phone number found for this rider', 'error');
      return;
    }
    const dateFormatted = Utils.formatDate(dateStr);
    const msg = `*Inspiring Roads Logistics - Audit Check*\n\nDear *${name}*,\n\nWe are auditing your daily submission for *${dateFormatted}*.\n\n*Logged details:*\n- Total Orders: *${orders}*\n- Check-in Hours: *${hours}*\n\nPlease confirm if these numbers match your dashboard. If there is a mistake, reply to this chat.\n\nThank you!`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  },

  // ── Log entry form ──
  openLogForm(riderId, riderName) {
    const html = `
      <form id="log-form">
        <div style="margin-bottom:20px">
          <p class="text-sm text-muted">Overriding data for <strong>${Utils.escapeHtml(riderName)}</strong> on <strong>${Utils.formatDate(this.currentDate)}</strong></p>
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
              <input type="text" class="form-input" name="notes" placeholder="e.g. Admin Override, [Verified] ...">
            </div>
          </div>
          <div id="absent-reason-container" class="form-group" style="grid-column: 1/-1; display:none; animation: slideUp 200ms ease;">
            <label class="form-label" style="color:var(--danger)">Reason for Absence <span class="required">*</span></label>
            <input type="text" class="form-input" name="absent_reason" id="absent_reason_input" placeholder="e.g. Sick Leave, Bike Breakdown, No Show...">
          </div>
          <div class="form-actions" style="grid-column: 1/-1">
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn-save-log">
              Save Log
            </button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal(`Override Log — ${riderName}`, html);

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
        submitBtn.innerHTML = 'Saving...';
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
        Utils.showToast(`Override saved for ${riderName}`, 'success');
        Utils.closeModal();
        await this.loadCycleTracker();
        await this.loadGridData();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Save Log`;
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
              Delete Log
            </button>
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-update-log">
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
        
        document.querySelector('#edit-log-form input[name="primary_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="associate_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_hours"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_minutes"]').value = 0;
      } else {
        editStatsInputs.style.opacity = '0.5';
        editStatsInputs.style.pointerEvents = 'none';
        editAbsentContainer.style.display = 'none';
        editAbsentInput.required = false;
        editAbsentInput.value = '';
        
        document.querySelector('#edit-log-form input[name="primary_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="associate_orders"]').value = 0;
        document.querySelector('#edit-log-form input[name="checkin_hours"]').value = 0;
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
          await this.loadCycleTracker();
          await this.loadGridData();
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
        submitBtn.innerHTML = 'Updating...';
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
        await this.loadCycleTracker();
        await this.loadGridData();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Update Log`;
        }
      }
    });
  },

  // ── Bulk Lodge Data ──
  async openBulkLodgeModal() {
    Utils.showLoading('Loading riders');
    try {
      const cycle = Utils.getNoonCyclePeriod(this.currentDate);
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

      Utils.openModal('Bulk Override Data', html, 'modal-xl');

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
      const cycle = Utils.getNoonCyclePeriod(this.currentDate);
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
              Submit All Selected
            </button>
          </div>
        </form>
      `;

      const bulkForm = document.getElementById('bulk-lodge-form');
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
          notes: 'Bulk Override [Verified]'
        });
        success++;
      } catch (err) {
        failed++;
      }
    }

    Utils.hideLoading();
    Utils.closeModal();
    Utils.showToast(`Bulk override complete: ${success} saved, ${failed} failed`, success > 0 ? 'success' : 'error');
    await this.loadCycleTracker();
    await this.loadGridData();
  }
};
