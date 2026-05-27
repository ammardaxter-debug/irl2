// 🔜 SHEET 3: Summary 🔜
      const ws3 = wb.addWorksheet('Summary');
      const h3 = ['PERSON / RIDER NAME','OLDEST PENDING DATE','HISTORICAL TOTAL (SAR)','TOTAL SETTLED (SAR)','REMAINING BALANCE (SAR)','STATUS'];
      ws3.columns = [{ width: 28 }, { width: 22 }, { width: 24 }, { width: 22 }, { width: 26 }, { width: 25 }];
      addHeader(ws3, h3.length, allOutstandingLabel); setHdr(ws3, h3, 4);

      let r3 = 5, totalHist = 0, totalSettled = 0, totalRem = 0;
      const today = new Date();
      for (const rn of riders) {
        const pendingItems = riderMap[rn].pending;
        const pt = pendingItems.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const st = riderMap[rn].settled.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        if (pt === 0 && st === 0) continue;

        let oldestDateStr = '-';
        let isFlagged = false;
        let diffDays = 0;
        if (pendingItems.length > 0) {
          const oldestItem = pendingItems.reduce((oldest, current) => {
            return new Date(current.expense_date || current.created_at) < new Date(oldest.expense_date || oldest.created_at) ? current : oldest;
          });
          const oldestDate = new Date(oldestItem.expense_date || oldestItem.created_at);
          oldestDateStr = formatReadableDate(oldestItem.expense_date || oldestItem.created_at);

          diffDays = Math.floor((today - oldestDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) isFlagged = true;
        }

        const hist = pt + st;
        const row = ws3.getRow(r3);
        const alt = (r3 - 5) % 2 === 1;
        row.getCell(1).value = rn; row.getCell(1).font = { name: 'Calibri', size: 11, bold: true };
        row.getCell(2).value = oldestDateStr; row.getCell(2).font = { name: 'Calibri', size: 11 };
        row.getCell(3).value = hist; row.getCell(3).numFmt = '#,##0.00'; row.getCell(3).font = { name: 'Calibri', size: 11 }; row.getCell(3).alignment = { horizontal: 'right' };
        row.getCell(4).value = st; row.getCell(4).numFmt = '#,##0.00'; row.getCell(4).font = { name: 'Calibri', size: 11 }; row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).value = pt; row.getCell(5).numFmt = '#,##0.00'; row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(5).font = pt > 0 ? { name: 'Calibri', size: 11, bold: true, color: { argb: RD } } : { name: 'Calibri', size: 11, bold: true, color: { argb: GT } };

        let status = pt -== 0 ? 'All Settled' : (isFlagged ? `Flagged (${diffDays} days old)` : 'Active Pending');
        row.getCell(6).value = status; row.getCell(6).font = { name: 'Calibri', size: 11, italic: true, color: { argb: isFlagged ? RD : 'FF6B7280' } };

        if (isFlagged) {
          for (let c = 1; c <= 6; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (alt) {
          for (let c = 1; c <= 6; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AR } };
        }
        for (let c = 1; c <= 6; c++) row.getCell(c).border = bdr;
        totalHist += hist; totalSettled += st; totalRem += pt; r3++;
      }
      ws3.mergeCells(r3, 1, r3, 2);
      const g3 = ws3.getRow(r3);
      g3.getCell(1).value = 'GRAND TOTALS';
      g3.getCell(3).value = totalHist; g3.getCell(3).numFmt = '#,##0.00'; g3.getCell(3).alignment = { horizontal: 'right' };
      g3.getCell(4).value = totalSettled; g3.getCell(4).numFmt = '#,##0.00'; g3.getCell(4).alignment = { horizontal: 'right' };
      g3.getCell(5).value = totalRem; g3.getCell(5).numFmt = '#,##0.00'; g3.getCell(5).alignment = { horizontal: 'right' };
      for (let c = 1; c <= 6; c++) { g3.getCell(c).font = { name: 'Calibri', size: 12, bold: true, color: { argb: WH } }; g3.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DN } }; g3.getCell(c).border = bdr; }
      ws3.views = [{state:'frozen',ySplit:4}];
      ws3.autoFilter = {from:{row:4,column:1},to:{row:4,column:h3.length}};

      // ── Download ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      saveAs(blob, `IRL_Rider_Deductions_${monthYear.replace(' ','_')}.xlsx`);
      Utils.hideLoading();
      Utils.showToast('Deductions Excel exported successfully!', 'success');
    } catch (err) {
      console.error('Excel Export Error:', err);
      Utils.hideLoading();
      Utils.showToast('Failed to export: ' + err.message, 'error');
    }
  },

  settleRiderDeductions(riderId, riderName) {
    if (App.isViewer()) return;
    const html = `
      <div style="padding:8px 0;">
        <p style="margin-bottom:20px; font-size:15px; color:#4B5563; line-height:1.5;">Are you sure you want to settle ALL pending deductions for <b>${Utils.escapeHtml(riderName)}</b>?</p>
        <div class="form-group">
          <label class="form-label">Settled By</label>
          <select id="settle-by-select" class="form-input">
            <option value="Me">Me (Current User)</option>
            <option value="Sponsor Saad">Sponsor Saad</option>
            <option value="Sponsor Firas">Sponsor Firas</option>
          </select>
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:32px;">
          <button class="btn btn-outline" style="border-radius:8px;" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" style="background:#16A34A; border-color:#16A34A; border-radius:8px;" onclick="Expenses.confirmSettleRider(${riderId})">Confirm Settlement</button>
        </div>
      </div>
    `;
    Utils.openModal('Settle All Deductions', html);
  },

  async confirmSettleRider(riderId) {
    if (App.isViewer()) return;
    const settledBy = document.getElementById('settle-by-select').value;
    Utils.closeModal();
    try {
      Utils.showToast('Settling deductions...', 'info');
      await API.settleRiderDeductions(riderId, settledBy);
      Utils.showToast('All deductions settled successfully.', 'success');
      this.deductionsData = null; // Clear cache
      this.renderTabContent();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  settleSingleDeduction(expenseId, amount, riderName) {
    if (App.isViewer()) return;
    const html = `
      <div style="padding:8px 0;">
        <p style="margin-bottom:20px; font-size:15px; color:#4B5563; line-height:1.5;">Settling deduction of <b>SAR ${amount}</b> for <b>${Utils.escapeHtml(riderName)}</b>.</p>
        <div class="form-group">
          <label class="form-label">Settlement Type</label>
          <select id="settle-single-type" class="form-input" onchange="document.getElementById('settle-single-amount-group').style.display = this.value === 'partial' ? 'block' : 'none'">
            <option value="full">Full Settlement (SAR ${amount})</option>
            <option value="partial">Partial Settlement</option>
          </select>
        </div>
        <div class="form-group" id="settle-single-amount-group" style="display:none;">
          <label class="form-label">Amount Paid (SAR)</label>
          <input type="number" id="settle-single-amount" class="form-input" step="0.01" min="0.01" max="${amount}" placeholder="Enter amount paid">
        </div>
        <div class="form-group">
          <label class="form-label">Settled By</label>
          <select id="settle-single-by-select" class="form-input">
            <option value="Me">Me (Current User)</option>
            <option value="Sponsor Saad">Sponsor Saad</option>
            <option value="Sponsor Firas">Sponsor Firas</option>
          </select>
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:32px;">
          <button class="btn btn-outline" style="border-radius:8px;" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" style="background:#16A34A; border-color:#16A34A; border-radius:8px;" onclick="Expenses.confirmSettleSingle(${expenseId}, ${amount})">Confirm Settlement</button>
        </div>
      </div>
    `;
    Utils.openModal('Confirm Settlement', html);
  },

  async confirmSettleSingle(expenseId, maxAmount) {
    if (App.isViewer()) return;
    const type = document.getElementById('settle-single-type').value;
    const settledBy = document.getElementById('settle-single-by-select').value;
    let amountPaid = null;
    
    if (type === 'partial') {
      amountPaid = parseFloat(document.getElementById('settle-single-amount').value);
      if (!amountPaid || amountPaid <= 0 || amountPaid >= maxAmount) {
        Utils.showToast('Please enter a valid partial amount less than the total.', 'error');
        return;
      }
    }
    
    Utils.closeModal();
    try {
      Utils.showToast('Settling deduction...', 'info');
      await API.settleExpenseDeduction(expenseId, settledBy, amountPaid);
      Utils.showToast('Deduction settled successfully.', 'success');
      this.deductionsData = null;
      this.renderTabContent();
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  openAddFundsModal() {
    if (App.isViewer()) return;
    const today = new Date().toISOString().split('T')[0];
    const html = `
      <form id="funds-form" class="form-grid">
        <div class="form-group">
          <label class="form-label">Receive Date</label>
          <input type="date" class="form-input" name="receive_date" required value="${today}" max="${today}">
        </div>
        <div class="form-group">
          <label class="form-label">Amount (SAR)</label>
          <input type="number" step="0.01" min="0" class="form-input" name="amount" required placeholder="1000.00">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Description (Source)</label>
          <input type="text" class="form-input" name="description" required placeholder="IRL — Transfer" value="IRL — Transfer">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label class="form-label">Notes</label>
          <input type="text" class="form-input" name="notes" placeholder="Optional notes...">
        </div>
        <div class="form-group" style="grid-column: 1 / -1; background:var(--slate-50); padding:16px; border-radius:8px; border:1px dashed var(--slate-300);">
          <label class="form-label">Attach Receipt Photos / PDFs (Optional)</label>
          <div id="fund-receipt-preview-area" style="display:none; margin-bottom:12px;"></div>
          <input type="file" id="fund-receipt-upload" multiple class="form-input" style="padding:4px; font-size:13px">
          <small class="form-hint" style="margin-top:8px; display:block">Images will be compressed. PDFs supported.</small>
          <input type="hidden" id="fund-receipt-base64-hidden">
        </div>
        <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Funds</button>
        </div>
      </form>
    `;

    Utils.openModal('Log IRL Funds', html);

    this.initMultiUpload('fund-receipt-upload', 'fund-receipt-base64-hidden', 'fund-receipt-preview-area', 'funds-form');

    document.getElementById('funds-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading...';

      const data = {
        receive_date: fd.get('receive_date'),
        amount: parseFloat(fd.get('amount')) || 0,
        description: fd.get('description'),
        notes: fd.get('notes'),
        receipt_base64: document.getElementById('fund-receipt-base64-hidden').value || null
      };

      try {
        this.showProcessingOverlay('Company Fund', data.amount, true);
        await API.createFund(data);
        Utils.closeModal();
        this.finishProcessingOverlay();
        setTimeout(() => this.render(), 1200);
      } catch (err) {
        this.hideProcessingOverlayError();
        Utils.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save Funds';
      }
    });
  },

  openAddExpenseModal() {
    if (App.isViewer()) return;
    const today = new Date().toISOString().split('T')[0];
    
    // Categories matching user spec
    const categories = ['Advance', 'Food', 'Cash Relay', 'Internet Package', 'Transport', 'Equipment', 'Maintenance', 'Uniform', 'Other', 'Health / Medical'];
    
    let riderOptions = '<option value="">-- General / Vendor --</option>';
    this.riders.forEach(r => {
      riderOptions += `<option value="${r.id}">${r.name} (${r.client_company || 'Active'})</option>`;
    });

    const pillsHtml = categories.map(c => `
      <div class="expense-cat-pill" data-cat="${c}" onclick="document.getElementById('expense-cat').value='${c}'; document.querySelectorAll('.expense-cat-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); document.getElementById('expense-cat').dispatchEvent(new Event('change'));">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        ${c}
      </div>
    `).join('');

    const html = `
      <form id="expense-form" style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
        
        <!-- Hidden actual select to maintain form logic -->
        <select name="category" id="expense-cat" required style="display:none;">
          <option value="">Select Category</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        
        <div>
          <label class="expense-form-label" style="margin-bottom:8px;">Category</label>
          <div class="expense-cat-pills">
            ${pillsHtml}
          </div>
        </div>

        <div>
          <label class="expense-form-label">Deductibility</label>
          <select class="expense-form-input" name="deduct_type" id="expense-deductible">
            <option value="company">Company Paid</option>
            <option value="deductible">Rider Deductible (rider will repay)</option>
            <option value="supervisor">Non-Rider Deductible (person will repay)</option>
          </select>
          <div id="medical-hint" style="color:#2563EB; font-size:12px; font-weight:500; margin-top:6px; display:none;">Medical expenses are always covered by the company</div>
        </div>

        <div style="display:flex; gap:16px;">
          <div style="flex:1;">
            <label class="expense-form-label">Date</label>
            <input type="date" class="expense-form-input" name="expense_date" required value="${today}" max="${today}">
          </div>
          <div style="flex:1;">
            <label class="expense-form-label">Amount (SAR)</label>
            <input type="number" step="0.01" min="0" class="expense-form-input" name="amount" id="expense-amount" required placeholder="0.00" oninput="document.getElementById('expense-footer-total').innerText = 'Logging: SAR ' + (parseFloat(this.value)||0).toFixed(2) + ' · April 2026 cycle'; document.getElementById('expense-submit-btn').disabled = !(parseFloat(this.value)>0 && document.getElementById('expense-cat').value);">
          </div>
        </div>
        
        <div>
          <label class="expense-form-label">Linked Rider</label>
          <select class="expense-form-input" name="rider_id" id="expense-rider">
            ${riderOptions}
          </select>
        </div>
        
        <div id="vendor-group" style="display:none; transition: all 150ms;">
          <label class="expense-form-label">Vendor or Person Name</label>
          <input type="text" class="expense-form-input" name="vendor_name" id="vendor-input" placeholder="e.g. AC Installer, Petrol, Syed Shahzad">
        </div>
        
        <div>
          <label class="expense-form-label">Notes</label>
          <textarea class="expense-form-input" name="notes" placeholder="Optional notes..."></textarea>
        </div>
        
        <div>
          <div class="expense-upload-zone" onclick="document.getElementById('receipt-upload').click()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="upload-text" style="font-size:13px; font-weight:500;">Attach receipt or PDF</span>
          </div>
          <div id="receipt-preview-area" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
          <input type="file" id="receipt-upload" multiple accept="image/*,.pdf" style="display:none;">
          <div style="font-size:11px; color:#9CA3AF; margin-top:6px;">Images compressed automatically · PDFs supported</div>
          <input type="hidden" id="receipt-base64-hidden">
        </div>
        
        <div class="expense-footer">
          <div id="expense-footer-total" style="font-size:12px; color:#6B7280;">Logging: SAR 0.00 · April 2026 cycle</div>
          <div style="display:flex; gap:12px;">
            <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
            <button type="submit" id="expense-submit-btn" disabled style="width:140px; height:42px; border-radius:10px; border:none; background:#2563EB; color:white; font-weight:600; cursor:pointer; opacity:0.5; transition:opacity 150ms;">Save Expense</button>
          </div>
        </div>
      </form>
    `;

    Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#0F0F0F;">Add Expense</div><div style="font-size:13px;color:#6B7280;font-weight:normal;margin-top:2px;">Log a company or personal expense</div>', html, 'modal-expense');

    const catSelect = document.getElementById('expense-cat');
    const deductHint = document.getElementById('deductible-hint');
    const riderSelect = document.getElementById('expense-rider');
    const vendorGroup = document.getElementById('vendor-group');
    const vendorInput = document.getElementById('vendor-input');
    const submitBtn = document.getElementById('expense-submit-btn');
    const amountInput = document.getElementById('expense-amount');

    const checkSubmitBtn = () => {
       const amt = parseFloat(amountInput.value) || 0;
       if (amt > 0 && catSelect.value) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
       } else {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
       }
    };

    const updateVisibility = () => {
      const cat = catSelect.value;
      const deductibleSelect = document.getElementById('expense-deductible');
      const medHint = document.getElementById('medical-hint');
      
      if (cat === 'Health / Medical') {
         deductibleSelect.value = 'company';
         deductibleSelect.disabled = true;
         medHint.style.display = 'block';
      } else {
         deductibleSelect.disabled = false;
         medHint.style.display = 'none';
         if (['Advance', 'Food', 'Cash Relay'].includes(cat)) {
            if (riderSelect.value) {
               deductibleSelect.value = 'deductible';
            } else {
               deductibleSelect.value = 'supervisor';
            }
         } else if (deductibleSelect.value === 'false' || deductibleSelect.value === 'true') {
            deductibleSelect.value = 'company';
         }
      }
      
      if (cat === 'Other' || riderSelect.value === '') {
        vendorGroup.style.display = 'block';
        vendorInput.required = true;
      } else {
        vendorGroup.style.display = 'none';
        vendorInput.required = false;
      }
      
      checkSubmitBtn();
    };

    catSelect.addEventListener('change', updateVisibility);
    riderSelect.addEventListener('change', updateVisibility);
    amountInput.addEventListener('input', checkSubmitBtn);
    updateVisibility();

    this.initMultiUpload('receipt-upload', 'receipt-base64-hidden', 'receipt-preview-area', 'expense-form');

    document.getElementById('expense-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Saving...</span>';
      submitBtn.style.opacity = '0.7';

      const category = fd.get('category');
      const deductType = document.getElementById('expense-deductible').value;
      const isDeductible = deductType !== 'company';
      
      const data = {
        expense_date: fd.get('expense_date'),
        category: category,
        amount: parseFloat(fd.get('amount')) || 0,
        is_deductible: isDeductible,
        notes: fd.get('notes'),
        receipt_base64: document.getElementById('receipt-base64-hidden').value || null
      };
      
      if (fd.get('rider_id')) {
        data.rider_id = parseInt(fd.get('rider_id'));
      }
      if (fd.get('vendor_name')) {
        data.vendor_name = fd.get('vendor_name');
      }

      try {
        this.showProcessingOverlay(category, data.amount, false);
        await API.createExpense(data);
        Utils.closeModal();
        this.finishProcessingOverlay();
        Utils.showToast('Expense saved successfully', 'success');
        this.deductionsData = null; // Clear cache
        setTimeout(() => this.render(), 1200);
      } catch (err) {
        this.hideProcessingOverlayError();
        Utils.showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save Expense';
        submitBtn.style.opacity = '1';
      }
    });
  },

  async deleteExpense(id) {
    if (App.isViewer()) return;
    const confirmed = await Utils.confirm('Are you sure you want to delete this expense? This affects totals and payroll.', 'Delete Expense', 'Delete', 'Cancel', true);
    if (!confirmed) return;
    try {
      await API.deleteExpense(id);
      this.deductionsData = null;
      this.render();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    }
  },
  
  async deleteFund(id) {
    if (App.isViewer()) return;
    const confirmed = await Utils.confirm('Are you sure you want to delete this company fund entry?', 'Delete Fund', 'Delete', 'Cancel', true);
    if (!confirmed) return;
    try {
      await API.deleteFund(id);
      this.render();
    } catch(err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async openEditFundModal(id) {
    if (App.isViewer()) return;
    Utils.showLoading('Loading', 'Preparing form');
    try {
      const funds = await API.getFunds();
      const fund = funds.find(f => f.id === id);
      if (!fund) throw new Error('Fund record not found');

      const html = `
        <form id="edit-funds-form" class="form-grid">
          <div class="form-group">
            <label class="form-label">Receive Date</label>
            <input type="date" class="form-input" name="receive_date" required value="${fund.receive_date}" max="${Utils.today()}">
          </div>
          <div class="form-group">
            <label class="form-label">Amount (﷼)</label>
            <input type="number" step="0.01" min="0" class="form-input" name="amount" required value="${fund.amount}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Description (Source)</label>
            <input type="text" class="form-input" name="description" required value="${Utils.escapeHtml(fund.description)}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1;">
            <label class="form-label">Notes</label>
            <input type="text" class="form-input" name="notes" value="${Utils.escapeHtml(fund.notes || '')}">
          </div>
          <div class="form-group" style="grid-column: 1 / -1; background:var(--slate-50); padding:16px; border-radius:8px; border:1px dashed var(--slate-300);">
            <label class="form-label">Update Receipt Photos / PDFs (Optional)</label>
            <div id="edit-fund-receipt-preview-area" style="display:none; margin-bottom:12px;"></div>
            <input type="file" id="edit-fund-receipt-upload" multiple class="form-input" style="padding:4px; font-size:13px">
            <small class="form-hint" style="margin-top:8px; display:block">New uploads will add to the existing receipts. Remove manually if replacing.</small>
            <input type="hidden" id="edit-fund-receipt-base64-hidden" value="">
          </div>
          <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
            <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Funds</button>
          </div>
        </form>
      `;

      Utils.hideLoading();
      Utils.openModal('Edit Logged Funds', html);

      if (fund.receipt_base64) {
        document.getElementById('edit-fund-receipt-base64-hidden').value = fund.receipt_base64;
      }

      this.initMultiUpload('edit-fund-receipt-upload', 'edit-fund-receipt-base64-hidden', 'edit-fund-receipt-preview-area', 'edit-funds-form');

      document.getElementById('edit-funds-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading...';

        const data = {
          receive_date: fd.get('receive_date'),
          amount: parseFloat(fd.get('amount')) || 0,
          description: fd.get('description'),
          notes: fd.get('notes'),
          receipt_base64: document.getElementById('edit-fund-receipt-base64-hidden').value || null
        };

        try {
          this.showProcessingOverlay('Company Fund', data.amount, true);
          await API.updateFund(id, data);
          Utils.closeModal();
          this.finishProcessingOverlay();
          setTimeout(() => this.render(), 1200);
        } catch (err) {
          this.hideProcessingOverlayError();
          Utils.showToast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Update Funds';
        }
      });
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async openEditExpenseModal(id) {
    if (App.isViewer()) return;
    Utils.showLoading('Loading', 'Preparing form');
    try {
      let exp;
      if (this.cachedExpenses) {
        exp = this.cachedExpenses.find(e => String(e.id) === String(id));
      }
      if (!exp) {
        // Fallback only if absolutely necessary
        const expenses = await API.getExpenses();
        exp = expenses.find(e => String(e.id) === String(id));
      }
      if (!exp) throw new Error('Expense record not found');

      const categories = ['Advance', 'Food', 'Cash Relay', 'Internet Package', 'Transport', 'Equipment', 'Maintenance', 'Uniform', 'Other', 'Health / Medical'];
      
      let riderOptions = '<option value="">-- General / Vendor --</option>';
      this.riders.forEach(r => {
        riderOptions += `<option value="${r.id}" ${r.id === exp.rider_id ? 'selected' : ''}>${r.name} (${r.client_company || 'Active'})</option>`;
      });

      const pillsHtml = categories.map(c => `
        <div class="expense-cat-pill ${c === exp.category ? 'active' : ''}" data-cat="${c}" onclick="document.getElementById('edit-expense-cat').value='${c}'; document.querySelectorAll('#edit-expense-form .expense-cat-pill').forEach(p=>p.classList.remove('active')); this.classList.add('active'); document.getElementById('edit-expense-cat').dispatchEvent(new Event('change'));">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          ${c}
        </div>
      `).join('');

      const getInitialDeductType = (exp) => {
        if (exp.is_deductible && (exp.is_deductible === 'true' || exp.is_deductible === 1 || exp.is_deductible === true)) {
          return exp.rider_id ? 'deductible' : 'supervisor';
        }
        return 'company';
      };
      const initialDeductType = getInitialDeductType(exp);

      const html = `
        <form id="edit-expense-form" style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
          
          <!-- Hidden actual select to maintain form logic -->
          <select name="category" id="edit-expense-cat" required style="display:none;">
            <option value="">Select Category</option>
            ${categories.map(c => `<option value="${c}" ${c === exp.category ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
          
          <div>
            <label class="expense-form-label" style="margin-bottom:8px;">Category</label>
            <div class="expense-cat-pills">
              ${pillsHtml}
            </div>
          </div>

          <div>
            <label class="expense-form-label">Deductibility</label>
            <select class="expense-form-input" name="deduct_type" id="edit-expense-deductible">
              <option value="company" ${initialDeductType === 'company' ? 'selected' : ''}>Company Paid</option>
              <option value="deductible" ${initialDeductType === 'deductible' ? 'selected' : ''}>Rider Deductible (rider will repay)</option>
              <option value="supervisor" ${initialDeductType === 'supervisor' ? 'selected' : ''}>Non-Rider Deductible (person will repay)</option>
            </select>
            <div id="edit-medical-hint" style="color:#2563EB; font-size:12px; font-weight:500; margin-top:6px; display:none;">Medical expenses are always covered by the company</div>
          </div>

          <div style="display:flex; gap:16px;">
            <div style="flex:1;">
              <label class="expense-form-label">Date</label>
              <input type="date" class="expense-form-input" name="expense_date" required value="${exp.expense_date}" max="${Utils.today()}">
            </div>
            <div style="flex:1;">
              <label class="expense-form-label">Amount (SAR)</label>
              <input type="number" step="0.01" min="0" class="expense-form-input" name="amount" id="edit-expense-amount" required placeholder="0.00" value="${exp.amount}" oninput="document.getElementById('edit-expense-footer-total').innerText = 'Logging: SAR ' + (parseFloat(this.value)||0).toFixed(2) + ' · April 2026 cycle'; document.getElementById('edit-expense-submit-btn').disabled = !(parseFloat(this.value)>0 && document.getElementById('edit-expense-cat').value);">
            </div>
          </div>
          
          <div>
            <label class="expense-form-label">Linked Rider</label>
            <select class="expense-form-input" name="rider_id" id="edit-expense-rider">
              ${riderOptions}
            </select>
          </div>
          
          <div id="edit-vendor-group" style="display:none; transition: all 150ms;">
            <label class="expense-form-label">Vendor or Person Name</label>
            <input type="text" class="expense-form-input" name="vendor_name" id="edit-vendor-input" value="${Utils.escapeHtml(exp.vendor_name || '')}" placeholder="e.g. AC Installer, Petrol, Syed Shahzad">
          </div>
          
          <div>
            <label class="expense-form-label">Notes</label>
            <textarea class="expense-form-input" name="notes" placeholder="Optional notes...">${Utils.escapeHtml(exp.notes || '')}</textarea>
          </div>
          
          <div>
            <div class="expense-upload-zone" onclick="document.getElementById('edit-receipt-upload').click()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span class="upload-text" style="font-size:13px; font-weight:500;">Attach receipt or PDF</span>
            </div>
            <div id="edit-receipt-preview-area" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
            <input type="file" id="edit-receipt-upload" multiple accept="image/*,.pdf" style="display:none;">
            <div style="font-size:11px; color:#9CA3AF; margin-top:6px;">Images compressed automatically · PDFs supported</div>
            <input type="hidden" id="edit-receipt-base64-hidden">
          </div>
          
          <div class="expense-footer">
            <div id="edit-expense-footer-total" style="font-size:12px; color:#6B7280;">Logging: SAR ${(parseFloat(exp.amount)||0).toFixed(2)} · April 2026 cycle</div>
            <div style="display:flex; gap:12px;">
              <button type="button" onclick="Utils.closeModal()" style="width:120px; height:42px; border-radius:10px; border:1px solid #E5E7EB; background:white; color:#6B7280; font-weight:500; cursor:pointer;">Cancel</button>
              <button type="submit" id="edit-expense-submit-btn" style="width:140px; height:42px; border-radius:10px; border:none; background:#2563EB; color:white; font-weight:600; cursor:pointer; transition:opacity 150ms;">Save Expense</button>
            </div>
          </div>
        </form>
      `;

      Utils.hideLoading();
      Utils.openModal('<div style="font-size:18px;font-weight:bold;color:#0F0F0F;">Edit Expense</div><div style="font-size:13px;color:#6B7280;font-weight:normal;margin-top:2px;">Modify logged expense details</div>', html, 'modal-expense');
      
      // Inject base64 directly to avoid massive HTML parsing freezes
      if (exp.receipt_base64) {
        document.getElementById('edit-receipt-base64-hidden').value = exp.receipt_base64;
      }

      const catSelect = document.getElementById('edit-expense-cat');
      const riderSelect = document.getElementById('edit-expense-rider');
      const vendorGroup = document.getElementById('edit-vendor-group');
      const vendorInput = document.getElementById('edit-vendor-input');
      const submitBtn = document.getElementById('edit-expense-submit-btn');
      const amountInput = document.getElementById('edit-expense-amount');

      const checkSubmitBtn = () => {
         const amt = parseFloat(amountInput.value) || 0;
         if (amt > 0 && catSelect.value) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
         } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
         }
      };

      const updateEditVisibility = () => {
        const cat = catSelect.value;
        const deductibleSelect = document.getElementById('edit-expense-deductible');
        const medHint = document.getElementById('edit-medical-hint');
        
        if (cat === 'Health / Medical') {
           deductibleSelect.value = 'company';
           deductibleSelect.disabled = true;
           medHint.style.display = 'block';
        } else {
           deductibleSelect.disabled = false;
           medHint.style.display = 'none';
           if (['Advance', 'Food', 'Cash Relay'].includes(cat)) {
              if (riderSelect.value) {
                 deductibleSelect.value = 'deductible';
              } else {
                 deductibleSelect.value = 'supervisor';
              }
           } else if (deductibleSelect.value === 'false' || deductibleSelect.value === 'true') {
              deductibleSelect.value = 'company';
           }
        }
        
        if (cat === 'Other' || riderSelect.value === '') {
          vendorGroup.style.display = 'block';
          vendorInput.required = true;
        } else {
          vendorGroup.style.display = 'none';
          vendorInput.required = false;
        }
        
        checkSubmitBtn();
      };

      catSelect.addEventListener('change', updateEditVisibility);
      riderSelect.addEventListener('change', updateEditVisibility);
      amountInput.addEventListener('input', checkSubmitBtn);
      updateEditVisibility();

      this.initMultiUpload('edit-receipt-upload', 'edit-receipt-base64-hidden', 'edit-receipt-preview-area', 'edit-expense-form');

      document.getElementById('edit-expense-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:8px;"><div class="spinner" style="width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div> Saving...</span>';
        submitBtn.style.opacity = '0.7';

        const category = fd.get('category');
        const deductType = document.getElementById('edit-expense-deductible').value;
        const isDeductible = deductType !== 'company';
        
        const data = {
          expense_date: fd.get('expense_date'),
          category: category,
          amount: parseFloat(fd.get('amount')) || 0,
          is_deductible: isDeductible,
          notes: fd.get('notes'),
          receipt_base64: document.getElementById('edit-receipt-base64-hidden').value || null
        };

        if (fd.get('rider_id')) {
          data.rider_id = parseInt(fd.get('rider_id'));
        } else {
          data.rider_id = null;
        }
        if (fd.get('vendor_name')) {
          data.vendor_name = fd.get('vendor_name');
        } else {
          data.vendor_name = '';
        }

        try {
          this.showProcessingOverlay(category, data.amount, false);
          await API.updateExpense(id, data);
          Utils.closeModal();
          this.finishProcessingOverlay();
          Utils.showToast('Expense updated successfully', 'success');
          this.deductionsData = null; // Clear cache
          setTimeout(() => this.render(), 1200);
        } catch (err) {
          this.hideProcessingOverlayError();
          Utils.showToast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save Expense';
          submitBtn.style.opacity = '1';
        }
      });
    } catch (err) {
      Utils.showToast(err.message, 'error');
    }
  },

  async viewReceipt(id) {
    Utils.showLoading('Loading document', 'Fetching from secure storage');
    try {
      const expenses = await API.getExpenses();
      Utils.hideLoading();
      const exp = expenses.find(e => String(e.id) === String(id));
      if (!exp || !exp.receipt_base64) return Utils.showToast('Receipt not found or corrupted.', 'error');
      
      let files = [];
      try {
        files = JSON.parse(exp.receipt_base64);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (exp.receipt_base64.startsWith('data:')) {
           files = [{ type: exp.receipt_base64.startsWith('data:application/pdf') ? 'pdf' : 'image', data: exp.receipt_base64 }];
        } else {
           files = [];
        }
      }

      let innerHtml = files.map(f => {
        if (f.type === 'pdf') {
          return `
            <div style="margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
              <iframe src="${f.data}#toolbar=0" style="width:100%; height:60vh; border-radius:8px; border:1px solid var(--slate-300);"></iframe>
              <a href="${f.data}" download="receipt.pdf" style="padding:6px 16px; background:#F3F4F6; color:#4B5563; border-radius:6px; font-size:13px; font-weight:500; text-decoration:none; border:1px solid #E5E7EB;">Download PDF</a>
            </div>
          `;
        }
        return `<img src="${f.data}" style="max-width:100%; max-height:75vh; border-radius:8px; border:1px solid var(--slate-300); margin-bottom:12px;">`;
      }).join('<hr style="border:none; border-top:1px solid #E5E7EB; margin: 16px 0;">');

      const html = `<div style="text-align:center; padding-top:10px; max-height:80vh; overflow-y:auto; overflow-x:hidden;">${innerHtml}</div>`;
      Utils.openModal(`Verified Receipt — SR ${exp.amount}`, html);
    } catch(err) {
      Utils.hideLoading();
      Utils.showToast('Failed to load receipt', 'error');
    }
  },

  async viewFundReceipt(id) {
    Utils.showLoading('Loading document', 'Fetching from secure storage');
    try {
      const funds = await API.getFunds();
      Utils.hideLoading();
      const fund = funds.find(f => String(f.id) === String(id));
      if (!fund || !fund.receipt_base64) return Utils.showToast('Receipt not found or corrupted.', 'error');
      
      let files = [];
      try {
        files = JSON.parse(fund.receipt_base64);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (fund.receipt_base64.startsWith('data:')) {
           files = [{ type: fund.receipt_base64.startsWith('data:application/pdf') ? 'pdf' : 'image', data: fund.receipt_base64 }];
        } else {
           files = [];
        }
      }

      let innerHtml = files.map(f => {
        if (f.type === 'pdf') {
          return `
            <div style="margin-bottom:12px; display:flex; flex-direction:column; align-items:center; gap:8px;">
              <iframe src="${f.data}#toolbar=0" style="width:100%; height:60vh; border-radius:8px; border:1px solid var(--slate-300);"></iframe>
              <a href="${f.data}" download="fund_receipt.pdf" style="padding:6px 16px; background:#F3F4F6; color:#4B5563; border-radius:6px; font-size:13px; font-weight:500; text-decoration:none; border:1px solid #E5E7EB;">Download PDF</a>
            </div>
          `;
        }
        return `<img src="${f.data}" style="max-width:100%; max-height:75vh; border-radius:8px; border:1px solid var(--slate-300); margin-bottom:12px;">`;
      }).join('<hr style="border:none; border-top:1px solid #E5E7EB; margin: 16px 0;">');

      const html = `<div style="text-align:center; padding-top:10px; max-height:80vh; overflow-y:auto; overflow-x:hidden;">${innerHtml}</div>`;
      Utils.openModal(`Verified Receipt — SR ${fund.amount}`, html);
    } catch(err) {
      Utils.hideLoading();
      Utils.showToast('Failed to load receipt', 'error');
    }
  },

  async scanReceiptForAmount(b64, inputId) {
    if (!window.Tesseract) return; 
    
    const inputElement = document.getElementById(inputId);
    if (!inputElement || inputElement.value) return;

    Utils.showToast('AI is scanning receipt for amount...', 'info');

    try {
      const result = await Tesseract.recognize(b64, 'eng');
      const text = result.data.text;
      
      // We look for patterns like 'Total 25.50', 'SR 5', 'Amount: 120'
      // By looking globally, we try to find the last or most prominent amount
      const regex = /(?:total|amount|sar|sr|net)[:\s]*([0-9]{1,4}(?:\.[0-9]{2})?)/i;
      const match = text.match(regex);
      
      // Also as fallback, find the largest lone float if it exists in the last few lines
      let amount = 0;
      if (match && match[1]) {
        amount = parseFloat(match[1]);
      } else {
        // Fallback: look for floats like 12.50 or 150.00
        const floats = [...text.matchAll(/[0-9]+\.[0-9]{2}/g)].map(m => parseFloat(m[0]));
        if (floats.length > 0) {
          amount = Math.max(...floats);
        }
      }

      if (amount > 0) {
        if (!inputElement.value) {
           inputElement.value = amount;
           Utils.showToast(`AI detected Amount: SR ${amount}`, 'success');
        }
      } else {
         Utils.showToast('AI could not confidently detect amount.', 'info');
      }
    } catch (e) {
      console.warn("OCR completely failed", e);
    }
  },

  showProcessingOverlay(category, amount, isFund = false) {
    const activeDate = Utils.getActiveDate();
    const monthYear = new Date(activeDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    Utils.showLoading(`Saving ${isFund ? 'funds' : 'expense'}`, `Recording to ${monthYear} cycle`);
  },

  finishProcessingOverlay() {
    Utils.hideLoading();
  },
  
  hideProcessingOverlayError() {
    Utils.hideLoading();
  },

  initMultiUpload(inputId, hiddenId, previewAreaId, formId) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const previewArea = document.getElementById(previewAreaId);
    
    if (!input || !hidden || !previewArea) return;

    input.accept = "image/jpeg, image/png, image/webp, application/pdf";
    input.multiple = true;
    
    let files = [];
    if (hidden.value) {
      try {
        files = JSON.parse(hidden.value);
        if (!Array.isArray(files)) throw new Error('Not array');
      } catch(e) {
        if (hidden.value.startsWith('data:')) {
           files = [{ type: hidden.value.startsWith('data:application/pdf') ? 'pdf' : 'image', data: hidden.value }];
        } else {
           files = [];
        }
      }
    }
    
    const renderPreviews = () => {
      hidden.value = files.length ? JSON.stringify(files) : '';
      if (files.length === 0) {
        previewArea.style.display = 'none';
        return;
      }
      previewArea.style.display = 'flex';
      previewArea.style.gap = '6px';
      previewArea.style.flexWrap = 'wrap';
      previewArea.style.justifyContent = 'flex-start';
      
      let html = '';
      files.forEach((f, i) => {
        const isPdf = f.type === 'pdf';
        const iconSvg = isPdf 
          ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
        
        // Extract filename from the data URL or generate one
        let filename = isPdf ? 'document.pdf' : 'receipt.jpg';
        if (f.name) filename = f.name;

        html += `
          <div style="background:#F3F4F6; border-radius:8px; height:28px; display:flex; align-items:center; padding:0 8px; gap:6px;">
            ${iconSvg}
            <span style="font-size:12px; color:#374151; max-width:80px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(filename)}</span>
            <button type="button" class="btn-remove-file" data-idx="${i}" style="background:none; border:none; color:#9CA3AF; padding:0; cursor:pointer; display:flex; align-items:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
      });
      previewArea.innerHTML = html;
      
      previewArea.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          files.splice(parseInt(btn.dataset.idx), 1);
          renderPreviews();
        });
      });
    };

    renderPreviews();

    input.addEventListener('change', async (e) => {
      const selectedFiles = Array.from(e.target.files);
      if (!selectedFiles.length) return;
      
      const submitBtn = document.querySelector(`#${formId} button[type="submit"]`);
      const originalText = submitBtn ? submitBtn.innerText : 'Processing...';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = 'Processing...'; }

      for (let file of selectedFiles) {
        if (file.type === 'application/pdf') {
          await new Promise(r => {
             const reader = new FileReader();
             reader.onload = (ev) => {
               files.push({ type: 'pdf', data: ev.target.result, name: file.name });
               r();
             };
             reader.readAsDataURL(file);
          });
        } else if (file.type.startsWith('image/')) {
          await new Promise(r => {
             const reader = new FileReader();
             reader.onload = (ev) => {
               const img = new Image();
               img.onload = () => {
                 const canvas = document.createElement('canvas');
                 const MAX_WIDTH = 800, MAX_HEIGHT = 800;
                 let width = img.width, height = img.height;
                 if (width > height && width > MAX_WIDTH) { height = Math.round(height * MAX_WIDTH/width); width = MAX_WIDTH; }
                 else if (height > MAX_HEIGHT) { width = Math.round(width * MAX_HEIGHT/height); height = MAX_HEIGHT; }
                 canvas.width = width; canvas.height = height;
                 canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                 files.push({ type: 'image', data: canvas.toDataURL('image/jpeg', 0.7), name: file.name });
                 r();
               };
               img.onerror = r;
               img.src = ev.target.result;
             };
             reader.readAsDataURL(file);
          });
        }
      }

      const amountInput = document.querySelector(`#${formId} input[name="amount"]`);
      if (amountInput && !amountInput.value) {
         const firstImg = files.find(f => f.type === 'image');
         if (firstImg) {
            if (!amountInput.id) amountInput.id = `amt-${Date.now()}`;
            Expenses.scanReceiptForAmount(firstImg.data, amountInput.id);
         }
      }

      renderPreviews();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = originalText; }
      e.target.value = '';
    });
  },

  renderThumbnail(base64Str, onclickStr) {
    if (!base64Str) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    let files = [];
    try {
      files = JSON.parse(base64Str);
      if (!Array.isArray(files)) throw new Error();
    } catch(e) {
      if (base64Str.startsWith('data:')) {
         files = [{ type: base64Str.startsWith('data:application/pdf') ? 'pdf' : 'image', data: base64Str }];
      } else {
         return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
      }
    }
    
    if (files.length === 0) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    
    let countBadge = '';
    if (files.length > 1) {
      countBadge = `<div style="position:absolute; bottom:-6px; right:-6px; background:#2563EB; color:white; border-radius:50%; font-size:10px; font-weight:bold; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">+${files.length - 1}</div>`;
    }
    
    const first = files[0];
    const previewHtml = first.type === 'pdf' 
       ? `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#dc2626; font-size:10px; border-radius:6px; overflow:hidden;">PDF</div>`
       : `<img src="${first.data}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
       
    return `<div onclick="${onclickStr}" style="position:relative; cursor:pointer; display:inline-block; border:1px solid #E5E7EB; border-radius:6px; overflow:visible; width:36px; height:36px; background:#F9FAFB; transition: 0.2s;" onmouseover="this.style.opacity=0.8; transform:scale(1.05);" onmouseout="this.style.opacity=1; transform:scale(1);" title="Click to view receipt(s)">${previewHtml}${countBadge}</div>`;
  },

  openCustomExcelReportModal() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    // Compute preset ranges
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset).toISOString().split('T')[0];

    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];

    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    const thisYearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

    const html = `
          <label class="form-label">Start Date</label>
          <input type="date" class="form-input" name="start_date" required value="${firstOfMonth}">
        </div>
        <div class="form-group" style="grid-column: 2 / 3;">
          <label class="form-label">End Date</label>
          <input type="date" class="form-input" name="end_date" required value="${today}">
        </div>
        <div class="form-group" style="grid-column: 1 / -1; background:linear-gradient(135deg,#EFF6FF,#F0FDF4); border: 1px solid #BFDBFE; padding: 14px 16px; border-radius: 10px; font-size: 13px; color: #1E3A8A; line-height: 1.6; margin-bottom: 8px;">
          <strong style="font-size:14px;">📊 What's included in the report:</strong>
          <ul style="margin: 6px 0 0 16px; padding: 0; list-style-type: none;">
            <li>✅ <strong>Financial Overview</strong> — period totals + all-time global balance</li>
            <li>✅ <strong>Funds Received</strong> — every transfer in the selected period</li>
            <li>✅ <strong>Expenses Logged</strong> — every expense in the period (excludes manual deductions)</li>
            <li>✅ <strong>Category Breakdown</strong> — how much spent per category (Fuel, Sim, etc.)</li>
            <li>✅ <strong>Rider Breakdown</strong> — how much spent per rider/recipient</li>
            <li>✅ <strong>Prominent Global Balance</strong> — big highlight of the remaining or out-of-pocket amount</li>
          </ul>
        </div>
        <div class="form-actions" style="grid-column: 1 / -1; justify-content: flex-end; margin-top: 10px;">
          <button type="button" class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success" style="background:linear-gradient(135deg,#10B981,#059669); border:none; color:#FFFFFF; font-weight:600; padding:10px 24px; font-size:14px;">📥 Export Excel</button>
        </div>
      </form>
    `;

    Utils.openModal('📊 Custom Date Range Excel Report', html);

    document.getElementById('custom-excel-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const start = fd.get('start_date');
      const end = fd.get('end_date');
      Expenses.generateCustomExcelReport(start, end);
    });
  },

  async generateCustomExcelReport(start, end) {
    if (!start || !end) {
      Utils.showToast('Please select a valid date range.', 'error');
      return;
    }
    if (new Date(start) > new Date(end)) {
      Utils.showToast('Start Date cannot be after End Date.', 'error');
      return;
    }

    Utils.showLoading('Generating Excel Report...', 'Fetching data and building sheet...');

    try {
      if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS library not loaded. Please refresh the page and try again.');
      }

      // Fetch period details and globalStats
      const [expenses, funds, globalStats] = await Promise.all([
        API.getExpenses(start, end),
        API.getFunds(start, end),
        API.getExpenseStats()
      ]);

      const validExpenses = expenses.filter(e => e.category !== 'Manual Deduction');
      const totalFundsPeriod = funds.reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);
      const totalExpensesPeriod = validExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const netPeriod = totalFundsPeriod - totalExpensesPeriod;

      const gStats = globalStats || {
        total_received: 0,
        total_expenses: 0,
        remaining_irl: 0,
        from_my_pocket: 0
      };

      // ── Build category & rider breakdowns ──
      const categoryMap = {};
      const riderMap = {};
      validExpenses.forEach(e => {
        const cat = e.category || 'Other';
        const rider = e.rider_name || 'Company Covered';
        const amt = parseFloat(e.amount) || 0;
        categoryMap[cat] = (categoryMap[cat] || 0) + amt;
        riderMap[rider] = (riderMap[rider] || 0) + amt;
      });
      const categoryBreakdown = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      const riderBreakdown = Object.entries(riderMap).sort((a, b) => b[1] - a[1]);

      // Deductible vs Company paid totals
      const totalDeductible = validExpenses.filter(e => e.is_deductible === 1 || e.is_deductible === true).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
      const totalCompanyPaid = totalExpensesPeriod - totalDeductible;

      // Create workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Inspiring Roads Logistics';
      wb.title = 'Custom Financial Statement';

      const ws = wb.addWorksheet('Financial Statement', {
        views: [{ showGridLines: false }],
        pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      // Define grid columns A-G (added col G for row #)
      ws.columns = [
        { width: 5 },  // A: # row number
        { width: 14 }, // B: Date
        { width: 24 }, // C: Category / Source
        { width: 22 }, // D: Rider / Description
        { width: 18 }, // E: Amount (SAR)
        { width: 34 }, // F: Notes / Description
        { width: 16 }  // G: Type / Status
      ];

      // Palette styling constants
      const C = {
        dark: 'FF0F172A',
        darkBlue: 'FF1E293B',
        blue: 'FF1E3A8A',
        green: 'FF16A34A',
        red: 'FFDC2626',
        white: 'FFFFFFFF',
        border: 'FFE2E8F0',
        muted: 'FF64748B',
        zebra: 'FFF8FAFC',
        lightGreen: 'FFD1FAE5',
        lightRed: 'FFFEE2E2',
        lightBlue: 'FFDBEAFE',
        lightAmber: 'FFFEF3C7',
        amber: 'FFD97706',
        purple: 'FF7C3AED',
        lightPurple: 'FFF3E8FF'
      };

      const thinBorder = {
        top: { style: 'thin', color: { argb: C.border } },
        bottom: { style: 'thin', color: { argb: C.border } },
        left: { style: 'thin', color: { argb: C.border } },
        right: { style: 'thin', color: { argb: C.border } }
      };

      // Helper to apply border to a full row range
      const applyRowBorder = (rowNum, startCol, endCol) => {
        for (let col = startCol; col <= endCol; col++) {
          ws.getRow(rowNum).getCell(col).border = thinBorder;
        }
      };

      // ══════════════════════════════════════════════════════
      // ── SECTION: Title Banner ──
      // ══════════════════════════════════════════════════════
      ws.mergeCells(1, 1, 1, 7);
      const h1 = ws.getCell('A1');
      h1.value = 'INSPIRING ROADS LOGISTICS';
      h1.font = { name: 'Calibri', bold: true, size: 18, color: { argb: C.white } };
      h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
      h1.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(1).height = 36;

      ws.mergeCells(2, 1, 2, 7);
      const h2 = ws.getCell('A2');
      const startFmt = new Date(start + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const endFmt = new Date(end + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      h2.value = `Custom Financial Statement  ·  ${startFmt}  →  ${endFmt}`;
      h2.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF94A3B8' } };
      h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.dark } };
      h2.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 24;

      ws.mergeCells(3, 1, 3, 7);
      const h3 = ws.getCell('A3');
      h3.value = `Generated: ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`;
      h3.font = { name: 'Calibri', italic: true, size: 9, color: { argb: C.muted } };
      h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      h3.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(3).height = 20;

      // "?"? BIG HIGHLIGHT BOXES "?"?
      let r = 5;

      // --- PERIOD METRICS (BIG NUMBERS) ---
      ws.mergeCells(r, 1, r, 7);
      const pTitle = ws.getCell(`A${r}`);
      pTitle.value = ' PERIOD SUMMARY (Selected Dates)';
      pTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.white } };
      pTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.blue } };
      pTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      pTitle.border = thinBorder;
      ws.getRow(r).height = 26;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const pRecLbl = ws.getCell(`A${r}`);
      pRecLbl.value = 'FUNDS RECEIVED';
      pRecLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF064E3B' } };
      pRecLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      pRecLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      pRecLbl.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const pExpLbl = ws.getCell(`D${r}`);
      pExpLbl.value = 'EXPENSES';
      pExpLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF7F1D1D' } };
      pExpLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      pExpLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      pExpLbl.border = thinBorder;
      ws.getRow(r).height = 22;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const pRecVal = ws.getCell(`A${r}`);
      pRecVal.value = totalFundsPeriod;
      pRecVal.numFmt = '#,##0.00 "SAR"';
      pRecVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.green } };
      pRecVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      pRecVal.alignment = { vertical: 'middle', horizontal: 'center' };
      pRecVal.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const pExpVal = ws.getCell(`D${r}`);
      pExpVal.value = totalExpensesPeriod;
      pExpVal.numFmt = '#,##0.00 "SAR"';
      pExpVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.red } };
      pExpVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      pExpVal.alignment = { vertical: 'middle', horizontal: 'center' };
      pExpVal.border = thinBorder;
      ws.getRow(r).height = 40;

      // --- GLOBAL METRICS (BIG NUMBERS) ---
      r += 2;
      ws.mergeCells(r, 1, r, 7);
      const gTitle = ws.getCell(`A${r}`);
      gTitle.value = ' GLOBAL SUMMARY (All-Time)';
      gTitle.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.white } };
      gTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
      gTitle.alignment = { vertical: 'middle', horizontal: 'center' };
      gTitle.border = thinBorder;
      ws.getRow(r).height = 26;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const gRecLbl = ws.getCell(`A${r}`);
      gRecLbl.value = 'GLOBAL RECEIVED';
      gRecLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF064E3B' } };
      gRecLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gRecLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      gRecLbl.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const gExpLbl = ws.getCell(`D${r}`);
      gExpLbl.value = 'GLOBAL EXPENSES';
      gExpLbl.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF7F1D1D' } };
      gExpLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gExpLbl.alignment = { vertical: 'middle', horizontal: 'center' };
      gExpLbl.border = thinBorder;
      ws.getRow(r).height = 22;

      r++;
      ws.mergeCells(r, 1, r, 3);
      const gRecVal = ws.getCell(`A${r}`);
      gRecVal.value = parseFloat(gStats.total_received) || 0;
      gRecVal.numFmt = '#,##0.00 "SAR"';
      gRecVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.green } };
      gRecVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gRecVal.alignment = { vertical: 'middle', horizontal: 'center' };
      gRecVal.border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      const gExpVal = ws.getCell(`D${r}`);
      gExpVal.value = parseFloat(gStats.total_expenses) || 0;
      gExpVal.numFmt = '#,##0.00 "SAR"';
      gExpVal.font = { name: 'Calibri', bold: true, size: 22, color: { argb: C.red } };
      gExpVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      gExpVal.alignment = { vertical: 'middle', horizontal: 'center' };
      gExpVal.border = thinBorder;
      ws.getRow(r).height = 40;

      // EXTRA ROWS FOR REMAINING FUNDS AND DEDUCTIBLES
      r++;
      ws.mergeCells(r, 1, r, 3);
      const isOutOfPocket = gStats.from_my_pocket > 0;
      const globalBalVal = isOutOfPocket ? gStats.from_my_pocket : gStats.remaining_irl;
      const balLabel = isOutOfPocket ? 'Out of Pocket' : 'Remaining Funds';
      const balColor = isOutOfPocket ? C.red : C.green;
      ws.getCell(`A${r}`).value = `  ${balLabel}: ${globalBalVal.toFixed(2)} SAR`;
      ws.getCell(`A${r}`).font = { name: 'Calibri', size: 11, bold: true, color: { argb: balColor } };
      ws.getCell(`A${r}`).alignment = { vertical: 'middle' };
      ws.getCell(`A${r}`).border = thinBorder;

      ws.mergeCells(r, 4, r, 7);
      ws.getCell(`D${r}`).value = `  Rider-Deductible (Period): ${totalDeductible.toFixed(2)} SAR`;
      ws.getCell(`D${r}`).font = { name: 'Calibri', size: 10, italic: true, color: { argb: C.amber } };
      ws.getCell(`D${r}`).alignment = { vertical: 'middle' };
      ws.getCell(`D${r}`).border = thinBorder;
      ws.getRow(r).height = 24;

      // ══════════════════════════════════════════════════════
      // ── SECTION 1: Funds Received ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const fundsTitle = ws.getCell(`A${r}`);
      fundsTitle.value = '  § 1.  FUNDS RECEIVED FROM COMPANY  (Period Only)';
      fundsTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
      fundsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      ws.getRow(r).height = 26;

      r += 2;
      const styleTableHeader = (rowNum, headers) => {
        const row = ws.getRow(rowNum);
        row.height = 24;
        headers.forEach((h, i) => {
          const cell = row.getCell(i + 1);
          cell.value = h;
          cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = thinBorder;
        });
      };

      styleTableHeader(r, ['#', 'Date', 'Source / Description', 'Reference / Notes', 'Amount', '', '']);
      ws.mergeCells(r, 5, r, 7);
      // Right-align Amount header
      ws.getCell(`E${r}`).alignment = { vertical: 'middle', horizontal: 'right' };

      const fundsStartRow = r + 1;

      if (funds.length === 0) {
        r++;
        ws.mergeCells(r, 1, r, 7);
        const cell = ws.getCell(`A${r}`);
        cell.value = 'No funds received during this period.';
        cell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: C.muted } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
        ws.getRow(r).height = 24;
      } else {
        funds.forEach((f, idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          const cNum = row.getCell(1);
          cNum.value = idx + 1;
          cNum.font = { name: 'Calibri', size: 9, color: { argb: C.muted } };
          cNum.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDate = row.getCell(2);
          cDate.value = f.receive_date ? new Date(f.receive_date + 'T12:00:00Z') : '';
          cDate.numFmt = 'dd-mmm-yyyy';
          cDate.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDesc = row.getCell(3);
          cDesc.value = f.description || 'IRL Transfer';

          const cNotes = row.getCell(4);
          cNotes.value = f.notes || '-';

          ws.mergeCells(r, 5, r, 7);
          const cAmt = row.getCell(5);
          cAmt.value = parseFloat(f.amount) || 0;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.green } };
          cAmt.alignment = { horizontal: 'right', vertical: 'middle' };

          for (let col = 1; col <= 7; col++) {
            const cell = row.getCell(col);
            cell.font = cell.font || { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            if ((idx) % 2 === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
            }
          }
        });

        // Funds Total Row
        r++;
        ws.mergeCells(r, 1, r, 4);
        ws.getCell(`A${r}`).value = `TOTAL RECEIVED  (${funds.length} transfer${funds.length !== 1 ? 's' : ''})`;
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10 };
        ws.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightGreen } };

        ws.mergeCells(r, 5, r, 7);
        const totFCell = ws.getCell(`E${r}`);
        totFCell.value = totalFundsPeriod;
        totFCell.numFmt = '#,##0.00 "SAR"';
        totFCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.green } };
        totFCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totFCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightGreen } };
        applyRowBorder(r, 1, 7);
        ws.getRow(r).height = 26;
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 2: Expenses Table ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const expTitle = ws.getCell(`A${r}`);
      expTitle.value = '  § 2.  OPERATIONAL EXPENSES  (Period Only)';
      expTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
      expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
      ws.getRow(r).height = 26;

      r += 2;
      styleTableHeader(r, ['#', 'Date', 'Category', 'Rider / Recipient', 'Amount', 'Description / Notes', 'Status']);

      const expHeaderRow = r;
      const expStartRow = r + 1;

      if (validExpenses.length === 0) {
        r++;
        ws.mergeCells(r, 1, r, 7);
        const cell = ws.getCell(`A${r}`);
        cell.value = 'No expenses logged during this period.';
        cell.font = { name: 'Calibri', italic: true, size: 10, color: { argb: C.muted } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = thinBorder;
        ws.getRow(r).height = 24;
      } else {
        validExpenses.forEach((e, idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          const cNum = row.getCell(1);
          cNum.value = idx + 1;
          cNum.font = { name: 'Calibri', size: 9, color: { argb: C.muted } };
          cNum.alignment = { horizontal: 'center', vertical: 'middle' };

          const cDate = row.getCell(2);
          cDate.value = e.expense_date ? new Date(e.expense_date + 'T12:00:00Z') : '';
          cDate.numFmt = 'dd-mmm-yyyy';
          cDate.alignment = { horizontal: 'center', vertical: 'middle' };

          const cCat = row.getCell(3);
          cCat.value = e.category || 'Other';
          cCat.alignment = { horizontal: 'center', vertical: 'middle' };

          const cRider = row.getCell(4);
          cRider.value = e.rider_name || 'Company Covered';

          const cAmt = row.getCell(5);
          cAmt.value = parseFloat(e.amount) || 0;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { horizontal: 'right', vertical: 'middle' };

          const cNotes = row.getCell(6);
          cNotes.value = e.notes || e.description || '-';

          const cDed = row.getCell(7);
          const isDed = e.is_deductible === 1 || e.is_deductible === true;
          cDed.value = isDed ? '⬤ Deductible' : '○ Company Paid';
          cDed.font = { name: 'Calibri', size: 9, bold: true, color: { argb: isDed ? C.amber : C.muted } };
          cDed.alignment = { horizontal: 'center', vertical: 'middle' };

          for (let col = 1; col <= 7; col++) {
            const cell = row.getCell(col);
            cell.font = cell.font || { name: 'Calibri', size: 10 };
            cell.border = thinBorder;
            if ((idx) % 2 === 1) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
            }
          }
        });

        // Expenses Total Row
        r++;
        ws.mergeCells(r, 1, r, 4);
        ws.getCell(`A${r}`).value = `TOTAL EXPENSES  (${validExpenses.length} item${validExpenses.length !== 1 ? 's' : ''})`;
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10 };
        ws.getCell(`A${r}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };

        const totExpCell = ws.getCell(`E${r}`);
        totExpCell.value = totalExpensesPeriod;
        totExpCell.numFmt = '#,##0.00 "SAR"';
        totExpCell.font = { name: 'Calibri', bold: true, size: 12, color: { argb: C.red } };
        totExpCell.alignment = { horizontal: 'right', vertical: 'middle' };
        totExpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightRed } };
        applyRowBorder(r, 1, 7);
        ws.getRow(r).height = 26;

        // ── Auto-filter on expenses table ──
        ws.autoFilter = { from: { row: expHeaderRow, column: 1 }, to: { row: r - 1, column: 7 } };
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 3: Expense Breakdown by Category ──
      // ══════════════════════════════════════════════════════
      if (categoryBreakdown.length > 0) {
        r += 3;
        ws.mergeCells(r, 1, r, 7);
        const catTitle = ws.getCell(`A${r}`);
        catTitle.value = '  § 3.  EXPENSE BREAKDOWN BY CATEGORY  (Period Only)';
        catTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
        catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.purple } };
        ws.getRow(r).height = 26;

        r += 2;
        // Header
        const catHdrRow = ws.getRow(r);
        catHdrRow.height = 24;
        ws.mergeCells(r, 1, r, 3);
        ws.getCell(`A${r}`).value = 'Category';
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`A${r}`).border = thinBorder;

        ws.mergeCells(r, 4, r, 5);
        ws.getCell(`D${r}`).value = 'Total Amount';
        ws.getCell(`D${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`D${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
        ws.getCell(`D${r}`).border = thinBorder;

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).value = '% of Total';
        ws.getCell(`F${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`F${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`F${r}`).border = thinBorder;

        categoryBreakdown.forEach(([cat, amt], idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          ws.mergeCells(r, 1, r, 3);
          const cCat = row.getCell(1);
          cCat.value = '  ' + cat;
          cCat.font = { name: 'Calibri', size: 10, bold: true };
          cCat.alignment = { vertical: 'middle' };

          ws.mergeCells(r, 4, r, 5);
          const cAmt = row.getCell(4);
          cAmt.value = amt;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { vertical: 'middle', horizontal: 'right' };

          ws.mergeCells(r, 6, r, 7);
          const cPct = row.getCell(6);
          const pct = totalExpensesPeriod > 0 ? (amt / totalExpensesPeriod) : 0;
          cPct.value = pct;
          cPct.numFmt = '0.0%';
          cPct.font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
          cPct.alignment = { vertical: 'middle', horizontal: 'center' };

          for (let col = 1; col <= 7; col++) {
            row.getCell(col).border = thinBorder;
            if (idx % 2 === 1) {
              row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightPurple } };
            }
          }
        });
      }

      // ══════════════════════════════════════════════════════
      // ── SECTION 4: Expense Breakdown by Rider ──
      // ══════════════════════════════════════════════════════
      if (riderBreakdown.length > 0) {
        r += 3;
        ws.mergeCells(r, 1, r, 7);
        const riderTitle = ws.getCell(`A${r}`);
        riderTitle.value = '  § 4.  EXPENSE BREAKDOWN BY RIDER / RECIPIENT  (Period Only)';
        riderTitle.font = { name: 'Calibri', bold: true, size: 11, color: { argb: C.white } };
        riderTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        ws.getRow(r).height = 26;

        r += 2;
        // Header
        ws.getRow(r).height = 24;
        ws.mergeCells(r, 1, r, 3);
        ws.getCell(`A${r}`).value = 'Rider / Recipient';
        ws.getCell(`A${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`A${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`A${r}`).border = thinBorder;

        ws.mergeCells(r, 4, r, 5);
        ws.getCell(`D${r}`).value = 'Total Amount';
        ws.getCell(`D${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`D${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`D${r}`).alignment = { vertical: 'middle', horizontal: 'right' };
        ws.getCell(`D${r}`).border = thinBorder;

        ws.mergeCells(r, 6, r, 7);
        ws.getCell(`F${r}`).value = '% of Total';
        ws.getCell(`F${r}`).font = { name: 'Calibri', bold: true, size: 10, color: { argb: C.white } };
        ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.darkBlue } };
        ws.getCell(`F${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
        ws.getCell(`F${r}`).border = thinBorder;

        riderBreakdown.forEach(([rider, amt], idx) => {
          r++;
          const row = ws.getRow(r);
          row.height = 22;

          ws.mergeCells(r, 1, r, 3);
          const cRider = row.getCell(1);
          cRider.value = '  ' + rider;
          cRider.font = { name: 'Calibri', size: 10, bold: true };
          cRider.alignment = { vertical: 'middle' };

          ws.mergeCells(r, 4, r, 5);
          const cAmt = row.getCell(4);
          cAmt.value = amt;
          cAmt.numFmt = '#,##0.00 "SAR"';
          cAmt.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.red } };
          cAmt.alignment = { vertical: 'middle', horizontal: 'right' };

          ws.mergeCells(r, 6, r, 7);
          const cPct = row.getCell(6);
          const pct = totalExpensesPeriod > 0 ? (amt / totalExpensesPeriod) : 0;
          cPct.value = pct;
          cPct.numFmt = '0.0%';
          cPct.font = { name: 'Calibri', size: 10, color: { argb: C.muted } };
          cPct.alignment = { vertical: 'middle', horizontal: 'center' };

          for (let col = 1; col <= 7; col++) {
            row.getCell(col).border = thinBorder;
            if (idx % 2 === 1) {
              row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.lightBlue } };
            }
          }
        });
      }

      // ══════════════════════════════════════════════════════
      // ── FOOTER ──
      // ══════════════════════════════════════════════════════
      r += 3;
      ws.mergeCells(r, 1, r, 7);
      const footerCell = ws.getCell(`A${r}`);
      footerCell.value = '— End of Report  ·  Inspiring Roads Logistics  ·  Confidential —';
      footerCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: C.muted } };
      footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
      footerCell.border = { top: { style: 'thin', color: { argb: C.border } } };
      ws.getRow(r).height = 22;

      // ── Freeze top 3 rows (title banner) ──
      ws.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

      // ── Download Workbook ──
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IRL_Financial_Report_${start}_to_${end}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      Utils.hideLoading();
      Utils.showToast('Excel Report exported successfully!', 'success');
      Utils.closeModal();

    } catch (err) {
      console.error('Custom Excel Export Error:', err);
      Utils.hideLoading();
      Utils.showToast('Failed to export Excel Report: ' + err.message, 'error');
    }
  },

  renderThumbnail(base64Str, onclickStr) {
    if (!base64Str) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    let files = [];
    try {
      files = JSON.parse(base64Str);
      if (!Array.isArray(files)) throw new Error();
    } catch(e) {
      if (base64Str.startsWith('data:')) {
         files = [{ type: base64Str.startsWith('data:application/pdf') ? 'pdf' : 'image', data: base64Str }];
      } else {
         return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
      }
    }
    
    if (files.length === 0) return `<span style="font-size:12px; color:#9CA3AF;">None</span>`;
    
    let countBadge = '';
    if (files.length > 1) {
      countBadge = `<div style="position:absolute; bottom:-6px; right:-6px; background:#2563EB; color:white; border-radius:50%; font-size:10px; font-weight:bold; width:18px; height:18px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.1); z-index:10;">+${files.length - 1}</div>`;
    }
    
    const first = files[0];
    const previewHtml = first.type === 'pdf' 
       ? `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#dc2626; font-size:10px; border-radius:6px; overflow:hidden;">PDF</div>`
       : `<img src="${first.data}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`;
       
    return `<div onclick="${onclickStr}" style="position:relative; cursor:pointer; display:inline-block; border:1px solid #E5E7EB; border-radius:6px; overflow:visible; width:36px; height:36px; background:#F9FAFB; transition: 0.2s;" onmouseover="this.style.opacity=0.8; transform:scale(1.05);" onmouseout="this.style.opacity=1; transform:scale(1);" title="Click to view receipt(s)">${previewHtml}${countBadge}</div>`;
  }
};
