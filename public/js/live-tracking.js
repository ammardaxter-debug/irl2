// ========================================
//  LIVE TRACKING PAGE (SUPABASE VERSION)
//  Shows live rider locations on Riyadh map
// ========================================

const LiveTracking = {
    _initialized: false,
    _map: null,
    _riderMarkers: {},
    _zonePolygons: [],
    _refreshInterval: null,

    // Riyadh Delivery Zones
    zones: [
        { id: "laban", name: "Laban", color: "#3B82F6", coords: [[24.6890, 46.5340], [24.6890, 46.5520], [24.7020, 46.5520], [24.7020, 46.5340]] },
        { id: "irqah", name: "Irqah", color: "#22C55E", coords: [[24.6890, 46.5520], [24.6890, 46.5700], [24.7020, 46.5700], [24.7020, 46.5520]] },
        { id: "mahdiya", name: "Mahdiya", color: "#F97316", coords: [[24.7020, 46.5340], [24.7020, 46.5520], [24.7150, 46.5520], [24.7150, 46.5340]] }
    ],

    async render() {
        const container = document.getElementById('page-live-tracking');
        container.innerHTML = `
            <div class="page-header" style="margin-bottom:20px;">
                <div>
                    <h1 class="page-title">📍 Live Fleet Tracking</h1>
                    <p class="page-subtitle">Real-time rider monitoring • 5s Sync</p>
                </div>
                <div id="tracking-status" style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;padding:8px 16px;border-radius:20px;">
                    <div style="width:8px;height:8px;background:#22c55e;border-radius:50%;animation:pulse 2s infinite;"></div>
                    <span id="sync-text" style="font-size:13px;font-weight:600;color:#16a34a;">SYNCING</span>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:700;">ONLINE RIDERS</div>
                    <div id="online-count" style="font-size:32px;font-weight:900;color:#22c55e;">0</div>
                </div>
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:700;">OFF DUTY</div>
                    <div id="offline-count" style="font-size:32px;font-weight:900;color:#94a3b8;">0</div>
                </div>
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;border:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:700;">TOTAL FLEET</div>
                    <div id="total-count" style="font-size:32px;font-weight:900;color:#2563eb;">0</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 350px;gap:16px;">
                <div style="background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                    <div id="tracking-map" style="height:600px;width:100%;"></div>
                </div>
                <div style="background:white;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;display:flex;flex-direction:column;">
                    <div style="padding:16px;border-bottom:1px solid #f1f5f9;font-weight:800;color:#0f172a;">👥 Rider List</div>
                    <div id="rider-list" style="flex:1;overflow-y:auto;padding:8px;"></div>
                </div>
            </div>

            <style>
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.1); } }
                .rider-card:hover { background: #f8fafc; border-color: #2563eb; }
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
        this._map = L.map('tracking-map').setView([24.7136, 46.6753], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this._map);
        this.zones.forEach(z => {
            L.polygon(z.coords, { color: z.color, fillOpacity: 0.1, weight: 1 }).addTo(this._map).bindTooltip(z.name);
        });
    },

    async startSync() {
        if (this._refreshInterval) clearInterval(this._refreshInterval);
        this.fetchFleet();
        this._refreshInterval = setInterval(() => this.fetchFleet(), 5000);
    },

    async fetchFleet() {
        try {
            const res = await fetch('/api/admin/fleet-locations');
            const riders = await res.json();
            this.updateMap(riders);
            this.updateRiderList(riders);
            this.updateStats(riders);
            document.getElementById('sync-text').textContent = 'SYNCED ' + new Date().toLocaleTimeString();
        } catch (e) {
            console.error('Fleet sync error:', e);
            document.getElementById('sync-text').textContent = 'SYNC ERROR';
        }
    },

    updateMap(riders) {
        riders.forEach(r => {
            if (!r.lat || !r.lng) return;
            const isOnline = r.isOnline === true;
            if (this._riderMarkers[r.id]) {
                this._riderMarkers[r.id].setLatLng([r.lat, r.lng]);
            } else {
                const icon = L.divIcon({
                    html: `<div style="width:30px;height:30px;background:${isOnline ? '#22c55e' : '#94a3b8'};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.2);">🚴</div>`,
                    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
                });
                this._riderMarkers[r.id] = L.marker([r.lat, r.lng], { icon }).addTo(this._map).bindPopup(`<b>${r.name}</b><br>${isOnline ? 'Online' : 'Offline'}`);
            }
        });
    },

    updateRiderList(riders) {
        const list = document.getElementById('rider-list');
        list.innerHTML = riders.map(r => `
            <div class="rider-card" onclick="LiveTracking.focusRider(${r.lat}, ${r.lng})" style="padding:12px;border-radius:12px;border:1px solid #f1f5f9;margin-bottom:8px;cursor:pointer;background:white;transition:all 0.2s;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:40px;height:40px;background:${r.isOnline ? '#f0fdf4' : '#f8fafc'};border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid ${r.isOnline ? '#bbf7d0' : '#e2e8f0'};">🚴</div>
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:14px;color:#0f172a;">${r.name}</div>
                        <div style="font-size:11px;color:#64748b;">${r.isOnline ? 'Active Now' : 'Last seen: ' + (r.lastUpdate ? new Date(r.lastUpdate).toLocaleTimeString() : 'N/A')}</div>
                    </div>
                    <div style="width:8px;height:8px;background:${r.isOnline ? '#22c55e' : '#cbd5e1'};border-radius:50%;"></div>
                </div>
            </div>
        `).join('');
    },

    updateStats(riders) {
        document.getElementById('online-count').textContent = riders.filter(r => r.isOnline).length;
        document.getElementById('offline-count').textContent = riders.filter(r => !r.isOnline).length;
        document.getElementById('total-count').textContent = riders.length;
    },

    focusRider(lat, lng) {
        this._map.flyTo([lat, lng], 15);
    },

    refresh() {
        this._riderMarkers = {};
        this.render();
    }
};
