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

// Dashboard auth gate — runs BEFORE static files are served
app.use((req, res, next) => {
  // Allow these paths without auth
  const isPublic =
    req.path === '/login' || req.path === '/login.html' ||
    req.path.startsWith('/css/login') || req.path.startsWith('/js/login') ||
    req.path.startsWith('/rider') || req.path.startsWith('/api/rider') ||
    req.path.startsWith('/api/auth');

  if (isPublic) return next();

  // Protect root dashboard and its assets
  if (req.path === '/' || req.path === '/index.html') {
    const token = req.cookies?.irl_session;
    if (!token) return res.redirect('/login');
    try {
      jwt.verify(token, DASHBOARD_SECRET);
      return next();
    } catch (err) {
      res.clearCookie('irl_session');
      return res.redirect('/login');
    }
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));
const sessionCache = new Map();

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
    req.sessionToken = decoded.sessionToken || null;
    
    // Skip session validation for high-frequency endpoints (location updates)
    const skipPaths = ['/api/rider/location', '/api/rider/gps-status', '/api/rider/location/batch', '/api/rider/heartbeat'];
    if (skipPaths.includes(req.path)) {
      return next();
    }
    
    // Validate session token against database for single-device enforcement
    if (req.sessionToken) {
      const cacheKey = `${decoded.riderId}`;
      const now = Date.now();
      
      if (sessionCache.has(cacheKey)) {
        const cached = sessionCache.get(cacheKey);
        if (now - cached.time < 60000) { // 60 seconds cache
          if (cached.token && cached.token !== req.sessionToken) {
            return res.status(401).json({ 
              error: 'Your account has been logged in on another device. Please log in again.',
              code: 'SESSION_INVALIDATED'
            });
          }
          return next();
        }
      }

      db.getRiderById(decoded.riderId).then(rider => {
        if (rider) {
          sessionCache.set(cacheKey, { token: rider.session_token, time: now });
        }
        if (rider && rider.session_token && rider.session_token !== req.sessionToken) {
          return res.status(401).json({ 
            error: 'Your account has been logged in on another device. Please log in again.',
            code: 'SESSION_INVALIDATED'
          });
        }
        next();
      }).catch(err => {
        console.error('Session validation error:', err);
        res.status(500).json({ error: 'Session validation failed' });
      });
    } else {
      // Legacy tokens without session_token — allow through
      next();
    }
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// JWT middleware for admin dashboard API
function verifyAdminToken(req, res, next) {
  const token = req.cookies?.irl_session;
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });
  try {
    const decoded = jwt.verify(token, DASHBOARD_SECRET);
    req.adminName = decoded.name;
    req.adminRole = decoded.role;
    req.adminEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired admin session' });
  }
}

// Middleware to restrict write operations to admin-only (blocks viewers)
function requireAdmin(req, res, next) {
  if (req.adminRole === 'viewer') {
    return res.status(403).json({ error: 'Insufficient permissions. Admin access required.' });
  }
  next();
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

app.post('/api/riders', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
    const rider = await db.createRider(req.body);
    
    // Sync bike assignment if bike_id provided
    if (req.body.bike_id) {
      try {
        await db.updateBike(req.body.bike_id, { assigned_rider_id: String(rider.id), assigned_rider_name: rider.name });
      } catch (err) {
        console.error('Failed to sync bike assignment on create:', err);
      }
    }

    res.status(201).json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/riders/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const riderId = parseInt(req.params.id);
    const oldRider = await db.getRiderById(riderId);
    const rider = await db.updateRider(riderId, req.body);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    // Sync bike assignment if bike_id changed
    if (req.body.bike_id !== undefined && String(oldRider?.bike_id) !== String(req.body.bike_id)) {
      try {
        // Clear old bike assignment
        if (oldRider?.bike_id) {
          await db.updateBike(oldRider.bike_id, { assigned_rider_id: null, assigned_rider_name: null });
        }
        // Set new bike assignment
        if (req.body.bike_id) {
          await db.updateBike(req.body.bike_id, { assigned_rider_id: String(riderId), assigned_rider_name: rider.name });
        }
      } catch (err) {
        console.error('Failed to sync bike assignment:', err);
      }
    }

    res.json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/riders/:id/archive', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const rider = await db.archiveRider(parseInt(req.params.id));
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    res.json(rider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/riders/:id/hard-delete', verifyAdminToken, requireAdmin, async (req, res) => {
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
    const { date, rider_id, start, end, page, limit, search } = req.query;
    
    if (rider_id) {
      const logs = await db.getDailyLogsByRider(parseInt(rider_id), start, end);
      return res.json(logs);
    }
    
    if (start && end) {
      const data = await db.getDailyLogs(start, end);
      return res.json(data || []);
    }

    const logDate = date || new Date().toISOString().split('T')[0];

    if (page || limit) {
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      const searchQuery = search || '';

      const { logs, total } = await db.getDailyLogsPaginated(logDate, limitNum, offset, searchQuery);
      return res.json({ logs, total, page: pageNum, limit: limitNum });
    }

    const logs = await db.getDailyLogs(logDate, logDate);
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

app.post('/api/daily-logs', verifyAdminToken, requireAdmin, async (req, res) => {
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

app.put('/api/daily-logs/:id', verifyAdminToken, requireAdmin, async (req, res) => {
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
    const rawPayroll = await db.calculatePayroll(start, end);
    
    // Flatten payment_status object into top-level fields for frontend
    const payroll = rawPayroll.map(r => {
      const ps = r.payment_status || {};
      const totalSalary = (r.calculated_salary || 0) + (r.total_bonuses || 0);
      return {
        ...r,
        payment_status: ps.status || 'pending',
        final_paid_amount: ps.final_paid_amount ?? null,
        manual_deductions: ps.manual_deductions || 0,
        manual_bonus: ps.manual_bonus || 0,
        advance_deducted: ps.advance_deducted || 0,
        cod_settled: ps.cod_settled || 0,
        other_deductions: ps.other_deductions || 0,
        notes: ps.notes || '',
        total_salary: totalSalary,
        bonuses: r.total_bonuses || 0,
      };
    });
    
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

app.post('/api/bonuses', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    if (!req.body.rider_id || !req.body.amount) return res.status(400).json({ error: 'rider_id and amount required' });
    res.json(await db.createBonus(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bonuses/:id', verifyAdminToken, requireAdmin, async (req, res) => {
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

app.post('/api/salary-advances', verifyAdminToken, requireAdmin, async (req, res) => {
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

app.put('/api/payroll/payment-status', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { rider_id, cycle_key, status, final_paid_amount, notes, manual_deductions, manual_bonus, advance_deducted, cod_settled, other_deductions } = req.body;
    if (!rider_id || !cycle_key || !status) return res.status(400).json({ error: 'rider_id, cycle_key, and status required' });
    res.json(await db.setPaymentStatus(rider_id, cycle_key, status, final_paid_amount, notes, manual_deductions, manual_bonus, advance_deducted, cod_settled, other_deductions));
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

app.post('/api/payroll/lock', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { cycle_key } = req.body;
    if (!cycle_key) return res.status(400).json({ error: 'cycle_key required' });
    await db.lockPayroll(cycle_key);
    res.json({ success: true, locked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payroll/unlock', verifyAdminToken, requireAdmin, async (req, res) => {
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

// ========== CYCLE TRANSFERS (Company Income Ledger) ==========

app.get('/api/payroll/cycle-transfers', async (req, res) => {
  try {
    const { cycle_key } = req.query;
    if (!cycle_key) return res.status(400).json({ error: 'cycle_key required' });
    const data = await db.getCycleTransfers(cycle_key);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payroll/cycle-transfers', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { cycle_key, amount, description } = req.body;
    if (!cycle_key || amount === undefined) return res.status(400).json({ error: 'cycle_key and amount required' });
    const data = await db.addCycleTransfer(cycle_key, Number(amount), description);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payroll/cycle-transfers/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    await db.deleteCycleTransfer(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payroll/delete-rider-cycle', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { rider_id, start, end } = req.body;
    if (!rider_id || !start || !end) {
      return res.status(400).json({ error: 'rider_id, start, and end dates are required' });
    }

    const cycleKey = `${start}_${end}`;
    const locked = await db.isPayrollLocked(cycleKey);
    if (locked) {
      return res.status(400).json({ error: 'Cannot delete rider cycle logs because this payroll cycle is locked.' });
    }

    // Call the database function to delete cycle logs and payment status override
    await db.deleteRiderCycleLogs(rider_id, start, end);

    // Audit logging
    let adminUser = 'Admin';
    if (req.cookies?.irl_session) {
      try {
        const decoded = jwt.verify(req.cookies.irl_session, DASHBOARD_SECRET);
        adminUser = decoded.name || 'Admin';
      } catch (err) {
        // Fallback to 'Admin'
      }
    }

    await db.logAudit(
      'DELETE',
      'Rider Cycle Logs',
      `Deleted all cycle logs and payment overrides for rider ID ${rider_id} from ${start} to ${end}`,
      adminUser
    );

    res.json({ success: true });
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

// Download database backup (Supabase JSON export)
app.get('/api/backup/download', async (req, res) => {
  try {
    const riders = await db.getAllRiders();
    const expenses = await db.getExpenses();
    const funds = await db.getFunds();
    const data = { riders, expenses, funds };
    const jsonStr = JSON.stringify(data, null, 2);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="IRL_Supabase_Backup_${timestamp}.json"`);
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

app.post('/api/expenses', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.createExpense(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.updateExpense(parseInt(req.params.id), req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/:id/settle', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { settledBy, amountPaid } = req.body;
    if (!settledBy) return res.status(400).json({ error: 'settledBy required' });
    await db.settleExpenseDeduction(parseInt(req.params.id), settledBy, amountPaid || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/expenses/settle/rider/:riderId', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { settledBy, riderName } = req.body;
    if (!settledBy) return res.status(400).json({ error: 'settledBy required' });
    let rId = parseInt(req.params.riderId);
    if (isNaN(rId)) rId = null;
    const count = await db.settleRiderDeductions(rId, settledBy, riderName);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', verifyAdminToken, requireAdmin, async (req, res) => {
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

app.post('/api/funds', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.createFund(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/funds/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.updateFund(parseInt(req.params.id), req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/funds/:id', verifyAdminToken, requireAdmin, async (req, res) => {
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
    const logs = await db.getDailyLogs(start, end);
    const results = {};
    logs.forEach(log => {
      const d = log.log_date;
      if (d) {
        if (!results[d]) results[d] = 0;
        results[d] += (log.primary_orders || 0) + (log.associate_orders || 0);
      }
    });
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

app.post('/api/bikes', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    res.json(await db.createBike(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bikes/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const bike = await db.updateBike(parseInt(req.params.id), req.body);
    if (!bike) return res.status(404).json({ error: 'Bike not found' });
    res.json(bike);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bikes/:id', verifyAdminToken, requireAdmin, async (req, res) => {
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
    const logs = await db.getDailyLogs();

    // Enrich logs with rider names
    const riderMap = {};
    for (const r of riders) { riderMap[r.id] = r.name; }
    for (const l of logs) { l.rider_name = l.rider_name || riderMap[l.rider_id] || 'Unknown'; }
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
    const settings = await db.getSettings('settings');
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    await db.updateSettings(key, value);
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
    const allStatuses = await db.getSettings(`warning_msg_${cycle_key}`);
    res.json(allStatuses || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/warning-message-status', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { rider_id, cycle_key } = req.body;
    if (!rider_id || !cycle_key) return res.status(400).json({ error: 'rider_id and cycle_key required' });
    const existing = await db.getSettings(`warning_msg_${cycle_key}`) || {};
    existing[rider_id] = { sent: true, sent_at: new Date().toISOString() };
    await db.updateSettings(`warning_msg_${cycle_key}`, existing);
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
      { riderId: rider.id, riderName: rider.name, sessionToken: rider.session_token },
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
    
    // Attach assigned bike if exists
    if (safeRider.bike_id) {
      try {
        const bikes = await db.getAllBikes();
        const bike = bikes.find(b => String(b.id) === String(safeRider.bike_id));
        if (bike) {
          bike.authorization_expiry = bike.istimara_expiry;
          bike.auth_expiry = bike.istimara_expiry;
          safeRider.bike = bike;
        }
      } catch (err) {
        console.error('Error fetching bike for rider', err);
      }
    }

    res.json(safeRider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update own profile (limited fields)
app.put('/api/rider/me', verifyRiderToken, async (req, res) => {
  try {
    const updated = await db.updateRiderSelfService(req.riderId, req.body);
    if (updated.bike_id) {
      try {
        const bikes = await db.getAllBikes();
        const bike = bikes.find(b => String(b.id) === String(updated.bike_id));
        if (bike) {
           bike.authorization_expiry = bike.istimara_expiry;
           bike.auth_expiry = bike.istimara_expiry;
           updated.bike = bike;
        }
      } catch (err) {
        console.error('Error fetching bike for rider on update', err);
      }
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete daily log
app.delete('/api/daily-logs/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    await db.deleteDailyLog(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete own daily log (within 24 hours)
app.delete('/api/rider/my-logs/:id', verifyRiderToken, async (req, res) => {
  try {
    const supabase = db.getDb();
    const { data: log, error: fetchError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (fetchError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (log.rider_id !== parseInt(req.riderId)) {
      return res.status(403).json({ error: 'You can only delete your own daily logs.' });
    }

    const createdDate = new Date(log.created_at || new Date().toISOString());
    const now = new Date();
    const diffHours = (now - createdDate) / (1000 * 60 * 60);

    if (diffHours > 24) {
      return res.status(403).json({ error: 'You can only delete logs within 24 hours of submission.' });
    }

    await db.deleteDailyLog(req.params.id);
    res.json({ success: true });
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
      
      // 24h lock only applies when EDITING an existing log
      if (diffHours > 24) {
        return res.status(403).json({ error: 'You can only edit logs within 24 hours of submission.' });
      }
      
      const updatedLog = await db.updateDailyLog(existing.id, data);
      return res.json(updatedLog);
    }
    
    // New log for a past date (missing day) — always allowed
    const log = await db.createDailyLog(data);
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get missing days for rider
app.get('/api/rider/missing-days', verifyRiderToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });
    const logs = await db.getDailyLogsByRider(req.riderId, start, end);
    const loggedDates = new Set(logs.map(l => (l.log_date || '').slice(0, 10)));
    const missing = [];
    const today = new Date().toISOString().slice(0, 10);
    let cursor = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      if (dateStr <= today && !loggedDates.has(dateStr)) {
        missing.push(dateStr);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    res.json({ missing, total: missing.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// Get unsettled payments for rider
app.get('/api/rider/unsettled-payments', verifyRiderToken, async (req, res) => {
  try {
    const data = await db.getUnsettledPaymentsForRider(req.riderId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin version to get unsettled payments for any rider
app.get('/api/admin/riders/:id/unsettled-payments', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const data = await db.getUnsettledPaymentsForRider(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request money (Food, Advance, etc.)
app.post('/api/rider/request-money', verifyRiderToken, async (req, res) => {
  try {
    const { amount, category, description, installment_plan } = req.body;
    if (!amount || !category) return res.status(400).json({ error: 'Amount and category required' });
    
    const rider = await db.getRiderById(req.riderId);
    if (!rider) return res.status(404).json({ error: 'Rider not found' });

    let finalDesc = description || '';
    const plan = parseInt(installment_plan, 10) || 1;
    if (category === 'Advance' && plan > 1) {
      finalDesc += `\n[INSTALLMENT_PLAN:${plan}]`;
    }

    const request = await db.createRiderRequest({
      rider_id: req.riderId,
      rider_name: rider.name,
      amount: parseFloat(amount),
      category,
      description: finalDesc
    });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rider: Get my requests
app.get('/api/rider/my-requests', verifyRiderToken, async (req, res) => {
  try {
    const requests = await db.getMyRequests(req.riderId);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rider: Delete my request
app.delete('/api/rider/request/:id', verifyRiderToken, async (req, res) => {
  try {
    const result = await db.deleteRiderRequest(req.params.id, req.riderId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get rider requests
app.get('/api/admin/rider-requests', async (req, res) => {
  try {
    const requests = await db.getRiderRequests(req.query.status);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== LEADERBOARD API ==========
const leaderboardCacheMap = new Map();

app.get('/api/rider/leaderboard', verifyRiderToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end dates required' });

    const cacheKey = `${start}_${end}`;
    const now = Date.now();
    if (leaderboardCacheMap.has(cacheKey)) {
      const cached = leaderboardCacheMap.get(cacheKey);
      if (now - cached.time < 30000) {
        return res.json(cached.data);
      }
    }

    const riders = await db.getAllRiders('active');
    
    const { data: allLogs, error: logErr } = await db.getDb()
      .from('daily_logs')
      .select('rider_id, primary_orders, associate_orders, log_date')
      .gte('log_date', start)
      .lte('log_date', end);

    if (logErr) throw logErr;

    // We want to calculate rank changes vs yesterday
    const todayStr = new Date(Date.now() + 3 * 3600000).toISOString().split('T')[0]; // KSA timezone
    
    const statsMap = {};
    const yesterdayStatsMap = {};

    (allLogs || []).forEach(log => {
      const rid = log.rider_id;
      const orders = (log.primary_orders || 0) + (log.associate_orders || 0);
      
      if (!statsMap[rid]) statsMap[rid] = 0;
      statsMap[rid] += orders;

      if (log.log_date < todayStr) {
        if (!yesterdayStatsMap[rid]) yesterdayStatsMap[rid] = 0;
        yesterdayStatsMap[rid] += orders;
      }
    });

    // Compute yesterday's ranks
    let yesterdayLeaderboard = riders.map(r => ({
      id: r.id,
      orders: yesterdayStatsMap[r.id] || 0
    })).sort((a, b) => b.orders - a.orders);
    
    const yesterdayRanks = {};
    yesterdayLeaderboard.forEach((r, index) => {
      yesterdayRanks[r.id] = index + 1;
    });

    const leaderboard = riders.map(r => ({
      id: r.id,
      name: r.name,
      photo: r.profile_photo || r.photo_url || null,
      total_orders: statsMap[r.id] || 0,
      rider_type: r.rider_type,
      yesterday_rank: yesterdayRanks[r.id]
    }));

    leaderboard.sort((a, b) => b.total_orders - a.total_orders);

    leaderboardCacheMap.set(cacheKey, { data: leaderboard, time: now });
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== ADMIN SPRINTS API ==========
app.get('/api/admin/sprints/leaderboard', verifyAdminToken, async (req, res) => {
  try {
    const state = getSprintState();
    
    let start = state.currentSprintStart.toISOString().split('T')[0];
    let end = state.currentSprintEnd.toISOString().split('T')[0];
    let querySprintNumber = state.sprintNumber;
    let queryPhase = state.phase;
    let queryCountdownMs = state.countdownMs;
    
    const targetSprint = req.query.sprintNumber ? parseInt(req.query.sprintNumber, 10) : null;
    if (targetSprint && targetSprint !== state.sprintNumber) {
      const COMP_MS = 6 * 24 * 60 * 60 * 1000;
      const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;
      const anchor = new Date(2026, 5, 1);
      
      const offset = (targetSprint - 1) * CYCLE_MS;
      const sprintStart = new Date(anchor.getTime() + offset);
      const sprintEnd = new Date(sprintStart.getTime() + COMP_MS - 1);
      
      start = sprintStart.toISOString().split('T')[0];
      end = sprintEnd.toISOString().split('T')[0];
      querySprintNumber = targetSprint;
      queryPhase = Date.now() > sprintEnd.getTime() ? 'FINISHED' : 'ACTIVE';
      queryCountdownMs = 0;
    }
    
    const riders = await db.getAllRiders('active');
    
    const { data: allLogs, error: logErr } = await db.getDb()
      .from('daily_logs')
      .select('rider_id, primary_orders, associate_orders, log_date')
      .gte('log_date', start)
      .lte('log_date', end);

    if (logErr) throw logErr;
    
    const statsMap = {};
    const riderLogsMap = {};
    (allLogs || []).forEach(log => {
      const rid = log.rider_id;
      const orders = (log.primary_orders || 0) + (log.associate_orders || 0);
      if (!statsMap[rid]) statsMap[rid] = 0;
      statsMap[rid] += orders;

      if (!riderLogsMap[rid]) riderLogsMap[rid] = [];
      riderLogsMap[rid].push({
        date: log.log_date,
        primary_orders: log.primary_orders || 0,
        associate_orders: log.associate_orders || 0,
        total_orders: orders
      });
    });

    const leaderboard = riders.map(r => ({
      id: r.id,
      name: r.name,
      mobile: r.mobile || r.phone || 'N/A',
      photo: r.profile_photo || r.photo_url || null,
      total_orders: statsMap[r.id] || 0,
      rider_type: r.rider_type,
      logs: (riderLogsMap[r.id] || []).sort((a, b) => b.date.localeCompare(a.date))
    })).sort((a, b) => b.total_orders - a.total_orders);

    res.json({
      sprintNumber: querySprintNumber,
      phase: queryPhase,
      countdownMs: queryCountdownMs,
      startDate: start,
      endDate: end,
      leaderboard
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ========== ADMIN PROFILES ==========

app.get('/api/admin/profiles', async (req, res) => {
  try {
    const profiles = await db.getAdminProfiles();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/profile', verifyAdminToken, async (req, res) => {
  try {
    const { name, title, photo_url } = req.body;
    const emailKey = (req.adminEmail || '').replace(/\./g, '_dot_');
    if (!emailKey) return res.status(400).json({ error: 'Cannot identify admin' });
    await db.updateAdminProfile(emailKey, { name, title, photo_url, role: req.adminRole });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== RIDER ALERTS & COMPLIANCE ==========

app.get('/api/admin/riders-compliance', verifyAdminToken, async (req, res) => {
  try {
    const targetDate = req.query.date || new Date(Date.now() + 3 * 3600000).toISOString().split('T')[0];
    const riders = await db.getAllRiders('active');
    
    // Cycle logic
    const tD = new Date(targetDate + 'T00:00:00');
    const day = tD.getDate();
    const month = tD.getMonth();
    const year = tD.getFullYear();
    let cycleStart;
    if (day >= 21) {
      cycleStart = new Date(year, month, 21);
    } else {
      cycleStart = new Date(year, month - 1, 21);
    }
    const cycleStartStr = cycleStart.toISOString().split('T')[0];
    
    const cycleLogs = await db.getDailyLogs(cycleStartStr, targetDate);
    const logsByRider = {};
    cycleLogs.forEach(l => {
      const rid = String(l.rider_id);
      if (!logsByRider[rid]) logsByRider[rid] = [];
      logsByRider[rid].push(l.log_date);
    });

    const elapsedDays = Math.floor((tD - cycleStart) / (1000 * 60 * 60 * 24)) + 1;
    
    // Bike insurance expiry tracking
    const bikes = await db.getAllBikes();
    const bikeInsuranceMap = {};
    bikes.forEach(b => { if (b.insurance_expiry) bikeInsuranceMap[b.id] = b.insurance_expiry; });

    const compliance = riders.map(r => {
      const missing = [];
      if (!r.noon_id) missing.push('noon_id');
      if (!r.bank_name || !r.bank_account || !r.iban) missing.push('bank_details');
      if (!r.iqama_number || !r.iqama_expiry) missing.push('iqama');
      if (!r.nationality || !r.date_of_birth) missing.push('personal_info');
      
      let emergencyMissing = true;
      let licenseMissing = true;
      let licenseExpiry = null;
      if (r.doc_vault) {
        try {
          const vault = typeof r.doc_vault === 'string' ? JSON.parse(r.doc_vault) : r.doc_vault;
          if (vault.emergency_name && vault.emergency_phone && vault.emergency_relation) {
            emergencyMissing = false;
          }
          if (vault.license_number && vault.license_expiry) {
            licenseMissing = false;
            licenseExpiry = vault.license_expiry;
          }
        } catch(e) {}
      }
      if (emergencyMissing) missing.push('emergency_contact');
      if (licenseMissing) missing.push('drivers_license');

      const rLogs = logsByRider[String(r.id)] || [];
      const logMissingToday = !rLogs.includes(targetDate);
      const cycleMissingDays = elapsedDays - rLogs.length;
      
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        missing_fields: missing,
        missing_log: logMissingToday,
        cycle_missing_days: cycleMissingDays > 0 ? cycleMissingDays : 0,
        iqama_expiry: r.iqama_expiry,
        license_expiry: licenseExpiry,
        insurance_expiry: r.bike_id ? bikeInsuranceMap[r.bike_id] : null,
        push_token: r.push_token
      };
    });

    res.json({ date: targetDate, elapsed_cycle_days: elapsedDays, compliance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/send-notification', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { rider_ids, rider_id, title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const ids = Array.isArray(rider_ids) ? rider_ids : (rider_id ? [rider_id] : []);
    if (ids.length === 0) {
      return res.status(400).json({ error: 'At least one rider_id is required' });
    }

    const adminName = req.adminName || 'Admin';
    let adminPhoto = '';
    try {
      const emailKey = (req.adminEmail || '').replace(/\./g, '_dot_');
      if (emailKey) {
        const profile = await db.getAdminProfile(emailKey);
        if (profile && profile.photo_url) adminPhoto = profile.photo_url;
      }
    } catch (e) { /* ignore */ }

    const results = [];
    const { Expo } = await import('expo-server-sdk');
    const expo = new Expo();

    for (const rId of ids) {
      try {
        // Create in-app notification
        await db.createNotification({
          rider_id: Number(rId),
          type: 'admin_broadcast',
          title: title,
          message: message,
          processed_by_name: adminName,
          processed_by_photo: adminPhoto
        });

        // Send push notification if token exists
        const rider = await db.getRiderById(Number(rId));
        let pushSent = false;
        if (rider && rider.push_token && Expo.isExpoPushToken(rider.push_token)) {
          await expo.sendPushNotificationsAsync([{
            to: rider.push_token,
            sound: 'default',
            title: title,
            body: message,
            channelId: 'default',
            priority: 'high',
            data: { type: 'admin_broadcast' }
          }]);
          pushSent = true;
        }
        results.push({ rider_id: rId, success: true, push_sent: pushSent });
      } catch (err) {
        results.push({ rider_id: rId, success: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== APP VERSION CONFIG ==========

app.get('/api/app-version', async (req, res) => {
  try {
    const version = await db.getAppVersion();
    res.json(version);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/app-version', verifyAdminToken, async (req, res) => {
  try {
    const { latest_version, min_version, download_url, force } = req.body;
    await db.setAppVersion({ latest_version, min_version, download_url, force: !!force });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update rider request status
app.put('/api/admin/rider-requests/:id', verifyAdminToken, async (req, res) => {
  try {
    const { status, admin_note, receipt_base64, deduct_funds } = req.body;
    const adminName = req.adminName || 'Admin';
    if (!status) return res.status(400).json({ error: 'Status required' });

    // Get admin photo for notification
    let adminPhoto = '';
    try {
      const emailKey = (req.adminEmail || '').replace(/\./g, '_dot_');
      if (emailKey) {
        const profile = await db.getAdminProfile(emailKey);
        if (profile && profile.photo_url) adminPhoto = profile.photo_url;
      }
    } catch (e) { /* ignore */ }

    const result = await db.updateRiderRequestStatus(req.params.id, status, admin_note, adminName, adminPhoto, receipt_base64, deduct_funds);
    
    // Send Push Notification
    try {
      if (result && result.rider_id) {
        const title = status === 'approved' ? 'Request Approved' : 'Request Rejected';
        const msg = status === 'approved' 
          ? `Your ${result.category} request has been approved by ${adminName}.`
          : `Your ${result.category} request was rejected by ${adminName}. Reason: ${admin_note || 'No reason provided'}`;

        const rider = await db.getRiderById(result.rider_id);
        if (rider && rider.push_token) {
          try {
            const { Expo } = await import('expo-server-sdk');
            const expo = new Expo();
            if (Expo.isExpoPushToken(rider.push_token)) {
              await expo.sendPushNotificationsAsync([{
                to: rider.push_token,
                sound: 'default',
                title: title,
                body: msg,
                data: { requestId: req.params.id, type: status }
              }]);
            }
          } catch (importErr) {
            console.error('Dynamic import of expo-server-sdk failed:', importErr);
          }
        }
      }
    } catch (pushErr) {
      console.error('Error sending push notification:', pushErr);
    }

    res.json(result);
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
    if (!rider || !rider.portal_password) return res.status(404).json({ error: 'Rider not found' });
    const match = await bcrypt.compare(current_password, rider.portal_password);
    if (!match) return res.status(400).json({ error: 'Current password incorrect' });

    await db.setRiderPassword(req.riderId, new_password);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update rider location
app.post('/api/rider/location', verifyRiderToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: 'latitude and longitude required' });
    
    // Drop updates if tracking is shutdown
    const isShutdown = await db.isTrackingShutdown();
    if (isShutdown) {
      return res.json({ success: true, warning: 'Tracking system is currently shut down' });
    }

    await db.updateRiderLocation(req.riderId, latitude, longitude);

    // Also insert into location_history for time-series tracking
    try {
      await db.insertLocationBatch(req.riderId, [{
        lat: latitude,
        lng: longitude,
        timestamp: new Date().toISOString(),
        source: 'legacy_endpoint'
      }], null);
    } catch (histErr) {
      console.error('Failed to insert into location_history:', histErr);
      // Don't fail the request if history insert fails
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update online status
app.post('/api/rider/online-status', verifyRiderToken, async (req, res) => {
  try {
    const { is_online } = req.body;
    if (is_online === undefined) return res.status(400).json({ error: 'is_online required' });
    
    if (is_online) {
      const isShutdown = await db.isTrackingShutdown();
      if (isShutdown) {
        return res.status(400).json({ error: 'Cannot go online: The location tracking system is currently shut down by administrators.' });
      }
    }

    await db.updateRiderOnlineStatus(req.riderId, is_online);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rider locations (Admin)
app.get('/api/admin/fleet-locations', async (req, res) => {
  try {
    const riders = await db.getAllRiders();

    // Fetch last heartbeats for online riders in parallel
    const onlineRiders = riders.filter(r => r.is_online);
    const heartbeatMap = {};
    if (onlineRiders.length > 0) {
      try {
        const heartbeatPromises = onlineRiders.map(async (r) => {
          try {
            const hb = await db.getLastHeartbeat(r.id);
            if (hb) heartbeatMap[r.id] = hb;
          } catch (e) { /* ignore individual failures */ }
        });
        await Promise.all(heartbeatPromises);
      } catch (e) {
        console.error('Error fetching heartbeats for fleet-locations:', e);
      }
    }

    const activeRiders = riders.map(r => {
      const hb = heartbeatMap[r.id];
      return {
        id: r.id,
        name: r.name,
        lat: r.last_lat,
        lng: r.last_lng,
        lastUpdate: r.last_location_update,
        isOnline: r.is_online,
        status: r.status,
        photo: r.profile_photo || r.photo_url,
        phone: r.phone,
        gpsStatus: r.gps_status || null,
        battery_level: hb ? hb.battery_level : null,
        app_state: hb ? hb.app_state : null,
        last_heartbeat_at: hb ? hb.received_at : null
      };
    });
    res.json(activeRiders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force single rider offline (Admin)
app.post('/api/admin/force-offline/:id', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    await db.updateRiderOnlineStatus(parseInt(req.params.id), false);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force ALL riders offline at once (Admin)
app.post('/api/admin/force-offline-all', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const riders = await db.getAllRiders();
    let count = 0;
    for (const r of riders) {
      if (r.is_online) {
        await db.updateRiderOnlineStatus(r.id, false);
        count++;
      }
    }
    res.json({ success: true, offlined: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tracking system shutdown status
app.get('/api/admin/tracking/status', async (req, res) => {
  try {
    const isShutdown = await db.isTrackingShutdown();
    res.json({ shutdown: isShutdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST toggle tracking system shutdown (Admin only)
app.post('/api/admin/tracking/toggle-shutdown', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { shutdown } = req.body;
    if (shutdown === undefined) return res.status(400).json({ error: 'shutdown parameter required' });

    await db.setTrackingShutdown(shutdown);

    let count = 0;
    if (shutdown) {
      // Force all active riders offline
      const riders = await db.getAllRiders();
      for (const r of riders) {
        if (r.is_online) {
          await db.updateRiderOnlineStatus(r.id, false);
          count++;
        }
      }
    }

    res.json({ success: true, offlined: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update GPS status (Rider App heartbeat)
app.post('/api/rider/gps-status', verifyRiderToken, async (req, res) => {
  try {
    const { gps_status } = req.body;
    if (!gps_status) return res.status(400).json({ error: 'gps_status required' });
    
    // Drop updates if tracking is shutdown
    const isShutdown = await db.isTrackingShutdown();
    if (isShutdown) {
      return res.json({ success: true, warning: 'Tracking system is currently shut down' });
    }

    await db.updateRiderGpsStatus(req.riderId, gps_status);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========== LOCATION BATCH & HEARTBEAT ROUTES ==========

// Batch location upload (high-frequency, behind verifyRiderToken with skip session)
app.post('/api/rider/location/batch', verifyRiderToken, async (req, res) => {
  try {
    const { locations, session_id } = req.body;
    if (!locations || !Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array required' });
    }

    // Drop updates if tracking is shutdown
    const isShutdown = await db.isTrackingShutdown();
    if (isShutdown) {
      return res.json({ success: true, accepted: 0, warning: 'Tracking system is currently shut down' });
    }

    await db.insertLocationBatch(req.riderId, locations, session_id);
    res.json({ success: true, accepted: locations.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rider heartbeat (app-alive signal)
app.post('/api/rider/heartbeat', verifyRiderToken, async (req, res) => {
  try {
    const { battery, is_location_active, app_state } = req.body;
    await db.insertHeartbeat(req.riderId, battery, is_location_active, app_state);

    // If location tracking is not active but rider is online, send silent push to wake the app
    if (is_location_active === false) {
      try {
        const rider = await db.getRiderById(req.riderId);
        if (rider && rider.is_online && rider.push_token) {
          const { Expo } = await import('expo-server-sdk');
          const expo = new Expo();
          if (Expo.isExpoPushToken(rider.push_token)) {
            await expo.sendPushNotificationsAsync([{
              to: rider.push_token,
              data: { type: 'silent_wake', silent: true },
              priority: 'high',
              channelId: 'silent_wake',
              _contentAvailable: true
            }]);
          }
        }
      } catch (pushErr) {
        console.error('Failed to send wake push for heartbeat:', pushErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Get rider location history
app.get('/api/admin/rider-location-history/:id', async (req, res) => {
  try {
    const riderId = parseInt(req.params.id);
    const { start, end } = req.query;
    const history = await db.getLocationHistory(riderId, start, end);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rider/push-token', verifyRiderToken, async (req, res) => {
  try {
    const { push_token } = req.body;
    if (!push_token) return res.status(400).json({ error: 'Push token required' });
    await db.saveRiderPushToken(req.riderId, push_token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rider/notifications', verifyRiderToken, async (req, res) => {
  try {
    const notifications = await db.getNotificationsForRider(req.riderId);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rider/notifications/:id/read', verifyRiderToken, async (req, res) => {
  try {
    await db.markNotificationRead(req.params.id, req.riderId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: set rider portal password
app.put('/api/riders/:id/set-password', verifyAdminToken, requireAdmin, async (req, res) => {
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
    const logo = await db.getSettings('company_logo');
    res.json({ logo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/logo', verifyAdminToken, requireAdmin, async (req, res) => {
  try {
    const { logo } = req.body;
    await db.updateSettings('company_logo', logo);
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

    // Find user in Supabase
    const user = await db.getAuthUser(email);

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
    console.error('Login error:', err.message);
    const msg = err.message.includes('auth_users') ? err.message : 'Server error';
    res.status(500).json({ error: msg });
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
    const user = await db.getAuthUser(u.email);
    if (!user) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.upsertAuthUser({
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

// Initialize DB and seed users (runs on both local and Vercel)
async function initializeApp() {
  try {
    await db.initDb();
    console.log('  🐘 Database initialized (Supabase)');

    // Only run heavy sync tasks if we are running locally as a persistent server
    if (!process.env.VERCEL) {
      // Seed dashboard auth users
      await seedAuthUsers();
      console.log('  🔐 Dashboard auth users ready');

      // Sync approved requests to restore missing expenses/advances
      await db.syncApprovedRequests();

      // Check if we have data
      const riders = await db.getAllRiders();
      console.log(`  📊 Database has data (${riders.length} riders)`);
    }
  } catch (err) {
    console.error('Failed to initialize:', err);
  }
}

// Initialize on import (for Vercel)
initializeApp();

// Only listen when running locally (not on Vercel)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n  🚀 Inspiring Roads Logistics Server`);
    console.log(`  ────────────────────────────────────`);
    console.log(`  → Running at http://localhost:${PORT}`);
    console.log(`  → Login: http://localhost:${PORT}/login`);
    console.log(`  → Rider Portal: http://localhost:${PORT}/rider/`);
    console.log(`  → Database: Supabase Database 🐘\n`);

    // ========== LOCATION WATCHDOG (every 2 minutes) ==========
    setInterval(async () => {
      try {
        const riders = await db.getAllRiders();
        const onlineRiders = riders.filter(r => r.is_online);
        let staleCount = 0;
        let disconnectedCount = 0;

        for (const rider of onlineRiders) {
          try {
            if (!rider.last_location_update) continue;
            const lastUpdate = new Date(rider.last_location_update).getTime();
            const minutesAgo = (Date.now() - lastUpdate) / (1000 * 60);

            if (minutesAgo > 30) {
              // > 30 minutes: app_killed
              await db.updateRiderOnlineStatus(rider.id, false);
              const supabase = db.getDb();
              await supabase.from('riders').update({ gps_status: 'app_killed' }).eq('id', rider.id);
              disconnectedCount++;
            } else if (minutesAgo > 10) {
              // > 10 minutes: disconnected
              await db.updateRiderGpsStatus(rider.id, 'disconnected');
              disconnectedCount++;
            } else if (minutesAgo > 5) {
              // > 5 minutes: send silent push to wake app
              await db.updateRiderGpsStatus(rider.id, 'stale');
              staleCount++;
              if (rider.push_token) {
                try {
                  const { Expo } = await import('expo-server-sdk');
                  const expo = new Expo();
                  if (Expo.isExpoPushToken(rider.push_token)) {
                    await expo.sendPushNotificationsAsync([{
                      to: rider.push_token,
                      data: { type: 'silent_wake', silent: true },
                      priority: 'high',
                      channelId: 'silent_wake',
                      _contentAvailable: true
                    }]);
                  }
                } catch (pushErr) {
                  console.error(`[Watchdog] Push failed for rider ${rider.id}:`, pushErr.message);
                }
              }
            } else if (minutesAgo > 3) {
              // > 3 minutes: stale
              await db.updateRiderGpsStatus(rider.id, 'stale');
              staleCount++;
            }
          } catch (riderErr) {
            console.error(`[Watchdog] Error processing rider ${rider.id}:`, riderErr.message);
          }
        }

        console.log(`[Watchdog] Checked ${onlineRiders.length} online riders, ${staleCount} stale, ${disconnectedCount} disconnected`);
      } catch (err) {
        console.error('[Watchdog] Error:', err.message);
      }
    }, 120000); // Every 2 minutes

    // ========== DAILY CLEANUP JOB (every 24 hours) ==========
    setInterval(async () => {
      try {
        console.log('[Cleanup] Running daily cleanup...');
        await db.cleanupOldLocationHistory(30);
        await db.cleanupOldHeartbeats(7);
        console.log('[Cleanup] Daily cleanup completed.');
      } catch (err) {
        console.error('[Cleanup] Error:', err.message);
      }
    }, 86400000); // Every 24 hours
  });
}

// ==========================================
// APP VERSION
// ==========================================
app.get('/api/app-version', async (req, res) => {
  try {
    const versionData = await db.getAppVersion();
    res.json(versionData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/app-version', verifyAdminToken, async (req, res) => {
  try {
    await db.setAppVersion(req.body);
    res.json({ message: 'App version updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== VERCEL CRON JOBS ==========

// Helper function to calculate sprint state on backend
function getSprintState(nowStr) {
  const now = nowStr ? new Date(nowStr) : new Date();
  
  // Anchor: June 1, 2026, 00:00:00 Riyadh Time (UTC+3)
  const anchor = new Date(Date.UTC(2026, 5, 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000);
  
  if (now.getTime() < anchor.getTime()) {
    return {
      phase: 'PRE_LAUNCH',
      countdownMs: anchor.getTime() - now.getTime(),
      currentSprintStart: anchor,
      currentSprintEnd: new Date(anchor.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      sprintNumber: 1
    };
  }
  
  const diffMs = now.getTime() - anchor.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const CYCLE_MS = 8 * ONE_DAY_MS;
  const COMP_MS = 7 * ONE_DAY_MS;
  
  const cycleIndex = Math.floor(diffMs / CYCLE_MS);
  const timeInCycle = diffMs % CYCLE_MS;
  
  const currentSprintStart = new Date(anchor.getTime() + cycleIndex * CYCLE_MS);
  const currentSprintEnd = new Date(currentSprintStart.getTime() + COMP_MS - 1);
  const nextSprintStart = new Date(anchor.getTime() + (cycleIndex + 1) * CYCLE_MS);
  
  if (timeInCycle < COMP_MS) {
    return {
      phase: 'ACTIVE',
      countdownMs: currentSprintEnd.getTime() - now.getTime(),
      currentSprintStart,
      currentSprintEnd,
      sprintNumber: cycleIndex + 1
    };
  } else {
    return {
      phase: 'WINNER_HIGHLIGHT',
      countdownMs: nextSprintStart.getTime() - now.getTime(),
      currentSprintStart,
      currentSprintEnd,
      sprintNumber: cycleIndex + 1
    };
  }
}

// Single Smart Sprint Manager Endpoint
app.get('/api/cron/sprint-manager', async (req, res) => {
  console.log('[CRON] Running smart sprint manager...');
  try {
    const { Expo } = require('expo-server-sdk');
    const expo = new Expo();
    
    const state = getSprintState();

    // If we're before June 1st, there's nothing to calculate
    if (state.phase === 'PRE_LAUNCH') {
      return res.json({ success: true, message: 'Sprint has not started yet (PRE_LAUNCH). Nothing to do.' });
    }

    const startStr = state.currentSprintStart.toISOString().split('T')[0];
    const endStr = state.currentSprintEnd.toISOString().split('T')[0];

    const riders = await db.getAllRiders('active');
    const companyRiders = riders.filter(r => r.rider_type === 'company' && r.push_token && Expo.isExpoPushToken(r.push_token));
    
    if (companyRiders.length === 0) return res.json({ success: true, message: 'No riders to notify' });

    const logsResult = await db.getDailyLogsPaginated(startStr, endStr, 1, 99999);
    const logs = logsResult.data || [];
    
    const statsMap = {};
    for (const log of logs) {
      if (log.rider_id) {
        statsMap[log.rider_id] = (statsMap[log.rider_id] || 0) + (log.delivered_orders || 0);
      }
    }

    const leaderboard = companyRiders.map(r => ({
      ...r,
      total_orders: statsMap[r.id] || 0
    })).sort((a, b) => b.total_orders - a.total_orders);

    const messages = [];

    if (state.phase === 'ACTIVE') {
      // Send standard daily progress
      leaderboard.forEach((rider, index) => {
        const rank = index + 1;
        let title = '';
        let body = '';

        if (rank === 1) {
          title = `👑 Sprint #${state.sprintNumber}: You are Rank #1!`;
          body = `Keep up the great work to secure the 40 SAR Weekly Sprint prize! You have ${rider.total_orders} orders.`;
        } else if (rank === 2) {
          const diffOrders = leaderboard[0].total_orders - rider.total_orders + 1;
          title = `🥈 Sprint #${state.sprintNumber}: You are Rank #2!`;
          body = `You only need ${diffOrders} more orders to take 1st place and the 40 SAR prize!`;
        } else if (rank === 3) {
          const diffOrders = leaderboard[1].total_orders - rider.total_orders + 1;
          title = `🥉 Sprint #${state.sprintNumber}: You are Rank #3!`;
          body = `You are in the money! Complete ${diffOrders} more orders to overtake Rank #2.`;
        } else if (rank <= 10) {
          const diffOrders = leaderboard[2].total_orders - rider.total_orders + 1;
          title = `📈 You are Rank #${rank}!`;
          body = `You need ${diffOrders} more orders to break into the Top 3 and win cash! Keep pushing!`;
        }

        if (title && body) {
          messages.push({
            to: rider.push_token,
            sound: 'default',
            title: title,
            body: body,
            data: { type: 'sprint_progress' },
          });
        }
      });
    } else if (state.phase === 'WINNER_HIGHLIGHT') {
      // Only send if it's the exact day the winners are calculated (the highlight day)
      // To prevent spamming the winner notification every hour if the cron misfires, we check if we already sent it,
      // but since the cron runs once a day, it's fine to just blast it.
      
      const top3 = leaderboard.slice(0, 3);
      if (top3.length === 0) return res.json({ success: true, message: 'No logs found for previous sprint' });

      companyRiders.forEach((rider) => {
        let title = `🏆 Sprint #${state.sprintNumber} Winners!`;
        let body = `1st: ${top3[0]?.name || 'N/A'}\n2nd: ${top3[1]?.name || 'N/A'}\n3rd: ${top3[2]?.name || 'N/A'}\nTap to see full rankings!`;
        
        if (top3[0] && rider.id === top3[0].id) {
          title = `👑 YOU WON 1ST PLACE!`;
          body = `Congratulations! You won Sprint #${state.sprintNumber} and 40 SAR!`;
        } else if (top3[1] && rider.id === top3[1].id) {
          title = `🥈 YOU WON 2ND PLACE!`;
          body = `Congratulations! You secured 2nd place in Sprint #${state.sprintNumber} and 20 SAR!`;
        } else if (top3[2] && rider.id === top3[2].id) {
          title = `🥉 YOU WON 3RD PLACE!`;
          body = `Congratulations! You secured 3rd place in Sprint #${state.sprintNumber} and 15 SAR!`;
        }

        messages.push({
          to: rider.push_token,
          sound: 'default',
          title: title,
          body: body,
          data: { type: 'sprint_winners' },
        });
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('[CRON] Push error:', error);
      }
    }
    res.json({ success: true, notified: messages.length, phase: state.phase });
  } catch (err) {
    console.error('[CRON] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export for Vercel
module.exports = app;
