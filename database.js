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

// Helper to upload base64 images to Supabase Storage and return public URL
async function uploadBase64ToStorage(base64Str, bucketName, filenamePrefix) {
  if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
    return base64Str; // Return as is if already a URL or not base64
  }

  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let bufferData;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      bufferData = Buffer.from(matches[2], 'base64');
    } else {
      bufferData = Buffer.from(base64Str, 'base64');
    }

    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `${filenamePrefix}_${Date.now()}.${extension}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filename, bufferData, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      if (error.message && error.message.includes('bucket not found')) {
        // Create bucket if it doesn't exist
        await supabase.storage.createBucket(bucketName, { public: true });
        // Retry
        const { data: retryData, error: retryError } = await supabase.storage
          .from(bucketName)
          .upload(filename, bufferData, {
            contentType: mimeType,
            upsert: true
          });
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Error uploading to storage:', err);
    return base64Str; // Fallback to raw base64 if upload fails
  }
}

// ========== RIDER OPERATIONS ==========

async function getAllRiders(status = 'active') {
  let query = supabase.from('riders').select('*').order('name');
  if (status && status !== 'all') {
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
  let profilePhoto = riderData.profile_photo;
  if (profilePhoto && profilePhoto.startsWith('data:image')) {
    profilePhoto = await uploadBase64ToStorage(profilePhoto, 'rider-proofs', `profile_rider`);
  }

  const { data, error } = await supabase.from('riders').insert([{
    ...riderData,
    profile_photo: profilePhoto,
    rider_type: riderData.rider_type || 'company',
    status: 'active',
    created_at: nowISO(),
    updated_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function updateRider(id, riderData) {
  let profilePhoto = riderData.profile_photo;
  if (profilePhoto && profilePhoto.startsWith('data:image')) {
    profilePhoto = await uploadBase64ToStorage(profilePhoto, 'rider-proofs', `profile_rider_${id}`);
  }

  const updates = { ...riderData, updated_at: nowISO() };
  if (profilePhoto !== undefined) {
    updates.profile_photo = profilePhoto;
  }

  const { data, error } = await supabase.from('riders')
    .update(updates)
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
    'submitted_at'
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
  if (sanitized.screenshot && sanitized.screenshot.startsWith('data:image')) {
    sanitized.screenshot = await uploadBase64ToStorage(sanitized.screenshot, 'rider-proofs', `screenshot_rider_${sanitized.rider_id || 'unknown'}`);
  }
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
  if (sanitized.screenshot && sanitized.screenshot.startsWith('data:image')) {
    sanitized.screenshot = await uploadBase64ToStorage(sanitized.screenshot, 'rider-proofs', `screenshot_rider_${sanitized.rider_id || 'unknown'}`);
  }
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
    if (e.category === 'Manual Deduction' || e.category === 'Advance Installment') return sum;
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
  if (receipt_base64 !== undefined) {
    let receiptUrl = receipt_base64;
    if (receipt_base64 && receipt_base64.startsWith('data:image')) {
      receiptUrl = await uploadBase64ToStorage(receipt_base64, 'rider-proofs', `receipt_expense_rider_${expData.rider_id || 'admin'}`);
    }
    insertData.receipt_url = receiptUrl;
  }
  
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
  if (receipt_base64 !== undefined) {
    let receiptUrl = receipt_base64;
    if (receipt_base64 && receipt_base64.startsWith('data:image')) {
      receiptUrl = await uploadBase64ToStorage(receipt_base64, 'rider-proofs', `receipt_expense_rider_${expData.rider_id || 'admin'}`);
    }
    updateData.receipt_url = receiptUrl;
  }
  
  const { error } = await supabase.from('expenses').update(updateData).eq('id', id);
  if (error) throw error;
  return { id };
}

async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

async function settleExpenseDeduction(id, settledBy, amountPaid = null) {
  if (amountPaid !== null) {
    const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single();
    if (!expense) throw new Error('Expense not found');
    
    amountPaid = parseFloat(amountPaid);
    const originalAmount = parseFloat(expense.amount);

    if (amountPaid < originalAmount) {
      const remaining = originalAmount - amountPaid;
      
      await supabase.from('expenses').update({
        amount: amountPaid,
        "deductionSettled": true,
        settled_by: settledBy,
        "settledBy": settledBy,
        settled_at: nowISO(),
        "settledDate": nowISO(),
        notes: (expense.notes ? expense.notes + ' ' : '') + '(Partially Settled)'
      }).eq('id', id);

      const newExpense = { ...expense };
      delete newExpense.id;
      delete newExpense.created_at;
      delete newExpense.updated_at;
      newExpense.amount = remaining;
      newExpense.deductionSettled = false;
      newExpense.settled_by = null;
      newExpense.settledBy = null;
      newExpense.settled_at = null;
      newExpense.settledDate = null;
      newExpense.notes = (expense.notes ? expense.notes.replace(' (Remaining Balance)', '').replace(' (Partially Settled)', '') + ' ' : '') + '(Remaining Balance)';
      
      await supabase.from('expenses').insert(newExpense);
      return;
    }
  }

  const { error } = await supabase.from('expenses').update({
    "deductionSettled": true,
    settled_by: settledBy,
    "settledBy": settledBy,
    settled_at: nowISO(),
    "settledDate": nowISO()
  }).eq('id', id);
  if (error) throw error;
}

async function unsettleExpenseDeduction(id) {
  const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single();
  if (!expense) throw new Error('Expense not found');
  if (!expense.deductionSettled) throw new Error('Expense is not settled');
  
  const { error } = await supabase.from('expenses').update({
    "deductionSettled": false,
    settled_by: null,
    "settledBy": null,
    settled_at: null,
    "settledDate": null,
    updated_at: nowISO()
  }).eq('id', id);
  if (error) throw error;
  await logAudit('UNDO_SETTLE', 'Expense', `Unsettled deduction #${id}: ${expense.category} - ${expense.amount} SAR`);
  return { success: true };
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
    let q = supabase.from('daily_logs').select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes, notes, submitted_at, created_at, updated_at');
    if (periodStart && periodEnd) {
      q = q.gte('log_date', periodStart).lte('log_date', periodEnd);
    }
    return q;
  });
  return data.sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
}

async function getDailyLogsPaginated(date, limit, offset, search = '') {
  let query = supabase
    .from('daily_logs')
    .select('id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes, notes, submitted_at, created_at, updated_at', { count: 'exact' })
    .eq('log_date', date);

  if (search) {
    query = query.ilike('rider_name', `%${search}%`);
  }

  const { data, count, error } = await query
    .order('rider_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { logs: data || [], total: count || 0 };
}

async function getDailyLogsByRider(riderId, start, end) {
  const isSingleDay = start === end;
  const selectFields = isSingleDay 
    ? 'id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes, notes, screenshot, submitted_at, created_at, updated_at'
    : 'id, rider_id, rider_name, log_date, attendance_status, primary_orders, associate_orders, checkin_hours, checkin_minutes, notes, submitted_at, created_at, updated_at';

  const logs = await fetchPaginated(() => supabase.from('daily_logs').select(selectFields).eq('rider_id', riderId).gte('log_date', start).lte('log_date', end));
  return logs.sort((a, b) => (b.log_date || '').localeCompare(a.log_date || ''));
}

// ========== PAYROLL LOGIC ==========
async function settleRiderDeductions(riderId, settledBy, riderName = null) {
  const settleData = {
    "deductionSettled": true,
    settled_by: settledBy,
    "settledBy": settledBy,
    settled_at: nowISO(),
    "settledDate": nowISO()
  };
  
  let expQuery = supabase.from('expenses').update(settleData).eq('is_deductible', true).eq('deductionSettled', false);
  let advQuery = supabase.from('salary_advances').update(settleData).eq('status', 'approved').eq('deductionSettled', false);
  
  if (riderId !== null && !isNaN(riderId)) {
    expQuery = expQuery.eq('rider_id', riderId);
    advQuery = advQuery.eq('rider_id', riderId);
  } else if (riderName) {
    expQuery = expQuery.eq('vendor_name', riderName);
    advQuery = advQuery.eq('id', -1); // won't match anything
  } else {
    return 0;
  }
  
  const [expUpdate, advUpdate] = await Promise.all([
    expQuery,
    advQuery
  ]);
  
  return (expUpdate.count || 0) + (advUpdate.count || 0);
}

async function calculatePayroll(periodStart, periodEnd) {
  const riders = await getAllRiders('all');
  
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
        calculatedSalary = parseFloat(rider.base_salary || 1950);
      } else {
        calculatedSalary = totalOrders * (parseFloat(rider.per_order_rate) || 6.8);
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

async function setPaymentStatus(riderId, cycleKey, status, final_paid_amount, notes, manual_deductions, manual_bonus, advance_deducted = 0, cod_settled = 0, other_deductions = 0) {
  await supabase.from('payment_status').upsert({
    cycle_key: cycleKey,
    rider_id: String(riderId),
    status, final_paid_amount, notes, manual_deductions, manual_bonus,
    advance_deducted, cod_settled, other_deductions,
    updated_at: nowISO()
  }, { onConflict: 'cycle_key, rider_id' });

  // Auto-settlement logic for advances
  if (status === 'paid' && parseFloat(advance_deducted) > 0) {
    const unsettled = await getUnsettledPaymentsForRider(riderId);
    let remainingToSettle = parseFloat(advance_deducted) + 0.001; // buffer for floating point

    for (const item of unsettled.items) {
      if (remainingToSettle <= 0) break;
      const itemAmount = parseFloat(item.amount);
      if (remainingToSettle <= 0) break;
      const amountToSettle = Math.min(itemAmount, remainingToSettle);
      remainingToSettle -= amountToSettle;

      // consider fully settled if we are within 1 cent of the item amount
      const isFullySettled = (itemAmount - amountToSettle) < 0.01;
      
      const settleData = {};
      if (isFullySettled) {
        settleData.deductionSettled = true;
        settleData.settled_by = 'System (Payroll Auto-Settle)';
        settleData.settledBy = 'System (Payroll Auto-Settle)';
        settleData.settled_at = nowISO();
        settleData.settledDate = nowISO();
      } else {
        // Partial settlement: reduce the remaining amount of the advance
        settleData.amount = itemAmount - amountToSettle;
      }

      if (item.type === 'expense' || item.type === 'deduction') {
        await supabase.from('expenses').update(settleData).eq('id', item.id);
      } else if (item.type === 'advance') {
        await supabase.from('salary_advances').update(settleData).eq('id', item.id);
      }
    }
  }

  return { success: true };
}

async function getPaymentStatuses(cycleKey) {
  let query = supabase.from('payment_status').select('*');
  if (cycleKey && cycleKey !== 'all') {
    query = query.eq('cycle_key', cycleKey);
  }
  const data = await fetchPaginated(() => query);
  
  if (cycleKey === 'all') {
    return data;
  }
  
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

  // Generate a unique session token for single-device enforcement
  const sessionToken = require('crypto').randomUUID();
  await supabase.from('riders').update({ 
    last_login: nowISO(),
    session_token: sessionToken
  }).eq('id', foundRider.id);
  
  const { portal_password, ...safeRider } = foundRider;
  safeRider.session_token = sessionToken;
  return safeRider;
}

async function updateRiderSelfService(riderId, riderData) {
  const allowed = ['phone', 'email', 'bank_name', 'bank_account', 'iban', 'date_of_birth', 'nationality', 'iqama_number', 'iqama_expiry', 'noon_id', 'doc_vault', 'client_company', 'store_warehouse'];
  const updates = { updated_at: nowISO() };
  for (const key of allowed) {
    if (riderData[key] !== undefined) updates[key] = riderData[key];
  }

  const oldRider = await getRiderById(riderId);
  let assignedBikeId = riderData.bike_id;

  if (riderData.new_bike) {
    const newBike = await createBike({
      plate_number: riderData.new_bike.plate_number,
      model: riderData.new_bike.model || ''
    });
    assignedBikeId = newBike.id;
  }

  if (assignedBikeId !== undefined) {
    if (assignedBikeId) {
      const { data: existingRider } = await supabase
        .from('riders')
        .select('id')
        .eq('bike_id', assignedBikeId)
        .neq('id', riderId)
        .maybeSingle();
        
      if (existingRider) {
        throw new Error('This bike is already assigned to another rider.');
      }
    }
    updates.bike_id = assignedBikeId; // can also be null if they unassign
  }

  const { data, error } = await supabase.from('riders').update(updates).eq('id', riderId).select().single();
  if (error) throw error;

  // Sync bike assignment if bike_id changed
  if (assignedBikeId !== undefined && String(oldRider?.bike_id) !== String(assignedBikeId)) {
    try {
      if (oldRider?.bike_id) {
        await updateBike(oldRider.bike_id, { assigned_rider_id: null, assigned_rider_name: null });
      }
      if (assignedBikeId) {
        await updateBike(assignedBikeId, { assigned_rider_id: String(riderId), assigned_rider_name: data.name });
      }
    } catch (err) {
      console.error('Failed to sync bike assignment:', err);
    }
  }

  // Intercept vehicle istimara/auth expiry to update the assigned bike
  if (riderData.istimara_expiry !== undefined || riderData.authorization_expiry !== undefined || riderData.auth_expiry !== undefined || riderData.insurance_expiry !== undefined) {
    if (data.bike_id) {
      const bikeUpdates = {};
      
      // Map istimara_expiry / authorization_expiry / auth_expiry to istimara_expiry
      if (riderData.istimara_expiry !== undefined) bikeUpdates.istimara_expiry = riderData.istimara_expiry;
      if (riderData.authorization_expiry !== undefined) bikeUpdates.istimara_expiry = riderData.authorization_expiry;
      if (riderData.auth_expiry !== undefined) bikeUpdates.istimara_expiry = riderData.auth_expiry;
      
      // Update insurance expiry
      if (riderData.insurance_expiry !== undefined) bikeUpdates.insurance_expiry = riderData.insurance_expiry;
      
      // We also update assigned_rider_name here just in case it was missed
      bikeUpdates.assigned_rider_id = String(riderId);
      bikeUpdates.assigned_rider_name = data.name;
      
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
    calculated_salary: (rider.rider_type || '').toLowerCase() === 'company' ? parseFloat(rider.base_salary || 1950) : totalOrders * (parseFloat(rider.per_order_rate) || 6.8),
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

async function updateRiderRequestStatus(id, status, adminNote = '', processedBy = 'Admin', processedByPhoto = '', receiptBase64 = null, deductFunds = true) {
  const { data: request, error: fetchErr } = await supabase.from('rider_requests').select('*').eq('id', id).single();
  if (fetchErr || !request) throw new Error('Request not found');

  await supabase.from('rider_requests').update({ status, admin_note: adminNote, processed_by: processedBy, updated_at: nowISO() }).eq('id', id);

  const msg = status === 'approved' ? `Your ${request.category} request has been approved.` : `Your request was rejected.`;
  await createNotification({ rider_id: request.rider_id, type: status === 'approved' ? 'request_approved' : 'request_rejected', title: `Request ${status.toUpperCase()}`, message: msg, processed_by_name: processedBy, processed_by_photo: processedByPhoto });

  if (status === 'approved') {
    let plan = 1;
    const desc = request.description || '';
    const match = desc.match(/\[INSTALLMENT_PLAN:(\d+)\]/);
    if (match) plan = parseInt(match[1], 10) || 1;
    
    const overrideMatch = (adminNote || '').match(/\[OVERRIDE_PLAN:(\d+)\]/);
    if (overrideMatch) plan = parseInt(overrideMatch[1], 10) || 1;

    const originalNote = desc.replace(/\[INSTALLMENT_PLAN:\d+\]/, '').trim();

    if (request.category === 'Advance') {
      if (deductFunds) {
        // Create the non-deductible cash outflow from company funds today
        await createExpense({
          expense_date: todayLocal(),
          category: 'Advance (Company Funds)',
          amount: request.amount,
          rider_id: request.rider_id,
          rider_name: request.rider_name,
          is_deductible: false,
          source: 'rider_request_cash',
          request_id: id,
          receipt_base64: receiptBase64,
          notes: `Advance Paid from Company Funds (Ref: ${id})`
        });
      }

      const amountPerMonth = request.amount / plan;
      for (let i = 0; i < plan; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() + i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        
        await createExpense({
          expense_date: `${yyyy}-${mm}-${dd}`,
          category: 'Advance Installment',
          amount: amountPerMonth,
          rider_id: request.rider_id,
          rider_name: request.rider_name,
          is_deductible: true,
          source: 'rider_request',
          request_id: id,
          receipt_base64: receiptBase64,
          notes: `Installment ${i + 1}/${plan}. ${originalNote}`.trim()
        });
      }
    } else {
      await createExpense({
        expense_date: todayLocal(),
        category: request.category,
        amount: request.amount,
        rider_id: request.rider_id,
        rider_name: request.rider_name,
        is_deductible: true,
        source: 'rider_request',
        request_id: id,
        receipt_base64: receiptBase64,
        notes: originalNote
      });
    }
  }
  return { success: true, rider_id: request.rider_id, category: request.category };
}

async function getMyRequests(riderId) {
  const { data, error } = await supabase.from('rider_requests').select('*').eq('rider_id', riderId).order('created_at', { ascending: false });
  if (error) throw error;
  
  const requests = data || [];
  const approvedAdvanceIds = requests.filter(r => r.status === 'approved' && r.category === 'Advance').map(r => r.id);
  
  if (approvedAdvanceIds.length > 0) {
    const { data: expData } = await supabase.from('expenses').select('amount, request_id, deductionSettled, is_deductible').in('request_id', approvedAdvanceIds).eq('is_deductible', true);
    if (expData) {
      for (const req of requests) {
        if (req.status === 'approved' && req.category === 'Advance') {
          const related = expData.filter(e => String(e.request_id) === String(req.id));
          if (related.length > 0) {
            req.advanceTotal = related.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            req.advanceDeducted = related.filter(e => e.deductionSettled).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            req.advanceRemaining = req.advanceTotal - req.advanceDeducted;
          }
        }
      }
    }
  }

  return requests;
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
  let photoUrl = profileData.photo_url;
  if (photoUrl && photoUrl.startsWith('data:image')) {
    photoUrl = await uploadBase64ToStorage(photoUrl, 'rider-proofs', `admin_profile_${emailKey.replace(/[^a-zA-Z0-9]/g, '_')}`);
  }
  
  const updates = { email_key: emailKey, ...profileData, updated_at: nowISO() };
  if (photoUrl !== undefined) {
    updates.photo_url = photoUrl;
  }
  await supabase.from('admin_profiles').upsert(updates);
  return { success: true };
}

async function migrateFromSQLite() { return { migrated: false, total: 0, message: "Dep" }; }

async function syncApprovedRequests() {
  console.log('🔄 Checking for missing expenses/advances for approved rider requests...');
  try {
    // 1. Get all approved rider requests
    const { data: approvedRequests, error: reqErr } = await supabase
      .from('rider_requests')
      .select('*')
      .eq('status', 'approved');
    
    if (reqErr) {
      console.error('Failed to fetch approved requests for sync:', reqErr);
      return;
    }
    
    if (!approvedRequests || approvedRequests.length === 0) {
      console.log('✅ No approved requests found to sync.');
      return;
    }

    // 2. Fetch all expenses with source = 'rider_request'
    const { data: expenses, error: expErr } = await supabase
      .from('expenses')
      .select('request_id')
      .eq('source', 'rider_request');
      
    if (expErr) {
      console.error('Failed to fetch expenses for sync:', expErr);
      return;
    }

    // 3. Fetch all salary advances with source = 'rider_request'
    const { data: advs, error: advErr } = await supabase
      .from('salary_advances')
      .select('request_id')
      .eq('source', 'rider_request');
      
    if (advErr) {
      console.error('Failed to fetch advances for sync:', advErr);
      return;
    }

    const expenseRequestIds = new Set((expenses || []).map(e => String(e.request_id)));
    const advanceRequestIds = new Set((advs || []).map(a => String(a.request_id)));

    let syncedCount = 0;

    for (const req of approvedRequests) {
      const reqIdStr = String(req.id);
      const datePart = (req.updated_at || req.created_at || nowISO()).slice(0, 10);

      // ALL approved requests create a SINGLE deductible expense (no separate salary_advances)
      if (!expenseRequestIds.has(reqIdStr)) {
        console.log(`Sync: Creating missing deductible expense for request #${req.id} (${req.category})`);
        await createExpense({
          expense_date: datePart,
          category: req.category,
          amount: req.amount,
          rider_id: req.rider_id,
          rider_name: req.rider_name,
          is_deductible: true,
          source: 'rider_request',
          request_id: req.id,
          notes: `Sync approved ${req.category.toLowerCase()}: ${req.description || ''}`,
          created_at: req.created_at || nowISO()
        });
        syncedCount++;
      }
    }

    console.log(`🔄 Sync completed: ${syncedCount} missing records restored.`);
  } catch(err) {
    console.error('Failed to sync approved requests:', err);
  }
}

// ========== LOCATION HISTORY & HEARTBEATS ==========

async function insertLocationBatch(riderId, locations, sessionId) {
  if (!locations || locations.length === 0) return { inserted: 0 };

  const rows = locations.map(loc => ({
    rider_id: riderId,
    latitude: loc.lat,
    longitude: loc.lng,
    accuracy: loc.accuracy || null,
    speed: loc.speed || null,
    battery_level: loc.battery || null,
    source: loc.source || null,
    recorded_at: loc.timestamp ? new Date(loc.timestamp).toISOString() : nowISO(),
    received_at: nowISO(),
    session_id: sessionId || null
  }));

  const { error } = await supabase.from('location_history').insert(rows);
  if (error) throw error;

  // Update riders table with the most recent location point
  const sorted = [...locations].sort((a, b) => {
    const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tB - tA;
  });
  const latest = sorted[0];
  if (latest) {
    await updateRiderLocation(riderId, latest.lat, latest.lng);
  }

  return { inserted: rows.length };
}

async function insertHeartbeat(riderId, battery, isLocationActive, appState) {
  const { error } = await supabase.from('rider_heartbeats').insert([{
    rider_id: riderId,
    battery_level: battery || null,
    is_location_active: isLocationActive !== undefined ? isLocationActive : true,
    app_state: appState || null,
    received_at: nowISO()
  }]);
  if (error) throw error;
  return { success: true };
}

async function getLocationHistory(riderId, start, end, limit = 1000) {
  let query = supabase.from('location_history')
    .select('*')
    .eq('rider_id', riderId)
    .order('recorded_at', { ascending: true })
    .limit(limit);

  if (start) query = query.gte('recorded_at', new Date(start).toISOString());
  if (end) query = query.lte('recorded_at', new Date(end).toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getLastHeartbeat(riderId) {
  const { data, error } = await supabase.from('rider_heartbeats')
    .select('*')
    .eq('rider_id', riderId)
    .order('received_at', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function getOnlineRidersWithStaleLocations(staleMinutes) {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('riders')
    .select('*')
    .eq('is_online', true)
    .lt('last_location_update', cutoff);
  if (error) throw error;
  return data || [];
}

async function cleanupOldLocationHistory(retentionDays = 30) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase.from('location_history')
    .delete()
    .lt('recorded_at', cutoff);
  if (error) throw error;
  console.log(`[Cleanup] Deleted location_history older than ${retentionDays} days (cutoff: ${cutoff})`);
  return { deleted: count || 0 };
}

async function cleanupOldHeartbeats(retentionDays = 7) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase.from('rider_heartbeats')
    .delete()
    .lt('received_at', cutoff);
  if (error) throw error;
  console.log(`[Cleanup] Deleted rider_heartbeats older than ${retentionDays} days (cutoff: ${cutoff})`);
  return { deleted: count || 0 };
}

module.exports = {
  initDb, getDb, getAllRiders, getRiderById, createRider, updateRider,
  archiveRider, deleteRiderPermanently, getDailyLogs, getDailyLogsPaginated, getDailyLogsByRider,
  syncApprovedRequests,
  getMissingLogs, createDailyLog, updateDailyLog, deleteDailyLog,
  getDashboardStats, calculatePayroll, getExpenseStats, getExpenses,
  createExpense, updateExpense, deleteExpense, settleExpenseDeduction, unsettleExpenseDeduction,
  settleRiderDeductions, getAdvances, createAdvance, updateAdvanceStatus,
  getBonuses, createBonus, deleteBonus, getFunds, createFund, updateFund,
  deleteFund, isPayrollLocked, lockPayroll, unlockPayroll, setPaymentStatus,
  getPaymentStatuses, deleteRiderCycleLogs, getAllBikes, createBike, updateBike, deleteBike,
  getAuditLogs, logAudit, migrateFromSQLite,
  // Rider Portal
  setRiderPassword, authenticateRider, updateRiderSelfService, getRiderMonthlyReport,
  getUnsettledPaymentsForRider, createRiderRequest, getRiderRequests, updateRiderRequestStatus,
  getMyRequests, deleteRiderRequest,
  // Tracking
  updateRiderOnlineStatus, updateRiderLocation, updateRiderGpsStatus,
  // Location History & Heartbeats
  insertLocationBatch, insertHeartbeat, getLocationHistory, getLastHeartbeat,
  getOnlineRidersWithStaleLocations, cleanupOldLocationHistory, cleanupOldHeartbeats,
  // Notifications
  saveRiderPushToken, createNotification, getNotificationsForRider, markNotificationRead,
  // Admin Profiles
  getAdminProfiles, getAdminProfile, updateAdminProfile,
  // Auth Users
  getAuthUser, upsertAuthUser,
  // Settings
  getSettings, updateSettings,
  // Cycle Transfers
  getCycleTransfers, addCycleTransfer, deleteCycleTransfer,
  // App Version
  getAppVersion, setAppVersion,
  // Tracking Shutdown
  isTrackingShutdown, setTrackingShutdown
};

// ========== CYCLE TRANSFERS ==========

async function getCycleTransfers(cycleKey) {
  const { data, error } = await supabase.from('cycle_transfers').select('*').eq('cycle_key', cycleKey).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addCycleTransfer(cycleKey, amount, description) {
  const { data, error } = await supabase.from('cycle_transfers').insert([{
    cycle_key: cycleKey,
    amount: amount,
    description: description || '',
    created_at: nowISO()
  }]).select().single();
  if (error) throw error;
  return data;
}

async function deleteCycleTransfer(id) {
  const { error } = await supabase.from('cycle_transfers').delete().eq('id', id);
  if (error) throw error;
}

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

let trackingShutdownCache = null;
let trackingShutdownCacheTime = 0;

async function isTrackingShutdown() {
  const now = Date.now();
  if (trackingShutdownCache !== null && now - trackingShutdownCacheTime < 30000) {
    return trackingShutdownCache;
  }
  const status = await getSettings('tracking_status');
  const val = status ? status.shutdown === true : false;
  trackingShutdownCache = val;
  trackingShutdownCacheTime = now;
  return val;
}

async function setTrackingShutdown(shutdown) {
  trackingShutdownCache = shutdown;
  trackingShutdownCacheTime = Date.now();
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

