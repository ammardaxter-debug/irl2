// ========================================
//  LIVE TRACKING PAGE
//  Connects to IRL Driver Firebase
//  Shows live driver locations on Riyadh map
// ========================================

const LiveTracking = {
    _initialized: false,
    _map: null,
    _driverMarkers: {},
    _zonePolygons: [],
    _firebaseApp: null,
    _database: null,
    _unsubscribe: null,

    // IRL Driver Firebase Config
    firebaseConfig: {
        apiKey: "AIzaSyBl4zzGlLzvzFoPBZr8eOkv-rzGDc4mVZo",
        authDomain: "irl-driver.firebaseapp.com",
        databaseURL: "https://irl-driver-default-rtdb.firebaseio.com",
        projectId: "irl-driver",
        storageBucket: "irl-driver.firebasestorage.app",
        messagingSenderId: "546080968890",
        appId: "1:546008968890:web:e74d367ea040e3e59f3283"
    },

    // 6 Riyadh Delivery Zones
    zones: [
        {
            id: "dhahrat_laban",
            name: "Dhahrat Laban",
            color: "#3B82F6",
            coords: [
                [24.6890, 46.5340],
                [24.6890, 46.5520],
                [24.7020, 46.5520],
                [24.7020, 46.5340]
            ]
        },
        {
            id: "irqah_2",
            name: "Irqah 2",
            color: "#22C55E",
            coords: [
                [24.6890, 46.5520],
                [24.6890, 46.5700],
                [24.7020, 46.5700],
                [24.7020, 46.5520]
            ]
        },
        {
            id: "mahdiya",
            name: "Mahdiya",
            color: "#F97316",
            coords: [
                [24.7020, 46.5340],
                [24.7020, 46.5520],
                [24.7150, 46.5520],
                [24.7150, 46.5340]
            ]
        },
        {
            id: "muhammadiyah",
            name: "Muhammadiyah",
            color: "#A855F7",
            coords: [
                [24.7020, 46.5520],
                [24.7020, 46.5700],
                [24.7150, 46.5700],
                [24.7150, 46.5520]
            ]
        },
        {
            id: "laban_2",
            name: "Laban 2",
            color: "#EF4444",
            coords: [
                [24.6890, 46.5150],
                [24.6890, 46.5340],
                [24.7020, 46.5340],
                [24.7020, 46.5150]
            ]
        },
        {
            id: "laban_3",
            name: "Laban 3",
            color: "#EAB308",
            coords: [
                [24.7020, 46.5150],
                [24.7020, 46.5340],
                [24.7150, 46.5340],
                [24.7150, 46.5150]
            ]
        }
    ],

    async render() {
        const container = document.getElementById('page-live-tracking');
        container.innerHTML = `
            <div class="page-header" style="margin-bottom:20px;">
                <div>
                    <h1 class="page-title">📍 Live Tracking</h1>
                    <p class="page-subtitle">Real-time driver locations • Riyadh Operations</p>
                </div>
                <div style="display:flex;gap:12px;align-items:center;">
                    <div id="tracking-status" style="
                        display:flex;align-items:center;gap:8px;
                        background:#f0fdf4;border:1px solid #bbf7d0;
                        padding:8px 16px;border-radius:20px;">
                        <div style="width:8px;height:8px;background:#22c55e;
                            border-radius:50%;animation:pulse 2s infinite;"></div>
                        <span style="font-size:13px;font-weight:600;color:#16a34a;">LIVE</span>
                    </div>
                    <button onclick="LiveTracking.refresh()" style="
                        background:#2563eb;color:white;border:none;
                        padding:8px 16px;border-radius:8px;cursor:pointer;
                        font-size:13px;font-weight:600;">
                        🔄 Refresh
                    </button>
                </div>
            </div>

            <!-- Stats Row -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px;">
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                        letter-spacing:1px;margin-bottom:8px;">ONLINE</div>
                    <div id="online-count" style="font-size:32px;font-weight:800;color:#22c55e;">0</div>
                </div>
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                        letter-spacing:1px;margin-bottom:8px;">OFFLINE</div>
                    <div id="offline-count" style="font-size:32px;font-weight:800;color:#ef4444;">0</div>
                </div>
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                        letter-spacing:1px;margin-bottom:8px;">OUT OF ZONE</div>
                    <div id="outzone-count" style="font-size:32px;font-weight:800;color:#f97316;">0</div>
                </div>
                <div class="stat-card" style="background:white;padding:16px;border-radius:12px;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;
                        letter-spacing:1px;margin-bottom:8px;">TOTAL DRIVERS</div>
                    <div id="total-count" style="font-size:32px;font-weight:800;color:#2563eb;">0</div>
                </div>
            </div>

            <!-- Map + Driver List -->
            <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;">

                <!-- Map -->
                <div style="background:white;border-radius:16px;overflow:hidden;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="padding:16px;border-bottom:1px solid #f1f5f9;
                        display:flex;align-items:center;justify-content:space-between;">
                        <div style="font-weight:700;color:#0f172a;font-size:15px;">
                            🗺️ Riyadh Live Map
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            ${this.zones.map(z => `
                                <div style="display:flex;align-items:center;gap:4px;">
                                    <div style="width:10px;height:10px;background:${z.color};
                                        border-radius:2px;opacity:0.7;"></div>
                                    <span style="font-size:11px;color:#64748b;">${z.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div id="tracking-map" style="height:500px;width:100%;"></div>
                </div>

                <!-- Driver List -->
                <div style="background:white;border-radius:16px;
                    border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05);
                    overflow:hidden;">
                    <div style="padding:16px;border-bottom:1px solid #f1f5f9;">
                        <div style="font-weight:700;color:#0f172a;font-size:15px;">
                            👥 Drivers
                        </div>
                    </div>
                    <div id="driver-list" style="overflow-y:auto;max-height:500px;padding:8px;">
                        <div style="text-align:center;padding:40px;color:#94a3b8;">
                            <div style="font-size:32px;margin-bottom:8px;">📡</div>
                            <div>Connecting to Firebase...</div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
                .driver-card:hover { background: #f8fafc !important; }
                .driver-marker-online {
                    background: #22c55e;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
                .driver-marker-offline {
                    background: #94a3b8;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
            </style>
        `;

        // Load Leaflet map
        await this.loadLeaflet();
        this.initMap();
        this.drawZones();
        await this.connectFirebase();
        this.listenToDrivers();
        
        // Load driver names from Firestore (non-blocking, won't break RTDB)
        this.loadDriverProfiles();
    },

    async loadLeaflet() {
        if (window.L) return;
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    },

    initMap() {
        if (this._map) {
            this._map.remove();
            this._map = null;
        }
        this._map = L.map('tracking-map', {
            center: [24.7020, 46.5430],
            zoom: 13,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this._map);
    },

    drawZones() {
        this.zones.forEach(zone => {
            const polygon = L.polygon(zone.coords, {
                color: zone.color,
                fillColor: zone.color,
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '5,5'
            }).addTo(this._map);

            polygon.bindTooltip(zone.name, {
                permanent: true,
                direction: 'center',
                className: 'zone-label'
            });

            this._zonePolygons.push(polygon);
        });
    },

    async connectFirebase() {
        try {
            // Load Firebase SDK
            if (!window.firebaseIRL) {
                await this.loadScript(
                    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js'
                );
                await this.loadScript(
                    'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
                );
                await this.loadScript(
                    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js'
                );
                await this.loadScript(
                    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js'
                );
                window.firebaseIRL = firebase.initializeApp(
                    this.firebaseConfig, 'irl-tracking'
                );
            }
            this._database = window.firebaseIRL.database();
            try {
                this._firestore = window.firebaseIRL.firestore();
            } catch(e) {
                console.warn('Firestore init failed (non-critical):', e);
            }
        } catch (e) {
            console.error('Firebase connection error:', e);
        }
    },

    _driverProfiles: {},

    async loadDriverProfiles() {
        try {
            const snapshot = await this._firestore.collection('drivers').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                this._driverProfiles[doc.id] = {
                    name: data.fullName || data.name || data.displayName || 'Driver',
                    phone: data.phone || data.phoneNumber || '',
                    assignedZone: data.assignedZone || '',
                    rating: data.driverRating || ''
                };
            });
            console.log(`Loaded ${Object.keys(this._driverProfiles).length} driver profiles from Firestore`);
        } catch (e) {
            console.warn('Could not load Firestore profiles:', e);
        }
    },

    loadScript(src) {
        return new Promise((resolve) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve(); return;
            }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            document.head.appendChild(s);
        });
    },

    listenToDrivers() {
        if (!this._database) return;

        this._database.ref('drivers').on('value', (snapshot) => {
            const drivers = snapshot.val() || {};
            this.updateMap(drivers);
            this.updateDriverList(drivers);
            this.updateStats(drivers);
        });
    },

    updateMap(drivers) {
        Object.entries(drivers).forEach(([uid, driver]) => {
            if (!driver.latitude || !driver.longitude) return;

            const lat = driver.latitude;
            const lng = driver.longitude;
            const isOnline = (driver.status || '').toLowerCase() === 'online';
            const profile = this._driverProfiles[uid] || {};
            const name = profile.name || driver.fullName || driver.name || 'Driver';
            const zone = driver.currentZone || profile.assignedZone || 'Unknown';
            const speed = Math.round(driver.speed || 0);

            if (this._driverMarkers[uid]) {
                this._driverMarkers[uid].setLatLng([lat, lng]);
                this._driverMarkers[uid].setPopupContent(
                    this.buildPopup(name, zone, speed, isOnline)
                );
            } else {
                const icon = L.divIcon({
                    className: '',
                    html: `
                        <div style="
                            width:36px;height:36px;
                            background:${isOnline ? '#22c55e' : '#94a3b8'};
                            border:3px solid white;
                            border-radius:50%;
                            display:flex;align-items:center;justify-content:center;
                            box-shadow:0 2px 8px rgba(0,0,0,0.3);
                            font-size:16px;
                        ">🚴</div>
                    `,
                    iconSize: [36, 36],
                    iconAnchor: [18, 18]
                });

                const marker = L.marker([lat, lng], { icon })
                    .bindPopup(this.buildPopup(name, zone, speed, isOnline))
                    .addTo(this._map);

                this._driverMarkers[uid] = marker;
            }
        });
    },

    buildPopup(name, zone, speed, isOnline) {
        return `
            <div style="min-width:160px;font-family:sans-serif;">
                <div style="font-weight:700;font-size:14px;
                    margin-bottom:6px;">${name}</div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <div style="width:8px;height:8px;
                        background:${isOnline ? '#22c55e' : '#94a3b8'};
                        border-radius:50%;"></div>
                    <span style="font-size:12px;color:${isOnline ? '#16a34a' : '#94a3b8'};">
                        ${isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div style="font-size:12px;color:#64748b;">📍 ${zone}</div>
                <div style="font-size:12px;color:#64748b;">🚀 ${speed} km/h</div>
            </div>
        `;
    },

    updateDriverList(drivers) {
        const list = document.getElementById('driver-list');
        if (!list) return;

        const entries = Object.entries(drivers);
        if (entries.length === 0) {
            list.innerHTML = `
                <div style="text-align:center;padding:40px;color:#94a3b8;">
                    <div style="font-size:32px;margin-bottom:8px;">👥</div>
                    <div>No drivers found</div>
                </div>
            `;
            return;
        }

        list.innerHTML = entries.map(([uid, driver]) => {
            const isOnline = (driver.status || '').toLowerCase() === 'online';
            const profile = this._driverProfiles[uid] || {};
            const name = profile.name || driver.fullName || driver.name || 'Unknown Driver';
            const zone = driver.currentZone || profile.assignedZone || 'Unknown Zone';
            const isOutOfZone = driver.isOutOfZone === true;
            const speed = Math.round(driver.speed || 0);

            return `
                <div class="driver-card" onclick="LiveTracking.focusDriver('${uid}')"
                    style="
                        padding:12px;border-radius:10px;
                        margin-bottom:6px;cursor:pointer;
                        border:1px solid ${isOutOfZone ? '#fca5a5' : '#f1f5f9'};
                        background:${isOutOfZone ? '#fff5f5' : 'white'};
                        transition:all 0.2s;
                    ">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="
                            width:38px;height:38px;
                            background:${isOnline ? '#f0fdf4' : '#f8fafc'};
                            border-radius:50%;
                            display:flex;align-items:center;justify-content:center;
                            font-size:18px;flex-shrink:0;
                            border:2px solid ${isOnline ? '#bbf7d0' : '#e2e8f0'};
                        ">🚴</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:600;font-size:13px;
                                color:#0f172a;white-space:nowrap;
                                overflow:hidden;text-overflow:ellipsis;">
                                ${name}
                            </div>
                            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                                ${zone}
                            </div>
                        </div>
                        <div style="text-align:right;flex-shrink:0;">
                            <div style="
                                display:inline-flex;align-items:center;gap:4px;
                                background:${isOnline ? '#f0fdf4' : '#f8fafc'};
                                border:1px solid ${isOnline ? '#bbf7d0' : '#e2e8f0'};
                                padding:2px 8px;border-radius:20px;
                                font-size:10px;font-weight:700;
                                color:${isOnline ? '#16a34a' : '#94a3b8'};
                            ">
                                <div style="width:5px;height:5px;
                                    background:${isOnline ? '#22c55e' : '#cbd5e1'};
                                    border-radius:50%;"></div>
                                ${isOnline ? 'Online' : 'Offline'}
                            </div>
                            ${isOutOfZone ? `
                                <div style="font-size:10px;color:#ef4444;
                                    font-weight:600;margin-top:2px;">
                                    ⚠️ Out of Zone
                                </div>
                            ` : ''}
                            ${isOnline ? `
                                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">
                                    ${speed} km/h
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateStats(drivers) {
        const values = Object.values(drivers);
        const online = values.filter(d => (d.status || '').toLowerCase() === 'online').length;
        const offline = values.filter(d => (d.status || '').toLowerCase() !== 'online').length;
        const outOfZone = values.filter(d => d.isOutOfZone === true).length;
        const total = values.length;

        const setEl = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setEl('online-count', online);
        setEl('offline-count', offline);
        setEl('outzone-count', outOfZone);
        setEl('total-count', total);
    },

    focusDriver(uid) {
        const marker = this._driverMarkers[uid];
        if (marker) {
            this._map.flyTo(marker.getLatLng(), 16, { duration: 1 });
            marker.openPopup();
        }
    },

    refresh() {
        this._driverMarkers = {};
        this.render();
    }
};
