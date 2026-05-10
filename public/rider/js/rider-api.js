// ========================================
//  Rider Portal — API Layer
// ========================================

const RiderAPI = {
  BASE: '/api/rider',

  getToken() { return localStorage.getItem('irl_rider_token'); },
  setToken(t) { localStorage.setItem('irl_rider_token', t); },
  clearToken() { localStorage.removeItem('irl_rider_token'); localStorage.removeItem('irl_rider_data'); },
  isLoggedIn() { return !!this.getToken(); },

  getCachedRider() {
    try { return JSON.parse(localStorage.getItem('irl_rider_data')); } catch { return null; }
  },
  setCachedRider(r) { localStorage.setItem('irl_rider_data', JSON.stringify(r)); },

  async request(endpoint, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this.BASE + endpoint, opts);
    if (res.status === 401 && endpoint !== '/login') {
      this.clearToken();
      if (typeof RiderApp !== 'undefined') RiderApp.navigate('login');
      throw new Error('Session expired. Please login again.');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async login(phone, password) {
    const data = await this.request('/login', 'POST', { phone, password });
    this.setToken(data.token);
    this.setCachedRider(data.rider);
    return data.rider;
  },

  logout() {
    this.clearToken();
    if (typeof RiderApp !== 'undefined') RiderApp.navigate('login');
  },

  async getProfile() {
    const r = await this.request('/me');
    this.setCachedRider(r);
    return r;
  },

  async updateProfile(data) {
    const r = await this.request('/me', 'PUT', data);
    this.setCachedRider(r);
    return r;
  },

  async getMyLogs(start, end) {
    return await this.request(`/my-logs?start=${start}&end=${end}`);
  },

  async submitLog(data) {
    return await this.request('/my-logs', 'POST', data);
  },

  async getMonthlyReport(start, end) {
    return await this.request(`/my-report?start=${start}&end=${end}`);
  },

  async changePassword(current_password, new_password) {
    return await this.request('/change-password', 'PUT', { current_password, new_password });
  }
};
