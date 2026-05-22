// ========================================
//  SYSTEM & BACKUPS - Excel Export, Firebase, & Audit Logs
// ========================================

const Backup = {
  async render() {
    const root = document.getElementById('page-backup');
    if (!root) return;

    root.innerHTML = `<div class="p-8"><div class="spinner"></div></div>`;

    try {
      const auditLogs = await API.getAuditLogs(100);
      root.innerHTML = this.buildHTML(auditLogs);
    } catch (err) {
      Utils.showToast(err.message, 'error');
      root.innerHTML = `<div class="p-8"><p style="color:var(--danger)">Failed to load data: ${err.message}</p></div>`;
    }
  },

  buildHTML(auditLogs) {
    return `
      <div class="page-header">
        <h1 class="page-title">System & Security</h1>
      </div>

      <div class="dashboard-grid" style="grid-template-columns: 1fr 1fr; gap: 24px;">
        <!-- Excel Export Section -->
        <div class="card section-card" style="animation: slideUp 300ms ease both;">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Excel Export (Data Backup)
            </h2>
          </div>
          <p class="text-secondary mb-24">Download all current records (Riders, Logs, Expenses, Funds) into a single Excel file for review or external backup.</p>
          ${App.isViewer() ? '<p style="color:var(--warning-600); font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Viewer Role: Download Restricted</p>' : `
          <button class="btn btn-primary" onclick="API.exportExcel(); Utils.showToast('Excel export started', 'success');">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Excel (.xlsx)
          </button>
          `}
        </div>

        <!-- Firebase Backup Section -->
        <div class="card section-card" style="animation: slideUp 300ms ease both; animation-delay: 100ms;">
          <div class="section-header">
            <h2 class="section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Cloud Database Snapshot
            </h2>
          </div>
          <p class="text-secondary mb-24">Create a raw JSON database backup of your Firebase Realtime DB. Useful for total system disaster recovery.</p>
          ${App.isViewer() ? '<p style="color:var(--warning-600); font-weight:600; font-size:13px; display:flex; align-items:center; gap:6px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Viewer Role: Backup Restricted</p>' : `
          <button class="btn btn-outline" onclick="API.downloadBackup(); Utils.showToast('Database backup started', 'success');">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download JSON Snapshot
          </button>
          `}
        </div>
      </div>

      <!-- Audit History Logs -->
      <div class="card section-card mt-24" style="animation: slideUp 300ms ease both; animation-delay: 200ms;">
        <div class="section-header">
          <h2 class="section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            System Action Audit Log (Last 100)
          </h2>
        </div>
        <div class="table-container pt-8" style="max-height: 400px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User / Trigger</th>
                <th>Entity / Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${auditLogs.map(l => {
                const actionBadge = l.action === 'CREATE' ? 'badge-success' : l.action === 'UPDATE' ? 'badge-company' : l.action === 'DELETE' ? 'badge-danger' : 'badge-warning';
                
                return `
                <tr>
                  <td><strong style="color:var(--text-secondary)">${new Date(l.timestamp).toLocaleString()}</strong></td>
                  <td>${Utils.escapeHtml(l.user || 'Unknown')}</td>
                  <td>
                    <span class="badge ${actionBadge}" style="margin-right: 8px;">${l.action}</span>
                    <span style="font-weight: 600; font-size: 13px;">${Utils.escapeHtml(l.entity)}</span>
                  </td>
                  <td style="color:var(--text-secondary)">${Utils.escapeHtml(l.description)}</td>
                </tr>
              `}).join('')}
              ${auditLogs.length === 0 ? '<tr><td colspan="4" class="text-center p-24 text-tertiary">No audit logs found.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};
