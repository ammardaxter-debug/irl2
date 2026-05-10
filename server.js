const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const db = require('./database');
const XLSX = require('xlsx');

const JWT_SECRET = process.env.JWT_SECRET || 'irl-rider-portal-secret-2026';
const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || 'irl-dashboard-secret-2026';

const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting store
const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Dashboard auth users
const DASHBOARD_USERS = [
  { email: 'abdullah@irl.sa', name: 'Abdullah Khan', role: 'admin', password: 'IRL@Admin2026!' },
  { email: 'saad@irl.sa', name: 'Saad', role: 'viewer', password: 'Saad@View2026!' },
  { email: 'firas@irl.sa', name: 'Firas Al Arifi', role: 'viewer', password: 'Firas@View2026!' }
];

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// JWT middleware for rider portal routes
function verifyRiderToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.riderId = decoded.riderId;
    req.riderName = decoded.riderName;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ========== RIDER ROUTES ==========

app.get('/api/riders', async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const riders = await db.getAllRiders(status);
    res.json(riders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/riders/:id', async (req, res) => {
  try {
    const rider = await db.getRiderById(parseInt(req.params.id));
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/riders', async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
    const rider = await db.createRider(req.body);
    res.status(201).json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/riders/:id', async (req, res) => {
  try {
    const rider = await db.updateRider(parseInt(req.params.id), req.body);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/riders/:id/archive', async (req, res) => {
  try {
    const rider = await db.archiveRider(parseInt(req.params.id));
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/riders/:id/hard-delete', async (req, res) => {
  try {
    const success = await db.deleteRiderPermanently(parseInt(req.params.id));
    if (!success) return res.status(404).json({ error: 'Rider not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DAILY LOG ROUTES ==========

app.get('/api/daily-logs', async (req, res) => {
  try {
    const { date, rider_id, start, end } = req.query;
    
    // If rider_id is provided, return all logs for that rider (for bulk lodge)
    if (rider_id) {
      const snapshot = await db.getDb().ref('daily_logs').once('value');
      const results = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const log = child.val();
          if (log.rider_id === parseInt(rider_id)) {
            results.push({ id: parseInt(child.key), ...log });
          }
        });
      }
      return res.json(results);
    }
    
    // If start and end are provided, return logs in that date range
    if (start && end) {
      const snapshot = await db.getDb().ref('daily_logs')
        .orderByChild('log_date')
        .startAt(start)
        .endAt(end)
        .once('value');
      const results = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          results.push({ id: parseInt(child.key), ...child.val() });
        });
      }
      return res.json(results);
    }
    
    const logDate = date || new Date().toISOString().split('T')[0];
    const logs = await db.getDailyLogs(logDate);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-logs/missing', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const missing = await db.getMissingLogs(date);
    res.json(missing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-logs/rider/:id', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const logs = await db.getDailyLogsByRider(parseInt(req.params.id), start, end);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/daily-logs', async (req, res) => {
  try {
    if (!req.body.rider_id || !req.body.log_date) {
      return res.status(400).json({ error: 'rider_id and log_date are required' });
    }
    const log = await db.createDailyLog(req.body);
    res.status(201).json(log);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Log already exists for this rider on this date' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/daily-logs/:id', async (req, res) => {
  try {
    const log = await db.updateDailyLog(parseInt(req.params.id), req.body);
    if (!log) return res.status(404).json({ error: 'Log not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PAYROLL ROUTES ==========

app.get('/api/payroll', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const payroll = await db.calculatePayroll(start, end);
    res.json(payroll);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== BONUS ROUTES ==========

app.get('/api/bonuses', async (req, res) => {
  try {
    const { start, end } = req.query;
    res.json(await db.getBonuses(start, end));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bonuses', async (req, res) => {
  try {
    if (!req.body.rider_id || !req.body.amount) return res.status(400).json({ error: 'rider_id and amount required' });
    res.json(await db.createBonus(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bonuses/:id', async (req, res) => {
  try {
    await db.deleteBonus(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== SALARY ADVANCE ROUTES ==========

app.get('/api/salary-advances', async (req, res) => {
  try {
    const { start, end } = req.query;
    res.json(await db.getAdvances(start, end));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/salary-advances', async (req, res) => {
  try {
    if (!req.body.rider_id || !req.body.amount) return res.status(400).json({ error: 'rider_id and amount required' });
    res.json(await db.createAdvance(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/salary-advances/:id', async (req, res) => {
  try {
    const { status, cycle_start, cycle_end } = req.body;
    await db.updateAdvanceStatus(parseInt(req.params.id), status, cycle_start, cycle_end);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PAYMENT STATUS ROUTES ==========

app.put('/api/payroll/payment-status', async (req, res) => {
  try {
    const { rider_id, cycle_key, status, final_paid_amount, notes, manual_deductions, manual_bonus } = req.body;
    if (!rider_id || !cycle_key || !status) return res.status(400).json({ error: 'rider_id, cycle_key, and status required' });
    res.json(await db.setPaymentStatus(rider_id, cycle_key, status, final_paid_amount, notes, manual_deductions, manual_bonus));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payroll/payment-statuses', async (req, res) => {
  try {
    res.json(await db.getPaymentStatuses(req.query.cycle_key));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== PAYROLL LOCK ROUTES ==========

app.post('/api/payroll/lock', async (req, res) => {
  try {
    const { cycle_key } = req.body;
    if (!cycle_key) return res.status(400).json({ error: 'cycle_key required' });
    await db.lockPayroll(cycle_key);
    res.json({ success: true, locked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payroll/unlock', async (req, res) => {
  try {
    const { cycle_key } = req.body;
    if (!cycle_key) return res.status(400).json({ error: 'cycle_key required' });
    await db.unlockPayroll(cycle_key);
    res.json({ success: true, locked: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payroll/lock-status', async (req, res) => {
  try {
    const locked = await db.isPayrollLocked(req.query.cycle_key);
    res.json({ locked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DASHBOARD ROUTES ==========

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const stats = await db.getDashboardStats(start, end);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== BACKUP ROUTES ==========

// Download database backup (Firebase JSON export)
app.get('/api/backup/download', async (req, res) => {
  try {
    const snapshot = await db.getDb().ref('/').once('value');
    const data = snapshot.val();
    const jsonStr = JSON.stringify(data, null, 2);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="IRL_Firebase_Backup_${timestamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(jsonStr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== EXPENSE TRACKER API ==========

app.get('/api/expenses/stats', async (req, res) => {
  try {
    res.json(await db.getExpenseStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses', async (req, res) => {
  try {
    res.json(await db.getExpenses(req.query.start, req.query.end));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    res.json(await db.createExpense(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    res.json(await db.updateExpense(parseInt(req.params.id), req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id/settle', async (req, res) => {
  try {
    const { settledBy } = req.body;
    if (!settledBy) return res.status(400).json({ error: 'settledBy required' });
    await db.settleExpenseDeduction(parseInt(req.params.id), settledBy);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/settle/rider/:riderId', async (req, res) => {
  try {
    const { settledBy } = req.body;
    if (!settledBy) return res.status(400).json({ error: 'settledBy required' });
    const count = await db.settleRiderDeductions(parseInt(req.params.riderId), settledBy);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await db.deleteExpense(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/funds', async (req, res) => {
  try {
    res.json(await db.getFunds(req.query.start, req.query.end));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/funds', async (req, res) => {
  try {
    res.json(await db.createFund(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/funds/:id', async (req, res) => {
  try {
    res.json(await db.updateFund(parseInt(req.params.id), req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/funds/:id', async (req, res) => {
  try {
    await db.deleteFund(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== CHART DATA ==========

app.get('/api/charts/expense-breakdown', async (req, res) => {
  try {
    const expenses = await db.getExpenses(req.query.start, req.query.end);
    const breakdown = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + (e.amount || 0);
    });
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/charts/daily-orders', async (req, res) => {
  try {
    const { start, end } = req.query;
    const snapshot = await db.getDb().ref('daily_logs').once('value');
    const results = {};
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        const log = child.val();
        const d = log.log_date;
        if (d && (!start || d >= start) && (!end || d <= end)) {
          if (!results[d]) results[d] = 0;
          results[d] += (log.total_orders || 0);
        }
      });
    }
    // Sort by date and return as array
    const sorted = Object.entries(results).sort((a, b) => a[0].localeCompare(b[0]));
    res.json(sorted.map(([date, orders]) => ({ date, orders })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/charts/cashflow', async (req, res) => {
  try {
    const funds = await db.getFunds(req.query.start, req.query.end);
    const expenses = await db.getExpenses(req.query.start, req.query.end);
    
    // Group by month
    const monthly = {};
    funds.forEach(f => {
      const month = (f.receive_date || '').substring(0, 7);
      if (!month) return;
      if (!monthly[month]) monthly[month] = { received: 0, spent: 0 };
      monthly[month].received += (f.amount || 0);
    });
    expenses.forEach(e => {
      const month = (e.expense_date || '').substring(0, 7);
      if (!month) return;
      if (!monthly[month]) monthly[month] = { received: 0, spent: 0 };
      monthly[month].spent += (e.amount || 0);
    });
    
    const sorted = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0]));
    res.json(sorted.map(([month, data]) => ({ month, ...data })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== FLEET MANAGEMENT (BIKES) ==========

app.get('/api/bikes', async (req, res) => {
  try {
    res.json(await db.getAllBikes());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bikes', async (req, res) => {
  try {
    res.json(await db.createBike(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bikes/:id', async (req, res) => {
  try {
    const bike = await db.updateBike(parseInt(req.params.id), req.body);
    if (!bike) return res.status(404).json({ error: 'Bike not found' });
    res.json(bike);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bikes/:id', async (req, res) => {
  try {
    await db.deleteBike(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== AUDIT LOGS ==========
app.get('/api/audit-logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    res.json(await db.getAuditLogs(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== BACKUPS ==========

app.get('/api/backup/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db') || f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stat.size,
          created: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== MIGRATION ROUTE ==========

app.post('/api/migrate', async (req, res) => {
  try {
    const result = await db.migrateFromSQLite();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export all data as Excel (from Firebase)
app.get('/api/backup/export-xlsx', async (req, res) => {
  try {
    const riders = await db.getAllRiders();
    const expenses = await db.getExpenses();
    const funds = await db.getFunds();

    // Get all daily logs
    const allLogsSnap = await db.getDb().ref('daily_logs').once('value');
    const logs = [];
    if (allLogsSnap.exists()) {
      allLogsSnap.forEach(child => {
        logs.push({ id: parseInt(child.key), ...child.val() });
      });
    }
    // Enrich logs with rider names
    const riderMap = {};
    for (const r of riders) { riderMap[r.id] = r.name; }
    for (const l of logs) { l.rider_name = riderMap[l.rider_id] || 'Unknown'; }
    logs.sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));

    const wb = XLSX.utils.book_new();

    const ws_riders = XLSX.utils.json_to_sheet(riders);
    XLSX.utils.book_append_sheet(wb, ws_riders, "Riders");

    const ws_logs = XLSX.utils.json_to_sheet(logs);
    XLSX.utils.book_append_sheet(wb, ws_logs, "Daily Logs");

    const ws_expenses = XLSX.utils.json_to_sheet(expenses);
    XLSX.utils.book_append_sheet(wb, ws_expenses, "Expenses");

    const ws_funds = XLSX.utils.json_to_sheet(funds);
    XLSX.utils.book_append_sheet(wb, ws_funds, "Funds Received");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="IRL_Data_Backup_' + new Date().toISOString().split('T')[0] + '.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Proxy Endpoint
app.post('/api/download-pdf', (req, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).send('Missing file data');
    }
    const buffer = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('PDF proxy error:', err);
    res.status(500).send('Error generating PDF download');
  }
});

// ========== SETTINGS (Supervisor Profile) ==========

app.get('/api/settings', async (req, res) => {
  try {
    const snapshot = await db.getDb().ref('settings').once('value');
    res.json(snapshot.val() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    
    // Replace dots with slashes for nested keys, or just use as path
    await db.getDb().ref(`settings/${key.replace(/\./g, '/')}`).set(value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== WARNING MESSAGE STATUS ==========

app.get('/api/warning-message-status', async (req, res) => {
  try {
    const { cycle_key } = req.query;
    if (!cycle_key) return res.status(400).json({ error: 'cycle_key required' });
    const snapshot = await db.getDb().ref(`warning_message_status/${cycle_key}`).once('value');
    res.json(snapshot.val() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/warning-message-status', async (req, res) => {
  try {
    const { rider_id, cycle_key } = req.body;
    if (!rider_id || !cycle_key) return res.status(400).json({ error: 'rider_id and cycle_key required' });
    await db.getDb().ref(`warning_message_status/${cycle_key}/${rider_id}`).set({
      sent: true,
      sent_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== RIDER PORTAL API ==========

// Login
app.post('/api/rider/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });
    const rider = await db.authenticateRider(phone, password);
    if (!rider) return res.status(401).json({ error: 'Invalid phone number or password' });
    const token = jwt.sign(
      { riderId: rider.id, riderName: rider.name },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ token, rider });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get own profile
app.get('/api/rider/me', verifyRiderToken, async (req, res) => {
  try {
    const rider = await db.getRiderById(req.riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const { portal_password, ...safeRider } = rider;
    res.json(safeRider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update own profile (limited fields)
app.put('/api/rider/me', verifyRiderToken, async (req, res) => {
  try {
    const updated = await db.updateRiderSelfService(req.riderId, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get own daily logs
app.get('/api/rider/my-logs', verifyRiderToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const logs = await db.getDailyLogsByRider(req.riderId, start, end);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit own daily log
app.post('/api/rider/my-logs', verifyRiderToken, async (req, res) => {
  try {
    const rider = await db.getRiderById(req.riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const data = {
      ...req.body,
      rider_id: parseInt(req.riderId),
      rider_name: rider.name,
      rider_type: rider.rider_type,
      submitted_by: 'rider_portal'
    };
    if (!data.log_date) return res.status(400).json({ error: 'log_date required' });
    
    const existingLogs = await db.getDailyLogsByRider(req.riderId, data.log_date, data.log_date);
    if (existingLogs && existingLogs.length > 0) {
      const existing = existingLogs[0];
      const createdDate = new Date(existing.created_at || new Date().toISOString());
      const now = new Date();
      const diffHours = (now - createdDate) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        return res.status(403).json({ error: 'You can only edit logs within 24 hours of submission.' });
      }
      
      const updatedLog = await db.updateDailyLog(existing.id, data);
      return res.json(updatedLog);
    }
    
    const log = await db.createDailyLog(data);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get monthly report
app.get('/api/rider/my-report', verifyRiderToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const report = await db.getRiderMonthlyReport(req.riderId, start, end);
    if (!report) return res.status(404).json({ error: 'Rider not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change password
app.put('/api/rider/change-password', verifyRiderToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required' });
    if (new_password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    // Verify current password
    const rider = await db.getRiderById(req.riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const bcrypt = require('bcryptjs');
    const match = await bcrypt.compare(current_password, rider.portal_password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    await db.setRiderPassword(req.riderId, new_password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: set rider portal password
app.put('/api/riders/:id/set-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    await db.setRiderPassword(parseInt(req.params.id), password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Company Logo Settings
app.get('/api/settings/logo', async (req, res) => {
  try {
    const snap = await db.getDb().ref('settings/company_logo').once('value');
    res.json({ logo: snap.val() || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/logo', async (req, res) => {
  try {
    const { logo } = req.body;
    await db.getDb().ref('settings/company_logo').set(logo);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== DASHBOARD AUTHENTICATION ==========

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const key = email.toLowerCase();

    // Check rate limiting
    const attempts = loginAttempts[key];
    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({ error: 'Account temporarily locked', lockout_seconds: remaining });
    }

    // Find user in Firebase
    const snap = await db.getDb().ref(`auth_users/${key.replace(/\./g, '_dot_')}`).once('value');
    const user = snap.val();

    if (!user) {
      trackFailedAttempt(key);
      const rem = MAX_ATTEMPTS - (loginAttempts[key]?.count || 0);
      return res.status(401).json({ error: 'Invalid email or password', remaining_attempts: rem });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      trackFailedAttempt(key);
      const rem = MAX_ATTEMPTS - (loginAttempts[key]?.count || 0);
      if (rem <= 0) {
        return res.status(429).json({ error: 'Account temporarily locked', lockout_seconds: Math.ceil(LOCKOUT_MS / 1000) });
      }
      return res.status(401).json({ error: 'Invalid email or password', remaining_attempts: rem });
    }

    // Success — clear attempts
    delete loginAttempts[key];

    const token = jwt.sign(
      { email: user.email, name: user.name, role: user.role },
      DASHBOARD_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('irl_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ success: true, user: { name: user.name, email: user.email, role: user.role }, redirect: '/' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Session check
app.get('/api/auth/session', (req, res) => {
  const token = req.cookies?.irl_session;
  if (!token) return res.json({ user: null });
  try {
    const decoded = jwt.verify(token, DASHBOARD_SECRET);
    res.json({ user: { name: decoded.name, email: decoded.email, role: decoded.role } });
  } catch (err) {
    res.clearCookie('irl_session');
    res.json({ user: null });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('irl_session');
  res.json({ success: true });
});

function trackFailedAttempt(key) {
  if (!loginAttempts[key]) loginAttempts[key] = { count: 0 };
  loginAttempts[key].count++;
  if (loginAttempts[key].count >= MAX_ATTEMPTS) {
    loginAttempts[key].lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

// Catch-all: serve appropriate index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/rider')) {
    return res.sendFile(path.join(__dirname, 'public', 'rider', 'index.html'));
  }
  if (req.path === '/login' || req.path === '/login.html') {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
  // For all other routes, check session — redirect to login if not authenticated
  const token = req.cookies?.irl_session;
  if (!token) {
    return res.redirect('/login');
  }
  try {
    jwt.verify(token, DASHBOARD_SECRET);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    res.clearCookie('irl_session');
    res.redirect('/login');
  }
});

// ========== SEED AUTH USERS ==========
async function seedAuthUsers() {
  for (const u of DASHBOARD_USERS) {
    const key = u.email.replace(/\./g, '_dot_');
    const snap = await db.getDb().ref(`auth_users/${key}`).once('value');
    if (!snap.exists()) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.getDb().ref(`auth_users/${key}`).set({
        email: u.email,
        name: u.name,
        role: u.role,
        password_hash: hash,
        created_at: new Date().toISOString()
      });
      console.log(`  👤 Auth user seeded: ${u.email} (${u.role})`);
    }
  }
}

// Initialize DB then start server
async function start() {
  try {
    await db.initDb();
    console.log('  ✅ Database initialized (Firebase)');

    // Seed dashboard auth users
    await seedAuthUsers();
    console.log('  🔐 Dashboard auth users ready');

    // Auto-migrate from SQLite if Firebase is empty
    const checkSnap = await db.getDb().ref('riders').once('value');
    if (!checkSnap.exists() || checkSnap.numChildren() === 0) {
      console.log('  📦 Firebase is empty — attempting auto-migration from SQLite...');
      try {
        const result = await db.migrateFromSQLite();
        if (result.migrated) {
          console.log(`  🎉 Auto-migration complete: ${result.total} records moved to Firebase`);
        }
      } catch (migErr) {
        console.log('  ⚠️ Auto-migration skipped:', migErr.message);
      }
    } else {
      console.log(`  📊 Firebase has data (${checkSnap.numChildren()} riders)`);
    }

    app.listen(PORT, () => {
      console.log(`\n  🚀 Inspiring Roads Logistics Server`);
      console.log(`  ────────────────────────────────────`);
      console.log(`  → Running at http://localhost:${PORT}`);
      console.log(`  → Login: http://localhost:${PORT}/login`);
      console.log(`  → Database: Firebase Realtime Database ☁️\n`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
