// ========================================
//  LIVE TRACKING DASHBOARD (PREMIUM V2)
//  High-fidelity fleet monitoring for IRL Express
// ========================================

const LiveTracking = {
    _map: null,
    _riderMarkers: {},
    _refreshInterval: null,
    _lastCenter: [24.7136, 46.6753],
    _searchTerm: '',
    _filterStatus: 'all',
    _lastRidersData: [],
    _zonesLayers: [],

    zones: [
        { id: "laban", name: "Laban", color: "#3b82f6", coords: [[24.6890, 46.5340], [24.7150, 46.5520]] },
        { id: "irqah", name: "Irqah", color: "#10b981", coords: [[24.6890, 46.5520], [24.7150, 46.5700]] }
    ],

    getGpsStatus(r, isOnline) {
        if (!isOnline) {
            return {
                text: 'OFFLINE',
                bg: '#f1f5f9',
                color: '#64748b',
                isStale: true
            };
        }
        if (!r.lat || !r.lng || !r.lastUpdate) {
            return {
                text: 'NO GPS SIGNAL',
                bg: '#fff7ed',
                color: '#c2410c',
                isStale: true
            };
        }
        
        const lastTime = new Date(r.lastUpdate).getTime();
        const now = Date.now();
        const diffMs = now - lastTime;
        const diffMins = diffMs / 60000;
        
        if (diffMins < 5) {
            return {
                text: 'GPS SYNCED',
                bg: '#ecfdf5',
                color: '#059669',
                isStale: false
            };
        } else if (diffMins < 30) {
            return {
                text: `STALE (${Math.round(diffMins)}m ago)`,
                bg: '#fff7ed',
                color: '#c2410c',
                isStale: true
            };
        } else if (diffMins < 1440) {
            const hours = Math.round(diffMins / 60);
            return {
                text: `SIGNAL LOST (${hours}h ago)`,
                bg: '#fef2f2',
                color: '#ef4444',
                isStale: true
            };
        } else {
            const days = Math.round(diffMins / 1440);
            return {
                text: `SIGNAL LOST (${days}d ago)`,
                bg: '#fef2f2',
                color: '#ef4444',
                isStale: true
            };
        }
    },

    async render() {
        const container = document.getElementById('page-live-tracking');
        container.innerHTML = `
            <div class="tracking-container" style="display:flex; flex-direction:column; height: calc(100vh - 120px); gap: 20px; font-family: 'Inter', sans-serif;">
                
                <!-- KPI Section -->
                <div style="display:grid; grid-template-columns: repeat(3, 1fr) 280px; gap:16px;">
                    
                    <!-- Card 1: Online -->
                    <div style="background:white; padding:16px 20px; border-radius:16px; border:1px solid #eef2f6; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);">
                        <div>
                            <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Active Now</span>
                            <div id="online-count" style="font-size:28px; font-weight:800; color:#10b981; margin-top:4px; line-height:1;">0</div>
                            <span style="font-size:11px; color:#10b981; font-weight:600; display:flex; align-items:center; gap:4px; margin-top:6px;">
                                <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block; animation: active-pulse 2s infinite;"></span>
                                Shift Active & GPS Synced
                            </span>
                        </div>
                        <div style="width:48px; height:48px; background:#ecfdf5; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#10b981;">🚴</div>
                    </div>

                    <!-- Card 2: Offline -->
                    <div style="background:white; padding:16px 20px; border-radius:16px; border:1px solid #eef2f6; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);">
                        <div>
                            <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Checked Out</span>
                            <div id="offline-count" style="font-size:28px; font-weight:800; color:#64748b; margin-top:4px; line-height:1;">0</div>
                            <span style="font-size:11px; color:#64748b; font-weight:600; display:flex; align-items:center; gap:4px; margin-top:6px;">
                                On Standby/Off-duty
                            </span>
                        </div>
                        <div style="width:48px; height:48px; background:#f8fafc; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#64748b;">💤</div>
                    </div>

                    <!-- Card 3: Total -->
                    <div style="background:white; padding:16px 20px; border-radius:16px; border:1px solid #eef2f6; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01);">
                        <div>
                            <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Rider Fleet</span>
                            <div id="total-count" style="font-size:28px; font-weight:800; color:var(--primary-600); margin-top:4px; line-height:1;">0</div>
                            <span style="font-size:11px; color:var(--primary-500); font-weight:600; display:flex; align-items:center; gap:4px; margin-top:6px;">
                                Total Registered Team
                            </span>
                        </div>
                        <div style="width:48px; height:48px; background:var(--primary-50); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:var(--primary-600);">👥</div>
                    </div>

                    <!-- Clock & Connection Status Card -->
                    <div style="background:white; padding:16px 20px; border-radius:16px; border:1px solid #eef2f6; display:flex; flex-direction:column; justify-content:center; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01); background:linear-gradient(135deg, #0f172a, #1e293b); color:white;">
                        <span style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:4px;">SYNC STATUS</span>
                        <div id="sync-text" style="font-size:18px; font-weight:800; font-family:'Courier New', monospace; letter-spacing:1px; color:#10b981;">LIVE: --:--:--</div>
                        <div id="sync-status" style="display:flex; align-items:center; gap:6px; margin-top:6px;">
                            <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block; animation: active-pulse 1.5s infinite;"></span>
                            <span style="font-size:10px; font-weight:800; color:#10b981; letter-spacing:0.05em;">SECURE DATA CHANNEL</span>
                        </div>
                    </div>

                </div>

                <!-- Main Workspace -->
                <div style="display:grid; grid-template-columns: 1fr 380px; gap:20px; flex:1; min-height:0;">
                    
                    <!-- Premium Map Container -->
                    <div style="background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; position:relative; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        <div id="tracking-map" style="height:100%; width:100%; background:#f8fafc;"></div>
                    </div>

                    <!-- Rider Console -->
                    <div style="background:white; border-radius:20px; border:1px solid #e2e8f0; overflow:hidden; display:flex; flex-direction:column; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        
                        <!-- Console Header with Search & Filter -->
                        <div style="padding:16px; border-bottom:1px solid #f1f5f9; display:flex; flex-direction:column; gap:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h3 style="margin:0; font-size:16px; font-weight:800; color:#0f172a;">Rider Fleet</h3>
                                <button onclick="LiveTracking.recenter()" style="background:var(--primary-50); border:none; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:700; color:var(--primary-600); cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='var(--primary-100)'" onmouseout="this.style.background='var(--primary-50)'">Recenter All</button>
                            </div>
                            
                            <!-- Real-time search box -->
                            <div style="position:relative;">
                                <input type="text" id="rider-search" placeholder="Search riders..." style="width:100%; padding:10px 12px 10px 36px; border-radius:10px; border:1px solid #cbd5e1; font-size:13px; outline:none; transition:all 0.2s;" onfocus="this.style.borderColor='var(--primary-500)'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'">
                                <svg style="position:absolute; left:12px; top:12px; color:#94a3b8;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            </div>
                            
                            <!-- Filter Tabs -->
                            <div style="display:flex; gap:6px; background:#f1f5f9; padding:4px; border-radius:8px;">
                                <button id="filter-btn-all" onclick="LiveTracking.setFilter('all')" style="flex:1; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s; background:white; color:#0f172a; box-shadow:0 1px 3px rgba(0,0,0,0.05);">All</button>
                                <button id="filter-btn-active" onclick="LiveTracking.setFilter('active')" style="flex:1; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b;">Active</button>
                                <button id="filter-btn-inactive" onclick="LiveTracking.setFilter('inactive')" style="flex:1; border:none; padding:6px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; transition:all 0.2s; background:transparent; color:#64748b;">Inactive</button>
                            </div>
                        </div>

                        <!-- Sidebar list container -->
                        <div id="rider-list" style="flex:1; overflow-y:auto; padding:15px; background:#fbfcfe; display:flex; flex-direction:column; gap:10px;">
                            <div style="text-align:center; padding:40px; color:#94a3b8;">
                                <div class="scanner-icon" style="font-size:40px; margin-bottom:10px;">📡</div>
                                <div>Scanning fleet channels...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .leaflet-control-attribution {
                    display: none !important;
                }
                @keyframes active-pulse { 
                    0% { transform: scale(0.85); opacity: 0.6; } 
                    50% { transform: scale(1.15); opacity: 0.9; } 
                    100% { transform: scale(0.85); opacity: 0.6; } 
                }
                .rider-card { 
                    cursor: pointer; 
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
                    border: 1px solid #eef2f6; 
                    background: white;
                    border-radius: 14px;
                    padding: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .rider-card:hover { 
                    transform: translateY(-2px); 
                    border-color: var(--primary-300); 
                    box-shadow: 0 8px 16px -4px rgba(59, 130, 246, 0.08); 
                }
                .rider-card.selected {
                    border-color: var(--primary-500);
                    background: #eff6ff;
                    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.05);
                }
                .leaflet-popup-content-wrapper { 
                    border-radius: 16px; 
                    padding: 0; 
                    overflow: hidden; 
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1) !important;
                }
                .leaflet-popup-content { margin: 0 !important; }
                .zone-tooltip {
                    background: rgba(15, 23, 42, 0.95) !important;
                    border: none !important;
                    border-radius: 6px !important;
                    color: white !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    padding: 4px 8px !important;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
                }
                .scanner-icon {
                    animation: scanning-pulse 2s infinite ease-in-out;
                }
                @keyframes scanning-pulse {
                    0% { opacity: 0.4; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0.4; transform: scale(0.9); }
                }
            </style>
        `;

        // Attach event listener to search input
        document.getElementById('rider-search').addEventListener('input', (e) => {
            this._searchTerm = e.target.value;
            this.updateRiderList(this._lastRidersData);
        });

        await this.loadLeaflet();
        this.initMap();
        this.startSync();
    },

    async loadLeaflet() {
        if (window.L) return;
        return new Promise(r => {
            const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(l);
            const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = r;
            document.head.appendChild(s);
        });
    },

    initMap() {
        if (this._map) this._map.remove();
        this._map = L.map('tracking-map', { zoomControl: false, attributionControl: false }).setView(this._lastCenter, 12);
        L.control.zoom({ position: 'topleft' }).addTo(this._map);
        
        // Premium Light Voyager tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CartoDB',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this._map);

    },

    async startSync() {
        this.stopSync();
        this.fetchFleet(true); // Initial center
        this._refreshInterval = setInterval(() => this.fetchFleet(false), 5000);
    },

    stopSync() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }
    },

    getZone(lat, lng) {
        for (const z of this.zones) {
            const [[lat1, lng1], [lat2, lng2]] = z.coords;
            const minLat = Math.min(lat1, lat2);
            const maxLat = Math.max(lat1, lat2);
            const minLng = Math.min(lng1, lng2);
            const maxLng = Math.max(lng1, lng2);
            if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
                return z;
            }
        }
        return null;
    },

    async fetchFleet(shouldCenter) {
        try {
            const res = await fetch('/api/admin/fleet-locations');
            const riders = await res.json();
            
            this._lastRidersData = riders;
            
            this.updateMapMarkers(riders);
            this.updateRiderList(riders);
            this.updateStats(riders);
            
            if (shouldCenter && riders.some(r => r.isOnline && r.lat)) {
                this.recenter();
            }

            document.getElementById('sync-text').textContent = 'LIVE: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const syncStatusEl = document.getElementById('sync-status');
            const syncTextEl = document.getElementById('sync-text');
            if (syncStatusEl) {
                syncStatusEl.innerHTML = `
                    <span style="width:6px; height:6px; background:#10b981; border-radius:50%; display:inline-block; animation: active-pulse 1.5s infinite;"></span>
                    <span style="font-size:10px; font-weight:800; color:#10b981; letter-spacing:0.05em;">SECURE DATA CHANNEL</span>
                `;
                syncTextEl.style.color = '#10b981';
            }
        } catch (e) {
            console.error('Fleet sync error:', e);
            const syncStatusEl = document.getElementById('sync-status');
            const syncTextEl = document.getElementById('sync-text');
            if (syncStatusEl) {
                syncStatusEl.innerHTML = `
                    <span style="width:6px; height:6px; background:#ef4444; border-radius:50%; display:inline-block;"></span>
                    <span style="font-size:10px; font-weight:800; color:#ef4444; letter-spacing:0.05em;">CHANNEL CONNECTION LOST</span>
                `;
                syncTextEl.textContent = 'OFFLINE';
                syncTextEl.style.color = '#ef4444';
            }
        }
    },

    updateMapMarkers(riders) {
        riders.forEach(r => {
            if (!r.lat || !r.lng) return;
            
            const isOnline = r.isOnline === true;
            const initials = r.name ? r.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
            const popupContent = this.getPopupHtml(r, isOnline);
            const gpsStatus = this.getGpsStatus(r, isOnline);
            const statusKey = `${isOnline}_${gpsStatus.text}_${r.photo}`;
            
            if (this._riderMarkers[r.id]) {
                this._riderMarkers[r.id].setLatLng([r.lat, r.lng]);
                this._riderMarkers[r.id].setPopupContent(popupContent);
                
                if (this._riderMarkers[r.id]._statusKey !== statusKey) {
                    this._riderMarkers[r.id].setIcon(this.createIcon(isOnline, initials, r.photo, gpsStatus));
                    this._riderMarkers[r.id]._statusKey = statusKey;
                }
            } else {
                const marker = L.marker([r.lat, r.lng], { 
                    icon: this.createIcon(isOnline, initials, r.photo, gpsStatus) 
                }).addTo(this._map);
                
                marker.bindPopup(popupContent);
                marker._statusKey = statusKey;
                this._riderMarkers[r.id] = marker;
            }
        });
    },

    getPopupHtml(r, isOnline) {
        const initials = r.name ? r.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
        const hasLocation = r.lat && r.lng;
        
        return `
            <div style="font-family:'Inter', sans-serif; min-width:240px; border-radius:12px; overflow:hidden; background:white;">
                <!-- Header -->
                <div style="display:flex; align-items:center; gap:12px; padding:12px; border-bottom:1px solid #f1f5f9; background:#f8fafc;">
                    <div style="width:40px; height:40px; background:#eff6ff; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #3b82f6; overflow:hidden; position:relative;">
                        ${r.photo ? `<img src="${r.photo}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='<span style=\\'font-weight:700; color:#2563eb; font-size:13px;\\'>${initials}</span>'" />` : `<span style="font-weight:700; color:#2563eb; font-size:13px;">${initials}</span>`}
                    </div>
                    <div>
                        <div style="font-weight:800; color:#0f172a; font-size:14px; line-height:1.2;">${r.name}</div>
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">ID: #${String(r.id).substring(0, 8)}</div>
                    </div>
                </div>
                
                <!-- Body -->
                <div style="padding:12px; display:flex; flex-direction:column; gap:10px;">
                    <!-- Badges -->
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <span style="font-size:10px; font-weight:800; padding:3px 8px; border-radius:20px; background:${isOnline ? '#ecfdf5' : '#f1f5f9'}; color:${isOnline ? '#059669' : '#64748b'}; letter-spacing:0.02em;">
                            ${isOnline ? '● ONLINE' : '● OFFLINE'}
                        </span>
                        <span style="font-size:10px; font-weight:800; padding:3px 8px; border-radius:20px; background:${this.getGpsStatus(r, isOnline).bg}; color:${this.getGpsStatus(r, isOnline).color}; letter-spacing:0.02em;">
                            📍 ${this.getGpsStatus(r, isOnline).text}
                        </span>
                    </div>

                    <!-- Details -->
                    <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:10px; border-radius:8px; font-size:12px; color:#475569; display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8; font-weight:600;">Status:</span> <span style="font-weight:700; color:#334155;">${r.status || 'Active Shift'}</span></div>
                        <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8; font-weight:600;">Last Synced:</span> <span style="font-weight:700; color:#334155;">${r.lastUpdate ? new Date(r.lastUpdate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'}) : 'N/A'}</span></div>
                        <div style="display:flex; justify-content:space-between;"><span style="color:#94a3b8; font-weight:600;">GPS Link:</span> <span style="font-family:monospace; color:#64748b; font-size:10px;">${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}</span></div>
                    </div>

                    <!-- WhatsApp CTA -->
                    ${r.phone ? `
                    <a href="https://wa.me/${r.phone.replace(/[^0-9]/g, '')}" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; background:#25d366; color:white; font-size:12px; font-weight:700; padding:10px; border-radius:8px; text-align:center; transition:all 0.2s; box-shadow: 0 2px 4px rgba(37,211,102,0.15);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 12.008 0c3.237.001 6.279 1.26 8.567 3.551 2.289 2.291 3.547 5.337 3.545 8.577-.005 6.678-5.33 12.001-12.007 12.001-1.996-.001-3.957-.492-5.7-1.423L0 24zm6.09-3.722c1.642.975 3.238 1.488 4.904 1.489 5.58 0 10.121-4.512 10.125-10.063.002-2.69-1.043-5.22-2.94-7.117C16.328 2.69 13.805 1.64 11.121 1.64 5.541 1.64 1 6.15 1 11.7.099 13.535.59 15.3 1.5 16.8l-.99 3.614 3.702-.97.16.096z"/></svg>
                        WhatsApp Rider
                    </a>
                    ` : ''}
                </div>
            </div>
        `;
    },

    createIcon(isOnline, initialText, photoUrl, gpsStatus = null) {
        let color = '#64748b';
        let border = '3px solid #cbd5e1';
        let glow = 'box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);';
        let pulseColor = '';

        if (isOnline) {
            if (gpsStatus && gpsStatus.isStale) {
                const statusColor = gpsStatus.color;
                color = statusColor;
                border = `3px solid ${statusColor}`;
                glow = `box-shadow: 0 0 12px ${statusColor}4d;`;
                pulseColor = statusColor;
            } else {
                color = '#10b981';
                border = '3px solid #10b981';
                glow = 'box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);';
                pulseColor = '#10b981';
            }
        }
        
        const innerContent = photoUrl 
            ? `<img src="${photoUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.outerHTML='<span style=\\'font-weight:800; font-size:12px; color:#334155;\\'>${initialText}</span>'" />` 
            : `<span style="font-weight:800; font-size:12px; color:#334155;">${initialText}</span>`;

        const pulseMarkup = (isOnline && pulseColor) 
            ? `<div style="position:absolute; width:44px; height:44px; border-radius:50%; background:${pulseColor}; opacity:0.25; animation: active-pulse 2s infinite; z-index:-1;"></div>`
            : '';

        return L.divIcon({
            html: `
                <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
                    ${pulseMarkup}
                    <div style="width:36px; height:36px; background:white; border:${border}; border-radius:50%; display:flex; align-items:center; justify-content:center; ${glow} position:relative; overflow:hidden; z-index:2;">
                         ${innerContent}
                    </div>
                    <div style="position:absolute; bottom:0px; left:18px; width:8px; height:8px; background:${isOnline ? '#10b981' : '#cbd5e1'}; transform:rotate(45deg); z-index:1;"></div>
                </div>
            `,
            className: '',
            iconSize: [44, 44],
            iconAnchor: [22, 40]
        });
    },

    setFilter(status) {
        this._filterStatus = status;
        
        // Update tab buttons style
        const tabs = ['all', 'active', 'inactive'];
        tabs.forEach(t => {
            const btn = document.getElementById(`filter-btn-${t}`);
            if (btn) {
                if (t === status) {
                    btn.style.background = 'white';
                    btn.style.color = '#0f172a';
                    btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                } else {
                    btn.style.background = 'transparent';
                    btn.style.color = '#64748b';
                    btn.style.boxShadow = 'none';
                }
            }
        });
        
        this.updateRiderList(this._lastRidersData);
    },

    updateRiderList(riders) {
        const list = document.getElementById('rider-list');
        if (!list) return;

        // Apply filters
        const q = (this._searchTerm || '').toLowerCase().trim();
        const filtered = riders.filter(r => {
            const matchesSearch = r.name.toLowerCase().includes(q);
            const matchesFilter = this._filterStatus === 'all' || 
                (this._filterStatus === 'active' && r.isOnline) || 
                (this._filterStatus === 'inactive' && !r.isOnline);
            return matchesSearch && matchesFilter;
        });

        if (filtered.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                    <div style="font-size:32px; margin-bottom:10px;">🔍</div>
                    <div style="font-weight:600; font-size:13px; color:#475569;">No matching riders</div>
                    <div style="font-size:11px; margin-top:2px; color:#94a3b8;">Try a different keyword or tab</div>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(r => {
            const hasLocation = r.lat && r.lng;
            const initials = r.name ? r.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '??';
            
            const gpsStatus = this.getGpsStatus(r, r.isOnline);
            const badgeText = gpsStatus.text;
            const badgeBg = gpsStatus.bg;
            const badgeColor = gpsStatus.color;

            const avatarMarkup = r.photo 
                ? `<img src="${r.photo}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='<span style=\\'font-weight:700; color:#2563eb; font-size:13px;\\'>${initials}</span>'" />` 
                : `<span style="font-weight:700; color:#2563eb; font-size:13px;">${initials}</span>`;

            let dotColor = '#94a3b8';
            let dotGlow = '';
            if (r.isOnline) {
                if (gpsStatus.isStale) {
                    dotColor = gpsStatus.color;
                    dotGlow = `box-shadow:0 0 4px ${gpsStatus.color}66;`;
                } else {
                    dotColor = '#10b981';
                    dotGlow = 'box-shadow:0 0 4px rgba(16,185,129,0.4);';
                }
            }

            const statusDot = `<span style="position:absolute; bottom:0; right:0; width:11px; height:11px; background:${dotColor}; border:2px solid white; border-radius:50%; ${dotGlow}"></span>`;

            return `
            <div class="rider-card" id="rider-card-${r.id}" onclick="LiveTracking.focusRider(${r.lat || 'null'}, ${r.lng || 'null'}, '${r.id}')">
                
                <!-- Avatar block -->
                <div style="position:relative; width:44px; height:44px; background:#eff6ff; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid ${r.isOnline ? '#10b981' : '#cbd5e1'}; overflow:hidden; flex-shrink:0;">
                    ${avatarMarkup}
                    ${statusDot}
                </div>
                
                <!-- Text Details -->
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:800; font-size:14px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</div>
                    
                    <!-- Sub-text Badge with Status -->
                    <div style="display:flex; align-items:center; gap:6px; margin-top:3px;">
                        <span style="font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; background:${badgeBg}; color:${badgeColor}; display:inline-flex; align-items:center; gap:3px;">
                            ${badgeText}
                        </span>
                    </div>
                </div>
                
                <!-- Action / Time Column -->
                <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <div style="display:flex; gap:4px;">
                        <!-- WhatsApp button -->
                        ${r.phone ? `
                        <a href="https://wa.me/${r.phone.replace(/[^0-9]/g, '')}" target="_blank" onclick="event.stopPropagation();" style="background:#25d366; color:white; border:none; width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;" title="WhatsApp Rider">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 12.008 0c3.237.001 6.279 1.26 8.567 3.551 2.289 2.291 3.547 5.337 3.545 8.577-.005 6.678-5.33 12.001-12.007 12.001-1.996-.001-3.957-.492-5.7-1.423L0 24zm6.09-3.722c1.642.975 3.238 1.488 4.904 1.489 5.58 0 10.121-4.512 10.125-10.063.002-2.69-1.043-5.22-2.94-7.117C16.328 2.69 13.805 1.64 11.121 1.64 5.541 1.64 1 6.15 1 11.7.099 13.535.59 15.3 1.5 16.8l-.99 3.614 3.702-.97.16.096z"/></svg>
                        </a>
                        ` : ''}

                        <!-- Track button -->
                        <button style="background:${hasLocation ? 'var(--primary-600)' : '#cbd5e1'}; color:white; border:none; width:26px; height:26px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:${hasLocation ? 'pointer' : 'not-allowed'};" title="Focus Location">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                    </div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8;">${r.lastUpdate ? new Date(r.lastUpdate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</div>
                </div>

            </div>
            `;
        }).join('');
    },

    updateStats(riders) {
        const activeCount = riders.filter(r => r.isOnline).length;
        const offlineCount = riders.filter(r => !r.isOnline).length;
        const totalCount = riders.length;

        const elOnline = document.getElementById('online-count');
        const elOffline = document.getElementById('offline-count');
        const elTotal = document.getElementById('total-count');

        if (elOnline) elOnline.textContent = activeCount;
        if (elOffline) elOffline.textContent = offlineCount;
        if (elTotal) elTotal.textContent = totalCount;
    },

    focusRider(lat, lng, id) {
        // Toggle selected active state on rider card in list
        document.querySelectorAll('.rider-card').forEach(el => el.classList.remove('selected'));
        const activeCard = document.getElementById(`rider-card-${id}`);
        if (activeCard) activeCard.classList.add('selected');

        if (!lat || !lng) {
            Utils.alert('Waiting for this rider to establish a GPS sync signal...', 'GPS Lock Required');
            return;
        }

        this._map.flyTo([lat, lng], 17, { 
            duration: 1.2,
            easeLinearity: 0.2 
        });
        
        if (this._riderMarkers[id]) {
            setTimeout(() => {
                this._riderMarkers[id].openPopup();
            }, 400);
        }
    },

    recenter() {
        const markers = Object.values(this._riderMarkers).filter(m => m.getLatLng());
        if (markers.length === 0) return;
        const group = new L.featureGroup(markers);
        this._map.fitBounds(group.getBounds().pad(0.12));
    },

    refresh() {
        this._riderMarkers = {};
        this.render();
    }
};
