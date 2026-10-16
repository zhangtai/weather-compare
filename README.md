# WX · COMPARE — Multi-Station Meteorological Telemetry

A lightweight, zero-dependency web application built for the **Bun** runtime (`Bun.serve`) to compare forecasts and atmospheric telemetry across up to **3 cities simultaneously** with a native iOS Cupertino instrument interface.

## Quick Start

```bash
# Production server (default port 3000)
bun start

# Development with live reload
bun run dev
```

Open `http://localhost:3000` in your desktop or mobile browser (supports iOS Home Screen standalone PWA mode).

## Key Features

- **Up to 3 Simultaneous Synoptic Stations**:
  - Instant search across global cities (via Open-Meteo Geocoding API + curated ICAO station catalog) or 1-tap Climate Contrast Triads (`TYO · SFO · ZRH`, `SIN · DEN · REK`, `NYC · LON · HKG`, `TYO · TPE · SEL`) and GPS coordinates.
  - Tap any station card to designate it as the **`REF` baseline** for live cross-city delta (`Δ`) readouts.
- **High-DPI Temperature Range Area Chart**:
  - Smooth Fritsch–Carlson monotone cubic spline **Range Area (`T_min → T_max`)** bands with solid upper bounds, dashed lower bounds, daily range stems, global horizon extrema badges (`▲`, `▼`), and `0°C` / `32°F` freezing isotherm reference.
  - **4 Telemetry Chart Modes**:
    1. `H/L Range`: Daily Temperature High–Low Range Area (`7D`, `10D`, `14D`).
    2. `72H Diurnal`: Hourly 2m Temperature & Dew-Point Spread band, switchable between **Local Solar Time (`LST`)** and **Simultaneous UTC (`UTC`)**.
    3. `Td & VPD`: Dew Point High–Low Range Area & Wet-Bulb (`Tw`) envelope.
    4. `Wind & hPa`: 10m Sustained-to-Gust (`V10 → G10`) Range Area & MSLP trend.
  - **Solo / Band Isolation**: Tap any station chip in the chart legend to isolate its range area when bands overlap.
  - **60fps Touch & Pointer Scrubber**: Scrub across days or hours with live multi-city delta readouts.
- **Apple Weather-Style Daily Thermal Envelope Matrix**:
  - Normalized horizontal range bars for all active stations per day. Tap any day row to lock the Telemetry Inspector below to that forecast day.
- **Pure Nerd Stats (Zero Lifestyle Prose)**:
  - **Thermodynamics & Psychrometrics**: Dry-Bulb (`T2m`), Apparent (`T_app`), Diurnal Spread (`ΔT`), Dew Point (`Td`), Dew Point Depression (`T − Td`), Wet-Bulb (`Tw`), Vapor Pressure Deficit (`VPD` in `kPa`), Mixing Ratio (`w` in `g/kg`), Equivalent Potential Temperature (`θe` in `K`), Moist Air Density (`ρ` in `kg/m³`).
  - **Barometrics & Convective Dynamics**: `MSLP`, Station Surface Pressure (`P_sfc`), 3h/24h Pressure Tendency (`ΔP`), `CAPE` (`J/kg`), Planetary Boundary Layer Height (`PBLH`), Lifted Condensation Level (`LCL` cloud base estimate), and `0°C` Freezing Level Height.
  - **Kinematics, Radiation, Cloud Deck & Air Quality**: `V10`, `G10`, Gust Factor (`GF`), Wind Azimuth Vector, Low/Mid/High Cloud Layer (`CL / CM / CH`) tri-bars, Shortwave Irradiance (`SW↓`), Direct Normal Irradiance (`DNI`), FAO Evapotranspiration (`ET₀`), Net Moisture Balance (`P − ET₀`), `US AQI`, `PM2.5`, `PM10`, `O₃`, and Aerosol Optical Depth (`AOD`).
