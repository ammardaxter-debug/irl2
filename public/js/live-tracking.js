// ========================================
//  LIVE TRACKING DASHBOARD (PREMIUM V2)
//  High-fidelity fleet monitoring for IRL Express
// ========================================

const LiveTracking = {
    _map: null,
    _riderMarkers: {},
    _refreshInterval: null,
    _lastCenter: [24.7136, 46.6753],

    zones: [
        { id: "laban", name: "Laban", color: "#3B82F6", coords: [[24.6890, 46.5340], [24.7150, 46.5520]] },
        { id: "irqah", name: "Irqah", color: "#22C55E", coords: [[24.6890, 46.5520], [24.7150, 46.5700]] }
    ],

    async render() {
        const container = document.getElementById('page-live-tracking');
        container.innerHTML = `
            <div class="tracking-container" style="display:flex; flex-direction:column; height: calc(100vh - 120px); gap: 20px; font-family: 'Inter', sans-serif;">
                
                <!-- Header & Stats Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; background:white; padding:20px; border-radius:16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border:1px solid #f1f5f9;">
                    <div>
                        <h1 style="font-size:24px; font-weight:800; color:#0f172a; margin:0;">🛰️ Fleet Command Center</h1>
                        <p style="font-size:14px; color:#64748b; margin:4px 0 0 0;">Real-time intelligence • Riyadh Operations</p>
                    </div>
                    <div style="display:flex; gap:24px;">
                        <div class="stat-group">
                            <span style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Online</span>
                            <div id="online-count" style="font-size:24px; font-weight:800; color:#22c55e;">0</div>
                        </div>
                        <div style="width:1px; background:#e2e8f0;"></div>
                        <div class="stat-group">
                            <span style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Idle</span>
                            <div id="offline-count" style="font-size:24px; font-weight:800; color:#64748b;">0</div>
                        </div>
                        <div style="width:1px; background:#e2e8f0;"></div>
                        <div class="stat-group">
                            <span style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">Total</span>
                            <div id="total-count" style="font-size:24px; font-weight:800; color:#2563eb;">0</div>
                        </div>
                        <div id="sync-status" style="display:flex; align-items:center; gap:8px; background:#f0fdf4; padding:8px 16px; border-radius:12px; border:1px solid #bbf7d0; margin-left:10px;">
                            <div style="width:6px; height:6px; background:#22c55e; border-radius:50%; animation: pulse 2s infinite;"></div>
                            <span id="sync-text" style="font-size:12px; font-weight:700; color:#16a34a;">SYNCING</span>
                        </div>
                    </div>
                </div>

                <!-- Main Workspace -->
                <div style="display:grid; grid-template-columns: 1fr 380px; gap:20px; flex:1; min-height:0;">
                    
                    <!-- Premium Map Container -->
                    <div style="background:white; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0; position:relative; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        <div id="tracking-map" style="height:100%; width:100%; background:#f8fafc;"></div>
                        <div style="position:absolute; bottom:20px; left:20px; z-index:1000; background:rgba(255,255,255,0.9); padding:12px; border-radius:12px; backdrop-filter:blur(8px); border:1px solid #e2e8f0; font-size:12px; color:#475569;">
                            <b>Legend:</b> <span style="color:#22c55e;">● Active</span> | <span style="color:#94a3b8;">● Offline</span>
                        </div>
                    </div>

                    <!-- Rider Console -->
                    <div style="background:white; border-radius:20px; border:1px solid #e2e8f0; overflow:hidden; display:flex; flex-direction:column; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                        <div style="padding:20px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; font-size:16px; font-weight:800; color:#0f172a;">Rider Fleet</h3>
                            <button onclick="LiveTracking.recenter()" style="background:#f1f5f9; border:none; padding:6px 12px; border-radius:8px; font-size:11px; font-weight:700; color:#475569; cursor:pointer;">Recenter All</button>
                        </div>
                        <div id="rider-list" style="flex:1; overflow-y:auto; padding:15px; background:#fbfcfe;">
                            <div style="text-align:center; padding:40px; color:#94a3b8;">
                                <div style="font-size:40px; margin-bottom:10px;">📡</div>
                                <div>Scanning fleet...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
                .rider-item { cursor:pointer; transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid transparent; }
                .rider-item:hover { transform: translateY(-2px); border-color: #2563eb; background:white !important; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
                .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
                .leaflet-popup-content { margin: 0; }
                .custom-marker { transition: all 0.5s ease-in-out; }
            </style>
        `;

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
        this._map = L.map('tracking-map', { zoomControl: false }).setView(this._lastCenter, 12);
        L.control.zoom({ position: 'topleft' }).addTo(this._map);
        
        // CartoDB Voyager tiles (Premium clean look)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CartoDB',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this._map);
    },

    async startSync() {
        if (this._refreshInterval) clearInterval(this._refreshInterval);
        this.fetchFleet(true); // Initial center
        this._refreshInterval = setInterval(() => this.fetchFleet(false), 5000);
    },

    async fetchFleet(shouldCenter) {
        try {
            const res = await fetch('/api/admin/fleet-locations');
            const riders = await res.json();
            
            this.updateMapMarkers(riders);
            this.updateRiderList(riders);
            this.updateStats(riders);
            
            if (shouldCenter && riders.some(r => r.isOnline && r.lat)) {
                this.recenter();
            }

            document.getElementById('sync-text').textContent = 'LIVE: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            console.error('Fleet sync error:', e);
            document.getElementById('sync-text').textContent = 'OFFLINE';
            document.getElementById('sync-status').style.background = '#fef2f2';
            document.getElementById('sync-status').style.borderColor = '#fecaca';
        }
    },

    updateMapMarkers(riders) {
        riders.forEach(r => {
            if (!r.lat || !r.lng) return;
            
            const isOnline = r.isOnline === true;
            const popupContent = this.getPopupHtml(r, isOnline);
            
            if (this._riderMarkers[r.id]) {
                this._riderMarkers[r.id].setLatLng([r.lat, r.lng]);
                
                // Update popup content live
                this._riderMarkers[r.id].setPopupContent(popupContent);
                
                // Update icon if status changed (detecting by color in HTML)
                const currentHtml = this._riderMarkers[r.id].options.icon.options.html;
                const targetColor = isOnline ? '#2563eb' : '#64748b';
                if (!currentHtml.includes(targetColor)) {
                    this._riderMarkers[r.id].setIcon(this.createIcon(isOnline));
                }
            } else {
                const marker = L.marker([r.lat, r.lng], { 
                    icon: this.createIcon(isOnline) 
                }).addTo(this._map);
                
                marker.bindPopup(popupContent);
                this._riderMarkers[r.id] = marker;
            }
        });
    },

    getPopupHtml(r, isOnline) {
        return `
            <div style="padding:15px; min-width:200px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                    <div style="width:40px; height:40px; background:#f8fafc; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px;">👤</div>
                    <div>
                        <div style="font-weight:800; color:#0f172a; font-size:14px;">${r.name}</div>
                        <div style="font-size:11px; color:${isOnline ? '#16a34a' : '#64748b'}; font-weight:700;">${isOnline ? '● ONLINE' : '● OFFLINE'}</div>
                    </div>
                </div>
                <div style="background:#f1f5f9; padding:8px; border-radius:8px; font-size:12px; color:#475569;">
                    <div>📍 ${r.status || 'Active'}</div>
                    <div>🕒 Last Update: ${r.lastUpdate ? new Date(r.lastUpdate).toLocaleTimeString() : 'N/A'}</div>
                </div>
            </div>
        `;
    },

    createIcon(isOnline) {
        const color = isOnline ? '#2563eb' : '#64748b';
        const shadow = isOnline ? 'rgba(37, 99, 235, 0.4)' : 'transparent';
        const pulse = isOnline ? `
            <div style="position:absolute; width:100%; height:100%; border-radius:12px; background:${color}; opacity:0.3; animation: rider-pulse 2s infinite;"></div>
        ` : '';

        return L.divIcon({
            html: `
                <div style="position:relative; width:42px; height:42px; display:flex; align-items:center; justify-content:center;">
                    ${pulse}
                    <div class="custom-marker" style="width:34px; height:34px; background:white; border:2.5px solid ${color}; border-radius:10px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 16px -4px rgba(0,0,0,0.2); position:relative; z-index:2;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/>
                        </svg>
                    </div>
                    <style>
                        @keyframes rider-pulse {
                            0% { transform: scale(0.8); opacity: 0.5; }
                            100% { transform: scale(1.6); opacity: 0; }
                        }
                    </style>
                </div>
            `,
            className: '', iconSize: [42, 42], iconAnchor: [21, 21]
        });
    },

    updateRiderList(riders) {
        const list = document.getElementById('rider-list');
        list.innerHTML = riders.map(r => {
            const hasLocation = r.lat && r.lng;
            return `
            <div class="rider-item" onclick="LiveTracking.focusRider(${r.lat || 'null'}, ${r.lng || 'null'}, '${r.id}')" style="padding:15px; border-radius:16px; margin-bottom:10px; background:white; border:1px solid #eef2f6; display:flex; align-items:center; gap:12px; opacity: ${hasLocation ? '1' : '0.7'};">
                <div style="width:44px; height:44px; background:${r.isOnline ? '#f0fdf4' : '#f8fafc'}; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:20px; border:1px solid ${r.isOnline ? '#bbf7d0' : '#e2e8f0'};">
                    ${r.isOnline ? '🚴' : '💤'}
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:800; font-size:14px; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</div>
                    <div style="font-size:12px; color:#64748b;">${r.isOnline ? '<span style="color:#22c55e; font-weight:700;">Active Now</span>' : 'Inactive'}</div>
                </div>
                <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                    <button style="background:${hasLocation ? '#2563eb' : '#cbd5e1'}; color:white; border:none; width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:${hasLocation ? 'pointer' : 'not-allowed'};" title="Track Rider">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8;">${r.lastUpdate ? new Date(r.lastUpdate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</div>
                </div>
            </div>
        `}).join('') || '<div style="text-align:center; padding:40px; color:#94a3b8;">No riders registered</div>';
    },

    updateStats(riders) {
        document.getElementById('online-count').textContent = riders.filter(r => r.isOnline).length;
        document.getElementById('offline-count').textContent = riders.filter(r => !r.isOnline).length;
        document.getElementById('total-count').textContent = riders.length;
    },

    focusRider(lat, lng, id) {
        if (!lat || !lng) {
            alert('Waiting for this rider to sync their GPS...');
            return;
        }
        this._map.flyTo([lat, lng], 18, { 
            duration: 1.5,
            easeLinearity: 0.25 
        });
        
        // Wait for flyTo to finish or just open popup immediately
        if (this._riderMarkers[id]) {
            setTimeout(() => {
                this._riderMarkers[id].openPopup();
            }, 500);
        }
    },

    recenter() {
        const markers = Object.values(this._riderMarkers);
        if (markers.length === 0) return;
        const group = new L.featureGroup(markers);
        this._map.fitBounds(group.getBounds().pad(0.1));
    },

    refresh() {
        this._riderMarkers = {};
        this.render();
    }
};
