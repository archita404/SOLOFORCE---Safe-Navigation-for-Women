/* ════════════════════════════════════════════════════════════
   SOLOFORCE v3 — app.js
   Loading screen · Dark/Light/Night themes · Responsive
   Real routing · AI Chat · Safe Walk · Reports · Analytics
════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────
   LOADING SCREEN
────────────────────────────────────────────── */
(function runLoader() {
  const steps = [
    { pct: 12, msg: 'Initialising safety systems…' },
    { pct: 28, msg: 'Loading map engine…' },
    { pct: 48, msg: 'Fetching safety data…' },
    { pct: 65, msg: 'Calibrating crime & lighting zones…' },
    { pct: 82, msg: 'Connecting AI companion…' },
    { pct: 100, msg: 'All systems ready. Stay safe 💜' },
  ];
  const bar    = document.getElementById('loaderBar');
  const status = document.getElementById('loaderStatus');
  const screen = document.getElementById('loaderScreen');
  if (!screen) return;
  let i = 0;
  const delays = [320, 480, 520, 540, 580, 700];
  function tick() {
    if (i >= steps.length) return;
    if (bar) bar.style.width = steps[i].pct + '%';
    if (status) status.textContent = steps[i].msg;
    i++;
    if (i < steps.length) setTimeout(tick, delays[i] || 500);
    else setTimeout(dismiss, 850);
  }
  setTimeout(tick, 300);
  function dismiss() {
    screen.classList.add('fade-out');
    setTimeout(() => { screen.style.display = 'none'; }, 750);
  }
})();


/* ──────────────────────────────────────────────
   STATE
────────────────────────────────────────────── */
let map;
let safetyData        = null;
let routeLayers       = [];
let safeZoneMarkers   = [];
let crimeCircles      = [];
let lightingCircles   = [];
let reportMarkers     = [];
let liveRouteLayers   = [];
let liveMarkers       = [];
let currentRouteData  = null;
let selectedRouteId   = null;
let isNightMode       = false;
let pinModeActive     = false;
let swTimer           = null;
let swSecondsLeft     = 0;
let swAlertTimer      = null;
let aiChatOpen        = false;
let selectedIncType   = 'harassment';
let currentTheme      = localStorage.getItem('sf_theme') || 'dark';
let trustedContact    = JSON.parse(localStorage.getItem('sf_trusted') || 'null');
let communityReports  = JSON.parse(localStorage.getItem('sf_reports') || '[]');

const layerState = { safeZones: true, crime: true, lighting: true, reports: true };

const INCIDENT_ICONS = { harassment:'😰', poor_lighting:'💡', theft:'👜', suspicious:'👁', unsafe_road:'🚧', other:'📝' };
const INCIDENT_LABELS = { harassment:'Harassment', poor_lighting:'Poor Lighting', theft:'Theft / Pickpocket', suspicious:'Suspicious Activity', unsafe_road:'Unsafe Road', other:'Other' };


/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(currentTheme, false);
  initMap();
  await loadData();

  // Desktop
  renderRouteCards();
  renderEmergencyContacts();
  renderCommunityReportsFeed();
  renderAnalytics();
  if (trustedContact) { renderSavedContact(); updateTrustedQuickActions(); }

  // Mobile drawer
  renderMobEmergencyContacts();
  if (safetyData) renderMobRouteCards(safetyData.routes);
  if (trustedContact) {
    const nm = document.getElementById('trustedNameMob');
    const pm = document.getElementById('trustedPhoneMob');
    if (nm) nm.value = trustedContact.name;
    if (pm) pm.value = trustedContact.phone;
    const sd = document.getElementById('savedContactMob');
    if (sd) sd.innerHTML = '✅ <strong>' + trustedContact.name + '</strong> — ' + trustedContact.phone;
    updateMobTrustedActions();
  }

  setupDrawerSwipe();
  setupMobileSwipeClose();
  setupAutocomplete('originInput', 'originDropdown');
  setupAutocomplete('destInput',   'destDropdown');
});


/* ──────────────────────────────────────────────
   THEME SYSTEM
────────────────────────────────────────────── */
const THEMES = ['dark', 'light', 'night'];
const THEME_ICONS = { dark: '☀️', light: '🌙', night: '🌅' };
const THEME_LABELS = { dark: 'Switch to Light Mode', light: 'Switch to Night Mode', night: 'Switch to Dark Mode' };

function toggleTheme() {
  const idx = THEMES.indexOf(currentTheme);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next, true);
}

function applyTheme(theme, save = true) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = THEME_ICONS[theme];
  const btn = document.getElementById('themeBtn');
  if (btn) btn.title = THEME_LABELS[theme];
  if (save) localStorage.setItem('sf_theme', theme);
  // update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f5f3ff' : theme === 'night' ? '#020208' : '#080612';
  // sync mobile floating theme icon
  const mobIcon = document.getElementById('themeIconMob');
  if (mobIcon) mobIcon.textContent = THEME_ICONS[theme];
  // update map tiles if map is ready
  if (map && save) updateMapTiles(theme);
  const msg = { dark:'🌑 Dark mode on', light:'☀️ Light mode on', night:'🌙 Night mode on' };
  if (save) showToast(msg[theme]);
}

function updateMapTiles(theme) {
  map.eachLayer(l => { if (l._url && l._url.includes('cartocdn')) map.removeLayer(l); });
  const style = theme === 'light' ? 'light_all' : 'dark_all';
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
  }).addTo(map);
}


/* ──────────────────────────────────────────────
   MAP
────────────────────────────────────────────── */
function initMap() {
  map = L.map('map', { center: [22.562, 88.358], zoom: 14, zoomControl: true });
  const style = currentTheme === 'light' ? 'light_all' : 'dark_all';
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`, {
    attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
  }).addTo(map);
  map.on('click', e => { if (pinModeActive) handleMapPin(e.latlng); else map.closePopup(); });
}

async function loadData() {
  try {
    const res = await fetch('data.json');
    safetyData = await res.json();
  } catch {
    safetyData = getFallbackData();
  }
  renderMapLayers();
}

function renderMapLayers() {
  renderRoutes(); renderSafeZones(); renderCrimeZones();
  renderLightingZones(); renderReportMarkers();
}


/* ──────────────────────────────────────────────
   MAP LAYERS
────────────────────────────────────────────── */
function renderRoutes() {
  routeLayers.forEach(l => map.removeLayer(l)); routeLayers = [];
  if (!layerState.routes) return;
  safetyData.routes.forEach((r, i) => {
    const poly = L.polyline(r.waypoints, {
      color: r.color, weight: 5, opacity: .82,
      dashArray: r.safetyScore < 50 ? '8 5' : null, smoothFactor: 1
    }).bindPopup(`<div class="popup-title">${r.name}</div>
      <div class="popup-body">Score: <strong style="color:${r.color}">${r.safetyScore}/100</strong><br>${r.distance} · ${r.duration}</div>
      <span class="popup-tag ${getScoreClass(r.safetyScore)}">${getScoreLabel(r.safetyScore)}</span>`
    ).on('click', () => selectDemoRoute(r.id));
    poly.addTo(map); routeLayers.push(poly);
    if (i === 0) {
      pinMarker(r.waypoints[0], '📍', 'Origin', '#22c55e');
      pinMarker(r.waypoints[r.waypoints.length - 1], '🏁', 'Destination', '#a78bfa');
    }
  });
}

function pinMarker(latlng, emoji, label, color) {
  const icon = L.divIcon({ className: '', iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;background:rgba(8,6,18,.92);border:2px solid ${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 12px ${color}55">${emoji}</div>`
  });
  L.marker(latlng, { icon }).bindPopup(`<div class="popup-title">${label}</div>`).addTo(map);
}

function renderSafeZones() {
  safeZoneMarkers.forEach(m => map.removeLayer(m)); safeZoneMarkers = [];
  if (!layerState.safeZones) return;
  const icons = { metro:'🚇', hospital:'🏥', police:'👮', transit:'🚉' };
  safetyData.safeZones.forEach(z => {
    const icon = L.divIcon({ className: '', iconAnchor: [14, 14],
      html: `<div style="width:28px;height:28px;background:rgba(34,197,94,.12);border:2px solid #22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 8px rgba(34,197,94,.3)">${icons[z.type] || '📍'}</div>`
    });
    const m = L.marker([z.lat, z.lng], { icon }).bindPopup(
      `<div class="popup-title">${z.name}</div><div class="popup-body">${z.description}</div><span class="popup-tag safe">Safe Zone</span>`);
    m.addTo(map); safeZoneMarkers.push(m);
  });
}

function renderCrimeZones() {
  crimeCircles.forEach(c => map.removeLayer(c)); crimeCircles = [];
  if (!layerState.crime) return;
  const cols = { high: '#ef4444', medium: '#f59e0b', low: '#fcd34d' };
  safetyData.crimeZones.forEach(z => {
    const c = L.circle([z.lat, z.lng], {
      radius: z.radius, color: cols[z.severity], fillColor: cols[z.severity],
      fillOpacity: isNightMode ? .28 : .12, weight: 1.5, dashArray: '4 3'
    }).bindPopup(`<div class="popup-title">⚠️ Crime Zone — ${z.severity.toUpperCase()}</div><div class="popup-body">${z.description}</div><span class="popup-tag danger">Caution</span>`);
    c.addTo(map); crimeCircles.push(c);
  });
}

function renderLightingZones() {
  lightingCircles.forEach(c => map.removeLayer(c)); lightingCircles = [];
  if (!layerState.lighting) return;
  safetyData.lightingZones.forEach(z => {
    const c = L.circle([z.lat, z.lng], {
      radius: z.radius, color: '#fbbf24', fillColor: '#fbbf24',
      fillOpacity: isNightMode ? .32 : .1, weight: 1, dashArray: '3 4'
    }).bindPopup(`<div class="popup-title">💡 Poor Lighting</div><div class="popup-body">${z.description}</div><span class="popup-tag warn">Low Visibility</span>`);
    c.addTo(map); lightingCircles.push(c);
  });
}

function renderReportMarkers() {
  reportMarkers.forEach(m => map.removeLayer(m)); reportMarkers = [];
  if (!layerState.reports) return;
  communityReports.forEach(r => {
    if (!r.lat) return;
    const icon = L.divIcon({ className: '', iconAnchor: [14, 14],
      html: `<div style="width:28px;height:28px;background:rgba(124,58,237,.18);border:2px solid #a78bfa;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 8px rgba(124,58,237,.3)">${INCIDENT_ICONS[r.type] || '📍'}</div>`
    });
    const m = L.marker([r.lat, r.lng], { icon }).bindPopup(
      `<div class="popup-title">${INCIDENT_ICONS[r.type]} ${INCIDENT_LABELS[r.type]}</div><div class="popup-body">${r.location}<br>${r.time}</div><span class="popup-tag info">Community Report</span>`);
    m.addTo(map); reportMarkers.push(m);
  });
}


/* ──────────────────────────────────────────────
   REAL ROUTING (Nominatim + OSRM)
────────────────────────────────────────────── */
async function findRoutes() {
  const orig = document.getElementById('originInput').value.trim();
  const dest = document.getElementById('destInput').value.trim();
  if (!orig || !dest) { showToast('⚠️ Enter both origin and destination'); return; }
  const btn = document.getElementById('findBtn');
  btn.disabled = true; btn.querySelector('.find-txt').textContent = 'Searching…';
  try {
    showToast('🔍 Locating addresses…');
    const [oC, dC] = await Promise.all([geocode(orig), geocode(dest)]);
    if (!oC) { showToast(`❌ Could not find: "${orig}". Try adding city name.`); return; }
    if (!dC) { showToast(`❌ Could not find: "${dest}". Try adding city name.`); return; }
    showToast('🗺️ Calculating safe routes…');
    const rd = await fetchOSRM(oC, dC);
    if (!rd) { showToast('❌ Route not found. Try different locations.'); return; }
    clearLiveRoutes();
    drawLiveRoutes(oC, dC, rd);
    map.fitBounds(L.latLngBounds([[oC.lat, oC.lon], [dC.lat, dC.lon]]), { padding: [60, 60] });
    showToast(`✅ ${rd.allRoutes.length} routes found! Ranked by safety.`);
  } catch (e) {
    console.error(e); showToast('❌ Network error. Run via Live Server (http://)');
  } finally {
    btn.disabled = false; btn.querySelector('.find-txt').textContent = 'Find Safe Routes';
  }
}

async function geocode(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } });
  const d = await r.json();
  return d.length ? { lat: +d[0].lat, lon: +d[0].lon, display_name: d[0].display_name } : null;
}

async function fetchOSRM(o, d) {
  const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson&alternatives=true`;
  const r = await fetch(url); const data = await r.json();
  if (data.code !== 'Ok' || !data.routes?.length) return null;
  return { allRoutes: data.routes };
}

function drawLiveRoutes(oC, dC, rd) {
  const variants = [];
  rd.allRoutes.forEach((r, i) => {
    const coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
    const dist = r.distance >= 1000 ? (r.distance / 1000).toFixed(1) + ' km' : Math.round(r.distance) + ' m';
    const dur  = r.legs[0].duration >= 3600
      ? Math.floor(r.legs[0].duration / 3600) + 'h ' + Math.floor((r.legs[0].duration % 3600) / 60) + ' min'
      : Math.ceil(r.legs[0].duration / 60) + ' min';
    const score = [84, 61, 38][i] ?? 50;
    const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
    const names = ['Safest Route', 'Alternate Route', 'Fastest (Caution)'];
    const lightings = ['Good', 'Moderate', 'Poor'];
    const crowds = ['High', 'Medium', 'Low'];
    const crimes = ['Low', 'Medium', 'High'];
    variants.push({ coords, score, color, name: names[i] || 'Route ' + (i + 1), dist, dur, id: 'lr' + i,
      lighting: lightings[i] || 'Moderate', crowd: crowds[i] || 'Medium', crime: crimes[i] || 'Medium' });
  });
  if (variants.length === 1) {
    const b = variants[0]; const mid = Math.floor(b.coords.length / 2);
    variants.push({ ...b, coords: b.coords.slice(0, mid).concat([[dC.lat, dC.lon]]),
      score: 61, color: '#f59e0b', name: 'Alternate Route', id: 'lr1', lighting: 'Moderate', crowd: 'Medium', crime: 'Medium' });
    variants.push({ ...b, coords: [b.coords[0], b.coords[Math.floor(mid / 2)], [dC.lat, dC.lon]],
      score: 38, color: '#ef4444', name: 'Fastest (Caution)', id: 'lr2', lighting: 'Poor', crowd: 'Low', crime: 'High' });
  }
  currentRouteData = variants;
  variants.forEach((v, i) => {
    const poly = L.polyline(v.coords, {
      color: v.color, weight: i === 0 ? 6 : 4, opacity: i === 0 ? .9 : .55,
      dashArray: v.score < 45 ? '8 5' : null, smoothFactor: 1
    }).bindPopup(`<div class="popup-title">${v.name}</div>
      <div class="popup-body">Score: <strong style="color:${v.color}">${v.score}/100</strong><br>${v.dist} · ${v.dur}</div>
      <span class="popup-tag ${getScoreClass(v.score)}">${getScoreLabel(v.score)}</span>`)
    .on('click', () => highlightLive(v.id, variants));
    poly._liveId = v.id; poly.addTo(map); liveRouteLayers.push(poly);
  });
  [
    [oC, '📍', '#22c55e', oC.display_name?.split(',').slice(0, 2).join(',') || 'Origin'],
    [dC, '🏁', '#a78bfa', dC.display_name?.split(',').slice(0, 2).join(',') || 'Destination']
  ].forEach(([c, e, col, lbl]) => {
    const icon = L.divIcon({ className: '', iconAnchor: [17, 17],
      html: `<div style="width:34px;height:34px;background:rgba(8,6,18,.92);border:2px solid ${col};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 12px ${col}55">${e}</div>`
    });
    const m = L.marker([c.lat, c.lon], { icon }).bindPopup(`<div class="popup-title">${lbl}</div>`);
    m.addTo(map); liveMarkers.push(m);
  });
  updateSidebarLive(variants);
}

function highlightLive(id, variants) {
  liveRouteLayers.forEach(l => l.setStyle({ weight: l._liveId === id ? 6 : 3, opacity: l._liveId === id ? .92 : .38 }));
  const v = variants.find(r => r.id === id);
  if (v) updateMeters(v.score, v.lighting, v.crowd, v.crime);
}

function updateSidebarLive(variants) {
  const c = document.getElementById('routeCards'); c.innerHTML = '';
  document.getElementById('routeCount').textContent = variants.length + ' routes';
  variants.forEach((v, i) => {
    const cls = getScoreClass(v.score);
    const card = document.createElement('div');
    card.className = `route-card ${cls}-c`; card.id = `card-${v.id}`;
    card.innerHTML = `
      <div class="rc-top"><div class="rc-name">${v.name}</div><div class="rc-score ${cls}">${v.score}</div></div>
      <div class="rc-meta"><span class="rc-mi">📏 ${v.dist}</span><span class="rc-mi">⏱ ${v.dur}</span><span class="rc-mi">💡 ${v.lighting}</span><span class="rc-mi">👥 ${v.crowd}</span></div>
      <div class="rc-footer">${i === 0 ? '<span class="best-badge">✓ Recommended</span>' : '<span></span>'}
        <button class="rc-detail" onclick="event.stopPropagation();openLiveModal('${v.id}')">Details →</button></div>`;
    card.addEventListener('click', () => {
      document.querySelectorAll('.route-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      const poly = liveRouteLayers.find(l => l._liveId === v.id);
      if (poly) map.fitBounds(poly.getBounds(), { padding: [40, 40] });
      highlightLive(v.id, variants);
    });
    c.appendChild(card);
  });
  if (variants.length) {
    document.querySelector('.route-card')?.classList.add('selected');
    updateMeters(variants[0].score, variants[0].lighting, variants[0].crowd, variants[0].crime);
  }
  // Also populate mobile drawer
  renderMobRouteCards(variants);
  if (variants.length) updateMobMeters(variants[0].score, variants[0].lighting, variants[0].crowd, variants[0].crime);
  // Auto-open drawer on mobile when routes load
  if (typeof isMobile === 'function' && isMobile()) openMobDrawer();
}

function openLiveModal(id) {
  if (!currentRouteData) return;
  const v = currentRouteData.find(r => r.id === id); if (!v) return;
  const cls = getScoreClass(v.score);
  const colors = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444' };
  document.getElementById('routeModalContent').innerHTML = `
    <div class="rm-name">${v.name}</div>
    <div class="rm-score" style="color:${colors[cls]}">${v.score}<span style="font-size:1rem;color:var(--text3)">/100</span></div>
    <div class="rm-grid">
      <div class="rm-stat"><div class="rm-stat-l">Distance</div><div class="rm-stat-v">📏 ${v.dist}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Duration</div><div class="rm-stat-v">⏱ ${v.dur}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Lighting</div><div class="rm-stat-v">💡 ${v.lighting}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Crowd</div><div class="rm-stat-v">👥 ${v.crowd}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Crime Level</div><div class="rm-stat-v" style="color:${v.crime==='High'?'#ef4444':v.crime==='Medium'?'#f59e0b':'#22c55e'}">${v.crime}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Rating</div><div class="rm-stat-v" style="color:${colors[cls]}">${getScoreLabel(v.score)}</div></div>
    </div>
    <div class="rm-hl-title">Score Factors</div>
    <div class="rm-hl">
      <div class="rm-hl-item">Lighting: ${v.lighting} ${v.lighting==='Good'?'(+20 pts)':v.lighting==='Moderate'?'(+8 pts)':'(-15 pts)'}</div>
      <div class="rm-hl-item">Crowd: ${v.crowd} ${v.crowd==='High'?'(+18 pts)':v.crowd==='Medium'?'(+5 pts)':'(-10 pts)'}</div>
      <div class="rm-hl-item">Crime: ${v.crime} ${v.crime==='Low'?'(+15 pts)':v.crime==='Medium'?'(-5 pts)':'(-20 pts)'}</div>
    </div>`;
  openModal('routeModal');
}

function clearLiveRoutes() {
  liveRouteLayers.forEach(l => map.removeLayer(l));
  liveMarkers.forEach(m => map.removeLayer(m));
  liveRouteLayers = []; liveMarkers = [];
}


/* ──────────────────────────────────────────────
   DEMO ROUTE CARDS
────────────────────────────────────────────── */
function renderRouteCards() {
  if (!safetyData) return;
  const c = document.getElementById('routeCards'); c.innerHTML = '';
  safetyData.routes.forEach((r, i) => {
    const cls = getScoreClass(r.safetyScore);
    const card = document.createElement('div');
    card.className = `route-card ${cls}-c`; card.id = `card-${r.id}`;
    card.innerHTML = `
      <div class="rc-top"><div class="rc-name">${r.name}</div><div class="rc-score ${cls}">${r.safetyScore}</div></div>
      <div class="rc-meta"><span class="rc-mi">📏 ${r.distance}</span><span class="rc-mi">⏱ ${r.duration}</span><span class="rc-mi">💡 ${r.lighting}</span><span class="rc-mi">👥 ${r.crowdDensity}</span></div>
      <div class="rc-tags">${r.highlights.slice(0, 2).map(h => `<span class="rc-tag">${h}</span>`).join('')}</div>
      <div class="rc-footer"><button class="rc-detail" onclick="event.stopPropagation();openDemoModal('${r.id}')">Details →</button>${i === 0 ? '<span class="best-badge">✓ Recommended</span>' : ''}</div>`;
    card.addEventListener('click', e => { if (!e.target.classList.contains('rc-detail')) selectDemoRoute(r.id); });
    c.appendChild(card);
  });
}

function selectDemoRoute(id) {
  selectedRouteId = id;
  document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`card-${id}`)?.classList.add('selected');
  const r = safetyData.routes.find(x => x.id === id);
  if (r) {
    map.fitBounds(r.waypoints, { padding: [40, 40] });
    updateMeters(r.safetyScore, r.lighting, r.crowdDensity, r.crimeLevel);
    updateMobMeters(r.safetyScore, r.lighting, r.crowdDensity, r.crimeLevel);
  }
}

function openDemoModal(id) {
  const r = safetyData.routes.find(x => x.id === id); if (!r) return;
  const cls = getScoreClass(r.safetyScore);
  const colors = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444' };
  document.getElementById('routeModalContent').innerHTML = `
    <div class="rm-name">${r.name}</div>
    <div class="rm-score" style="color:${colors[cls]}">${r.safetyScore}<span style="font-size:1rem;color:var(--text3)">/100</span></div>
    <div class="rm-grid">
      <div class="rm-stat"><div class="rm-stat-l">Distance</div><div class="rm-stat-v">📏 ${r.distance}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Duration</div><div class="rm-stat-v">⏱ ${r.duration}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Lighting</div><div class="rm-stat-v">💡 ${r.lighting}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Crowd</div><div class="rm-stat-v">👥 ${r.crowdDensity}</div></div>
      <div class="rm-stat"><div class="rm-stat-l">Crime Level</div><div class="rm-stat-v" style="color:${r.crimeLevel==='High'?'#ef4444':r.crimeLevel==='Medium'?'#f59e0b':'#22c55e'}">${r.crimeLevel}</div></div>
    </div>
    <div class="rm-hl-title">Highlights</div>
    <div class="rm-hl">${r.highlights.map(h => `<div class="rm-hl-item">${h}</div>`).join('')}</div>`;
  openModal('routeModal');
}


/* ──────────────────────────────────────────────
   SAFETY METERS
────────────────────────────────────────────── */
function updateMeters(score, lighting, crowd, crime) {
  const lm = { Good: 85, Moderate: 55, Poor: 20 };
  const cm = { High: 80, Medium: 50, Low: 25 };
  const rm = { Low: 15, Medium: 45, High: 80 };
  setBar('lightFill', 'lightVal', lm[lighting] || 50, 'good');
  setBar('crowdFill', 'crowdVal', cm[crowd] || 50, 'medium');
  setBar('crimeFill', 'crimeVal', rm[crime] || 50, 'danger');
  document.getElementById('overallScore').textContent = score;
  updateScoreArc(score);
  document.getElementById('scoreDesc').textContent =
    score >= 75 ? 'Safe — Good to travel' : score >= 50 ? 'Moderate — Stay alert' : 'High Risk — Avoid if possible';
}
function setBar(fId, vId, pct, cls) {
  const f = document.getElementById(fId); if (f) { f.style.width = pct + '%'; f.className = 'mf ' + cls; }
  const v = document.getElementById(vId); if (v) v.textContent = pct + '%';
}
function updateScoreArc(score) {
  const arc = document.getElementById('scoreArc'); if (!arc) return;
  arc.style.strokeDashoffset = 201 - (score / 100) * 201;
  arc.style.stroke = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
}


/* ──────────────────────────────────────────────
   SCORE EXPLAINER
────────────────────────────────────────────── */
function openScoreExplainer() {
  const score = parseInt(document.getElementById('overallScore').textContent) || 70;
  const c = score >= 75 ? 'var(--safe)' : score >= 50 ? 'var(--warn)' : 'var(--danger)';
  const rows = [
    { l: '💡 Street Lighting', v: score >= 75 ? '+20' : score >= 50 ? '+8' : '-15', c: score >= 75 ? 'var(--safe)' : score >= 50 ? 'var(--warn)' : 'var(--danger)' },
    { l: '👥 Crowd Density',   v: score >= 75 ? '+18' : score >= 50 ? '+5' : '-10', c: score >= 75 ? 'var(--safe)' : 'var(--danger)' },
    { l: '🚨 Crime Reports',   v: score >= 75 ? '+15' : score >= 50 ? '-5' : '-20', c: score >= 75 ? 'var(--safe)' : 'var(--danger)' },
    { l: '🚉 Transit Access',  v: '+12', c: 'var(--safe)' },
    { l: '📷 CCTV Coverage',   v: score >= 75 ? '+10' : '+5', c: 'var(--safe)' },
    { l: '⏰ Time of Day',     v: isNightMode ? '-8' : '+5', c: isNightMode ? 'var(--danger)' : 'var(--safe)' },
  ];
  document.getElementById('scoreBreakdownContent').innerHTML = `
    <div class="score-bdown">
      ${rows.map(r => `<div class="sb-row"><span class="sb-lbl">${r.l}</span><span class="sb-val" style="color:${r.c}">${r.v} pts</span></div>`).join('')}
      <div class="sb-row" style="border-color:var(--border2)"><span class="sb-lbl" style="color:var(--text);font-weight:700">Total Score</span><span class="sb-val" style="color:${c};font-size:1.1rem">${score}/100</span></div>
    </div>`;
  openModal('scoreModal');
}


/* ──────────────────────────────────────────────
   SAFE SPOTS NEARBY
────────────────────────────────────────────── */
function findNearby() {
  if (!navigator.geolocation) { showToast('Geolocation not available'); return; }
  showToast('📍 Finding nearest safe spots…');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const spots = safetyData.safeZones.map(z => ({ ...z, dist: haversine(lat, lon, z.lat, z.lng) }))
      .sort((a, b) => a.dist - b.dist).slice(0, 3);
    const list = document.getElementById('nearbyList'); list.innerHTML = '';
    const icons = { metro: '🚇', hospital: '🏥', police: '👮', transit: '🚉' };
    spots.forEach(s => {
      const el = document.createElement('div'); el.className = 'nearby-item';
      el.innerHTML = `
        <div class="nearby-name">${icons[s.type] || '📍'} ${s.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <span class="nearby-dist">${s.dist < 1 ? (s.dist * 1000).toFixed(0) + ' m' : s.dist.toFixed(1) + ' km'}</span>
          <button class="nearby-go" onclick="goToSpot(${s.lat},${s.lng})">Go →</button>
        </div>`;
      list.appendChild(el);
    });
    showToast('✅ Found 3 nearest safe spots!');
    switchSidebar('safety', document.querySelectorAll('.stab')[1]);
  }, () => showToast('❌ Location access denied.'));
}
function goToSpot(lat, lng) { map.setView([lat, lng], 16); }
function haversine(la1, lo1, la2, lo2) {
  const R = 6371, dLa = (la2 - la1) * Math.PI / 180, dLo = (lo2 - lo1) * Math.PI / 180;
  const a = Math.sin(dLa/2)**2 + Math.cos(la1*Math.PI/180) * Math.cos(la2*Math.PI/180) * Math.sin(dLo/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/* ──────────────────────────────────────────────
   SAFE WALK TIMER
────────────────────────────────────────────── */
function openSafeWalkSetup() { switchSidebar('emergency', document.querySelectorAll('.stab')[2]); }
function startSafeWalk() {
  const mins = parseInt(document.getElementById('swMinutes').value) || 15;
  swSecondsLeft = mins * 60;
  document.getElementById('swIdle').style.display = 'none';
  document.getElementById('swActive').style.display = 'flex';
  updateSWDisp();
  swTimer = setInterval(() => { swSecondsLeft--; updateSWDisp(); if (swSecondsLeft <= 0) { clearInterval(swTimer); triggerSWAlert(); } }, 1000);
  showToast(`🚶 Safe Walk started — ${mins} min timer`);
}
function updateSWDisp() {
  const m = Math.floor(swSecondsLeft / 60), s = swSecondsLeft % 60;
  const txt = `${m}:${s.toString().padStart(2, '0')}`;
  const col = swSecondsLeft <= 60 ? 'var(--danger)' : 'var(--safe)';
  // Update desktop header + mobile drawer
  ['swCountdown','mobSwCountdown'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = txt; el.style.color = col; }
  });
}
function markSafe() {
  clearInterval(swTimer);
  const active = document.getElementById('swActive');
  const idle   = document.getElementById('swIdle');
  if (active) active.style.display = 'none';
  if (idle)   idle.style.display   = 'block';
  const mobActive = document.getElementById('mobSwActive');
  if (mobActive) mobActive.style.display = 'none';
  showToast("✅ Glad you're safe! Timer stopped.");
}
function triggerSWAlert() {
  openModal('swAlertModal'); let cd = 10;
  document.getElementById('swCountdownAlert').textContent = cd;
  swAlertTimer = setInterval(() => {
    cd--; document.getElementById('swCountdownAlert').textContent = cd;
    if (cd <= 0) { clearInterval(swAlertTimer); closeModal('swAlertModal'); triggerSOS(); }
  }, 1000);
}
function cancelSWAlert() { clearInterval(swAlertTimer); closeModal('swAlertModal'); markSafe(); showToast('✅ Alert cancelled. Stay safe!'); }


/* ──────────────────────────────────────────────
   CROWDSOURCED REPORTS
────────────────────────────────────────────── */
function selectIncType(btn) {
  document.querySelectorAll('.inc-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); selectedIncType = btn.dataset.type;
}
function startPinMode() {
  pinModeActive = !pinModeActive;
  const btn = document.getElementById('pinBtn');
  btn.classList.toggle('active', pinModeActive);
  btn.textContent = pinModeActive ? '✕ Cancel Pin' : '📌 Report Area';
  showToast(pinModeActive ? '📌 Click on map to pin unsafe area' : '📌 Pin mode cancelled');
}
function handleMapPin(latlng) {
  pinModeActive = false;
  document.getElementById('pinBtn').classList.remove('active');
  document.getElementById('pinBtn').textContent = '📌 Report Area';
  document.getElementById('reportLocation').value = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  switchTab('report', document.querySelector('.nav-btn[data-tab="report"]'));
  showToast('📍 Location pinned! Fill in the report.'); window._pLat = latlng.lat; window._pLng = latlng.lng;
}
function submitReport() {
  const loc = document.getElementById('reportLocation').value.trim();
  if (!loc) { showToast('⚠️ Please enter a location'); return; }
  const r = { id: 'r' + Date.now(), type: selectedIncType, location: loc,
    severity: document.querySelector('input[name="sev"]:checked')?.value || 'medium',
    desc: document.getElementById('reportDesc').value.trim(),
    time: document.getElementById('reportTime').value,
    anon: document.getElementById('reportAnon').checked,
    lat: window._pLat || null, lng: window._pLng || null, ts: new Date().toISOString() };
  communityReports.unshift(r);
  localStorage.setItem('sf_reports', JSON.stringify(communityReports.slice(0, 50)));
  window._pLat = null; window._pLng = null;
  renderCommunityReportsFeed(); renderReportMarkers();
  document.getElementById('reportLocation').value = ''; document.getElementById('reportDesc').value = '';
  document.querySelectorAll('.inc-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.inc-btn[data-type="harassment"]')?.classList.add('active'); selectedIncType = 'harassment';
  showToast('✅ Report submitted! Thank you for keeping the community safe.');
  const el = document.getElementById('statReports'); if (el) el.textContent = 24 + communityReports.length;
}
function renderCommunityReportsFeed() {
  const feed = document.getElementById('reportsFeed'); if (!feed) return;
  const all = [...communityReports, ...DEMO_REPORTS()].slice(0, 8);
  feed.innerHTML = '';
  all.forEach(r => {
    const div = document.createElement('div'); div.className = 'feed-item';
    div.innerHTML = `
      <div class="fi-icon ${r.severity}">${INCIDENT_ICONS[r.type] || '📍'}</div>
      <div class="fi-body">
        <div class="fi-top"><span class="fi-type">${INCIDENT_LABELS[r.type] || r.type}</span><span class="fi-time">${r.time}</span></div>
        <div class="fi-loc">📍 ${r.location}</div>
        ${r.desc ? `<div class="fi-desc">${r.desc}</div>` : ''}
      </div>`;
    feed.appendChild(div);
  });
}
const DEMO_REPORTS = () => [
  { type: 'harassment',    location: 'Park Street, near metro exit',   severity: 'high',   desc: 'Followed by unknown individual at night', time: '2 hours ago' },
  { type: 'poor_lighting', location: 'Sealdah underpass',              severity: 'medium', desc: 'Lights broken, very dark after 8pm',       time: 'Yesterday' },
  { type: 'theft',         location: 'New Market area, near gate 3',   severity: 'medium', desc: 'Pickpocket incident reported',              time: '2 days ago' },
  { type: 'suspicious',    location: 'Rabindra Sarani, near bus stop', severity: 'low',    desc: 'Group acting suspicious',                  time: '3 days ago' },
];


/* ──────────────────────────────────────────────
   ANALYTICS
────────────────────────────────────────────── */
function renderAnalytics() { renderHourChart(); renderIncChart(); renderTrendChart(); }
function renderHourChart() {
  const c = document.getElementById('hourChart'); if (!c) return;
  const data = [8,12,6,3,2,1,2,4,3,5,6,7,5,4,5,8,10,14,16,12,9,10,11,9];
  const max = Math.max(...data); c.innerHTML = '';
  data.forEach(v => {
    const b = document.createElement('div'); b.className = 'hour-bar';
    const d = v / max, r = Math.round(34 + d * 205), g = Math.round(197 - d * 163), bl = Math.round(94 - d * 36);
    b.style.cssText = `height:${Math.max(8, d * 100)}%;background:rgb(${r},${g},${bl});opacity:${.55 + d * .45}`;
    c.appendChild(b);
  });
}
function renderIncChart() {
  const c = document.getElementById('incidentBreakdown'); if (!c) return;
  const data = [{ l: '😰 Harassment', p: 38 }, { l: '💡 Poor Lighting', p: 27 }, { l: '👜 Theft', p: 18 }, { l: '👁 Suspicious', p: 11 }, { l: '🚧 Unsafe Road', p: 6 }];
  c.innerHTML = '';
  data.forEach(d => {
    const r = document.createElement('div'); r.className = 'inc-row';
    r.innerHTML = `<span class="inc-row-lbl">${d.l}</span><div class="inc-row-track"><div class="inc-row-fill" style="width:${d.p}%"></div></div><span class="inc-row-val">${d.p}%</span>`;
    c.appendChild(r);
  });
}
function renderTrendChart() {
  const c = document.getElementById('trendChart'), labels = document.getElementById('trendLabels'); if (!c) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], incidents = [12,9,15,8,18,22,7];
  const max = Math.max(...incidents); c.innerHTML = ''; if (labels) labels.innerHTML = '';
  incidents.forEach((v, i) => {
    const b = document.createElement('div'); b.className = 't-bar' + (v === Math.min(...incidents) ? ' best' : '');
    b.style.height = Math.max(8, v / max * 100) + '%'; c.appendChild(b);
    if (labels) { const l = document.createElement('span'); l.textContent = days[i]; labels.appendChild(l); }
  });
}


/* ──────────────────────────────────────────────
   AI CHAT  — SafeGuide
   Architecture:
   1. Try Netlify serverless function /.netlify/functions/chat (works when deployed)
   2. Fallback: smart offline response engine (works everywhere, always)
   To enable real AI: deploy to Netlify + add netlify/functions/chat.js (see README)
────────────────────────────────────────────── */

const AI_CONVERSATION_HISTORY = []; // keeps multi-turn context

function toggleAIChat() {
  aiChatOpen = !aiChatOpen;
  const panel = document.getElementById('aiChatPanel');
  panel.classList.toggle('open', aiChatOpen);
  if (aiChatOpen) {
    // Small delay so animation finishes before keyboard shows
    setTimeout(() => document.getElementById('aiInput')?.focus(), 300);
    // Prevent body scroll on mobile when chat is open
    if (window.innerWidth <= 600) document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

function quickPrompt(t) {
  document.getElementById('aiInput').value = t;
  sendAIMessage();
}

async function sendAIMessage() {
  const inp  = document.getElementById('aiInput');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';
  appendMsg(text, 'user');
  AI_CONVERSATION_HISTORY.push({ role: 'user', content: text });
  const typing = appendTyping();

  // Try real API via Netlify function first, then fallback
  try {
    const reply = await fetchAIReply(text);
    typing.remove();
    AI_CONVERSATION_HISTORY.push({ role: 'assistant', content: reply });
    appendMsg(reply, 'bot');
  } catch (e) {
    typing.remove();
    const fallback = getSmartFallback(text);
    AI_CONVERSATION_HISTORY.push({ role: 'assistant', content: fallback });
    appendMsg(fallback, 'bot');
  }
}

// ── Attempt real API via Netlify serverless function ──
async function fetchAIReply(userText) {
  // Only attempt if we're on a hosted domain (not file://)
  if (window.location.protocol === 'file:') throw new Error('file protocol');

  const endpoint = '/.netlify/functions/chat';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      messages: AI_CONVERSATION_HISTORY,
      context: {
        isNight: isNightMode,
        theme: currentTheme,
        hasLocation: !!navigator.geolocation
      }
    })
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error('API error ' + res.status);
  const data = await res.json();
  return data.reply || data.content || 'Sorry, I could not get a response.';
}

// ── Smart offline fallback — keyword-matched responses ──
function getSmartFallback(text) {
  const q = text.toLowerCase();

  // Night / dark / late
  if (/night|dark|late|after.?(8|9|10|11|12)|evening|midnight/.test(q)) {
    return `🌙 **Walking at night — key tips:**\n\n• Stick to well-lit, busy streets (use our Safe Route — green option)\n• Share your live location with a trusted contact before leaving\n• Keep your phone charged and volume up\n• Walk confidently, stay alert — avoid looking at your phone while moving\n• Use our Safe Walk Timer so someone knows if you don't arrive\n• If uncomfortable, step into any open shop or metro station\n\n📞 Women Helpline: **1091** (24/7, free)`;
  }

  // Being followed / stalked
  if (/follow|stalk|chase|behind me|someone following|suspicious person/.test(q)) {
    return `🚨 **If you feel followed — do this NOW:**\n\n1. **Don't go home** — it reveals your address\n2. Enter a busy public place (shop, restaurant, metro)\n3. Call someone and speak loudly so they know your location\n4. If on the street, cross to the other side — a follower will too\n5. Call Police: **100** or Women Helpline: **1091**\n6. Use our SOS button — it notifies your trusted contact instantly\n\nTrust your instincts. Your safety matters more than seeming "paranoid".`;
  }

  // SOS / emergency / help
  if (/sos|emergency|help|danger|unsafe|scared|afraid|attack/.test(q)) {
    return `🆘 **Emergency — act now:**\n\n📞 **Women Helpline: 1091** (free, 24/7)\n📞 **Police: 100**\n📞 **Ambulance: 102**\n\n→ Tap the red **SOS button** at the top right — it shares your location and opens direct call links.\n→ If you can't speak, text or WhatsApp a trusted contact your location.\n→ Make noise — shout, use your phone alarm, blow a whistle.\n\nYou are not alone. Help is available.`;
  }

  // Route / safe path
  if (/route|path|way|walk|safe.?road|which way|direction/.test(q)) {
    return `🗺️ **Finding a safe route:**\n\n• Use our **Find Safe Routes** bar at the top — enter your start and destination\n• Always pick the **green route** (highest safety score)\n• Check the Safety panel for lighting and crowd ratings\n• At night, the green route matters even more — avoid red/yellow routes\n• Enable the **Night mode** toggle to see amplified danger zones\n\nWant me to explain what the safety score means?`;
  }

  // Safety score / how it works
  if (/score|rating|how.*work|safety.*score|what.*score|points/.test(q)) {
    return `📊 **How the safety score works:**\n\nEach route gets scored out of 100 based on:\n\n• 💡 **Street lighting** — well-lit roads score higher\n• 👥 **Crowd density** — busy areas are safer\n• 🚨 **Crime reports** — fewer reports = higher score\n• 🚉 **Transit access** — proximity to metro/police posts\n• 📷 **CCTV coverage** — monitored areas score better\n• ⏰ **Time of day** — Night mode reduces scores\n\n**Green = 70+** (safe) · **Yellow = 45–69** (caution) · **Red = <45** (avoid)`;
  }

  // Public transport / metro / bus
  if (/metro|bus|transport|auto|cab|taxi|uber|ola|rickshaw/.test(q)) {
    return `🚇 **Safer transport tips:**\n\n**Metro/Bus:**\n• Prefer women-only coaches (available on most Indian metros)\n• Stay near the door if it's not crowded\n• Share your live location before boarding\n\n**Cab/Auto:**\n• Always share ride details (driver name, vehicle number) with a contact\n• Sit behind the driver, not the passenger seat\n• Verify the driver's name before getting in\n• Use in-app SOS features in Ola/Uber\n\n**General:** Inform someone of your expected arrival time.`;
  }

  // Self defence
  if (/self.?def|protect|fight|attack|assault|grope|harass/.test(q)) {
    return `🛡️ **Personal safety & self-defence:**\n\n**Immediate actions:**\n• Shout loudly — "FIRE!" gets more attention than "Help!"\n• Aim for eyes, nose, throat, knees — vulnerable areas\n• Use keys, umbrella, bag strap as tools if needed\n• Create distance and run toward people\n\n**Prevention:**\n• Carry a safety alarm (loud personal alarm, ₹200–500 online)\n• Walk confidently, head up, aware of surroundings\n• Trust and act on gut instinct immediately\n\n📞 Report any harassment: **1091** (Women Helpline)`;
  }

  // Trusted contact / SOS setup
  if (/trusted|contact|family|friend|notify|alert|save.*number/.test(q)) {
    return `👤 **Setting up your trusted contact:**\n\n1. Go to the **Emergency tab** in the sidebar\n2. Enter your contact's name and phone number\n3. Tap **Save**\n\nWhen you press SOS, the app will:\n✅ Open WhatsApp to send them your GPS location\n✅ Pre-fill an SMS with your coordinates\n✅ Show a direct call button to reach them\n\nTip: Save someone who is likely to respond quickly — a family member or close friend.`;
  }

  // Safe walk timer
  if (/timer|safe walk|check.?in|walk.*home|going home/.test(q)) {
    return `🚶 **Using the Safe Walk Timer:**\n\n1. Go to **Emergency tab** in the sidebar\n2. Select a time (5–30 minutes)\n3. Tap **Start Walk**\n\nIf you don't tap **"I'm Safe"** before the timer ends:\n⚠️ A 10-second countdown alert appears\n🆘 If unanswered, SOS fires automatically\n\nThis is one of the most powerful features — use it every time you walk alone at night.`;
  }

  // Greetings
  if (/^(hi|hello|hey|namaste|hii|helo|sup|good morning|good evening)/.test(q)) {
    return `💜 Hi! I'm **SafeGuide**, your AI safety companion.\n\nI can help you with:\n• 🗺️ Finding the safest route\n• 🌙 Night walking safety tips\n• 🆘 What to do in an emergency\n• 🚶 Using the Safe Walk timer\n• 👤 Setting up your trusted contact\n• 🛡️ Personal safety advice\n\nWhat would you like to know?`;
  }

  // Tips / general
  if (/tip|advice|suggest|recommend|how.*stay.*safe|general/.test(q)) {
    return `💡 **Top safety tips for solo women:**\n\n1. **Always share your route** — tell someone where you're going and when you'll arrive\n2. **Use Safe Walk Timer** — auto-triggers SOS if you don't check in\n3. **Pick green routes** — highest safety score on our map\n4. **Stay in lit, busy areas** — avoid shortcuts through alleys\n5. **Trust your gut** — if something feels wrong, it probably is\n6. **Keep phone charged** — carry a power bank\n7. **Dress for movement** — practicality matters in emergencies\n8. **Know the helplines** — 1091 (Women), 100 (Police), 102 (Ambulance)`;
  }

  // What can you do / features
  if (/what can you|feature|capability|do you|can you help/.test(q)) {
    return `✦ **Here's what I can help with:**\n\n🗺️ **Route Safety** — explain safety scores, which route to pick\n🌙 **Night Safety** — tips for walking alone after dark\n🆘 **Emergency Guidance** — what to do if followed, attacked, or lost\n🚶 **Safe Walk Timer** — how to set it up\n👤 **Trusted Contact** — how SOS notifications work\n🛡️ **Self Defence** — quick practical tips\n🚇 **Transport Safety** — metro, cab, auto safety\n\nJust ask me anything — I'm here 24/7.`;
  }

  // Default — thoughtful generic response
  const defaults = [
    `I want to make sure I give you the most helpful answer. Could you tell me a bit more about your situation? For example:\n• Are you planning a route?\n• Do you feel unsafe right now?\n• Looking for general safety tips?\n\nIn any emergency, the SOS button (top right) connects you to help immediately. 💜`,
    `That's a great question about personal safety. Here's what I'd suggest:\n\n• Always let someone know your plans before travelling alone\n• Use the green (safest) route on our map\n• Keep the Women Helpline **1091** saved in your phone\n• Trust your instincts — if something feels off, act on it\n\nIs there something specific you're worried about? I can give more targeted advice.`,
    `Your safety is the priority. A few universal tips while I process your question:\n\n• 📍 Share your location with a trusted person\n• 🚶 Use our Safe Walk Timer for solo trips\n• 📞 Emergency: **1091** (Women) · **100** (Police)\n\nCould you rephrase your question? I want to give you the best possible answer. 💜`
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function appendMsg(text, role) {
  const msgs = document.getElementById('aiMessages');
  const d = document.createElement('div');
  d.className = `ai-msg ${role}`;
  // Convert **bold** markdown and newlines for display
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  d.innerHTML = role === 'bot'
    ? `<div class="ai-av-sm">✦</div><div class="ai-bubble">${formatted}</div>`
    : `<div class="ai-bubble">${text}</div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}

function appendTyping() {
  const msgs = document.getElementById('aiMessages');
  const d = document.createElement('div');
  d.className = 'ai-msg bot';
  d.innerHTML = `<div class="ai-av-sm">✦</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}


/* ──────────────────────────────────────────────
   AUTOCOMPLETE
────────────────────────────────────────────── */
function setupAutocomplete(inputId, dropId) {
  const inp = document.getElementById(inputId), drop = document.getElementById(dropId);
  let timer;
  inp.addEventListener('input', () => {
    clearTimeout(timer); const q = inp.value.trim();
    if (q.length < 3) { drop.classList.remove('open'); return; }
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } });
        const data = await r.json(); drop.innerHTML = '';
        if (!data.length) { drop.classList.remove('open'); return; }
        data.forEach(item => {
          const d = document.createElement('div'); d.className = 'ac-item';
          d.textContent = item.display_name.split(',').slice(0, 3).join(', ');
          d.addEventListener('mousedown', e => { e.preventDefault(); inp.value = d.textContent; drop.classList.remove('open'); });
          drop.appendChild(d);
        });
        drop.classList.add('open');
      } catch { }
    }, 350);
  });
  inp.addEventListener('blur', () => setTimeout(() => drop.classList.remove('open'), 200));
}


/* ──────────────────────────────────────────────
   LAYER TOGGLES + TIME
────────────────────────────────────────────── */
function toggleLayer(layer) {
  layerState[layer] = !layerState[layer];
  ({ safeZones: renderSafeZones, crime: renderCrimeZones, lighting: renderLightingZones, reports: renderReportMarkers })[layer]?.();
}
function setTime(mode) {
  isNightMode = mode === 'night';
  document.getElementById('btnDay').classList.toggle('active', !isNightMode);
  document.getElementById('btnNight').classList.toggle('active', isNightMode);
  renderCrimeZones(); renderLightingZones();
  showToast(isNightMode ? '🌙 Night mode: Danger zones amplified.' : '☀️ Day mode active.');
}


/* ──────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────── */
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn,.mob-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (tab === 'analytics') { setTimeout(renderAnalytics, 50); }
}
function switchSidebar(panel, btn) {
  document.querySelectorAll('.sp').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  document.getElementById(`sp-${panel}`)?.classList.add('active');
  btn?.classList.add('active');
}

/* Mobile menu */
function toggleMobileMenu() {
  const nav = document.getElementById('mobNav');
  const btn = document.getElementById('hamBtn');
  nav.classList.toggle('open');
  btn.classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('mobNav')?.classList.remove('open');
  document.getElementById('hamBtn')?.classList.remove('open');
}

/* Mobile sidebar toggle */
function toggleMobileSidebar() {
  document.getElementById('sidebar')?.classList.toggle('mob-open');
}


/* ──────────────────────────────────────────────
   LOCATE ME + SWAP
────────────────────────────────────────────── */
function swapLocations() {
  const a = document.getElementById('originInput'), b = document.getElementById('destInput');
  [a.value, b.value] = [b.value, a.value];
}
function locateMe() {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  showToast('📍 Getting your location…');
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const d = await r.json();
      document.getElementById('originInput').value = d.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(5)},${lon.toFixed(5)}`;
    } catch { document.getElementById('originInput').value = `${lat.toFixed(5)},${lon.toFixed(5)}`; }
    map.setView([lat, lon], 15); showToast('✅ Location set! Enter your destination.');
  }, () => showToast('❌ Location access denied. Use Live Server.'));
}


/* ──────────────────────────────────────────────
   EMERGENCY + SOS  (real contact logic)
────────────────────────────────────────────── */

// renderMobileSafeWalk — no-op, handled by drawer
function renderMobileSafeWalk() {}

// Render sidebar emergency contacts with real call links
function renderEmergencyContacts() {
  if (!safetyData) return;
  const c = document.getElementById('emergencyContacts'); c.innerHTML = '';
  safetyData.emergencyContacts.forEach(ct => {
    const d = document.createElement('div'); d.className = 'ec-item';
    d.innerHTML = `
      <span class="ec-name">${ct.icon} ${ct.name}</span>
      <a href="tel:${ct.number}" class="ec-call" onclick="showToast('📞 Calling ${ct.name}…')">
        📞 ${ct.number}
      </a>`;
    c.appendChild(d);
  });
}

// Main SOS trigger — geolocate then build all action links
function triggerSOS() {
  document.getElementById('sosTime').textContent = new Date().toLocaleTimeString();
  openModal('sosModal');                // open immediately, don't wait for GPS

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        const locText = `${lat}, ${lng}`;
        document.getElementById('sosLocation').textContent = locText;
        buildSOSLinks(lat, lng, locText);
      },
      () => {
        document.getElementById('sosLocation').textContent = 'Location unavailable — allow location access';
        buildSOSLinks(null, null, '(location unavailable)');
      },
      { timeout: 6000, maximumAge: 30000 }
    );
  } else {
    document.getElementById('sosLocation').textContent = 'Geolocation not supported in this browser';
    buildSOSLinks(null, null, '(location not available)');
  }
}

// Build all real-contact links once we have (or don't have) coordinates
function buildSOSLinks(lat, lng, locText) {
  const now  = new Date().toLocaleTimeString();
  const mapsUrl = lat
    ? `https://maps.google.com/?q=${lat},${lng}`
    : 'https://maps.google.com/';

  // Maps link
  const mapsLink = document.getElementById('sosMapsLink');
  if (mapsLink) { mapsLink.href = mapsUrl; mapsLink.textContent = lat ? `${lat}, ${lng}` : 'Open Maps'; }

  // SOS message text
  const sosMsg = trustedContact
    ? `🆘 EMERGENCY — I need help! I am ${trustedContact.name}'s contact.\nMy location: ${locText}\nTime: ${now}\nGoogle Maps: ${mapsUrl}\n\nPlease contact emergency services: 100 (Police), 1091 (Women Helpline), 102 (Ambulance)`
    : `🆘 EMERGENCY — I need help!\nMy location: ${locText}\nTime: ${now}\nGoogle Maps: ${mapsUrl}\n\nPlease contact: 100 (Police), 1091 (Women Helpline), 102 (Ambulance)`;

  // WhatsApp share (works without saving contact — opens wa.me link)
  const waText = encodeURIComponent(sosMsg);
  const waShare = document.getElementById('sosWhatsAppShare');
  if (waShare) waShare.href = `https://wa.me/?text=${waText}`;

  // SMS share (pre-fills default SMS app with message)
  const smsShare = document.getElementById('sosSMSShare');
  if (smsShare) smsShare.href = `sms:?body=${waText}`;

  // Trusted contact section
  const tcDiv = document.getElementById('sosTrustedActions');
  if (!tcDiv) return;
  tcDiv.innerHTML = '';

  if (!trustedContact) {
    tcDiv.innerHTML = `
      <div class="sos-trusted-no-contact">
        No trusted contact saved yet.<br>
        <strong>Go to Emergency tab → save a contact</strong><br>
        to enable WhatsApp/SMS/Call alerts.
      </div>`;
    return;
  }

  // Clean phone: remove spaces/dashes, add + if missing country code
  const rawPhone = trustedContact.phone.replace(/[\s\-().]/g, '');
  const e164     = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone}`; // default India code
  const tcMsg    = encodeURIComponent(
    `🆘 EMERGENCY from ${trustedContact.name}!\nI need help — please call me or contact emergency services.\nMy location: ${locText}\nTime: ${now}\nMaps: ${mapsUrl}`
  );

  tcDiv.innerHTML = `
    <a href="https://wa.me/${e164.replace('+','')}?text=${tcMsg}" target="_blank" class="sos-tc-btn wa" onclick="showToast('💬 Opening WhatsApp…')">
      <span class="sos-tc-btn-icon">💬</span>
      <span class="sos-tc-btn-body"><strong>WhatsApp ${trustedContact.name}</strong><small>Sends location + SOS message</small></span>
    </a>
    <a href="tel:${rawPhone}" class="sos-tc-btn call" onclick="showToast('📞 Calling ${trustedContact.name}…')">
      <span class="sos-tc-btn-icon">📞</span>
      <span class="sos-tc-btn-body"><strong>Call ${trustedContact.name}</strong><small>Direct phone call</small></span>
    </a>
    <a href="sms:${rawPhone}?body=${tcMsg}" class="sos-tc-btn sms" onclick="showToast('✉️ Opening SMS…')">
      <span class="sos-tc-btn-icon">✉️</span>
      <span class="sos-tc-btn-body"><strong>SMS ${trustedContact.name}</strong><small>Pre-filled emergency message</small></span>
    </a>`;
}

// Log which service was contacted
function logSOSAction(service) {
  showToast(`📞 Calling ${service}…`);
}

// Copy full SOS message to clipboard
function copyEmergencyMsg() {
  const loc  = document.getElementById('sosLocation')?.textContent || 'unknown';
  const time = document.getElementById('sosTime')?.textContent || new Date().toLocaleTimeString();
  const msg  = `🆘 EMERGENCY — I need help!\nLocation: ${loc}\nTime: ${time}\nPlease contact emergency services immediately:\n📞 Police: 100\n📞 Women Helpline: 1091\n📞 Ambulance: 102`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(msg).then(() => showToast('📋 SOS message copied! Paste it anywhere.'));
  } else {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = msg; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 SOS message copied!');
  }
}

function saveTrustedContact() {
  const n = document.getElementById('trustedName').value.trim();
  const p = document.getElementById('trustedPhone').value.trim();
  if (!n) { showToast('⚠️ Enter a contact name'); return; }
  if (!p) { showToast('⚠️ Enter a phone number'); return; }
  if (!/[0-9+]/.test(p)) { showToast('⚠️ Enter a valid phone number'); return; }
  trustedContact = { name: n, phone: p };
  localStorage.setItem('sf_trusted', JSON.stringify(trustedContact));
  renderSavedContact();
  updateTrustedQuickActions();
  showToast(`✅ ${n} saved! They'll receive WhatsApp/SMS/call alerts in an emergency.`);
}

function renderSavedContact() {
  const el = document.getElementById('savedContact');
  if (el && trustedContact) {
    el.innerHTML = `✅ <strong>${trustedContact.name}</strong> — ${trustedContact.phone}`;
  }
}

// Update quick-action links in sidebar after saving contact
function updateTrustedQuickActions() {
  if (!trustedContact) return;
  const wrap = document.getElementById('trustedQuickActions');
  if (!wrap) return;
  wrap.style.display = 'flex';

  const raw  = trustedContact.phone.replace(/[\s\-().]/g, '');
  const e164 = raw.startsWith('+') ? raw : `+91${raw}`;
  const msg  = encodeURIComponent(`🆘 SOS from ${trustedContact.name}! I need help. Please check on me or call emergency services.`);

  const wa   = document.getElementById('tcWhatsApp');
  const call = document.getElementById('tcCall');
  const sms  = document.getElementById('tcSMS');
  if (wa)   wa.href   = `https://wa.me/${e164.replace('+','')}?text=${msg}`;
  if (call) call.href = `tel:${raw}`;
  if (sms)  sms.href  = `sms:${raw}?body=${msg}`;
}


/* ──────────────────────────────────────────────
   MOBILE UI — bottom nav, drawer, pill search
────────────────────────────────────────────── */

const isMobile = () => window.innerWidth <= 600;

/* ── Mobile tab switching (bottom nav) ── */
function switchMobTab(tab, btn) {
  if (!isMobile()) return;
  closeMobDrawer();
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelectorAll('.mob-nav-item').forEach(b => b.classList.toggle('active', b.dataset && b.dataset.tab === tab));
  if (tab === 'analytics') setTimeout(renderAnalytics, 50);
}

/* ── Drawer ── */
let drawerOpen = false;
function toggleMobDrawer() { drawerOpen ? closeMobDrawer() : openMobDrawer(); }
function openMobDrawer() {
  drawerOpen = true;
  document.getElementById('mobDrawer')?.classList.add('open');
  // ensure map tab is visible behind drawer
  if (isMobile()) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-map')?.classList.add('active');
    document.querySelectorAll('.mob-nav-item').forEach(b => b.classList.toggle('active', b.dataset && b.dataset.tab === 'map'));
  }
}
function closeMobDrawer() {
  drawerOpen = false;
  document.getElementById('mobDrawer')?.classList.remove('open');
}

/* ── Drawer tab switch ── */
function switchMobDrawer(panel, btn) {
  document.querySelectorAll('.mob-dpanel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.mob-dtab').forEach(b => b.classList.remove('active'));
  document.getElementById('mdp-' + panel)?.classList.add('active');
  if (btn) btn.classList.add('active');
  else {
    const idx = ['routes','safety','emergency'].indexOf(panel);
    document.querySelectorAll('.mob-dtab')[idx]?.classList.add('active');
  }
}

/* ── Drawer swipe to close ── */
function setupDrawerSwipe() {
  const drawer = document.getElementById('mobDrawer'); if (!drawer) return;
  let startY = 0;
  drawer.addEventListener('touchstart', e => {
    if (e.target.closest('.mob-drawer-handle') || e.target.closest('.mob-drawer-tabs'))
      startY = e.touches[0].clientY;
  }, { passive: true });
  drawer.addEventListener('touchend', e => {
    const delta = e.changedTouches[0].clientY - startY;
    if (delta > 60) closeMobDrawer();
  }, { passive: true });
}

/* ── Mobile search pill inputs ── */
function mobSyncOrigin(val) {
  const d = document.getElementById('originInput'); if (d) d.value = val;
  mobRunAC(val, 'mobOrigin', 'mobOriginDrop', 'originInput');
}
function mobSyncDest(val) {
  const d = document.getElementById('destInput'); if (d) d.value = val;
  mobRunAC(val, 'mobDest', 'mobDestDrop', 'destInput');
}
function findRoutesMob() {
  // Sync mobile pill values → desktop hidden inputs → call findRoutes
  const o = document.getElementById('mobOrigin')?.value.trim();
  const d = document.getElementById('mobDest')?.value.trim();
  if (o) { const el = document.getElementById('originInput'); if (el) el.value = o; }
  if (d) { const el = document.getElementById('destInput');   if (el) el.value = d; }
  // Blur inputs to dismiss keyboard
  document.getElementById('mobOrigin')?.blur();
  document.getElementById('mobDest')?.blur();
  findRoutes();
}

let _mobACTimers = {};
function mobRunAC(q, inputId, dropId, syncId) {
  const drop = document.getElementById(dropId); if (!drop) return;
  clearTimeout(_mobACTimers[dropId]);
  if (q.length < 3) { drop.classList.remove('open'); return; }
  _mobACTimers[dropId] = setTimeout(async () => {
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(q) + '&format=json&limit=4', { headers: { 'Accept-Language': 'en' } });
      const data = await r.json();
      drop.innerHTML = '';
      if (!data.length) { drop.classList.remove('open'); return; }
      data.forEach(item => {
        const label = item.display_name.split(',').slice(0, 3).join(', ');
        const div = document.createElement('div'); div.className = 'ac-item';
        div.textContent = label;
        div.addEventListener('mousedown', e => {
          e.preventDefault();
          document.getElementById(inputId).value = label;
          const sync = document.getElementById(syncId); if (sync) sync.value = label;
          drop.classList.remove('open');
        });
        drop.appendChild(div);
      });
      drop.classList.add('open');
    } catch {}
  }, 350);
}

/* ── Mobile route cards in drawer ── */
function renderMobRouteCards(routes) {
  const c = document.getElementById('mobRouteCards'); if (!c) return;
  const countEl = document.getElementById('mobRouteCount');
  if (countEl) countEl.textContent = routes.length + ' routes';
  c.innerHTML = '';
  routes.forEach((r, i) => {
    const score = r.safetyScore ?? r.score ?? 50;
    const cls   = getScoreClass(score);
    const cols  = { safe: '#22c55e', warn: '#f59e0b', danger: '#ef4444' };
    const card  = document.createElement('div');
    card.className = 'route-card ' + cls + '-c';
    card.innerHTML =
      '<div class="rc-top">' +
        '<div class="rc-name">' + r.name + '</div>' +
        '<div class="rc-score ' + cls + '">' + score + '</div>' +
      '</div>' +
      '<div class="rc-meta">' +
        '<span class="rc-mi">📏 ' + (r.distance || r.dist || '') + '</span>' +
        '<span class="rc-mi">⏱ '  + (r.duration  || r.dur  || '') + '</span>' +
      '</div>' +
      '<div class="rc-footer">' +
        (i === 0 ? '<span class="best-badge">✓ Best</span>' : '<span></span>') +
        '<span style="font-size:.68rem;color:' + cols[cls] + '">' + getScoreLabel(score) + '</span>' +
      '</div>';
    card.addEventListener('click', () => {
      document.querySelectorAll('.route-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      if (r.safetyScore !== undefined && r.id) {
        selectDemoRoute(r.id);
      } else {
        const poly = liveRouteLayers.find(l => l._liveId === r.id);
        if (poly) map.fitBounds(poly.getBounds(), { padding: [40, 40] });
      }
      const light = r.lighting || r.lighting || 'Moderate';
      const crowd = r.crowdDensity || r.crowd || 'Medium';
      const crime = r.crimeLevel  || r.crime || 'Medium';
      updateMobMeters(score, light, crowd, crime);
    });
    c.appendChild(card);
  });
}

/* ── Mobile safety meters ── */
function updateMobMeters(score, lighting, crowd, crime) {
  const lm = { Good: 85, Moderate: 55, Poor: 20 };
  const cm = { High: 80, Medium: 50, Low: 25 };
  const rm = { Low: 15, Medium: 45, High: 80 };
  const lv = lm[lighting] || 50, cv = cm[crowd] || 50, rv = rm[crime] || 50;
  const setM = (fId, vId, pct, cls) => {
    const f = document.getElementById(fId); if (f) { f.style.width = pct + '%'; f.className = 'mf ' + cls; }
    const v = document.getElementById(vId); if (v) v.textContent = pct + '%';
  };
  setM('mob-lightFill', 'mob-lightVal', lv, 'good');
  setM('mob-crowdFill', 'mob-crowdVal', cv, 'medium');
  setM('mob-crimeFill', 'mob-crimeVal', rv, 'danger');
  const sc  = document.getElementById('mob-overallScore'); if (sc) sc.textContent = score;
  const arc = document.getElementById('mob-scoreArc');
  if (arc) { arc.style.strokeDashoffset = 201 - (score / 100) * 201; arc.style.stroke = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'; }
  const sd = document.getElementById('mob-scoreDesc');
  if (sd) sd.textContent = score >= 75 ? 'Safe' : score >= 50 ? 'Moderate' : 'High Risk';
}

/* ── Mobile emergency contacts ── */
function renderMobEmergencyContacts() {
  if (!safetyData) return;
  const c = document.getElementById('mobEmergencyContacts'); if (!c) return;
  c.innerHTML = '';
  safetyData.emergencyContacts.forEach(ct => {
    const d = document.createElement('div'); d.className = 'ec-item';
    d.innerHTML = '<span class="ec-name">' + ct.icon + ' ' + ct.name + '</span>' +
      '<a href="tel:' + ct.number + '" class="ec-call">📞 ' + ct.number + '</a>';
    c.appendChild(d);
  });
}

/* ── Mobile trusted contact ── */
function saveTrustedContactMob() {
  const n = document.getElementById('trustedNameMob')?.value.trim();
  const p = document.getElementById('trustedPhoneMob')?.value.trim();
  const nd = document.getElementById('trustedName');  if (nd) nd.value = n || '';
  const pd = document.getElementById('trustedPhone'); if (pd) pd.value = p || '';
  saveTrustedContact();
  const sd = document.getElementById('savedContactMob');
  if (sd && trustedContact) sd.innerHTML = '✅ <strong>' + trustedContact.name + '</strong> — ' + trustedContact.phone;
  updateMobTrustedActions();
}
function updateMobTrustedActions() {
  if (!trustedContact) return;
  const wrap = document.getElementById('trustedQuickMob'); if (!wrap) return;
  wrap.style.display = 'flex';
  const raw  = trustedContact.phone.replace(/[^0-9+]/g, '');
  const e164 = raw.startsWith('+') ? raw : '+91' + raw;
  const msg  = encodeURIComponent('🆘 SOS from ' + trustedContact.name + '! I need help. Please check on me or call emergency services.');
  wrap.innerHTML =
    '<a href="https://wa.me/' + e164.replace('+','') + '?text=' + msg + '" target="_blank" class="tc-action-btn wa">💬 WhatsApp Alert</a>' +
    '<a href="tel:' + raw + '" class="tc-action-btn call">📞 Call ' + trustedContact.name + '</a>';
}

/* ── Safe Walk: mobile version ── */
function startSafeWalkMob() {
  const mobSel  = document.getElementById('swMinutesMob');
  const deskSel = document.getElementById('swMinutes');
  if (mobSel && deskSel) deskSel.value = mobSel.value;
  const mobActive = document.getElementById('mobSwActive');
  if (mobActive) mobActive.style.display = 'flex';
  startSafeWalk();
}

/* ── AI chat: mobile body-scroll lock + swipe close ── */
function setupMobileSwipeClose() {
  if (!isMobile()) return;
  const panel = document.getElementById('aiChatPanel'); if (!panel) return;
  let startY = 0, dragging = false;
  panel.addEventListener('touchstart', e => {
    if (e.target.closest('.ai-hdr')) { startY = e.touches[0].clientY; dragging = true; }
  }, { passive: true });
  panel.addEventListener('touchmove', e => {
    if (!dragging) return;
    const d = e.touches[0].clientY - startY;
    if (d > 0) panel.style.transform = 'translateY(' + d + 'px)';
  }, { passive: true });
  panel.addEventListener('touchend', e => {
    if (!dragging) return; dragging = false;
    const d = e.changedTouches[0].clientY - startY;
    panel.style.transform = '';
    if (d > 80) toggleAIChat();
  }, { passive: true });
}

/* ──────────────────────────────────────────────
   MODAL HELPERS
────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }


/* ──────────────────────────────────────────────
   TOAST
────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}


/* ──────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────── */
const getScoreClass = s => s >= 70 ? 'safe' : s >= 45 ? 'warn' : 'danger';
const getScoreLabel = s => s >= 70 ? 'Safe' : s >= 45 ? 'Moderate' : 'High Risk';


/* ──────────────────────────────────────────────
   FALLBACK DATA
────────────────────────────────────────────── */
function getFallbackData() {
  return {
    safeZones: [
      { id:'sz1', name:'Park Street Metro',     lat:22.5513, lng:88.3512, type:'metro',   description:'Well-lit metro, high foot traffic' },
      { id:'sz2', name:'Central Hospital',      lat:22.5726, lng:88.3639, type:'hospital',description:'24/7 emergency services' },
      { id:'sz3', name:'New Market Police Post',lat:22.5643, lng:88.3505, type:'police',  description:'Active police presence' },
      { id:'sz4', name:'Esplanade Metro',        lat:22.5598, lng:88.3514, type:'metro',   description:'Busy transit hub' },
      { id:'sz5', name:'Sealdah Station',        lat:22.5652, lng:88.3700, type:'transit', description:'Patrolled railway station' },
    ],
    crimeZones: [
      { id:'cz1', lat:22.5480, lng:88.3450, radius:300, severity:'high',   description:'Incidents reported after 9 PM' },
      { id:'cz2', lat:22.5700, lng:88.3750, radius:250, severity:'medium', description:'Pickpocketing reported' },
      { id:'cz3', lat:22.5550, lng:88.3680, radius:350, severity:'high',   description:'Poorly lit, avoid at night' },
    ],
    lightingZones: [
      { id:'lz1', lat:22.5530, lng:88.3490, radius:200, level:'poor', description:'Street lights non-functional' },
      { id:'lz2', lat:22.5610, lng:88.3620, radius:150, level:'poor', description:'Under-lit alley' },
    ],
    routes: [
      { id:'route1', name:'Safe Route via Park Street', safetyScore:88, distance:'3.2 km', duration:'12 min', lighting:'Good',     crowdDensity:'High',   crimeLevel:'Low',
        waypoints:[[22.5726,88.3639],[22.5650,88.3600],[22.5598,88.3514],[22.5513,88.3512]], color:'#22c55e',
        highlights:['Well-lit main road','High footfall','CCTV covered','Near police post'] },
      { id:'route2', name:'Moderate Route via Sealdah', safetyScore:62, distance:'2.8 km', duration:'10 min', lighting:'Moderate', crowdDensity:'Medium', crimeLevel:'Medium',
        waypoints:[[22.5726,88.3639],[22.5690,88.3690],[22.5652,88.3700],[22.5600,88.3650],[22.5513,88.3512]], color:'#f59e0b',
        highlights:['Passes through Sealdah','Some dark stretches','Moderate crowd'] },
      { id:'route3', name:'Fast Route (Avoid at Night)', safetyScore:31, distance:'2.1 km', duration:'8 min',  lighting:'Poor',     crowdDensity:'Low',    crimeLevel:'High',
        waypoints:[[22.5726,88.3639],[22.5640,88.3580],[22.5560,88.3530],[22.5513,88.3512]], color:'#ef4444',
        highlights:['Poorly lit streets','Low foot traffic','Avoid after 8 PM'] },
    ],
    emergencyContacts: [
      { name:'Women Helpline', number:'1091', icon:'🆘' },
      { name:'Police',         number:'100',  icon:'🚔' },
      { name:'Ambulance',      number:'102',  icon:'🚑' },
    ]
  };
}
