// WX · COMPARE — Client Telemetry & High-DPI Range-Area Chart Engine

const SLOT_COLORS = [
  { hex: "#0a84ff", lightHex: "#007aff", rgb: "10, 132, 255", name: "Blue" },
  { hex: "#ff9f0a", lightHex: "#ea8000", rgb: "255, 159, 10", name: "Amber" },
  { hex: "#30d158", lightHex: "#1f9d45", rgb: "48, 209, 88", name: "Mint" },
];

// WMO 4677 Synoptic Weather Code Table (Strict Meteorological Abbreviations, Zero Lifestyle Prose)
const WMO_SYNOPTIC = {
  0: { abbr: "SKC", desc: "Clear" },
  1: { abbr: "FEW", desc: "Mainly Clear" },
  2: { abbr: "SCT", desc: "Scattered" },
  3: { abbr: "OVC", desc: "Overcast" },
  45: { abbr: "FG", desc: "Fog" },
  48: { abbr: "FZFG", desc: "Rime Fog" },
  51: { abbr: "DZ-", desc: "Light Drizzle" },
  53: { abbr: "DZ", desc: "Mod Drizzle" },
  55: { abbr: "DZ+", desc: "Dense Drizzle" },
  56: { abbr: "FZDZ-", desc: "Frz Drizzle" },
  57: { abbr: "FZDZ+", desc: "Hvy Frz Drizzle" },
  61: { abbr: "RA-", desc: "Light Rain" },
  63: { abbr: "RA", desc: "Mod Rain" },
  65: { abbr: "RA+", desc: "Heavy Rain" },
  66: { abbr: "FZRA-", desc: "Light Frz Rain" },
  67: { abbr: "FZRA+", desc: "Heavy Frz Rain" },
  71: { abbr: "SN-", desc: "Light Snow" },
  73: { abbr: "SN", desc: "Mod Snow" },
  75: { abbr: "SN+", desc: "Heavy Snow" },
  77: { abbr: "SG", desc: "Snow Grains" },
  80: { abbr: "SHRA-", desc: "Rain Showers" },
  81: { abbr: "SHRA", desc: "Mod Showers" },
  82: { abbr: "SHRA+", desc: "Violent Showers" },
  85: { abbr: "SHSN-", desc: "Snow Showers" },
  86: { abbr: "SHSN+", desc: "Hvy Snow Showers" },
  95: { abbr: "TS", desc: "Thunderstorm" },
  96: { abbr: "TSGR", desc: "TS + Hail" },
  99: { abbr: "TSGR+", desc: "TS + Hvy Hail" },
};

function getWmoInfo(code) {
  return WMO_SYNOPTIC[code] || { abbr: `W${code}`, desc: `Code ${code}` };
}

function degToCardinal(deg) {
  if (deg === null || deg === undefined || !Number.isFinite(deg)) return "---";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}

function shortCode(city) {
  if (!city) return "---";
  if (city.icao && city.icao.length === 4) return city.icao;
  return city.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

function formatCoord(lat, lon) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function formatDurationHm(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, "0")}m`;
}

function formatLocalClock(utcOffsetSeconds) {
  const nowMs = Date.now();
  const localDate = new Date(nowMs + utcOffsetSeconds * 1000);
  const hh = String(localDate.getUTCHours()).padStart(2, "0");
  const mm = String(localDate.getUTCMinutes()).padStart(2, "0");
  const sign = utcOffsetSeconds >= 0 ? "+" : "-";
  const offH = Math.floor(Math.abs(utcOffsetSeconds) / 3600);
  return `${hh}:${mm} (UTC${sign}${offH})`;
}

// Application State
const state = {
  theme: localStorage.getItem("wx_theme") || "dark",
  units: localStorage.getItem("wx_units") || "metric", // 'metric' | 'imperial'
  showDelta: true,
  refIdx: 0, // Index of reference city for Δ calculations
  soloIdx: null, // null or 0|1|2 to isolate on chart
  chartMode: "range", // 'range' | 'diurnal' | 'psychro' | 'wind'
  horizonDays: 10, // 7 | 10 | 14
  diurnalAlign: "lst", // 'lst' | 'utc'
  scrubIdx: 0, // Currently scrubbed point index on chart
  lockedDayIdx: null, // null = LIVE NOW, number = Day index 0..13 for telemetry inspector
  mapView: "global", // 'global' | 'focus'
  solarOffsetMin: 0, // minutes offset from real-time UTC (-720..+720)
  worldData: null, // { land: [...], borders: [...] }
  mapHitTargets: [], // Interactive station click targets on map canvas
  curatedCities: [],
  presets: [],
  selectedLocations: [], // Max 3 CityLocation objects
  weatherData: [], // CityWeatherPayload[] matching selectedLocations
  loading: false,
  replaceSlotIdx: null, // When opening modal to replace a specific slot
};

// Unit conversion helpers
const conv = {
  temp(c) {
    if (c === null || c === undefined || !Number.isFinite(c)) return null;
    return state.units === "imperial" ? Math.round(((c * 9) / 5 + 32) * 10) / 10 : Math.round(c * 10) / 10;
  },
  tempDelta(dc) {
    if (dc === null || dc === undefined || !Number.isFinite(dc)) return null;
    return state.units === "imperial" ? Math.round(((dc * 9) / 5) * 10) / 10 : Math.round(dc * 10) / 10;
  },
  tempUnit() {
    return state.units === "imperial" ? "°F" : "°C";
  },
  wind(kmh) {
    if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return null;
    // Metric: m/s (true synoptic standard!), Imperial: knots (kn)
    return state.units === "imperial"
      ? Math.round((kmh / 1.852) * 10) / 10
      : Math.round((kmh / 3.6) * 10) / 10;
  },
  windUnit() {
    return state.units === "imperial" ? "kn" : "m/s";
  },
  pressure(hpa) {
    if (hpa === null || hpa === undefined || !Number.isFinite(hpa)) return null;
    return state.units === "imperial"
      ? Math.round(hpa * 0.02953 * 100) / 100
      : Math.round(hpa * 10) / 10;
  },
  pressureUnit() {
    return state.units === "imperial" ? "inHg" : "hPa";
  },
  precip(mm) {
    if (mm === null || mm === undefined || !Number.isFinite(mm)) return null;
    return state.units === "imperial"
      ? Math.round((mm / 25.4) * 100) / 100
      : Math.round(mm * 10) / 10;
  },
  precipUnit() {
    return state.units === "imperial" ? "in" : "mm";
  },
  alt(m) {
    if (m === null || m === undefined || !Number.isFinite(m)) return null;
    return state.units === "imperial" ? Math.round(m * 3.28084) : Math.round(m);
  },
  altUnit() {
    return state.units === "imperial" ? "ft" : "m";
  },
};

function fmtSigned(val, decimals = 1, suffix = "") {
  if (val === null || val === undefined || !Number.isFinite(val)) return "--";
  const v = Number(val.toFixed(decimals));
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}${suffix}`;
}

// DOM Elements
const els = {
  utcClock: document.getElementById("utc-clock"),
  statusDot: document.getElementById("live-status-dot"),
  slotCounter: document.getElementById("slot-counter"),
  btnAddStation: document.getElementById("btn-add-station"),
  citySlotsGrid: document.getElementById("city-slots-grid"),
  btnDeltaToggle: document.getElementById("btn-delta-toggle"),
  unitSegmented: document.getElementById("unit-segmented"),
  btnThemeToggle: document.getElementById("btn-theme-toggle"),
  iconSun: document.getElementById("icon-sun"),
  iconMoon: document.getElementById("icon-moon"),
  // Map elements
  mapTimeBadge: document.getElementById("map-time-badge"),
  mapEphemerisStrip: document.getElementById("map-ephemeris-strip"),
  mapViewSegmented: document.getElementById("map-view-segmented"),
  btnMapLive: document.getElementById("btn-map-live"),
  mapCanvasStage: document.getElementById("map-canvas-stage"),
  mapCanvas: document.getElementById("wx-map-canvas"),
  solarTimeSlider: document.getElementById("solar-time-slider"),
  mapStationSolarRow: document.getElementById("map-station-solar-row"),
  // Chart elements
  chartModeSegmented: document.getElementById("chart-mode-segmented"),
  horizonSegmented: document.getElementById("horizon-segmented"),
  diurnalAlignSegmented: document.getElementById("diurnal-align-segmented"),
  scrubberReadout: document.getElementById("scrubber-readout"),
  chartLegendBar: document.getElementById("chart-legend-bar"),
  canvasStage: document.getElementById("canvas-stage"),
  canvas: document.getElementById("wx-chart-canvas"),
  chartFooterMetrics: document.getElementById("chart-footer-metrics"),
  dailyMatrixList: document.getElementById("daily-matrix-list"),
  btnResetDay: document.getElementById("btn-reset-day"),
  inspectorTimeBadge: document.getElementById("inspector-time-badge"),
  deltaModeIndicator: document.getElementById("delta-mode-indicator"),
  telemetryGroupsGrid: document.getElementById("telemetry-groups-grid"),
  // Modal elements
  stationModal: document.getElementById("station-modal"),
  btnOpenPresets: document.getElementById("btn-open-presets"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  searchInput: document.getElementById("station-search-input"),
  btnClearSearch: document.getElementById("btn-clear-search"),
  btnUseGps: document.getElementById("btn-use-gps"),
  sheetActiveBar: document.getElementById("sheet-active-bar"),
  presetChipsRow: document.getElementById("preset-chips-row"),
  searchResultsCaption: document.getElementById("search-results-caption"),
  sheetStationList: document.getElementById("sheet-station-list"),
};

// Initialize Theme & Clock
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("wx_theme", theme);
  const metaTheme = document.getElementById("meta-theme-color");
  if (metaTheme) metaTheme.setAttribute("content", theme === "dark" ? "#000000" : "#f2f2f7");
  els.iconSun.style.display = theme === "dark" ? "block" : "none";
  els.iconMoon.style.display = theme === "dark" ? "none" : "block";
  renderSynopticMap();
  renderChart();
}

function updateUtcClock() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  els.utcClock.textContent = `${hh}:${mm}:${ss}Z`;
}

// Fetch Presets, Vector World Map, and Initial Weather Data
async function initApp() {
  applyTheme(state.theme);
  updateUtcClock();
  setInterval(updateUtcClock, 1000);
  // Real-time solar terminator refresh every 30s when in LIVE mode
  setInterval(() => {
    if (state.solarOffsetMin === 0) {
      renderSynopticMap();
    }
  }, 30000);

  // Sync unit toggle UI
  els.unitSegmented.querySelectorAll(".seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.unit === state.units);
  });

  // Load vector world coastlines & presets in parallel
  try {
    const [presetRes, worldRes] = await Promise.all([
      fetch("/api/presets"),
      fetch("/world.json").catch(() => null),
    ]);
    const data = await presetRes.json();
    state.curatedCities = data.curated || [];
    state.presets = data.presets || [];
    if (worldRes && worldRes.ok) {
      state.worldData = await worldRes.json();
    }
  } catch (e) {
    console.error("Failed loading presets or world vectors", e);
  }

  // Restore saved cities or use default triad (Tokyo, San Francisco, Zurich)
  let saved = null;
  try {
    const raw = localStorage.getItem("wx_compare_cities_v1");
    if (raw) saved = JSON.parse(raw);
  } catch {}

  if (Array.isArray(saved) && saved.length > 0 && saved.length <= 3) {
    state.selectedLocations = saved;
  } else {
    state.selectedLocations = state.curatedCities.slice(0, 3);
  }

  bindEvents();
  renderSynopticMap();
  await refreshWeatherData();
}

function saveSelectedLocations() {
  try {
    localStorage.setItem("wx_compare_cities_v1", JSON.stringify(state.selectedLocations));
  } catch {}
}

async function refreshWeatherData() {
  if (state.selectedLocations.length === 0) {
    state.weatherData = [];
    renderAll();
    return;
  }

  state.loading = true;
  els.statusDot.classList.add("loading");

  try {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: state.selectedLocations.slice(0, 3) }),
    });
    const json = await res.json();
    if (Array.isArray(json.cities)) {
      state.weatherData = json.cities;
      if (state.refIdx >= state.weatherData.length) {
        state.refIdx = 0;
      }
      if (state.soloIdx !== null && state.soloIdx >= state.weatherData.length) {
        state.soloIdx = null;
      }
    }
  } catch (err) {
    console.error("Comparison fetch error:", err);
  } finally {
    state.loading = false;
    els.statusDot.classList.remove("loading");
    renderAll();
  }
}

function renderAll() {
  renderStationCards();
  renderSynopticMap();
  renderLegendBar();
  renderScrubberReadout();
  renderChart();
  renderChartFooterMetrics();
  renderDailyMatrix();
  renderTelemetryInspector();
  renderModalActiveBar();
}

// 1. Render Top Station Slot Cards (Max 3)
function renderStationCards() {
  const count = state.weatherData.length;
  els.slotCounter.textContent = `${count}/3`;
  els.btnAddStation.disabled = count >= 3;
  els.btnAddStation.textContent = count >= 3 ? "Swap Station" : "+ Station";
  els.btnAddStation.disabled = false;

  const refCity = state.weatherData[state.refIdx] || state.weatherData[0];
  const refTemp = refCity ? conv.temp(refCity.current.temp) : 0;

  let html = "";
  state.weatherData.forEach((city, idx) => {
    const loc = city.location;
    const cur = city.current;
    const d0 = city.daily[0] || {};
    const isRef = idx === state.refIdx;
    const wmo = getWmoInfo(cur.weather_code);
    const tNow = conv.temp(cur.temp);
    const tMax = conv.temp(d0.temp_max);
    const tMin = conv.temp(d0.temp_min);
    const tSpread = conv.tempDelta(d0.temp_range);
    const tdNow = conv.temp(cur.dew_point);

    let deltaBadge = "";
    if (state.showDelta && state.weatherData.length > 1) {
      if (isRef) {
        deltaBadge = `<span class="ref-badge">REF</span>`;
      } else {
        const diff = Math.round((tNow - refTemp) * 10) / 10;
        const cls = diff > 0 ? "pos" : diff < 0 ? "neg" : "";
        deltaBadge = `<span class="station-delta-pill ${cls}">${fmtSigned(diff, 1, "°")}</span>`;
      }
    }

    html += `
      <div class="station-card ${isRef ? "is-ref" : ""}"
           style="--slot-color: var(--city-${idx}); --slot-rgb: var(--city-${idx}-rgb)"
           data-slot-idx="${idx}">
        <div class="station-top-row">
          <div class="station-id-group">
            <div class="station-title-line">
              <span class="slot-dot"></span>
              <span class="station-name">${escapeHtml(loc.name)}</span>
              <span class="station-meta-line">${escapeHtml(loc.country_code)}</span>
            </div>
            <div class="station-meta-line">
              ${conv.alt(loc.elevation)}${conv.altUnit()} · ${formatLocalClock(city.utc_offset_seconds)}
            </div>
          </div>
          <div class="station-card-actions">
            <button type="button" class="card-mini-btn btn-swap-slot" data-idx="${idx}" title="Swap station">⇄</button>
            ${
              state.weatherData.length > 1
                ? `<button type="button" class="card-mini-btn btn-remove-slot" data-idx="${idx}" title="Remove station">×</button>`
                : ""
            }
          </div>
        </div>

        <div class="station-main-row">
          <div class="station-temp-cluster">
            <span class="station-big-temp mono">${tNow.toFixed(1)}°</span>
            ${deltaBadge}
          </div>
          <div class="station-wmo-tag" title="WMO Code ${cur.weather_code}: ${wmo.desc}">
            <span>${wmo.abbr}</span>
          </div>
        </div>

        <div class="station-sub-stats">
          <div class="sub-stat-item">
            <span class="sub-stat-label">H / L</span>
            <span class="sub-stat-val">${tMax.toFixed(0)}°/${tMin.toFixed(0)}°</span>
          </div>
          <div class="sub-stat-item">
            <span class="sub-stat-label">ΔT / Td</span>
            <span class="sub-stat-val">${tSpread.toFixed(1)}° / ${tdNow.toFixed(0)}°</span>
          </div>
          <div class="sub-stat-item">
            <span class="sub-stat-label">MSLP / VPD</span>
            <span class="sub-stat-val">${conv.pressure(cur.pressure_msl)} / ${cur.vpd.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  });

  // If fewer than 3 cities are selected, render an Add Slot card
  if (state.weatherData.length < 3) {
    html += `
      <button type="button" class="station-add-slot" id="card-add-slot">
        <span class="add-slot-plus">+</span>
        <span class="add-slot-label">Add Station (${state.weatherData.length}/3)</span>
      </button>
    `;
  }

  els.citySlotsGrid.innerHTML = html;

  // Bind click events on station cards
  els.citySlotsGrid.querySelectorAll(".station-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      const idx = Number(card.dataset.slotIdx);
      if (e.target.closest(".btn-remove-slot")) {
        e.stopPropagation();
        removeStationAt(idx);
        return;
      }
      if (e.target.closest(".btn-swap-slot")) {
        e.stopPropagation();
        openStationModal(idx);
        return;
      }
      state.refIdx = idx;
      renderAll();
    });
  });

  const addSlotBtn = document.getElementById("card-add-slot");
  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", () => openStationModal(null));
  }
}

function removeStationAt(idx) {
  if (state.selectedLocations.length <= 1) return;
  state.selectedLocations.splice(idx, 1);
  state.weatherData.splice(idx, 1);
  if (state.refIdx >= state.weatherData.length) state.refIdx = 0;
  if (state.soloIdx === idx) state.soloIdx = null;
  else if (state.soloIdx !== null && state.soloIdx > idx) state.soloIdx--;
  saveSelectedLocations();
  renderAll();
}

// 2. Render Chart Legend & Solo Filter Bar
function renderLegendBar() {
  let chipsHtml = "";
  state.weatherData.forEach((city, idx) => {
    const isSolo = state.soloIdx === idx;
    const isDimmed = state.soloIdx !== null && state.soloIdx !== idx;
    const code = shortCode(city.location);
    chipsHtml += `
      <button type="button"
              class="legend-chip ${isSolo ? "solo" : ""} ${isDimmed ? "dimmed" : ""}"
              style="--slot-color: var(--city-${idx}); --slot-rgb: var(--city-${idx}-rgb)"
              data-chip-idx="${idx}"
              title="Tap to isolate ${escapeHtml(city.location.name)} range band">
        <span class="legend-swatch"></span>
        <span>${escapeHtml(city.location.name)}</span>
        <span class="mono" style="opacity:0.65">${code}</span>
      </button>
    `;
  });

  let guideHtml = "";
  if (state.chartMode === "range") {
    guideHtml = `
      <span class="guide-item"><span class="guide-band-box"></span>T_max..T_min Band</span>
      <span class="guide-item"><span class="guide-line-solid"></span>High</span>
      <span class="guide-item"><span class="guide-line-dashed"></span>Low</span>
    `;
  } else if (state.chartMode === "diurnal") {
    guideHtml = `
      <span class="guide-item"><span class="guide-line-solid"></span>T2m Hourly</span>
      <span class="guide-item"><span class="guide-band-box"></span>T2m..Td Spread</span>
    `;
  } else if (state.chartMode === "psychro") {
    guideHtml = `
      <span class="guide-item"><span class="guide-band-box"></span>Td High..Low</span>
      <span class="guide-item"><span class="guide-line-dashed"></span>Wet-Bulb Tw</span>
    `;
  } else if (state.chartMode === "wind") {
    guideHtml = `
      <span class="guide-item"><span class="guide-band-box"></span>G10 Gust..V10 Band</span>
      <span class="guide-item"><span class="guide-line-dashed"></span>MSLP Trend</span>
    `;
  }

  els.chartLegendBar.innerHTML = `
    <div class="legend-city-chips">${chipsHtml}</div>
    <div class="legend-guide">${guideHtml}</div>
  `;

  els.chartLegendBar.querySelectorAll(".legend-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.chipIdx);
      state.soloIdx = state.soloIdx === idx ? null : idx;
      renderLegendBar();
      renderChart();
    });
  });

  // Show/hide horizon vs diurnal alignment selector depending on mode
  els.horizonSegmented.style.display = state.chartMode === "diurnal" ? "none" : "inline-flex";
  if (els.diurnalAlignSegmented) {
    els.diurnalAlignSegmented.style.display = state.chartMode === "diurnal" ? "inline-flex" : "none";
  }
}

function getHourlyOffset(city) {
  if (state.diurnalAlign !== "utc") return 0;
  // Offset index so all cities align to the current UTC hour
  const nowUtcHr = new Date().getUTCHours();
  const localHr = (((nowUtcHr + Math.round((city.utc_offset_seconds || 0) / 3600)) % 24) + 24) % 24;
  return localHr;
}

// 3. Render Live Scrubber Readout Header
function renderScrubberReadout() {
  if (!state.weatherData.length) return;
  const c0 = state.weatherData[0];

  if (state.chartMode === "diurnal") {
    const maxPts = 72;
    const idx = Math.max(0, Math.min(maxPts - 1, state.scrubIdx));
    let timeLabel = "";
    if (state.diurnalAlign === "utc") {
      const targetMs = Date.now() + idx * 3600 * 1000;
      const dt = new Date(targetMs);
      timeLabel = `${dt.toISOString().slice(0, 13)}:00Z (UTC +${idx}h Simultaneous)`;
    } else {
      const rawTime = c0.hourly.time[idx] || "";
      timeLabel = `${rawTime.replace("T", " ")} LST (Local Solar Aligned +${idx}h)`;
    }

    let cellsHtml = "";
    const refCity = state.weatherData[state.refIdx] || c0;
    const refOff = getHourlyOffset(refCity);
    const refIdxH = Math.min(refCity.hourly.temp.length - 1, idx + refOff);
    const refT = conv.temp(refCity.hourly.temp[refIdxH]);

    state.weatherData.forEach((city, cIdx) => {
      const h = city.hourly;
      const hIdx = Math.min(h.temp.length - 1, idx + getHourlyOffset(city));
      const t = conv.temp(h.temp[hIdx]);
      const td = conv.temp(h.dew_point[hIdx]);
      const app = conv.temp(h.apparent[hIdx]);
      const vpd = h.vpd[hIdx] ?? 0;
      const w = conv.wind(h.wind_speed[hIdx]);
      const g = conv.wind(h.wind_gusts[hIdx]);
      const diff = cIdx === state.refIdx ? "REF" : fmtSigned(t - refT, 1, "°");

      cellsHtml += `
        <div class="scrub-city-cell" style="--slot-color: var(--city-${cIdx})">
          <div class="scrub-city-name">
            <span>${escapeHtml(city.location.name)}</span>
            <span class="mono">${diff}</span>
          </div>
          <div class="scrub-primary-val">${t.toFixed(1)}${conv.tempUnit()} <span style="font-weight:400;font-size:11px;color:var(--text-secondary)">Td ${td.toFixed(1)}°</span></div>
          <div class="scrub-secondary-val">App ${app.toFixed(1)}° · VPD ${vpd.toFixed(2)}kPa · ${w}/${g}${conv.windUnit()}</div>
        </div>
      `;
    });

    els.scrubberReadout.innerHTML = `
      <div class="scrubber-top-meta">
        <span class="scrubber-time-title">${escapeHtml(timeLabel)}</span>
        <span class="scrubber-mode-desc">72H DIURNAL TRACE &amp; DEW-POINT DEPRESSION</span>
      </div>
      <div class="scrubber-cities-row">${cellsHtml}</div>
    `;
    return;
  }

  // Daily modes: 'range' | 'psychro' | 'wind'
  const maxDays = Math.min(state.horizonDays, c0.daily.length);
  const idx = Math.max(0, Math.min(maxDays - 1, state.scrubIdx));
  const dateStr = c0.daily[idx]?.date || "";
  const dateObj = new Date(dateStr + "T12:00:00Z");
  const dow = dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  let modeLabel = "TEMPERATURE HIGH–LOW RANGE ENVELOPE";
  if (state.chartMode === "psychro") modeLabel = "DEW POINT (Td) RANGE & WET-BULB (Tw) ENVELOPE";
  if (state.chartMode === "wind") modeLabel = "10M WIND / GUST ENVELOPE & MSLP";

  const refCity = state.weatherData[state.refIdx] || c0;
  const refD = refCity.daily[idx] || refCity.daily[0];

  let cellsHtml = "";
  state.weatherData.forEach((city, cIdx) => {
    const d = city.daily[idx] || city.daily[0];
    if (state.chartMode === "range") {
      const hi = conv.temp(d.temp_max);
      const lo = conv.temp(d.temp_min);
      const spread = conv.tempDelta(d.temp_range);
      const refHi = conv.temp(refD.temp_max);
      const diffStr = cIdx === state.refIdx ? "REF" : `ΔH ${fmtSigned(hi - refHi, 1, "°")}`;
      cellsHtml += `
        <div class="scrub-city-cell" style="--slot-color: var(--city-${cIdx})">
          <div class="scrub-city-name">
            <span>${escapeHtml(city.location.name)}</span>
            <span class="mono">${diffStr}</span>
          </div>
          <div class="scrub-primary-val">${hi.toFixed(1)}° <span style="color:var(--text-tertiary);font-weight:400">/</span> ${lo.toFixed(1)}°</div>
          <div class="scrub-secondary-val">ΔT ${spread.toFixed(1)}° · PoP ${d.precip_prob_max}% · Td ${conv.temp(d.dew_point_mean).toFixed(1)}°</div>
        </div>
      `;
    } else if (state.chartMode === "psychro") {
      const tdMax = conv.temp(d.dew_point_max);
      const tdMin = conv.temp(d.dew_point_min);
      const tw = conv.temp(d.wet_bulb_mean);
      cellsHtml += `
        <div class="scrub-city-cell" style="--slot-color: var(--city-${cIdx})">
          <div class="scrub-city-name">
            <span>${escapeHtml(city.location.name)}</span>
            <span class="mono">VPD ${d.vpd_max.toFixed(2)}kPa</span>
          </div>
          <div class="scrub-primary-val">Td ${tdMax.toFixed(1)}° / ${tdMin.toFixed(1)}°</div>
          <div class="scrub-secondary-val">Tw ${tw.toFixed(1)}° · RH ${d.rh_mean}% · w ${d.mixing_ratio}g/kg</div>
        </div>
      `;
    } else if (state.chartMode === "wind") {
      const wMax = conv.wind(d.wind_speed_max);
      const gMax = conv.wind(d.wind_gusts_max);
      const pMean = conv.pressure(d.pressure_msl_mean);
      cellsHtml += `
        <div class="scrub-city-cell" style="--slot-color: var(--city-${cIdx})">
          <div class="scrub-city-name">
            <span>${escapeHtml(city.location.name)}</span>
            <span class="mono">${d.wind_dir_dominant}° ${degToCardinal(d.wind_dir_dominant)}</span>
          </div>
          <div class="scrub-primary-val">${wMax.toFixed(1)}–${gMax.toFixed(1)} ${conv.windUnit()}</div>
          <div class="scrub-secondary-val">GF ${d.gust_factor.toFixed(2)} · MSLP ${pMean}${conv.pressureUnit()}</div>
        </div>
      `;
    }
  });

  els.scrubberReadout.innerHTML = `
    <div class="scrubber-top-meta">
      <span class="scrubber-time-title">D+${idx} · ${escapeHtml(dow.toUpperCase())}</span>
      <span class="scrubber-mode-desc">${modeLabel}</span>
    </div>
    <div class="scrubber-cities-row">${cellsHtml}</div>
  `;
}

// 4. High-DPI Canvas Range-Area Chart Renderer
// Monotone Cubic Spline helper (Fritsch-Carlson) so range bands are smooth without overshooting extrema
function computeMonotoneTangents(xs, ys) {
  const n = xs.length;
  if (n < 2) return new Array(n).fill(0);
  const deltas = new Array(n - 1);
  const secants = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    deltas[i] = xs[i + 1] - xs[i];
    secants[i] = deltas[i] > 0 ? (ys[i + 1] - ys[i]) / deltas[i] : 0;
  }
  const m = new Array(n);
  m[0] = secants[0];
  m[n - 1] = secants[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (secants[i - 1] * secants[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (secants[i - 1] + secants[i]) / 2;
    }
  }
  for (let i = 0; i < n - 1; i++) {
    if (secants[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / secants[i];
      const b = m[i + 1] / secants[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        m[i] = t * a * secants[i];
        m[i + 1] = t * b * secants[i];
      }
    }
  }
  return m;
}

function traceMonotoneCurve(ctx, xs, ys, tangents, moveFirst = true) {
  const n = xs.length;
  if (n === 0) return;
  if (moveFirst) ctx.moveTo(xs[0], ys[0]);
  else ctx.lineTo(xs[0], ys[0]);
  for (let i = 0; i < n - 1; i++) {
    const dx = (xs[i + 1] - xs[i]) / 3;
    const cp1x = xs[i] + dx;
    const cp1y = ys[i] + tangents[i] * dx;
    const cp2x = xs[i + 1] - dx;
    const cp2y = ys[i + 1] - tangents[i + 1] * dx;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, xs[i + 1], ys[i + 1]);
  }
}

function traceClosedRangeBand(ctx, xs, upperYs, lowerYs) {
  const n = xs.length;
  if (n < 2) return;
  const upperM = computeMonotoneTangents(xs, upperYs);
  const revXs = [...xs].reverse();
  const revLowerYs = [...lowerYs].reverse();
  const revLowerM = computeMonotoneTangents(revXs, revLowerYs);

  ctx.beginPath();
  traceMonotoneCurve(ctx, xs, upperYs, upperM, true);
  traceMonotoneCurve(ctx, revXs, revLowerYs, revLowerM, false);
  ctx.closePath();
}

function drawPillBadge(ctx, text, x, y, bgColor, textColor, borderColor = null) {
  ctx.save();
  ctx.font = '600 9.5px "SF Mono", ui-monospace, Menlo, monospace';
  const tw = ctx.measureText(text).width;
  const pw = tw + 8;
  const ph = 14;
  const rx = x - pw / 2;
  const ry = y - ph / 2;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(rx, ry, pw, ph, 4);
  ctx.fill();
  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function renderChart() {
  const canvas = els.canvas;
  if (!canvas || !state.weatherData.length) return;
  const rect = els.canvasStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(300, Math.floor(rect.width));
  const H = Math.max(200, Math.floor(rect.height));

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const isDark = state.theme === "dark";
  const padL = 38;
  const padR = 38;
  const padT = 22;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Build series per city based on chartMode
  const c0 = state.weatherData[0];
  const isHourly = state.chartMode === "diurnal";
  const count = isHourly ? 72 : Math.min(state.horizonDays, c0.daily.length);

  if (state.scrubIdx >= count) state.scrubIdx = count - 1;

  const seriesList = state.weatherData.map((city, cIdx) => {
    const upper = [];
    const lower = [];
    const mid = [];
    const aux = [];
    const hrOffset = isHourly ? getHourlyOffset(city) : 0;

    for (let i = 0; i < count; i++) {
      if (state.chartMode === "range") {
        const d = city.daily[i];
        upper.push(conv.temp(d.temp_max));
        lower.push(conv.temp(d.temp_min));
        mid.push(conv.temp(d.temp_mean));
        aux.push(d.precip_prob_max);
      } else if (state.chartMode === "diurnal") {
        const h = city.hourly;
        const hIdx = Math.min(h.temp.length - 1, i + hrOffset);
        const t = conv.temp(h.temp[hIdx]);
        const td = conv.temp(h.dew_point[hIdx]);
        upper.push(t);
        lower.push(td);
        mid.push(conv.temp(h.apparent[hIdx]));
        aux.push(h.precip_prob[hIdx]);
      } else if (state.chartMode === "psychro") {
        const d = city.daily[i];
        upper.push(conv.temp(d.dew_point_max));
        lower.push(conv.temp(d.dew_point_min));
        mid.push(conv.temp(d.wet_bulb_mean));
        aux.push(d.vpd_max);
      } else if (state.chartMode === "wind") {
        const d = city.daily[i];
        upper.push(conv.wind(d.wind_gusts_max));
        lower.push(conv.wind(d.wind_speed_max));
        mid.push(conv.pressure(d.pressure_msl_mean));
        aux.push(d.wind_dir_dominant);
      }
    }

    return {
      cIdx,
      city,
      upper,
      lower,
      mid,
      aux,
      color: isDark ? SLOT_COLORS[cIdx].hex : SLOT_COLORS[cIdx].lightHex,
      rgb: SLOT_COLORS[cIdx].rgb,
    };
  });

  // Determine global Y min and max across active series
  let yMin = Infinity;
  let yMax = -Infinity;
  let maxPeakInfo = null;
  let minTroughInfo = null;

  seriesList.forEach((s) => {
    const isDimmed = state.soloIdx !== null && state.soloIdx !== s.cIdx;
    for (let i = 0; i < count; i++) {
      if (s.upper[i] > yMax) {
        yMax = s.upper[i];
      }
      if (s.lower[i] < yMin) {
        yMin = s.lower[i];
      }
      if (!isDimmed) {
        if (!maxPeakInfo || s.upper[i] > maxPeakInfo.val) {
          maxPeakInfo = { val: s.upper[i], idx: i, s };
        }
        if (!minTroughInfo || s.lower[i] < minTroughInfo.val) {
          minTroughInfo = { val: s.lower[i], idx: i, s };
        }
      }
    }
  });

  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = 0;
    yMax = 30;
  }
  const span = Math.max(4, yMax - yMin);
  const domMin = Math.floor((yMin - span * 0.14) / 2) * 2;
  const domMax = Math.ceil((yMax + span * 0.16) / 2) * 2;

  const xAt = (i) => padL + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW);
  const yAt = (v) => padT + plotH - ((v - domMin) / Math.max(1e-5, domMax - domMin)) * plotH;

  // Draw Horizontal Grid Lines & Left Y-Axis Labels
  const gridSteps = 5;
  ctx.font = '500 10px "SF Mono", ui-monospace, Menlo, monospace';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let g = 0; g <= gridSteps; g++) {
    const val = domMin + ((domMax - domMin) * g) / gridSteps;
    const y = yAt(val);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(60,60,67,0.09)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const suffix = state.chartMode === "wind" ? "" : "°";
    ctx.fillStyle = isDark ? "rgba(235,235,245,0.48)" : "rgba(60,60,67,0.55)";
    ctx.fillText(`${Math.round(val)}${suffix}`, padL - 6, y);
  }

  // Draw 0°C / 32°F Freezing Reference Isotherm if in range (for thermal modes)
  if (state.chartMode !== "wind") {
    const freezeVal = state.units === "imperial" ? 32 : 0;
    if (freezeVal >= domMin && freezeVal <= domMax) {
      const fy = yAt(freezeVal);
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(100, 210, 255, 0.42)" : "rgba(0, 122, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, fy);
      ctx.lineTo(W - padR, fy);
      ctx.stroke();
      ctx.fillStyle = isDark ? "#64d2ff" : "#007aff";
      ctx.textAlign = "left";
      ctx.font = '600 9px "SF Mono", ui-monospace, monospace';
      ctx.fillText(`0°C ISO`, padL + 4, fy - 6);
      ctx.restore();
    }
  }

  // Draw Vertical Day/Time Tick Guides & Bottom X-Axis Labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = '500 10px "SF Mono", ui-monospace, Menlo, monospace';

  if (isHourly) {
    for (let i = 0; i < count; i++) {
      const x = xAt(i);
      const hr = i % 24;
      // Subtle night shading (19:00 to 06:00 when in LST mode)
      if (state.diurnalAlign === "lst" && (hr >= 19 || hr < 6)) {
        const nextX = xAt(Math.min(count - 1, i + 1));
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.018)" : "rgba(0,0,0,0.022)";
        ctx.fillRect(x, padT, nextX - x, plotH);
      }
      if (i % 12 === 0) {
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(60,60,67,0.08)";
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();

        let lbl = "";
        if (state.diurnalAlign === "utc") {
          lbl = `+${i}h`;
        } else {
          const tStr = c0.hourly.time[i] || "";
          lbl = hr === 0 ? tStr.slice(5, 10) : `${String(hr).padStart(2, "0")}h`;
        }
        ctx.fillStyle = isDark ? "rgba(235,235,245,0.52)" : "rgba(60,60,67,0.6)";
        ctx.fillText(lbl, x, padT + plotH + 7);
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const x = xAt(i);
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.045)" : "rgba(60,60,67,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      const dStr = c0.daily[i]?.date || "";
      const dObj = new Date(dStr + "T12:00:00Z");
      const dow = i === 0 ? "NOW" : dObj.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase();
      ctx.fillStyle =
        i === state.scrubIdx
          ? isDark
            ? "#ffffff"
            : "#000000"
          : isDark
          ? "rgba(235,235,245,0.52)"
          : "rgba(60,60,67,0.6)";
      ctx.fillText(dow, x, padT + plotH + 8);
    }
  }

  const xs = [];
  for (let i = 0; i < count; i++) xs.push(xAt(i));

  // Order rendering so solo city (or ref city) is drawn last (on top)
  const orderedSeries = [...seriesList].sort((a, b) => {
    if (state.soloIdx !== null) {
      if (a.cIdx === state.soloIdx) return 1;
      if (b.cIdx === state.soloIdx) return -1;
    }
    return 0;
  });

  // Pass 1: Draw Shaded Range Area Envelopes (T_min -> T_max)
  orderedSeries.forEach((s) => {
    const isDimmed = state.soloIdx !== null && state.soloIdx !== s.cIdx;
    const isSolo = state.soloIdx === s.cIdx;
    const upperYs = s.upper.map(yAt);
    const lowerYs = s.lower.map(yAt);

    const minYPixel = Math.min(...upperYs);
    const maxYPixel = Math.max(...lowerYs);

    const grad = ctx.createLinearGradient(0, minYPixel, 0, maxYPixel);
    const topAlpha = isDimmed ? 0.05 : isSolo ? 0.36 : 0.24;
    const botAlpha = isDimmed ? 0.02 : isSolo ? 0.14 : 0.08;
    grad.addColorStop(0, `rgba(${s.rgb}, ${topAlpha})`);
    grad.addColorStop(1, `rgba(${s.rgb}, ${botAlpha})`);

    ctx.save();
    traceClosedRangeBand(ctx, xs, upperYs, lowerYs);
    ctx.fillStyle = grad;
    ctx.fill();

    // Subtle daily vertical range stems inside the band (for daily modes)
    if (!isHourly && !isDimmed) {
      ctx.strokeStyle = `rgba(${s.rgb}, ${isSolo ? 0.42 : 0.25})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.moveTo(xs[i], upperYs[i]);
        ctx.lineTo(xs[i], lowerYs[i]);
        ctx.stroke();
      }
    }
    ctx.restore();
  });

  // Pass 2: Draw Upper & Lower Envelope Curves + Extrema Nodes + Right-Edge Station Tags
  const rightTagPositions = [];

  orderedSeries.forEach((s) => {
    const isDimmed = state.soloIdx !== null && state.soloIdx !== s.cIdx;
    const alpha = isDimmed ? 0.18 : 1.0;
    const upperYs = s.upper.map(yAt);
    const lowerYs = s.lower.map(yAt);
    const upperM = computeMonotoneTangents(xs, upperYs);
    const lowerM = computeMonotoneTangents(xs, lowerYs);

    // Lower bound curve (T_min / Td_min / V10) - dashed crisp line
    ctx.save();
    ctx.strokeStyle = `rgba(${s.rgb}, ${alpha * 0.78})`;
    ctx.lineWidth = isDimmed ? 1 : 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    traceMonotoneCurve(ctx, xs, lowerYs, lowerM, true);
    ctx.stroke();
    ctx.restore();

    // Upper bound curve (T_max / T2m / Td_max / G10) - solid bold line
    ctx.save();
    ctx.strokeStyle = `rgba(${s.rgb}, ${alpha})`;
    ctx.lineWidth = isDimmed ? 1.2 : 2.2;
    ctx.beginPath();
    traceMonotoneCurve(ctx, xs, upperYs, upperM, true);
    ctx.stroke();
    ctx.restore();

    // Daily discrete nodes on High & Low points
    if (!isHourly && !isDimmed) {
      for (let i = 0; i < count; i++) {
        // High node (filled circle)
        ctx.beginPath();
        ctx.arc(xs[i], upperYs[i], 2.8, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();

        // Low node (hollow circle)
        ctx.beginPath();
        ctx.arc(xs[i], lowerYs[i], 2.3, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? "#1c1c1e" : "#ffffff";
        ctx.fill();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }

    if (!isDimmed) {
      const lastUpperY = upperYs[count - 1];
      const lastLowerY = lowerYs[count - 1];
      rightTagPositions.push({
        y: (lastUpperY + lastLowerY) / 2,
        code: shortCode(s.city.location),
        color: s.color,
      });
    }
  });

  // Render Right-Edge Station Code Callouts with collision avoidance
  rightTagPositions.sort((a, b) => a.y - b.y);
  for (let i = 1; i < rightTagPositions.length; i++) {
    if (rightTagPositions[i].y - rightTagPositions[i - 1].y < 13) {
      rightTagPositions[i].y = rightTagPositions[i - 1].y + 13;
    }
  }
  ctx.save();
  ctx.font = '700 9.5px "SF Mono", ui-monospace, Menlo, monospace';
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  rightTagPositions.forEach((tag) => {
    const cy = Math.max(padT + 6, Math.min(padT + plotH - 6, tag.y));
    ctx.fillStyle = tag.color;
    ctx.fillText(tag.code, W - padR + 5, cy);
  });
  ctx.restore();

  // Render Global Horizon Peak & Trough Callout Pills
  const unitSym = state.chartMode === "wind" ? conv.windUnit() : "°";
  if (maxPeakInfo) {
    const px = Math.max(padL + 28, Math.min(W - padR - 28, xAt(maxPeakInfo.idx)));
    const py = Math.max(10, yAt(maxPeakInfo.val) - 12);
    drawPillBadge(
      ctx,
      `▲ ${maxPeakInfo.val.toFixed(1)}${unitSym}`,
      px,
      py,
      isDark ? "rgba(28,28,30,0.9)" : "rgba(255,255,255,0.92)",
      maxPeakInfo.s.color,
      `rgba(${maxPeakInfo.s.rgb}, 0.5)`
    );
  }
  if (minTroughInfo) {
    const px = Math.max(padL + 28, Math.min(W - padR - 28, xAt(minTroughInfo.idx)));
    const py = Math.min(padT + plotH - 6, yAt(minTroughInfo.val) + 12);
    drawPillBadge(
      ctx,
      `▼ ${minTroughInfo.val.toFixed(1)}${unitSym}`,
      px,
      py,
      isDark ? "rgba(28,28,30,0.9)" : "rgba(255,255,255,0.92)",
      minTroughInfo.s.color,
      `rgba(${minTroughInfo.s.rgb}, 0.5)`
    );
  }

  // Pass 3: Interactive Scrubber Vertical Hairline & Highlighted Dots
  const scrubX = xAt(state.scrubIdx);
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(60, 60, 67, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(scrubX, padT - 4);
  ctx.lineTo(scrubX, padT + plotH);
  ctx.stroke();

  // Draw active scrub rings on each series at scrubIdx
  orderedSeries.forEach((s) => {
    const isDimmed = state.soloIdx !== null && state.soloIdx !== s.cIdx;
    if (isDimmed) return;
    const uy = yAt(s.upper[state.scrubIdx]);
    const ly = yAt(s.lower[state.scrubIdx]);

    // Highlighted range segment at scrubX
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(scrubX, uy);
    ctx.lineTo(scrubX, ly);
    ctx.stroke();

    [uy, ly].forEach((py) => {
      ctx.beginPath();
      ctx.arc(scrubX, py, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = isDark ? "#000000" : "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  });
  ctx.restore();

  ctx.restore();
}

// 5. Render Sub-Chart Envelope Summary Metrics
function renderChartFooterMetrics() {
  if (!state.weatherData.length) return;
  const days = state.horizonDays;

  let globalMax = -Infinity;
  let globalMaxCity = "";
  let globalMin = Infinity;
  let globalMinCity = "";
  let maxSpread = -Infinity;
  let maxSpreadCity = "";
  let maxVpd = -Infinity;
  let maxVpdCity = "";

  state.weatherData.forEach((c) => {
    const slice = c.daily.slice(0, days);
    slice.forEach((d) => {
      const hi = conv.temp(d.temp_max);
      const lo = conv.temp(d.temp_min);
      const sp = conv.tempDelta(d.temp_range);
      if (hi > globalMax) {
        globalMax = hi;
        globalMaxCity = shortCode(c.location);
      }
      if (lo < globalMin) {
        globalMin = lo;
        globalMinCity = shortCode(c.location);
      }
      if (sp > maxSpread) {
        maxSpread = sp;
        maxSpreadCity = shortCode(c.location);
      }
      if (d.vpd_max > maxVpd) {
        maxVpd = d.vpd_max;
        maxVpdCity = shortCode(c.location);
      }
    });
  });

  const totalEnvelope = Math.round((globalMax - globalMin) * 10) / 10;

  els.chartFooterMetrics.innerHTML = `
    <div class="footer-metric-cell">
      <span class="footer-metric-label">${days}D ENVELOPE CEILING</span>
      <span class="footer-metric-val">${globalMax.toFixed(1)}${conv.tempUnit()} (${globalMaxCity})</span>
    </div>
    <div class="footer-metric-cell">
      <span class="footer-metric-label">${days}D ENVELOPE FLOOR</span>
      <span class="footer-metric-val">${globalMin.toFixed(1)}${conv.tempUnit()} (${globalMinCity})</span>
    </div>
    <div class="footer-metric-cell">
      <span class="footer-metric-label">MAX DIURNAL ΔT</span>
      <span class="footer-metric-val">${maxSpread.toFixed(1)}${conv.tempUnit()} (${maxSpreadCity})</span>
    </div>
    <div class="footer-metric-cell">
      <span class="footer-metric-label">TOTAL SPREAD / PEAK VPD</span>
      <span class="footer-metric-val">${totalEnvelope.toFixed(1)}° · ${maxVpd.toFixed(2)}kPa (${maxVpdCity})</span>
    </div>
  `;
}

// 6. Render Multi-City Daily Range Bar Matrix (Apple Weather Style)
function renderDailyMatrix() {
  if (!state.weatherData.length) return;
  const days = state.horizonDays;
  const c0 = state.weatherData[0];
  const count = Math.min(days, c0.daily.length);

  // Global min/max across all cities for the matrix horizon
  let gMin = Infinity;
  let gMax = -Infinity;
  state.weatherData.forEach((c) => {
    for (let i = 0; i < count; i++) {
      const d = c.daily[i];
      if (!d) continue;
      const lo = conv.temp(d.temp_min);
      const hi = conv.temp(d.temp_max);
      if (lo < gMin) gMin = lo;
      if (hi > gMax) gMax = hi;
    }
  });
  const domainSpan = Math.max(1, gMax - gMin);

  let html = "";
  for (let i = 0; i < count; i++) {
    const d0 = c0.daily[i];
    const dateObj = new Date(d0.date + "T12:00:00Z");
    const dow = i === 0 ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const mmdd = d0.date.slice(5);
    const isSelected = state.lockedDayIdx === i;

    let barsHtml = "";
    let rightMetaParts = [];

    state.weatherData.forEach((city, cIdx) => {
      const d = city.daily[i] || city.daily[0];
      const lo = conv.temp(d.temp_min);
      const hi = conv.temp(d.temp_max);
      const leftPct = Math.max(0, Math.min(100, ((lo - gMin) / domainSpan) * 100));
      const widthPct = Math.max(4, Math.min(100 - leftPct, ((hi - lo) / domainSpan) * 100));
      const code = shortCode(city.location);

      barsHtml += `
        <div class="matrix-city-bar-line" style="--slot-color: var(--city-${cIdx})">
          <span class="bar-city-code">${code}</span>
          <span class="bar-temp-min">${lo.toFixed(0)}°</span>
          <div class="bar-track">
            <div class="bar-fill" style="left:${leftPct.toFixed(1)}%; width:${widthPct.toFixed(1)}%"></div>
          </div>
          <span class="bar-temp-max">${hi.toFixed(0)}°</span>
        </div>
      `;

      const wmo = getWmoInfo(d.weather_code);
      rightMetaParts.push(`<span>${code}: ${wmo.abbr} · Δ${conv.tempDelta(d.temp_range).toFixed(0)}°</span>`);
    });

    html += `
      <div class="matrix-day-row ${isSelected ? "selected" : ""}" data-day-idx="${i}">
        <div class="matrix-day-label">
          <span class="matrix-dow">${dow}</span>
          <span class="matrix-date">${mmdd}</span>
        </div>
        <div class="matrix-bars-stack">${barsHtml}</div>
        <div class="matrix-day-right">${rightMetaParts.join("")}</div>
      </div>
    `;
  }

  els.dailyMatrixList.innerHTML = html;
  els.btnResetDay.style.display = state.lockedDayIdx !== null ? "inline-block" : "none";

  els.dailyMatrixList.querySelectorAll(".matrix-day-row").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.dataset.dayIdx);
      state.lockedDayIdx = state.lockedDayIdx === idx ? null : idx;
      state.scrubIdx = idx;
      renderScrubberReadout();
      renderChart();
      renderDailyMatrix();
      renderTelemetryInspector();
    });
  });
}

// 7. Render Nerd Stats Telemetry Inspector (6 Grouped iOS Inset Tables, Zero Prose)
function renderTelemetryInspector() {
  if (!state.weatherData.length) return;

  const isDayLocked = state.lockedDayIdx !== null;
  const dayIdx = isDayLocked ? state.lockedDayIdx : 0;
  const refCity = state.weatherData[state.refIdx] || state.weatherData[0];

  if (isDayLocked) {
    const dStr = state.weatherData[0].daily[dayIdx]?.date || "";
    els.inspectorTimeBadge.textContent = `DAY D+${dayIdx} (${dStr})`;
  } else {
    els.inspectorTimeBadge.textContent = "LIVE SYNOPTIC NOW";
  }

  els.deltaModeIndicator.textContent = state.showDelta
    ? `Δ relative to ${refCity.location.name} (${shortCode(refCity.location)})`
    : "Absolute Telemetry";

  // Helper to extract snapshot per city (either Live Current or Locked Day Aggregate)
  const snaps = state.weatherData.map((city) => {
    const cur = city.current;
    const d = city.daily[dayIdx] || city.daily[0];
    if (!isDayLocked) {
      return {
        city,
        t: conv.temp(cur.temp),
        tApp: conv.temp(cur.apparent),
        tMax: conv.temp(d.temp_max),
        tMin: conv.temp(d.temp_min),
        tRange: conv.tempDelta(d.temp_range),
        td: conv.temp(cur.dew_point),
        tdDep: conv.tempDelta(cur.dew_depression),
        tw: conv.temp(cur.wet_bulb),
        rh: cur.rh,
        vpd: cur.vpd,
        thetaE: cur.theta_e,
        mixingRatio: cur.mixing_ratio,
        vaporPressure: cur.vapor_pressure,
        airDensity: cur.air_density,
        pMsl: conv.pressure(cur.pressure_msl),
        pSfc: conv.pressure(cur.surface_pressure),
        p3h: cur.pressure_tendency_3h,
        p24h: cur.pressure_tendency_24h,
        cape: cur.cape,
        pblh: conv.alt(cur.pblh),
        freezeLvl: conv.alt(cur.freezing_level),
        lcl: conv.alt(cur.lcl),
        wind: conv.wind(cur.wind_speed),
        gust: conv.wind(cur.wind_gusts),
        gf: cur.gust_factor,
        windDir: cur.wind_dir,
        cloudTotal: cur.cloud_total,
        cloudL: cur.cloud_low,
        cloudM: cur.cloud_mid,
        cloudH: cur.cloud_high,
        swRad: cur.sw_rad,
        swSum: d.sw_radiation_sum,
        dni: cur.dni,
        uvi: cur.uv_index,
        vis: cur.visibility,
        precip: conv.precip(d.precip_sum),
        precipHrs: d.precip_hours,
        pop: d.precip_prob_max,
        et0: conv.precip(d.et0),
        moistureBal: conv.precip(d.moisture_balance),
        aqi: cur.aqi_us,
        pm25: cur.pm2_5,
        pm10: cur.pm10,
        o3: cur.ozone,
        aod: cur.aod,
        sunrise: d.sunrise ? d.sunrise.slice(11, 16) : "--:--",
        sunset: d.sunset ? d.sunset.slice(11, 16) : "--:--",
        daylight: d.daylight_duration,
        sunshine: d.sunshine_duration,
        elev: conv.alt(city.location.elevation),
        coords: formatCoord(city.location.latitude, city.location.longitude),
      };
    } else {
      return {
        city,
        t: conv.temp(d.temp_mean),
        tApp: conv.temp(d.apparent_max),
        tMax: conv.temp(d.temp_max),
        tMin: conv.temp(d.temp_min),
        tRange: conv.tempDelta(d.temp_range),
        td: conv.temp(d.dew_point_mean),
        tdDep: conv.tempDelta(Math.max(0, d.temp_mean - d.dew_point_mean)),
        tw: conv.temp(d.wet_bulb_mean),
        rh: d.rh_mean,
        vpd: d.vpd_max,
        thetaE: d.theta_e,
        mixingRatio: d.mixing_ratio,
        vaporPressure: Math.round(6.112 * Math.exp((17.67 * d.dew_point_mean) / (d.dew_point_mean + 243.5)) * 10) / 10,
        airDensity: d.air_density,
        pMsl: conv.pressure(d.pressure_msl_mean),
        pSfc: conv.pressure(d.surface_pressure_mean),
        p3h: 0,
        p24h: Math.round((d.pressure_msl_max - d.pressure_msl_min) * 10) / 10,
        cape: d.cape_max,
        pblh: conv.alt(d.pblh_max),
        freezeLvl: conv.alt(d.freezing_level_mean),
        lcl: conv.alt(d.lcl_mean),
        wind: conv.wind(d.wind_speed_max),
        gust: conv.wind(d.wind_gusts_max),
        gf: d.gust_factor,
        windDir: d.wind_dir_dominant,
        cloudTotal: d.cloud_cover_mean,
        cloudL: d.cloud_low_mean,
        cloudM: d.cloud_mid_mean,
        cloudH: d.cloud_high_mean,
        swRad: d.sw_radiation_peak,
        swSum: d.sw_radiation_sum,
        dni: d.dni_peak,
        uvi: d.uv_index_max,
        vis: d.visibility_min,
        precip: conv.precip(d.precip_sum),
        precipHrs: d.precip_hours,
        pop: d.precip_prob_max,
        et0: conv.precip(d.et0),
        moistureBal: conv.precip(d.moisture_balance),
        aqi: city.current.aqi_us,
        pm25: city.current.pm2_5,
        pm10: city.current.pm10,
        o3: city.current.ozone,
        aod: city.current.aod,
        sunrise: d.sunrise ? d.sunrise.slice(11, 16) : "--:--",
        sunset: d.sunset ? d.sunset.slice(11, 16) : "--:--",
        daylight: d.daylight_duration,
        sunshine: d.sunshine_duration,
        elev: conv.alt(city.location.elevation),
        coords: formatCoord(city.location.latitude, city.location.longitude),
      };
    }
  });

  const groups = [
    {
      title: "1 · THERMODYNAMICS & PSYCHROMETRICS",
      rows: [
        { sym: isDayLocked ? "T_mean" : "T2m", unit: conv.tempUnit(), label: isDayLocked ? "Daily Mean Temp" : "2m Dry-Bulb Temp", key: "t", dec: 1 },
        { sym: "T_max/min", unit: conv.tempUnit(), label: "Daily High / Low", custom: (s) => `${s.tMax.toFixed(1)}° / ${s.tMin.toFixed(1)}°` },
        { sym: "ΔT_diurnal", unit: conv.tempUnit(), label: "Diurnal Temp Spread", key: "tRange", dec: 1 },
        { sym: "T_app", unit: conv.tempUnit(), label: "Apparent Temp", key: "tApp", dec: 1 },
        { sym: "Td", unit: conv.tempUnit(), label: "2m Dew Point", key: "td", dec: 1 },
        { sym: "T − Td", unit: conv.tempUnit(), label: "Dew Point Depression", key: "tdDep", dec: 1 },
        { sym: "Tw", unit: conv.tempUnit(), label: "Wet-Bulb Temp", key: "tw", dec: 1 },
        { sym: "VPD", unit: "kPa", label: "Vapor Pressure Deficit", key: "vpd", dec: 2 },
        { sym: "RH / w", unit: "% · g/kg", label: "Rel Humidity & Mixing Ratio", custom: (s) => `${s.rh}% · ${s.mixingRatio}g` },
        { sym: "θe / ρ", unit: "K · kg/m³", label: "Equiv Pot Temp & Density", custom: (s) => `${s.thetaE.toFixed(1)}K · ${s.airDensity.toFixed(3)}` },
      ],
    },
    {
      title: "2 · BAROMETRICS & CONVECTIVE DYNAMICS",
      rows: [
        { sym: "MSLP", unit: conv.pressureUnit(), label: "Mean Sea Level Pressure", key: "pMsl", dec: state.units === "imperial" ? 2 : 1 },
        { sym: "P_sfc", unit: conv.pressureUnit(), label: "Station Surface Pressure", key: "pSfc", dec: state.units === "imperial" ? 2 : 1 },
        {
          sym: "ΔP_3h / 24h",
          unit: "hPa",
          label: "Barometric Tendency",
          custom: (s) => {
            const arrow = s.p3h > 0.3 ? "↗" : s.p3h < -0.3 ? "↘" : "→";
            return `${arrow} ${fmtSigned(s.p3h, 1)} / ${fmtSigned(s.p24h, 1)}`;
          },
        },
        { sym: "CAPE", unit: "J/kg", label: "Convective Avail Pot Energy", key: "cape", dec: 0 },
        { sym: "PBLH", unit: conv.altUnit() + " AGL", label: "Planetary Boundary Layer", key: "pblh", dec: 0 },
        { sym: "LCL", unit: conv.altUnit() + " AGL", label: "Lifted Condensation Level", key: "lcl", dec: 0 },
        { sym: "0°C ISO", unit: conv.altUnit() + " MSL", label: "Freezing Level Height", key: "freezeLvl", dec: 0 },
      ],
    },
    {
      title: "3 · KINEMATICS & 10M WIND VECTOR",
      rows: [
        { sym: "V10", unit: conv.windUnit(), label: "10m Sustained Wind", key: "wind", dec: 1 },
        { sym: "G10", unit: conv.windUnit(), label: "10m Peak Wind Gust", key: "gust", dec: 1 },
        { sym: "GF", unit: "G10/V10", label: "Turbulence Gust Factor", key: "gf", dec: 2 },
        {
          sym: "Azimuth",
          unit: "deg°",
          label: "Meteorological Vector",
          custom: (s) => `<span class="wind-vec" style="transform:rotate(${s.windDir + 180}deg)">↑</span>${String(s.windDir).padStart(3, "0")}° ${degToCardinal(s.windDir)}`,
        },
      ],
    },
    {
      title: "4 · RADIATION, CLOUDS & OPTICAL",
      rows: [
        { sym: "TCC", unit: "%", label: "Total Cloud Cover", key: "cloudTotal", dec: 0 },
        {
          sym: "CL / CM / CH",
          unit: "%",
          label: "Low / Mid / High Cloud Deck",
          custom: (s, cIdx) => `
            <div>${s.cloudL}/${s.cloudM}/${s.cloudH}%</div>
            <div class="cloud-tri-bar" style="--slot-color: var(--city-${cIdx})">
              <div class="cloud-seg" title="Low ${s.cloudL}%"><span style="width:${s.cloudL}%"></span></div>
              <div class="cloud-seg" title="Mid ${s.cloudM}%"><span style="width:${s.cloudM}%"></span></div>
              <div class="cloud-seg" title="High ${s.cloudH}%"><span style="width:${s.cloudH}%"></span></div>
            </div>
          `,
        },
        { sym: "SW↓", unit: "W/m²", label: "Shortwave Irradiance", key: "swRad", dec: 0 },
        { sym: "DNI", unit: "W/m²", label: "Direct Normal Irradiance", key: "dni", dec: 0 },
        { sym: "ΣSW_day", unit: "MJ/m²", label: "Daily Solar Insolation", key: "swSum", dec: 1 },
        { sym: "UVI", unit: "idx", label: "Ultraviolet Index", key: "uvi", dec: 1 },
        { sym: "VIS", unit: "km", label: "Horizontal Visibility", key: "vis", dec: 1 },
      ],
    },
    {
      title: "5 · HYDROLOGY & AEROSOL / AIR QUALITY",
      rows: [
        { sym: "Precip 24h", unit: conv.precipUnit(), label: "Daily Accumulation", key: "precip", dec: state.units === "imperial" ? 2 : 1 },
        { sym: "PoP / Hrs", unit: "% · h", label: "Precip Prob & Duration", custom: (s) => `${s.pop}% · ${s.precipHrs}h` },
        { sym: "ET₀", unit: conv.precipUnit() + "/d", label: "FAO Evapotranspiration", key: "et0", dec: 2 },
        { sym: "P − ET₀", unit: conv.precipUnit(), label: "Net Moisture Balance", key: "moistureBal", dec: state.units === "imperial" ? 2 : 1 },
        { sym: "US AQI", unit: "idx", label: "EPA Air Quality Index", key: "aqi", dec: 0 },
        { sym: "PM2.5 / PM10", unit: "μg/m³", label: "Particulate Matter", custom: (s) => `${s.pm25 ?? "--"} / ${s.pm10 ?? "--"}` },
        { sym: "O₃ / AOD", unit: "μg · τ550", label: "Ozone & Aerosol Opt Depth", custom: (s) => `${s.o3 ?? "--"} · ${s.aod ?? "--"}` },
      ],
    },
    {
      title: "6 · SOLAR EPHEMERIS & GEODESY",
      rows: [
        { sym: "SR / SS", unit: "LST", label: "Local Sunrise / Sunset", custom: (s) => `${s.sunrise} / ${s.sunset}` },
        { sym: "Daylight", unit: "h:m", label: "Photoperiod Duration", custom: (s) => formatDurationHm(s.daylight) },
        {
          sym: "Sunshine",
          unit: "h:m (%)",
          label: "Direct Insolation Duration",
          custom: (s) => {
            const pct = s.daylight > 0 ? Math.round((s.sunshine / s.daylight) * 100) : 0;
            return `${formatDurationHm(s.sunshine)} (${pct}%)`;
          },
        },
        { sym: "Elevation", unit: conv.altUnit() + " MSL", label: "Barometric Station Height", key: "elev", dec: 0 },
        { sym: "Coordinates", unit: "WGS84", label: "Geodetic Lat / Lon", custom: (s) => s.coords },
      ],
    },
  ];

  const refSnap = snaps[state.refIdx] || snaps[0];

  let groupsHtml = "";
  groups.forEach((grp) => {
    let headerCols = "";
    for (let c = 0; c < 3; c++) {
      const snap = snaps[c];
      if (snap) {
        const code = shortCode(snap.city.location);
        const refTag = c === state.refIdx && state.showDelta && snaps.length > 1 ? "•" : "";
        headerCols += `<div class="tg-city-col" style="--slot-color: var(--city-${c})">${refTag}${code}</div>`;
      } else {
        headerCols += `<div class="tg-city-col" style="color:var(--text-quaternary)">---</div>`;
      }
    }

    let rowsHtml = "";
    grp.rows.forEach((r) => {
      let colsHtml = "";
      for (let c = 0; c < 3; c++) {
        const snap = snaps[c];
        if (!snap) {
          colsHtml += `<div class="t-val-cell empty">--</div>`;
          continue;
        }
        if (r.custom) {
          colsHtml += `<div class="t-val-cell">${r.custom(snap, c)}</div>`;
        } else {
          const val = snap[r.key];
          const refVal = refSnap[r.key];
          const formatted =
            val !== null && val !== undefined && Number.isFinite(val)
              ? Number(val).toFixed(r.dec ?? 1)
              : "--";

          let deltaSub = "";
          if (
            state.showDelta &&
            snaps.length > 1 &&
            c !== state.refIdx &&
            Number.isFinite(val) &&
            Number.isFinite(refVal)
          ) {
            const dVal = val - refVal;
            const cls = dVal > 0 ? "pos" : dVal < 0 ? "neg" : "";
            deltaSub = `<span class="t-delta-sub ${cls}">${fmtSigned(dVal, r.dec ?? 1)}</span>`;
          }
          colsHtml += `<div class="t-val-cell"><span>${formatted}</span>${deltaSub}</div>`;
        }
      }

      rowsHtml += `
        <div class="telemetry-row">
          <div class="t-param-cell">
            <div class="t-param-main">
              <span class="t-symbol">${r.sym}</span>
              <span class="t-unit">${r.unit}</span>
            </div>
            <span class="t-label">${r.label}</span>
          </div>
          ${colsHtml}
        </div>
      `;
    });

    groupsHtml += `
      <div class="telemetry-group-card">
        <div class="telemetry-group-header">
          <div class="tg-title">${grp.title}</div>
          ${headerCols}
        </div>
        <div class="telemetry-rows">${rowsHtml}</div>
      </div>
    `;
  });

  els.telemetryGroupsGrid.innerHTML = groupsHtml;
}

// 8. Station Picker Modal & Search
function openStationModal(replaceSlotIdx = null) {
  state.replaceSlotIdx = replaceSlotIdx;
  els.stationModal.classList.add("open");
  els.stationModal.setAttribute("aria-hidden", "false");
  els.searchInput.value = "";
  els.btnClearSearch.style.display = "none";

  renderModalActiveBar();
  renderModalPresets();
  renderStationList(state.curatedCities);
  setTimeout(() => els.searchInput.focus(), 60);
}

function closeStationModal() {
  els.stationModal.classList.remove("open");
  els.stationModal.setAttribute("aria-hidden", "true");
  state.replaceSlotIdx = null;
}

function renderModalActiveBar() {
  let html = "";
  state.selectedLocations.forEach((loc, idx) => {
    const isReplacing = state.replaceSlotIdx === idx;
    html += `
      <div class="active-slot-chip" style="--slot-rgb: var(--city-${idx}-rgb)">
        <span>#${idx + 1} ${escapeHtml(loc.name)} ${isReplacing ? "(Swapping)" : ""}</span>
        ${
          state.selectedLocations.length > 1
            ? `<button type="button" data-rem-idx="${idx}" title="Remove">×</button>`
            : ""
        }
      </div>
    `;
  });
  els.sheetActiveBar.innerHTML = html;

  els.sheetActiveBar.querySelectorAll("button[data-rem-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remIdx);
      removeStationAt(idx);
      renderStationList(state.curatedCities);
    });
  });
}

function renderModalPresets() {
  let html = "";
  state.presets.forEach((p) => {
    html += `
      <button type="button" class="preset-card-btn" data-preset-id="${p.id}">
        <span class="preset-code-line">${escapeHtml(p.label)}</span>
        <span class="preset-tag-line">${escapeHtml(p.tag)}</span>
      </button>
    `;
  });
  els.presetChipsRow.innerHTML = html;

  els.presetChipsRow.querySelectorAll(".preset-card-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const preset = state.presets.find((p) => p.id === btn.dataset.presetId);
      if (!preset) return;
      const locs = preset.cityIds
        .map((id) => state.curatedCities.find((c) => c.id === id))
        .filter(Boolean);
      if (locs.length) {
        state.selectedLocations = locs.slice(0, 3);
        saveSelectedLocations();
        closeStationModal();
        await refreshWeatherData();
      }
    });
  });
}

function renderStationList(locations) {
  if (!locations.length) {
    els.sheetStationList.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-tertiary)">No matching synoptic stations found.</div>`;
    return;
  }

  let html = "";
  locations.forEach((loc, i) => {
    const existingIdx = state.selectedLocations.findIndex(
      (s) => Math.abs(s.latitude - loc.latitude) < 0.1 && Math.abs(s.longitude - loc.longitude) < 0.1
    );
    const isSelected = existingIdx >= 0;

    let actionLabel = "+ Add";
    if (isSelected) {
      actionLabel = `Slot #${existingIdx + 1}`;
    } else if (state.replaceSlotIdx !== null) {
      actionLabel = `Swap #${state.replaceSlotIdx + 1}`;
    } else if (state.selectedLocations.length >= 3) {
      actionLabel = "Swap #3";
    }

    html += `
      <div class="station-list-item" data-list-idx="${i}">
        <div class="st-item-left">
          <div class="st-item-name">
            <span>${escapeHtml(loc.name)}</span>
            ${loc.icao ? `<span class="st-item-icao">${escapeHtml(loc.icao)}</span>` : ""}
          </div>
          <div class="st-item-meta">
            ${escapeHtml(loc.admin1 ? `${loc.admin1}, ` : "")}${escapeHtml(loc.country)} · ${loc.elevation}m · ${formatCoord(loc.latitude, loc.longitude)}
          </div>
        </div>
        <span class="st-item-action ${isSelected ? "selected" : ""}">${actionLabel}</span>
      </div>
    `;
  });

  els.sheetStationList.innerHTML = html;

  els.sheetStationList.querySelectorAll(".station-list-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const loc = locations[Number(item.dataset.listIdx)];
      if (!loc) return;

      const existingIdx = state.selectedLocations.findIndex(
        (s) => Math.abs(s.latitude - loc.latitude) < 0.1 && Math.abs(s.longitude - loc.longitude) < 0.1
      );

      if (existingIdx >= 0) {
        if (state.selectedLocations.length > 1) {
          state.selectedLocations.splice(existingIdx, 1);
        }
      } else if (state.replaceSlotIdx !== null && state.replaceSlotIdx < state.selectedLocations.length) {
        state.selectedLocations[state.replaceSlotIdx] = loc;
        state.replaceSlotIdx = null;
        closeStationModal();
      } else if (state.selectedLocations.length < 3) {
        state.selectedLocations.push(loc);
        if (state.selectedLocations.length === 3) {
          closeStationModal();
        }
      } else {
        // Replace slot 3 when already at 3 cities
        state.selectedLocations[2] = loc;
        closeStationModal();
      }

      saveSelectedLocations();
      renderModalActiveBar();
      renderStationList(locations);
      await refreshWeatherData();
    });
  });
}

// Interactive Events Binding
function bindEvents() {
  // Theme toggle
  els.btnThemeToggle.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });

  // Delta Reference toggle
  els.btnDeltaToggle.addEventListener("click", () => {
    state.showDelta = !state.showDelta;
    els.btnDeltaToggle.classList.toggle("active", state.showDelta);
    renderAll();
  });

  // Unit system toggle
  els.unitSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.units = btn.dataset.unit;
      localStorage.setItem("wx_units", state.units);
      els.unitSegmented.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      renderAll();
    });
  });

  // Chart Mode Segmented Control
  els.chartModeSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.chartMode = btn.dataset.mode;
      state.scrubIdx = 0;
      els.chartModeSegmented.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      renderLegendBar();
      renderScrubberReadout();
      renderChart();
    });
  });

  // Horizon Segmented Control (7D / 10D / 14D)
  els.horizonSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.horizonDays = Number(btn.dataset.days);
      els.horizonSegmented.querySelectorAll(".seg-btn").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      renderScrubberReadout();
      renderChart();
      renderChartFooterMetrics();
      renderDailyMatrix();
    });
  });

  // Diurnal LST / UTC Alignment Segmented Control
  if (els.diurnalAlignSegmented) {
    els.diurnalAlignSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.diurnalAlign = btn.dataset.align;
        els.diurnalAlignSegmented.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderScrubberReadout();
        renderChart();
      });
    });
  }

  // Reset locked day button
  els.btnResetDay.addEventListener("click", () => {
    state.lockedDayIdx = null;
    renderDailyMatrix();
    renderTelemetryInspector();
  });

  // Canvas pointer & touch scrubbing
  const handlePointerScrub = (clientX) => {
    if (!state.weatherData.length) return;
    const rect = els.canvas.getBoundingClientRect();
    const padL = 38;
    const padR = 38;
    const plotW = Math.max(1, rect.width - padL - padR);
    const relX = Math.max(0, Math.min(plotW, clientX - rect.left - padL));

    const c0 = state.weatherData[0];
    const count =
      state.chartMode === "diurnal"
        ? 72
        : Math.min(state.horizonDays, c0.daily.length);

    const newIdx = Math.round((relX / plotW) * Math.max(0, count - 1));
    if (newIdx !== state.scrubIdx) {
      state.scrubIdx = newIdx;
      renderScrubberReadout();
      renderChart();
    }
  };

  let isDragging = false;
  els.canvas.addEventListener("pointerdown", (e) => {
    isDragging = true;
    handlePointerScrub(e.clientX);
  });
  window.addEventListener("pointermove", (e) => {
    if (isDragging || e.target === els.canvas) {
      handlePointerScrub(e.clientX);
    }
  });
  window.addEventListener("pointerup", () => {
    isDragging = false;
  });

  // Touch scrubbing on mobile
  els.canvas.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length > 0) {
        handlePointerScrub(e.touches[0].clientX);
      }
    },
    { passive: true }
  );

  // Window resize
  window.addEventListener("resize", () => {
    renderSynopticMap();
    renderChart();
  });

  // Map View Mode Segmented Control (Global vs Focus Triad)
  if (els.mapViewSegmented) {
    els.mapViewSegmented.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mapView = btn.dataset.view;
        els.mapViewSegmented.querySelectorAll(".seg-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        renderSynopticMap();
      });
    });
  }

  // Map LIVE reset button
  if (els.btnMapLive) {
    els.btnMapLive.addEventListener("click", () => {
      state.solarOffsetMin = 0;
      if (els.solarTimeSlider) els.solarTimeSlider.value = "0";
      els.btnMapLive.classList.add("active");
      renderSynopticMap();
    });
  }

  // Solar Time Offset Slider (-12h .. +12h)
  if (els.solarTimeSlider) {
    els.solarTimeSlider.addEventListener("input", () => {
      state.solarOffsetMin = Number(els.solarTimeSlider.value);
      if (els.btnMapLive) {
        els.btnMapLive.classList.toggle("active", state.solarOffsetMin === 0);
      }
      renderSynopticMap();
    });
  }

  // Map Canvas Click / Tap to select REF station or add background station
  if (els.mapCanvas) {
    els.mapCanvas.addEventListener("click", async (e) => {
      const rect = els.mapCanvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Find closest hit target within radius
      let best = null;
      let bestDist = Infinity;
      for (const t of state.mapHitTargets) {
        const d = Math.hypot(mx - t.x, my - t.y);
        if (d <= t.r && d < bestDist) {
          best = t;
          bestDist = d;
        }
      }

      if (!best) return;

      if (best.type === "selected") {
        // Set as REF station (or toggle solo if already REF)
        if (state.refIdx === best.idx) {
          state.soloIdx = state.soloIdx === best.idx ? null : best.idx;
        } else {
          state.refIdx = best.idx;
        }
        renderAll();
      } else if (best.type === "curated" && best.loc) {
        // Add or swap into slot #3
        if (state.selectedLocations.length < 3) {
          state.selectedLocations.push(best.loc);
        } else {
          state.selectedLocations[2] = best.loc;
        }
        saveSelectedLocations();
        await refreshWeatherData();
      }
    });
  }

  // Open/Close Modal
  els.btnAddStation.addEventListener("click", () => openStationModal(null));
  els.btnOpenPresets.addEventListener("click", () => openStationModal(null));
  els.btnCloseModal.addEventListener("click", closeStationModal);
  els.stationModal.addEventListener("click", (e) => {
    if (e.target === els.stationModal) closeStationModal();
  });

  // Search Input with debounce
  let searchTimer = null;
  els.searchInput.addEventListener("input", () => {
    const q = els.searchInput.value.trim();
    els.btnClearSearch.style.display = q ? "block" : "none";
    els.searchResultsCaption.textContent = q ? `SEARCH RESULTS FOR "${q.toUpperCase()}"` : "GLOBAL SYNOPTIC STATIONS";
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (!q) {
        renderStationList(state.curatedCities);
        return;
      }
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        renderStationList(data.results || []);
      } catch {
        renderStationList([]);
      }
    }, 180);
  });

  els.btnClearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    els.btnClearSearch.style.display = "none";
    els.searchResultsCaption.textContent = "GLOBAL SYNOPTIC STATIONS";
    renderStationList(state.curatedCities);
    els.searchInput.focus();
  });

  // GPS Geolocation Station
  els.btnUseGps.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    els.btnUseGps.textContent = "Locating...";
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        els.btnUseGps.innerHTML = `<span>GPS</span>`;
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        const gpsLoc = {
          id: `gps_${lat}_${lon}`,
          name: "GPS Local",
          country: "Coordinates",
          country_code: "GPS",
          latitude: lat,
          longitude: lon,
          elevation: Math.round(pos.coords.altitude || 15),
          timezone: "auto",
          icao: "LOCL",
        };
        if (state.selectedLocations.length < 3) {
          state.selectedLocations.push(gpsLoc);
        } else {
          state.selectedLocations[2] = gpsLoc;
        }
        saveSelectedLocations();
        closeStationModal();
        await refreshWeatherData();
      },
      () => {
        els.btnUseGps.innerHTML = `<span>GPS</span>`;
      },
      { timeout: 6000 }
    );
  });
}

// ============================================================================
// 9. Astronomical Solar Ephemeris & Real-Time Solar Terminator Map Engine
// ============================================================================
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Offscreen 360x180 shader buffer for smooth atmospheric twilight & night shadows
const solarShaderCanvas = document.createElement("canvas");
solarShaderCanvas.width = 360;
solarShaderCanvas.height = 180;
const solarShaderCtx = solarShaderCanvas.getContext("2d");

function computeSolarEphemeris(timestampMs) {
  // Days since J2000.0 epoch (2000-01-01T12:00:00Z = JD 2451545.0)
  const d = timestampMs / 86400000 - 10957.5;

  // Mean longitude & mean anomaly of the Sun (degrees)
  const L = ((280.460 + 0.9856474 * d) % 360 + 360) % 360;
  const g = ((357.528 + 0.9856003 * d) % 360 + 360) % 360;
  const gRad = g * DEG2RAD;

  // Ecliptic longitude (degrees) & Obliquity of ecliptic
  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad);
  const lambdaRad = lambda * DEG2RAD;
  const epsilon = 23.439 - 0.0000004 * d;
  const epsRad = epsilon * DEG2RAD;

  // Solar Declination δ
  const sinDec = Math.sin(epsRad) * Math.sin(lambdaRad);
  const cosDec = Math.sqrt(Math.max(1e-8, 1 - sinDec * sinDec));
  const decDeg = Math.asin(sinDec) * RAD2DEG;

  // Right Ascension α_RA & Equation of Time (minutes)
  const raDeg = ((Math.atan2(Math.cos(epsRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * RAD2DEG) % 360 + 360) % 360;
  let dRa = L - raDeg;
  if (dRa > 180) dRa -= 360;
  if (dRa < -180) dRa += 360;
  const eotMinutes = dRa * 4;

  // Subsolar Longitude λ_s from fractional UTC hour + Equation of Time
  const dt = new Date(timestampMs);
  const utcHours = dt.getUTCHours() + dt.getUTCMinutes() / 60 + dt.getUTCSeconds() / 3600;
  let subsolarLon = -15 * (utcHours - 12 + eotMinutes / 60);
  subsolarLon = ((((subsolarLon + 180) % 360) + 360) % 360) - 180;
  const subsolarLat = decDeg;

  let antisolarLon = subsolarLon + 180;
  if (antisolarLon > 180) antisolarLon -= 360;
  const antisolarLat = -subsolarLat;

  return {
    timestampMs,
    decDeg,
    sinDec,
    cosDec,
    eotMinutes,
    subsolarLat,
    subsolarLon,
    antisolarLat,
    antisolarLon,
  };
}

function computeSolarAtCoord(latDeg, lonDeg, ephem) {
  const latRad = latDeg * DEG2RAD;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const hRad = (lonDeg - ephem.subsolarLon) * DEG2RAD;
  const cosH = Math.cos(hRad);
  const sinH = Math.sin(hRad);

  const sinAlt = Math.max(-1, Math.min(1, sinLat * ephem.sinDec + cosLat * ephem.cosDec * cosH));
  const altDeg = Math.asin(sinAlt) * RAD2DEG;

  const y = -sinH * ephem.cosDec;
  const x = cosLat * ephem.sinDec - sinLat * ephem.cosDec * cosH;
  const azDeg = ((Math.atan2(y, x) * RAD2DEG) % 360 + 360) % 360;

  let phase = "NIGHT";
  let phaseClass = "night";
  if (altDeg >= -0.833) {
    phase = "DAY";
    phaseClass = "day";
  } else if (altDeg >= -6) {
    phase = "CIV TWIL";
    phaseClass = "twil";
  } else if (altDeg >= -12) {
    phase = "NAUT TWIL";
    phaseClass = "twil";
  } else if (altDeg >= -18) {
    phase = "ASTR TWIL";
    phaseClass = "twil";
  }

  return { altDeg, azDeg, phase, phaseClass };
}

function greatCircleDistanceKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

function greatCirclePoints(lat1, lon1, lat2, lon2, segments = 48) {
  const phi1 = lat1 * DEG2RAD;
  const lam1 = lon1 * DEG2RAD;
  const phi2 = lat2 * DEG2RAD;
  const lam2 = lon2 * DEG2RAD;

  const v1 = [Math.cos(phi1) * Math.cos(lam1), Math.cos(phi1) * Math.sin(lam1), Math.sin(phi1)];
  const v2 = [Math.cos(phi2) * Math.cos(lam2), Math.cos(phi2) * Math.sin(lam2), Math.sin(phi2)];
  const dot = Math.max(-1, Math.min(1, v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x, y, z;
    if (sinOmega < 1e-5) {
      x = v1[0] + t * (v2[0] - v1[0]);
      y = v1[1] + t * (v2[1] - v1[1]);
      z = v1[2] + t * (v2[2] - v1[2]);
    } else {
      const a = Math.sin((1 - t) * omega) / sinOmega;
      const b = Math.sin(t * omega) / sinOmega;
      x = a * v1[0] + b * v2[0];
      y = a * v1[1] + b * v2[1];
      z = a * v1[2] + b * v2[2];
    }
    const lat = Math.atan2(z, Math.hypot(x, y)) * RAD2DEG;
    const lon = Math.atan2(y, x) * RAD2DEG;
    pts.push([lon, lat]);
  }
  return pts;
}

function renderSynopticMap() {
  const canvas = els.mapCanvas;
  if (!canvas || !els.mapCanvasStage) return;

  const rect = els.mapCanvasStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(280, Math.floor(rect.width));
  const H = Math.max(175, Math.floor(rect.height));

  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width = W * dpr;
    canvas.height = H * dpr;
  }

  const targetMs = Date.now() + state.solarOffsetMin * 60000;
  const ephem = computeSolarEphemeris(targetMs);
  const isDark = state.theme === "dark";

  // Update Top Time Badge & Ephemeris Strip
  const dt = new Date(targetMs);
  const utcStr = `${dt.toISOString().slice(5, 10)} ${dt.toISOString().slice(11, 16)}Z`;
  if (els.mapTimeBadge) {
    if (state.solarOffsetMin === 0) {
      els.mapTimeBadge.textContent = `LIVE · ${utcStr}`;
    } else {
      const offHr = (state.solarOffsetMin / 60).toFixed(1);
      els.mapTimeBadge.textContent = `OFFSET ${state.solarOffsetMin > 0 ? "+" : ""}${offHr}H · ${utcStr}`;
    }
  }

  if (els.mapEphemerisStrip) {
    const eotSign = ephem.eotMinutes >= 0 ? "+" : "-";
    const eotAbs = Math.abs(ephem.eotMinutes);
    const eotM = Math.floor(eotAbs);
    const eotS = Math.round((eotAbs - eotM) * 60);
    els.mapEphemerisStrip.innerHTML = `
      <span class="ephem-item"><span class="ephem-key">☉ ZENITH</span><span class="ephem-val">${formatCoord(ephem.subsolarLat, ephem.subsolarLon)}</span></span>
      <span class="ephem-item"><span class="ephem-key">δ</span><span class="ephem-val">${fmtSigned(ephem.decDeg, 2, "°")}</span></span>
      <span class="ephem-item"><span class="ephem-key">EoT</span><span class="ephem-val">${eotSign}${eotM}m${String(eotS).padStart(2, "0")}s</span></span>
    `;
  }

  // Determine Map Viewport Domain (Global vs Focus Triad)
  let lonMin = -180;
  let lonMax = 180;
  let latMin = -72;
  let latMax = 80;

  const activeLocs = state.weatherData.length
    ? state.weatherData.map((w) => w.location)
    : state.selectedLocations;

  if (state.mapView === "focus" && activeLocs.length > 0) {
    let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity;
    activeLocs.forEach((l) => {
      if (l.latitude < minLa) minLa = l.latitude;
      if (l.latitude > maxLa) maxLa = l.latitude;
      if (l.longitude < minLo) minLo = l.longitude;
      if (l.longitude > maxLo) maxLo = l.longitude;
    });
    const latSpan = Math.max(28, (maxLa - minLa) * 1.65);
    const lonSpan = Math.max(55, (maxLo - minLo) * 1.55);
    const cLat = (minLa + maxLa) / 2;
    const cLon = (minLo + maxLo) / 2;
    const aspect = W / H;
    let finalLonSpan = Math.max(lonSpan, latSpan * aspect);
    let finalLatSpan = finalLonSpan / aspect;
    if (finalLonSpan > 340) {
      lonMin = -180;
      lonMax = 180;
      latMin = -72;
      latMax = 80;
    } else {
      lonMin = Math.max(-180, cLon - finalLonSpan / 2);
      lonMax = Math.min(180, lonMin + finalLonSpan);
      lonMin = Math.max(-180, lonMax - finalLonSpan);
      latMin = Math.max(-75, cLat - finalLatSpan / 2);
      latMax = Math.min(82, latMin + finalLatSpan);
      latMin = Math.max(-75, latMax - finalLatSpan);
    }
  }

  const projX = (lon) => ((lon - lonMin) / (lonMax - lonMin)) * W;
  const projY = (lat) => ((latMax - lat) / (latMax - latMin)) * H;

  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);

  // 1. Ocean Base Fill
  ctx.fillStyle = isDark ? "#07101e" : "#cadff0";
  ctx.fillRect(0, 0, W, H);

  // 2. Vector Continents & Country Borders (Natural Earth 110m)
  if (state.worldData) {
    ctx.save();
    ctx.fillStyle = isDark ? "#182538" : "#eef2f6";
    ctx.strokeStyle = isDark ? "rgba(120, 165, 220, 0.25)" : "rgba(60, 85, 115, 0.35)";
    ctx.lineWidth = 0.7;

    for (const poly of state.worldData.land) {
      for (const ring of poly) {
        if (!ring.length) continue;
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const x = projX(ring[i][0]);
          const y = projY(ring[i][1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Subtle geopolitical borders
    if (state.worldData.borders) {
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(60, 80, 100, 0.16)";
      ctx.lineWidth = 0.5;
      for (const line of state.worldData.borders) {
        if (!line.length) continue;
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const x = projX(line[i][0]);
          const y = projY(line[i][1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 3. Real-Time Multi-Band Solar Elevation & Twilight Shadow Shader
  const sw = 360;
  const sh = 180;
  const imgData = solarShaderCtx.createImageData(sw, sh);
  const buf = imgData.data;

  // Precompute sin/cos latitude rows
  const sinLats = new Float32Array(sh);
  const cosLats = new Float32Array(sh);
  for (let py = 0; py < sh; py++) {
    const lat = latMax - ((py + 0.5) / sh) * (latMax - latMin);
    const r = lat * DEG2RAD;
    sinLats[py] = Math.sin(r);
    cosLats[py] = Math.cos(r);
  }

  // Precompute cos hour-angle columns
  const cosHs = new Float32Array(sw);
  for (let px = 0; px < sw; px++) {
    const lon = lonMin + ((px + 0.5) / sw) * (lonMax - lonMin);
    cosHs[px] = Math.cos((lon - ephem.subsolarLon) * DEG2RAD);
  }

  let ptr = 0;
  for (let py = 0; py < sh; py++) {
    const sLat = sinLats[py];
    const cLat = cosLats[py];
    for (let px = 0; px < sw; px++) {
      const sinAlt = sLat * ephem.sinDec + cLat * ephem.cosDec * cosHs[px];
      const altDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD2DEG;

      if (altDeg >= 0) {
        // Daylit hemisphere: subtle solar zenith warmth when altitude > 55°
        if (altDeg > 55) {
          const intensity = (altDeg - 55) / 35;
          buf[ptr] = 255;
          buf[ptr + 1] = 200;
          buf[ptr + 2] = 90;
          buf[ptr + 3] = Math.round(intensity * (isDark ? 34 : 28));
        } else {
          buf[ptr + 3] = 0;
        }
      } else {
        // Twilight & Umbral Night multi-stage shadow
        // Smooth transition from 0° -> -6° (Civil) -> -12° (Nautical) -> -18° (Astronomical) -> Umbral
        let alpha = 0;
        if (altDeg >= -6) {
          alpha = ((0 - altDeg) / 6) * 0.28;
        } else if (altDeg >= -12) {
          alpha = 0.28 + ((-6 - altDeg) / 6) * 0.22;
        } else if (altDeg >= -18) {
          alpha = 0.5 + ((-12 - altDeg) / 6) * 0.16;
        } else {
          alpha = 0.66;
        }
        buf[ptr] = isDark ? 1 : 8;
        buf[ptr + 1] = isDark ? 3 : 14;
        buf[ptr + 2] = isDark ? 10 : 32;
        buf[ptr + 3] = Math.round(alpha * (isDark ? 235 : 175));
      }
      ptr += 4;
    }
  }
  solarShaderCtx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(solarShaderCanvas, 0, 0, W, H);
  ctx.restore();

  // 4. Graticule & Astronomical Parallels (Equator, Tropics, Polar Circles)
  ctx.save();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  for (let lon = -150; lon <= 150; lon += 30) {
    if (lon < lonMin || lon > lonMax) continue;
    const x = projX(lon);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    if (lat < latMin || lat > latMax) continue;
    const y = projY(lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Equator & Tropics
  const parallels = [
    { lat: 0, dash: [], color: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)" },
    { lat: 23.439, dash: [3, 4], color: isDark ? "rgba(255,159,10,0.18)" : "rgba(234,128,0,0.22)" },
    { lat: -23.439, dash: [3, 4], color: isDark ? "rgba(255,159,10,0.18)" : "rgba(234,128,0,0.22)" },
    { lat: 66.56, dash: [2, 4], color: isDark ? "rgba(100,210,255,0.18)" : "rgba(0,122,255,0.2)" },
  ];
  parallels.forEach((p) => {
    if (p.lat < latMin || p.lat > latMax) return;
    const y = projY(p.lat);
    ctx.strokeStyle = p.color;
    ctx.setLineDash(p.dash);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  });
  ctx.restore();

  // 5. Analytical Solar Terminator Curve (0° Horizon) & Civil Twilight (-6°) Contour
  const tanDec = Math.abs(ephem.sinDec / ephem.cosDec) < 1e-4 ? 1e-4 : ephem.sinDec / ephem.cosDec;
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255, 179, 64, 0.72)" : "rgba(234, 128, 0, 0.75)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let px = 0; px <= W; px += 2) {
    const lon = lonMin + (px / W) * (lonMax - lonMin);
    const hRad = (lon - ephem.subsolarLon) * DEG2RAD;
    const termLat = Math.atan(-Math.cos(hRad) / tanDec) * RAD2DEG;
    const py = projY(termLat);
    if (px === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  // 6. Subsolar Zenith Point (☉) & Antisolar Midnight Point (☾)
  if (
    ephem.subsolarLon >= lonMin &&
    ephem.subsolarLon <= lonMax &&
    ephem.subsolarLat >= latMin &&
    ephem.subsolarLat <= latMax
  ) {
    const sx = projX(ephem.subsolarLon);
    const sy = projY(ephem.subsolarLat);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 196, 60, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 11, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  state.mapHitTargets = [];

  // 7. Background Curated Synoptic Station Dots (Tap to add/swap)
  ctx.save();
  state.curatedCities.forEach((loc) => {
    if (loc.longitude < lonMin || loc.longitude > lonMax || loc.latitude < latMin || loc.latitude > latMax) return;
    const isSel = activeLocs.some(
      (a) => Math.abs(a.latitude - loc.latitude) < 0.15 && Math.abs(a.longitude - loc.longitude) < 0.15
    );
    if (isSel) return;

    const x = projX(loc.longitude);
    const y = projY(loc.latitude);
    ctx.fillStyle = isDark ? "rgba(235, 235, 245, 0.28)" : "rgba(60, 60, 67, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y, 2.3, 0, Math.PI * 2);
    ctx.fill();

    state.mapHitTargets.push({ x, y, r: 10, type: "curated", loc });
  });
  ctx.restore();

  // 8. Great-Circle Geodesic Arcs Connecting Reference Station (REF) to Selected Stations
  const refLoc = activeLocs[state.refIdx] || activeLocs[0];
  if (refLoc && activeLocs.length > 1) {
    activeLocs.forEach((loc, idx) => {
      if (idx === state.refIdx) return;
      const arcPts = greatCirclePoints(refLoc.latitude, refLoc.longitude, loc.latitude, loc.longitude, 56);
      const color = isDark ? SLOT_COLORS[idx].hex : SLOT_COLORS[idx].lightHex;
      const rgb = SLOT_COLORS[idx].rgb;

      ctx.save();
      ctx.strokeStyle = `rgba(${rgb}, 0.55)`;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < arcPts.length; i++) {
        const [lon, lat] = arcPts[i];
        const x = projX(lon);
        const y = projY(lat);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Avoid drawing horizontal line across entire map on antimeridian wrap
          const prevLon = arcPts[i - 1][0];
          if (Math.abs(lon - prevLon) > 160) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    });
  }

  // 9. Selected Station Indicators & Floating HUD Callouts
  const labelBoxes = [];
  const stationSolarCellsHtml = [];

  activeLocs.forEach((loc, idx) => {
    const wx = state.weatherData[idx];
    const color = isDark ? SLOT_COLORS[idx].hex : SLOT_COLORS[idx].lightHex;
    const rgb = SLOT_COLORS[idx].rgb;
    const isRef = idx === state.refIdx;
    const code = shortCode(loc);
    const solar = computeSolarAtCoord(loc.latitude, loc.longitude, ephem);

    const x = projX(loc.longitude);
    const y = projY(loc.latitude);

    // Hit target for clicking station on map
    state.mapHitTargets.push({ x, y, r: 18, type: "selected", idx, loc });

    // Draw Wind Direction Vector Barb if weather loaded
    if (wx && wx.current) {
      const windRad = ((wx.current.wind_dir + 180) - 90) * DEG2RAD;
      const barbLen = 15;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(windRad) * barbLen, y + Math.sin(windRad) * barbLen);
      ctx.stroke();
      ctx.restore();
    }

    // Outer Radar Reticle Ring
    ctx.save();
    ctx.fillStyle = `rgba(${rgb}, 0.22)`;
    ctx.beginPath();
    ctx.arc(x, y, isRef ? 11 : 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = isRef ? 1.6 : 1.1;
    ctx.beginPath();
    ctx.arc(x, y, isRef ? 11 : 8.5, 0, Math.PI * 2);
    ctx.stroke();

    // REF station crosshair ticks
    if (isRef) {
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.lineTo(x - 9, y);
      ctx.moveTo(x + 9, y);
      ctx.lineTo(x + 14, y);
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x, y - 9);
      ctx.moveTo(x, y + 9);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
    }

    // Solid Core Station Node
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? "#000000" : "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // Prepare HUD Callout Tag for this station
    const tempStr = wx ? `${conv.temp(wx.current.temp).toFixed(1)}°` : "";
    const sunIcon = solar.altDeg >= -0.833 ? "☉" : "☾";
    const hudText = `${code} ${tempStr} ${sunIcon}${fmtSigned(solar.altDeg, 0, "°")}`;

    labelBoxes.push({
      idx,
      ax: x,
      ay: y,
      lx: x,
      ly: y - 18,
      text: hudText,
      color,
      rgb,
      isRef,
    });

    // Bottom bar solar & geodesic summary cell
    const gcDistKm =
      refLoc && !isRef
        ? Math.round(greatCircleDistanceKm(refLoc.latitude, refLoc.longitude, loc.latitude, loc.longitude))
        : 0;
    const distStr = isRef
      ? "REF ORIGIN"
      : state.units === "imperial"
      ? `${Math.round(gcDistKm * 0.539957)} NM`
      : `${gcDistKm} km`;

    stationSolarCellsHtml.push(`
      <div class="map-solar-cell" style="--slot-color: var(--city-${idx})">
        <div class="map-solar-head">
          <span>${escapeHtml(loc.name)} (${code})</span>
          <span class="solar-phase-pill ${solar.phaseClass}">${solar.phase}</span>
        </div>
        <div class="map-solar-sub">
          α ${fmtSigned(solar.altDeg, 1, "°")} · Az ${Math.round(solar.azDeg)}° · ${distStr}
        </div>
      </div>
    `);
  });

  // Collision-resolved HUD callout pills on canvas
  ctx.save();
  ctx.font = '700 10px "SF Mono", ui-monospace, Menlo, monospace';
  labelBoxes.forEach((b) => {
    const tw = ctx.measureText(b.text).width;
    b.w = tw + 10;
    b.h = 16;
    b.lx = Math.max(b.w / 2 + 4, Math.min(W - b.w / 2 - 4, b.ax));
    b.ly = b.ay < 32 ? b.ay + 19 : b.ay - 19;
  });

  // Simple pairwise vertical separation if boxes overlap
  for (let i = 0; i < labelBoxes.length; i++) {
    for (let j = i + 1; j < labelBoxes.length; j++) {
      const a = labelBoxes[i];
      const b = labelBoxes[j];
      if (Math.abs(a.lx - b.lx) < (a.w + b.w) / 2 + 4 && Math.abs(a.ly - b.ly) < 17) {
        b.ly = a.ly + (b.ay >= a.ay ? 18 : -18);
      }
    }
  }

  labelBoxes.forEach((b) => {
    const rx = b.lx - b.w / 2;
    const ry = b.ly - b.h / 2;

    // Leader line from station node to pill
    ctx.strokeStyle = `rgba(${b.rgb}, 0.65)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.ax, b.ay);
    ctx.lineTo(b.lx, b.ly);
    ctx.stroke();

    ctx.fillStyle = isDark ? "rgba(18, 20, 26, 0.88)" : "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(rx, ry, b.w, b.h, 4.5);
    ctx.fill();

    ctx.strokeStyle = b.color;
    ctx.lineWidth = b.isRef ? 1.3 : 0.85;
    ctx.stroke();

    ctx.fillStyle = isDark ? "#f5f5f7" : "#1c1c1e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, b.lx, b.ly + 0.5);
  });
  ctx.restore();

  if (els.mapStationSolarRow) {
    els.mapStationSolarRow.innerHTML = stationSolarCellsHtml.join("");
  }

  ctx.restore();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

initApp();
