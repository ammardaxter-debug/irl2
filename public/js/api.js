// ========================================
//  API Client - All server communication
// ========================================

const API = {
  BASE: '/api',

  async request(url, options = {}) {
    try {
      const res = await fetch(this.BASE + url, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        ...options
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
          throw new Error('Server backend is out of sync. Please restart your terminal with "node server.js"');
        }
        throw new Error(`Server connection error: ${res.status}`);
      }

      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // ── Riders ──
  getRiders(status = 'active') {
    return this.request(`/riders?status=${status}`);
  },

  getRider(id) {
    return this.request(`/riders/${id}`);
  },

  createRider(data) {
    return this.request('/riders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateRider(id, data) {
    return this.request(`/riders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteRiderPermanently(id) {
    return this.request(`/riders/${id}/hard-delete`, {
      method: 'DELETE'
    });
  },

  archiveRider(id) {
    return this.request(`/riders/${id}/archive`, {
      method: 'PUT'
    });
  },

  // ── Fleet Management (Bikes) ──
  getBikes() {
    return this.request('/bikes');
  },

  createBike(data) {
    return this.request('/bikes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateBike(id, data) {
    return this.request(`/bikes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteBike(id) {
    return this.request(`/bikes/${id}`, {
      method: 'DELETE'
    });
  },

  // ── Daily Logs ──
  getDailyLogs(date) {
    return this.request(`/daily-logs?date=${date}`);
  },

  getMissingLogs(date) {
    return this.request(`/daily-logs/missing?date=${date}`);
  },

  getRiderLogs(riderId, start, end) {
    return this.request(`/daily-logs/rider/${riderId}?start=${start}&end=${end}`);
  },

  createDailyLog(data) {
    return this.request('/daily-logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateDailyLog(id, data) {
    return this.request(`/daily-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteDailyLog(id) {
    return this.request(`/daily-logs/${id}`, {
      method: 'DELETE'
    });
  },

  // ── Payroll ──
  getPayroll(start, end) {
    return this.request(`/payroll?start=${start}&end=${end}`);
  },

  // ── Dashboard ──
  getDashboardStats(start, end) {
    return this.request(`/dashboard/stats?start=${start}&end=${end}`);
  },

  // ── Charts ──
  getExpenseBreakdown(start, end) {
    let url = '/charts/expense-breakdown';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  getDailyOrdersChart(start, end) {
    let url = '/charts/daily-orders';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  getCashflow(start, end) {
    let url = '/charts/cashflow';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  // ── Backup ──
  downloadBackup() {
    window.location.href = this.BASE + '/backup/download';
  },

  exportExcel() {
    window.location.href = this.BASE + '/backup/export-xlsx';
  },

  getBackupList() {
    return this.request('/backup/list');
  },

  restoreBackup(name) {
    return this.request(`/backup/restore/${name}`, { method: 'POST' });
  },

  // ── Audit Logs ──
  getAuditLogs(limit = 100) {
    return this.request(`/audit-logs?limit=${limit}`);
  },

  // ── Expenses & Funds ──
  getExpenseStats() {
    return this.request('/expenses/stats');
  },

  getExpenses(start, end) {
    let url = '/expenses';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  createExpense(data) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateExpense(id, data) {
    return this.request(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteExpense(id) {
    return this.request(`/expenses/${id}`, { method: 'DELETE' });
  },

  settleExpenseDeduction(id, settledBy) {
    return this.request(`/expenses/${id}/settle`, {
      method: 'PUT',
      body: JSON.stringify({ settledBy })
    });
  },

  settleRiderDeductions(riderId, settledBy) {
    return this.request(`/expenses/settle/rider/${riderId}`, {
      method: 'PUT',
      body: JSON.stringify({ settledBy })
    });
  },

  getFunds(start, end) {
    let url = '/funds';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  createFund(data) {
    return this.request('/funds', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateFund(id, data) {
    return this.request(`/funds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteFund(id) {
    return this.request(`/funds/${id}`, { method: 'DELETE' });
  },

  // ── Bonuses ──
  getBonuses(start, end) {
    let url = '/bonuses';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  createBonus(data) {
    return this.request('/bonuses', { method: 'POST', body: JSON.stringify(data) });
  },

  deleteBonus(id) {
    return this.request(`/bonuses/${id}`, { method: 'DELETE' });
  },

  // ── Salary Advances ──
  getAdvances(start, end) {
    let url = '/salary-advances';
    if (start && end) url += `?start=${start}&end=${end}`;
    return this.request(url);
  },

  createAdvance(data) {
    return this.request('/salary-advances', { method: 'POST', body: JSON.stringify(data) });
  },

  updateAdvanceStatus(id, status, cycleStart, cycleEnd) {
    return this.request(`/salary-advances/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, cycle_start: cycleStart, cycle_end: cycleEnd })
    });
  },

  // ── Payment Status ──
  setPaymentStatus(riderId, cycleKey, status, finalPaidAmount, notes, manualDeductions, manualBonus) {
    return this.request('/payroll/payment-status', {
      method: 'PUT',
      body: JSON.stringify({ rider_id: riderId, cycle_key: cycleKey, status, final_paid_amount: finalPaidAmount, notes, manual_deductions: manualDeductions, manual_bonus: manualBonus })
    });
  },

  getPaymentStatuses(cycleKey) {
    return this.request(`/payroll/payment-statuses?cycle_key=${cycleKey}`);
  },

  // ── Payroll Lock ──
  lockPayroll(cycleKey) {
    return this.request('/payroll/lock', { method: 'POST', body: JSON.stringify({ cycle_key: cycleKey }) });
  },

  unlockPayroll(cycleKey) {
    return this.request('/payroll/unlock', { method: 'POST', body: JSON.stringify({ cycle_key: cycleKey }) });
  },

  getPayrollLockStatus(cycleKey) {
    return this.request(`/payroll/lock-status?cycle_key=${cycleKey}`);
  },

  // ── Warning Message Status ──
  getWarningMessageStatus(cycleKey) {
    return this.request(`/warning-message-status?cycle_key=${cycleKey}`);
  },

  setWarningMessageSent(riderId, cycleKey) {
    return this.request('/warning-message-status', {
      method: 'PUT',
      body: JSON.stringify({ rider_id: riderId, cycle_key: cycleKey })
    });
  },

  // ── Rider Requests ──
  getRiderRequests(status = 'pending') {
    return this.request(`/admin/rider-requests?status=${status}`);
  },

  updateRiderRequestStatus(id, status, adminNote) {
    return this.request(`/admin/rider-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, admin_note: adminNote })
    });
  },

  // ── Rider Compliance & Alerts ──
  getRidersCompliance(date) {
    let url = '/admin/riders-compliance';
    if (date) url += `?date=${date}`;
    return this.request(url);
  },

  sendRiderNotification(riderIds, title, message) {
    return this.request('/admin/send-notification', {
      method: 'POST',
      body: JSON.stringify({ rider_ids: riderIds, title, message })
    });
  }
};
