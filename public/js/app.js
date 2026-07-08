// ========================================
//  APP - Main application controller
// ========================================

const App = {
  currentPage: 'dashboard',

  async init() {
    this.setupTheme();
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
    this.applyRolePermissions();
  },

  applyRolePermissions() {
    const role = window._irlUserRole || 'admin';
    
    // UI elements to control
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const mainHeader = document.getElementById('main-header');
    const themeToggle = document.getElementById('theme-toggle');
    const globalRefresh = document.getElementById('global-refresh-btn');
    const cycleSwiper = document.querySelector('.cycle-swiper');
    const notifIcon = document.querySelector('[onclick="Notifications.showPanel()"]');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const pageTitleEl = document.getElementById('page-title');

    if (role === 'mechanic') {
      // Hide sidebar completely and expand main content
      if (sidebar) sidebar.style.display = 'none';
      if (mainContent) {
        mainContent.style.marginLeft = '0';
        mainContent.style.width = '100%';
        mainContent.style.maxWidth = '100vw';
        mainContent.style.boxSizing = 'border-box';
      }

      // Add top padding/notch protection to header and flex layout
      if (mainHeader) {
        mainHeader.style.paddingTop = 'calc(env(safe-area-inset-top, 0px) + 12px)';
        mainHeader.style.paddingBottom = '12px';
        mainHeader.style.height = 'auto';
        mainHeader.style.minHeight = '64px';
        mainHeader.style.boxSizing = 'border-box';
      }

      // Hide unnecessary header actions
      if (themeToggle) themeToggle.style.display = 'none';
      if (globalRefresh) globalRefresh.style.display = 'none';
      if (cycleSwiper) cycleSwiper.style.display = 'none';
      if (notifIcon) notifIcon.style.display = 'none';
      if (mobileMenuBtn) mobileMenuBtn.style.display = 'none';
      if (pageTitleEl) {
        pageTitleEl.textContent = 'Mechanic Portal';
        pageTitleEl.style.fontSize = '20px';
        pageTitleEl.style.fontWeight = '800';
      }

      // Hide other sidebar links in case sidebar becomes visible
      const allowedPages = ['fleet'];
      document.querySelectorAll('.nav-item').forEach(item => {
        const page = item.dataset.page;
        if (!allowedPages.includes(page)) {
          item.style.display = 'none';
        } else {
          item.style.display = 'flex';
          const span = item.querySelector('span');
          if (span) span.textContent = 'Maintenance Tasks';
        }
      });

      // Update sidebar profile details in case
      const nameEl = document.getElementById('sidebar-name');
      const titleEl = document.getElementById('sidebar-title');
      const avatarEl = document.getElementById('sidebar-avatar');
      const loaderAvatarFallback = document.getElementById('loader-avatar-fallback');

      if (nameEl) nameEl.textContent = window._irlUserName || 'Mechanic';
      if (titleEl) titleEl.textContent = 'Fleet Mechanic · IRL';
      if (avatarEl) {
        const initials = (window._irlUserName || 'MC').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials;
      }
      if (loaderAvatarFallback) {
        const initials = (window._irlUserName || 'MC').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        loaderAvatarFallback.textContent = initials;
      }

      // If current page is not fleet, navigate to fleet
      if (this.currentPage !== 'fleet') {
        this.navigate('fleet');
      }
    } else {
      // Admin/Viewer: Restore default sidebar and main content styles
      if (sidebar) sidebar.style.display = '';
      if (mainContent) {
        mainContent.style.marginLeft = '';
        mainContent.style.width = '';
        mainContent.style.maxWidth = '';
      }
      if (mainHeader) {
        mainHeader.style.paddingTop = '';
        mainHeader.style.paddingBottom = '';
        mainHeader.style.height = '';
        mainHeader.style.minHeight = '';
      }

      document.querySelectorAll('.nav-item').forEach(item => {
        item.style.display = 'flex';
        const page = item.dataset.page;
        if (page === 'fleet') {
          const span = item.querySelector('span');
          if (span) span.textContent = 'Fleet Mgt';
        }
      });

      // Restore header actions
      if (themeToggle) themeToggle.style.display = 'flex';
      if (globalRefresh) globalRefresh.style.display = 'flex';
      if (cycleSwiper) cycleSwiper.style.display = 'flex';
      if (notifIcon) notifIcon.style.display = 'block';
      if (mobileMenuBtn) mobileMenuBtn.style.display = 'block';
      if (pageTitleEl) pageTitleEl.textContent = 'Dashboard';
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
    if (window._irlUserRole === 'mechanic' && page !== 'fleet') {
      page = 'fleet';
    }
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
      'backup': 'Backup & Data Management',
      'sprints': 'Weekly Sprints & Gamification'
    };
    document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');

    // Render page content
    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'riders': Riders.render(); break;
      case 'daily-logs': DailyLogs.render(); break;
      case 'payroll': Payroll.render(); break;
      case 'expenses': Expenses.render(); break;
      case 'fleet': Bikes.render(); break;
      case 'reports-center': ReportsCenter.render(); break;
      case 'notifications': NotificationsAdmin.render(); break;
      case 'live-tracking': LiveTracking.render(); break;
      case 'backup': Backup.render(); break;
      case 'sprints': SprintsPage.render(); break;
    }
  },

  setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    
    // Bind click event on theme toggle button
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeToggleIcon(isDark);
      });
      this.updateThemeToggleIcon(savedTheme === 'dark');
    }
  },

  updateThemeToggleIcon(isDark) {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;
    if (isDark) {
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:#FBBF24;">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      `;
      toggleBtn.title = "Switch to Light Mode";
    } else {
      toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:#475569;">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      `;
      toggleBtn.title = "Switch to Dark Mode";
    }
  },

  refreshCurrentPage() {
    const page = this.currentPage;
    const btn = document.getElementById('global-refresh-btn');
    if (btn) {
      btn.classList.add('rotating');
      setTimeout(() => btn.classList.remove('rotating'), 800);
    }
    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'riders': Riders.render(); break;
      case 'daily-logs': DailyLogs.render(); break;
      case 'payroll': Payroll.render(); break;
      case 'expenses': Expenses.render(); break;
      case 'fleet': Bikes.render(); break;
      case 'reports-center': ReportsCenter.render(); break;
      case 'notifications': NotificationsAdmin.render(); break;
      case 'live-tracking': LiveTracking.render(); break;
      case 'backup': Backup.render(); break;
      case 'sprints': SprintsPage.render(); break;
    }
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  // Check notifications on startup (after small delay to not block render)
  setTimeout(() => Notifications.check(), 2000);
});
