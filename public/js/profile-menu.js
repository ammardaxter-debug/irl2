// ========================================
//  CONTROL HUB - Supervisor Profile & System Management
// ========================================

const ProfileMenu = {

  async open() {
    let admin = { name: 'Abdullah Khan', title: 'Manager', photo_url: '' };
    try {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session && session.user) {
        // Fetch the detailed profile from the new profiles node
        const emailKey = session.user.email.replace(/\./g, '_dot_');
        const pRes = await fetch('/api/admin/profiles');
        const allProfiles = await pRes.json();
        const profile = allProfiles[emailKey] || {};
        
        admin = {
          name: profile.name || session.user.name,
          title: profile.title || 'Administrator',
          photo_url: profile.photo_url || ''
        };
      }
    } catch(e) { console.warn('Could not fetch admin profile', e); }
    
    const supervisorName = admin.name;
    const supervisorTitle = admin.title;
    const photoUrl = admin.photo_url;
    
    const lang = localStorage.getItem('irl_lang') || 'en';
    const dateFmt = localStorage.getItem('irl_date_format') || 'DD/MM/YYYY';

    window.supervisorPhotoUrl = photoUrl;
    window.supervisorName = supervisorName;
    window.supervisorTitle = supervisorTitle;

    const avatarHtml = photoUrl
      ? `<img id="hub-avatar-img" src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : `<span id="hub-avatar-img" style="font-size:24px;font-weight:700;color:white;">${Utils.getInitials(supervisorName)}</span>`;

    const html = `
      <style>
        .hub-identity-card {
           display: flex; flex-direction: row; gap: 16px; padding: 16px;
           background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px;
           margin-bottom: 20px; align-items: center;
        }
        .hub-avatar-box {
           position: relative; width: 72px; height: 72px; border-radius: 50%;
           background: #2563EB; display: flex; align-items: center; justify-content: center;
           cursor: pointer; flex-shrink: 0; overflow: hidden;
        }
        .hub-avatar-overlay {
           position: absolute; inset: 0; background: rgba(0,0,0,0.45);
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           opacity: 0; transition: opacity 0.2s; color: white;
        }
        .hub-avatar-box:hover .hub-avatar-overlay { opacity: 1; }
        
        #hub-crop-container {
           display: none; width: 100%; text-align: center; margin-bottom: 20px;
           background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 16px;
        }
        .crop-preview-box {
           position: relative; width: 240px; height: 240px; margin: 0 auto 12px;
           overflow: hidden; border-radius: 10px; background: #E5E7EB;
           cursor: grab;
        }
        .crop-preview-box:active { cursor: grabbing; }
        .crop-img {
           transform-origin: center center; position: absolute;
        }
        .crop-mask {
           position: absolute; inset: 0; pointer-events: none;
           box-shadow: 0 0 0 9999px rgba(255,255,255,0.85);
           border-radius: 50%; border: 2px dashed #2563EB;
        }
        
        .hub-inline-edit {
           display: flex; align-items: center; gap: 8px; cursor: pointer;
           position: relative;
        }
        .hub-inline-edit:hover .edit-icon { color: #2563EB; }
        .edit-icon { color: #9CA3AF; transition: color 0.2s; }
        .hub-name-val { font-size: 16px; font-weight: 700; color: #0F0F0F; }
        .hub-title-val { font-size: 13px; color: #6B7280; font-weight: 500; }
        .hub-inline-input {
           font-size: 16px; font-weight: 700; color: #0F0F0F;
           border: none; border-bottom: 1.5px solid #2563EB;
           background: transparent; outline: none; padding: 0;
           width: 100%; display: none;
        }
        
        .hub-section {
          border-bottom: 1px solid #F3F4F6;
        }
        .hub-action-row {
          display:flex; align-items:center; gap:10px; height:44px; padding:0 20px;
          border-bottom:1px solid #F3F4F6; transition: background 120ms;
        }
        .hub-action-row:hover { background: #F9FAFB; }
        .hub-action-row:last-child { border-bottom:none; }
        .hub-action-icon {
          width:16px; height:16px; flex-shrink:0; color:#6B7280;
        }
        .hub-action-label {
          flex:1; font-size:13px; color:#374151;
        }
        .hub-action-btn {
          height:28px; padding:0 12px; border-radius:6px;
          font-size:12px; font-weight:500; cursor:pointer;
          border:1px solid #E5E7EB; background:#fff; color:#374151;
          transition:all 120ms;
        }
        .hub-action-btn:hover { border-color:#2563EB; color:#2563EB; background:#EFF6FF; }
        
        .hub-expand-header {
          display:flex; align-items:center; gap:10px; height:44px; padding:0 20px;
          cursor:pointer; user-select:none; transition: background 120ms;
        }
        .hub-expand-header:hover { background:#F9FAFB; }
        .hub-expand-header .chevron-toggle {
          margin-left:auto; transition:transform 0.2s; color:#9CA3AF;
        }
        .hub-expand-header .chevron-toggle.open { transform:rotate(180deg); }
        .hub-expand-body {
          display:none; padding:12px; margin: 0 20px 16px; background:#F9FAFB; border-radius:8px;
        }
        .hub-expand-body.open { display:block; }
        
        .hub-pref-row {
          display:flex; align-items:center; justify-content:space-between;
          height:36px;
        }
        .hub-pref-label { font-size:13px; color:#374151; font-weight:500; }
        .hub-seg-control {
          display:flex; border:1px solid #E5E7EB; border-radius:8px; overflow:hidden; height:26px;
        }
        .hub-seg-btn {
          padding:0 10px; font-size:11px; font-weight:500; cursor:pointer;
          background:#fff; color:#6B7280; border:none; border-right:1px solid #E5E7EB;
          transition:all 0.15s;
        }
        .hub-seg-btn:last-child { border-right:none; }
        .hub-seg-btn.active { background:#2563EB; color:white; }
        
        .hub-info-row {
          display:flex; justify-content:space-between; padding:8px 0;
          border-bottom:1px solid #F3F4F6;
        }
        .hub-info-row:last-child { border-bottom:none; }
        .hub-info-label {
          font-size:11px; text-transform:uppercase; color:#9CA3AF;
          letter-spacing:0.05em; font-weight:500;
        }
        .hub-info-value {
          font-size:13px; color:#374151; font-weight:500; text-align:right;
          max-width:240px; word-break:break-word;
        }
        .hub-footer {
          text-align:center; padding:12px 20px; font-size:11px; color:#9CA3AF;
        }
      </style>

      <div class="hub-identity-card" id="hub-identity-card">
        <div class="hub-avatar-box" onclick="document.getElementById('hub-photo-input').click()">
          ${avatarHtml}
          <div class="hub-avatar-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <div style="font-size:10px; margin-top:2px;">Change</div>
          </div>
        </div>
        <div style="flex:1;">
          <div class="hub-inline-edit" id="hub-name-wrap">
            <div class="hub-name-val" id="hub-name-val" onclick="ProfileMenu.editField('name')">${Utils.escapeHtml(supervisorName)}</div>
            <input type="text" class="hub-inline-input" id="hub-name-input" value="${Utils.escapeHtml(supervisorName)}" onblur="ProfileMenu.saveField('name')" onkeypress="if(event.key==='Enter') { this.blur(); }">
            <svg class="edit-icon" id="hub-name-edit-icon" onclick="ProfileMenu.editField('name')" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          
          <div class="hub-inline-edit" style="margin-top:2px;" id="hub-title-wrap">
            <div class="hub-title-val" id="hub-title-val" onclick="ProfileMenu.editField('title')">${Utils.escapeHtml(supervisorTitle)}</div>
            <input type="text" class="hub-inline-input" style="font-size:13px; font-weight:500; color:#6B7280;" id="hub-title-input" placeholder="e.g. Manager, Supervisor, Admin" value="${Utils.escapeHtml(supervisorTitle)}" onblur="ProfileMenu.saveField('title')" onkeypress="if(event.key==='Enter') { this.blur(); }">
            <svg class="edit-icon" id="hub-title-edit-icon" onclick="ProfileMenu.editField('title')" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          
          <div style="margin-top:8px;">
            <span style="font-size:10px; font-weight:600; padding:2px 10px; border-radius:10px; background:#F0FDF4; color:#16A34A;">IRL Pro v2.0.0</span>
          </div>
          <div id="hub-upload-status" style="font-size:10px; color:#6B7280; margin-top:4px; display:none;"></div>
        </div>
      </div>
      
      <div id="hub-crop-container">
        <div class="crop-preview-box" id="crop-preview-box">
          <img id="crop-img" class="crop-img" src="">
          <div class="crop-mask"></div>
        </div>
        <div style="display:flex; gap:8px; justify-content:center; margin-bottom:12px;">
          <button class="hub-action-btn" onclick="ProfileMenu.cropZoom(0.1)">Zoom In +</button>
          <button class="hub-action-btn" onclick="ProfileMenu.cropZoom(-0.1)">Zoom Out -</button>
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="hub-action-btn" onclick="ProfileMenu.cancelCrop()">Cancel</button>
          <button class="hub-action-btn" style="background:#2563EB; color:white; border:none;" onclick="ProfileMenu.applyCrop()">Apply Crop</button>
        </div>
      </div>
      
      <input type="file" id="hub-photo-input" accept="image/*" style="display:none;">

      <!-- Section 1: System Actions -->
      <div class="hub-section">
        <div class="hub-action-row">
          <svg class="hub-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          <span class="hub-action-label">Backup All Data</span>
          <button class="hub-action-btn" onclick="ProfileMenu.backupNow()">Download</button>
        </div>
        <div class="hub-action-row">
          <svg class="hub-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span class="hub-action-label">Export This Cycle (Excel)</span>
          <button class="hub-action-btn" onclick="ProfileMenu.exportCycle()">Export</button>
        </div>
        <div class="hub-action-row" style="background:#FFF5F5;">
          <svg class="hub-action-icon" style="color:#EF4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span class="hub-action-label" style="color:#C53030; font-weight:600;">Sign Out Session</span>
          <button class="hub-action-btn" style="border-color:#FCA5A5; background:#FFF; color:#EF4444;" onclick="ProfileMenu.logout()">Logout</button>
        </div>

        <!-- App Preferences -->
        <div class="hub-expand-header" onclick="ProfileMenu.toggleSection('prefs')">
          <svg class="hub-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span class="hub-action-label">App Preferences</span>
          <svg class="chevron-toggle" id="chevron-prefs" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="hub-expand-body" id="section-prefs">
          <div class="hub-pref-row">
            <span class="hub-pref-label">Language</span>
            <div class="hub-seg-control">
              <button class="hub-seg-btn ${lang==='en'?'active':''}" onclick="ProfileMenu.setLang('en',this)">English</button>
              <button class="hub-seg-btn ${lang==='ar'?'active':''}" onclick="ProfileMenu.setLang('ar',this)">العربية</button>
              <button class="hub-seg-btn ${lang==='ur'?'active':''}" onclick="ProfileMenu.setLang('ur',this)">اردو</button>
            </div>
          </div>
          <div class="hub-pref-row">
            <span class="hub-pref-label">Date Format</span>
            <div class="hub-seg-control">
              <button class="hub-seg-btn ${dateFmt==='DD/MM/YYYY'?'active':''}" onclick="ProfileMenu.setDateFmt('DD/MM/YYYY',this)">DD/MM/YYYY</button>
              <button class="hub-seg-btn ${dateFmt==='MM/DD/YYYY'?'active':''}" onclick="ProfileMenu.setDateFmt('MM/DD/YYYY',this)">MM/DD/YYYY</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Company Reference -->
      <div>
        <div class="hub-expand-header" onclick="ProfileMenu.toggleSection('company')">
          <svg class="hub-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span class="hub-action-label" style="font-weight:500;">Company Reference</span>
          <svg class="chevron-toggle" id="chevron-company" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="hub-expand-body" id="section-company">
          <div class="hub-info-row"><span class="hub-info-label">Company</span><span class="hub-info-value">شركة الطرق الملهمة للخدمات اللوجستية</span></div>
          <div class="hub-info-row"><span class="hub-info-label">CR</span><span class="hub-info-value">1009018728</span></div>
          <div class="hub-info-row"><span class="hub-info-label">VAT</span><span class="hub-info-value">312183353900003</span></div>
          <div class="hub-info-row"><span class="hub-info-label">National ID</span><span class="hub-info-value">7038922436</span></div>
          <div class="hub-info-row"><span class="hub-info-label">Email</span><span class="hub-info-value">Inspiringroadslogistics@gmail.com</span></div>
          <div class="hub-info-row"><span class="hub-info-label">Sponsors</span><span class="hub-info-value">Firas, Saad</span></div>
        </div>
      </div>

      <!-- Footer -->
      <div class="hub-footer" id="hub-footer">IRL v2.0.0 Pro · ${Utils.escapeHtml(supervisorName)} · © 2026</div>
    `;

    // Make sure modal content scrollbar is applied
    if (!document.getElementById('hub-modal-styles')) {
       const style = document.createElement('style');
       style.id = 'hub-modal-styles';
       style.innerHTML = `
         .modal-content { max-height: 85vh; overflow-y: auto; }
         .modal-content::-webkit-scrollbar { width: 4px; }
         .modal-content::-webkit-scrollbar-track { background: #E5E7EB; border-radius: 99px; }
         .modal-content::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
       `;
       document.head.appendChild(style);
    }

    Utils.openModal(
      '<div style="font-size:18px;font-weight:bold;color:#0F0F0F;">Control Hub</div><div style="font-size:13px;color:#6B7280;font-weight:normal;margin-top:2px;">System management & app settings</div>',
      html
    );

    setTimeout(() => this.initPhotoUpload(), 100);
  },

  editField(field) {
    document.getElementById(`hub-${field}-val`).style.display = 'none';
    document.getElementById(`hub-${field}-edit-icon`).style.display = 'none';
    const input = document.getElementById(`hub-${field}-input`);
    input.style.display = 'block';
    input.focus();
  },

  async saveField(field) {
    const input = document.getElementById(`hub-${field}-input`);
    const val = input.value.trim();
    if (!val) {
       input.value = field === 'name' ? window.supervisorName : window.supervisorTitle;
    }
    
    document.getElementById(`hub-${field}-val`).innerText = input.value;
    document.getElementById(`hub-${field}-val`).style.display = 'block';
    document.getElementById(`hub-${field}-edit-icon`).style.display = 'block';
    input.style.display = 'none';
    
    const newVal = input.value;
    if (field === 'name') window.supervisorName = newVal;
    if (field === 'title') window.supervisorTitle = newVal;
    
    // Save to firebase via new profile API
    try {
      await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: window.supervisorName, title: window.supervisorTitle })
      });
    } catch(e) { console.warn(e); }
    
    // Update local storage fallback
    localStorage.setItem(`irl_supervisor_${field}`, newVal);
    
    // Update Sidebar
    if (field === 'name') {
      const firstName = newVal.split(' ')[0];
      const sidebarName = document.getElementById('sidebar-name');
      if (sidebarName) sidebarName.innerText = firstName;
      document.getElementById('hub-footer').innerText = `IRL v2.0.0 Pro · ${newVal} · © 2026`;
    }
    if (field === 'title') {
      const sidebarTitle = document.getElementById('sidebar-title');
      if (sidebarTitle) sidebarTitle.innerText = `${newVal} · IRL`;
    }
  },

  // ── Photo Upload & Crop ──
  initPhotoUpload() {
    const input = document.getElementById('hub-photo-input');
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this.openCropUI(file);
    });
  },
  
  openCropUI(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('hub-identity-card').style.display = 'none';
      document.getElementById('hub-crop-container').style.display = 'block';
      
      const img = document.getElementById('crop-img');
      img.src = ev.target.result;
      img.onload = () => {
         this._cropImg = img;
         this._cropScale = 1;
         this._cropX = 0;
         this._cropY = 0;
         
         // Initial fit
         const boxSize = 240;
         const aspect = img.naturalWidth / img.naturalHeight;
         if (aspect > 1) {
            img.style.height = boxSize + 'px';
            img.style.width = 'auto';
         } else {
            img.style.width = boxSize + 'px';
            img.style.height = 'auto';
         }
         
         this.updateCropTransform();
         this.initCropDrag();
      };
    };
    reader.readAsDataURL(file);
  },
  
  updateCropTransform() {
    if (!this._cropImg) return;
    this._cropImg.style.transform = `translate(${this._cropX}px, ${this._cropY}px) scale(${this._cropScale})`;
  },
  
  cropZoom(delta) {
    this._cropScale = Math.max(0.5, this._cropScale + delta);
    this.updateCropTransform();
  },
  
  initCropDrag() {
    const box = document.getElementById('crop-preview-box');
    let isDragging = false;
    let startX, startY, initX, initY;
    
    box.onmousedown = (e) => {
       isDragging = true;
       startX = e.clientX;
       startY = e.clientY;
       initX = this._cropX;
       initY = this._cropY;
    };
    window.onmousemove = (e) => {
       if (!isDragging) return;
       const dx = e.clientX - startX;
       const dy = e.clientY - startY;
       this._cropX = initX + dx;
       this._cropY = initY + dy;
       this.updateCropTransform();
    };
    window.onmouseup = () => { isDragging = false; };
  },
  
  cancelCrop() {
    document.getElementById('hub-crop-container').style.display = 'none';
    document.getElementById('hub-identity-card').style.display = 'flex';
    document.getElementById('hub-photo-input').value = '';
  },
  
  applyCrop() {
    const boxSize = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = boxSize;
    canvas.height = boxSize;
    const ctx = canvas.getContext('2d');
    
    // Enable ultra-high quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, boxSize, boxSize);
    
    const img = this._cropImg;
    const rect = img.getBoundingClientRect();
    const boxRect = document.getElementById('crop-preview-box').getBoundingClientRect();
    
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const cropX = (boxRect.left - rect.left) * scaleX;
    const cropY = (boxRect.top - rect.top) * scaleY;
    const cropW = boxRect.width * scaleX;
    const cropH = boxRect.height * scaleY;
    
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, boxSize, boxSize);
    
    document.getElementById('hub-crop-container').style.display = 'none';
    document.getElementById('hub-identity-card').style.display = 'flex';
    
    const statusEl = document.getElementById('hub-upload-status');
    statusEl.style.display = 'block';
    
    let pct = 0;
    statusEl.innerText = `Uploading Ultra-HD... ${pct}%`;
    const interval = setInterval(() => {
      pct += Math.floor(Math.random() * 20) + 10;
      if (pct > 95) pct = 95;
      statusEl.innerText = `Uploading Ultra-HD... ${pct}%`;
    }, 200);
    
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onloadend = () => {
         this.uploadToFirebase(reader.result, interval);
      };
      reader.readAsDataURL(blob);
    }, 'image/png'); // Lossless Ultra-HD
  },

  async uploadToFirebase(dataUrl, progressInterval) {
    try {
      await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: window.supervisorName, 
          title: window.supervisorTitle,
          photo_url: dataUrl 
        })
      });

      clearInterval(progressInterval);
      document.getElementById('hub-upload-status').style.display = 'none';

      localStorage.setItem('irl_supervisor_photo', dataUrl);
      window.supervisorPhotoUrl = dataUrl;

      const avatarContent = document.getElementById('hub-avatar-img');
      if (avatarContent) {
        if(avatarContent.tagName === 'SPAN') {
           avatarContent.outerHTML = `<img id="hub-avatar-img" src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
           avatarContent.src = dataUrl;
        }
      }

      const sidebarAvatar = document.getElementById('sidebar-avatar');
      if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${dataUrl}">`;
      }

      Utils.showToast('Profile photo updated for Admin & Rider Portal', 'success');
    } catch (err) {
      clearInterval(progressInterval);
      document.getElementById('hub-upload-status').style.display = 'none';
      
      localStorage.setItem('irl_supervisor_photo', dataUrl);
      window.supervisorPhotoUrl = dataUrl;

      const avatarContent = document.getElementById('hub-avatar-img');
      if (avatarContent) {
        if(avatarContent.tagName === 'SPAN') {
           avatarContent.outerHTML = `<img id="hub-avatar-img" src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
           avatarContent.src = dataUrl;
        }
      }
      
      const sidebarAvatar = document.getElementById('sidebar-avatar');
      if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${dataUrl}">`;
      }

      Utils.showToast('Profile photo saved locally', 'success');
    }
  },

  // ── Section Toggles ──
  toggleSection(id) {
    const body = document.getElementById('section-' + id);
    const chevron = document.getElementById('chevron-' + id);
    if (body && chevron) {
      body.classList.toggle('open');
      chevron.classList.toggle('open');
    }
  },

  // ── System Actions ──
  backupNow() {
    Utils.closeModal();
    API.downloadBackup();
    Utils.showToast('Database backup started', 'success');
  },

  exportCycle() {
    Utils.closeModal();
    document.querySelector('[data-page="reports-center"]')?.click();
  },

  async logout() {
    Utils.closeModal();
    Utils.showLoading('Logging out', 'Clearing session...');
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        localStorage.removeItem('irl_supervisor_name');
        localStorage.removeItem('irl_supervisor_title');
        localStorage.removeItem('irl_supervisor_photo');
        window.location.href = '/login.html';
      } else {
        Utils.hideLoading();
        Utils.showToast('Logout failed', 'error');
      }
    } catch (err) {
      Utils.hideLoading();
      Utils.showToast(err.message || 'Error logging out', 'error');
    }
  },

  // ── Preferences ──
  setLang(lang, btn) {
    localStorage.setItem('irl_lang', lang);
    const parent = btn.parentElement;
    parent.querySelectorAll('.hub-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Utils.showToast('Language set to ' + (lang === 'en' ? 'English' : lang === 'ar' ? 'العربية' : 'اردو'), 'success');
  },

  setDateFmt(fmt, btn) {
    localStorage.setItem('irl_date_format', fmt);
    const parent = btn.parentElement;
    parent.querySelectorAll('.hub-seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Utils.showToast('Date format set to ' + fmt, 'success');
  },

  // ── Init: load saved settings into sidebar on page load ──
  async init() {
    let admin = { name: 'Abdullah Khan', title: 'Manager', photo_url: '' };
    try {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session && session.user) {
        const emailKey = session.user.email.replace(/\./g, '_dot_');
        const pRes = await fetch('/api/admin/profiles');
        const allProfiles = await pRes.json();
        const profile = allProfiles[emailKey] || {};
        
        admin = {
          name: profile.name || session.user.name,
          title: profile.title || 'Administrator',
          photo_url: profile.photo_url || ''
        };
      }
    } catch(e) {}
    
    const supervisorName = admin.name;
    const supervisorTitle = admin.title;
    const photoUrl = admin.photo_url;
    
    window.supervisorName = supervisorName;
    window.supervisorTitle = supervisorTitle;
    
    if (photoUrl) {
      window.supervisorPhotoUrl = photoUrl;
      const sidebarAvatar = document.getElementById('sidebar-avatar');
      if (sidebarAvatar) {
        sidebarAvatar.innerHTML = `<img src="${photoUrl}">`;
      }
    } else {
       const sidebarAvatar = document.getElementById('sidebar-avatar');
       if (sidebarAvatar) sidebarAvatar.innerText = Utils.getInitials(supervisorName);
    }
    
    const firstName = supervisorName.split(' ')[0];
    const sidebarName = document.getElementById('sidebar-name');
    if (sidebarName) sidebarName.innerText = firstName;
    
    const sidebarTitleEl = document.getElementById('sidebar-title');
    if (sidebarTitleEl) sidebarTitleEl.innerText = `${supervisorTitle} · IRL`;
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => ProfileMenu.init());
