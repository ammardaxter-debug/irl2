// @charset "utf-8"
// ========================================
//  WARNING WHATSAPP - Message builder & sender
// ========================================

const WarningWhatsApp = {
  _sentStatuses: {},

  // ── Load sent statuses from Firebase ──
  async loadSentStatuses(cycleKey) {
    try {
      const statuses = await API.getWarningMessageStatus(cycleKey);
      this._sentStatuses = statuses || {};
    } catch (e) {
      console.warn('Failed to load warning message statuses:', e);
      this._sentStatuses = {};
    }
  },

  isSent(riderId) {
    const entry = this._sentStatuses[riderId];
    return entry && entry.sent === true;
  },

  // ── Mark as sent in Firebase ──
  async markSent(riderId, cycleKey) {
    try {
      await API.setWarningMessageSent(riderId, cycleKey);
      this._sentStatuses[riderId] = { sent: true, sent_at: new Date().toISOString() };
    } catch (e) {
      console.warn('Failed to save warning sent status:', e);
    }
  },

  // ── Pad single digit dates with space ──
  padDateDay(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const dayStr = day < 10 ? ` ${day}` : `${day}`;
    return `${month} ${dayStr}`;
  },

  // ── Generate all dates in the cycle ──
  getCycleDates(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (current <= end) {
      dates.push(Utils.toLocalDateStr(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },

  // ── Build the WhatsApp message for a warning rider ──
  buildMessage(rider, allLogs, period) {
    const divider = '-'.repeat(32);
    const lines = [];

    // Header
    lines.push('*[ IRL MONTHLY REPORT ]*');
    lines.push('*Inspiring Roads Logistics*');
    lines.push(divider);
    lines.push('');

    // Greeting
    lines.push(`Assalam o Alaikum *${rider.rider_name}*,`);
    lines.push('Please review your performance before we finalize this cycle.');
    lines.push('');

    // Cycle dates
    const startD = new Date(period.start + 'T00:00:00');
    const endD = new Date(period.end + 'T00:00:00');
    const startLabel = startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    lines.push(`*Cycle: ${startLabel} - ${endLabel}*`);
    lines.push(divider);
    lines.push('');

    // Daily Breakdown
    lines.push('*DAILY BREAKDOWN*');
    lines.push('');

    // Build a map of logs by date
    const logMap = {};
    allLogs.forEach(l => { logMap[l.log_date] = l; });

    const cycleDates = this.getCycleDates(period.start, period.end);
    let totalPresent = 0;
    let totalOnlineHrs = 0;
    let totalOrders = 0;
    const absentDates = [];
    const shortShiftDays = [];

    for (const dateStr of cycleDates) {
      const log = logMap[dateStr];
      const dateLabel = this.padDateDay(dateStr);

      if (!log || log.attendance_status === 'Absent' || log.attendance_status === 'Missed') {
        lines.push(`${dateLabel}  |  ABSENT`);
        absentDates.push(dateStr);
      } else if (log.attendance_status === 'Day Off' || log.attendance_status === 'Week Off') {
        lines.push(`${dateLabel}  |  Day Off`);
      } else {
        // Present
        totalPresent++;
        const hrs = ((log.checkin_hours || 0) * 60 + (log.checkin_minutes || 0)) / 60;
        const hrsRounded = Math.round(hrs * 10) / 10;
        totalOnlineHrs += hrsRounded;
        const orders = (log.primary_orders || 0) + (log.associate_orders || 0);
        totalOrders += orders;

        const isShort = hrsRounded < 11;
        if (isShort) {
          shortShiftDays.push({ date: dateStr, hrs: hrsRounded, short: Math.round((11 - hrsRounded) * 10) / 10 });
          lines.push(`${dateLabel}  |  ${orders} orders  (!) ${hrsRounded} hrs`);
        } else {
          lines.push(`${dateLabel}  |  ${orders} orders`);
        }
      }
    }

    lines.push('');
    lines.push(divider);
    lines.push('');

    // Summary
    totalOnlineHrs = Math.round(totalOnlineHrs * 10) / 10;
    lines.push('*SUMMARY*');
    lines.push('');
    lines.push(`Days Present   :  ${totalPresent} / 26`);
    lines.push(`Online Hours   :  ${totalOnlineHrs} hrs`);
    lines.push(`Total Orders   :  ${totalOrders}`);
    lines.push('');
    lines.push(divider);
    lines.push('');

    // Issues This Cycle
    const warnings = rider.warnings || [];
    if (warnings.length > 0) {
      lines.push('*ISSUES THIS CYCLE*');
      lines.push('');

      // Low Attendance
      const attWarning = warnings.find(w => w.type === 'attendance');
      if (attWarning) {
        lines.push('>> ATTENDANCE SHORT');
        if (rider.rider_type === 'company') {
          lines.push(`Present ${totalPresent} of 26 days. Minimum required: 26.`);
        } else {
          lines.push(`You have been marked absent.`);
        }
        if (absentDates.length > 0) {
          const absentLabels = absentDates.map(d => this.padDateDay(d).trim()).join(', ');
          lines.push(`Absent: ${absentLabels}`);
        }
        lines.push('');
      }

      // Below Order Target
      const orderWarning = warnings.find(w => w.type === 'orders');
      if (orderWarning) {
        const shortfall = 520 - totalOrders;
        lines.push('>> ORDERS BELOW TARGET');
        lines.push(`Your orders: *${totalOrders}* | Target: *520* | Short by: *${shortfall}*`);
        lines.push('');
      }

      // Short Shift Hours
      const checkinWarning = warnings.find(w => w.type === 'checkin');
      if (checkinWarning && shortShiftDays.length > 0) {
        lines.push('>> SHORT SHIFT DAYS');
        lines.push('Days with less than 11 hrs online:');
        for (const sd of shortShiftDays) {
          const label = this.padDateDay(sd.date).trim();
          lines.push(`- ${label}: ${sd.hrs} hrs`);
        }
        lines.push('');
      }

      lines.push(divider);
      lines.push('');
    }

    // Action Required
    lines.push('*ACTION REQUIRED*');
    lines.push('');
    lines.push('(1) Were you genuinely absent on the flagged days?');
    lines.push('    Reply to confirm so we can record it officially.');
    lines.push('');
    lines.push('(2) Is anything recorded incorrectly?');
    lines.push('    Send screenshot or proof for that specific day.');
    lines.push('');
    lines.push('(3) Everything looks correct?');
    lines.push(`    Reply: *"Confirmed - ${rider.rider_name}"*`);
    lines.push('');
    lines.push('_This is not a deduction notice. We are');
    lines.push('verifying records before any decision is made._');
    lines.push('');
    lines.push(divider);
    lines.push('*Inspiring Roads Logistics*');
    lines.push('_Riyadh, Saudi Arabia_');

    return lines.join('\n');
  },

  // ── Open WhatsApp with the message ──
  sendWhatsApp(phone, message) {
    const encoded = encodeURIComponent(message);
    if (phone) {
      let cleanPhone = phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.startsWith('05')) cleanPhone = '+966' + cleanPhone.substring(1);
      if (!cleanPhone.startsWith('+')) cleanPhone = '+966' + cleanPhone;
      const url = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encoded}`;
      console.log('WA URL:', url);
      window.open(url, '_blank');
    } else {
      const url = `https://wa.me/?text=${encoded}`;
      console.log('WA URL:', url);
      window.open(url, '_blank');
      Utils.showToast('No phone number saved — opened WhatsApp without recipient', 'info');
    }
  },

  // ── Preview modal ──
  showPreview(rider, message, cycleKey) {
    const escapedMessage = Utils.escapeHtml(message).replace(/\n/g, '<br>');
    const html = `
      <div style="display:flex; flex-direction:column; height:70vh;">
        <div style="flex:1; overflow-y:auto; background:#0B141A; color:#E9EDEF; border-radius:12px; padding:20px; font-family:'Courier New', monospace; font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-word;">
          ${escapedMessage}
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px; padding-top:16px; border-top:1px solid #E5E7EB;">
          <button class="btn btn-outline" onclick="Utils.closeModal()" style="padding:10px 24px;">Cancel</button>
          <button class="btn" onclick="WarningWhatsApp._confirmSend(${rider.rider_id}, '${cycleKey}')" style="background:#25D366; color:#fff; border:none; border-radius:12px; padding:10px 24px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;" onmouseover="this.style.background='#1DA851'" onmouseout="this.style.background='#25D366'">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            Send Now
          </button>
        </div>
      </div>
    `;
    Utils.openModal(`Preview — ${Utils.escapeHtml(rider.rider_name)}`, html, 'modal-lg');
  },

  // ── Store message + rider for confirm send ──
  _pendingMessages: {},

  async prepareAndPreview(riderId) {
    const rider = Payroll._currentPayrollData?.find(r => r.rider_id === riderId);
    if (!rider) return Utils.showToast('Rider not found', 'error');

    Utils.showLoading('Building message', `Fetching logs for ${rider.rider_name}...`);
    try {
      const logs = await API.request(`/daily-logs/rider/${riderId}?start=${Payroll.currentPeriod.start}&end=${Payroll.currentPeriod.end}`);
      const message = this.buildMessage(rider, logs, Payroll.currentPeriod);
      const cycleKey = `${Payroll.currentPeriod.start}_${Payroll.currentPeriod.end}`;
      this._pendingMessages[riderId] = { rider, message, logs };
      Utils.hideLoading();
      this.showPreview(rider, message, cycleKey);
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('Failed to build message: ' + e.message, 'error');
    }
  },

  async _confirmSend(riderId, cycleKey) {
    const pending = this._pendingMessages[riderId];
    if (!pending) return Utils.showToast('No pending message', 'error');
    Utils.closeModal();
    this.sendWhatsApp(pending.rider.phone, pending.message);
    await this.markSent(riderId, cycleKey);
    // Update UI card
    const card = document.getElementById(`warning-card-${riderId}`);
    if (card) {
      const btnArea = card.querySelector('.warning-card-actions');
      if (btnArea) {
        btnArea.innerHTML = `
          <div style="display:flex; align-items:center; gap:6px; color:#16A34A; font-weight:600; font-size:13px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"/></svg>
            Sent
          </div>
        `;
      }
    }
    Utils.showToast(`Warning sent to ${pending.rider.rider_name}`, 'success');
  },

  // ── Direct send without preview ──
  async directSend(riderId) {
    const rider = Payroll._currentPayrollData?.find(r => r.rider_id === riderId);
    if (!rider) return Utils.showToast('Rider not found', 'error');

    Utils.showLoading('Sending', `Preparing message for ${rider.rider_name}...`);
    try {
      const logs = await API.request(`/daily-logs/rider/${riderId}?start=${Payroll.currentPeriod.start}&end=${Payroll.currentPeriod.end}`);
      const message = this.buildMessage(rider, logs, Payroll.currentPeriod);
      const cycleKey = `${Payroll.currentPeriod.start}_${Payroll.currentPeriod.end}`;
      Utils.hideLoading();
      this.sendWhatsApp(rider.phone, message);
      await this.markSent(riderId, cycleKey);
      return true;
    } catch (e) {
      Utils.hideLoading();
      Utils.showToast('Failed: ' + e.message, 'error');
      return false;
    }
  },

  // ── Send All Warning Riders ──
  async sendAllWarnings() {
    const data = Payroll._currentPayrollData || [];
    const warningRiders = data.filter(r => r.warnings && r.warnings.length > 0);
    const cycleKey = `${Payroll.currentPeriod.start}_${Payroll.currentPeriod.end}`;

    if (warningRiders.length === 0) {
      return Utils.showToast('No warning riders to message', 'info');
    }

    this._bulkWarningQueue = [...warningRiders];
    this._bulkWarningTotal = warningRiders.length;
    this._bulkWarningIndex = 1;
    this._renderBulkWarningModal();
  },

  _renderBulkWarningModal() {
    if (this._bulkWarningQueue.length === 0) {
      Utils.openModal('All Done \uD83C\uDF89', `
        <div style="text-align:center; padding:32px;">
          <div style="font-size:48px; margin-bottom:16px;">\u2705</div>
          <p style="font-size:16px; font-weight:600; color:#0F0F0F;">Warning messages sent to all ${this._bulkWarningTotal} riders</p>
          <button class="btn btn-primary" style="margin-top:20px;" onclick="Utils.closeModal(); Payroll.render();">Close</button>
        </div>
      `);
      return;
    }

    const rider = this._bulkWarningQueue[0];
    const html = `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:14px; color:#6B7280; margin-bottom:20px;">
          Sending <span style="background:#F3F4F6; padding:4px 12px; border-radius:12px; font-weight:600; color:#0F0F0F;">${this._bulkWarningIndex} of ${this._bulkWarningTotal}</span>
        </div>
        <div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:12px; padding:24px; margin-bottom:24px;">
          <div style="font-size:20px; font-weight:700; color:#0F0F0F; margin-bottom:8px;">
            ${Utils.escapeHtml(rider.rider_name)}
            ${this.isSent(rider.rider_id) ? '<span style="background:#DCFCE7; color:#16A34A; font-size:12px; padding:2px 8px; border-radius:12px; vertical-align:middle; margin-left:8px;">Already Sent</span>' : ''}
          </div>
          <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
            ${(rider.warnings || []).map(w => {
              let bg = '#FEF3C7', color = '#92400E', icon = '\uD83D\uDCCA';
              if (w.type === 'attendance') { bg = '#FEE2E2'; color = '#991B1B'; icon = '\uD83D\uDCC5'; }
              else if (w.type === 'orders') { bg = '#FEF3C7'; color = '#92400E'; icon = '\uD83D\uDCE6'; }
              else if (w.type === 'checkin') { bg = '#FFEDD5'; color = '#9A3412'; icon = '\u23F0'; }
              return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;background:${bg};color:${color};font-size:12px;font-weight:500;">${icon} ${Utils.escapeHtml(w.message)}</span>`;
            }).join('')}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
          <button class="btn" onclick="WarningWhatsApp._bulkSendNext()" style="width:100%;max-width:320px;background:#25D366;color:#fff;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            Send & Next
          </button>
          <button class="btn btn-outline" style="width:100%;max-width:320px;" onclick="WarningWhatsApp._bulkSkipNext()">Skip</button>
        </div>
      </div>
    `;
    Utils.openModal('Send Warning Messages', html);
  },

  async _bulkSendNext() {
    const rider = this._bulkWarningQueue.shift();
    if (rider) {
      await this.directSend(rider.rider_id);
    }
    this._bulkWarningIndex++;
    setTimeout(() => this._renderBulkWarningModal(), 300);
  },

  _bulkSkipNext() {
    this._bulkWarningQueue.shift();
    this._bulkWarningIndex++;
    this._renderBulkWarningModal();
  }
};
