// ========================================
//  Database Operations - Supabase (PostgreSQL)
// ========================================

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

let supabase;

// Initialize Supabase
function initDb() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
      console.warn("⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.");
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('  🐘 Supabase connected');
  return Promise.resolve();
}

function getDb() {
  return supabase;
}

function nowISO() {
  return new Date().toISOString();
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helper to fetch all rows paginated to bypass 1000 row limit
async function fetchPaginated(queryBuilderOrFactory) {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    // Support both a query builder and a factory function
    const qb = typeof queryBuilderOrFactory === 'function' ? queryBuilderOrFactory() : queryBuilderOrFactory;
    const { data, error } = await qb.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
    // If a raw query builder was passed (not a factory), we can't reuse it
    if (typeof queryBuilderOrFactory !== 'function') break;
  }
  return allData;
}

// ========== RIDER OPERATIONS ==========

async function getAllRiders(status = 'active') {
  let query = supabase.from('riders').select('*').order('name');
  if (status) {
    query = query.eq('status', status.toLowerCase());
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getRiderById(id) {
  const { data, error } = await supabase.from('riders').select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
  return data || null;
}

async function createRider(riderData) {
  const { data, error } = await supabase.from('riders').insert([{
    ...riderData,
    rider_type: riderData.rider_type || 'company',
    status: 'active',
    created_at: nowISO(),
    updated_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function updateRider(id, riderData) {
  const { data, error } = await supabase.from('riders')
    .update({ ...riderData, updated_at: nowISO() })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

async function updateRiderLocation(id, lat, lng) {
  const { error } = await supabase.from('riders')
    .update({
      last_lat: lat,
      last_lng: lng,
      last_location_update: nowISO(),
      gps_status: 'synced',
      updated_at: nowISO()
    })
    .eq('id', id);
  if (error) {
    if (error.message && error.message.includes("gps_status")) {
      console.warn("⚠️ Column 'gps_status' not found in 'riders' table. Retrying update without 'gps_status'...");
      const { error: retryError } = await supabase.from('riders')
        .update({
          last_lat: lat,
          last_lng: lng,
          last_location_update: nowISO(),
          updated_at: nowISO()
        })
        .eq('id', id);
      if (retryError) throw retryError;
      return { success: true };
    }
    throw error;
  }
  return { success: true };
}

async function updateRiderGpsStatus(id, gpsStatus) {
  const { error } = await supabase.from('riders')
    .update({
      gps_status: gpsStatus,
      updated_at: nowISO()
    })
    .eq('id', id);
  if (error) {
    if (error.message && error.message.includes("gps_status")) {
      console.warn("⚠️ Column 'gps_status' not found in 'riders' table. Ignoring GPS status heartbeat update...");
      return { success: true, warning: 'gps_status column missing' };
    }
    throw error;
  }
  return { success: true };
}

async function updateRiderOnlineStatus(id, isOnline) {
  const updates = {
    is_online: isOnline,
    updated_at: nowISO()
  };
  if (!isOnline) {
    updates.gps_status = 'offline';
  }
  const { error } = await supabase.from('riders')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}

async function archiveRider(id) {
  return await updateRider(id, { status: 'inactive' });
}

async function deleteRiderPermanently(id) {
  const { error } = await supabase.from('riders').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// ========== APP CONFIG ==========

async function getAppVersion() {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', 'version').single();
  if (error || !data) return { latest_version: "1.1.0", min_version: "1.0.0", download_url: "", force: false };
  return data.value;
}

async function setAppVersion(configData) {
  const { error } = await supabase.from('app_config').upsert({
    key: 'version',
    value: {
      latest_version: configData.latest_version || "1.1.0",
      min_version: configData.min_version || "1.0.0",
      download_url: configData.download_url || "",
      force: configData.force === true || configData.force === 'true'
    },
    updated_at: nowISO()
  });
  if (error) throw error;
}



async function getMissingLogs(date) {
  const riders = await getAllRiders('active');
  const logs = await getDailyLogs(date, date);
  const loggedRiderIds = new Set(logs.map(l => String(l.rider_id)));
  return riders.filter(r => !loggedRiderIds.has(String(r.id)));
}

function sanitizeDailyLog(logData) {
  if (!logData || typeof logData !== 'object') return {};
  const validKeys = [
    'rider_id',
    'rider_name',
    'log_date',
    'attendance_status',
    'primary_orders',
    'associate_orders',
    'checkin_hours',
    'checkin_minutes',
    'notes',
    'screenshot',
    'submitted_at',
    'absent_reason'
  ];
  const sanitized = {};
  for (const key of validKeys) {
    if (logData[key] !== undefined) {
      sanitized[key] = logData[key];
    }
  }
  return sanitized;
}

async function createDailyLog(logData) {
  const sanitized = sanitizeDailyLog(logData);
  const { data, error } = await supabase.from('daily_logs').insert([{
    ...sanitized,
    created_at: nowISO(),
    updated_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function updateDailyLog(id, logData) {
  const sanitized = sanitizeDailyLog(logData);
  const { data, error } = await supabase.from('daily_logs')
    .update({ ...sanitized, updated_at: nowISO() })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

async function deleteDailyLog(id) {
  const { error } = await supabase.from('daily_logs').delete().eq('id', id);
  if (error) throw error;
}

// ========== DASHBOARD STATS ==========

async function getDashboardStats(start, end) {
  const activeRiders = await getAllRiders('active');
  const [pLogs, tLogs] = await Promise.all([
    fetchPaginated(() => supabase.from('daily_logs').select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes').gte('log_date', start).lte('log_date', end)),
    fetchPaginated(() => supabase.from('daily_logs').select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes').eq('log_date', todayLocal()))
  ]);

  const now = new Date();
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(now.getDate() + 30);
  
  const expiring_iqamas = activeRiders.filter(r => {
    if (!r.iqama_expiry) return false;
    const expiry = new Date(r.iqama_expiry);
    return expiry >= now && expiry <= thirtyDaysLater;
  });

  const low_checkins_today = tLogs.filter(l => {
    if (l.attendance_status !== 'Present') return false;
    const totalMinutes = (l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0);
    return totalMinutes < 11 * 60;
  });

  const riderPerf = {};
  pLogs.forEach(l => {
    const rid = String(l.rider_id);
    if (!riderPerf[rid]) riderPerf[rid] = { id: rid, name: l.rider_name || 'Unknown', total: 0 };
    riderPerf[rid].total += (l.primary_orders || 0) + (l.associate_orders || 0);
  });

  const top_riders = Object.values(riderPerf).sort((a, b) => b.total - a.total).slice(0, 7);
  const low_riders = Object.values(riderPerf).sort((a, b) => a.total - b.total).slice(0, 5);

  return {
    total_active: activeRiders.length,
    total_company: activeRiders.filter(r => (r.rider_type || '').toLowerCase() === 'company').length,
    total_freelancer: activeRiders.filter(r => (r.rider_type || '').toLowerCase() !== 'company').length,
    logged_today: tLogs.length,
    pending_today: Math.max(0, activeRiders.length - tLogs.length),
    low_checkins_today,
    expiring_iqamas,
    top_riders,
    low_riders,
    period_total_orders: pLogs.reduce((sum, l) => sum + (l.primary_orders || 0) + (l.associate_orders || 0), 0),
    period_primary_orders: pLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0),
    period_associate_orders: pLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0),
    average_orders_per_day: 0,
    average_checkin_hours: 0
  };
}

// ========== EXPENSE OPERATIONS ==========

async function getExpenseStats() {
  const [funds, expenses] = await Promise.all([
    supabase.from('company_funds').select('amount'),
    supabase.from('expenses').select('amount, category')
  ]);

  const totalReceived = (funds.data || []).reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
  const totalExpenses = (expenses.data || []).reduce((sum, e) => {
    if (e.category === 'Manual Deduction') return sum;
    return sum + (parseFloat(e.amount) || 0);
  }, 0);

  const usedFromIRL = Math.min(totalExpenses, totalReceived);
  const fromMyPocket = Math.max(0, totalExpenses - totalReceived);
  const remainingIRL = totalReceived - usedFromIRL;

  return {
    total_received: totalReceived,
    used_from_irl: usedFromIRL,
    remaining_irl: remainingIRL,
    from_my_pocket: fromMyPocket,
    total_expenses: totalExpenses,
    count: (expenses.data || []).length
  };
}

async function getExpenses(start, end) {
  const data = await fetchPaginated(() => {
    let q = supabase.from('expenses').select('*');
    if (start && end) {
      q = q.gte('expense_date', start).lte('expense_date', end);
    }
    return q;
  });
  
  return data.map(e => ({
    ...e,
    rider_name: e.rider_name,
    receipt_base64: e.receipt_url || e.receipt_base64
  })).sort((a, b) => {
    const dateA = a.expense_date || a.created_at || '';
    const dateB = b.expense_date || b.created_at || '';
    const dateCmp = dateB.localeCompare(dateA);
    if (dateCmp !== 0) return dateCmp;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
}

async function createExpense(expData) {
  if (expData.rider_id && (!expData.rider_name || expData.rider_name === 'Rider')) {
    const rider = await getRiderById(expData.rider_id);
    if (rider) expData.rider_name = rider.name;
  }
  
  const { receipt_base64, ...rest } = expData;
  const insertData = {
    ...rest,
    "deductionSettled": false,
    created_at: nowISO()
  };
  if (receipt_base64 !== undefined) insertData.receipt_url = receipt_base64;
  
  const { data, error } = await supabase.from('expenses').insert([insertData]).select().single();
  if (error) throw error;
  await logAudit('CREATE', 'Expense', `Logged expense: ${expData.category} - ${expData.amount} SAR`);
  return { ...data, receipt_base64: data.receipt_url };
}

async function updateExpense(id, expData) {
  if (expData.rider_id && (!expData.rider_name || expData.rider_name === 'Rider')) {
    const rider = await getRiderById(expData.rider_id);
    if (rider) expData.rider_name = rider.name;
  }
  const { receipt_base64, ...rest } = expData;
  const updateData = { ...rest, updated_at: nowISO() };
  if (receipt_base64 !== undefined) updateData.receipt_url = receipt_base64;
  
  const { error } = await supabase.from('expenses').update(updateData).eq('id', id);
  if (error) throw error;
  return { id };
}

async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

async function settleExpenseDeduction(id, settledBy) {
  const { error } = await supabase.from('expenses').update({
    "deductionSettled": true,
    settled_by: settledBy,
    "settledBy": settledBy,
    settled_at: nowISO(),
    "settledDate": nowISO()
  }).eq('id', id);
  if (error) throw error;
}

// ========== SALARY ADVANCES ==========

async function getAdvances(start, end) {
  let query = supabase.from('salary_advances').select('*');
  const { data, error } = await query;
  if (error) throw error;
  
  let advs = data || [];
  if (start && end) {
    advs = advs.filter(a => (a.created_at || '').slice(0,10) >= start && (a.created_at || '').slice(0,10) <= end);
  }
  return advs;
}

async function createAdvance(advData) {
  const { data, error } = await supabase.from('salary_advances').insert([{
    ...advData,
    status: 'pending',
    "deductionSettled": false,
    created_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function updateAdvanceStatus(id, status, cycle_start, cycle_end) {
  const { error } = await supabase.from('salary_advances').update({
    status, cycle_start, cycle_end, updated_at: nowISO()
  }).eq('id', id);
  if (error) throw error;
}

// ========== BONUSES ==========

async function getBonuses(start, end) {
  let query = supabase.from('bonuses').select('*');
  const { data, error } = await query;
  if (error) throw error;
  let bonuses = data || [];
  if (start && end) {
    bonuses = bonuses.filter(b => (b.created_at || '').slice(0,10) >= start && (b.created_at || '').slice(0,10) <= end);
  }
  return bonuses;
}

async function createBonus(bonusData) {
  const { data, error } = await supabase.from('bonuses').insert([{
    ...bonusData,
    created_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function deleteBonus(id) {
  const { error } = await supabase.from('bonuses').delete().eq('id', id);
  if (error) throw error;
}

// ========== FUNDS ==========

async function getFunds(start, end) {
  const data = await fetchPaginated(() => {
    let q = supabase.from('company_funds').select('*');
    if (start && end) {
      q = q.gte('receive_date', start).lte('receive_date', end);
    }
    return q;
  });
  return data.map(f => ({
    ...f,
    description: f.source || f.description
  })).sort((a, b) => {
    const dateA = a.receive_date || a.created_at || '';
    const dateB = b.receive_date || b.created_at || '';
    const dateCmp = dateB.localeCompare(dateA);
    if (dateCmp !== 0) return dateCmp;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
}

async function createFund(fundData) {
  const { description, receipt_base64, ...rest } = fundData;
  const insertData = {
    ...rest,
    source: description || rest.source,
    created_at: nowISO()
  };
  
  const { data, error } = await supabase.from('company_funds').insert([insertData]).select().single();
  if (error) throw error;
  return { ...data, description: data.source };
}

async function updateFund(id, fundData) {
  const { description, receipt_base64, ...rest } = fundData;
  const updateData = { ...rest, updated_at: nowISO() };
  if (description) updateData.source = description;
  
  const { error } = await supabase.from('company_funds').update(updateData).eq('id', id);
  if (error) throw error;
  return { id };
}

async function deleteFund(id) {
  const { error } = await supabase.from('company_funds').delete().eq('id', id);
  if (error) throw error;
}

async function getDailyLogs(periodStart, periodEnd) {
  const data = await fetchPaginated(() => {
    let q = supabase.from('daily_logs').select('*');
    if (periodStart && periodEnd) {
      q = q.gte('log_date', periodStart).lte('log_date', periodEnd);
    }
    return q;
  });
  return data.sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
}

async function getDailyLogsByRider(riderId, start, end) {
  const logs = await fetchPaginated(() => supabase.from('daily_logs').select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes').eq('rider_id', riderId).gte('log_date', start).lte('log_date', end));
  return logs.sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
}

// ========== PAYROLL LOGIC ==========
async function settleRiderDeductions(riderId, settledBy) {
  const settleData = {
    "deductionSettled": true,
    settled_by: settledBy,
    "settledBy": settledBy,
    settled_at: nowISO(),
    "settledDate": nowISO()
  };
  
  const [expUpdate, advUpdate] = await Promise.all([
    supabase.from('expenses').update(settleData).eq('rider_id', riderId).eq('is_deductible', true).eq('deductionSettled', false),
    supabase.from('salary_advances').update(settleData).eq('rider_id', riderId).eq('status', 'approved').eq('deductionSettled', false)
  ]);
  
  return (expUpdate.count || 0) + (advUpdate.count || 0);
}

async function calculatePayroll(periodStart, periodEnd) {
  const riders = await getAllRiders();
  
  // Run sequentially to avoid connection pool exhaustion and statement timeouts
  const bonuses = await fetchPaginated(() => 
    supabase.from('bonuses')
      .select('*')
      .gte('created_at', periodStart + 'T00:00:00.000Z')
      .lte('created_at', periodEnd + 'T23:59:59.999Z')
  );
  
  const advances = await fetchPaginated(() => 
    supabase.from('salary_advances')
      .select('*')
      .eq('status', 'approved')
      .eq('deductionSettled', false)
  );
  
  const expenses = await fetchPaginated(() => 
    supabase.from('expenses')
      .select('*')
      .eq('is_deductible', true)
      .eq('deductionSettled', false)
  );
  
  const payStatuses = await fetchPaginated(() => 
    supabase.from('payment_status')
      .select('*')
      .eq('cycle_key', `${periodStart}_${periodEnd}`)
  );
  
  const logs = await fetchPaginated(() => 
    supabase.from('daily_logs')
      .select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes')
      .gte('log_date', periodStart)
      .lte('log_date', periodEnd)
  );

  const allPayStatuses = {};
  payStatuses.forEach(p => {
    allPayStatuses[p.rider_id] = p;
  });

  const logsByRider = {};
  logs.forEach(log => {
    const rid = String(log.rider_id);
    if (!logsByRider[rid]) logsByRider[rid] = [];
    logsByRider[rid].push(log);
  });

  const results = [];
  
  for (const rider of riders) {
    try {
      const riderId = String(rider.id);
      const riderLogs = logsByRider[riderId] || [];
      
      if (rider.status !== 'active' && riderLogs.length === 0) continue;

      const presentLogs = riderLogs.filter(l => (l.attendance_status || '').toLowerCase().includes('present') || l.attendance_status === 'p');
      const absentLogs = riderLogs.filter(l => (l.attendance_status || '').trim() === 'Absent' || l.attendance_status === 'Missed');
      const weekoffLogs = riderLogs.filter(l => ['weekoff', 'week off', 'week_off', 'day off', 'dayoff'].includes((l.attendance_status || '').toLowerCase().trim()));

      const totalPrimaryOrders = presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0);
      const totalAssociateOrders = presentLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0);
      const totalOrders = totalPrimaryOrders + totalAssociateOrders;
      
      let calculatedSalary = 0;
      if ((rider.rider_type || '').toLowerCase() === 'company') {
        calculatedSalary = rider.base_salary || 1950;
      } else {
        calculatedSalary = totalOrders * 6.8;
      }

      // Bonuses
      let totalBonuses = 0;
      bonuses.filter(b => String(b.rider_id) === riderId).forEach(b => { totalBonuses += b.amount || 0; });

      // Deductions
      let totalDeductions = 0;
      expenses.filter(e => String(e.rider_id) === riderId && !(e.category || '').toLowerCase().includes('medical')).forEach(e => { totalDeductions += e.amount || 0; });
      
      let totalAdvances = 0;
      advances.filter(a => String(a.rider_id) === riderId).forEach(a => { totalAdvances += a.amount || 0; });

      const totalDedSum = totalDeductions + totalAdvances;
      const netPay = (calculatedSalary + totalBonuses) - totalDedSum;

      const avgCheckinMinutes = presentLogs.length > 0 ? presentLogs.reduce((sum, l) => sum + ((l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0)), 0) / presentLogs.length : 0;
      const warnings = [];
      const rType = (rider.rider_type || '').toLowerCase();
      
      if (absentLogs.length > 0) warnings.push({ type: 'attendance', message: `Missed ${absentLogs.length} day(s)` });
      else if (rType === 'company' && presentLogs.length < 26 && presentLogs.length > 0) warnings.push({ type: 'attendance', message: `Short attendance — Logged only ${presentLogs.length} of 26 required days` });
      
      if (avgCheckinMinutes > 0 && avgCheckinMinutes < 660) warnings.push({ type: 'checkin', message: `Low avg hours (${Math.floor(avgCheckinMinutes/60)}h ${Math.round(avgCheckinMinutes%60)}m)` });
      if (rType === 'company' && presentLogs.length > 0 && totalOrders < 520) warnings.push({ type: 'orders', message: `Missed target by ${520 - totalOrders} orders (Total: ${totalOrders}/520)` });
      if (totalDedSum > 0) warnings.push({ type: 'debt', message: `Unsettled Debt (${totalDedSum} SAR)` });

      results.push({
        rider_id: rider.id,
        rider_name: rider.name,
        rider_type: rider.rider_type,
        client_company: rider.client_company,
        base_salary: rType === 'company' ? (rider.base_salary || 1950) : 0,
        calculated_salary: calculatedSalary,
        total_primary_orders: totalPrimaryOrders,
        total_associate_orders: totalAssociateOrders,
        total_orders: totalOrders,
        present_days: presentLogs.length,
        absent_days: absentLogs.length,
        weekoff_days: weekoffLogs.length,
        avg_checkin: `${Math.floor(avgCheckinMinutes/60)}:${String(Math.round(avgCheckinMinutes%60)).padStart(2, '0')}`,
        deductions: totalDedSum,
        total_bonuses: totalBonuses,
        net_pay: netPay,
        payment_status: allPayStatuses[rider.id] || { status: 'pending' },
        warnings: warnings
      });
    } catch (err) { console.error(`Calc error for rider ${rider.id}:`, err); }
  }
  return results;
}

// ========== PAYROLL LOCK & PAYMENT STATUS ==========
async function isPayrollLocked(cycleKey) {
  const { data, error } = await supabase.from('payroll_locks').select('locked').eq('cycle_key', cycleKey).single();
  return data ? data.locked === true : false;
}

async function lockPayroll(cycleKey) {
  await supabase.from('payroll_locks').upsert({ cycle_key: cycleKey, locked: true, locked_at: nowISO() });
}

async function unlockPayroll(cycleKey) {
  await supabase.from('payroll_locks').delete().eq('cycle_key', cycleKey);
}

async function setPaymentStatus(riderId, cycleKey, status, final_paid_amount, notes, manual_deductions, manual_bonus) {
  await supabase.from('payment_status').upsert({
    cycle_key: cycleKey,
    rider_id: String(riderId),
    status, final_paid_amount, notes, manual_deductions, manual_bonus, updated_at: nowISO()
  }, { onConflict: 'cycle_key, rider_id' });
  return { success: true };
}

async function getPaymentStatuses(cycleKey) {
  const data = await fetchPaginated(() => supabase.from('payment_status').select('*').eq('cycle_key', cycleKey));
  const result = {};
  data.forEach(p => { result[p.rider_id] = p; });
  return result;
}

async function deleteRiderCycleLogs(riderId, start, end) {
  const cycleKey = `${start}_${end}`;
  
  // 1. Delete daily logs in range for this rider
  const { error: logsError } = await supabase
    .from('daily_logs')
    .delete()
    .eq('rider_id', parseInt(riderId))
    .gte('log_date', start)
    .lte('log_date', end);
  if (logsError) throw logsError;

  // 2. Delete payment status override for this rider and cycle key
  const { error: payError } = await supabase
    .from('payment_status')
    .delete()
    .eq('rider_id', String(riderId))
    .eq('cycle_key', cycleKey);
  if (payError) throw payError;

  return { success: true };
}

// ========== BIKES ==========
async function getAllBikes() {
  const data = await fetchPaginated(() => supabase.from('bikes').select('*'));
  return data;
}

async function createBike(bikeData) {
  const { data, error } = await supabase.from('bikes').insert([{ ...bikeData, status: 'available', created_at: nowISO(), updated_at: nowISO() }]).select().single();
  if (error) throw error;
  return data;
}

async function updateBike(id, bikeData) {
  const { data, error } = await supabase.from('bikes').update({ ...bikeData, updated_at: nowISO() }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteBike(id) {
  const { error } = await supabase.from('bikes').delete().eq('id', id);
  if (error) throw error;
}

// ========== AUDIT LOGS ==========
async function logAudit(action, entity, description, user = 'System User') {
  await supabase.from('audit_logs').insert([{ timestamp: nowISO(), "user": user, action, entity, description }]);
}

async function getAuditLogs(limit = 100) {
  const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ========== RIDER PORTAL AUTH ==========
async function setRiderPassword(riderId, plainPassword) {
  const hash = await bcrypt.hash(plainPassword, 10);
  await supabase.from('riders').update({
    portal_password: hash,
    portal_password_plain: plainPassword,
    portal_enabled: true,
    updated_at: nowISO()
  }).eq('id', riderId);
  return true;
}

async function authenticateRider(phone, plainPassword) {
  const riders = await fetchPaginated(() => supabase.from('riders').select('*').eq('portal_enabled', true));
  const foundRider = riders.find(r => r.phone && r.phone.replace(/\s+/g, '') === phone.replace(/\s+/g, ''));
  if (!foundRider || !foundRider.portal_password) return null;

  const match = await bcrypt.compare(plainPassword, foundRider.portal_password);
  if (!match) return null;

  await supabase.from('riders').update({ last_login: nowISO() }).eq('id', foundRider.id);
  const { portal_password, ...safeRider } = foundRider;
  return safeRider;
}

async function updateRiderSelfService(riderId, riderData) {
  const allowed = ['phone', 'email', 'bank_name', 'bank_account', 'iban', 'date_of_birth', 'nationality', 'iqama_number', 'iqama_expiry', 'noon_id', 'doc_vault'];
  const updates = { updated_at: nowISO() };
  for (const key of allowed) {
    if (riderData[key] !== undefined) updates[key] = riderData[key];
  }
  const { data, error } = await supabase.from('riders').update(updates).eq('id', riderId).select().single();
  if (error) throw error;

  // Intercept vehicle authorization and insurance expiry dates to update the assigned bike
  if (riderData.authorization_expiry !== undefined || riderData.insurance_expiry !== undefined) {
    if (data.bike_id) {
      const bikeUpdates = {};
      if (riderData.authorization_expiry !== undefined) bikeUpdates.authorization_expiry = riderData.authorization_expiry;
      if (riderData.insurance_expiry !== undefined) bikeUpdates.insurance_expiry = riderData.insurance_expiry;
      await updateBike(data.bike_id, bikeUpdates);
    }
  }

  const { portal_password, ...safeRider } = data;
  return safeRider;
}

async function getRiderMonthlyReport(riderId, start, end) {
  const rider = await getRiderById(riderId);
  if (!rider) return null;

  const logs = await getDailyLogsByRider(riderId, start, end);
  const presentLogs = logs.filter(l => (l.attendance_status || '').toLowerCase().includes('present') || l.attendance_status === 'p');
  const absentLogs = logs.filter(l => (l.attendance_status || '').trim() === 'Absent' || l.attendance_status === 'Missed');
  const weekoffLogs = logs.filter(l => ['weekoff', 'week off', 'week_off', 'day off', 'dayoff'].includes((l.attendance_status || '').toLowerCase().trim()));

  const totalOrders = presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0) + (l.associate_orders || 0), 0);
  const avgCheckinMin = presentLogs.length > 0 ? presentLogs.reduce((sum, l) => sum + ((l.checkin_hours || 0) * 60 + (l.checkin_minutes || 0)), 0) / presentLogs.length : 0;

  return {
    rider_id: riderId,
    rider_name: rider.name,
    rider_type: rider.rider_type,
    period: { start, end },
    present_days: presentLogs.length,
    absent_days: absentLogs.length,
    weekoff_days: weekoffLogs.length,
    total_primary: presentLogs.reduce((sum, l) => sum + (l.primary_orders || 0), 0),
    total_associate: presentLogs.reduce((sum, l) => sum + (l.associate_orders || 0), 0),
    total_orders: totalOrders,
    avg_checkin_hours: Math.floor(avgCheckinMin / 60),
    avg_checkin_minutes: Math.round(avgCheckinMin % 60),
    calculated_salary: (rider.rider_type || '').toLowerCase() === 'company' ? (rider.base_salary || 1950) : totalOrders * 6.8,
  };
}

async function getUnsettledPaymentsForRider(riderId) {
  const [expenses, advances] = await Promise.all([
    supabase.from('expenses').select('*').eq('rider_id', riderId).eq('is_deductible', true).eq('deductionSettled', false),
    supabase.from('salary_advances').select('*').eq('rider_id', riderId).eq('status', 'approved').eq('deductionSettled', false)
  ]);

  const items = [
    ...(expenses.data || []).map(e => ({ id: e.id, type: 'deduction', amount: e.amount, date: e.expense_date || e.created_at, description: e.category })),
    ...(advances.data || []).map(a => ({ id: a.id, type: 'advance', amount: a.amount, date: a.created_at, description: 'Salary Advance' }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    total_unsettled: (expenses.data || []).reduce((sum, e) => sum + (e.amount || 0), 0),
    total_advances: (advances.data || []).reduce((sum, a) => sum + (a.amount || 0), 0),
    items
  };
}

async function createRiderRequest(requestData) {
  const { data, error } = await supabase.from('rider_requests').insert([{
    ...requestData, status: 'pending', created_at: nowISO(), updated_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function getRiderRequests(status = 'pending') {
  let query = supabase.from('rider_requests').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') {
    if (status === 'history') {
      query = query.in('status', ['approved', 'rejected']);
    } else {
      query = query.eq('status', status);
    }
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function updateRiderRequestStatus(id, status, adminNote = '', processedBy = 'Admin', processedByPhoto = '', receiptBase64 = null) {
  const { data: request, error: fetchErr } = await supabase.from('rider_requests').select('*').eq('id', id).single();
  if (fetchErr || !request) throw new Error('Request not found');

  await supabase.from('rider_requests').update({ status, admin_note: adminNote, processed_by: processedBy, updated_at: nowISO() }).eq('id', id);

  const msg = status === 'approved' ? `Your ${request.category} request has been approved.` : `Your request was rejected.`;
  await createNotification({ rider_id: request.rider_id, type: status === 'approved' ? 'request_approved' : 'request_rejected', title: `Request ${status.toUpperCase()}`, message: msg, processed_by_name: processedBy, processed_by_photo: processedByPhoto });

  if (status === 'approved') {
    if (request.category === 'Advance') {
      await createAdvance({ rider_id: request.rider_id, rider_name: request.rider_name, amount: request.amount, notes: `Rider Request: ${request.description || ''}`, source: 'rider_request', request_id: id });
      await createExpense({ expense_date: todayLocal(), category: request.category, amount: request.amount, rider_id: request.rider_id, rider_name: request.rider_name, is_deductible: false, source: 'rider_request', request_id: id, receipt_base64: receiptBase64 });
    } else {
      await createExpense({ expense_date: todayLocal(), category: request.category, amount: request.amount, rider_id: request.rider_id, rider_name: request.rider_name, is_deductible: true, source: 'rider_request', request_id: id, receipt_base64: receiptBase64 });
    }
  }
  return { success: true, rider_id: request.rider_id, category: request.category };
}

async function getMyRequests(riderId) {
  const { data, error } = await supabase.from('rider_requests').select('*').eq('rider_id', riderId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function deleteRiderRequest(id, riderId) {
  const { data: request } = await supabase.from('rider_requests').select('*').eq('id', id).single();
  if (!request) throw new Error('Request not found');
  if (String(request.rider_id) !== String(riderId)) throw new Error('Unauthorized');
  if (request.status !== 'pending') throw new Error('Only pending requests can be deleted');
  await supabase.from('rider_requests').delete().eq('id', id);
  return { success: true };
}

// ========== NOTIFICATIONS & PUSH TOKENS ==========
async function saveRiderPushToken(riderId, pushToken) {
  await supabase.from('riders').update({ push_token: pushToken }).eq('id', riderId);
  return { success: true };
}

async function createNotification(notifData) {
  const { data, error } = await supabase.from('notifications').insert([{ ...notifData, read: false, created_at: nowISO() }]).select().single();
  if (error) throw error;
  return data;
}

async function getNotificationsForRider(riderId) {
  const { data, error } = await supabase.from('notifications').select('*').eq('rider_id', riderId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function markNotificationRead(id, riderId) {
  await supabase.from('notifications').update({ read: true, read_at: nowISO() }).eq('id', id).eq('rider_id', riderId);
  return { success: true };
}

// ========== ADMIN PROFILES ==========
async function getAdminProfiles() {
  const { data, error } = await supabase.from('admin_profiles').select('*');
  if (error) throw error;
  const profiles = {};
  (data || []).forEach(p => { profiles[p.email_key] = p; });
  return profiles;
}

async function getAdminProfile(emailKey) {
  const { data, error } = await supabase.from('admin_profiles').select('*').eq('email_key', emailKey).single();
  return data || null;
}

async function updateAdminProfile(emailKey, profileData) {
  await supabase.from('admin_profiles').upsert({ email_key: emailKey, ...profileData, updated_at: nowISO() });
  return { success: true };
}

async function migrateFromSQLite() { return { migrated: false, total: 0, message: "Dep" }; }

module.exports = {
  initDb, getDb, getAllRiders, getRiderById, createRider, updateRider,
  archiveRider, deleteRiderPermanently, getDailyLogs, getDailyLogsByRider,
  getMissingLogs, createDailyLog, updateDailyLog, deleteDailyLog,
  getDashboardStats, calculatePayroll, getExpenseStats, getExpenses,
  createExpense, updateExpense, deleteExpense, settleExpenseDeduction,
  settleRiderDeductions, getAdvances, createAdvance, updateAdvanceStatus,
  getBonuses, createBonus, deleteBonus, getFunds, createFund, updateFund,
  deleteFund, isPayrollLocked, lockPayroll, unlockPayroll, setPaymentStatus,
  getPaymentStatuses, deleteRiderCycleLogs, getAllBikes, createBike, updateBike, deleteBike,
  getAuditLogs, logAudit, migrateFromSQLite,
  // Rider Portal
  // Rider Portal
  setRiderPassword, authenticateRider, updateRiderSelfService, getRiderMonthlyReport,
  getUnsettledPaymentsForRider, createRiderRequest, getRiderRequests, updateRiderRequestStatus,
  getMyRequests, deleteRiderRequest,
  // Tracking
  updateRiderOnlineStatus, updateRiderLocation, updateRiderGpsStatus,
  // Notifications
  saveRiderPushToken, createNotification, getNotificationsForRider, markNotificationRead,
  // Admin Profiles
  getAdminProfiles, getAdminProfile, updateAdminProfile,
  // Auth Users
  getAuthUser, upsertAuthUser,
  // Settings
  getSettings, updateSettings,
  // App Version
  getAppVersion, setAppVersion,
  // Tracking Shutdown
  isTrackingShutdown, setTrackingShutdown
};

async function getSettings(key) {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', key).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? data.value : null;
}

async function updateSettings(key, value) {
  const { error } = await supabase.from('app_config').upsert({ key, value, updated_at: nowISO() });
  if (error) throw error;
  return { success: true };
}

async function isTrackingShutdown() {
  const status = await getSettings('tracking_status');
  return status ? status.shutdown === true : false;
}

async function setTrackingShutdown(shutdown) {
  await updateSettings('tracking_status', { shutdown, updated_at: nowISO() });
  return { success: true };
}

async function getAuthUser(email) {
  try {
    const { data, error } = await supabase.from('auth_users').select('*').eq('email', email.toLowerCase()).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows
      if (error.code === '42P01') {
        throw new Error("Table 'auth_users' is missing in Supabase. Please run the SQL script to create it.");
      }
      throw error;
    }
    return data || null;
  } catch (err) {
    console.error('getAuthUser error:', err.message);
    throw err;
  }
}

async function upsertAuthUser(userData) {
  const { error } = await supabase.from('auth_users').upsert({
    email: userData.email.toLowerCase(),
    name: userData.name,
    role: userData.role,
    password_hash: userData.password_hash,
    created_at: userData.created_at || nowISO()
  });
  if (error) throw error;
  return { success: true };
}

