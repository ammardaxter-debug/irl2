// ========================================
//  Rider Portal — Core Application
// ========================================

const RiderApp = {
  container: null,

  init() {
    this.container = document.getElementById('rider-app');
    
    // Auth Check
    const token = RiderAPI.getToken();
    if (token) {
      this.navigate('home');
      // Background sync profile
      RiderAPI.getProfile().catch(e => {
        if (e.message.includes('expired') || e.message.includes('Invalid')) {
          this.navigate('login');
        }
      });
    } else {
      this.navigate('login');
    }
  },

  navigate(pageName) {
    this.container.innerHTML = ''; // clear current
    
    let content = '';
    
    switch (pageName) {
      case 'login':
        content = RiderPages.renderLogin();
        break;
      case 'home':
        content = this.wrapWithLayout(RiderPages.renderHome(), 'home');
        break;
      case 'log':
        content = this.wrapWithLayout(RiderPages.renderLog(), 'log');
        break;
      case 'report':
        content = this.wrapWithLayout(RiderPages.renderReport(), 'report');
        break;
      case 'profile':
        content = this.wrapWithLayout(RiderPages.renderProfile(), 'profile');
        break;
      case 'notifications':
        content = this.wrapWithLayout(RiderPages.renderNotifications(), 'notifications');
        break;
      default:
        content = this.wrapWithLayout(`<div class="r-empty"><p>Page not found</p></div>`);
    }

    this.container.innerHTML = content;
    
    // Attach events after rendering
    if (RiderPages[`attach${this.capitalize(pageName)}Events`]) {
      RiderPages[`attach${this.capitalize(pageName)}Events`]();
    }
  },

  wrapWithLayout(pageContent, activeNav) {
    const rider = RiderAPI.getCachedRider() || { name: 'Rider' };
    const initials = rider.name ? rider.name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase() : 'R';
    const avatarHtml = rider.profile_photo 
      ? `<img src="${rider.profile_photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : `<svg viewBox="0 0 24 24" fill="var(--r-primary)" style="width:20px;height:20px;"><path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.7-1.6-.7s-1.1.2-1.4.6L8.5 8.4c-.3.4-.5.9-.5 1.4v4.2h2v-3.4l1.8-1.7zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/></svg>`;

    return `
      <div class="r-app-layout r-page-enter">
        <header class="r-app-header">
          <div class="logo-mini">
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div class="title">Inspiring Roads</div>
          <div class="r-header-actions">
            <button class="r-header-icon-btn" id="r-online-btn" title="Coming Soon" disabled>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M8.5 8.5a6 6 0 0 1 7 0"/><path d="M5.6 5.6a10 10 0 0 1 12.8 0"/></svg>
              <span class="r-online-label">Offline</span>
              <span class="r-coming-soon-dot"></span>
            </button>
            <button class="r-header-icon-btn" id="r-notif-btn" onclick="RiderApp.navigate('notifications')">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            <div class="r-profile-avatar" style="width:32px;height:32px;margin:0;border:none;font-size:12px;background:var(--r-bg);color:var(--r-text);display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;" onclick="RiderApp.navigate('profile')">
              ${avatarHtml}
            </div>
          </div>
        </header>

        <main class="r-app-body">
          ${pageContent}
        </main>

        <nav class="r-bottom-nav">
          <a href="#" class="r-nav-item ${activeNav === 'home' ? 'active' : ''}" onclick="event.preventDefault(); RiderApp.navigate('home')">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <span>Home</span>
          </a>
          <a href="#" class="r-nav-item ${activeNav === 'log' ? 'active' : ''}" onclick="event.preventDefault(); RiderApp.navigate('log')">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            <span>Lodge Data</span>
          </a>
          <a href="#" class="r-nav-item ${activeNav === 'report' ? 'active' : ''}" onclick="event.preventDefault(); RiderApp.navigate('report')">
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>Reports</span>
          </a>
          <a href="#" class="r-nav-item ${activeNav === 'profile' ? 'active' : ''}" onclick="event.preventDefault(); RiderApp.navigate('profile')">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Profile</span>
          </a>
        </nav>
      </div>
    `;
  },

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('r-toast-container');
    const toast = document.createElement('div');
    toast.className = `r-toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  getTodayLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /** Get current Noon cycle boundaries (21st prev month → 20th current month) */
  getCurrentCycle() {
    const now = new Date();
    const day = now.getDate();
    let startYear, startMonth, endYear, endMonth;

    if (day >= 21) {
      // Cycle: 21st of this month → 20th of next month
      startYear = now.getFullYear();
      startMonth = now.getMonth() + 1;
      endMonth = now.getMonth() + 2;
      endYear = now.getFullYear();
      if (endMonth > 12) { endMonth = 1; endYear++; }
    } else {
      // Cycle: 21st of previous month → 20th of this month
      startMonth = now.getMonth(); // previous month (0-indexed becomes 1-indexed)
      startYear = now.getFullYear();
      if (startMonth === 0) { startMonth = 12; startYear--; }
      endMonth = now.getMonth() + 1;
      endYear = now.getFullYear();
    }

    const start = `${startYear}-${String(startMonth).padStart(2, '0')}-21`;
    const end = `${endYear}-${String(endMonth).padStart(2, '0')}-20`;
    return { start, end };
  },

  /** Get previous cycle boundaries relative to the current active cycle */
  getPreviousCycle() {
    const current = this.getCurrentCycle();
    const [y, m, d] = current.start.split('-').map(Number);
    
    // Previous cycle starts on the 21st of the month before current.start
    let prevStartM = m - 1;
    let prevStartY = y;
    if (prevStartM === 0) { prevStartM = 12; prevStartY--; }
    
    // Previous cycle ends on the 20th of the month of current.start
    let prevEndM = m;
    let prevEndY = y;
    
    const start = `${prevStartY}-${String(prevStartM).padStart(2, '0')}-21`;
    const end = `${prevEndY}-${String(prevEndM).padStart(2, '0')}-20`;
    return { start, end };
  },

  /** Get cycle for a given month string like "2026-05" */
  getCycleForMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    let prevY = y;
    let prevM = m - 1;
    if (prevM === 0) { prevM = 12; prevY--; }
    const start = `${prevY}-${String(prevM).padStart(2, '0')}-21`;
    const end = `${y}-${String(m).padStart(2, '0')}-20`;
    return { start, end };
  }
};

document.addEventListener('DOMContentLoaded', () => {
  RiderApp.init();
});
