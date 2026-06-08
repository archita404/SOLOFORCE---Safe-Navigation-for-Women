# SoloForce — Safe Navigation Platform for Women
> "One Woman. Infinite Power." — Elite Her Hackathon

---

## 📁 Project Structure

```
soloforce/
├── index.html      ← Main app (open this in browser)
├── style.css       ← All styles (dark purple theme)
├── app.js          ← Map logic, route scoring, emergency features
├── data.json       ← Mock safety data (crime zones, safe zones, routes)
└── README.md       ← This file
```

---

## 🚀 How to Run

### Option 1 — VS Code Live Server (Recommended)
1. Open the `soloforce/` folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**
4. App opens at `http://127.0.0.1:5500`

### Option 2 — Direct Browser (Limited)
> ⚠️ Opening `index.html` directly via `file://` may block the `data.json` fetch in Chrome due to CORS.
> The app includes a built-in fallback — it still works with demo data.
> Use Live Server for full functionality.

### Option 3 — Python HTTP Server
```bash
cd soloforce
python -m http.server 8080
# Open: http://localhost:8080
```

---

## 🗺️ Features

| Feature | Description |
|---|---|
| Interactive Leaflet Map | Dark-themed map centered on Kolkata |
| 3 Color-coded Routes | Green (safe), Yellow (moderate), Red (unsafe) |
| Safety Score | Per-route score (0–100) based on lighting, crowd, crime |
| Safe Zone Markers | Metro, hospital, police post markers |
| Crime Zone Overlays | Color-coded circles (high/medium/low severity) |
| Poor Lighting Zones | Yellow circles showing dim areas |
| Day / Night Toggle | Night mode amplifies danger zone visibility |
| Emergency SOS Button | Opens alert with geolocation + helpline numbers |
| Trusted Contact | Save a contact; notified on SOS |
| Layer Toggles | Show/hide each map layer independently |
| Responsive Design | Works on mobile and desktop |

---

## 🎨 Customization

### Change the city / map center
In `app.js`, find:
```js
map = L.map('map', { center: [22.5620, 88.3580], zoom: 14, ... });
```
Replace with your city's coordinates.

### Add more safe zones / crime zones
Edit `data.json` — add entries to `safeZones`, `crimeZones`, or `lightingZones`.

### Add more routes
Add a new object to the `routes` array in `data.json`.
- `waypoints`: array of `[lat, lng]` pairs
- `safetyScore`: 0–100
- `color`: `"#22c55e"` (safe), `"#f59e0b"` (moderate), `"#ef4444"` (danger)

---

## 🌐 Tech Stack
- **HTML5 / CSS3 / Vanilla JS**
- **Leaflet.js 1.9.4** (map rendering)
- **CartoDBDark** tile layer (no API key needed)
- **Google Fonts** — Syne + DM Sans

---

## 📞 Emergency Numbers (India)
| Service | Number |
|---|---|
| Women Helpline | 1091 |
| Police | 100 |
| Ambulance | 102 |

---

Built for **Elite Her Hackathon** by **Archita Singha**
