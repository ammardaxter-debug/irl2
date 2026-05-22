// ========================================
//  APP - Main application controller
// ========================================

const App = {
  currentPage: 'dashboard',

  async init() {
    this.setupNavigation();
    this.setupModal();
    this.setupMobileMenu();
    this.setupCommandPalette();
    this.updateHeaderDate();
    await this.loadUserRole();
    window.addEventListener('cycleChanged', () => this.updateHeaderDate());
    this.navigate('dashboard');
  },

  async loadUserRole() {
    try {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session && session.user) {
        window._irlUserRole = session.user.role || 'admin';
        window._irlUserEmail = session.user.email || '';
        window._irlUserName = session.user.name || '';
      } else {
        window._irlUserRole = 'admin';
      }
    } catch (e) {
      window._irlUserRole = 'admin';
    }
  },

  isViewer() {
    return window._irlUserRole === 'viewer';
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigate(page);
      });
    });
  },

  setupModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn?.addEventListener('click', () => Utils.closeModal());
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) Utils.closeModal();
    });

    // ESC key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Utils.closeModal();
    });
  },

  setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');

    btn?.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        if (!sidebar.contains(e.target) && e.target !== btn) {
          sidebar.classList.remove('open');
        }
      }
    });
  },

  setupCommandPalette() {
    const overlay = document.getElementById('cmd-palette-overlay');
    const input = document.getElementById('cmd-search-input');
    const resultsArea = document.getElementById('cmd-results');
    if (!overlay || !input || !resultsArea) return;

    let dbRiders = [];
    let dbBikes = [];
    
    const closePalette = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.style.display = 'none', 200);
    };

    // Keyboard shortcut (Cmd/Ctrl + K)
    document.addEventListener('keydown', async (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        overlay.style.display = 'flex';
        // tiny delay so display block renders before opacity fade
        setTimeout(() => overlay.classList.add('active'), 10);
        input.value = '';
        input.focus();
        resultsArea.innerHTML = '<div class="cmd-empty">Type to search...</div>';
        
        // Background fetch for instant lookup
        try {
          dbRiders = await API.getRiders();
          dbBikes = await API.getBikes();
        } catch(e) {}
      }
      
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closePalette();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePalette();
    });

    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        resultsArea.innerHTML = '<div class="cmd-empty">Type to search...</div>';
        return;
      }

      let results = [];

      // Pages
      const pages = [
        { title: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>', action: () => App.navigate('dashboard') },
        { title: 'Riders', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', action: () => App.navigate('riders') },
        { title: 'Expense Tracker', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', action: () => App.navigate('expenses') },
        { title: 'Fleet Management', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>', action: () => App.navigate('fleet') }
      ];

      pages.forEach(p => {
        if (p.title.toLowerCase().includes(q)) {
          results.push({ ...p, subtitle: 'Application Page' });
        }
      });

      // Riders
      dbRiders.forEach(r => {
        if (r.name.toLowerCase().includes(q) || (r.phone && r.phone.includes(q))) {
          results.push({
            title: r.name,
            subtitle: `Rider • ${r.phone || 'No phone'}`,
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            action: () => { closePalette(); App.navigate('riders'); setTimeout(() => Riders.openProfile(r), 300); }
          });
        }
      });

      // Bikes
      dbBikes.forEach(b => {
        if (b.plate_number.toLowerCase().includes(q)) {
          results.push({
            title: b.plate_number,
            subtitle: `Motorcycle • ${b.status}`,
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
            action: () => { closePalette(); App.navigate('fleet'); setTimeout(() => Bikes.openEditBikeModal(b.id), 300); }
          });
        }
      });

      if (results.length === 0) {
        resultsArea.innerHTML = '<div class="cmd-empty">No results found</div>';
        return;
      }

      resultsArea.innerHTML = results.map((r, i) => `
        <div class="cmd-item" id="cmd-item-${i}">
          <div class="cmd-item-icon">${r.icon}</div>
          <div class="cmd-item-content">
            <div class="cmd-item-title">${Utils.escapeHtml(r.title)}</div>
            <div class="cmd-item-subtitle">${Utils.escapeHtml(r.subtitle)}</div>
          </div>
        </div>
      `).join('');

      results.forEach((r, i) => {
        document.getElementById(`cmd-item-${i}`).addEventListener('click', r.action);
      });
    });
  },

  updateHeaderDate() {
    const dateEl = document.getElementById('header-date');
    if (dateEl) {
      const activeDate = Utils.getActiveDate();
      const period = Utils.getNoonCyclePeriod(activeDate);
      dateEl.textContent = period.label;
    }
  },

  navigate(page) {
    this.currentPage = page;

    // Clear live tracking interval if navigating away
    if (page !== 'live-tracking' && typeof LiveTracking !== 'undefined' && LiveTracking.stopSync) {
      LiveTracking.stopSync();
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Update page visibility
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    // Update title
    const titles = {
      'dashboard': 'Dashboard',
      'riders': 'Riders',
      'daily-logs': 'Daily Logs',
      'payroll': 'Payroll',
      'expenses': 'Expense Tracker',
      'fleet': 'Fleet Management',
      'reports-center': 'Reports & Export Center',
      'notifications': 'Rider Alerts & Notifications',
      'live-tracking': 'Live Tracking',
      'backup': 'Backup & Data Management'
    };
    document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');

    // Render page content
    switch (page) {      case 'dashboard': Dashboard.render(); break;
      case 'riders': Riders.render(); break;
      case 'daily-logs': DailyLogs.render(); break;
      case 'payroll': Payroll.render(); break;
      case 'expenses': Expenses.render(); break;
      case 'fleet': Bikes.render(); break;
      case 'reports-center': ReportsCenter.render(); break;
      case 'notifications': NotificationsAdmin.render(); break;
      case 'live-tracking': LiveTracking.render(); break;
      case 'backup': Backup.render(); break;
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  // Check notifications on startup (after small delay to not block render)
  setTimeout(() => Notifications.check(), 2000);
});
