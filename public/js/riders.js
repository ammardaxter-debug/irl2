// ========================================
//  RIDERS - List, Profile, Add/Edit
// ========================================

const Riders = {
  currentFilter: 'all',
  searchQuery: '',

  // Uniform & Safety Kit status calculator (6-month replacement cycle)
  getKitStatus(dateStr) {
    if (!dateStr) {
      return { label: 'Not Provided', shortLabel: 'Not Provided', color: 'var(--text-tertiary)', bg: 'var(--gray-50)', borderColor: 'var(--gray-200)', urgent: false };
    }
    const given = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const diffMs = now - given;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const sixMonths = 180; // ~6 months
    const warningAt = 150; // warn 1 month before (5 months)
    const daysLeft = sixMonths - diffDays;

    if (diffDays >= sixMonths) {
      return { label: `⚠️ Replace Now (${Math.abs(daysLeft)}d overdue)`, shortLabel: 'Replace Now!', color: '#dc2626', bg: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', urgent: true };
    }
    if (diffDays >= warningAt) {
      return { label: `🔶 Due Soon (${daysLeft}d left)`, shortLabel: `Due in ${daysLeft}d`, color: '#d97706', bg: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', urgent: true };
    }
    return { label: `✅ OK (${daysLeft}d left)`, shortLabel: 'OK', color: '#16a34a', bg: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.2)', urgent: false };
  },

  async render() {
    const container = document.getElementById('page-riders');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:24px;">
         <div class="skeleton skeleton-row" style="width:250px;"></div>
         <div class="skeleton skeleton-row" style="width:140px; height:40px;"></div>
      </div>
      <div style="display:flex; gap:12px; margin-bottom:24px;">
         <div class="skeleton skeleton-row" style="width:80px; height:36px; border-radius:30px;"></div>
         <div class="skeleton skeleton-row" style="width:80px; height:36px; border-radius:30px;"></div>
         <div class="skeleton skeleton-row" style="width:80px; height:36px; border-radius:30px;"></div>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
         <div class="skeleton skeleton-card" style="height:140px;"></div>
         <div class="skeleton skeleton-card" style="height:140px;"></div>
         <div class="skeleton skeleton-card" style="height:140px;"></div>
         <div class="skeleton skeleton-card" style="height:140px;"></div>
      </div>
    `;

    try {
      const riders = await API.getRiders('all');
      container.innerHTML = this.buildHTML(riders);
      this.attachEvents(riders);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load riders: ${err.message}</p></div>`;
    }
  },

  buildHTML(riders) {
    return `
      <!-- Page Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
        <h1 style="font-size:24px; font-weight:bold; color:#0F0F0F;">Riders</h1>
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="display:flex; gap:8px;">
            <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
            <button class="filter-tab ${this.currentFilter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
            <button class="filter-tab ${this.currentFilter === 'inactive' ? 'active' : ''}" data-filter="inactive">Inactive</button>
            <button class="filter-tab ${this.currentFilter === 'company' ? 'active' : ''}" data-filter="company">Company</button>
            <button class="filter-tab ${this.currentFilter === 'freelancer' ? 'active' : ''}" data-filter="freelancer">Freelancer</button>
            <button class="filter-tab ${this.currentFilter === 'commission_partner' ? 'active' : ''}" data-filter="commission_partner">Partners</button>
          </div>
          <button id="btn-add-rider" style="background:#2563EB; color:white; font-size:14px; font-weight:500; height:36px; padding:0 16px; border-radius:12px; box-shadow:0 2px 4px rgba(37,99,235,0.2); cursor:pointer; display:${App.isViewer() ? 'none' : 'flex'}; align-items:center; gap:6px; transition:all 0.2s;">
            + Add Rider
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div style="margin-bottom:24px;">
        <div style="position:relative; width:100%;">
          <div style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#9CA3AF; pointer-events:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <input type="text" id="rider-search" placeholder="Search riders by name, phone, company..." value="${Utils.escapeHtml(this.searchQuery)}" style="width:100%; height:44px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; padding:0 16px 0 44px; font-size:14px; color:#0F0F0F; outline:none; transition:all 0.2s;" onfocus="this.style.background='#FFFFFF'; this.style.borderColor='#2563EB';" onblur="this.style.background='#F9FAFB'; this.style.borderColor='#E5E7EB';">
        </div>
      </div>

      <style>
        .filter-tab {
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: #F3F4F6;
          color: #6B7280;
          border: none;
        }
        .filter-tab.active {
          background: #2563EB;
          color: white;
        }
        .rider-card-new {
          background: #FFFFFF;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        .rider-card-new:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          border-color: #D1D5DB;
          transform: translateY(-2px);
        }
        .riders-grid-new {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .riders-grid-new { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .riders-grid-new { grid-template-columns: 1fr; }
        }
      </style>

      <div class="riders-grid-new" id="riders-grid">
        ${this.buildRiderCards(riders)}
      </div>
    `;
  },

  buildRiderCards(riders) {
    const filtered = riders.filter(r => {
      const matchType = this.currentFilter === 'all' || 
                        (this.currentFilter === 'active' && r.status === 'active') ||
                        (this.currentFilter === 'inactive' && r.status === 'inactive') ||
                        r.rider_type === this.currentFilter;
      const q = this.searchQuery.toLowerCase();
      const matchSearch = !q ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q)) ||
        (r.client_company && r.client_company.toLowerCase().includes(q)) ||
        (r.nationality && r.nationality.toLowerCase().includes(q));
      return matchType && matchSearch;
    });

    if (filtered.length === 0) {
      return `
        <div style="grid-column:1/-1; text-align:center; padding:60px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:64px;height:64px;margin:0 auto 16px;"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style="font-size:16px; font-weight:600; color:#0F0F0F; margin-bottom:4px;">No riders found</div>
          <div style="font-size:14px; color:#6B7280;">Try adjusting your search or filters</div>
        </div>
      `;
    }

    return filtered.map((r, i) => {
      const typeBadge = r.rider_type === 'company' 
         ? `<span style="background:#EFF6FF; color:#2563EB; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Company</span>`
         : r.rider_type === 'commission_partner'
           ? `<span style="background:#ECFDF5; color:#059669; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Partner</span>`
           : `<span style="background:#F5F3FF; color:#7C3AED; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">Freelancer</span>`;
      
      const branchBadge = r.store_warehouse 
         ? `<span style="background:#F3F4F6; color:#6B7280; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600;">${Utils.escapeHtml(r.store_warehouse)}</span>` 
         : '';

      const referrer = r.referred_by_id ? riders.find(x => x.id === r.referred_by_id) : null;
      const referrerHtml = referrer 
         ? `<div style="font-size:11px; color:#4B5563; font-weight:500; display:flex; align-items:center; gap:3px; margin-top:4px;">
              <span>👤 Ref: ${Utils.escapeHtml(referrer.name)}</span>
            </div>`
         : '';

      const avatarBg = r.rider_type === 'company' ? '#2563EB' : r.rider_type === 'commission_partner' ? '#059669' : '#7C3AED';
      const avatarHtml = r.profile_photo 
         ? `<img src="${r.profile_photo}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
         : `<div style="width:40px;height:40px;border-radius:50%;background:${avatarBg};color:white;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;">${Utils.getInitials(r.name)}</div>`;

      const missingCritical = (!r.phone || !r.bank_name || (!r.bank_account && !r.iban));
      const dotHtml = missingCritical ? `<div style="position:absolute; top:16px; right:16px; width:8px; height:8px; background:#F59E0B; border-radius:50%;" title="Missing critical data"></div>` : '';

      const phoneDisplay = r.phone || '—';
      const phoneColor = r.phone ? '#374151' : '#D1D5DB';
      
      const bankDisplay = r.bank_name || '—';
      const bankColor = r.bank_name ? '#374151' : '#D1D5DB';

      const expDateDisplay = r.iqama_expiry ? Utils.formatDateShort(r.iqama_expiry) : '—';
      const expDateColor = r.iqama_expiry ? '#374151' : '#D1D5DB';

      const natDisplay = r.nationality || '—';
      const natColor = r.nationality ? '#374151' : '#D1D5DB';

      return `
        <div class="rider-card-new" data-rider-id="${r.id}" style="animation: slideUp 300ms ease both; animation-delay: ${Math.min(i*30, 300)}ms">
          ${dotHtml}
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            ${avatarHtml}
            <div>
              <div style="font-size:15px; font-weight:600; color:#0F0F0F; margin-bottom:4px;">${Utils.escapeHtml(r.name)}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                ${typeBadge}
                ${branchBadge}
              </div>
              ${referrerHtml}
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Phone</div>
              <div style="font-size:13px; font-weight:500; color:${phoneColor};">${Utils.escapeHtml(phoneDisplay)}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Bank</div>
              <div style="font-size:13px; font-weight:500; color:${bankColor};">${Utils.escapeHtml(bankDisplay)}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Iqama Expiry</div>
              <div style="font-size:13px; font-weight:500; color:${expDateColor};">${expDateDisplay}</div>
            </div>
            <div>
              <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:2px;">Nationality</div>
              <div style="font-size:13px; font-weight:500; color:${natColor};">${Utils.escapeHtml(natDisplay)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  attachEvents(riders) {
    // Search
    const searchInput = document.getElementById('rider-search');
    searchInput?.addEventListener('input', Utils.debounce((e) => {
      this.searchQuery = e.target.value;
      document.getElementById('riders-grid').innerHTML = this.buildRiderCards(riders);
      this.attachCardClicks(riders);
    }, 200));

    // Filters
    document.querySelectorAll('.filter-tab').forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentFilter = chip.dataset.filter;
        document.querySelectorAll('.filter-tab').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('riders-grid').innerHTML = this.buildRiderCards(riders);
        this.attachCardClicks(riders);
      });
    });

    // Add rider button
    const btnAddRider = document.getElementById('btn-add-rider');
    if (btnAddRider) {
      btnAddRider.addEventListener('click', (e) => {
        console.log("Add Rider clicked");
        this.openAddRider();
      });
    }

    // Card clicks
    this.attachCardClicks(riders);
  },

  attachCardClicks(riders) {
    document.querySelectorAll('.rider-card-new').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.riderId;
        const rider = riders.find(r => String(r.id) === String(id));
        if (rider) this.openProfile(rider);
      });
    });
  },

  // ── Profile Modal ──
  async openProfile(rider) {
    const avatarColors = ['#2563EB', '#7C3AED', '#0891B2', '#D97706', '#16A34A'];
    const firstLetter = rider.name ? rider.name.charAt(0).toUpperCase() : 'A';
    const avatarBg = avatarColors[firstLetter.charCodeAt(0) % avatarColors.length];
    const avatarHtml = rider.profile_photo 
       ? `<img src="${rider.profile_photo}" style="width:72px; height:72px; border-radius:50%; object-fit:cover;">` 
       : `<div style="width:72px; height:72px; border-radius:50%; background:${avatarBg}; color:white; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold;">${Utils.getInitials(rider.name)}</div>`;

      let vaultNotes = rider.doc_vault || '';
      let vaultJsonHtml = '';
      try {
         const parsed = JSON.parse(vaultNotes);
         if (parsed && typeof parsed === 'object' && parsed.emergency_name) {
            vaultJsonHtml = `
               <div style="font-size:12px; color:#374151; margin-bottom:8px; display:flex; flex-direction:column; gap:6px; background:#EFF6FF; padding:10px; border-radius:8px; border:1px solid #BFDBFE;">
                  <div style="font-weight:600; color:#1E3A8A; font-size:11px; text-transform:uppercase;">Emergency & License Info</div>
                  <div><span style="color:#6B7280;">Contact:</span> <strong>${Utils.escapeHtml(parsed.emergency_name)}</strong> (${Utils.escapeHtml(parsed.emergency_relation)}) — ${Utils.escapeHtml(parsed.emergency_phone)}</div>
                  <div><span style="color:#6B7280;">License:</span> ${Utils.escapeHtml(parsed.license_number || 'N/A')} <span style="color:#6B7280; font-size:11px;">(Exp: ${Utils.escapeHtml(parsed.license_expiry || 'N/A')})</span></div>
               </div>
            `;
            vaultNotes = parsed.admin_notes || '';
         }
      } catch (e) {}

    const typePill = rider.rider_type === 'company' 
       ? `<span style="background:#EFF6FF; color:#2563EB; font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px;">Company Rider</span>`
       : `<span style="background:#F5F3FF; color:#7C3AED; font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px;">Freelancer</span>`;
    
    const activePill = rider.status === 'active'
       ? `<span style="background:#F0FDF4; color:#16A34A; font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px; display:flex; align-items:center; gap:6px;"><div style="width:6px;height:6px;border-radius:50%;background:#16A34A;"></div>Active</span>`
       : `<span style="background:#F3F4F6; color:#6B7280; font-size:11px; font-weight:600; padding:4px 8px; border-radius:6px; display:flex; align-items:center; gap:6px;"><div style="width:6px;height:6px;border-radius:50%;background:#6B7280;"></div>Inactive</span>`;

    const branchInfo = `${rider.client_company || 'IRL'} · ${rider.store_warehouse || 'Base'}`;

    const titleHtml = `<div style="font-size:13px; color:#9CA3AF; display:flex; align-items:center;">Riders &nbsp;›&nbsp; <span style="color:#0F0F0F; font-weight:600; margin-left:4px;">${Utils.escapeHtml(rider.name).toUpperCase()}</span></div>`;
    
    const html = `
      <!-- View 1: Profile / Metrics -->
      <div style="background:#F9FAFB; border-radius:16px; padding:20px; display:flex; gap:16px; align-items:center;">
         ${avatarHtml}
         <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
               <div style="font-size:20px; font-weight:bold; color:#0F0F0F; margin-bottom:6px;">${Utils.escapeHtml(rider.name)}</div>
               <div id="net-salary-pill" style="background:#F0FDF4; color:#16A34A; font-size:13px; font-weight:600; padding:6px 12px; border-radius:8px;">Net: ...</div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:6px;" id="rider-badges-container">
               ${typePill}
               ${activePill}
            </div>
            <div style="font-size:12px; color:#6B7280;">${Utils.escapeHtml(branchInfo)}</div>
         </div>
      </div>

      <div id="assigned-vehicle-container" style="margin-top:16px;">
         <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em;">Assigned Vehicle</div>
         <div id="rider-bike-info" style="background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; padding:12px; display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:8px; background:white; border:1px solid #E5E7EB; display:flex; align-items:center; justify-content:center; color:#6B7280;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>
            </div>
            <div style="flex:1;">
               <div id="rider-bike-plate" style="font-size:14px; font-weight:600; color:#0F0F0F;">No vehicle assigned</div>
               <div id="rider-bike-model" style="font-size:12px; color:#6B7280;">Assign a bike in the edit menu</div>
            </div>
         </div>
      </div>

      <div id="rider-details-container" style="margin-top:16px;">
         <div style="font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; margin-bottom:8px; letter-spacing:0.05em;">Assignment & Details</div>
         <div style="background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px; padding:12px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            <div>
               <div style="font-size:11px; color:#6B7280;">Client Company</div>
               <div style="font-size:13px; font-weight:500; color:#0F0F0F;">${Utils.escapeHtml(rider.client_company || '—')}</div>
            </div>
            <div>
               <div style="font-size:11px; color:#6B7280;">Store / Warehouse</div>
               <div style="font-size:13px; font-weight:500; color:#0F0F0F;">${Utils.escapeHtml(rider.store_warehouse || '—')}</div>
            </div>
            <div>
               <div style="font-size:11px; color:#6B7280;">Date of Birth</div>
               <div style="font-size:13px; font-weight:500; color:#0F0F0F;">${Utils.escapeHtml(rider.date_of_birth || '—')}</div>
            </div>
            <div>
               <div style="font-size:11px; color:#6B7280;">Email</div>
               <div style="font-size:13px; font-weight:500; color:#0F0F0F; word-break:break-all;">${Utils.escapeHtml(rider.email || '—')}</div>
            </div>
            <div style="grid-column: 1 / -1;">
               <div style="font-size:11px; color:#6B7280;">Bank Account</div>
               <div style="font-size:13px; font-weight:500; color:#0F0F0F;">${rider.bank_name ? Utils.escapeHtml(rider.bank_name) + ' — ' : ''}${rider.iban ? Utils.escapeHtml(rider.iban) : (rider.bank_account ? Utils.escapeHtml(rider.bank_account) : '—')}</div>
            </div>
         </div>
      </div>
      
      <div style="height:1px; background:#F3F4F6; margin:20px 0;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
         <div style="font-size:12px; font-weight:600; color:#374151; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span id="cycle-header-date">Loading period...</span>
         </div>
         <button type="button" id="btn-refresh-profile" style="width:28px; height:28px; border-radius:50%; background:#F3F4F6; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#6B7280;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.44l5.67-5.67"/></svg>
         </button>
      </div>

      <div id="warnings-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;"></div>

      <div id="stats-grid-container" style="border:1px solid #F3F4F6; border-radius:12px; overflow:hidden; margin-bottom:0;">
         <div style="display:flex; border-bottom:1px solid #F3F4F6;">
            <div style="flex:1; padding:16px 0; text-align:center; border-right:1px solid #F3F4F6;">
               <div id="stat-present" style="font-size:24px; font-weight:bold; color:#0F0F0F; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Present</div>
            </div>
            <div style="flex:1; padding:16px 0; text-align:center; border-right:1px solid #F3F4F6;">
               <div id="stat-absent" style="font-size:24px; font-weight:bold; color:#0F0F0F; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Absent</div>
            </div>
            <div style="flex:1; padding:16px 0; text-align:center;">
               <div id="stat-weekoff" style="font-size:24px; font-weight:bold; color:#0F0F0F; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Week Off</div>
            </div>
         </div>
         <div style="display:flex;">
            <div style="flex:1; padding:16px 0; text-align:center; border-right:1px solid #F3F4F6;">
               <div id="stat-primary" style="font-size:24px; font-weight:bold; color:#0F0F0F; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Primary</div>
            </div>
            <div style="flex:1; padding:16px 0; text-align:center; border-right:1px solid #F3F4F6;">
               <div id="stat-associate" style="font-size:24px; font-weight:bold; color:#0F0F0F; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Associate</div>
            </div>
            <div style="flex:1; padding:16px 0; text-align:center;">
               <div id="stat-total" style="font-size:24px; font-weight:bold; color:#2563EB; line-height:1;">-</div>
               <div style="font-size:11px; color:#9CA3AF; text-transform:uppercase; margin-top:4px; font-weight:600;">Total Orders</div>
            </div>
         </div>
      </div>

      <div id="deductions-container" style="border-top:1px solid #F3F4F6; padding:12px 0 24px 0;">
         <div style="font-size:12px; color:#9CA3AF; font-style:italic;">No deductions this cycle</div>
      </div>

      <div style="margin-bottom:24px;">
         <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
            <label style="font-size:13px; font-weight:500; color:#374151;">Internal Notes</label>
            ${App.isViewer() ? '' : `<button class="btn btn-sm" onclick="Riders.saveVaultNotes(${rider.id})" style="height:28px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#374151; font-size:12px; font-weight:500; padding:0 12px; cursor:pointer; align-self:flex-end;">Save Notes</button>`}
         </div>
         ${vaultJsonHtml}
         <textarea id="vault-notes-${rider.id}" ${App.isViewer() ? 'readonly' : ''} placeholder="${App.isViewer() ? 'No notes added' : 'Iqama location, notes, Google Drive links...'}" style="width:100%; height:80px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:10px; padding:12px; font-size:13px; color:#0F0F0F; outline:none; resize:none; font-family:inherit; box-sizing:border-box;">${Utils.escapeHtml(vaultNotes)}</textarea>
      </div>

      <div style="margin-bottom:24px;">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="font-size:13px; font-weight:600; color:#374151; display:flex; align-items:center; gap:6px;">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               Attendance — Current Cycle
            </div>
            <div style="display:flex; gap:12px; font-size:11px; color:#6B7280; font-weight:500;">
               <span style="display:flex; align-items:center; gap:4px;"><div style="width:8px;height:8px;border-radius:50%;background:#16A34A;"></div>Logged</span>
               <span style="display:flex; align-items:center; gap:4px;"><div style="width:8px;height:8px;border-radius:50%;background:#DC2626;"></div>Missed</span>
               <span style="display:flex; align-items:center; gap:4px;"><div style="width:8px;height:8px;border-radius:50%;background:#E5E7EB;"></div>Future</span>
            </div>
         </div>
         <div id="rider-heatmap-grid" style="display:grid; grid-template-columns:repeat(7, 36px); gap:6px; justify-content:center;">
            <div style="grid-column:1/-1; text-align:center; padding:10px; font-size:12px; color:#9CA3AF;">Loading...</div>
         </div>
      </div>

      <!-- Actions Rows -->
      <div style="display:flex; flex-direction:column; gap:12px;">
         <button type="button" id="btn-share-payslip" style="width:100%; height:48px; background:#0F172A; color:white; border:none; border-radius:12px; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#1E293B'" onmouseout="this.style.background='#0F172A'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Official Payslip
         </button>
         
         ${App.isViewer() ? `
         <div style="display:flex; gap:12px;">
            <button type="button" id="btn-view-logs" style="flex:1; height:64px; background:white; border:1px solid #E5E7EB; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:13px; color:#374151; font-weight:500; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#F9FAFB'; this.style.borderColor='#D1D5DB'" onmouseout="this.style.background='white'; this.style.borderColor='#E5E7EB'">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               View Logs
            </button>
         </div>
         ` : `
         <div style="display:flex; gap:12px;">
            <button type="button" id="btn-edit-rider" style="flex:1; height:64px; background:white; border:1px solid #E5E7EB; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:13px; color:#374151; font-weight:500; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#F9FAFB'; this.style.borderColor='#D1D5DB'" onmouseout="this.style.background='white'; this.style.borderColor='#E5E7EB'">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
               Edit Details
            </button>
            <button type="button" id="btn-view-logs" style="flex:1; height:64px; background:white; border:1px solid #E5E7EB; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:13px; color:#374151; font-weight:500; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#F9FAFB'; this.style.borderColor='#D1D5DB'" onmouseout="this.style.background='white'; this.style.borderColor='#E5E7EB'">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
               View Logs
            </button>
            <button type="button" id="btn-toggle-status" style="flex:1; height:64px; background:white; border:1px solid #E5E7EB; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:13px; color:#374151; font-weight:500; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#F9FAFB'; this.style.borderColor='#D1D5DB'" onmouseout="this.style.background='white'; this.style.borderColor='#E5E7EB'">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
               Set Status
            </button>
         </div>

         <div style="margin-top:20px; display:flex; flex-direction:column; align-items:center;">
            <div style="font-size:10px; color:#9CA3AF; text-transform:uppercase; font-weight:600; letter-spacing:0.05em; margin-bottom:8px;">⚠ Danger Zone</div>
            <button type="button" id="btn-delete-rider" style="background:none; border:none; color:#DC2626; font-size:12px; font-weight:500; cursor:pointer; text-decoration:none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
               Permanently Delete Rider Data
            </button>
         </div>
         `}
      </div>
      </div>
    `;

    Utils.openModal(titleHtml, html, 'modal-rider-profile');

    const populateKPIs = async () => {
      try {
        const period = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        document.getElementById('cycle-header-date').innerText = period.label;

        const [payroll, expenses] = await Promise.all([
           API.getPayroll(period.start, period.end),
           API.getExpenses(period.start, period.end)
        ]);
        
        const riderStats = payroll.find(r => String(r.rider_id) === String(rider.id));
        const riderExpenses = expenses.filter(e => String(e.rider_id) === String(rider.id) && e.is_deductible);

        if (riderStats) {
           // Update Stats
           document.getElementById('stat-present').innerText = riderStats.present_days;
           
           const absentEl = document.getElementById('stat-absent');
           absentEl.innerText = riderStats.absent_days || 0;
           if (riderStats.absent_days > 0) absentEl.style.color = '#DC2626';

           document.getElementById('stat-weekoff').innerText = riderStats.weekoff_days || 0;
           document.getElementById('stat-primary').innerText = riderStats.total_primary_orders;
           document.getElementById('stat-associate').innerText = riderStats.total_associate_orders;
           document.getElementById('stat-total').innerText = riderStats.total_orders;

           // Net Salary
           document.getElementById('net-salary-pill').innerText = `Net: SR ${Utils.formatCurrency(riderStats.calculated_salary)}`;

           // Update Tier Badge
           let tierName = 'BRONZE', tierBg = '#FEF3C7', tierColor = '#D97706';
           if (riderStats.total_orders >= 400) { tierName = 'GOLD'; tierBg = '#FEF9C3'; tierColor = '#CA8A04'; }
           else if (riderStats.total_orders >= 250) { tierName = 'SILVER'; tierBg = '#F1F5F9'; tierColor = '#64748B'; }
           
           const badgesContainer = document.getElementById('rider-badges-container');
           if (!badgesContainer.innerHTML.includes('Tier')) {
              badgesContainer.innerHTML += `<span style="background:${tierBg}; color:${tierColor}; font-size:11px; font-weight:bold; text-transform:uppercase; padding:4px 8px; border-radius:6px;">${tierName} Tier</span>`;
           }

           // Warnings
           const warnContainer = document.getElementById('warnings-container');
           let warningsHtml = '';
           if (riderStats.warnings && riderStats.warnings.length > 0) {
              riderStats.warnings.forEach(w => {
                 const text = w.message.toLowerCase();
                 let icon = '⚠'; let bg = '#FEE2E2'; let color = '#DC2626';
                 if (text.includes('absent')) { bg = '#FEF3C7'; color = '#D97706'; }
                 warningsHtml += `<div style="height:28px; border-radius:10px; background:${bg}; color:${color}; font-size:12px; font-weight:500; display:flex; align-items:center; padding:0 10px; gap:6px;">${icon} ${w.message}</div>`;
              });
           }
           warnContainer.innerHTML = warningsHtml;

           // Deductions
           const deducContainer = document.getElementById('deductions-container');
           if (riderExpenses.length > 0) {
              let dHtml = '';
              riderExpenses.forEach(e => {
                 dHtml += `<div style="font-size:13px; color:#DC2626; margin-bottom:4px;">${Utils.escapeHtml(e.description || e.category)}: SR ${Utils.formatCurrency(e.amount)}</div>`;
              });
              deducContainer.innerHTML = dHtml;
           } else {
              deducContainer.innerHTML = `<div style="font-size:12px; color:#9CA3AF; font-style:italic;">No deductions this cycle</div>`;
           }
        } else {
           document.getElementById('net-salary-pill').innerText = "Net: SR 0.00";
        }

        // Fetch and display bike info
        if (rider.bike_id) {
          try {
            const bikes = await API.getBikes();
            const bike = bikes.find(b => String(b.id) === String(rider.bike_id));
            if (bike) {
              const plateEl = document.getElementById('rider-bike-plate');
              const modelEl = document.getElementById('rider-bike-model');
              const infoBox = document.getElementById('rider-bike-info');
              if (plateEl) plateEl.innerText = bike.plate_number;
              if (modelEl) modelEl.innerText = bike.model || 'Unknown Model';
              if (infoBox) {
                 infoBox.style.background = '#F0FDF4';
                 infoBox.style.borderColor = '#DCFCE7';
              }
            }
          } catch (err) {
            console.warn("Failed to load bike info", err);
          }
        }
      } catch (err) {
        console.warn("Failed KPI sync", err);
      }
    };

    populateKPIs();

    // Calendar Heatmap
    (async () => {
      const heatGrid = document.getElementById('rider-heatmap-grid');
      if (!heatGrid) return;
      try {
        const cycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        const startDate = new Date(cycle.start + 'T00:00:00');
        const cycleEndDate = new Date(cycle.end + 'T00:00:00');
        
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        const allSystemLogs = await API.request(`/daily-logs?rider_id=${rider.id}`) || [];
        
        const allLogs = [];
        let currentD = new Date(startDate);
        while(currentD <= cycleEndDate) {
           const dateStr = Utils.toLocalDateStr(currentD);
           const foundLog = allSystemLogs.find(l => l.log_date === dateStr && String(l.rider_id) === String(rider.id));
           if (foundLog) {
             allLogs.push({ dateObj: new Date(currentD), dateStr, logged: true });
           } else {
             allLogs.push({ dateObj: new Date(currentD), dateStr, logged: false });
           }
           currentD.setDate(currentD.getDate() + 1);
        }

        const dayNames = ['S','M','T','W','T','F','S'];
        const firstDayOfWeek = startDate.getDay();

        let cells = '';
        cells += dayNames.map(n => `<div style="width:36px; height:32px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:500; color:#9CA3AF;">${n}</div>`).join('');
        
        for (let i = 0; i < firstDayOfWeek; i++) {
          cells += '<div style="width:36px; height:36px;"></div>';
        }
        
        allLogs.forEach((logEntry) => {
          const d = logEntry.dateObj.getDate();
          const isPastOrToday = logEntry.dateObj <= todayDate;
          const isToday = logEntry.dateStr === Utils.toLocalDateStr(todayDate);
          
          let bg = '#F9FAFB';
          let textCol = '#D1D5DB';
          let border = 'none';
          
          if (isPastOrToday) {
            if (logEntry.logged) {
              bg = '#DCFCE7'; textCol = '#16A34A';
            } else {
              bg = '#FEE2E2'; textCol = '#DC2626';
            }
          }
          if (isToday) {
            border = '2px solid #2563EB'; textCol = '#2563EB'; fontW = 'bold';
            if (logEntry.logged) { bg = '#EFF6FF'; } // slight blue tint if logged today
          }
          
          cells += `<div style="width:36px; height:36px; border-radius:6px; background:${bg}; border:${border}; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:${isToday ? 'bold' : '500'}; color:${textCol}; cursor:default;" title="${logEntry.dateStr}">${d}</div>`;
        });
        
        heatGrid.innerHTML = cells;
      } catch (e) {
        heatGrid.innerHTML = '<div style="grid-column:1/-1; text-align:center; font-size:12px; color:#9CA3AF;">Failed to load attendance</div>';
      }
    })();
    
    document.getElementById('btn-refresh-profile')?.addEventListener('click', () => {
       const btn = document.getElementById('btn-refresh-profile');
       btn.style.transform = 'rotate(180deg)';
       btn.style.transition = 'transform 0.3s';
       populateKPIs().then(() => { setTimeout(() => { btn.style.transform = 'rotate(0deg)'; }, 300); });
    });

    // Export Payslip
    document.getElementById('btn-share-payslip')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-color:white;border-top-color:transparent;animation:spin 1s linear infinite;"></div> Generating...';
      btn.disabled = true;
      try {
        if (!Payroll.currentPeriod) {
          Payroll.currentPeriod = Utils.getNoonCyclePeriod(Utils.getActiveDate());
        }
        await Payroll.downloadPayslip(rider.id);
      } catch (err) {
        Utils.showToast("Failed to generate payslip", "error");
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });

    // Action buttons
    document.getElementById('btn-edit-rider')?.addEventListener('click', () => {
      Utils.closeModal();
      setTimeout(() => this.openEditRider(rider), 250);
    });

    document.getElementById('btn-view-logs')?.addEventListener('click', () => {
      Utils.closeModal();
      App.navigate('daily-logs');
    });

    document.getElementById('btn-toggle-status')?.addEventListener('click', async () => {
      const newStatus = rider.status === 'active' ? 'inactive' : 'active';
      try {
        Utils.showLoading('Saving status');
        await API.updateRider(rider.id, { status: newStatus });
        Utils.closeModal();
        this.render();
        Utils.showToast(`Rider marked as ${newStatus}`, 'success');
      } catch (err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
      }
    });

    document.getElementById('btn-delete-rider')?.addEventListener('click', () => {
      this.confirmDelete(rider);
    });
  },

  openAddRider() {
    this.openRiderForm(null);
  },

  openEditRider(rider) {
    this.openRiderForm(rider);
  },

  async openRiderForm(rider) {
    const isEdit = !!rider;
    const titleHtml = isEdit ? 
      `<div style="font-size:18px; font-weight:bold; color:#0F0F0F;">Edit Rider</div><div style="font-size:13px; color:#6B7280; font-weight:normal; margin-top:2px;">${Utils.escapeHtml(rider.name).toUpperCase()}</div>` : 
      `<div style="font-size:18px; font-weight:bold; color:#0F0F0F;">Add New Rider</div><div style="font-size:13px; color:#6B7280; font-weight:normal; margin-top:2px;">Fill in rider details to register them in the system</div>`;

    Utils.showLoading('Loading');
    let bikes = [];
    let ridersList = [];
    try {
      bikes = await API.getBikes();
      ridersList = await API.getRiders('all');
    } catch (e) {
      console.error("Failed to load modal data", e);
    }
    Utils.hideLoading();

    const laPartners = (ridersList || []).filter(r => r.rider_type === 'commission_partner' && r.status === 'active' && (!isEdit || r.id !== rider.id));
    const nationalities = ['Saudi', 'Pakistani', 'Indian', 'Bangladeshi', 'Egyptian', 'Yemeni', 'Filipino', 'Other'];
    const companies = ['Noon Minutes'];
    const warehouses = ['Dhahrat Laban', 'Mahdiyah', 'Muhammadiyah', 'Laban 2', 'Laban 3', 'Irqah 2', 'Hittin'];
    const banks = ['Al Rajhi Bank', 'SNB (AlAhli)', 'Riyad Bank', 'Alinma Bank', 'SABB', 'Banque Saudi Fransi', 'ANB', 'STC Pay', 'Urpay', 'Other'];

    const html = `
      <style>
        .rider-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .rider-form-section {
          grid-column: 1 / -1;
          font-size: 11px;
          text-transform: uppercase;
          color: #9CA3AF;
          letter-spacing: 0.08em;
          font-weight: bold;
          margin-top: 24px;
          margin-bottom: 12px;
        }
        .rider-form-group {
          display: flex;
          flex-direction: column;
        }
        .rider-form-group.full-width {
          grid-column: 1 / -1;
        }
        .rider-form-label {
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }
        .rider-form-required {
          color: #DC2626;
          margin-left: 2px;
        }
        .rider-form-input, .rider-form-select {
          height: 42px;
          background: #F9FAFB;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          font-size: 14px;
          color: #0F0F0F;
          padding: 0 12px;
          outline: none;
          transition: all 0.2s;
        }
        .rider-form-input::placeholder {
          color: #9CA3AF;
        }
        .rider-form-input:focus, .rider-form-select:focus {
          background: #FFFFFF;
          border: 1.5px solid #2563EB;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .rider-form-select {
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 36px;
        }
        .rider-form-input.error, .rider-form-select.error {
          border-color: #DC2626;
          background: #FEF2F2;
        }
        
        .modal-footer-sticky {
          position: sticky;
          bottom: -24px; /* compensate for modal-body padding */
          margin-left: -24px;
          margin-right: -24px;
          margin-top: 32px;
          padding: 16px 24px;
          background: #FFFFFF;
          border-top: 1px solid #F3F4F6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 0 0 16px 16px;
        }
        .btn-cancel-new {
          width: 120px;
          height: 42px;
          border: 1px solid #E5E7EB;
          background: #FFFFFF;
          color: #6B7280;
          font-size: 14px;
          font-weight: 500;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cancel-new:hover {
          background: #F9FAFB;
        }
        .btn-submit-new {
          width: 140px;
          height: 42px;
          background: #2563EB;
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-submit-new:hover:not(:disabled) {
          background: #1D4ED8;
        }
        .btn-submit-new:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      </style>

      <form id="rider-form" class="rider-form-grid">
        
        <div class="rider-photo-upload" style="grid-column: 1 / -1; display:flex; flex-direction:row; gap:16px; align-items:center; margin-top:8px; margin-bottom:8px;">
          <input type="file" id="profile-upload" accept="image/*" style="display:none;">
          <input type="hidden" name="profile_photo" id="profile-photo-hidden" value="${isEdit ? (rider.profile_photo || '') : ''}">
          <div class="photo-circle" onclick="document.getElementById('profile-upload').click()" style="width:56px; height:56px; border-radius:50%; border:1px solid #E5E7EB; background:#F9FAFB; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; cursor:pointer; flex-shrink:0;">
             <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" style="width:20px;height:20px;z-index:0;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
             ${isEdit && rider.profile_photo ? `<img src="${rider.profile_photo}" class="photo-preview" id="photo-preview-img" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1;">` : '<img src="" class="photo-preview" id="photo-preview-img" style="display:none; position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1;">'}
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
             <button type="button" onclick="document.getElementById('profile-upload').click()" style="height:32px; padding:0 12px; font-size:12px; font-weight:500; color:#374151; background:white; border:1px solid #E5E7EB; border-radius:8px; cursor:pointer;">Upload Photo</button>
             <button type="button" id="btn-remove-photo" style="display:${isEdit && rider.profile_photo ? 'block' : 'none'}; padding:0; background:none; border:none; font-size:12px; color:#DC2626; cursor:pointer; font-weight:500;">Remove</button>
          </div>
        </div>

        <div class="rider-form-section">PERSONAL INFORMATION</div>

        <div class="rider-form-group">
          <label class="rider-form-label">Full Name <span class="rider-form-required">*</span></label>
          <input type="text" class="rider-form-input" name="name" value="${isEdit ? Utils.escapeHtml(rider.name) : ''}" placeholder="Enter full name" required>
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Phone Number <span class="rider-form-required">*</span></label>
          <input type="text" class="rider-form-input" name="phone" value="${isEdit ? Utils.escapeHtml(rider.phone || '') : ''}" placeholder="e.g. 05xxxxxxxx" required>
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Email Address</label>
          <input type="email" class="rider-form-input" name="email" value="${isEdit ? Utils.escapeHtml(rider.email || '') : ''}" placeholder="rider@example.com">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Date of Birth</label>
          <input type="date" class="rider-form-input" name="date_of_birth" value="${isEdit ? rider.date_of_birth || '' : ''}">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Nationality</label>
          <select class="rider-form-select" name="nationality">
            <option value="">Select nationality</option>
            ${nationalities.map(n => `<option value="${n}" ${isEdit && rider.nationality === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Rider Type <span class="rider-form-required">*</span></label>
          <select class="rider-form-select" name="rider_type" id="rider-type-select">
            <option value="company" ${isEdit && rider.rider_type === 'company' ? 'selected' : ''}>Company Rider</option>
            <option value="freelancer" ${isEdit && rider.rider_type === 'freelancer' ? 'selected' : ''}>Freelancer</option>
            <option value="commission_partner" ${isEdit && rider.rider_type === 'commission_partner' ? 'selected' : ''}>Commission Partner</option>
          </select>
        </div>

        <div class="rider-form-group" id="referred-by-field" style="display: ${isEdit && rider.rider_type === 'commission_partner' ? 'none' : 'flex'}">
          <label class="rider-form-label">Referred By (LA / Partner)</label>
          <select class="rider-form-select" name="referred_by_id">
            <option value="">Direct / No Referral</option>
            ${laPartners.map(la => `<option value="${la.id}" ${isEdit && parseInt(rider.referred_by_id) === la.id ? 'selected' : ''}>${Utils.escapeHtml(la.name)}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-section">IQAMA & ASSIGNMENT</div>

        <div class="rider-form-group">
          <label class="rider-form-label">Iqama Number</label>
          <input type="text" class="rider-form-input" name="iqama_number" value="${isEdit ? Utils.escapeHtml(rider.iqama_number || '') : ''}" placeholder="Enter iqama number">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Iqama Expiry Date</label>
          <input type="date" class="rider-form-input" name="iqama_expiry" value="${isEdit ? rider.iqama_expiry || '' : ''}">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Client Company</label>
          <select class="rider-form-select" name="client_company">
            <option value="">Select company</option>
            ${companies.map(c => `<option value="${c}" ${isEdit && rider.client_company === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Company/Noon ID</label>
          <input type="text" class="rider-form-input" name="noon_id" value="${isEdit ? Utils.escapeHtml(rider.noon_id || rider.company_id || rider.rider_company_id || '') : ''}" placeholder="Enter assigned ID">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Store / Warehouse (Noon)</label>
          <select class="rider-form-select" name="store_warehouse">
            <option value="">Select store</option>
            ${warehouses.map(w => `<option value="${w}" ${isEdit && rider.store_warehouse === w ? 'selected' : ''}>${w}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-group full-width">
          <label class="rider-form-label">Assign Bike (Fleet)</label>
          <select class="rider-form-select" name="bike_id">
            <option value="">No bike assigned</option>
            ${bikes.filter(b => b.status !== 'retired').map(b => `<option value="${b.id}" ${isEdit && parseInt(rider.bike_id) === b.id ? 'selected' : ''}>${Utils.escapeHtml(b.plate_number)} - ${Utils.escapeHtml(b.model || 'Unknown')}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-group" id="salary-field" style="display: ${isEdit && rider.rider_type === 'commission_partner' ? 'none' : 'flex'}">
          <label class="rider-form-label" id="salary-label">${isEdit && rider.rider_type === 'freelancer' ? 'Per Order Rate (SAR)' : 'Base Salary (SAR)'}</label>
          <input type="number" class="rider-form-input" name="salary_value" id="salary-input"
            value="${isEdit ? (rider.rider_type === 'freelancer' ? rider.per_order_rate : rider.base_salary) : ''}"
            placeholder="${isEdit && rider.rider_type === 'freelancer' ? '8' : '1950'}">
        </div>

        <div class="rider-form-section">BANK ACCOUNT</div>

        <div class="rider-form-group">
          <label class="rider-form-label">Bank Name</label>
          <select class="rider-form-select" name="bank_name">
            <option value="">Select bank</option>
            ${banks.map(b => `<option value="${b}" ${isEdit && rider.bank_name === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Account Number</label>
          <input type="text" class="rider-form-input" name="bank_account" value="${isEdit ? Utils.escapeHtml(rider.bank_account || '') : ''}" placeholder="Enter account number (Optional)">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">IBAN Number</label>
          <input type="text" class="rider-form-input" name="iban" value="${isEdit ? Utils.escapeHtml(rider.iban || '') : ''}" placeholder="Enter IBAN">
        </div>

        <div class="rider-form-section">UNIFORM & SAFETY KIT</div>

        <div class="rider-form-group">
          <label class="rider-form-label">Uniform Provided On</label>
          <input type="date" class="rider-form-input" name="uniform_date" value="${isEdit ? rider.uniform_date || '' : ''}">
        </div>

        <div class="rider-form-group">
          <label class="rider-form-label">Safety Kit Provided On</label>
          <input type="date" class="rider-form-input" name="safety_kit_date" value="${isEdit ? rider.safety_kit_date || '' : ''}">
        </div>

        <div class="rider-form-group full-width">
          <label class="rider-form-label">Kit Notes</label>
          <input type="text" class="rider-form-input" name="kit_notes" value="${isEdit ? Utils.escapeHtml(rider.kit_notes || '') : ''}" placeholder="e.g. Helmet, Vest, Jacket, Shoes — sizes or conditions">
        </div>

        <div class="rider-form-section">🔐 RIDER PORTAL ACCESS</div>

        <div class="rider-form-group full-width" style="background:white; padding:18px; border-radius:12px; border:1px solid #E5E7EB; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:40px; height:40px; border-radius:10px; background:${isEdit && rider.portal_enabled ? '#DCFCE7' : '#F3F4F6'}; color:${isEdit && rider.portal_enabled ? '#16A34A' : '#9CA3AF'}; display:flex; align-items:center; justify-content:center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
              </div>
              <div>
                <div style="font-size:14px; font-weight:600; color:#0F0F0F;">Portal Access</div>
                <div style="font-size:12px; color:#6B7280;">Allow rider to login and view their data</div>
              </div>
            </div>
            ${isEdit && rider.portal_enabled 
              ? '<span style="background:#16A34A; color:white; font-size:11px; font-weight:600; padding:4px 8px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:white;"></div> Active</span>' 
              : '<span style="background:#F3F4F6; color:#6B7280; font-size:11px; font-weight:600; padding:4px 8px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;"><div style="width:6px;height:6px;border-radius:50%;background:#9CA3AF;"></div> Disabled</span>'}
          </div>

          <div style="background:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB;">
            <label class="rider-form-label" style="font-size:12px; font-weight:600; color:#374151;">${isEdit && rider.portal_enabled ? 'Portal Password' : 'Set Initial Password'}</label>
            <div style="display:flex; gap:8px;">
              <div style="position:relative; flex:1;">
                <div style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#9CA3AF;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <input type="text" class="rider-form-input" name="portal_password" id="portal-password-input" value="${isEdit && rider.portal_password_plain ? Utils.escapeHtml(rider.portal_password_plain) : ''}" placeholder="${isEdit && rider.portal_enabled && !rider.portal_password_plain ? '•••••••• (Encrypted - Type to override)' : 'Enter password manually'}" style="padding-left:36px; background:white; width:100%; box-sizing:border-box;">
              </div>
            </div>
            <div style="font-size:11px; color:#6B7280; margin-top:8px;">You can view or manually edit the password above. Type a new password and save to update.</div>
            ${isEdit && rider.portal_enabled && rider.last_login ? `<div style="font-size:11px; color:#6B7280; margin-top:12px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Last Login: ${Utils.formatDateTime(rider.last_login)}</div>` : ''}
          </div>
        </div>

        <div class="modal-footer-sticky">
          <div style="font-size:11px; color:#9CA3AF;">Last updated: ${isEdit ? 'Current Data' : 'New Rider'}</div>
          <div style="display:flex; gap:12px;">
             <button type="button" class="btn-cancel-new" onclick="Utils.closeModal()">Cancel</button>
             <button type="submit" class="btn-submit-new" id="btn-save-rider">
               ${isEdit ? 'Save Changes' : 'Add Rider'}
             </button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal(titleHtml, html, 'modal-rider-profile');

    // Toggle salary field label and default values based on rider type
    const typeSelect = document.getElementById('rider-type-select');
    typeSelect?.addEventListener('change', (e) => {
      const label = document.getElementById('salary-label');
      const input = document.getElementById('salary-input');
      const salaryField = document.getElementById('salary-field');
      const referredField = document.getElementById('referred-by-field');
      
      if (e.target.value === 'commission_partner') {
        if (salaryField) salaryField.style.display = 'none';
        if (referredField) referredField.style.display = 'none';
      } else {
        if (salaryField) salaryField.style.display = 'flex';
        if (referredField) referredField.style.display = 'flex';
        
        if (e.target.value === 'freelancer') {
          if (label) label.textContent = 'Per Order Rate (﷼)';
          if (input) {
            input.placeholder = '8';
            if (input.value === '1950' || input.value === '0' || !input.value.trim()) {
              input.value = '8';
            }
          }
        } else {
          if (label) label.textContent = 'Base Salary (﷼)';
          if (input) {
            input.placeholder = '1950';
            if (input.value === '8' || input.value === '0' || !input.value.trim()) {
              input.value = '1950';
            }
          }
        }
      }
    });

    // Handle Image Upload & Compression
    const fileInput = document.getElementById('profile-upload');
    const previewImg = document.getElementById('photo-preview-img');
    const hiddenPhotoInput = document.getElementById('profile-photo-hidden');
    const btnRemovePhoto = document.getElementById('btn-remove-photo');

    fileInput?.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(event) {
        // Create Cropper Modal
        const cropperModal = document.createElement('div');
        cropperModal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;";
        cropperModal.innerHTML = `
          <div style="width:100%;max-width:500px;background:white;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="padding:20px;font-weight:700;font-size:18px;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;">
              Crop Profile Photo
              <button id="btn-close-crop" style="background:none;border:none;cursor:pointer;color:#6B7280;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div style="width:100%;height:400px;background:#111827;display:flex;align-items:center;justify-content:center;">
              <img id="cropper-img" src="${event.target.result}" style="max-width:100%;max-height:100%;display:block;">
            </div>
            <div style="padding:20px;display:flex;justify-content:flex-end;gap:12px;background:#F9FAFB;">
              <button id="btn-cancel-crop" style="padding:10px 20px;border-radius:8px;border:1px solid #E5E7EB;background:white;font-weight:600;color:#374151;cursor:pointer;">Cancel</button>
              <button id="btn-save-crop" style="padding:10px 20px;border-radius:8px;border:none;background:#2563EB;font-weight:600;color:white;cursor:pointer;box-shadow:0 4px 6px -1px rgba(37,99,235,0.2);">Crop & Save HD</button>
            </div>
          </div>
        `;
        document.body.appendChild(cropperModal);
        
        const imageToCrop = document.getElementById('cropper-img');
        const cropper = new Cropper(imageToCrop, {
          aspectRatio: 1,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 1,
          restore: false,
          guides: false,
          center: false,
          highlight: false,
          cropBoxMovable: false,
          cropBoxResizable: false,
          toggleDragModeOnDblclick: false,
        });

        const closeModal = () => {
          cropper.destroy();
          cropperModal.remove();
          fileInput.value = '';
        };

        document.getElementById('btn-close-crop').onclick = closeModal;
        document.getElementById('btn-cancel-crop').onclick = closeModal;
        
        document.getElementById('btn-save-crop').onclick = () => {
          // Output high-quality 800x800 image
          const canvas = cropper.getCroppedCanvas({
            width: 800,
            height: 800,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          hiddenPhotoInput.value = dataUrl;
          previewImg.src = dataUrl;
          previewImg.style.display = 'block';
          if (btnRemovePhoto) btnRemovePhoto.style.display = 'block';
          
          cropper.destroy();
          cropperModal.remove();
        };
      };
      reader.readAsDataURL(file);
    });

    btnRemovePhoto?.addEventListener('click', () => {
       hiddenPhotoInput.value = '';
       previewImg.src = '';
       previewImg.style.display = 'none';
       btnRemovePhoto.style.display = 'none';
       fileInput.value = '';
    });

    // Form submit
    document.getElementById('rider-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('btn-save-rider');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:white;margin-right:8px;"></span> Saving...';
      }

      const formData = new FormData(e.target);
      const riderType = formData.get('rider_type');
      const salaryValue = parseFloat(formData.get('salary_value')) || 0;

      const bikeIdVal = formData.get('bike_id');

      const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email') || '',
        noon_id: formData.get('noon_id') || '',
        date_of_birth: formData.get('date_of_birth') || null,
        nationality: formData.get('nationality'),
        rider_type: riderType,
        referred_by_id: (riderType === 'commission_partner' || !formData.get('referred_by_id')) ? null : parseInt(formData.get('referred_by_id')),
        iqama_number: formData.get('iqama_number'),
        iqama_expiry: formData.get('iqama_expiry'),
        client_company: formData.get('client_company'),
        store_warehouse: formData.get('store_warehouse'),
        bank_name: formData.get('bank_name'),
        bank_account: formData.get('bank_account'),
        iban: formData.get('iban'),
        base_salary: riderType === 'company' ? (salaryValue || 1950) : 0,
        per_order_rate: riderType === 'freelancer' ? (salaryValue || 8) : 0,
        profile_photo: formData.get('profile_photo') || null,
        bike_id: bikeIdVal ? parseInt(bikeIdVal) : null,
        uniform_date: formData.get('uniform_date') || null,
        safety_kit_date: formData.get('safety_kit_date') || null,
        kit_notes: formData.get('kit_notes') || null
      };

      try {
        if (isEdit) {
          await API.updateRider(rider.id, data);
          // Set portal password if provided
          const portalPassword = formData.get('portal_password');
          if (portalPassword && portalPassword.trim().length >= 4) {
            await API.request(`/riders/${rider.id}/set-password`, { method: 'PUT', body: JSON.stringify({ password: portalPassword.trim() }) });
          }
          Utils.showToast('Rider updated successfully', 'success');
        } else {
          const created = await API.createRider(data);
          // Set portal password if provided
          const portalPassword = formData.get('portal_password');
          if (portalPassword && portalPassword.trim().length >= 4 && created && created.id) {
            await API.request(`/riders/${created.id}/set-password`, { method: 'PUT', body: JSON.stringify({ password: portalPassword.trim() }) });
          }
          Utils.showToast('Rider added successfully', 'success');
        }
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = isEdit ? 'Save Changes' : 'Add Rider';
        }
      }
    });
  },

  // ── Archive Confirmation ──
  confirmArchive(rider) {
    const html = `
      <div class="confirm-dialog">
        <div class="confirm-icon danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3>Archive ${Utils.escapeHtml(rider.name)}?</h3>
        <p>This rider will be moved to the archive. Their data will be preserved but they won't appear in active lists. This action can be reversed.</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="btn-confirm-archive">Yes, Archive Rider</button>
        </div>
      </div>
    `;

    Utils.openModal('Confirm Archive', html);

    document.getElementById('btn-confirm-archive')?.addEventListener('click', async () => {
      try {
        await API.archiveRider(rider.id);
        Utils.showToast(`${rider.name} has been archived`, 'success');
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
      }
    });
  },

  // ── Permanent Delete Confirmation ──
  confirmDelete(rider) {
    const html = `
      <div class="confirm-dialog" style="text-align: left;">
        <div class="confirm-icon danger" style="margin: 0 auto 16px auto;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <h3 style="text-align: center; color: var(--danger-600); margin-bottom: 12px;">Permanently Delete Rider?</h3>
        <p style="margin-bottom: 24px; text-align: center;"><strong>${Utils.escapeHtml(rider.name)}</strong> will be permanently removed from the system. This action cannot be undone.</p>
        
        <div class="form-group" style="background: var(--danger-50); padding: 16px; border-radius: 8px; border: 1px solid var(--danger-100)">
          <label style="color: var(--danger-700)">To confirm, please type the rider's name exactly as shown below:</label>
          <div style="font-family: monospace; font-weight: bold; font-size: 16px; margin: 8px 0; user-select: all; text-align: center;">${Utils.escapeHtml(rider.name)}</div>
          <input type="text" id="delete-confirm-input" class="form-control" autocomplete="off" placeholder="Type name here...">
        </div>
        
        <div class="confirm-actions mt-24">
          <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-danger" id="btn-confirm-delete" disabled style="opacity: 0.5;">Permanently Delete</button>
        </div>
      </div>
    `;

    Utils.openModal('Confirm Permanent Delete', html);

    const input = document.getElementById('delete-confirm-input');
    const confirmBtn = document.getElementById('btn-confirm-delete');

    input.addEventListener('input', (e) => {
      if (e.target.value === rider.name) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
      }
    });

    confirmBtn.addEventListener('click', async () => {
      if (input.value !== rider.name) return;
      try {
        Utils.showLoading('Deleting');
        await API.deleteRiderPermanently(rider.id);
        Utils.showToast(`${rider.name} has been permanently deleted`, 'success');
        Utils.closeModal();
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
      }
    });
  },

  async saveVaultNotes(riderId) {
    const textarea = document.getElementById(`vault-notes-${riderId}`);
    if (!textarea) return;
    const btn = textarea.previousElementSibling && textarea.previousElementSibling.tagName === 'BUTTON' ? textarea.previousElementSibling : (textarea.parentElement.querySelector('button'));
    try {
      const val = textarea.value.trim();
      
      const rider = this.riders.find(r => r.id === riderId);
      let newVault = val;
      if (rider && rider.doc_vault) {
        try {
          const parsed = JSON.parse(rider.doc_vault);
          if (parsed && typeof parsed === 'object' && parsed.emergency_name) {
             parsed.admin_notes = val;
             newVault = JSON.stringify(parsed);
          }
        } catch(e) {}
      }

      const updated = await API.updateRider(riderId, { doc_vault: newVault });
      // Update local state if needed
      const idx = this.riders.findIndex(r => r.id === riderId);
      if (idx !== -1) this.riders[idx] = updated;
      
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Saved ✓';
      btn.style.background = 'var(--success-500)';
      btn.style.color = 'white';
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 2000);
      Utils.showToast('Notes updated', 'success');
    } catch (e) {
      Utils.showToast('Failed to save notes', 'error');
    }
  }
};
