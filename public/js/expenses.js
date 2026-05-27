// ========================================
//  EXPENSE TRACKER MODULE
// ========================================

const Expenses = {
  currentTab: 'expenses',
  currentDeductionTab: 'pending',
  currentRequestTab: 'pending',
  deductionsData: null,
  riders: [],

  async render() {
    const root = document.getElementById('page-expenses');
    if (!root) return;

    root.innerHTML = `
      <div class="page-header" style="margin-bottom:24px;">
        <div class="skeleton skeleton-row" style="width:200px; height:32px;"></div>
        <div class="header-actions" style="display:flex; gap:12px;">
          <div class="skeleton skeleton-row" style="width:120px; height:40px;"></div>
          <div class="skeleton skeleton-row" style="width:120px; height:40px;"></div>
        </div>
      </div>
      <div class="stats-grid" style="margin-bottom: 24px;">
        <div class="skeleton skeleton-card" style="height:100px;"></div>
        <div class="skeleton skeleton-card" style="height:100px;"></div>
        <div class="skeleton skeleton-card" style="height:100px;"></div>
      </div>
      <div class="skeleton skeleton-card" style="height:400px; margin-top:20px;"></div>
    `;
    
    try {
      this.riders = await API.getRiders();
      await this.renderDashboard(root);
    } catch (err) {
      Utils.showToast(err.message, 'error');
      root.innerHTML = `<div class="p-8" style="color:var(--danger)">Failed to load expenses</div>`;
    }
  },

  async renderDashboard(root) {
    try {
      const stats = await API.getExpenseStats();
      const outOfPocketTotal = stats.from_my_pocket;
      const isPocketWarn = outOfPocketTotal > 0;
      
      const remainingBg = stats.remaining_irl > 500 ? '#F0FDF4' : (stats.remaining_irl >= 100 ? '#FFFBEB' : '#FEF2F2');
      const remainingTextColor = stats.remaining_irl > 500 ? '#16A34A' : (stats.remaining_irl >= 100 ? '#D97706' : '#DC2626');
      
      const headerHtml = `
        <style>
          .stat-card-new {
            background: #FFFFFF;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #E5E7EB;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .stat-card-new-title {
            font-size: 14px;
            color: #6B7280;
            font-weight: 500;
          }
          .stat-card-new-value {
            font-size: 26px;
            font-weight: 700;
            color: #0F0F0F;
          }
          .btn-group {
            display: flex;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #2563EB;
          }
          .btn-group button {
            height: 36px;
            padding: 0 16px;
            font-size: 14px;
            font-weight: 500;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-group-outline {
            background: #FFFFFF;
            color: #2563EB;
            border-right: 1px solid #2563EB;
          }
          .btn-group-outline:hover {
            background: #EFF6FF;
          }
          .btn-group-filled {
            background: #2563EB;
            color: #FFFFFF;
          }
          .btn-group-filled:hover {
            background: #1D4ED8;
          }
          .tab-clean {
            padding: 0 4px 12px;
            font-size: 14px;
            font-weight: 500;
            color: #6B7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
          }
          .tab-clean.active {
            color: #0F0F0F;
            border-bottom: 2px solid #2563EB;
          }
          .table-clean {
            width: 100%;
            border-collapse: collapse;
            background: #FFFFFF;
          }
          .table-clean th {
            text-align: left;
            padding: 12px 16px;
            font-size: 12px;
            font-weight: 600;
            color: #6B7280;
            border-bottom: 1px solid #E5E7EB;
            background: #FFFFFF;
          }
          .table-clean td {
            padding: 16px;
            font-size: 14px;
            color: #0F0F0F;
            border-bottom: 1px solid #E5E7EB;
          }
          .inline-add-row {
            background: #F9FAFB;
          }
          .inline-add-row td {
            padding: 12px 16px;
            border-bottom: 1px solid #E5E7EB;
          }
          .inline-input {
            width: 100%;
            height: 36px;
            padding: 0 12px;
            border: 1px solid #D1D5DB;
            border-radius: 12px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
            background: #FFFFFF;
          }
          .inline-input:focus {
            border-color: #2563EB;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
          }
        </style>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
          <h1 style="font-size:24px; font-weight:bold; color:#0F0F0F;">Expense Tracker</h1>
          ${App.isViewer() ? '' : `
          <div class="btn-group">
            <button class="btn-group-outline" onclick="Expenses.openAddFundsModal()">Log IRL Funds</button>
            <button class="btn-group-filled" onclick="Expenses.openAddExpenseModal()">Add Expense</button>
          </div>
          `}
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #E5E7EB;">
          <div style="font-size:14px; font-weight:600; color:#4B5563; display:flex; align-items:center; gap:8px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px; height:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Generate Report
          </div>
          <div style="display:flex; gap:12px;">
            <button class="btn btn-outline" style="border-radius:20px; font-weight:500; padding:6px 16px; height:auto; font-size:13px;" onclick="Reports.generateExpenseReport('this_month')">This Month</button>
            <button class="btn btn-outline" style="border-radius:20px; font-weight:500; padding:6px 16px; height:auto; font-size:13px;" onclick="Reports.generateExpenseReport('last_month')">Last Month</button>
            <button class="btn btn-outline" style="border-radius:20px; font-weight:500; padding:6px 16px; height:auto; font-size:13px;" onclick="Reports.generateExpenseReport('all')">Full History</button>
            <button class="btn btn-primary" style="background:#1E3A8A; border-color:#1E3A8A; border-radius:20px; font-weight:500; padding:6px 16px; height:auto; font-size:13px; color:#FFFFFF;" onclick="Reports.openSponsorReportModal()">Sponsor Report</button>
            <button class="btn btn-success" style="background:#10B981; border-color:#10B981; border-radius:20px; font-weight:500; padding:6px 16px; height:auto; font-size:13px; color:#FFFFFF;" onclick="Expenses.openCustomExcelReportModal()">Excel Report</button>
          </div>
        </div>
        
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
          <div class="stat-card-new" style="background:#EFF6FF; border-color:#BFDBFE;" title="Total funds received from IRL this cycle">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="stat-card-new-title" style="color:#1E3A8A;">Received from Company</span>
              <span style="font-size:20px;">💰</span>
            </div>
            <div class="stat-card-new-value" style="color:#2563EB;">${Utils.formatCurrency(stats.total_received)}</div>
          </div>
          
          <div class="stat-card-new" title="Total of all operational expenses and deductions">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="stat-card-new-title">Total Expenses</span>
            </div>
            <div class="stat-card-new-value">${Utils.formatCurrency(stats.total_expenses)}</div>
          </div>
          
          <div class="stat-card-new" title="Total expenses paid using company funds">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="stat-card-new-title">Company Funds Used</span>
            </div>
            <div class="stat-card-new-value">${Utils.formatCurrency(stats.used_from_irl)}</div>
          </div>
          
          <div class="stat-card-new" style="background:${remainingBg}; border-color:${remainingBg === '#FFFFFF' ? '#E5E7EB' : 'transparent'};" title="Unspent company funds">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="stat-card-new-title" style="color:${remainingTextColor};">Remaining Balance</span>
            </div>
            <div class="stat-card-new-value" style="color:${remainingTextColor};">${Utils.formatCurrency(stats.remaining_irl)}</div>
          </div>
          
          <div class="stat-card-new" style="${isPocketWarn ? 'background:#FEF2F2; border-color:#FECACA;' : 'display:none;'}" title="Running Out of Pocket Balance">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span class="stat-card-new-title" style="color:#DC2626;">Out of Pocket</span>
            </div>
            <div class="stat-card-new-value" style="color:#DC2626;">-${Utils.formatCurrency(outOfPocketTotal)}</div>
          </div>
        </div>

        <div style="display:flex; gap:24px; border-bottom:1px solid #E5E7EB; margin-bottom:24px;">
          <div class="tab-clean ${this.currentTab === 'expenses' ? 'active' : ''}" data-tab="expenses" onclick="Expenses.switchTab('expenses')">Expenses Log</div>
          <div class="tab-clean ${this.currentTab === 'funds' ? 'active' : ''}" data-tab="funds" onclick="Expenses.switchTab('funds')">Funds Received</div>
          <div class="tab-clean ${this.currentTab === 'deductions' ? 'active' : ''}" data-tab="deductions" onclick="Expenses.switchTab('deductions')">Rider Deductions</div>
          <div class="tab-clean ${this.currentTab === 'rider_requests' ? 'active' : ''}" data-tab="rider_requests" onclick="Expenses.switchTab('rider_requests')">Rider Requests</div>
        </div>

        <div id="expense-content-area">
          <div class="p-8"><div class="spinner"></div></div>
        </div>


      `;
      root.innerHTML = headerHtml;
      
      await this.renderTabContent();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async switchTab(tab) {
    this.currentTab = tab;
    
    // Update active tab visually
    document.querySelectorAll('#page-expenses .tab-clean').forEach(t => {
      if (t.dataset.tab === tab) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    
    // Show immediate skeleton table loader to prevent stale data flash
    const area = document.getElementById('expense-content-area');
    if (area) area.innerHTML = `<div style="height:400px;background:white;border-radius:12px;border:1px solid var(--slate-200);animation:pulse 1.5s infinite; opacity:0.6"></div>`;
    
    await this.renderTabContent();
  },

  async renderTabContent() {
    const area = document.getElementById('expense-content-area');
    if (!area) return;

    if (this.currentTab === 'expenses') {
      this.deductionsData = null; // Clear deductions cache
      const expenses = await API.getExpenses();
      this.cachedExpenses = expenses; // Cache for edit modal
      let html = `
        <div style="margin-bottom: 16px; display:flex; gap:12px; align-items:center;">
          <div style="position:relative; width:100%; max-width:350px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" style="width:18px;height:18px; position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" id="expense-search-input" placeholder="Search by category, recipient, or notes..." style="width:100%; height:40px; padding:0 12px 0 36px; border:1px solid #E5E7EB; border-radius:8px; font-size:14px; outline:none; transition:border-color 0.2s;" onfocus="this.style.borderColor='#2563EB';" onblur="this.style.borderColor='#E5E7EB';">
          </div>
          <select id="expense-rider-filter" style="height:40px; padding:0 12px; border:1px solid #E5E7EB; border-radius:8px; font-size:14px; outline:none; background:#FFFFFF; color:#4B5563; min-width:200px; cursor:pointer;" onfocus="this.style.borderColor='#2563EB';" onblur="this.style.borderColor='#E5E7EB';">
            <option value="">All Expenses</option>
            <option value="company">General / Company Only</option>
            ${this.riders.map(r => `<option value="${r.id}">${Utils.escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div style="width:100%; overflow-x:auto; border-radius:12px; border:1px solid #E5E7EB; background:#FFFFFF;">
          <table class="table-clean" id="expenses-data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Recipient / Item</th>
                <th>Deductible</th>
                <th style="text-align:right">Amount</th>
                <th>Receipt</th>
                ${App.isViewer() ? '' : '<th>Actions</th>'}
              </tr>
            </thead>
            <tbody>
              <!-- Inline Quick Add Row -->
              ${App.isViewer() ? '' : `
              <tr class="inline-add-row">
                <td>
                  <input type="date" id="qa-date" class="inline-input" value="${Utils.today()}">
                </td>
                <td>
                  <select id="qa-category" class="inline-input">
                    <option value="" disabled selected>Category...</option>
                    <option value="Advance">Advance</option>
                    <option value="Food">Food</option>
                    <option value="Transport">Transport</option>
                    <option value="Fuel">Fuel</option>
                    <option value="Bike Maintenance">Bike Maintenance</option>
                    <option value="Traffic Fine">Traffic Fine</option>
                    <option value="Internet Package">Internet Package</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Staff Refreshments">Staff Refreshments</option>
                    <option value="Office / Admin">Office / Admin</option>
                    <option value="Health / Medical">Health / Medical</option>
                    <option value="Other">Other</option>
                  </select>
                </td>
                <td>
                  <input type="text" id="qa-desc" class="inline-input" placeholder="Who / What...">
                </td>
                <td>
                  <!-- Deductibility removed for Quick Add (assumed Company Paid) -->
                </td>
                <td>
                  <input type="number" step="0.01" id="qa-amount" class="inline-input" style="font-weight:600; text-align:right;" placeholder="0.00">
                </td>
                <td colspan="2" style="text-align:right; vertical-align:middle;">
                  <button class="btn btn-sm" id="btn-qa-save" style="background:#2563EB; color:white; height:36px; font-size:13px; padding:0 16px; border:none; border-radius:12px; cursor:pointer; font-weight:500; transition:background 0.2s;" onmouseover="this.style.background='#1D4ED8'" onmouseout="this.style.background='#2563EB'">Add</button>
                </td>
              </tr>
              `}
      `;
      
      const displayExpenses = expenses.filter(e => e.category !== 'Manual Deduction');

      if (displayExpenses.length === 0) {
        html += `<tr><td colspan="7" style="text-align:center; padding:64px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:48px;height:48px; margin:0 auto 16px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
          <div style="font-size:16px; font-weight:500; color:#0F0F0F;">No expenses logged yet</div>
        </td></tr>`;
      } else {
        displayExpenses.forEach(e => {
          const dateStr = Utils.formatDate(e.expense_date);
          let deductBadge = '';
          if (e.is_deductible && (e.is_deductible === 'true' || e.is_deductible === 1 || e.is_deductible === true)) {
            if (e.rider_id) {
              deductBadge = `<span style="background:#FEF3C7; color:#D97706; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">Rider Deductible</span>`;
            } else {
              deductBadge = `<span style="background:#FFEDD5; color:#C2410C; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">Supervisor Deductible</span>`;
            }
          } else {
            deductBadge = `<span style="background:#DCFCE7; color:#16A34A; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:500;">Company Paid</span>`;
          }
            
          let catColor = '#4B5563';
          let catBg = '#F3F4F6';
          const catLower = (e.category || '').toLowerCase();
          if (catLower.includes('advance')) { catColor = '#7C3AED'; catBg = '#F5F3FF'; }
          else if (catLower.includes('food') || catLower.includes('refreshment')) { catColor = '#D97706'; catBg = '#FFFBEB'; }
          else if (catLower.includes('transport') || catLower.includes('fuel')) { catColor = '#2563EB'; catBg = '#EFF6FF'; }
          else if (catLower.includes('health') || catLower.includes('medical')) { catColor = '#E11D48'; catBg = '#FFE4E6'; }
          else if (catLower.includes('internet') || catLower.includes('package')) { catColor = '#0891B2'; catBg = '#ECFEFF'; }
          
          const catBadge = `<span style="background:${catBg}; color:${catColor}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:500;">${Utils.escapeHtml(e.category)}</span>`;

          const foundRider = e.rider_id ? this.riders.find(r => r.id == e.rider_id) : null;
          let rName = e.rider_name;
          if (!rName || rName === 'Rider') rName = foundRider ? foundRider.name : 'Rider';
          const recipientStr = e.rider_id ? Utils.escapeHtml(rName) : Utils.escapeHtml(e.vendor_name || 'Other');
          const amountColor = e.is_deductible ? '#DC2626' : '#0F0F0F';
          
          html += `
            <tr class="expense-row" data-rider-id="${e.rider_id || ''}" data-search="${Utils.escapeHtml(e.category + ' ' + recipientStr + ' ' + (e.notes || '')).toLowerCase()}" style="transition:background 0.2s;" onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background='transparent'">
              <td style="white-space:nowrap; color:#4B5563;">${dateStr}</td>
              <td>${catBadge}</td>
              <td><div style="font-weight:500; color:#0F0F0F;">${recipientStr}</div><div style="color:#6B7280; font-size:13px; margin-top:2px;">${Utils.escapeHtml(e.notes || '')}</div></td>
              <td>${deductBadge}</td>
              <td style="font-weight:600; color:${amountColor}; text-align:right;">${Utils.formatCurrency(e.amount)}</td>
              <td>
                ${this.renderThumbnail(e.receipt_base64, `Expenses.viewReceipt(${e.id})`)}
              </td>
              ${App.isViewer() ? '' : `
              <td>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-sm" style="background:#F3F4F6; color:#4B5563; border:none; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;" onclick="Expenses.openEditExpenseModal(${e.id})">Edit</button>
                  <button class="btn btn-sm" style="background:#FEF2F2; color:#DC2626; border:none; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;" onclick="Expenses.deleteExpense(${e.id})">Delete</button>
                </div>
              </td>
              `}
            </tr>
          `;
        });
      }
      
      html += `</tbody></table></div>`;
      area.innerHTML = html;
      
      // Bind Search & Filter Events
      const applyFilters = () => {
        const searchInput = document.getElementById('expense-search-input');
        const filterInput = document.getElementById('expense-rider-filter');
        if (!searchInput || !filterInput) return;
        
        const query = searchInput.value.toLowerCase().trim();
        const riderId = filterInput.value;
        
        document.querySelectorAll('#expenses-data-table .expense-row').forEach(row => {
          const matchesSearch = !query || row.dataset.search.includes(query);
          const rowRiderId = row.dataset.riderId || '';
          
          let matchesRider = true;
          if (riderId === 'company') {
             matchesRider = (rowRiderId === '');
          } else if (riderId !== '') {
             matchesRider = (rowRiderId === riderId);
          }
          
          if (matchesSearch && matchesRider) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      };

      document.getElementById('expense-search-input')?.addEventListener('input', applyFilters);
      document.getElementById('expense-rider-filter')?.addEventListener('change', applyFilters);

      // Bind Quick Add Event
      const handleQuickAdd = async () => {
        const date = document.getElementById('qa-date').value;
        const category = document.getElementById('qa-category').value;
        const desc = document.getElementById('qa-desc').value.trim();
        const isDeductible = false; // Quick Add is always Company Expense
        const amount = parseFloat(document.getElementById('qa-amount').value);

        if (!date || !category || isNaN(amount) || amount <= 0) {
          Utils.showToast('Please fill Date, Category, and a valid Amount.', 'error');
          return;
        }

        // Duplicate Detection
        const isDuplicate = expenses.some(e => 
          e.expense_date === date && 
          e.category === category && 
          e.amount === amount && 
          (Date.now() - new Date(e.created_at || Date.now()).getTime()) < 86400000 // Added recently
        );

        if (isDuplicate) {
          const confirmed = await Utils.confirm(
            'An identical expense was recorded recently. Are you sure you want to add this again?',
            'Duplicate Detected', 'Add Anyway', 'Cancel', false
          );
          if (!confirmed) return;
        }

        const btn = document.getElementById('btn-qa-save');
        const origText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:white;"></span>';
        btn.disabled = true;

        try {
          this.showProcessingOverlay(category, amount, false);

          // Send to API
          const payload = {
             expense_date: date,
             category: category,
             is_deductible: isDeductible,
             amount: amount,
             vendor_name: desc,
             rider_id: null,
             notes: desc,
             receipt_base64: null,
             created_at: new Date().toISOString()
          };
          
          await API.createExpense(payload);

          this.finishProcessingOverlay();

          setTimeout(() => {
            Utils.showToast('Expense saved inline ✓', 'success');
            // Re-render
            this.render();
          }, 1200);
          
        } catch (err) {
           this.hideProcessingOverlayError();
           Utils.showToast(err.message, 'error');
           btn.innerHTML = origText;
           btn.disabled = false;
        }
      };

      document.getElementById('btn-qa-save')?.addEventListener('click', handleQuickAdd);
      document.getElementById('qa-amount')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleQuickAdd();
      });
    } else if (this.currentTab === 'funds') {
      const funds = await API.getFunds();
      let html = `
        <div style="width:100%; overflow-x:auto; border-radius:12px; border:1px solid #E5E7EB; background:#FFFFFF;">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style="text-align:right">Amount</th>
                <th>Receipt</th>
                ${App.isViewer() ? '' : '<th>Actions</th>'}
              </tr>
            </thead>
            <tbody>
      `;
      
      if (funds.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center; padding:64px 20px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:48px;height:48px; margin:0 auto 16px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
          <div style="font-size:16px; font-weight:500; color:#0F0F0F;">No company funds logged yet</div>
        </td></tr>`;
      } else {
        funds.forEach(f => {
          const dateStr = Utils.formatDate(f.receive_date);
          
          html += `
            <tr style="transition:background 0.2s;" onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background='transparent'">
              <td style="white-space:nowrap; color:#4B5563;">${dateStr}</td>
              <td>
                <div style="font-weight:500; color:#0F0F0F;">${Utils.escapeHtml(f.description || 'IRL Transfer')}</div>
                <div style="color:#6B7280; font-size:13px; margin-top:2px;">${Utils.escapeHtml(f.notes || '')}</div>
              </td>
              <td style="font-weight:600; color:#16A34A; text-align:right;">+${Utils.formatCurrency(f.amount)}</td>
              <td>
                ${this.renderThumbnail(f.receipt_base64, `Expenses.viewFundReceipt(${f.id})`)}
              </td>
              ${App.isViewer() ? '' : `
              <td>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-sm" style="background:#F3F4F6; color:#4B5563; border:none; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;" onclick="Expenses.openEditFundModal(${f.id})">Edit</button>
                  <button class="btn btn-sm" style="background:#FEF2F2; color:#DC2626; border:none; padding:4px 12px; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer;" onclick="Expenses.deleteFund(${f.id})">Delete</button>
                </div>
              </td>
              `}
            </tr>
          `;
        });
      }
      
      html += `</tbody></table></div>`;
      area.innerHTML = html;
    } else if (this.currentTab === 'deductions') {
      if (!this.deductionsData) {
        area.innerHTML = `
          <div style="margin-bottom:16px;">
            <div style="width:100%; height:40px; border-radius:24px; background:#F3F4F6; animation:pulse 1.5s infinite;"></div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            ${[1,2,3].map(() => `
              <div style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px; overflow:hidden;">
                <div style="background:#F9FAFB; padding:16px 20px; border-bottom:1px solid #E5E7EB;">
                  <div style="width:200px; height:20px; background:#E5E7EB; border-radius:4px; animation:pulse 1.5s infinite alternate;"></div>
                </div>
                <div style="padding:16px 20px;">
                  <div style="width:100%; height:16px; background:#E5E7EB; border-radius:4px; margin-bottom:12px; animation:pulse 1.5s infinite alternate;"></div>
                  <div style="width:100%; height:16px; background:#E5E7EB; border-radius:4px; animation:pulse 1.5s infinite alternate;"></div>
                </div>
              </div>
            `).join('')}
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { background-color: #e5e7eb; }
              50% { background-color: #f3f4f6; }
            }
          </style>
        `;

        try {
          const expenses = await API.getExpenses();
          const riderExpenses = expenses.filter(e => {
            const isMedical = (e.category || '').toLowerCase().includes('medical');
            return !isMedical && (e.is_deductible === 1 || e.is_deductible === true) && e.rider_id;
          });
          
          const riderMap = {};
          for (const e of riderExpenses) {
            if (!riderMap[e.rider_id]) {
              const foundRider = this.riders.find(r => r.id == e.rider_id);
              let rName = e.rider_name;
              if (!rName || rName === 'Rider') rName = foundRider ? foundRider.name : `Rider #${e.rider_id}`;
              riderMap[e.rider_id] = { 
                rider_name: rName, 
                rider_id: e.rider_id, 
                pending: [], 
                settled: [] 
              };
            }
            if (e.deductionSettled) { riderMap[e.rider_id].settled.push(e); }
            else { riderMap[e.rider_id].pending.push(e); }
          }
          
          this.deductionsData = {
            pending: Object.values(riderMap).filter(r => r.pending.length > 0),
            settled: Object.values(riderMap).filter(r => r.settled.length > 0)
          };
        } catch(err) {
          area.innerHTML = `<div style="color:red">Failed to load: ${err.message}</div>`;
          return;
        }
      }
      
      this.renderDeductionsUI(area);
    } else if (this.currentTab === 'rider_requests') {
      await this.renderRiderRequests(area);
    }
  },

  async renderRiderRequests(area) {
    const isPendingTab = this.currentRequestTab === 'pending';
    
    let html = `
      <style>
        .request-tab-btn {
          border: none;
          background: transparent;
          color: #6B7280;
          padding: 8px 24px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 200ms ease, color 200ms ease;
          position: relative;
          z-index: 2;
          flex: 1;
        }
        .request-tab-btn:hover:not(.active) {
          background: #EFF6FF;
        }
        .request-tab-btn.active {
          color: #FFFFFF;
        }
        .request-tab-btn-wrapper {
          position: relative;
          display: flex;
          background: #F3F4F6;
          padding: 4px;
          border-radius: 24px;
          width: 320px;
        }
        .request-tab-indicator {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          background-color: #2563EB;
          border-radius: 20px;
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }
        .request-tab-indicator.pending { transform: translateX(0); }
        .request-tab-indicator.history { transform: translateX(100%); }
        
        #request-tab-content {
          transition: opacity 100ms ease, transform 150ms ease-out;
        }
      </style>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div class="request-tab-btn-wrapper">
          <div id="request-tab-bg-indicator" class="request-tab-indicator ${this.currentRequestTab}"></div>
          <button id="btn-request-tab-pending" class="request-tab-btn ${isPendingTab ? 'active' : ''}" onclick="Expenses.switchRequestTab('pending')">Pending Requests</button>
          <button id="btn-request-tab-history" class="request-tab-btn ${!isPendingTab ? 'active' : ''}" onclick="Expenses.switchRequestTab('history')">Request History</button>
        </div>
      </div>
      <div id="request-tab-content" style="width:100%;">
        <div class="p-8"><div class="spinner"></div></div>
      </div>
    `;
    area.innerHTML = html;
    
    const container = document.getElementById('request-tab-content');
    await this.renderRiderRequestsList(container);
  },

  async switchRequestTab(tab) {
    this.currentRequestTab = tab;
    const indicator = document.getElementById('request-tab-bg-indicator');
    const btnPending = document.getElementById('btn-request-tab-pending');
    const btnHistory = document.getElementById('btn-request-tab-history');
    const container = document.getElementById('request-tab-content');
    
    if (indicator) {
      if (tab === 'pending') {
        indicator.classList.remove('history');
        indicator.classList.add('pending');
      } else {
        indicator.classList.remove('pending');
        indicator.classList.add('history');
      }
    }
    
    if (btnPending) {
      if (tab === 'pending') btnPending.classList.add('active');
      else btnPending.classList.remove('active');
    }
    
    if (btnHistory) {
      if (tab === 'history') btnHistory.classList.add('active');
      else btnHistory.classList.remove('active');
    }
    
    if (container) {
      container.style.opacity = '0.5';
      container.style.transform = 'translateY(4px)';
      await this.renderRiderRequestsList(container);
      container.style.opacity = '1';
      container.style.transform = 'translateY(0)';
    }
  },

  async renderRiderRequestsList(container) {
    try {
      const isPending = this.currentRequestTab === 'pending';
      const requests = await API.getRiderRequests(isPending ? 'pending' : 'history');
      
      let html = `
        <div style="width:100%; overflow-x:auto; border-radius:12px; border:1px solid #E5E7EB; background:#FFFFFF;">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Rider</th>
                <th>Category</th>
                <th>Description</th>
                <th style="text-align:right">Amount</th>
                ${isPending ? '<th>Actions</th>' : '<th>Status</th><th>Processed By</th><th>Admin Notes / Reason</th><th>Receipt</th>'}
              </tr>
            </thead>
            <tbody>
      `;

      if (requests.length === 0) {
        html += `<tr><td colspan="${isPending ? 6 : 9}" style="text-align:center; padding:64px 20px;">
          <div style="font-size:16px; font-weight:500; color:#6B7280;">No requests found</div>
        </td></tr>`;
      } else {
        // Fetch expenses to match receipts
        let expenses = [];
        if (!isPending) {
          try {
            expenses = await API.getExpenses();
          } catch(e) { console.warn('Failed to load expenses for matching receipts:', e); }
        }

        requests.forEach(r => {
          const dateStr = Utils.formatDateTime(r.created_at || r.updated_at);
          
          let actionOrInfo = '';
          if (isPending) {
            actionOrInfo = `
              <td>
                <div style="display:flex; gap:8px;">
                  <button class="btn btn-sm" style="background:#16A34A; color:white; border:none; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;" onclick="Expenses.processRiderRequest(${r.id}, 'approved')">Approve</button>
                  <button class="btn btn-sm" style="background:#DC2626; color:white; border:none; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;" onclick="Expenses.processRiderRequest(${r.id}, 'rejected')">Reject</button>
                </div>
              </td>
            `;
          } else {
            const isApproved = r.status === 'approved';
            const badgeColor = isApproved ? '#16A34A' : '#DC2626';
            const badgeBg = isApproved ? '#F0FDF4' : '#FEF2F2';
            
            // Check if there is an expense matching this request_id
            const matchedExp = expenses.find(e => String(e.request_id) === String(r.id));
            let receiptCell = '<span style="color:#9CA3AF; font-size:12px;">No receipt</span>';
            if (matchedExp && matchedExp.receipt_base64) {
              receiptCell = `
                <button class="btn btn-sm" style="background:#EBF5FF; color:#1E40AF; border:1px solid #BFDBFE; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px;" onclick="Expenses.viewReceipt(${matchedExp.id})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  View
                </button>
              `;
            }
            
            actionOrInfo = `
              <td>
                <span style="background:${badgeBg}; color:${badgeColor}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600; text-transform:capitalize;">${r.status}</span>
              </td>
              <td style="color:#4B5563; font-size:13px;">${Utils.escapeHtml(r.processed_by || 'Admin')}</td>
              <td style="color:#4B5563; font-size:13px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${Utils.escapeHtml(r.admin_note || '-')}">${Utils.escapeHtml(r.admin_note || '-')}</td>
              <td>${receiptCell}</td>
            `;
          }

          html += `
            <tr style="transition:background 0.2s;" onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background='transparent'">
              <td style="white-space:nowrap; color:#4B5563;">${dateStr}</td>
              <td><div style="font-weight:600; color:#0F0F0F;">${Utils.escapeHtml(r.rider_name)}</div></td>
              <td><span style="background:#EFF6FF; color:#2563EB; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600;">${Utils.escapeHtml(r.category)}</span></td>
              <td><div style="font-size:13px; color:#4B5563;">${Utils.escapeHtml(r.description || '-')}</div></td>
              <td style="font-weight:700; color:#0F0F0F; text-align:right; white-space:nowrap;">${Utils.formatCurrency(r.amount)}</td>
              ${actionOrInfo}
            </tr>
          `;
        });
      }
      html += `</tbody></table></div>`;
      container.innerHTML = html;
    } catch(err) {
      container.innerHTML = `<div style="color:red; padding:20px;">Error loading requests: ${err.message}</div>`;
    }
  },

  async processRiderRequest(id, status) {
    try {
      Utils.showLoading('Loading request details...');
      // Fetch requests to get details
      const requests = await API.getRiderRequests(status === 'approved' ? 'pending' : 'all');
      const r = requests.find(req => String(req.id) === String(id));
      Utils.hideLoading();
      if (!r) {
        return Utils.showToast('Request details not found', 'error');
      }

      if (status === 'rejected') {
        this.showRejectionModal(r);
      } else {
        this.showApprovalModal(r);
      }
    } catch(err) {
      Utils.hideLoading();
      Utils.showToast(err.message, 'error');
    }
  },

  showApprovalModal(r) {
    const html = `
      <form id="approve-request-form" style="padding:4px 0;">
        <div style="background:#F9FAFB; padding:16px; border-radius:12px; border:1px solid #E5E7EB; margin-bottom:20px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:14px;">
            <div><span style="color:#6B7280;">Rider:</span> <strong style="color:#111827;">${Utils.escapeHtml(r.rider_name)}</strong></div>
            <div><span style="color:#6B7280;">Amount:</span> <strong style="color:#111827;">${Utils.formatCurrency(r.amount)}</strong></div>
            <div><span style="color:#6B7280;">Category:</span> <span style="background:#EFF6FF; color:#2563EB; padding:2px 6px; border-radius:4px; font-size:12px; font-weight:600;">${Utils.escapeHtml(r.category)}</span></div>
            <div><span style="color:#6B7280;">Submitted:</span> <span style="color:#4B5563;">${Utils.formatDateTime(r.created_at)}</span></div>
          </div>
          <div style="margin-top:10px; font-size:13px; color:#4B5563; border-top:1px solid #E5E7EB; padding-top:10px;">
            <span style="color:#6B7280; font-weight:500;">Description:</span> ${Utils.escapeHtml(r.description || '-')}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <label class="expense-form-label" style="font-weight:600; color:#374151; margin-bottom:6px; display:block;">Admin Note (Optional)</label>
          <textarea name="admin_note" class="expense-form-input" style="width:100%; min-height:60px; padding:10px; border-radius:8px; border:1.5px solid #E5E7EB; resize:none;" placeholder="Add details or comments for this approval..."></textarea>
        </div>

        <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px; background:#F9FAFB; padding:10px 14px; border-radius:8px; border:1px solid #E5E7EB;">
          <input type="checkbox" id="attach-receipt-toggle" style="width:18px; height:18px; cursor:pointer;">
          <label for="attach-receipt-toggle" style="font-size:14px; font-weight:600; color:#374151; cursor:pointer; user-select:none;">Attach Receipt?</label>
        </div>

        <div id="receipt-upload-container" style="display:none; margin-bottom:20px;">
          <label class="expense-form-label" style="font-weight:600; color:#374151; margin-bottom:6px; display:block;">Receipt Upload</label>
          <div class="expense-upload-zone" onclick="document.getElementById('approve-receipt-upload').click()" style="border:2.5px dashed #D1D5DB; padding:20px; border-radius:10px; text-align:center; cursor:pointer; background:#FFFFFF; transition:border 0.2s;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" style="margin:0 auto 8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="upload-text" style="font-size:13px; font-weight:500; color:#4B5563;">Click or drag to attach receipt or PDF</span>
          </div>
          <div id="approve-receipt-preview-area" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
          <input type="file" id="approve-receipt-upload" multiple accept="image/*,.pdf" style="display:none;">
          <div style="font-size:11px; color:#9CA3AF; margin-top:6px;">Images compressed automatically · PDFs supported</div>
          <input type="hidden" id="approve-receipt-base64-hidden">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid #E5E7EB; padding-top:16px; margin-top:16px;">
          <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
          <button type="submit" id="btn-submit-approve" style="width:140px; height:42px; border-radius:10px; border:none; background:#16A34A; color:white; font-weight:600; cursor:pointer;">Approve</button>
        </div>
      </form>
    `;

    Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#16A34A;">Approve Rider Request</div>', html, 'modal-approve');

    // Toggle receipt container
    document.getElementById('attach-receipt-toggle').addEventListener('change', (e) => {
      const container = document.getElementById('receipt-upload-container');
      container.style.display = e.target.checked ? 'block' : 'none';
      if (!e.target.checked) {
        document.getElementById('approve-receipt-base64-hidden').value = '';
        document.getElementById('approve-receipt-preview-area').innerHTML = '';
        document.getElementById('approve-receipt-preview-area').style.display = 'none';
      }
    });

    // Init file upload functionality
    this.initMultiUpload('approve-receipt-upload', 'approve-receipt-base64-hidden', 'approve-receipt-preview-area', 'approve-request-form');

    // Form submit
    document.getElementById('approve-request-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const adminNote = e.target.elements.admin_note.value.trim();
      const attachReceipt = document.getElementById('attach-receipt-toggle').checked;
      const receiptBase64 = attachReceipt ? document.getElementById('approve-receipt-base64-hidden').value || null : null;

      try {
        Utils.closeModal();
        Utils.showLoading('Approving request...');
        await API.updateRiderRequestStatus(r.id, 'approved', adminNote, receiptBase64);
        Utils.showToast('Request approved successfully');
        this.render();
      } catch(err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
      }
    });
  },

  showRejectionModal(r) {
    const html = `
      <div style="padding:4px 0;">
        <div style="background:#F9FAFB; padding:16px; border-radius:12px; border:1px solid #E5E7EB; margin-bottom:20px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:14px;">
            <div><span style="color:#6B7280;">Rider:</span> <strong style="color:#111827;">${Utils.escapeHtml(r.rider_name)}</strong></div>
            <div><span style="color:#6B7280;">Amount:</span> <strong style="color:#111827;">${Utils.formatCurrency(r.amount)}</strong></div>
            <div><span style="color:#6B7280;">Category:</span> <span style="background:#EFF6FF; color:#2563EB; padding:2px 6px; border-radius:4px; font-size:12px; font-weight:600;">${Utils.escapeHtml(r.category)}</span></div>
            <div><span style="color:#6B7280;">Submitted:</span> <span style="color:#4B5563;">${Utils.formatDateTime(r.created_at)}</span></div>
          </div>
          <div style="margin-top:10px; font-size:13px; color:#4B5563; border-top:1px solid #E5E7EB; padding-top:10px;">
            <span style="color:#6B7280; font-weight:500;">Description:</span> ${Utils.escapeHtml(r.description || '-')}
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label class="expense-form-label" style="font-weight:600; color:#374151; margin-bottom:6px; display:block;">Rejection Reason</label>
          <textarea id="rejection-reason" class="expense-form-input" style="width:100%; min-height:80px; padding:10px; border-radius:8px; border:1.5px solid #E5E7EB; resize:none;" placeholder="Explain why this request is rejected..."></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:12px; border-top:1px solid #E5E7EB; padding-top:16px;">
          <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
          <button id="btn-submit-reject" style="width:140px; height:42px; border-radius:10px; border:none; background:#DC2626; color:white; font-weight:600; cursor:pointer;">Reject Request</button>
        </div>
      </div>
    `;

    Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#DC2626;">Reject Rider Request</div>', html, 'modal-reject');

    document.getElementById('btn-submit-reject').addEventListener('click', async () => {
      const adminNote = document.getElementById('rejection-reason').value.trim();
      if (!adminNote) {
        return Utils.showToast('Please enter a reason for rejection', 'error');
      }

      try {
        Utils.closeModal();
        Utils.showLoading('Rejecting request...');
        await API.updateRiderRequestStatus(r.id, 'rejected', adminNote);
        Utils.showToast('Request rejected successfully');
        this.render();
      } catch(err) {
        Utils.showToast(err.message, 'error');
      } finally {
        Utils.hideLoading();
      }
    });
  },

  renderDeductionsUI(area) {
    const isPendingTab = this.currentDeductionTab === 'pending';
    
    let html = `
      <style>
        .deduction-tab-btn {
          border: none;
          background: transparent;
          color: #6B7280;
          padding: 8px 24px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 200ms ease, color 200ms ease;
          position: relative;
          z-index: 2;
          flex: 1;
        }
        .deduction-tab-btn:hover:not(.active) {
          background: #EFF6FF;
        }
        .deduction-tab-btn.active {
          color: #FFFFFF;
        }
        .deduction-tab-btn-wrapper {
          position: relative;
          display: flex;
          background: #F3F4F6;
          padding: 4px;
          border-radius: 24px;
          width: 320px;
        }
        .tab-indicator {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          background-color: #2563EB;
          border-radius: 20px;
          transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 1;
        }
        .tab-indicator.pending { transform: translateX(0); }
        .tab-indicator.settled { transform: translateX(100%); }
        
        #deduction-tab-content {
          transition: opacity 100ms ease, transform 150ms ease-out;
        }
      </style>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div class="deduction-tab-btn-wrapper">
          <div id="tab-bg-indicator" class="tab-indicator ${this.currentDeductionTab}"></div>
          <button id="btn-tab-pending" class="deduction-tab-btn ${isPendingTab ? 'active' : ''}" onclick="Expenses.switchDeductionTab('pending')">Pending Deductions</button>
          <button id="btn-tab-settled" class="deduction-tab-btn ${!isPendingTab ? 'active' : ''}" onclick="Expenses.switchDeductionTab('settled')">Settled History</button>
        </div>
        <div style="display:flex; gap:12px;">
          ${App.isViewer() ? '' : `
          <button style="display:flex; align-items:center; gap:6px; border:none; background:#FEF3C7; color:#D97706; padding:8px 18px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#FDE68A'" onmouseout="this.style.background='#FEF3C7'" onclick="Expenses.openAddManualDeductionModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Manual Deduction
          </button>
          `}
          <button style="display:flex; align-items:center; gap:6px; border:1.5px solid #16A34A; background:#FFFFFF; color:#16A34A; padding:8px 18px; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='#F0FDF4'" onmouseout="this.style.background='#FFFFFF'" onclick="Expenses.exportDeductionsExcel()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </button>
        </div>
      </div>
      <div id="deduction-tab-content">
        ${this.getDeductionsHtml(this.currentDeductionTab)}
      </div>
    `;
    
    // Only update area if we are re-rendering the whole tab
    // When switching tabs, we only update #deduction-tab-content
    if (area) {
      area.innerHTML = html;
    }
  },

  switchDeductionTab(tab) {
    if (this.currentDeductionTab === tab) return;
    
    this.currentDeductionTab = tab;
    
    // Update buttons
    const pendingBtn = document.getElementById('btn-tab-pending');
    const settledBtn = document.getElementById('btn-tab-settled');
    const indicator = document.getElementById('tab-bg-indicator');
    
    if (tab === 'pending') {
      pendingBtn.classList.add('active');
      settledBtn.classList.remove('active');
      indicator.className = 'tab-indicator pending';
    } else {
      pendingBtn.classList.remove('active');
      settledBtn.classList.add('active');
      indicator.className = 'tab-indicator settled';
    }
    
    // Animate content
    const contentArea = document.getElementById('deduction-tab-content');
    if (contentArea) {
      // Fade out old
      contentArea.style.opacity = '0';
      
      setTimeout(() => {
        // Update HTML
        contentArea.innerHTML = this.getDeductionsHtml(tab);
        
        // Prepare slide in position
        const startTranslate = tab === 'pending' ? '-20px' : '20px';
        contentArea.style.transition = 'none';
        contentArea.style.transform = `translateX(${startTranslate})`;
        
        // Trigger reflow
        void contentArea.offsetWidth;
        
        // Fade and slide in
        contentArea.style.transition = 'opacity 150ms ease-out, transform 150ms ease-out';
        contentArea.style.opacity = '1';
        contentArea.style.transform = 'translateX(0)';
      }, 100);
    }
  },

  getDeductionsHtml(tab) {
    const ridersWithPending = this.deductionsData.pending;
    const ridersWithSettled = this.deductionsData.settled;

    // Sort riders by their newest pending expense date (descending)
    ridersWithPending.sort((a, b) => {
      const aNewest = a.pending[0];
      const bNewest = b.pending[0];
      const aDate = aNewest ? (aNewest.expense_date || aNewest.created_at || '') : '';
      const bDate = bNewest ? (bNewest.expense_date || bNewest.created_at || '') : '';
      const cmp = bDate.localeCompare(aDate);
      if (cmp !== 0) return cmp;
      
      const aTime = aNewest ? (aNewest.created_at || '') : '';
      const bTime = bNewest ? (bNewest.created_at || '') : '';
      return bTime.localeCompare(aTime);
    });

    // Sort riders by their newest settled expense date (descending)
    ridersWithSettled.sort((a, b) => {
      const aNewest = a.settled[0];
      const bNewest = b.settled[0];
      const aDate = aNewest ? (aNewest.settled_at || aNewest.settledDate || aNewest.expense_date || '') : '';
      const bDate = bNewest ? (bNewest.settled_at || bNewest.settledDate || bNewest.expense_date || '') : '';
      return bDate.localeCompare(aDate);
    });
    
    let html = '';
    
    if (tab === 'pending') {
      if (ridersWithPending.length === 0) {
        html += `
          <div style="text-align:center; padding:64px 20px; background:#FFFFFF; border-radius:12px; border:1px solid #E5E7EB;">
            <div style="display:inline-flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background:#d1fae5; margin-bottom:16px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" style="width:32px;height:32px;"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style="font-size:20px; font-weight:bold; color:#111827;">All Settled</div>
            <div style="font-size:14px; color:#6b7280; margin-top:8px;">No pending deductions this cycle</div>
          </div>`;
      } else {
          html += '<div style="display:flex; flex-direction:column; gap:16px;">';
          for (const r of ridersWithPending) {
            const totalPending = r.pending.reduce((sum, exp) => sum + (exp.amount || 0), 0);
            let leftBorder = '#9ca3af';
            if (totalPending > 500) leftBorder = '#ef4444';
            else if (totalPending >= 100) leftBorder = '#f59e0b';
            
            const btnStyle = totalPending > 500 
              ? `background:#0F0F0F; color:#FFFFFF; border:2px solid #ef4444; border-radius:8px; font-size:13px; display:flex; align-items:center; gap:6px;`
              : `background:#0F0F0F; color:#FFFFFF; border-radius:8px; font-size:13px; display:flex; align-items:center; gap:6px;`;
            const warnIcon = totalPending > 500 
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="width:16px;height:16px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
              : '';

            html += `
              <div class="card" style="background:#FFFFFF; border:1px solid #E5E7EB; border-left:4px solid ${leftBorder}; border-radius:12px; overflow:hidden;">
                <div style="background:#F9FAFB; padding:16px 20px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; cursor:pointer;" onclick="const content = this.nextElementSibling; const isCollapsed = content.style.maxHeight === '0px'; content.style.maxHeight = isCollapsed ? '2000px' : '0px'; const icon = this.querySelector('.chevron-icon'); icon.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:#6b7280; transition:transform 200ms ease; transform:rotate(0deg);"><polyline points="9 18 15 12 9 6"/></svg>
                    <div>
                      <div style="font-size:16px; font-weight:bold; color:#0F0F0F;">${Utils.escapeHtml(r.rider_name)}</div>
                      <div style="font-size:14px; color:#D97706; font-weight:600; margin-top:4px;">Total Pending: SAR ${Utils.formatCurrency(totalPending).replace('﷼ ', '')}</div>
                    </div>
                  </div>
                  ${App.isViewer() ? '' : `
                  <button class="btn btn-primary" style="${btnStyle}" title="This will settle SAR ${totalPending} for ${Utils.escapeHtml(r.rider_name)}" onclick="event.stopPropagation(); Expenses.settleRiderDeductions(${r.rider_id}, '${Utils.escapeHtml(r.rider_name)}')">${warnIcon} Mark All Settled</button>
                  `}
                </div>
                <div style="max-height:0px; transition:max-height 200ms ease; overflow:hidden;">
                  <div style="width:100%; overflow-x:auto;">
                    <table class="table-clean" style="margin:0; min-width:600px;">
                      <thead>
                        <tr>
                          <th style="padding-left:20px;">Date</th>
                          <th>Category</th>
                          <th>Amount</th>
                          <th>Status</th>
                          ${App.isViewer() ? '' : '<th style="text-align:right; padding-right:20px;">Action</th>'}
                        </tr>
                      </thead>
                      <tbody>
            `;
            for (const exp of r.pending) {
              html += `
                <tr>
                  <td style="padding-left:20px; color:#4B5563; white-space:nowrap;">${Utils.formatDate(exp.expense_date)}</td>
                  <td><span style="background:#F3F4F6; color:#4B5563; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:500;">${Utils.escapeHtml(exp.category)}</span></td>
                  <td style="font-weight:600; color:#0F0F0F;">SAR ${Utils.formatCurrency(exp.amount).replace('﷼ ', '')}</td>
                  <td>
                    <span style="background:#fef3c7; color:#92400e; border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; display:inline-block;">PENDING</span>
                    ${exp.notes ? `<div style="font-size:11px; color:#6B7280; margin-top:2px;">${Utils.escapeHtml(exp.notes)}</div>` : ''}
                  </td>
                  ${App.isViewer() ? '' : `
                  <td style="text-align:right; padding-right:20px;">
                    <button class="btn btn-sm settle-btn" style="border:1px solid #16a34a; background:transparent; color:#16a34a; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; transition:all 150ms;" onmouseover="this.style.background='#16a34a'; this.style.color='#FFFFFF'" onmouseout="this.style.background='transparent'; this.style.color='#16a34a'" onclick="Expenses.settleSingleDeduction(${exp.id}, ${exp.amount}, '${Utils.escapeHtml(r.rider_name).replace(/'/g,"\\'").replace(/"/g,'&quot;')}')">Mark Settled</button>
                  </td>
                  `}
                </tr>
              `;
            }
            html += `</tbody></table></div></div></div>`;
          }
          html += '</div>';
        }
      } else {
        // Settled History
        if (ridersWithSettled.length === 0) {
          html += `
            <div style="text-align:center; padding:64px 20px; background:#FFFFFF; border-radius:12px; border:1px solid #E5E7EB;">
              <svg viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5" style="width:48px;height:48px; margin:0 auto 16px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div style="font-size:16px; font-weight:500; color:#0F0F0F;">No Settlement History</div>
              <div style="font-size:14px; color:#6B7280; margin-top:8px;">Settled deductions will appear here.</div>
            </div>`;
        } else {
          html += '<div style="display:flex; flex-direction:column; gap:16px;">';
          for (const r of ridersWithSettled) {
            html += `
              <div class="card" style="background:#FFFFFF; border:1px solid #E5E7EB; border-left:4px solid #9ca3af; border-radius:12px; overflow:hidden;">
                <div style="background:#F9FAFB; padding:16px 20px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="const content = this.nextElementSibling; const isCollapsed = content.style.maxHeight === '0px'; content.style.maxHeight = isCollapsed ? '2000px' : '0px'; const icon = this.querySelector('.chevron-icon'); icon.style.transform = isCollapsed ? 'rotate(90deg)' : 'rotate(0deg)';">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; height:20px; color:#6b7280; transition:transform 200ms ease; transform:rotate(0deg);"><polyline points="9 18 15 12 9 6"/></svg>
                    <div>
                      <div style="font-size:16px; font-weight:bold; color:#0F0F0F;">${Utils.escapeHtml(r.rider_name)}</div>
                      <div style="font-size:14px; color:#16A34A; font-weight:600; margin-top:4px;">${r.settled.length} Settled Items</div>
                    </div>
                  </div>
                </div>
                <div style="max-height:0px; transition:max-height 200ms ease; overflow:hidden;">
                  <div style="width:100%; overflow-x:auto;">
                    <table class="table-clean" style="margin:0; min-width:500px;">
                      <thead>
                        <tr>
                          <th style="padding-left:20px;">Date</th>
                          <th>Category</th>
                          <th>Amount</th>
                          <th style="padding-right:20px;">Settlement Details</th>
                        </tr>
                      </thead>
                      <tbody>
            `;
            // Sort settled by settledDate desc
            const sortedSettled = [...r.settled].sort((a,b) => (b.settledDate || '').localeCompare(a.settledDate || ''));
            for (const exp of sortedSettled) {
              const settleDateStr = exp.settledDate ? Utils.formatDate(exp.settledDate.split('T')[0]) : 'Unknown';
              html += `
                <tr>
                  <td style="padding-left:20px; color:#4B5563; white-space:nowrap;">${Utils.formatDate(exp.expense_date)}</td>
                  <td><span style="background:#F3F4F6; color:#4B5563; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:500;">${Utils.escapeHtml(exp.category)}</span></td>
                  <td style="font-weight:600; color:#0F0F0F;">SAR ${Utils.formatCurrency(exp.amount).replace('﷼ ', '')}</td>
                  <td style="padding-right:20px;">
                    <span style="background:#d1fae5; color:#065f46; border-radius:9999px; padding:2px 10px; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> SETTLED</span>
                    <div style="font-size:11px; color:#6B7280; margin-top:4px;">On ${settleDateStr} by ${Utils.escapeHtml(exp.settledBy || 'Unknown')}</div>
                  </td>
                </tr>
              `;
            }
            html += `</tbody></table></div></div></div>`;
          }
          html += '</div>';
        }
      }

    return html;
  },

  openAddManualDeductionModal() {
    if (App.isViewer()) return;
    let riderOptions = '<option value="" disabled selected>-- Select Rider --</option>';
    this.riders.forEach(r => {
      riderOptions += `<option value="${r.id}">${r.name}</option>`;
    });

    const html = `
      <form id="manual-deduction-form" style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
        <div>
          <label class="expense-form-label">Rider</label>
          <select class="expense-form-input" name="rider_id" required>
            ${riderOptions}
          </select>
        </div>
        <div>
          <label class="expense-form-label">Amount (SAR)</label>
          <input type="number" step="0.01" min="0.01" class="expense-form-input" name="amount" required placeholder="0.00">
        </div>
        <div>
          <label class="expense-form-label">Date Added</label>
          <input type="date" class="expense-form-input" name="expense_date" required value="${Utils.today()}">
        </div>
        <div>
          <label class="expense-form-label">Description / Reason</label>
          <input type="text" class="expense-form-input" name="notes" required placeholder="e.g. Previous month carryover, Fine, etc.">
        </div>
        <div style="background:#FFFBEB; border:1px solid #FEF3C7; color:#B45309; padding:12px; border-radius:8px; font-size:13px; line-height:1.4;">
          <strong>Note:</strong> This will add a deduction to the rider's pending balance but will <strong>not</strong> be counted as a company operational expense.
        </div>
        <div class="form-actions" style="margin-top:10px; display:flex; justify-content:flex-end; gap:12px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="manual-deduction-submit-btn">Add Deduction</button>
        </div>
      </form>
    `;

    Utils.openModal('Add Manual Deduction', html);

    document.getElementById('manual-deduction-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = document.getElementById('manual-deduction-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Saving...';

      const data = {
        expense_date: fd.get('expense_date'),
        category: 'Manual Deduction',
        amount: parseFloat(fd.get('amount')) || 0,
        is_deductible: true,
        notes: fd.get('notes'),
        rider_id: parseInt(fd.get('rider_id')),
        vendor_name: 'Manual Entry',
        receipt_base64: null
      };

      try {
        await API.createExpense(data);
        Utils.closeModal();
        Utils.showToast('Manual deduction added', 'success');
        this.deductionsData = null; // Clear cache to refetch instantly
        this.render();
      } catch (err) {
        Utils.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Add Deduction';
      }
    });
  },

  async exportDeductionsExcel() {
    Utils.showLoading('Exporting Deductions', 'Building Excel file...');
    try {
      const expenses = await API.getExpenses();
      const funds = await API.getFunds();
      
      const formatReadableDate = (dStr) => dStr ? new Date(dStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
      
      const sortedExpenses = [...expenses].sort((a, b) => new Date(a.expense_date || a.created_at) - new Date(b.expense_date || b.created_at));
      const sortedFunds = [...funds].sort((a, b) => new Date(a.receive_date || a.created_at) - new Date(b.receive_date || b.created_at));
      let currentCompanyBalance = 0;
      let fundIndex = 0;
      const paidByMap = {};
      
      for (const e of sortedExpenses) {
        const eDate = new Date(e.expense_date || e.created_at);
        while (fundIndex < sortedFunds.length) {
          const fDate = new Date(sortedFunds[fundIndex].receive_date || sortedFunds[fundIndex].created_at);
          if (fDate <= eDate) {
            currentCompanyBalance += parseFloat(sortedFunds[fundIndex].amount) || 0;
            fundIndex++;
          } else {
            break;
          }
        }
        const amt = parseFloat(e.amount) || 0;
        if (currentCompanyBalance >= amt) {
          paidByMap[e.id] = 'Company';
          currentCompanyBalance -= amt;
        } else {
          paidByMap[e.id] = 'Out of Pocket';
          currentCompanyBalance -= amt;
        }
      }

      const riderExpenses = expenses.filter(e => {
        const isMedical = (e.category || '').toLowerCase().includes('medical');
        return !isMedical && (e.is_deductible === 1 || e.is_deductible === true) && e.rider_id;
      });

      const getCycleString = (dateStr) => {
        if (!dateStr) return '-';
        const cycle = Utils.getNoonCyclePeriod(dateStr.split('T')[0]);
        const s = new Date(cycle.start + 'T12:00:00Z');
        const e = new Date(cycle.end + 'T12:00:00Z');
        return `${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} \u2013 ${e.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`;
      };

      const activeCycle = Utils.getNoonCyclePeriod(Utils.getActiveDate());
      const activeStart = new Date(activeCycle.start + 'T12:00:00Z');
      const activeEnd = new Date(activeCycle.end + 'T23:59:59');

      const riderMap = {};
      
      for (const e of riderExpenses) {
        const rName = e.rider_name || `Rider #${e.rider_id}`;
        if (!riderMap[rName]) riderMap[rName] = { pending: [], settled: [] };
        if (e.deductionSettled) {
          const sDate = new Date(e.settledDate || e.expense_date || e.created_at);
          if (sDate >= activeStart && sDate <= activeEnd) {
             riderMap[rName].settled.push(e);
          }
        } else {
          riderMap[rName].pending.push(e);
        }
      }

      const cycleLabel = `Cycle: ${activeStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})} \u2013 ${new Date(activeCycle.end + 'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
      const allOutstandingLabel = `All Outstanding Deductions \u2014 As of ${new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
      const monthYear = activeStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Inspiring Roads Logistics';

      const DN = 'FF1A2744', BL = 'FF2563EB', LB = 'FFDBEAFE', SB = 'FFEFF6FF', AR = 'FFF8F9FA';
      const PBG = 'FFFEF3C7', PTX = 'FF92400E', SBG = 'FFD1FAE5', STX = 'FF065F46';
      const RD = 'FFDC2626', BT = 'FF2563EB', GT = 'FF16A34A', WH = 'FFFFFFFF';
      const bdr = {top:{style:'thin',color:{argb:'FFE5E7EB'}},bottom:{style:'thin',color:{argb:'FFE5E7EB'}},left:{style:'thin',color:{argb:'FFE5E7EB'}},right:{style:'thin',color:{argb:'FFE5E7EB'}}};

      const addHeader = (ws, cc, subtitle) => {
        ws.mergeCells(1,1,1,cc);
        const c1 = ws.getRow(1).getCell(1);
        ws.getRow(1).height = 32;
        c1.value = 'INSPIRING ROADS LOGISTICS \u2014 RIDER DEDUCTIONS REPORT';
        c1.font = {name:'Calibri',size:14,bold:true,color:{argb:WH}};
        c1.fill = {type:'pattern',pattern:'solid',fgColor:{argb:DN}};
        c1.alignment = {horizontal:'center',vertical:'middle'};
        ws.mergeCells(2,1,2,cc);
        const c2 = ws.getRow(2).getCell(1);
        ws.getRow(2).height = 22;
        c2.value = subtitle;
        c2.font = {name:'Calibri',size:11,italic:true,color:{argb:'FF1E3A5F'}};
        c2.fill = {type:'pattern',pattern:'solid',fgColor:{argb:LB}};
        c2.alignment = {horizontal:'center',vertical:'middle'};
        ws.getRow(3).height = 8;
      };

      const setHdr = (ws, hds, rn) => {
        const row = ws.getRow(rn); row.height = 24;
        hds.forEach((h,i) => {
          const c = row.getCell(i+1);
          c.value = h;
          c.font = {name:'Calibri',size:11,bold:true,color:{argb:WH}};
          c.fill = {type:'pattern',pattern:'solid',fgColor:{argb:BL}};
          c.alignment = {horizontal:'center',vertical:'middle'};
          c.border = bdr;
        });
      };

      const riders = Object.keys(riderMap).sort();

      // ── SHEET 1: Pending ──
      const ws1 = wb.addWorksheet('Pending Deductions');
      const h1 = ['RIDER NAME','CATEGORY','DATE','CYCLE','AMOUNT (SAR)','PAID BY','STATUS','NOTES'];
      ws1.columns = [{width:28},{width:20},{width:18},{width:22},{width:18},{width:16},{width:15},{width:30}];
      addHeader(ws1, h1.length, allOutstandingLabel); setHdr(ws1, h1, 4);

      let r1 = 5, gp = 0, ri = 0;
      for (const rn of riders) {
        const items = riderMap[rn].pending;
        if (!items.length) continue;
        
        items.sort((a, b) => new Date(a.expense_date || a.created_at) - new Date(b.expense_date || b.created_at));
        
        let rt = 0, first = true;
        for (const e of items) {
          const a = parseFloat(e.amount)||0; rt += a;
          const row = ws1.getRow(r1); const alt = ri%2===1;
          row.getCell(1).value = first ? rn : '';
          row.getCell(1).font = first ? {name:'Calibri',size:11,bold:true,color:{argb:'FF0F172A'}} : {name:'Calibri',size:11};
          row.getCell(2).value = e.category||'-'; row.getCell(2).font = {name:'Calibri',size:11};
          row.getCell(3).value = formatReadableDate(e.expense_date); row.getCell(3).font = {name:'Calibri',size:11};
          row.getCell(4).value = getCycleString(e.expense_date || e.created_at); row.getCell(4).font = {name:'Calibri',size:11};
          row.getCell(5).value = a; row.getCell(5).numFmt='#,##0.00'; row.getCell(5).alignment={horizontal:'right'};
          row.getCell(5).font = a>500 ? {name:'Calibri',size:11,bold:true,color:{argb:RD}} : {name:'Calibri',size:11};
          row.getCell(6).value = paidByMap[e.id] || 'Company'; row.getCell(6).font = {name:'Calibri',size:11};
          row.getCell(7).value = 'PENDING';
          row.getCell(7).font = {name:'Calibri',size:11,bold:true,color:{argb:PTX}};
          row.getCell(7).fill = {type:'pattern',pattern:'solid',fgColor:{argb:PBG}};
          row.getCell(7).alignment = {horizontal:'center'};
          row.getCell(8).value = e.notes || e.description || ''; row.getCell(8).font = {name:'Calibri',size:10};
          if (alt) [1,2,3,4,5,6,7,8].forEach(c=>{row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:AR}};});
          for (let c=1;c<=8;c++) row.getCell(c).border = bdr;
          r1++; ri++; first = false;
        }
        // rider group bottom border
        const lb = ws1.getRow(r1-1);
        for (let c=1;c<=8;c++) lb.getCell(c).border = {...bdr, bottom:{style:'medium',color:{argb:'FFD1D5DB'}}};
        // subtotal
        const sr = ws1.getRow(r1);
        ws1.mergeCells(r1,1,r1,4);
        sr.getCell(1).value = `Total for ${rn}`; sr.getCell(1).font = {name:'Calibri',size:11,bold:true}; sr.getCell(1).alignment = {horizontal:'right'};
        sr.getCell(5).value = rt; sr.getCell(5).numFmt='#,##0.00'; sr.getCell(5).alignment={horizontal:'right'};
        sr.getCell(5).font = {name:'Calibri',size:11,bold:true,color:{argb:BT}};
        for (let c=1;c<=8;c++){sr.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:SB}};sr.getCell(c).border=bdr;}
        gp += rt; r1++; ri = 0;
      }
      if (gp > 0) {
        const gr = ws1.getRow(r1); ws1.mergeCells(r1,1,r1,4);
        gr.getCell(1).value = 'TOTAL PENDING DEDUCTIONS';
        gr.getCell(5).value = gp; gr.getCell(5).numFmt='#,##0.00'; gr.getCell(5).alignment={horizontal:'right'};
        for (let c=1;c<=8;c++){gr.getCell(c).font={name:'Calibri',size:12,bold:true,color:{argb:WH}};gr.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:DN}};gr.getCell(c).border=bdr;}
      }
      ws1.views = [{state:'frozen',ySplit:4}];
      ws1.autoFilter = {from:{row:4,column:1},to:{row:4,column:h1.length}};

      // ── SHEET 2: Settled ──
      const ws2 = wb.addWorksheet('Settled History');
      const h2 = ['RIDER NAME','CATEGORY','DATE','AMOUNT (SAR)','PAID BY','STATUS','NOTES','SETTLED ON','SETTLED BY'];
      ws2.columns = [{width:28},{width:20},{width:18},{width:18},{width:16},{width:15},{width:28},{width:16},{width:18}];
      addHeader(ws2, h2.length, cycleLabel); setHdr(ws2, h2, 4);

      let r2 = 5, gs = 0; ri = 0;
      for (const rn of riders) {
        const items = riderMap[rn].settled;
        if (!items.length) continue;
        let rt = 0, first = true;
        for (const e of items) {
          const a = parseFloat(e.amount)||0; rt += a;
          const row = ws2.getRow(r2); const alt = ri%2===1;
          row.getCell(1).value = first ? rn : '';
          row.getCell(1).font = first ? {name:'Calibri',size:11,bold:true,color:{argb:'FF0F172A'}} : {name:'Calibri',size:11};
          row.getCell(2).value = e.category||'-'; row.getCell(2).font = {name:'Calibri',size:11};
          row.getCell(3).value = formatReadableDate(e.expense_date); row.getCell(3).font = {name:'Calibri',size:11};
          row.getCell(4).value = a; row.getCell(4).numFmt='#,##0.00'; row.getCell(4).alignment={horizontal:'right'};
          row.getCell(4).font = a>500 ? {name:'Calibri',size:11,bold:true,color:{argb:RD}} : {name:'Calibri',size:11};
          row.getCell(5).value = paidByMap[e.id] || 'Company'; row.getCell(5).font = {name:'Calibri',size:11};
          row.getCell(6).value = 'SETTLED';
          row.getCell(6).font = {name:'Calibri',size:11,bold:true,color:{argb:STX}};
          row.getCell(6).fill = {type:'pattern',pattern:'solid',fgColor:{argb:SBG}};
          row.getCell(6).alignment = {horizontal:'center'};
          row.getCell(7).value = e.notes || e.description || ''; row.getCell(7).font = {name:'Calibri',size:10};
          row.getCell(8).value = formatReadableDate(e.settledDate ? e.settledDate.split('T')[0] : null); row.getCell(8).font = {name:'Calibri',size:11};
          row.getCell(9).value = e.settledBy||'-'; row.getCell(9).font = {name:'Calibri',size:11};
          if (alt) [1,2,3,4,5,6,7,8,9].forEach(c=>{row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:AR}};});
          for (let c=1;c<=9;c++) row.getCell(c).border = bdr;
          r2++; ri++; first = false;
        }
        const lb = ws2.getRow(r2-1);
        for (let c=1;c<=9;c++) lb.getCell(c).border = {...bdr, bottom:{style:'medium',color:{argb:'FFD1D5DB'}}};
        const sr = ws2.getRow(r2);
        ws2.mergeCells(r2,1,r2,3);
        sr.getCell(1).value = `Total for ${rn}`; sr.getCell(1).font = {name:'Calibri',size:11,bold:true}; sr.getCell(1).alignment = {horizontal:'right'};
        sr.getCell(4).value = rt; sr.getCell(4).numFmt='#,##0.00'; sr.getCell(4).alignment={horizontal:'right'};
        sr.getCell(4).font = {name:'Calibri',size:11,bold:true,color:{argb:BT}};
        for (let c=1;c<=9;c++){sr.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:SB}};sr.getCell(c).border=bdr;}
        gs += rt; r2++; ri = 0;
      }
      if (gs > 0) {
        const gr = ws2.getRow(r2); ws2.mergeCells(r2,1,r2,3);
        gr.getCell(1).value = 'TOTAL SETTLED DEDUCTIONS';
        gr.getCell(4).value = gs; gr.getCell(4).numFmt='#,##0.00'; gr.getCell(4).alignment={horizontal:'right'};
        for (let c=1;c<=9;c++){gr.getCell(c).font={name:'Calibri',size:12,bold:true,color:{argb:WH}};gr.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:DN}};gr.getCell(c).border=bdr;}
      }
      ws2.views = [{state:'frozen',ySplit:4}];
      ws2.autoFilter = {from:{row:4,column:1},to:{row:4,column:h2.length}};

      // ── SHEET 3: Summary ──
      const ws3 = wb.addWorksheet('Summary');
      const h3 = ['RIDER NAME','OLDEST PENDING DATE','TOTAL PENDING','TOTAL SETTLED','NET OUTSTANDING'];
      ws3.columns = [{width:28},{width:22},{width:20},{width:20},{width:22}];
      addHeader(ws3, h3.length, allOutstandingLabel); setHdr(ws3, h3, 4);

      let r3 = 5, sp = 0, ss = 0;
      const today = new Date();
      for (const rn of riders) {
        const pendingItems = riderMap[rn].pending;
        const pt = pendingItems.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        const st = riderMap[rn].settled.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        if (pt===0 && st===0) continue;
        
        let oldestDateStr = '-';
        let isFlagged = false;
        if (pendingItems.length > 0) {
          const oldestItem = pendingItems.reduce((oldest, current) => {
            return new Date(current.expense_date || current.created_at) < new Date(oldest.expense_date || oldest.created_at) ? current : oldest;
          });
          const oldestDate = new Date(oldestItem.expense_date || oldestItem.created_at);
          oldestDateStr = formatReadableDate(oldestItem.expense_date || oldestItem.created_at);
          
          const diffDays = Math.floor((today - oldestDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) isFlagged = true;
        }

        const net = pt;
        const row = ws3.getRow(r3); const alt = (r3-5)%2===1;
        row.getCell(1).value = rn; row.getCell(1).font = {name:'Calibri',size:11,bold:true};
        row.getCell(2).value = oldestDateStr; row.getCell(2).font = {name:'Calibri',size:11};
        row.getCell(3).value = pt; row.getCell(3).numFmt='#,##0.00'; row.getCell(3).font={name:'Calibri',size:11}; row.getCell(3).alignment={horizontal:'right'};
        row.getCell(4).value = st; row.getCell(4).numFmt='#,##0.00'; row.getCell(4).font={name:'Calibri',size:11}; row.getCell(4).alignment={horizontal:'right'};
        row.getCell(5).value = net; row.getCell(5).numFmt='#,##0.00'; row.getCell(5).alignment={horizontal:'right'};
        row.getCell(5).font = net>0 ? {name:'Calibri',size:11,bold:true,color:{argb:RD}} : {name:'Calibri',size:11,bold:true,color:{argb:GT}};
        
        if (isFlagged) {
           for (let c=1;c<=5;c++) row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFEE2E2'}}; // light red
        } else if (alt) {
           for (let c=1;c<=5;c++) row.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:AR}};
        }
        for (let c=1;c<=5;c++) row.getCell(c).border = bdr;
        sp += pt; ss += st; r3++;
      }
      const g3 = ws3.getRow(r3);
      g3.getCell(1).value = 'GRAND TOTALS';
      g3.getCell(2).value = sp; g3.getCell(2).numFmt='#,##0.00'; g3.getCell(2).alignment={horizontal:'right'};
      g3.getCell(3).value = ss; g3.getCell(3).numFmt='#,##0.00'; g3.getCell(3).alignment={horizontal:'right'};
      g3.getCell(4).value = sp; g3.getCell(4).numFmt='#,##0.00'; g3.getCell(4).alignment={horizontal:'right'};
      for (let c=1;c<=4;c++){g3.getCell(c).font={name:'Calibri',size:12,bold:true,color:{argb:WH}};g3.getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:DN}};g3.getCell(c).border=bdr;}
      ws3.views = [{state:'frozen',ySplit:4}];
      ws3.autoFilter = {from:{row:4,column:1},to:{row:4,column:h3.length}};

      // ── Download ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      saveAs(blob, `IRL_Rider_Deductions_${monthYear.replace(' ','_')}.xlsx`);
      Utils.hideLoading();
      Utils.showToast('Deductions Excel exported successfully!', 'success');
    } catch (err) {
      console.error('Excel Export Error:', err);
      Utils.hideLoading();
      Utils.showToast('Failed to export: ' + err.message, 'error');
    }
  },

  settleRiderDeductions(riderId, riderName) {
    if (App.isViewer()) return;
    const html = `
      <div style="padding:8px 0;">
        <p style="margin-bottom:20px; font-size:15px; color:#4B5563; line-height:1.5;">Are you sure you want to settle ALL pending deductions for <b>${Utils.escapeHtml(riderName)}</b>?</p>
        <div class="form-group">
          <label class="form-label">Settled By</label>
          <select id="settle-by-select" class="form-input">
            <option value="Me">Me (Current User)</option>
            <option value="Sponsor Saad">Sponsor Saad</option>
            <option value="Sponsor Firas">Sponsor Firas</option>
          </select>
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:32px;">
          <button class="btn btn-outline" style="border-radius:8px;" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" style="background:#16A34A; border-color:#16A34A; border-radius:8px;" onclick="Expenses.confirmSettleRider(${riderId})">Confirm Settlement</button>
        </div>
      </div>
    `;
    Utils.openModal('Settle All Deductions', html);
  },

  async confirmSettleRider(riderId) {
    if (App.isViewer()) return;
    const settledBy = document.getElementById('settle-by-select').value;
    Utils.closeModal();
    try {
      Utils.showToast('Settling deductions...', 'info');
      await API.settleRiderDeductions(riderId, settledBy);
      Utils.showToast('All deductions settled successfully.', 'success');
      this.deductionsData = null; // Clear cache
      this.renderTabContent();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  settleSingleDeduction(expenseId, amount, riderName) {
    if (App.isViewer()) return;
    const html = `
      <div style="padding:8px 0;">
        <p style="margin-bottom:20px; font-size:15px; color:#4B5563; line-height:1.5;">Confirm settlement of <b>SAR ${amount}</b> for <b>${Utils.escapeHtml(riderName)}</b>?</p>
        <div class="form-group">
          <label class="form-label">Settled By</label>
          <select id="settle-single-by-select" class="form-input">
            <option value="Me">Me (Current User)</option>
            <option value="Sponsor Saad">Sponsor Saad</option>
            <option value="Sponsor Firas">Sponsor Firas</option>
          </select>
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:32px;">
          <button class="btn btn-outline" style="border-radius:8px;" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" style="background:#16A34A; border-color:#16A34A; border-radius:8px;" onclick="Expenses.confirmSettleSingle(${expenseId})">Confirm Settlement</button>
        </div>
      </div>
    `;
    Utils.openModal('Confirm Settlement', html);
  },

  async confirmSettleSingle(expenseId) {
    if (App.isViewer()) return;
    const settledBy = document.getElementById('settle-single-by-select').value;
    Utils.closeModal();
    try {
      Utils.showToast('Settling deduction...', 'info');
      await API.settleExpenseDeduction(expenseId, settledBy);
      Utils.showToast('Deduction settled successfully.', 'success');
      this.renderTabContent();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  openAddFundsModal() {
    if (App.isViewer()) return;
    const today = new Date().toISOString().split('T')[0];
    const html = `
      <form id="funds-form" class="form-grid">
        <div class="form-group">
          <label class="form-label">Receive Date</label>
          <input type="date" class="form-input" name="receive_date" required value="${today}" max="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (SAR)</label>
          <input type="number" step="0.01" min="0" class="form-input" name="amount" required placeholder="1000.00">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Description (Source)</label>
          <input type="text" class="form-input" name="description" required placeholder="IRL — Transfer" value="IRL — Transfer">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Notes</label>
          <input type="text" class="form-input" name="notes" placeholder="Optional notes...">
        </div>
        <div class="form-group" style="grid-column: 1 / -1; background:var(--slate-50); padding:16px; border-radius:8px; border:1px dashed var(--slate-300);">
          <label class="form-label">Attach Receipt Photos / PDFs (Optional)</label>
          <div id="fund-receipt-preview-area" style="display:none; margin-bottom:12px;"></div>
          <input type="file" id="fund-receipt-upload" multiple class="form-input" style="padding:4px; font-size:13px">
          <small class="form-hint" style="margin-top:8px; display:block">Images will be compressed. PDFs supported.</small>
          <input type="hidden" id="fund-receipt-base64-hidden">
        </div>
        <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Funds</button>
        </div>
      </form>
    `;

    Utils.openModal('Log IRL Funds', html);

    this.initMultiUpload('fund-receipt-upload', 'fund-receipt-base64-hidden', 'fund-receipt-preview-area', 'funds-form');

    document.getElementById('funds-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading...';

      const data = {
        receive_date: fd.get('receive_date'),
        amount: parseFloat(fd.get('amount')) || 0,
        description: fd.get('description'),
        notes: fd.get('notes'),
        receipt_base64: document.getElementById('fund-receipt-base64-hidden').value || null
      };

      try {
        this.showProcessingOverlay('Company Fund', data.amount, true);
        await API.createFund(data);
        Utils.closeModal();
        this.finishProcessingOverlay();
        setTimeout(() => this.render(), 1200);
      } catch (err) {
        this.hideProcessingOverlayError();
        Utils.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save Funds';
      }
    });
  },

  openAddExpenseModal() {
    if (App.isViewer()) return;
    const today = new Date().toISOString().split('T')[0];
    
    // Categories matching user spec
    const categories = ['Advance', 'Food', 'Cash Relay', 'Internet Package', 'Transport', 'Equipment', 'Maintenance', 'Uniform', 'Other', 'Health / Medical'];
    
    let riderOptions = '<option value="">-- General / Vendor --</option>';
    this.riders.forEach(r => {
      riderOptions += `<option value="${r.id}">${r.name} (${r.client_company || 'Active'})</option>`;
    });

    const pillsHtml = categories.map(c => `
      <div class="expense-cat-pill" data-cat="${c}" onclick="document.getElementById('expense-cat').value='${c}'; document.querySelectorAll('.expense-cat-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); document.getElementById('expense-cat').dispatchEvent(new Event('change'));">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        ${c}
      </div>
    `).join('');

    const html = `
      <form id="expense-form" style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
        
        <!-- Hidden actual select to maintain form logic -->
        <select name="category" id="expense-cat" required style="display:none;">
          <option value="">Select Category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        
        <div>
          <label class="expense-form-label" style="margin-bottom:8px;">Category</label>
          <div class="expense-cat-pills">
            ${pillsHtml}
          </div>
        </div>

        <div>
          <label class="expense-form-label">Deductibility</label>
          <select class="expense-form-input" name="deduct_type" id="expense-deductible">
            <option value="company">Company Paid</option>
            <option value="deductible">Rider Deductible (rider will repay)</option>
            <option value="supervisor">Supervisor Deductible (supervisor will repay)</option>
          </select>
          <div id="medical-hint" style="color:#2563EB; font-size:12px; font-weight:500; margin-top:6px; display:none;">Medical expenses are always covered by the company</div>
        </div>

        <div style="display:flex; gap:16px;">
          <div style="flex:1;">
            <label class="expense-form-label">Date</label>
            <input type="date" class="expense-form-input" name="expense_date" required value="${today}" max="${today}">
          </div>
          <div style="flex:1;">
            <label class="expense-form-label">Amount (SAR)</label>
            <input type="number" step="0.01" min="0" class="expense-form-input" name="amount" id="expense-amount" required placeholder="0.00" oninput="document.getElementById('expense-footer-total').innerText = 'Logging: SAR ' + (parseFloat(this.value)||0).toFixed(2) + ' · April 2026 cycle'; document.getElementById('expense-submit-btn').disabled = !(parseFloat(this.value)>0 && document.getElementById('expense-cat').value);">
          </div>
        </div>
        
        <div>
          <label class="expense-form-label">Linked Rider</label>
          <select class="expense-form-input" name="rider_id" id="expense-rider">
            ${riderOptions}
          </select>
        </div>
        
        <div id="vendor-group" style="display:none; transition: all 150ms;">
          <label class="expense-form-label">Vendor or Item Name</label>
          <input type="text" class="expense-form-input" name="vendor_name" id="vendor-input" placeholder="e.g. AC Installer, Petrol, Spare Part">
        </div>
        
        <div>
          <label class="expense-form-label">Notes</label>
          <textarea class="expense-form-input" name="notes" placeholder="Optional notes..."></textarea>
        </div>
        
        <div>
          <div class="expense-upload-zone" onclick="document.getElementById('receipt-upload').click()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="upload-text" style="font-size:13px; font-weight:500;">Attach receipt or PDF</span>
          </div>
          <div id="receipt-preview-area" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
          <input type="file" id="receipt-upload" multiple accept="image/*,.pdf" style="display:none;">
          <div style="font-size:11px; color:#9CA3AF; margin-top:6px;">Images compressed automatically · PDFs supported</div>
          <input type="hidden" id="receipt-base64-hidden">
        </div>
        
        <div class="expense-footer">
          <div id="expense-footer-total" style="font-size:12px; color:#6B7280;">Logging: SAR 0.00 · April 2026 cycle</div>
          <div style="display:flex; gap:12px;">
            <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
            <button type="submit" id="expense-submit-btn" disabled style="width:140px; height:42px; border-radius:10px; border:none; background:#2563EB; color:white; font-weight:600; cursor:pointer; opacity:0.5; transition:opacity 150ms;">Save Expense</button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#0F0F0F;">Add Expense</div><div style="font-size:13px;color:#6B7280;font-weight:normal;margin-top:2px;">Log a company or personal expense</div>', html, 'modal-expense');

    const catSelect = document.getElementById('expense-cat');
    const deductHint = document.getElementById('deductible-hint');
    const riderSelect = document.getElementById('expense-rider');
    const vendorGroup = document.getElementById('vendor-group');
    const vendorInput = document.getElementById('vendor-input');
    const submitBtn = document.getElementById('expense-submit-btn');
    const amountInput = document.getElementById('expense-amount');

    const checkSubmitBtn = () => {
       const amt = parseFloat(amountInput.value) || 0;
       if (amt > 0 && catSelect.value) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
       } else {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
       }
    };

    const updateVisibility = () => {
      const cat = catSelect.value;
      const deductibleSelect = document.getElementById('expense-deductible');
      const medHint = document.getElementById('medical-hint');
      
      if (cat === 'Health / Medical') {
         deductibleSelect.value = 'company';
         deductibleSelect.disabled = true;
         medHint.style.display = 'block';
      } else {
         deductibleSelect.disabled = false;
         medHint.style.display = 'none';
         if (['Advance', 'Food', 'Cash Relay'].includes(cat)) {
            if (riderSelect.value) {
               deductibleSelect.value = 'deductible';
            } else {
               deductibleSelect.value = 'supervisor';
            }
         } else if (deductibleSelect.value === 'false' || deductibleSelect.value === 'true') {
            deductibleSelect.value = 'company';
         }
      }
      
      if (cat === 'Other' || riderSelect.value === '') {
        vendorGroup.style.display = 'block';
        vendorInput.required = true;
      } else {
        vendorGroup.style.display = 'none';
        vendorInput.required = false;
      }
      
      checkSubmitBtn();
    };

    catSelect.addEventListener('change', updateVisibility);
    riderSelect.addEventListener('change', updateVisibility);
    amountInput.addEventListener('input', checkSubmitBtn);
    updateVisibility();

    this.initMultiUpload('receipt-upload', 'receipt-base64-hidden', 'receipt-preview-area', 'expense-form');

    document.getElementById('expense-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Saving...</span>';
      submitBtn.style.opacity = '0.7';

      const category = fd.get('category');
      const deductType = document.getElementById('expense-deductible').value;
      const isDeductible = deductType !== 'company';
      
      const data = {
        expense_date: fd.get('expense_date'),
        category: category,
        amount: parseFloat(fd.get('amount')) || 0,
        is_deductible: isDeductible,
        notes: fd.get('notes'),
        receipt_base64: document.getElementById('receipt-base64-hidden').value || null
      };
      
      if (fd.get('rider_id')) {
        data.rider_id = parseInt(fd.get('rider_id'));
      }
      if (fd.get('vendor_name')) {
        data.vendor_name = fd.get('vendor_name');
      }

      try {
        this.showProcessingOverlay(category, data.amount, false);
        await API.createExpense(data);
        Utils.closeModal();
        this.finishProcessingOverlay();
        Utils.showToast('Expense saved successfully', 'success');
        this.deductionsData = null; // Clear cache
        setTimeout(() => this.render(), 1200);
      } catch (err) {
        this.hideProcessingOverlayError();
        Utils.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save Expense';
        submitBtn.style.opacity = '1';
      }
    });
  },

  async deleteExpense(id) {
    if (App.isViewer()) return;
    const confirmed = await Utils.confirm('Are you sure you want to delete this expense? This affects totals and payroll.', 'Delete Expense', 'Delete', 'Cancel', true);
    if (!confirmed) return;
    try {
      await API.deleteExpense(id);
      this.deductionsData = null;
      this.render();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    }
  },
  
  async deleteFund(id) {
    if (App.isViewer()) return;
    const confirmed = await Utils.confirm('Are you sure you want to delete this company fund entry?', 'Delete Fund', 'Delete', 'Cancel', true);
    if (!confirmed) return;
    try {
      await API.deleteFund(id);
      this.render();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async openEditFundModal(id) {
    if (App.isViewer()) return;
    Utils.showLoading('Loading', 'Preparing form');
    try {
      const funds = await API.getFunds();
      const fund = funds.find(f => f.id === id);
      if (!fund) throw new Error('Fund record not found');

      const html = `
        <form id="edit-funds-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Receive Date</label>
            <input type="date" class="form-input" name="receive_date" required value="${fund.receive_date}" max="${Utils.today()}">
          </div>
          <div class="form-group">
            <label class="form-label">Amount (﷼)</label>
            <input type="number" step="0.01" min="0" class="form-input" name="amount" required value="${fund.amount}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Description (Source)</label>
            <input type="text" class="form-input" name="description" required value="${Utils.escapeHtml(fund.description)}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Notes</label>
            <input type="text" class="form-input" name="notes" value="${Utils.escapeHtml(fund.notes || '')}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1; background:var(--slate-50); padding:16px; border-radius:8px; border:1px dashed var(--slate-300);">
            <label class="form-label">Update Receipt Photos / PDFs (Optional)</label>
            <div id="edit-fund-receipt-preview-area" style="display:none; margin-bottom:12px;"></div>
            <input type="file" id="edit-fund-receipt-upload" multiple class="form-input" style="padding:4px; font-size:13px">
            <small class="form-hint" style="margin-top:8px; display:block">New uploads will add to the existing receipts. Remove manually if replacing.</small>
            <input type="hidden" id="edit-fund-receipt-base64-hidden" value="">
          </div>
          <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Funds</button>
          </div>
        </form>
      `;

      Utils.hideLoading();
      Utils.openModal('Edit Logged Funds', html);

      if (fund.receipt_base64) {
        document.getElementById('edit-fund-receipt-base64-hidden').value = fund.receipt_base64;
      }

      this.initMultiUpload('edit-fund-receipt-upload', 'edit-fund-receipt-base64-hidden', 'edit-fund-receipt-preview-area', 'edit-funds-form');

      document.getElementById('edit-funds-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading...';

        const data = {
          receive_date: fd.get('receive_date'),
          amount: parseFloat(fd.get('amount')) || 0,
          description: fd.get('description'),
          notes: fd.get('notes'),
          receipt_base64: document.getElementById('edit-fund-receipt-base64-hidden').value || null
        };

        try {
          this.showProcessingOverlay('Company Fund', data.amount, true);
          await API.updateFund(id, data);
          Utils.closeModal();
          this.finishProcessingOverlay();
          setTimeout(() => this.render(), 1200);
        } catch (err) {
          this.hideProcessingOverlayError();
          Utils.showToast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Update Funds';
        }
      });
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async openEditExpenseModal(id) {
    if (App.isViewer()) return;
    Utils.showLoading('Loading', 'Preparing form');
    try {
      let exp;
      if (this.cachedExpenses) {
        exp = this.cachedExpenses.find(e => String(e.id) === String(id));
      }
      if (!exp) {
        // Fallback only if absolutely necessary
        const expenses = await API.getExpenses();
        exp = expenses.find(e => String(e.id) === String(id));
      }
      if (!exp) throw new Error('Expense record not found');

      const categories = ['Advance', 'Food', 'Cash Relay', 'Internet Package', 'Transport', 'Equipment', 'Maintenance', 'Uniform', 'Other', 'Health / Medical'];
      
      let riderOptions = '<option value="">-- General / Vendor --</option>';
      this.riders.forEach(r => {
        riderOptions += `<option value="${r.id}" ${r.id === exp.rider_id ? 'selected' : ''}>${r.name} (${r.client_company || 'Active'})</option>`;
      });

      const pillsHtml = categories.map(c => `
        <div class="expense-cat-pill ${c === exp.category ? 'active' : ''}" data-cat="${c}" onclick="document.getElementById('edit-expense-cat').value='${c}'; document.querySelectorAll('#edit-expense-form .expense-cat-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); document.getElementById('edit-expense-cat').dispatchEvent(new Event('change'));">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          ${c}
        </div>
      `).join('');

      const getInitialDeductType = (exp) => {
        if (exp.is_deductible && (exp.is_deductible === 'true' || exp.is_deductible === 1 || exp.is_deductible === true)) {
          return exp.rider_id ? 'deductible' : 'supervisor';
        }
        return 'company';
      };
      const initialDeductType = getInitialDeductType(exp);

      const html = `
        <form id="edit-expense-form" style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
          
          <!-- Hidden actual select to maintain form logic -->
          <select name="category" id="edit-expense-cat" required style="display:none;">
            <option value="">Select Category</option>
            ${categories.map(c => `<option value="${c}" ${c === exp.category ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          
          <div>
            <label class="expense-form-label" style="margin-bottom:8px;">Category</label>
            <div class="expense-cat-pills">
              ${pillsHtml}
            </div>
          </div>

          <div>
            <label class="expense-form-label">Deductibility</label>
            <select class="expense-form-input" name="deduct_type" id="edit-expense-deductible">
              <option value="company" ${initialDeductType === 'company' ? 'selected' : ''}>Company Paid</option>
              <option value="deductible" ${initialDeductType === 'deductible' ? 'selected' : ''}>Rider Deductible (rider will repay)</option>
              <option value="supervisor" ${initialDeductType === 'supervisor' ? 'selected' : ''}>Supervisor Deductible (supervisor will repay)</option>
            </select>
            <div id="edit-medical-hint" style="color:#2563EB; font-size:12px; font-weight:500; margin-top:6px; display:none;">Medical expenses are always covered by the company</div>
          </div>

          <div style="display:flex; gap:16px;">
            <div style="flex:1;">
              <label class="expense-form-label">Date</label>
              <input type="date" class="expense-form-input" name="expense_date" required value="${exp.expense_date}" max="${Utils.today()}">
            </div>
            <div style="flex:1;">
              <label class="expense-form-label">Amount (SAR)</label>
              <input type="number" step="0.01" min="0" class="expense-form-input" name="amount" id="edit-expense-amount" required placeholder="0.00" value="${exp.amount}" oninput="document.getElementById('edit-expense-footer-total').innerText = 'Logging: SAR ' + (parseFloat(this.value)||0).toFixed(2) + ' · April 2026 cycle'; document.getElementById('edit-expense-submit-btn').disabled = !(parseFloat(this.value)>0 && document.getElementById('edit-expense-cat').value);">
            </div>
          </div>
          
          <div>
            <label class="expense-form-label">Linked Rider</label>
            <select class="expense-form-input" name="rider_id" id="edit-expense-rider">
              ${riderOptions}
            </select>
          </div>
          
          <div id="edit-vendor-group" style="display:none; transition: all 150ms;">
            <label class="expense-form-label">Vendor or Item Name</label>
            <input type="text" class="expense-form-input" name="vendor_name" id="edit-vendor-input" value="${Utils.escapeHtml(exp.vendor_name || '')}" placeholder="e.g. AC Installer, Petrol, Spare Part">
          </div>
          
          <div>
            <label class="expense-form-label">Notes</label>
            <textarea class="expense-form-input" name="notes" placeholder="Optional notes...">${Utils.escapeHtml(exp.notes || '')}</textarea>
          </div>
          
          <div>
            <div class="expense-upload-zone" onclick="document.getElementById('edit-receipt-upload').click()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span class="upload-text" style="font-size:13px; font-weight:500;">Attach receipt or PDF</span>
            </div>
            <div id="edit-receipt-preview-area" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
            <input type="file" id="edit-receipt-upload" multiple accept="image/*,.pdf" style="display:none;">
            <div style="font-size:11px; color:#9CA3AF; margin-top:6px;">Images compressed automatically · PDFs supported</div>
            <input type="hidden" id="edit-receipt-base64-hidden">
          </div>
          
          <div class="expense-footer">
            <div id="edit-expense-footer-total" style="font-size:12px; color:#6B7280;">Logging: SAR ${(parseFloat(exp.amount)||0).toFixed(2)} · April 2026 cycle</div>
            <div style="display:flex; gap:12px;">
              <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
              <button type="submit" id="edit-expense-submit-btn" style="width:140px; height:42px; border-radius:10px; border:none; background:#2563EB; color:white; font-weight:600; cursor:pointer; transition:opacity 150ms;">Save Expense</button>
            </div>
          </div>
        </form>
      `;

      Utils.hideLoading();
      Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#0F0F0F;">Edit Expense</div><div style="font-size:13px;color:#6B7280;font-weight:normal;margin-top:2px;">Modify logged expense details</div>', html, 'modal-expense');
      
      // Inject base64 directly to avoid massive HTML parsing freezes
      if (exp.receipt_base64) {
        document.getElementById('edit-receipt-base64-hidden').value = exp.receipt_base64;
      }

      const catSelect = document.getElementById('edit-expense-cat');
      const riderSelect = document.getElementById('edit-expense-rider');
      const vendorGroup = document.getElementById('edit-vendor-group');
      const vendorInput = document.getElementById('edit-vendor-input');
      const submitBtn = document.getElementById('edit-expense-submit-btn');
      const amountInput = document.getElementById('edit-expense-amount');

      const checkSubmitBtn = () => {
         const amt = parseFloat(amountInput.value) || 0;
         if (amt > 0 && catSelect.value) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
         } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
         }
      };

      const updateEditVisibility = () => {
        const cat = catSelect.value;
        const deductibleSelect = document.getElementById('edit-expense-deductible');
        const medHint = document.getElementById('edit-medical-hint');
        
        if (cat === 'Health / Medical') {
           deductibleSelect.value = 'company';
           deductibleSelect.disabled = true;
           medHint.style.display = 'block';
        } else {
           deductibleSelect.disabled = false;
           medHint.style.display = 'none';
           if (['Advance', 'Food', 'Cash Relay'].includes(cat)) {
              if (riderSelect.value) {
                 deductibleSelect.value = 'deductible';
              } else {
                 deductibleSelect.value = 'supervisor';
              }
           } else if (deductibleSelect.value === 'false' || deductibleSelect.value === 'true') {
              deductibleSelect.value = 'company';
           }
        }
        
        if (cat === 'Other' || riderSelect.value === '') {
          vendorGroup.style.display = 'block';
          vendorInput.required = true;
        } else {
          vendorGroup.style.display = 'none';
          vendorInput.required = false;
        }
        
        checkSubmitBtn();
      };

      catSelect.addEventListener('change', updateEditVisibility);
      riderSelect.addEventListener('change', updateEditVisibility);
      amountInput.addEventListener('input', checkSubmitBtn);
      updateEditVisibility();

      this.initMultiUpload('edit-receipt-upload', 'edit-receipt-base64-hidden', 'edit-receipt-preview-area', 'edit-expense-form');

      document.getElementById('edit-expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Saving...</span>';
        submitBtn.style.opacity = '0.7';

        const category = fd.get('category');
        const deductType = document.getElementById('edit-expense-deductible').value;
        const isDeductible = deductType !== 'company';
        
        const data = {
          expense_date: fd.get('expense_date'),
          category: category,
          amount: parseFloat(fd.get('amount')) || 0,
          is_deductible: isDeductible,
          notes: fd.get('notes'),
          receipt_base64: document.getElementById('edit-receipt-base64-hidden').value || null
        };

        if (fd.get('rider_id')) {
          data.rider_id = parseInt(fd.get('rider_id'));
        } else {
          data.rider_id = null;
        }
        if (fd.get('vendor_name')) {
          data.vendor_name = fd.get('vendor_name');
        } else {
          data.vendor_name = '';
        }

        try {
          this.showProcessingOverlay(category, data.amount, false);
          await API.updateExpense(id, data);
          Utils.closeModal();
          this.finishProcessingOverlay();
          Utils.showToast('Expense updated successfully', 'success');
          this.deductionsData = null; // Clear cache
          setTimeout(() => this.render(), 1200);
        } catch (err) {
          this.hideProcessingOverlayError();
          Utils.showToast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save Expense';
          submitBtn.style.opacity = '1';
        }
      });
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async viewReceipt(id) {
    Utils.showLoading('Loading document', 'Fetching from secure storage');
    try {
      const expenses = await API.getExpenses();
      Utils.hideLoading();
      const exp = expenses.find(e => String(e.id) === String(id));
      if (!exp || !exp.receipt_base64) return Utils.showToast('Receipt not found or corrupted.', 'error');
      
      let files = [];
      try {
        files = JSON.parse(exp.receipt_base64);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (exp.receipt_base64.startsWith('data:')) {
           files = [{ type: exp.receipt_base64.startsWith('data:application/pdf') ? 'pdf' : 'image', data: exp.receipt_base64 }];
        } else {
           files = [];
        }
      }

      let innerHtml = files.map(f => {
        if (f.type === 'pdf') {
          return `
            <div style="margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
              <iframe src="${f.data}#toolbar=0" style="width:100%; height:60vh; border-radius:8px; border:1px solid var(--slate-300);"></iframe>
              <a href="${f.data}" download="receipt.pdf" style="padding:6px 16px; background:#F3F4F6; color:#4B5563; border-radius:6px; font-size:13px; font-weight:500; text-decoration:none; border:1px solid #E5E7EB;">Download PDF</a>
            </div>
          `;
        }
        return `<img src="${f.data}" style="max-width:100%; max-height:75vh; border-radius:8px; border:1px solid var(--slate-300); margin-bottom:12px;">`;
      }).join('<hr style="border:none; border-top:1px solid #E5E7EB; margin: 16px 0;">');

      const html = `<div style="text-align:center; padding-top:10px; max-height:80vh; overflow-y:auto; overflow-x:hidden;">${innerHtml}</div>`;
      Utils.openModal(`Verified Receipt — SR ${exp.amount}`, html);
    } catch(err) {
      Utils.hideLoading();
      Utils.showToast('Failed to load receipt', 'error');
    }
  },

  async viewFundReceipt(id) {
    Utils.showLoading('Loading document', 'Fetching from secure storage');
    try {
      const funds = await API.getFunds();
      Utils.hideLoading();
      const fund = funds.find(f => String(f.id) === String(id));
      if (!fund || !fund.receipt_base64) return Utils.showToast('Receipt not found or corrupted.', 'error');
      
      let files = [];
      try {
        files = JSON.parse(fund.receipt_base64);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (fund.receipt_base64.startsWith('data:')) {
           files = [{ type: fund.receipt_base64.startsWith('data:application/pdf') ? 'pdf' : 'image', data: fund.receipt_base64 }];
        } else {
           files = [];
        }
      }

      let innerHtml = files.map(f => {
        if (f.type === 'pdf') {
          return `
            <div style="margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
              <iframe src="${f.data}#toolbar=0" style="width:100%; height:60vh; border-radius:8px; border:1px solid var(--slate-300);"></iframe>
              <a href="${f.data}" download="fund_receipt.pdf" style="padding:6px 16px; background:#F3F4F6; color:#4B5563; border-radius:6px; font-size:13px; font-weight:500; text-decoration:none; border:1px solid #E5E7EB;">Download PDF</a>
            </div>
          `;
        }
        return `<img src="${f.data}" style="max-width:100%; max-height:75vh; border-radius:8px; border:1px solid var(--slate-300); margin-bottom:12px;">`;
      }).join('<hr style="border:none; border-top:1px solid #E5E7EB; margin: 16px 0;">');

      const html = `<div style="text-align:center; padding-top:10px; max-height:80vh; overflow-y:auto; overflow-x:hidden;">${innerHtml}</div>`;
      Utils.openModal(`Verified Receipt — SR ${fund.amount}`, html);
    } catch(err) {
      Utils.hideLoading();
      Utils.showToast('Failed to load receipt', 'error');
    }
  },

  async scanReceiptForAmount(b64, inputId) {
    if (!window.Tesseract) return; 
    
    const inputElement = document.getElementById(inputId);
    if (!inputElement || inputElement.value) return;

    Utils.showToast('AI is scanning receipt for amount...', 'info');

    try {
      const result = await Tesseract.recognize(b64, 'eng');
      const text = result.data.text;
      
      // We look for patterns like 'Total 25.50', 'SR 5', 'Amount: 120'
      // By looking globally, we try to find the last or most prominent amount
      const regex = /(?:total|amount|sar|sr|net)[:\s]*([0-9]{1,4}(?:\.[0-9]{2})?)/i;
      const match = text.match(regex);
      
      // Also as fallback, find the largest lone float if it exists in the last few lines
      let amount = 0;
      if (match && match[1]) {
        amount = parseFloat(match[1]);
      } else {
        // Fallback: look for floats like 12.50 or 150.00
        const floats = [...text.matchAll(/[0-9]+\.[0-9]{2}/g)].map(m => parseFloat(m[0]));
        if (floats.length > 0) {
          amount = Math.max(...floats);
        }
      }

      if (amount > 0) {
        if (!inputElement.value) {
           inputElement.value = amount;
           Utils.showToast(`AI detected Amount: SR ${amount}`, 'success');
        }
      } else {
         Utils.showToast('AI could not confidently detect amount.', 'info');
      }
    } catch (e) {
      console.warn("OCR completely failed", e);
    }
  },

  showProcessingOverlay(category, amount, isFund = false) {
    const activeDate = Utils.getActiveDate();
    const monthYear = new Date(activeDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    Utils.showLoading(`Saving ${isFund ? 'funds' : 'expense'}`, `Recording to ${monthYear} cycle`);
  },

  finishProcessingOverlay() {
    Utils.hideLoading();
  },
  
  hideProcessingOverlayError() {
    Utils.hideLoading();
  },

  initMultiUpload(inputId, hiddenId, previewAreaId, formId) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const previewArea = document.getElementById(previewAreaId);
    
    if (!input || !hidden || !previewArea) return;

    input.accept = "image/jpeg, image/png, image/webp, application/pdf";
    input.multiple = true;
    
    let files = [];
    if (hidden.value) {
      try {
        files = JSON.parse(hidden.value);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (hidden.value.startsWith('data:')) {
           files = [{ type: hidden.value.startsWith('data:application/pdf') ? 'pdf' : 'image', data: hidden.value }];
        } else {
           files = [];
        }
      }
    }
    
    const renderPreviews = () => {
      hidden.value = files.length ? JSON.stringify(files) : '';
      if (files.length === 0) {
        previewArea.style.display = 'none';
        return;
      }
      previewArea.style.display = 'flex';
      previewArea.style.gap = '6px';
      previewArea.style.flexWrap = 'wrap';
      previewArea.style.justifyContent = 'flex-start';
      
      let html = '';
      files.forEach((f, i) => {
        const isPdf = f.type === 'pdf';
        const iconSvg = isPdf 
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        
        // Extract filename from the data URL or generate one
        let filename = isPdf ? 'document.pdf' : 'receipt.jpg';
        if (f.name) filename = f.name;

        html += `
          <div style="background:#F3F4F6; border-radius:8px; height:28px; display:flex; align-items:center; padding:0 8px; gap:6px;">
            ${iconSvg}
            <span style="font-size:12px; color:#374151; max-width:80px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(filename)}</span>
            <button type="button" class="btn-remove-file" data-idx="${i}" style="background:none; border:none; color:#9CA3AF; padding:0; cursor:pointer; display:flex; align-items:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      });
      previewArea.innerHTML = html;
      
      previewArea.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          files.splice(parseInt(btn.dataset.idx), 1);
          renderPreviews();
        });
      });
    };

    renderPreviews();

    input.addEventListener('change', async (e) => {
      const selectedFiles = Array.from(e.target.files);
      if (!selectedFiles.length) return;
      
      const submitBtn = document.querySelector(`#${formId} button[type="submit"]`);
      const originalText = submitBtn ? submitBtn.innerText : 'Processing...';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Processing...'; }

      for (let file of selectedFiles) {
        if (file.type === 'application/pdf') {
          await new Promise(r => {
             const reader = new FileReader();
             reader.onload = (ev) => {
               files.push({ type: 'pdf', data: ev.target.result, name: file.name });
               r();
             };
             reader.readAsDataURL(file);
          });
        } else if (file.type.startsWith('image/')) {
          await new Promise(r => {
             const reader = new FileReader();
             reader.onload = (ev) => {
               const img = new Image();
               img.onload = () => {
                 const canvas = document.createElement('canvas');
                 const MAX_WIDTH = 800, MAX_HEIGHT = 800;
                 let width = img.width, height = img.height;
                 if (width > height && width > MAX_WIDTH) { height = Math.round(height * MAX_WIDTH/width); width = MAX_WIDTH; }
                 else if (height > MAX_HEIGHT) { width = Math.round(width * MAX_HEIGHT/height); height = MAX_HEIGHT; }
                 canvas.width = width; canvas.height = height;
                 canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                 files.push({ type: 'image', data: canvas.toDataURL('image/jpeg', 0.7), name: file.name });
                 r();
               };
               img.onerror = r;
               img.src = ev.target.result;
             };
             reader.readAsDataURL(file);
          });
        }
      }

      const amountInput = document.querySelector(`#${formId} input[name="amount"]`);
      if (amountInput && !amountInput.value) {
         const firstImg = files.find(f => f.type === 'image');
         if (firstImg) {
            if (!amountInput.id) amountInput.id = `amt-${Date.now()}`;
            Expenses.scanReceiptForAmount(firstImg.data, amountInput.id);
         }
      }

      renderPreviews();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
      e.target.value = '';
    });
  },

  renderThumbnail(base64Str, onclickStr) {
    if (!base64Str) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    let files = [];
    try {
      files = JSON.parse(base64Str);
      if (!Array.isArray(files)) throw new Error();
    } catch(e) {
      if (base64Str.startsWith('data:')) {
         files = [{ type: base64Str.startsWith('data:application/pdf') ? 'pdf' : 'image', data: base64Str }];
      } else {
         return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
      }
    }
    
    if (files.length === 0) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    
    let countBadge = '';
    if (files.length > 1) {
      countBadge = `<div style="position:absolute; bottom:-6px; right:-6px; background:#2563EB; color:white; border-radius:50%; font-size:10px; font-weight:bold; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">+${files.length - 1}</div>`;
    }
    
    const first = files[0];
    const previewHtml = first.type === 'pdf' 
       ? `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#dc2626; font-size:10px; border-radius:6px; overflow:hidden;">PDF</div>`
       : `<img src="${first.data}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
       
    return `<div onclick="${onclickStr}" style="position:relative; cursor:pointer; display:inline-block; border:1px solid #E5E7EB; border-radius:6px; overflow:visible; width:36px; height:36px; background:#F9FAFB; transition: 0.2s;" onmouseover="this.style.opacity=0.8; transform:scale(1.05);" onmouseout="this.style.opacity=1; transform:scale(1);" title="Click to view receipt(s)">${previewHtml}${countBadge}</div>`;
  },

  openCustomExcelReportModal() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Compute preset ranges
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString().split('T')[0];

    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    const thisYearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    const html = `
          <label class="form-label">Start Date</label>
          <input type="date" class="form-input" name="start_date" required value="${firstOfMonth}">
        </div>
        <div class="form-group" style="grid-column: 2 / 3;">
          <label class="form-label">End Date</label>
          <input type="date" class="form-input" name="end_date" required value="${today}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1; background:linear-gradient(135deg,#EFF6FF,#F0FDF4); border: 1px solid #BFDBFE; padding: 14px 16px; border-radius: 10px; font-size: 13px; color: #1E3A8A; line-height: 1.6; margin-bottom: 8px;">
          <strong style="font-size:14px;">📊 What's included in the report:</strong>
          <ul style="margin: 6px 0 0 16px; padding: 0; list-style-type: none;">
            <li>✅ <strong>Financial Overview</strong> — period totals + all-time global balance</li>
            <li>✅ <strong>Funds Received</strong> — every transfer in the selected period</li>
            <li>✅ <strong>Expenses Logged</strong> — every expense in the period (excludes manual deductions)</li>
            <li>✅ <strong>Category Breakdown</strong> — how much spent per category (Fuel, Sim, etc.)</li>
            <li>✅ <strong>Rider Breakdown</strong> — how much spent per rider/recipient</li>
            <li>✅ <strong>Prominent Global Balance</strong> — big highlight of the remaining or out-of-pocket amount</li>
          </ul>
        </div>
        <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success" style="background:linear-gradient(135deg,#10B981,#059669); border:none; color:#FFFFFF; font-weight:600; padding:10px 24px; font-size:14px;">📥 Export Excel</button>
        </div>
      </form>
    `;

    Utils.openModal('📊 Custom Date Range Excel Report', html);

    document.getElementById('custom-excel-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const start = fd.get('start_date');
      const end = fd.get('end_date');
      Expenses.generateCustomExcelReport(start, end);
    });
  },

  async generateCustomExcelReport(start, end) {
    if (!start || !end) {
      Utils.showToast('Please select a valid date range.', 'error');
      return;
    }
    if (new Date(start) > new Date(end)) {
      Utils.showToast('Start Date cannot be after End Date.', 'error');
      return;
    }

    Utils.showLoading('Generating Excel Report...', 'Fetching data and building sheet...');

    try {
      if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS library not loaded. Please refresh the page and try again.');
      }

      // Fetch period details and globalStats
      const [expenses, funds, globalStats] = await Promise.all([
        API.getExpenses(start, end),
        API.getFunds(start, end),
        API.getExpenseStats()
      ]);

      const validExpenses = expenses.filter(e => e.category !== 'Manual Deduction');
      const totalFundsPeriod = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const totalExpensesPeriod = validExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const netPeriod = totalFundsPeriod - totalExpensesPeriod;

      const gStats = globalStats || {
        total_received: 0,
        total_expenses: 0,
        remaining_irl: 0,
        from_my_pocket: 0
      };

      // ── Build category & rider breakdowns ──
      const categoryMap = {};
      const riderMap = {};
      validExpenses.forEach(e => {
        const cat = e.category || 'Other';
        const rider = e.rider_name || 'Company Covered';
        const amt = parseFloat(e.amount) || 0;
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        riderMap[rider] = (riderMap[rider] || 0) + amt;
      });
      const categoryBreakdown = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      const riderBreakdown = Object.entries(riderMap).sort((a, b) => b[1] - a[1]);

      // Deductible vs Company paid totals
      const totalDeductible = validExpenses.filter(e => e.is_deductible === 1 || e.is_deductible === true).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const totalCompanyPaid = totalExpensesPeriod - totalDeductible;

      // Create workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Inspiring Roads Logistics';
      wb.title = 'Custom Financial Statement';

      const ws = wb.addWorksheet('Financial Statement', {
        views: [{ showGridLines: false }],
        pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      // Define grid columns A-G (added col G for row #)
      ws.columns = [
        { width: 5 },  // A: # row number
        { width: 14 }, // B: Date
        { width: 24 }, // C: Category / Source
        { width: 22 }, // D: Rider / Description
        { width: 18 }, // E: Amount (SAR)
        { width: 34 }, // F: Notes / Description
        { width: 16 }  // G: Type / Status
      ];

      // Palette styling constants
      const C = {
        dark: 'FF0F172A',
        darkBlue: 'FF1E293B',
        blue: 'FF1E3A8A',
        green: 'FF16A34A',
        red: 'FFDC2626',
        white: 'FFFFFFFF',
        border: 'FFE2E8F0',
        muted: 'FF64748B',
        zebra: 'FFF8FAFC',
        lightGreen: 'FFD1FAE5',
        lightRed: 'FFFEE2E2',
        lightBlue: 'FFDBEAFE',
        lightAmber: 'FFFEF3C7',
        amber: 'FFD97706',
        purple: 'FF7C3AED',
        lightPurple: 'FFF3E8FF'
      };

      const thinBorder = {
        top: { style: 'thin', color: { argb: C.border } },
        bottom: { style: 'thin', color: { argb: C.border } },
        left: { style: 'thin', color: { argb: C.border } },
        right: { style: 'thin', color: { argb: C.border } }
      };

      // Helper to apply border to a full row range
      const applyRowBorder = (rowNum, startCol, endCol) => {
        for (let col = startCol; col <= endCol; col++) {
          ws.getRow(rowNum).getCell(col).border = thinBorder;
        }
      };

      // ══════════════════════════════════════════════════════
      // ── SECTION: Title Banner ──
      // ══════════════════════════════════════════════════════
      ws.mergeCells(1, 1, 1, 7);
      const h1 = ws.getCell('A1');
      h1.value = 'INSPIRING ROADS LOGISTICS';
      h1.font = { name: 'Calibri', bold: true, size: 18, color: { argb: C.white } };
      h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
      h1.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 36;

      ws.mergeCells(2, 1, 2, 7);
      const h2 = ws.getCell('A2');
      const startFmt = new Date(start + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const endFmt = new Date(end + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      h2.value = `Custom Financial Statement  ·  ${startFmt}  →  ${endFmt}`;
      h2.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF94A3B8' } };
      h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
      h2.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 24;

      ws.mergeCells(3, 1, 3, 7);
      const h3 = ws.getCell('A3');
      h3.value = `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`;
      h3.font = { name: 'Calibri', italic: true, size: 9, color: { argb: C.muted } };
      h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      h3.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(3).height = 20;

      // "?"? BIG HIGHLIGHT BOXES "?"?
      let r = 5;

      // --- PERIOD METRICS (BIG NUMBERS) ---
      ws.mergeCells(r, 1, r, 7);
      const pTitle = ws.getCell(`A${r}`);
      pTitle.value = ' PERIOD SUMMARY (Selected Dates)';
      pTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.white } };
      pTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } };
      pTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      pTitle.border = thinBorder;
      ws.getRow(r).height = 26;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const pRecLbl = ws.getCell(`A${r}`);
      pRecLbl.value = 'FUNDS RECEIVED';
      pRecLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF064E3B' } };
      pRecLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      pRecLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      pRecLbl.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const pExpLbl = ws.getCell(`D${r}`);
      pExpLbl.value = 'EXPENSES';
      pExpLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF7F1D1D' } };
      pExpLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      pExpLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      pExpLbl.border = thinBorder;
      ws.getRow(r).height = 22;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const pRecVal = ws.getCell(`A${r}`);
      pRecVal.value = totalFundsPeriod;
      pRecVal.numFmt = '#,##0.00 "SAR"';
      pRecVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.green } };
      pRecVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      pRecVal.alignment = { vertical: 'middle', horizontal: 'center' };
      pRecVal.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const pExpVal = ws.getCell(`D${r}`);
      pExpVal.value = totalExpensesPeriod;
      pExpVal.numFmt = '#,##0.00 "SAR"';
      pExpVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.red } };
      pExpVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      pExpVal.alignment = { vertical: 'middle', horizontal: 'center' };
      pExpVal.border = thinBorder;
      ws.getRow(r).height = 40;

      // --- GLOBAL METRICS (BIG NUMBERS) ---
      r += 2;
      ws.mergeCells(r, 1, r, 7);
      const gTitle = ws.getCell(`A${r}`);
      gTitle.value = ' GLOBAL SUMMARY (All-Time)';
      gTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.white } };
      gTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
      gTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      gTitle.border = thinBorder;
      ws.getRow(r).height = 26;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const gRecLbl = ws.getCell(`A${r}`);
      gRecLbl.value = 'GLOBAL RECEIVED';
      gRecLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF064E3B' } };
      gRecLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gRecLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      gRecLbl.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const gExpLbl = ws.getCell(`D${r}`);
      gExpLbl.value = 'GLOBAL EXPENSES';
      gExpLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF7F1D1D' } };
      gExpLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gExpLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      gExpLbl.border = thinBorder;
      ws.getRow(r).height = 22;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const gRecVal = ws.getCell(`A${r}`);
      gRecVal.value = parseFloat(gStats.total_received) || 0;
      gRecVal.numFmt = '#,##0.00 "SAR"';
      gRecVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.green } };
      gRecVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gRecVal.alignment = { vertical: 'middle', horizontal: 'center' };
      gRecVal.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const gExpVal = ws.getCell(`D${r}`);
      gExpVal.value = parseFloat(gStats.total_expenses) || 0;
      gExpVal.numFmt = '#,##0.00 "SAR"';
      gExpVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.red } };
      gExpVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gExpVal.alignment = { vertical: 'middle', horizontal: 'center' };
      gExpVal.border = thinBorder;
      ws.getRow(r).height = 40;

      // EXTRA ROWS FOR REMAINING FUNDS AND DEDUCTIBLES
      r++;
      ws.mergeCells(r, 1, r, 3);
      const isOutOfPocket = gStats.from_my_pocket > 0;
      const globalBalVal = isOutOfPocket ? gStats.from_my_pocket : gStats.remaining_irl;
      const balLabel = isOutOfPocket ? 'Out of Pocket' : 'Remaining Funds';
      const balColor = isOutOfPocket ? C.red : C.green;
      ws.getCell(`A${r}`).value = `  ${balLabel}: ${globalBalVal.toFixed(2)} SAR`;
      ws.getCell(`A${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: balColor } };
      ws.getCell(`A${r}`).alignment = { vertical: 'middle' };
      ws.getCell(`A${r}`).border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      ws.getCell(`D${r}`).value = `  Rider-Deductible (Period): ${totalDeductible.toFixed(2)} SAR`;
      ws.getCell(`D${r}`).font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.amber } };
      ws.getCell(`D${r}`).alignment = { vertical: 'middle' };
      ws.getCell(`D${r}`).border = thinBorder;
      ws.getRow(r).height = 24;

      // ══════════════════════════════════════════════════════
      // ── SECTION 1: Funds Received ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const fundsTitle = ws.getCell(`A${r}`);
      fundsTitle.value = '  § 1.  FUNDS RECEIVED FROM COMPANY  (Period Only)';
      fundsTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
      fundsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      ws.getRow(r).height = 26;

      r += 2;
      const styleTableHeader = (rowNum, headers) => {
        const row = ws.getRow(rowNum);
        row.height = 24;
        headers.forEach((h, i) => {
          const cell = row.getCell(i + 1);
          cell.value = h;
          cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = thinBorder;
        });
      };

      styleTableHeader(r, ['#', 'Date', 'Source / Description', 'Reference / Notes', 'Amount', '', '']);
      ws.mergeCells(r, 5, r, 7);
      // Right-align Amount header
      ws.getCell(`E${r}`).alignment = { vertical: 'middle', horizontal: 'right' };

      const fundsStartRow = r + 1;

      if (funds.length === 0) {
        r++;
        ws.mergeCells(r, 1, r, 7);
        const cell = ws.getCell(`A${r}`);
        cell.value = 'No funds received during this period.';
        cell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: C.muted } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
        ws.getRow(r).height = 24;
      } else {
        funds.forEach((f, idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          const cNum = row.getCell(1);
          cNum.value = idx + 1;
          cNum.font = { name: 'Calibri', size: 9, color: { argb: C.muted } };
          cNum.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDate = row.getCell(2);
          cDate.value = f.receive_date ? new Date(f.receive_date + 'T12:00:00Z') : '';
          cDate.numFmt = 'dd-mmm-yyyy';
          cDate.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDesc = row.getCell(3);
          cDesc.value = f.description || 'IRL Transfer';

          const cNotes = row.getCell(4);
          cNotes.value = f.notes || '-';

          ws.mergeCells(r, 5, r, 7);
          const cAmt = row.getCell(5);
          cAmt.value = parseFloat(f.amount) || 0;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.green } };
          cAmt.alignment = { horizontal: 'right', vertical: 'middle' };

          for (let col = 1; col <= 7; col++) {
            const cell = row.getCell(col);
            cell.font = cell.font || { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            if ((idx) % 2 === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
            }
          }
        });

        // Funds Total Row
        r++;
        ws.mergeCells(r, 1, r, 4);
        ws.getCell(`A${r}`).value = `TOTAL RECEIVED  (${funds.length} transfer${funds.length !== 1 ? 's' : ''})`;
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10 };
        ws.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightGreen } };

        ws.mergeCells(r, 5, r, 7);
        const totFCell = ws.getCell(`E${r}`);
        totFCell.value = totalFundsPeriod;
        totFCell.numFmt = '#,##0.00 "SAR"';
        totFCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.green } };
        totFCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totFCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightGreen } };
        applyRowBorder(r, 1, 7);
        ws.getRow(r).height = 26;
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 2: Expenses Table ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const expTitle = ws.getCell(`A${r}`);
      expTitle.value = '  § 2.  OPERATIONAL EXPENSES  (Period Only)';
      expTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
      expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      ws.getRow(r).height = 26;

      r += 2;
      styleTableHeader(r, ['#', 'Date', 'Category', 'Rider / Recipient', 'Amount', 'Description / Notes', 'Status']);

      const expHeaderRow = r;
      const expStartRow = r + 1;

      if (validExpenses.length === 0) {
        r++;
        ws.mergeCells(r, 1, r, 7);
        const cell = ws.getCell(`A${r}`);
        cell.value = 'No expenses logged during this period.';
        cell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: C.muted } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
        ws.getRow(r).height = 24;
      } else {
        validExpenses.forEach((e, idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          const cNum = row.getCell(1);
          cNum.value = idx + 1;
          cNum.font = { name: 'Calibri', size: 9, color: { argb: C.muted } };
          cNum.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDate = row.getCell(2);
          cDate.value = e.expense_date ? new Date(e.expense_date + 'T12:00:00Z') : '';
          cDate.numFmt = 'dd-mmm-yyyy';
          cDate.alignment = { horizontal: 'center', vertical: 'middle' };

          const cCat = row.getCell(3);
          cCat.value = e.category || 'Other';
          cCat.alignment = { horizontal: 'center', vertical: 'middle' };

          const cRider = row.getCell(4);
          cRider.value = e.rider_name || 'Company Covered';

          const cAmt = row.getCell(5);
          cAmt.value = parseFloat(e.amount) || 0;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { horizontal: 'right', vertical: 'middle' };

          const cNotes = row.getCell(6);
          cNotes.value = e.notes || e.description || '-';

          const cDed = row.getCell(7);
          const isDed = e.is_deductible === 1 || e.is_deductible === true;
          cDed.value = isDed ? '⬤ Deductible' : '○ Company Paid';
          cDed.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isDed ? C.amber : C.muted } };
          cDed.alignment = { horizontal: 'center', vertical: 'middle' };

          for (let col = 1; col <= 7; col++) {
            const cell = row.getCell(col);
            cell.font = cell.font || { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            if ((idx) % 2 === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
            }
          }
        });

        // Expenses Total Row
        r++;
        ws.mergeCells(r, 1, r, 4);
        ws.getCell(`A${r}`).value = `TOTAL EXPENSES  (${validExpenses.length} item${validExpenses.length !== 1 ? 's' : ''})`;
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10 };
        ws.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };

        const totExpCell = ws.getCell(`E${r}`);
        totExpCell.value = totalExpensesPeriod;
        totExpCell.numFmt = '#,##0.00 "SAR"';
        totExpCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.red } };
        totExpCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totExpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };
        applyRowBorder(r, 1, 7);
        ws.getRow(r).height = 26;

        // ── Auto-filter on expenses table ──
        ws.autoFilter = { from: { row: expHeaderRow, column: 1 }, to: { row: r - 1, column: 7 } };
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 3: Expense Breakdown by Category ──
      // ══════════════════════════════════════════════════════
      if (categoryBreakdown.length > 0) {
        r += 3;
        ws.mergeCells(r, 1, r, 7);
        const catTitle = ws.getCell(`A${r}`);
        catTitle.value = '  § 3.  EXPENSE BREAKDOWN BY CATEGORY  (Period Only)';
        catTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
        catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.purple } };
        ws.getRow(r).height = 26;

        r += 2;
        // Header
        const catHdrRow = ws.getRow(r);
        catHdrRow.height = 24;
        ws.mergeCells(r, 1, r, 3);
        ws.getCell(`A${r}`).value = 'Category';
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`A${r}`).border = thinBorder;

        ws.mergeCells(r, 4, r, 5);
        ws.getCell(`D${r}`).value = 'Total Amount';
        ws.getCell(`D${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`D${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
        ws.getCell(`D${r}`).border = thinBorder;

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).value = '% of Total';
        ws.getCell(`F${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`F${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`F${r}`).border = thinBorder;

        categoryBreakdown.forEach(([cat, amt], idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          ws.mergeCells(r, 1, r, 3);
          const cCat = row.getCell(1);
          cCat.value = '  ' + cat;
          cCat.font = { name: 'Calibri', size: 10, bold: true };
          cCat.alignment = { vertical: 'middle' };

          ws.mergeCells(r, 4, r, 5);
          const cAmt = row.getCell(4);
          cAmt.value = amt;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { vertical: 'middle', horizontal: 'right' };

          ws.mergeCells(r, 6, r, 7);
          const cPct = row.getCell(6);
          const pct = totalExpensesPeriod > 0 ? (amt / totalExpensesPeriod) : 0;
          cPct.value = pct;
          cPct.numFmt = '0.0%';
          cPct.font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
          cPct.alignment = { vertical: 'middle', horizontal: 'center' };

          for (let col = 1; col <= 7; col++) {
            row.getCell(col).border = thinBorder;
            if (idx % 2 === 1) {
              row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightPurple } };
            }
          }
        });
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 4: Expense Breakdown by Rider ──
      // ══════════════════════════════════════════════════════
      if (riderBreakdown.length > 0) {
        r += 3;
        ws.mergeCells(r, 1, r, 7);
        const riderTitle = ws.getCell(`A${r}`);
        riderTitle.value = '  § 4.  EXPENSE BREAKDOWN BY RIDER / RECIPIENT  (Period Only)';
        riderTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
        riderTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        ws.getRow(r).height = 26;

        r += 2;
        // Header
        ws.getRow(r).height = 24;
        ws.mergeCells(r, 1, r, 3);
        ws.getCell(`A${r}`).value = 'Rider / Recipient';
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`A${r}`).border = thinBorder;

        ws.mergeCells(r, 4, r, 5);
        ws.getCell(`D${r}`).value = 'Total Amount';
        ws.getCell(`D${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`D${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
        ws.getCell(`D${r}`).border = thinBorder;

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).value = '% of Total';
        ws.getCell(`F${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`F${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`F${r}`).border = thinBorder;

        riderBreakdown.forEach(([rider, amt], idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          ws.mergeCells(r, 1, r, 3);
          const cRider = row.getCell(1);
          cRider.value = '  ' + rider;
          cRider.font = { name: 'Calibri', size: 10, bold: true };
          cRider.alignment = { vertical: 'middle' };

          ws.mergeCells(r, 4, r, 5);
          const cAmt = row.getCell(4);
          cAmt.value = amt;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { vertical: 'middle', horizontal: 'right' };

          ws.mergeCells(r, 6, r, 7);
          const cPct = row.getCell(6);
          const pct = totalExpensesPeriod > 0 ? (amt / totalExpensesPeriod) : 0;
          cPct.value = pct;
          cPct.numFmt = '0.0%';
          cPct.font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
          cPct.alignment = { vertical: 'middle', horizontal: 'center' };

          for (let col = 1; col <= 7; col++) {
            row.getCell(col).border = thinBorder;
            if (idx % 2 === 1) {
              row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightBlue } };
            }
          }
        });
      }

      // ══════════════════════════════════════════════════════
      // ── FOOTER ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const footerCell = ws.getCell(`A${r}`);
      footerCell.value = '— End of Report  ·  Inspiring Roads Logistics  ·  Confidential —';
      footerCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: C.muted } };
      footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
      footerCell.border = { top: { style: 'thin', color: { argb: C.border } } };
      ws.getRow(r).height = 22;

      // ── Freeze top 3 rows (title banner) ──
      ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

      // ── Download Workbook ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IRL_Financial_Report_${start}_to_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      Utils.hideLoading();
      Utils.showToast('Excel Report exported successfully!', 'success');
      Utils.closeModal();

    } catch (err) {
      console.error('Custom Excel Export Error:', err);
      Utils.hideLoading();
      Utils.showToast('Failed to export Excel Report: ' + err.message, 'error');
    }
  },

  renderThumbnail(base64Str, onclickStr) {
    if (!base64Str) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    let files = [];
    try {
      files = JSON.parse(base64Str);
      if (!Array.isArray(files)) throw new Error();
    } catch(e) {
      if (base64Str.startsWith('data:')) {
         files = [{ type: base64Str.startsWith('data:application/pdf') ? 'pdf' : 'image', data: base64Str }];
      } else {
         return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
      }
    }
    
    if (files.length === 0) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    
    let countBadge = '';
    if (files.length > 1) {
      countBadge = `<div style="position:absolute; bottom:-6px; right:-6px; background:#2563EB; color:white; border-radius:50%; font-size:10px; font-weight:bold; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">+${files.length - 1}</div>`;
    }
    
    const first = files[0];
    const previewHtml = first.type === 'pdf' 
       ? `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#dc2626; font-size:10px; border-radius:6px; overflow:hidden;">PDF</div>`
       : `<img src="${first.data}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
       
    return `<div onclick="${onclickStr}" style="position:relative; cursor:pointer; display:inline-block; border:1px solid #E5E7EB; border-radius:6px; overflow:visible; width:36px; height:36px; background:#F9FAFB; transition: 0.2s;" onmouseover="this.style.opacity=0.8; transform:scale(1.05);" onmouseout="this.style.opacity=1; transform:scale(1);" title="Click to view receipt(s)">${previewHtml}${countBadge}</div>`;
  }
};
