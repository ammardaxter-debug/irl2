const SprintsPage = {
  sprintData: null,
  activeSprintNumber: 1,
  selectedSprintNumber: null,
  searchQuery: '',
  countdownInterval: null,

  async render() {
    const container = document.getElementById('page-sprints');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="skeleton" style="height: 300px; border-radius: 12px; margin-bottom: 20px;"></div>
      <div class="skeleton" style="height: 400px; border-radius: 12px;"></div>
    `;

    try {
      await this.loadData();
      this.renderContent();
      this.startCountdown();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Failed to load sprint data: ${err.message}</p>
          <button class="btn btn-primary" onclick="SprintsPage.render()">Retry</button>
        </div>
      `;
    }
  },

  async loadData() {
    const url = this.selectedSprintNumber 
      ? `/api/admin/sprints/leaderboard?sprintNumber=${this.selectedSprintNumber}` 
      : '/api/admin/sprints/leaderboard';
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    
    this.sprintData = await res.json();
    
    if (!this.selectedSprintNumber) {
      this.activeSprintNumber = this.sprintData.sprintNumber;
      this.selectedSprintNumber = this.sprintData.sprintNumber;
    }
  },

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    
    const countdownEl = document.getElementById('sprint-countdown');
    if (!countdownEl || !this.sprintData || this.sprintData.countdownMs <= 0) return;

    let remainingMs = this.sprintData.countdownMs;
    
    this.countdownInterval = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs <= 0) {
        clearInterval(this.countdownInterval);
        countdownEl.textContent = "00:00:00";
        this.render();
        return;
      }

      const secs = Math.floor((remainingMs / 1000) % 60);
      const mins = Math.floor((remainingMs / (1000 * 60)) % 60);
      const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

      let str = '';
      if (days > 0) str += `${days}d `;
      str += `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      countdownEl.textContent = str;
    }, 1000);
  },

  renderContent() {
    const container = document.getElementById('page-sprints');
    if (!container || !this.sprintData) return;

    const data = this.sprintData;
    const leaderboard = data.leaderboard || [];

    const filteredLeaderboard = leaderboard.filter(r => 
      r.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      r.mobile.includes(this.searchQuery)
    );

    let sprintOptions = '';
    for (let i = 1; i <= this.activeSprintNumber; i++) {
      sprintOptions += `<option value="${i}" ${i === this.selectedSprintNumber ? 'selected' : ''}>Sprint #${i}</option>`;
    }

    const phaseColors = {
      'PRE_LAUNCH': 'background: #FEF3C7; color: #D97706;',
      'ACTIVE': 'background: #D1FAE5; color: #059669;',
      'GRACE_PERIOD': 'background: #DBEAFE; color: #1E40AF;',
      'WINNER_HIGHLIGHT': 'background: #FEF9C3; color: #854D0E;',
      'FINISHED': 'background: #E5E7EB; color: #4B5563;'
    };
    const phaseLabel = {
      'PRE_LAUNCH': 'Pre Launch (Starts June 1st)',
      'ACTIVE': 'Active Competition',
      'GRACE_PERIOD': 'Grace Period (Finalizing Logs)',
      'WINNER_HIGHLIGHT': 'Winner Highlight Phase',
      'FINISHED': 'Finished'
    };

    container.innerHTML = `
      <style>
        .sprint-header-card {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: space-between;
          align-items: center;
        }
        .sprint-details {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sprint-badge-state {
          padding: 6px 12px;
          border-radius: 9999px;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
        }
        .countdown-container {
          background: #1E293B;
          color: #FFF;
          padding: 12px 24px;
          border-radius: 10px;
          text-align: center;
          min-width: 180px;
        }
        .countdown-time {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 1px;
          font-family: monospace;
        }
        .countdown-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #94A3B8;
          font-weight: 700;
          margin-top: 2px;
        }
        .sprints-table-container {
          background: #FFFFFF;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 24px;
        }
        .sprints-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 20px;
        }
        .sprint-search {
          padding: 8px 16px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          min-width: 250px;
          font-size: 14px;
        }
        .sprint-select {
          padding: 8px 16px;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          background: #FFF;
          font-size: 14px;
          font-weight: 600;
        }
        .sprints-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .sprints-table th, .sprints-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #F1F5F9;
          font-size: 14px;
        }
        .sprints-table th {
          background: #F8FAFC;
          color: #475569;
          font-weight: 700;
        }
        .sprints-table tbody tr:hover {
          background: #F8FAFC;
        }
        .rank-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
        }
        .rank-1 { background: #FEF08A; color: #854D0E; border: 1px solid #FDE047; }
        .rank-2 { background: #E2E8F0; color: #475569; border: 1px solid #CBD5E1; }
        .rank-3 { background: #FFEDD5; color: #9A3412; border: 1px solid #FDBA74; }
        .rank-other { background: #F1F5F9; color: #64748B; }
        .prize-tag {
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
        }
        .prize-1 { background: #FEF9C3; color: #854D0E; }
        .prize-2 { background: #F1F5F9; color: #334155; }
        .prize-3 { background: #FFEDD5; color: #9A3412; }
        .rider-profile-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rider-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #E2E8F0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #475569;
          overflow: hidden;
        }
        .rider-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      </style>

      <div class="sprint-header-card">
        <div class="sprint-details">
          <div>
            <h2 style="font-size: 20px; font-weight: 800; color: #1E293B;">Weekly Competition Sprint #${data.sprintNumber}</h2>
            <p style="color: #64748B; font-size: 13px; margin-top: 4px;">Duration: <strong>${Utils.formatDate(data.startDate)}</strong> to <strong>${Utils.formatDate(data.endDate)}</strong></p>
          </div>
          <span class="sprint-badge-state" style="${phaseColors[data.phase]}">${phaseLabel[data.phase]}</span>
        </div>

        ${data.countdownMs > 0 ? `
          <div class="countdown-container">
            <div class="countdown-time" id="sprint-countdown">00:00:00</div>
            <div class="countdown-label">${data.phase === 'PRE_LAUNCH' ? 'Starts In' : 'Time Remaining'}</div>
          </div>
        ` : ''}
      </div>

      <div class="sprints-table-container">
        <div class="sprints-controls">
          <input 
            type="text" 
            class="sprint-search" 
            placeholder="Search rider name or mobile..." 
            value="${this.searchQuery}" 
            oninput="SprintsPage.handleSearch(event)"
          />
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 600; color: #475569;">Sprint Filter:</span>
            <select class="sprint-select" onchange="SprintsPage.handleSprintChange(event)">
              ${sprintOptions}
            </select>
          </div>
        </div>

        <table class="sprints-table">
          <thead>
            <tr>
              <th style="width: 80px;">Rank</th>
              <th>Rider</th>
              <th>Mobile</th>
              <th>Rider Type</th>
              <th style="text-align: right; width: 150px;">Orders Delivered</th>
              <th style="text-align: right; width: 220px;">Potential Payout (Company Only)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLeaderboard.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; color: #64748B; padding: 40px 0;">No active racing records found for this criteria.</td>
              </tr>
            ` : filteredLeaderboard.map((rider, idx) => {
              const rank = idx + 1;
              let rankClass = 'rank-other';
              let prizeHtml = '<span style="color: #94A3B8; font-weight: 500;">-</span>';
              
              if (rider.rider_type === 'company') {
                if (rank === 1) {
                  rankClass = 'rank-1';
                  prizeHtml = '<span class="prize-tag prize-1">🥇 75 SAR (1st Prize)</span>';
                } else if (rank === 2) {
                  rankClass = 'rank-2';
                  prizeHtml = '<span class="prize-tag prize-2">🥈 50 SAR (2nd Prize)</span>';
                } else if (rank === 3) {
                  rankClass = 'rank-3';
                  prizeHtml = '<span class="prize-tag prize-3">🥉 25 SAR (3rd Prize)</span>';
                }
              }

              const initials = rider.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

              return `
                <tr style="cursor: pointer;" onclick="SprintsPage.showRiderSprintDetails(${rider.id})" title="Click to view log submissions breakdown">
                  <td>
                    <span class="rank-badge ${rankClass}">${rank}</span>
                  </td>
                  <td>
                    <div class="rider-profile-cell">
                      <div class="rider-avatar">
                        ${rider.photo ? `<img src="${rider.photo}" alt="${rider.name}" />` : initials}
                      </div>
                      <div>
                        <div style="font-weight: 700; color: #1E293B;">${Utils.escapeHtml(rider.name)}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style="font-family: monospace;">${Utils.escapeHtml(rider.mobile)}</span></td>
                  <td>
                    <span style="text-transform: capitalize; font-weight: 600; color: ${rider.rider_type === 'company' ? '#2563EB' : '#64748B'}">
                      ${rider.rider_type}
                    </span>
                  </td>
                  <td style="text-align: right; font-weight: 800; color: #1E293B; font-size: 15px;">
                    ${rider.total_orders}
                  </td>
                  <td style="text-align: right;">${prizeHtml}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  handleSearch(e) {
    this.searchQuery = e.target.value;
    this.renderContent();
  },

  async handleSprintChange(e) {
    this.selectedSprintNumber = parseInt(e.target.value, 10);
    const container = document.getElementById('page-sprints');
    if (container) {
      container.innerHTML = `
        <div class="skeleton" style="height: 300px; border-radius: 12px; margin-bottom: 20px;"></div>
        <div class="skeleton" style="height: 400px; border-radius: 12px;"></div>
      `;
    }
    try {
      await this.loadData();
      this.renderContent();
      this.startCountdown();
    } catch (err) {
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <p>Failed to load sprint data: ${err.message}</p>
            <button class="btn btn-primary" onclick="SprintsPage.render()">Retry</button>
          </div>
        `;
      }
    }
  },

  showRiderSprintDetails(riderId) {
    const rider = (this.sprintData.leaderboard || []).find(r => r.id === riderId);
    if (!rider) return;

    const logs = rider.logs || [];
    const totals = logs.reduce((acc, log) => {
      acc.primary += log.primary_orders || 0;
      acc.associate += log.associate_orders || 0;
      acc.total += log.total_orders || 0;
      return acc;
    }, { primary: 0, associate: 0, total: 0 });

    const tableRowsHtml = logs.length === 0 
      ? `<tr><td colspan="4" style="text-align: center; color: #64748B; padding: 20px;">No daily logs submitted during this sprint range.</td></tr>`
      : logs.map(log => `
          <tr>
            <td style="font-weight: 600;">${Utils.formatDate(log.date)}</td>
            <td style="text-align: right;">${log.primary_orders}</td>
            <td style="text-align: right;">${log.associate_orders}</td>
            <td style="text-align: right; font-weight: 700; color: #1E293B;">${log.total_orders}</td>
          </tr>
        `).join('');

    const html = `
      <style>
        .details-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        .details-table th, .details-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #E2E8F0;
          font-size: 13px;
        }
        .details-table th {
          background: #F8FAFC;
          font-weight: 700;
          color: #475569;
        }
        .details-total-row {
          background: #F8FAFC;
          font-weight: 800;
        }
        .details-total-row td {
          border-bottom: 2px solid #CBD5E1;
        }
      </style>
      <div style="margin-bottom: 16px;">
        <p style="font-size: 14px; color: #475569; margin-bottom: 4px;">Rider: <strong>${Utils.escapeHtml(rider.name)}</strong> (${rider.rider_type})</p>
        <p style="font-size: 13px; color: #64748B;">Mobile: <strong>${Utils.escapeHtml(rider.mobile)}</strong></p>
      </div>
      
      <h3 style="font-size: 14px; font-weight: 700; color: #1E293B; margin-bottom: 8px;">Logged Submissions Breakdown</h3>
      <table class="details-table">
        <thead>
          <tr>
            <th>Date</th>
            <th style="text-align: right;">Primary Orders</th>
            <th style="text-align: right;">Associate Orders</th>
            <th style="text-align: right;">Total Orders</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          ${logs.length > 0 ? `
            <tr class="details-total-row">
              <td>Total Summary</td>
              <td style="text-align: right;">${totals.primary}</td>
              <td style="text-align: right;">${totals.associate}</td>
              <td style="text-align: right; color: #2563EB;">${totals.total}</td>
            </tr>
          ` : ''}
        </tbody>
      </table>
    `;

    Utils.openModal(`Sprint #${this.selectedSprintNumber} Details`, html);
  }
};

window.SprintsPage = SprintsPage;
