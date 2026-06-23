# SoloForce — Safe Navigation Platform for Women
> "One Woman. Infinite Power." — Elite Her Hackathon

🔗 **Live app:** https://soloforce-safe-navigation-for-women.netlify.app/

---

## 📁 Project Structure

```
soloforce/
├── index.html              ← Main app (open this in browser)
├── style.css                ← All styles (dark purple theme, light mode included)
├── app.js                    ← Map logic, routing, safety scoring, SOS, reports, AI chat client
├── data.json                  ← Demo safety dataset (Kolkata) — crime/lighting zones, sample routes
├── manifest.json              ← PWA manifest (installable home-screen app)
├── sw.js                      ← Service worker (offline caching)
├── netlify.toml                ← Netlify build & redirect config
├── netlify/functions/chat.js    ← Serverless function — proxies AI chat requests to Anthropic (keeps API key server-side)
└── README.md                    ← This file
```

> ⚠️ `chat.js` must live at `netlify/functions/chat.js` (not the project root) for Netlify to detect it as a serverless function.

---

## 🗺️ Features

| Feature | Description |
|---|---|
| Interactive Leaflet map | Dark/light themed, auto-centers on the user's real GPS location |
| Real route calculation | Live routing via OSRM + Nominatim geocoding (not pre-set paths) |
| Dynamic safety scoring | Per-route score (0–100) calculated from real distance to crime/lighting/safe zones, time of day |
| Real safe-zone markers | Police, hospital & transit locations pulled live from OpenStreetMap (Overpass API) |
| Demo crime/lighting overlay | Curated sample data for Kolkata; only shown when map is near that region, so it isn't mistaken for real local data elsewhere |
| Heatmap layer | Toggle to a smooth danger-intensity gradient instead of separate zone circles |
| Route preview animation | Animates a dot along a route before you start walking |
| Real-time live tracking | Your live position moves on the map as you walk |
| Day / Night toggle | Switches map tiles and amplifies danger-zone visibility at night |
| Emergency SOS | One tap → live GPS location shared via WhatsApp, SMS, or direct call to emergency numbers |
| Multiple trusted contacts | Save several contacts; each notified via WhatsApp/SMS on SOS |
| Shake-to-SOS | 3 sharp phone shakes silently triggers SOS (uses the DeviceMotion API; requires motion permission on iOS) |
| Safe Walk Timer | Set a check-in timer; auto-fires SOS if you don't confirm you're safe in time |
| Community incident reports | Pin unsafe areas on the map with type, severity & description; synced live across devices via Firebase Firestore (falls back to local storage if Firebase isn't configured) |
| Safety analytics dashboard | Weekly trends, incident breakdown, safety-by-hour chart from community report data |
| AI safety companion (SafeGuide) | Real-time safety advice via Claude, through a Netlify serverless function — requires `ANTHROPIC_API_KEY` |
| Multilingual UI | English, Hindi, Bengali, Tamil |
| "Book a Safe Cab" | One-tap deep link to book a ride to your destination |
| Installable PWA | Add to home screen, works offline via service worker caching |
| Layer toggles | Show/hide safe zones, crime zones, lighting, reports, and heatmap independently |
| Responsive design | Works on mobile and desktop |

---

## 🎨 Customization

### Map center
The map auto-centers on the user's real geolocation on load (with a Kolkata fallback if location is denied/unavailable). No hardcoded city to edit for this anymore.

### Demo data region
`data.json` includes a `demoRegionCenter` field — the crime/lighting overlays and sample routes are only shown when the map is within ~50km of that point. To re-target the demo data to a different city, update `demoRegionCenter` and the `safeZones`/`crimeZones`/`lightingZones`/`routes` coordinates in `data.json`.

### Add more safe zones / crime zones
Edit `data.json` — add entries to `safeZones`, `crimeZones`, or `lightingZones`.

### Add more demo routes
Add a new object to the `routes` array in `data.json`:
- `waypoints`: array of `[lat, lng]` pairs
- `safetyScore`: 0–100
- `color`: `"#22c55e"` (safe), `"#f59e0b"` (moderate), `"#ef4444"` (danger)

### Add a language
Add a new locale object to `TRANSLATIONS` in `app.js`, matching the keys used in the `en` block.

---

## 🌐 Tech Stack
- **HTML5 / CSS3 / Vanilla JS** — no framework, no build step
- **Leaflet.js 1.9.4** — map rendering, with `leaflet.heat` for the heatmap layer
- **CartoDB** dark/light tile layers (no API key needed)
- **OSRM + Nominatim** — real route calculation & geocoding
- **OpenStreetMap Overpass API** — live police/hospital/transit data
- **Firebase Firestore** — persistent, cross-device community reports
- **Netlify Functions + Anthropic API** — server-side AI chat (SafeGuide)
- **Google Fonts** — Syne + DM Sans
- Deployed on **Netlify**

---

## 📞 Emergency Numbers (India)
| Service | Number |
|---|---|
| Women Helpline | 1091 |
| Police | 100 |
| Ambulance | 102 |

---

Built by **Archita Singha**

