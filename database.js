// ========================================
//  Database Operations - Firebase Admin
// ========================================

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Initialize Firebase — supports both local file and Vercel env var
if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Vercel: parse from env var
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(sa);
  } else {
    // Local: read from file
    const saPath = path.join(__dirname, 'firebase-service-account.json');
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  }
  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DB_URL || "https://inspiring-roads-logistics-default-rtdb.firebaseio.com"
  });
}

const fbDb = admin.database();

// Helper to convert Firebase snapshot to array with IDs
function snapshotToArray(snapshot) {
  const arr = [];
  if (!snapshot.exists()) return arr;
  snapshot.forEach(child => {
    arr.push({ id: child.key, ...child.val() });
  });
  return arr;
}

function nowISO() {
  return new Date().toISOString();
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Atomic counter-based ID generation using Firebase counters collection
async function getNextId(collection) {
  const counterRef = fbDb.ref(`counters/${collection}`);
  const result = await counterRef.transaction(current => {
    return (current || 0) + 1;
  });
  return result.snapshot.val();
}

// ========== INIT ==========

async function initDb() {
  const testRef = fbDb.ref('.info/connected');
  return new Promise((resolve) => {
    testRef.once('value', (snap) => {
      if (snap.val() === true) console.log('  🔥 Firebase connected');
      resolve();
    });
    setTimeout(resolve, 3000);
  });
}

function getDb() {
  return fbDb;
}

// ========== RIDER OPERATIONS ==========

async function getAllRiders(status = 'active') {
  const snapshot = await fbDb.ref('riders').once('value');
  let riders = snapshotToArray(snapshot);
  if (status) {
    riders = riders.filter(r => String(r.status || '').toLowerCase() === String(status).toLowerCase());
  }
  riders.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return riders;
}

async function getRiderById(id) {
  const snapshot = await fbDb.ref(`riders/${id}`).once('value');
  if (!snapshot.exists()) return null;
  return { id: snapshot.key, ...snapshot.val() };
}

async function createRider(data) {
  const id = await getNextId('riders');
  const rider = {
    ...data,
    rider_type: data.rider_type || 'company',
    status: 'active',
    created_at: nowISO(),
    updated_at: nowISO()
  };
  await fbDb.ref(`riders/${id}`).set(rider);
  return { id, ...rider };
}

async function updateRider(id, data) {
  await fbDb.ref(`riders/${id}`).update({ ...data, updated_at: nowISO() });
  const snapshot = await fbDb.ref(`riders/${id}`).once('value');
  return { id: snapshot.key, ...snapshot.val() };
}

async function archiveRider(id) {
  await fbDb.ref(`riders/${id}`).update({ status: 'inactive', updated_at: nowISO() });
  return await getRiderById(id);
}

async function deleteRiderPermanently(id) {
  await fbDb.ref(`riders/${id}`).remove();
  return true;
}

// ========== DAILY LOGS ==========

async function getDailyLogs(date) {
  const snapshot = await fbDb.ref('daily_logs').once('value');
  let logs = snapshotToArray(snapshot);
  if (date) {
    logs = logs.filter(l => String(l.log_date).startsWith(date));
  }
  return logs;
}

async function getDailyLogsByRider(riderId, start, end) {
  const snapshot = await fbDb.ref('daily_logs').once('value');
  const logs = [];
  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const log = child.val();
      if (String(log.rider_id) === String(riderId)) {
        const d = log.log_date || '';
        if ((!start || d >= start) && (!end || d <= end)) {
          logs.push({ id: parseInt(child.key), ...log });
        }
      }
    });
  }
  return logs;
}

async function getMissingLogs(date) {
  const [riders, logs] = await Promise.all([
    getAllRiders('active'),
    getDailyLogs(date)
  ]);
  const loggedRiderIds = new Set(logs.map(l => String(l.rider_id)));
  return riders.filter(r => !loggedRiderIds.has(String(r.id)));
}

async function createDailyLog(data) {
  const id = await getNextId('daily_logs');
  const log = {
    ...data,
    created_at: nowISO(),
    updated_at: nowISO()
  };
  await fbDb.ref(`daily_logs/${id}`).set(log);
  return { id, ...log };
}

async function updateDailyLog(id, data) {
  await fbDb.ref(`daily_logs/${id}`).update({ ...data, updated_at: nowISO() });
  const snapshot = await fbDb.ref(`daily_logs/${id}`).once('value');
  return { id: snapshot.key, ...snapshot.val() };
}

async function deleteDailyLog(id) {
  await fbDb.ref(`daily_logs/${id}`).remove();
}

// ========== DASHBOARD STATS ==========

async function getDashboardStats(start, end) {
  const [ridersSnap, logsSnap, bikesSnap] = await Promise.all([
    fbDb.ref('riders').once('value'),
    fbDb.ref('daily_logs').once('value'),
    fbDb.ref('bikes').once('value')
  ]);

  const allRiders = snapshotToArray(ridersSnap);
  const activeRiders = allRiders.filter(r => r.status === 'active');
  const allLogs = snapshotToArray(logsSnap);
  const allBikes = snapshotToArray(bikesSnap);

  const today = todayLocal();
  const periodLogs = allLogs.filter(l => l.log_date >= start && l.log_date <= end);
  const todayLogs = allLogs.filter(l => l.log_date === today);

  // Expiring iqamas (within 30 days)
  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);
  
  const expiring_iqamas = activeRiders.filter(r => {
    if (!r.iqama_expiry) return false;
    const expiry = new Date(r.iqama_expiry);
    return expiry >= now && expiry <= thirtyDaysLater;
  });

  // Low checkins today (< 11 hours)
  const riderMap = {};
  allRiders.forEach(r => { riderMap[r.id] = r.name; });

  const low_checkins_today = todayLogs.filter(l => {
    if (l.attendance_status !== 'Present') return false;
    const totalMinutes = (l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0);
    return totalMinutes < 11 * 60;
  }).map(l => ({
    ...l,
    rider_name: riderMap[l.rider_id] || 'Unknown'
  }));

  // Performance ranking
  const riderPerf = {};
  periodLogs.forEach(l => {
    const rid = String(l.rider_id);
    if (!riderPerf[rid]) riderPerf[rid] = { id: rid, name: l.rider_name || riderMap[l.rider_id] || 'Unknown', total: 0 };
    riderPerf[rid].total += (l.primary_orders || 0) + (l.associate_orders || 0);
  });

  const top_riders = Object.values(riderPerf).sort((a, b) => b.total - a.total).slice(0, 7);
  const low_riders = Object.values(riderPerf).sort((a, b) => a.total - b.total).slice(0, 5);

  return {
    total_active: activeRiders.length,
    total_company: activeRiders.filter(r => (r.rider_type || '').toLowerCase() === 'company').length,
    total_freelancer: activeRiders.filter(r => (r.rider_type || '').toLowerCase() !== 'company').length,
    logged_today: todayLogs.length,
    pending_today: Math.max(0, activeRiders.length - todayLogs.length),
    low_checkins_today,
    expiring_iqamas,
    top_riders,
    low_riders,
    period_total_orders: periodLogs.reduce((sum, l) => sum + (l.primary_orders || 0) + (l.associate_orders || 0), 0),
    period_primary_orders: periodLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0),
    period_associate_orders: periodLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0),
    average_orders_per_day: 0,
    average_checkin_hours: 0
  };
}

// ========== PAYROLL OPERATIONS ==========

async function calculatePayroll(periodStart, periodEnd) {
  const ridersSnapshot = await fbDb.ref('riders').once('value');
  const allRiders = snapshotToArray(ridersSnapshot);
  
  if (allRiders.length === 0) return [];

  const [bonusSnap, advSnap, payStatusSnap, expSnap, logsSnap] = await Promise.all([
    fbDb.ref('bonuses').once('value'),
    fbDb.ref('salary_advances').once('value'),
    fbDb.ref('payment_status').once('value'),
    fbDb.ref('expenses').once('value'),
    fbDb.ref('daily_logs').once('value')
  ]);

  const allBonuses = snapshotToArray(bonusSnap);
  const allAdvances = snapshotToArray(advSnap);
  const allExpenses = snapshotToArray(expSnap);
  const allLogsRaw = snapshotToArray(logsSnap);
  
  const allPayStatuses = {};
  if (payStatusSnap.exists()) {
    payStatusSnap.forEach(c => { allPayStatuses[c.key] = c.val(); });
  }

  const allLogs = allLogsRaw.filter(l => {
    const d = String(l.log_date || '').slice(0, 10);
    return d >= periodStart && d <= periodEnd;
  });

  const logsByRider = {};
  allLogs.forEach(log => {
    const rid = String(log.rider_id || log.riderId || '');
    if (!logsByRider[rid]) logsByRider[rid] = [];
    logsByRider[rid].push(log);
  });

  const results = [];

  for (const rider of allRiders) {
    try {
      const riderId = String(rider.id);
      const logs = logsByRider[riderId] || [];
      
      // Skip inactive riders if they have zero logs in this period
      if (rider.status !== 'active' && logs.length === 0) continue;

      const presentLogs = logs.filter(l => {
        const s = (l.attendance_status || '').toLowerCase();
        return s.includes('present') || s === 'p';
      });

      const totalOrders = presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0) + (l.associate_orders || 0), 0);
      const totalPrimaryOrders = presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0);
      const totalAssociateOrders = presentLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0);
      const presentDays = presentLogs.length;
      const absentLogs = logs.filter(l => {
        const s = (l.attendance_status || '').trim();
        return s === 'Absent' || s === 'Missed';
      });
      const absentDays = absentLogs.length;
      const weekoffDays = logs.filter(l => {
        const s = (l.attendance_status || '').toLowerCase().trim();
        return s === 'weekoff' || s === 'week off' || s === 'week_off' || s === 'day off' || s === 'dayoff';
      }).length;

      let calculatedSalary = 0;
      if ((rider.rider_type || '').toLowerCase() === 'company') {
        calculatedSalary = rider.base_salary || 1950;
      } else {
        calculatedSalary = totalOrders * 6.8;
      }

      // BONUSES
      let totalBonuses = 0;
      allBonuses.filter(b => String(b.rider_id || b.riderId) === riderId).forEach(b => {
        totalBonuses += b.amount || 0;
      });

      // DEDUCTIONS — whole-life unsettled expenses (excluding medical)
      let totalDeductions = 0;
      allExpenses.filter(exp => {
        if ((exp.category || '').toLowerCase().includes('medical')) return false;
        if (exp.deductionSettled === 1 || exp.deductionSettled === true) return false;
        if (exp.is_deductible !== 1 && exp.is_deductible !== true) return false;
        const expRid = String(exp.rider_id || exp.riderId || '');
        const expName = (exp.rider_name || exp.riderName || '').toLowerCase().trim();
        const rName = (rider.name || '').toLowerCase().trim();
        return expRid === riderId || (expName !== '' && expName === rName);
      }).forEach(exp => { totalDeductions += (exp.amount || 0); });

      // DEDUCTIONS — whole-life unsettled salary advances
      let totalAdvances = 0;
      allAdvances.filter(adv => {
        if (adv.status !== 'approved' || adv.deductionSettled === true || adv.deductionSettled === 1) return false;
        const advRid = String(adv.rider_id || adv.riderId || '');
        const advName = (adv.rider_name || adv.riderName || '').toLowerCase().trim();
        const rName = (rider.name || '').toLowerCase().trim();
        return advRid === riderId || (advName !== '' && advName === rName);
      }).forEach(adv => { totalAdvances += (adv.amount || 0); });

      const totalDedSum = totalDeductions + totalAdvances;
      const netPay = (calculatedSalary + totalBonuses) - totalDedSum;

      const avgCheckinMinutes = presentLogs.length > 0
        ? presentLogs.reduce((sum, l) => sum + ((l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0)), 0) / presentLogs.length
        : 0;
      const avgCheckinHours = Math.floor(avgCheckinMinutes / 60);
      const avgCheckinMins = Math.round(avgCheckinMinutes % 60);

      const warnings = [];
      const rType = (rider.rider_type || '').toLowerCase();
      
      const formatLogDate = (dStr) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        return isNaN(d) ? dStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      if (absentDays > 0) {
        const absDates = absentLogs.map(l => formatLogDate(l.log_date)).filter(Boolean).join(', ');
        warnings.push({ type: 'attendance', message: `Missed ${absentDays} day(s)${absDates ? ` on: ${absDates}` : ''}` });
      } else if (rType === 'company' && presentDays < 26 && presentDays > 0) {
        warnings.push({ type: 'attendance', message: `Short attendance — Logged only ${presentDays} of 26 required days` });
      }
      
      if (avgCheckinMinutes > 0 && avgCheckinMinutes < 660) {
        const shortLogs = presentLogs.filter(l => {
          const t = (l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0);
          return t > 0 && t < 660; // Less than 11 total hours worked
        });
        const shortDates = shortLogs.slice(0, 3).map(l => {
          const hm = `${l.checkin_hours}h ${String(l.checkin_minutes||0).padStart(2, '0')}m`;
          return `${formatLogDate(l.log_date)} (${hm})`;
        }).join(', ') + (shortLogs.length > 3 ? ` +${shortLogs.length - 3} more` : '');
        warnings.push({ type: 'checkin', message: `Low avg hours (${avgCheckinHours}h ${avgCheckinMins}m). Short days: ${shortDates}` });
      }
      
      if (rType === 'company' && presentDays > 0 && totalOrders < 520) {
        const deficit = 520 - totalOrders;
        warnings.push({ type: 'orders', message: `Missed target by ${deficit} orders (Total: ${totalOrders}/520)` });
      }
      
      if (totalDedSum > 0) {
        const dParts = [];
        if (totalDeductions > 0) dParts.push(`Fees: ${totalDeductions} SAR`);
        if (totalAdvances > 0) dParts.push(`Advances: ${totalAdvances} SAR`);
        warnings.push({ type: 'debt', message: `Unsettled Debt (${totalDedSum} SAR) — ${dParts.join(' | ')}` });
      }

      results.push({
        rider_id: rider.id,
        rider_name: rider.name,
        rider_type: rider.rider_type,
        client_company: rider.client_company,
        base_salary: (rider.rider_type || '').toLowerCase() === 'company' ? (rider.base_salary || 1950) : 0,
        calculated_salary: calculatedSalary,
        total_primary_orders: totalPrimaryOrders,
        total_associate_orders: totalAssociateOrders,
        total_orders: totalOrders,
        present_days: presentDays,
        absent_days: absentDays,
        weekoff_days: weekoffDays,
        avg_checkin: `${avgCheckinHours}:${String(avgCheckinMins).padStart(2, '0')}`,
        deductions: totalDedSum,
        total_bonuses: totalBonuses,
        net_pay: netPay,
        payment_status: allPayStatuses[rider.id] || 'pending',
        warnings: warnings
      });
    } catch (err) {
      console.error(`Calc error for rider ${rider.id}:`, err);
    }
  }

  return results;
}

// ========== EXPENSE OPERATIONS ==========

async function getExpenseStats() {
  const [fundsSnap, expSnap] = await Promise.all([
    fbDb.ref('company_funds').once('value'),
    fbDb.ref('expenses').once('value')
  ]);

  const funds = snapshotToArray(fundsSnap);
  const expenses = snapshotToArray(expSnap);

  const totalReceived = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => {
    if (e.category === 'Manual Deduction') return sum;
    return sum + (parseFloat(e.amount) || 0);
  }, 0);

  // All expenses are covered by company funds first.
  // Out of pocket only if total expenses exceed total funds received.
  const usedFromIRL = Math.min(totalExpenses, totalReceived);
  const fromMyPocket = Math.max(0, totalExpenses - totalReceived);
  const remainingIRL = totalReceived - usedFromIRL;

  return {
    total_received: totalReceived,
    used_from_irl: usedFromIRL,
    remaining_irl: remainingIRL,
    from_my_pocket: fromMyPocket,
    total_expenses: totalExpenses,
    count: expenses.length
  };
}

async function getExpenses(start, end) {
  const [expSnap, ridersSnap] = await Promise.all([
    fbDb.ref('expenses').once('value'),
    fbDb.ref('riders').once('value')
  ]);
  let data = snapshotToArray(expSnap);
  
  // Enrich with rider_name from riders collection
  const riderMap = {};
  if (ridersSnap.exists()) {
    ridersSnap.forEach(child => {
      riderMap[child.key] = child.val().name;
    });
  }
  data.forEach(e => {
    if (e.rider_id && !e.rider_name) {
      e.rider_name = riderMap[String(e.rider_id)] || null;
    }
  });

  if (start && end) {
    data = data.filter(e => (e.expense_date || '').slice(0,10) >= start && (e.expense_date || '').slice(0,10) <= end);
  }
  // Sort newest first: by expense_date desc, then by created_at desc
  data.sort((a, b) => {
    const dateA = a.expense_date || a.created_at || '';
    const dateB = b.expense_date || b.created_at || '';
    const dateCmp = dateB.localeCompare(dateA);
    if (dateCmp !== 0) return dateCmp;
    
    // If same day, sort by exact creation time
    const timeA = a.created_at || '';
    const timeB = b.created_at || '';
    return timeB.localeCompare(timeA);
  });
  return data;
}

async function createExpense(data) {
  const id = await getNextId('expenses');
  // Auto-populate rider_name if rider_id is provided
  if (data.rider_id && !data.rider_name) {
    const riderSnap = await fbDb.ref(`riders/${data.rider_id}`).once('value');
    if (riderSnap.exists()) {
      data.rider_name = riderSnap.val().name;
    }
  }
  const expense = { ...data, deductionSettled: false, created_at: nowISO() };
  await fbDb.ref(`expenses/${id}`).set(expense);
  
  await logAudit('CREATE', 'Expense', `Logged expense: ${expense.category} - ${expense.amount} SAR`);
  
  return { id, ...expense };
}

async function updateExpense(id, data) {
  await fbDb.ref(`expenses/${id}`).update({ ...data, updated_at: nowISO() });
  return { id };
}

async function deleteExpense(id) {
  await fbDb.ref(`expenses/${id}`).remove();
}

async function settleExpenseDeduction(id, settledBy) {
  await fbDb.ref(`expenses/${id}`).update({
    deductionSettled: true,
    settled_by: settledBy,
    settledBy: settledBy,
    settled_at: nowISO(),
    settledDate: nowISO()
  });
}

async function settleRiderDeductions(riderId, settledBy) {
  const rid = String(riderId);
  const [expSnap, advSnap] = await Promise.all([
    fbDb.ref('expenses').once('value'),
    fbDb.ref('salary_advances').once('value')
  ]);
  const updates = {};
  let count = 0;
  const settleData = {
    deductionSettled: true,
    settled_by: settledBy,
    settledBy: settledBy,
    settled_at: nowISO(),
    settledDate: nowISO()
  };
  expSnap.forEach(c => {
    const e = c.val();
    if (String(e.rider_id || e.riderId) === rid && e.is_deductible && !e.deductionSettled) {
      Object.entries(settleData).forEach(([k, v]) => { updates[`expenses/${c.key}/${k}`] = v; });
      count++;
    }
  });
  advSnap.forEach(c => {
    const a = c.val();
    if (String(a.rider_id || a.riderId) === rid && a.status === 'approved' && !a.deductionSettled) {
      Object.entries(settleData).forEach(([k, v]) => { updates[`salary_advances/${c.key}/${k}`] = v; });
      count++;
    }
  });
  if (Object.keys(updates).length > 0) await fbDb.ref().update(updates);
  return count;
}

// ========== SALARY ADVANCES ==========

async function getAdvances(start, end) {
  const snapshot = await fbDb.ref('salary_advances').once('value');
  let data = snapshotToArray(snapshot);
  if (start && end) {
    data = data.filter(a => (a.created_at || '').slice(0,10) >= start && (a.created_at || '').slice(0,10) <= end);
  }
  return data;
}

async function createAdvance(data) {
  const id = await getNextId('salary_advances');
  const adv = { ...data, status: 'pending', deductionSettled: false, created_at: nowISO() };
  await fbDb.ref(`salary_advances/${id}`).set(adv);
  return { id, ...adv };
}

async function updateAdvanceStatus(id, status, cycle_start, cycle_end) {
  await fbDb.ref(`salary_advances/${id}`).update({ status, cycle_start, cycle_end, updated_at: nowISO() });
}

// ========== BONUSES ==========

async function getBonuses(start, end) {
  const snapshot = await fbDb.ref('bonuses').once('value');
  let data = snapshotToArray(snapshot);
  if (start && end) {
    data = data.filter(b => (b.created_at || '').slice(0,10) >= start && (b.created_at || '').slice(0,10) <= end);
  }
  return data;
}

async function createBonus(data) {
  const id = await getNextId('bonuses');
  const b = { ...data, created_at: nowISO() };
  await fbDb.ref(`bonuses/${id}`).set(b);
  return { id, ...b };
}

async function deleteBonus(id) {
  await fbDb.ref(`bonuses/${id}`).remove();
}

// ========== FUNDS (stored as company_funds in Firebase) ==========

async function getFunds(start, end) {
  const snapshot = await fbDb.ref('company_funds').once('value');
  let data = snapshotToArray(snapshot);
  if (start && end) {
    data = data.filter(f => (f.receive_date || '').slice(0,10) >= start && (f.receive_date || '').slice(0,10) <= end);
  }
  
  // Sort newest first: by receive_date desc, then created_at desc
  data.sort((a, b) => {
    const dateA = a.receive_date || a.created_at || '';
    const dateB = b.receive_date || b.created_at || '';
    const dateCmp = dateB.localeCompare(dateA);
    if (dateCmp !== 0) return dateCmp;
    
    const timeA = a.created_at || '';
    const timeB = b.created_at || '';
    return timeB.localeCompare(timeA);
  });
  
  return data;
}

async function createFund(data) {
  const id = await getNextId('company_funds');
  const fund = { ...data, created_at: nowISO() };
  await fbDb.ref(`company_funds/${id}`).set(fund);
  return { id, ...fund };
}

async function updateFund(id, data) {
  await fbDb.ref(`company_funds/${id}`).update({ ...data, updated_at: nowISO() });
  return { id };
}

async function deleteFund(id) {
  await fbDb.ref(`company_funds/${id}`).remove();
}

// ========== PAYROLL LOCK & PAYMENT STATUS ==========

async function isPayrollLocked(cycleKey) {
  const snapshot = await fbDb.ref(`payroll_locks/${cycleKey}`).once('value');
  return snapshot.exists() && snapshot.val().locked === true;
}

async function lockPayroll(cycleKey) {
  await fbDb.ref(`payroll_locks/${cycleKey}`).set({ locked: true, locked_at: nowISO() });
}

async function unlockPayroll(cycleKey) {
  await fbDb.ref(`payroll_locks/${cycleKey}`).remove();
}

async function setPaymentStatus(riderId, cycleKey, status, final_paid_amount, notes, manual_deductions, manual_bonus) {
  await fbDb.ref(`payment_status/${cycleKey}/${riderId}`).set({
    status, final_paid_amount, notes, manual_deductions, manual_bonus, updated_at: nowISO()
  });
  return { success: true };
}

async function getPaymentStatuses(cycleKey) {
  const snapshot = await fbDb.ref(`payment_status/${cycleKey}`).once('value');
  return snapshot.val() || {};
}

// ========== BIKES ==========

async function getAllBikes() {
  const snapshot = await fbDb.ref('bikes').once('value');
  return snapshotToArray(snapshot);
}

async function createBike(data) {
  const id = await getNextId('bikes');
  const bike = { ...data, status: 'available', created_at: nowISO(), updated_at: nowISO() };
  await fbDb.ref(`bikes/${id}`).set(bike);
  return { id, ...bike };
}

async function updateBike(id, data) {
  await fbDb.ref(`bikes/${id}`).update({ ...data, updated_at: nowISO() });
  const snapshot = await fbDb.ref(`bikes/${id}`).once('value');
  return { id: snapshot.key, ...snapshot.val() };
}

async function deleteBike(id) {
  await fbDb.ref(`bikes/${id}`).remove();
}

// ========== AUDIT LOGS ==========

async function logAudit(action, entity, description, user = 'System User') {
  const id = await getNextId('audit_logs');
  await fbDb.ref(`audit_logs/${id}`).set({
    timestamp: nowISO(),
    user,
    action,
    entity,
    description
  });
}

async function getAuditLogs(limit = 100) {
  const snapshot = await fbDb.ref('audit_logs').limitToLast(limit).once('value');
  return snapshotToArray(snapshot).reverse();
}

// ========== MIGRATION ==========

async function migrateFromSQLite() {
  return { migrated: false, total: 0, message: "Migration tool not configured for current environment" };
}

// ========== RIDER PORTAL AUTH ==========

async function setRiderPassword(riderId, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  await fbDb.ref(`riders/${riderId}`).update({
    portal_password: hash,
    portal_password_plain: plainPassword,
    portal_enabled: true,
    updated_at: nowISO()
  });
  return true;
}

async function authenticateRider(phone, plainPassword) {
  // Find rider by phone number
  const snapshot = await fbDb.ref('riders').once('value');
  let foundRider = null;
  if (snapshot.exists()) {
    snapshot.forEach(child => {
      const r = child.val();
      if (r.phone && r.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, '') && r.portal_enabled) {
        foundRider = { id: child.key, ...r };
      }
    });
  }
  if (!foundRider || !foundRider.portal_password) return null;

  const match = await bcrypt.compare(plainPassword, foundRider.portal_password);
  if (!match) return null;

  // Update last login
  await fbDb.ref(`riders/${foundRider.id}`).update({ last_login: nowISO() });

  // Return rider without sensitive fields
  const { portal_password, ...safeRider } = foundRider;
  return safeRider;
}

async function updateRiderSelfService(riderId, data) {
  // Only allow specific fields to be updated by the rider
  const allowed = ['phone', 'email', 'bank_name', 'bank_account', 'iban', 'date_of_birth', 'nationality'];
  const updates = { updated_at: nowISO() };
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }
  await fbDb.ref(`riders/${riderId}`).update(updates);
  const snap = await fbDb.ref(`riders/${riderId}`).once('value');
  const { portal_password, ...safeRider } = snap.val();
  return { id: snap.key, ...safeRider };
}

async function getRiderMonthlyReport(riderId, start, end) {
  const rider = await getRiderById(riderId);
  if (!rider) return null;

  // Get logs for period
  const logsSnap = await fbDb.ref('daily_logs').once('value');
  const logs = [];
  if (logsSnap.exists()) {
    logsSnap.forEach(child => {
      const l = child.val();
      if (String(l.rider_id) === String(riderId)) {
        const d = (l.log_date || '').slice(0, 10);
        if (d >= start && d <= end) {
          logs.push({ id: child.key, ...l });
        }
      }
    });
  }

  const presentLogs = logs.filter(l => {
    const s = (l.attendance_status || '').toLowerCase();
    return s.includes('present') || s === 'p';
  });

  const absentLogs = logs.filter(l => {
    const s = (l.attendance_status || '').trim();
    return s === 'Absent' || s === 'Missed';
  });

  const weekoffLogs = logs.filter(l => {
    const s = (l.attendance_status || '').toLowerCase().trim();
    return s === 'weekoff' || s === 'week off' || s === 'week_off' || s === 'day off' || s === 'dayoff';
  });

  const totalPrimary = presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0);
  const totalAssociate = presentLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0);
  const totalOrders = totalPrimary + totalAssociate;

  const avgCheckinMin = presentLogs.length > 0
    ? presentLogs.reduce((sum, l) => sum + ((l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0)), 0) / presentLogs.length
    : 0;

  let calculatedSalary = 0;
  if ((rider.rider_type || '').toLowerCase() === 'company') {
    calculatedSalary = rider.base_salary || 1950;
  } else {
    calculatedSalary = totalOrders * 6.8;
  }

  return {
    rider_id: riderId,
    rider_name: rider.name,
    rider_type: rider.rider_type,
    period: { start, end },
    present_days: presentLogs.length,
    absent_days: absentLogs.length,
    weekoff_days: weekoffLogs.length,
    total_primary: totalPrimary,
    total_associate: totalAssociate,
    total_orders: totalOrders,
    avg_checkin_hours: Math.floor(avgCheckinMin / 60),
    avg_checkin_minutes: Math.round(avgCheckinMin % 60),
    calculated_salary: calculatedSalary,
  };
}

// ========== RIDER REQUESTS (Food, Advance, etc.) ==========

async function getUnsettledPaymentsForRider(riderId) {
  const rid = String(riderId);
  const [expSnap, advSnap] = await Promise.all([
    fbDb.ref('expenses').once('value'),
    fbDb.ref('salary_advances').once('value')
  ]);

  const expenses = snapshotToArray(expSnap).filter(e => 
    String(e.rider_id) === rid && 
    (e.is_deductible === 1 || e.is_deductible === true) && 
    !e.deductionSettled
  );

  const advances = snapshotToArray(advSnap).filter(a => 
    String(a.rider_id) === rid && 
    a.status === 'approved' && 
    !a.deductionSettled
  );

  const items = [
    ...expenses.map(e => ({ id: e.id, type: 'deduction', amount: e.amount, date: e.expense_date || e.created_at, description: e.category + (e.notes ? `: ${e.notes}` : '') })),
    ...advances.map(a => ({ id: a.id, type: 'advance', amount: a.amount, date: a.created_at, description: 'Salary Advance' }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    total_unsettled: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    total_advances: advances.reduce((sum, a) => sum + (a.amount || 0), 0),
    items
  };
}

async function createRiderRequest(data) {
  const id = await getNextId('rider_requests');
  const request = {
    ...data,
    status: 'pending',
    created_at: nowISO(),
    updated_at: nowISO()
  };
  await fbDb.ref(`rider_requests/${id}`).set(request);
  return { id, ...request };
}

async function getRiderRequests(status = 'pending') {
  const snapshot = await fbDb.ref('rider_requests').once('value');
  let data = snapshotToArray(snapshot);
  if (status) {
    data = data.filter(r => r.status === status);
  }
  return data.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function updateRiderRequestStatus(id, status, adminNote = '', processedBy = 'Admin') {
  const requestSnap = await fbDb.ref(`rider_requests/${id}`).once('value');
  if (!requestSnap.exists()) throw new Error('Request not found');
  const request = requestSnap.val();

  await fbDb.ref(`rider_requests/${id}`).update({
    status,
    admin_note: adminNote || '',
    processed_by: processedBy,
    updated_at: nowISO()
  });

  if (status === 'approved') {
    // If approved, create the actual expense/advance record
    if (request.category === 'Advance') {
      await createAdvance({
        rider_id: request.rider_id,
        rider_name: request.rider_name,
        amount: request.amount,
        notes: `Rider Request: ${request.description || ''}`,
        source: 'rider_request',
        request_id: id
      });
    } else {
      await createExpense({
        expense_date: todayLocal(),
        category: request.category,
        amount: request.amount,
        rider_id: request.rider_id,
        rider_name: request.rider_name,
        is_deductible: true,
        notes: `Rider Request: ${request.description || ''}`,
        source: 'rider_request',
        request_id: id
      });
    }
  }

  return { success: true };
}

async function getMyRequests(riderId) {
  const snapshot = await fbDb.ref('rider_requests').once('value');
  const data = snapshotToArray(snapshot);
  return data
    .filter(r => String(r.rider_id) === String(riderId))
    .sort((a, b) => (b.created_at || b.updated_at || '').localeCompare(a.created_at || a.updated_at || ''));
}

async function deleteRiderRequest(id, riderId) {
  const snap = await fbDb.ref(`rider_requests/${id}`).once('value');
  if (!snap.exists()) throw new Error('Request not found');
  const request = snap.val();
  if (String(request.rider_id) !== String(riderId)) throw new Error('Unauthorized');
  if (request.status !== 'pending') throw new Error('Only pending requests can be deleted');
  
  await fbDb.ref(`rider_requests/${id}`).remove();
  return { success: true };
}

module.exports = {
  initDb, getDb, getAllRiders, getRiderById, createRider, updateRider,
  archiveRider, deleteRiderPermanently, getDailyLogs, getDailyLogsByRider,
  getMissingLogs, createDailyLog, updateDailyLog, deleteDailyLog,
  getDashboardStats, calculatePayroll, getExpenseStats, getExpenses,
  createExpense, updateExpense, deleteExpense, settleExpenseDeduction,
  settleRiderDeductions, getAdvances, createAdvance, updateAdvanceStatus,
  getBonuses, createBonus, deleteBonus, getFunds, createFund, updateFund,
  deleteFund, isPayrollLocked, lockPayroll, unlockPayroll, setPaymentStatus,
  getPaymentStatuses, getAllBikes, createBike, updateBike, deleteBike,
  getAuditLogs, migrateFromSQLite,
  // Rider Portal
  setRiderPassword, authenticateRider, updateRiderSelfService, getRiderMonthlyReport,
  getUnsettledPaymentsForRider, createRiderRequest, getRiderRequests, updateRiderRequestStatus,
  getMyRequests, deleteRiderRequest
};
