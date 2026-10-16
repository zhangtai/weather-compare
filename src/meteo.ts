import { CURATED_CITIES, type CityLocation } from "./presets";

export interface DailyTelemetry {
  date: string;
  weather_code: number;
  temp_max: number;
  temp_min: number;
  temp_mean: number;
  temp_range: number; // T_max - T_min
  apparent_max: number;
  apparent_min: number;
  dew_point_max: number;
  dew_point_min: number;
  dew_point_mean: number;
  wet_bulb_mean: number;
  wet_bulb_max: number;
  rh_mean: number;
  rh_min: number;
  rh_max: number;
  vpd_max: number; // kPa
  vpd_mean: number; // kPa
  pressure_msl_mean: number; // hPa
  pressure_msl_min: number;
  pressure_msl_max: number;
  surface_pressure_mean: number; // hPa
  wind_speed_max: number; // km/h
  wind_gusts_max: number; // km/h
  wind_dir_dominant: number; // deg
  gust_factor: number;
  precip_sum: number; // mm
  precip_hours: number; // h
  precip_prob_max: number; // %
  et0: number; // mm
  moisture_balance: number; // precip_sum - et0 (mm)
  uv_index_max: number;
  sw_radiation_sum: number; // MJ/m²
  sw_radiation_peak: number; // W/m²
  dni_peak: number; // W/m²
  cloud_cover_mean: number; // %
  cloud_low_mean: number; // %
  cloud_mid_mean: number; // %
  cloud_high_mean: number; // %
  cape_max: number; // J/kg
  pblh_max: number; // m AGL
  freezing_level_mean: number; // m MSL
  lcl_mean: number; // m AGL
  visibility_min: number; // km
  air_density: number; // kg/m³
  theta_e: number; // K (Equivalent potential temp)
  mixing_ratio: number; // g/kg
  sunrise: string;
  sunset: string;
  daylight_duration: number; // sec
  sunshine_duration: number; // sec
}

export interface HourlyTelemetry {
  time: string[];
  temp: number[];
  apparent: number[];
  dew_point: number[];
  wet_bulb: number[];
  rh: number[];
  vpd: number[];
  pressure_msl: number[];
  surface_pressure: number[];
  wind_speed: number[];
  wind_gusts: number[];
  wind_dir: number[];
  precip: number[];
  precip_prob: number[];
  cloud_total: number[];
  cloud_low: number[];
  cloud_mid: number[];
  cloud_high: number[];
  visibility: number[]; // km
  uv_index: number[];
  sw_rad: number[]; // W/m²
  dni: number[]; // W/m²
  cape: number[]; // J/kg
  pblh: number[]; // m
  freezing_level: number[]; // m
}

export interface CurrentTelemetry {
  time: string;
  weather_code: number;
  temp: number;
  apparent: number;
  dew_point: number;
  dew_depression: number; // T - Td
  wet_bulb: number;
  rh: number;
  vpd: number; // kPa
  pressure_msl: number; // hPa
  surface_pressure: number; // hPa
  pressure_tendency_3h: number; // hPa
  pressure_tendency_24h: number; // hPa
  wind_speed: number; // km/h
  wind_gusts: number; // km/h
  wind_dir: number; // deg
  gust_factor: number;
  precip: number; // mm
  cloud_total: number; // %
  cloud_low: number; // %
  cloud_mid: number; // %
  cloud_high: number; // %
  visibility: number; // km
  uv_index: number;
  sw_rad: number; // W/m²
  dni: number; // W/m²
  cape: number; // J/kg
  pblh: number; // m
  freezing_level: number; // m
  lcl: number; // m AGL
  air_density: number; // kg/m³
  theta_e: number; // K
  mixing_ratio: number; // g/kg
  vapor_pressure: number; // hPa
  aqi_us: number | null;
  pm2_5: number | null;
  pm10: number | null;
  ozone: number | null;
  aod: number | null;
}

export interface CityWeatherPayload {
  location: CityLocation;
  utc_offset_seconds: number;
  timezone_abbreviation: string;
  fetched_at: string;
  source: "open-meteo" | "synthetic-fallback";
  current: CurrentTelemetry;
  daily: DailyTelemetry[];
  hourly: HourlyTelemetry;
}

// Psychrometric & thermodynamic helper equations
function calcSaturationVaporPressure(tempC: number): number {
  // Bolton (1980) in hPa
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

function calcMixingRatio(dewPointC: number, surfacePressureHpa: number): number {
  const e = calcSaturationVaporPressure(dewPointC);
  const w = (621.97 * e) / Math.max(100, surfacePressureHpa - e); // g/kg
  return Math.round(w * 100) / 100;
}

function calcAirDensity(tempC: number, rh: number, surfacePressureHpa: number): number {
  const T_k = tempC + 273.15;
  const es = calcSaturationVaporPressure(tempC);
  const pv = (rh / 100) * es * 100; // Pa
  const pd = surfacePressureHpa * 100 - pv; // Pa
  const Rd = 287.058;
  const Rv = 461.495;
  const rho = pd / (Rd * T_k) + pv / (Rv * T_k);
  return Math.round(rho * 1000) / 1000;
}

function calcThetaE(tempC: number, dewPointC: number, surfacePressureHpa: number): number {
  // Equivalent potential temperature (K) via Bolton (1980) simplified
  const T_k = tempC + 273.15;
  const e = calcSaturationVaporPressure(dewPointC);
  const r = (0.622 * e) / Math.max(100, surfacePressureHpa - e); // kg/kg
  const theta = T_k * Math.pow(1000 / Math.max(200, surfacePressureHpa), 0.2854);
  const thetaE = theta * Math.exp((2.5e6 * r) / (1004 * T_k));
  return Math.round(thetaE * 10) / 10;
}

function calcLCL(tempC: number, dewPointC: number): number {
  // Espy's LCL formula in meters AGL
  return Math.max(0, Math.round(125 * Math.max(0, tempC - dewPointC)));
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  let sum = 0;
  let count = 0;
  for (const v of arr) {
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count ? Math.round((sum / count) * 10) / 10 : 0;
}

function minVal(arr: number[]): number {
  const valid = arr.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return valid.length ? Math.round(Math.min(...valid) * 10) / 10 : 0;
}

function maxVal(arr: number[]): number {
  const valid = arr.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  return valid.length ? Math.round(Math.max(...valid) * 10) / 10 : 0;
}

function round1(n: number | null | undefined, fallback = 0): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return fallback;
  return Math.round(n * 10) / 10;
}

function round2(n: number | null | undefined, fallback = 0): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return fallback;
  return Math.round(n * 100) / 100;
}

// Cache with 10-minute TTL
const forecastCache = new Map<string, { expires: number; data: CityWeatherPayload }>();
const searchCache = new Map<string, { expires: number; data: CityLocation[] }>();

export async function searchLocations(query: string): Promise<CityLocation[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return CURATED_CITIES.slice(0, 12);
  }

  // Match curated cities first
  const localMatches = CURATED_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.country_code.toLowerCase() === q ||
      c.id.toLowerCase() === q ||
      (c.icao && c.icao.toLowerCase().includes(q)) ||
      (c.admin1 && c.admin1.toLowerCase().includes(q))
  );

  if (q.length < 2) {
    return localMatches.slice(0, 10);
  }

  const cached = searchCache.get(q);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=10&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) throw new Error(`Geocoding status ${res.status}`);
    const json = (await res.json()) as { results?: any[] };
    const remoteResults: CityLocation[] = (json.results || []).map((r: any) => ({
      id: `${r.id || `${r.latitude.toFixed(2)}_${r.longitude.toFixed(2)}`}`,
      name: r.name,
      country: r.country || r.country_code || "",
      country_code: r.country_code || "",
      admin1: r.admin1 || "",
      latitude: round2(r.latitude),
      longitude: round2(r.longitude),
      elevation: Math.round(r.elevation ?? 0),
      timezone: r.timezone || "UTC",
    }));

    // Deduplicate by coordinate proximity (< 0.15 deg)
    const combined: CityLocation[] = [...localMatches];
    for (const rem of remoteResults) {
      const exists = combined.some(
        (ex) =>
          Math.abs(ex.latitude - rem.latitude) < 0.15 &&
          Math.abs(ex.longitude - rem.longitude) < 0.15
      );
      if (!exists) {
        combined.push(rem);
      }
    }

    const finalResults = combined.slice(0, 12);
    searchCache.set(q, { expires: Date.now() + 1000 * 60 * 60, data: finalResults });
    return finalResults;
  } catch {
    return localMatches.slice(0, 10);
  }
}

export async function fetchCityWeather(loc: CityLocation): Promise<CityWeatherPayload> {
  const cacheKey = `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { ...cached.data, location: loc };
  }

  try {
    const forecastParams = new URLSearchParams({
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "cloud_cover",
        "pressure_msl",
        "surface_pressure",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
      ].join(","),
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "dew_point_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "pressure_msl",
        "surface_pressure",
        "cloud_cover",
        "cloud_cover_low",
        "cloud_cover_mid",
        "cloud_cover_high",
        "visibility",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "uv_index",
        "shortwave_radiation",
        "direct_normal_irradiance",
        "vapor_pressure_deficit",
        "cape",
        "freezing_level_height",
        "wet_bulb_temperature_2m",
        "boundary_layer_height",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "sunrise",
        "sunset",
        "daylight_duration",
        "sunshine_duration",
        "uv_index_max",
        "precipitation_sum",
        "precipitation_hours",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "wind_gusts_10m_max",
        "wind_direction_10m_dominant",
        "shortwave_radiation_sum",
        "et0_fao_evapotranspiration",
      ].join(","),
      timezone: loc.timezone || "auto",
      forecast_days: "14",
    });

    const aqParams = new URLSearchParams({
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      current: "us_aqi,pm2_5,pm10,aerosol_optical_depth,ozone",
    });

    const [wxRes, aqRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams.toString()}`, {
        signal: AbortSignal.timeout(6500),
      }),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqParams.toString()}`, {
        signal: AbortSignal.timeout(4000),
      }).catch(() => null),
    ]);

    if (!wxRes.ok) {
      throw new Error(`Open-Meteo returned ${wxRes.status}`);
    }

    const wx = (await wxRes.json()) as any;
    const aq = aqRes && aqRes.ok ? ((await aqRes.json()) as any) : null;

    const h = wx.hourly || {};
    const d = wx.daily || {};
    const c = wx.current || {};

    // Find current hour index inside hourly.time
    const curTimeStr = typeof c.time === "string" ? c.time.slice(0, 13) : "";
    let curIdx = (h.time || []).findIndex((t: string) => t.startsWith(curTimeStr));
    if (curIdx < 0) curIdx = 0;

    const curTemp = round1(c.temperature_2m ?? h.temperature_2m?.[curIdx]);
    const curRh = round1(c.relative_humidity_2m ?? h.relative_humidity_2m?.[curIdx], 50);
    const curTd = round1(h.dew_point_2m?.[curIdx], curTemp - (100 - curRh) / 5);
    const curTw = round1(h.wet_bulb_temperature_2m?.[curIdx], curTemp - (curTemp - curTd) * 0.35);
    const curPmsl = round1(c.pressure_msl ?? h.pressure_msl?.[curIdx], 1013.2);
    const curPsfc = round1(c.surface_pressure ?? h.surface_pressure?.[curIdx], 1008.0);
    const p3hIdx = Math.max(0, curIdx - 3);
    const p24hIdx = Math.min((h.pressure_msl?.length || 1) - 1, curIdx + 24);
    const p3h = round1(curPmsl - (h.pressure_msl?.[p3hIdx] ?? curPmsl));
    const p24h = round1((h.pressure_msl?.[p24hIdx] ?? curPmsl) - curPmsl);

    const curWind = round1(c.wind_speed_10m ?? h.wind_speed_10m?.[curIdx]);
    const curGust = round1(c.wind_gusts_10m ?? h.wind_gusts_10m?.[curIdx]);

    const current: CurrentTelemetry = {
      time: c.time || h.time?.[curIdx] || new Date().toISOString(),
      weather_code: c.weather_code ?? d.weather_code?.[0] ?? 0,
      temp: curTemp,
      apparent: round1(c.apparent_temperature ?? h.apparent_temperature?.[curIdx], curTemp),
      dew_point: curTd,
      dew_depression: round1(Math.max(0, curTemp - curTd)),
      wet_bulb: curTw,
      rh: curRh,
      vpd: round2(h.vapor_pressure_deficit?.[curIdx], 0.8),
      pressure_msl: curPmsl,
      surface_pressure: curPsfc,
      pressure_tendency_3h: p3h,
      pressure_tendency_24h: p24h,
      wind_speed: curWind,
      wind_gusts: curGust,
      wind_dir: Math.round(c.wind_direction_10m ?? h.wind_direction_10m?.[curIdx] ?? 0),
      gust_factor: round2(curGust / Math.max(1, curWind), 1.0),
      precip: round1(c.precipitation ?? h.precipitation?.[curIdx], 0),
      cloud_total: Math.round(c.cloud_cover ?? h.cloud_cover?.[curIdx] ?? 0),
      cloud_low: Math.round(h.cloud_cover_low?.[curIdx] ?? 0),
      cloud_mid: Math.round(h.cloud_cover_mid?.[curIdx] ?? 0),
      cloud_high: Math.round(h.cloud_cover_high?.[curIdx] ?? 0),
      visibility: round1((h.visibility?.[curIdx] ?? 24140) / 1000, 24.1),
      uv_index: round1(h.uv_index?.[curIdx], 0),
      sw_rad: Math.round(h.shortwave_radiation?.[curIdx] ?? 0),
      dni: Math.round(h.direct_normal_irradiance?.[curIdx] ?? 0),
      cape: Math.round(h.cape?.[curIdx] ?? 0),
      pblh: Math.round(h.boundary_layer_height?.[curIdx] ?? 650),
      freezing_level: Math.round(h.freezing_level_height?.[curIdx] ?? 3200),
      lcl: calcLCL(curTemp, curTd),
      air_density: calcAirDensity(curTemp, curRh, curPsfc),
      theta_e: calcThetaE(curTemp, curTd, curPsfc),
      mixing_ratio: calcMixingRatio(curTd, curPsfc),
      vapor_pressure: round1(calcSaturationVaporPressure(curTd)),
      aqi_us: aq?.current?.us_aqi ?? null,
      pm2_5: aq?.current?.pm2_5 !== undefined ? round1(aq.current.pm2_5) : null,
      pm10: aq?.current?.pm10 !== undefined ? round1(aq.current.pm10) : null,
      ozone: aq?.current?.ozone !== undefined ? Math.round(aq.current.ozone) : null,
      aod:
        aq?.current?.aerosol_optical_depth !== undefined
          ? round2(aq.current.aerosol_optical_depth)
          : null,
    };

    const daysCount = (d.time || []).length;
    const daily: DailyTelemetry[] = [];

    for (let i = 0; i < daysCount; i++) {
      const s = i * 24;
      const e = s + 24;
      const hTemp = (h.temperature_2m || []).slice(s, e);
      const hTd = (h.dew_point_2m || []).slice(s, e);
      const hTw = (h.wet_bulb_temperature_2m || []).slice(s, e);
      const hRh = (h.relative_humidity_2m || []).slice(s, e);
      const hVpd = (h.vapor_pressure_deficit || []).slice(s, e);
      const hPmsl = (h.pressure_msl || []).slice(s, e);
      const hPsfc = (h.surface_pressure || []).slice(s, e);
      const hCloud = (h.cloud_cover || []).slice(s, e);
      const hCloudL = (h.cloud_cover_low || []).slice(s, e);
      const hCloudM = (h.cloud_cover_mid || []).slice(s, e);
      const hCloudH = (h.cloud_cover_high || []).slice(s, e);
      const hCape = (h.cape || []).slice(s, e);
      const hPblh = (h.boundary_layer_height || []).slice(s, e);
      const hFreeze = (h.freezing_level_height || []).slice(s, e);
      const hVis = (h.visibility || []).slice(s, e);
      const hSw = (h.shortwave_radiation || []).slice(s, e);
      const hDni = (h.direct_normal_irradiance || []).slice(s, e);

      const tMax = round1(d.temperature_2m_max?.[i], maxVal(hTemp));
      const tMin = round1(d.temperature_2m_min?.[i], minVal(hTemp));
      const tMean = round1(avg(hTemp), round1((tMax + tMin) / 2));
      const tdMean = avg(hTd);
      const rhMean = Math.round(avg(hRh));
      const psfcMean = avg(hPsfc) || 1010;
      const wMax = round1(d.wind_speed_10m_max?.[i]);
      const gMax = round1(d.wind_gusts_10m_max?.[i]);
      const precipSum = round1(d.precipitation_sum?.[i]);
      const et0 = round2(d.et0_fao_evapotranspiration?.[i]);

      daily.push({
        date: d.time[i],
        weather_code: d.weather_code?.[i] ?? 0,
        temp_max: tMax,
        temp_min: tMin,
        temp_mean: tMean,
        temp_range: round1(tMax - tMin),
        apparent_max: round1(d.apparent_temperature_max?.[i], tMax),
        apparent_min: round1(d.apparent_temperature_min?.[i], tMin),
        dew_point_max: maxVal(hTd),
        dew_point_min: minVal(hTd),
        dew_point_mean: tdMean,
        wet_bulb_mean: avg(hTw),
        wet_bulb_max: maxVal(hTw),
        rh_mean: rhMean,
        rh_min: Math.round(minVal(hRh)),
        rh_max: Math.round(maxVal(hRh)),
        vpd_max: round2(maxVal(hVpd)),
        vpd_mean: round2(avg(hVpd)),
        pressure_msl_mean: avg(hPmsl),
        pressure_msl_min: minVal(hPmsl),
        pressure_msl_max: maxVal(hPmsl),
        surface_pressure_mean: psfcMean,
        wind_speed_max: wMax,
        wind_gusts_max: gMax,
        wind_dir_dominant: Math.round(d.wind_direction_10m_dominant?.[i] ?? 0),
        gust_factor: round2(gMax / Math.max(1, wMax), 1.0),
        precip_sum: precipSum,
        precip_hours: round1(d.precipitation_hours?.[i]),
        precip_prob_max: Math.round(d.precipitation_probability_max?.[i] ?? 0),
        et0,
        moisture_balance: round1(precipSum - et0),
        uv_index_max: round1(d.uv_index_max?.[i]),
        sw_radiation_sum: round1(d.shortwave_radiation_sum?.[i]),
        sw_radiation_peak: Math.round(maxVal(hSw)),
        dni_peak: Math.round(maxVal(hDni)),
        cloud_cover_mean: Math.round(avg(hCloud)),
        cloud_low_mean: Math.round(avg(hCloudL)),
        cloud_mid_mean: Math.round(avg(hCloudM)),
        cloud_high_mean: Math.round(avg(hCloudH)),
        cape_max: Math.round(maxVal(hCape)),
        pblh_max: Math.round(maxVal(hPblh)),
        freezing_level_mean: Math.round(avg(hFreeze)),
        lcl_mean: calcLCL(tMean, tdMean),
        visibility_min: round1(minVal(hVis) / 1000, 10),
        air_density: calcAirDensity(tMean, rhMean, psfcMean),
        theta_e: calcThetaE(tMean, tdMean, psfcMean),
        mixing_ratio: calcMixingRatio(tdMean, psfcMean),
        sunrise: d.sunrise?.[i] || "",
        sunset: d.sunset?.[i] || "",
        daylight_duration: Math.round(d.daylight_duration?.[i] ?? 43200),
        sunshine_duration: Math.round(d.sunshine_duration?.[i] ?? 28800),
      });
    }

    // Keep 96 hours of hourly telemetry starting from today 00:00 (4 full days)
    const sliceLen = Math.min(96, (h.time || []).length);
    const hourly: HourlyTelemetry = {
      time: (h.time || []).slice(0, sliceLen),
      temp: (h.temperature_2m || []).slice(0, sliceLen).map((v: number) => round1(v)),
      apparent: (h.apparent_temperature || []).slice(0, sliceLen).map((v: number) => round1(v)),
      dew_point: (h.dew_point_2m || []).slice(0, sliceLen).map((v: number) => round1(v)),
      wet_bulb: (h.wet_bulb_temperature_2m || []).slice(0, sliceLen).map((v: number) => round1(v)),
      rh: (h.relative_humidity_2m || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      vpd: (h.vapor_pressure_deficit || []).slice(0, sliceLen).map((v: number) => round2(v)),
      pressure_msl: (h.pressure_msl || []).slice(0, sliceLen).map((v: number) => round1(v, 1013)),
      surface_pressure: (h.surface_pressure || [])
        .slice(0, sliceLen)
        .map((v: number) => round1(v, 1008)),
      wind_speed: (h.wind_speed_10m || []).slice(0, sliceLen).map((v: number) => round1(v)),
      wind_gusts: (h.wind_gusts_10m || []).slice(0, sliceLen).map((v: number) => round1(v)),
      wind_dir: (h.wind_direction_10m || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      precip: (h.precipitation || []).slice(0, sliceLen).map((v: number) => round1(v)),
      precip_prob: (h.precipitation_probability || [])
        .slice(0, sliceLen)
        .map((v: number) => Math.round(v ?? 0)),
      cloud_total: (h.cloud_cover || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      cloud_low: (h.cloud_cover_low || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      cloud_mid: (h.cloud_cover_mid || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      cloud_high: (h.cloud_cover_high || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      visibility: (h.visibility || [])
        .slice(0, sliceLen)
        .map((v: number) => round1((v ?? 24000) / 1000, 24)),
      uv_index: (h.uv_index || []).slice(0, sliceLen).map((v: number) => round1(v)),
      sw_rad: (h.shortwave_radiation || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      dni: (h.direct_normal_irradiance || [])
        .slice(0, sliceLen)
        .map((v: number) => Math.round(v ?? 0)),
      cape: (h.cape || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      pblh: (h.boundary_layer_height || []).slice(0, sliceLen).map((v: number) => Math.round(v ?? 0)),
      freezing_level: (h.freezing_level_height || [])
        .slice(0, sliceLen)
        .map((v: number) => Math.round(v ?? 0)),
    };

    const payload: CityWeatherPayload = {
      location: {
        ...loc,
        elevation: Math.round(wx.elevation ?? loc.elevation ?? 0),
        timezone: wx.timezone || loc.timezone || "UTC",
      },
      utc_offset_seconds: wx.utc_offset_seconds ?? 0,
      timezone_abbreviation: wx.timezone_abbreviation || "UTC",
      fetched_at: new Date().toISOString(),
      source: "open-meteo",
      current,
      daily,
      hourly,
    };

    forecastCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 10, data: payload });
    return payload;
  } catch (err) {
    return generateFallbackWeather(loc);
  }
}

// Deterministic physical atmosphere fallback in case of offline environment
function generateFallbackWeather(loc: CityLocation): CityWeatherPayload {
  const absLat = Math.abs(loc.latitude);
  const baseTemp = round1(29 - absLat * 0.42 - (loc.elevation / 1000) * 6.5);
  const diurnalSpread = round1(6.5 + Math.min(8, loc.elevation / 250));
  const seed = Math.abs(Math.sin(loc.latitude * 12.9898 + loc.longitude * 78.233));

  const now = new Date();
  const daily: DailyTelemetry[] = [];
  for (let i = 0; i < 14; i++) {
    const dDate = new Date(now.getTime() + i * 86400000);
    const dateStr = dDate.toISOString().slice(0, 10);
    const wave = Math.sin((i + seed * 10) * 0.65) * 3.2;
    const tMax = round1(baseTemp + diurnalSpread / 2 + wave);
    const tMin = round1(baseTemp - diurnalSpread / 2 + wave * 0.8);
    const tMean = round1((tMax + tMin) / 2);
    const tdMean = round1(tMean - 5.5);
    const pMean = round1(1015 - Math.sin(i * 0.8 + seed * 5) * 6);
    const psfc = round1(pMean * Math.pow(1 - (0.0065 * loc.elevation) / (tMean + 273.15), 5.257));

    daily.push({
      date: dateStr,
      weather_code: i % 4 === 0 ? 3 : i % 3 === 0 ? 61 : 1,
      temp_max: tMax,
      temp_min: tMin,
      temp_mean: tMean,
      temp_range: round1(tMax - tMin),
      apparent_max: round1(tMax + 0.8),
      apparent_min: round1(tMin - 0.6),
      dew_point_max: round1(tdMean + 2.1),
      dew_point_min: round1(tdMean - 2.1),
      dew_point_mean: tdMean,
      wet_bulb_mean: round1(tMean - 2.3),
      wet_bulb_max: round1(tMax - 2.8),
      rh_mean: 64,
      rh_min: 44,
      rh_max: 82,
      vpd_max: 1.45,
      vpd_mean: 0.85,
      pressure_msl_mean: pMean,
      pressure_msl_min: round1(pMean - 2.4),
      pressure_msl_max: round1(pMean + 2.4),
      surface_pressure_mean: psfc,
      wind_speed_max: round1(14 + (i % 5) * 3),
      wind_gusts_max: round1(25 + (i % 5) * 5.2),
      wind_dir_dominant: (Math.round(seed * 360) + i * 18) % 360,
      gust_factor: 1.75,
      precip_sum: i % 3 === 0 ? round1(3.4 + (i % 4) * 1.8) : 0,
      precip_hours: i % 3 === 0 ? 4 : 0,
      precip_prob_max: i % 3 === 0 ? 68 : 12,
      et0: 3.4,
      moisture_balance: i % 3 === 0 ? 1.8 : -3.4,
      uv_index_max: round1(Math.max(1.5, 9.5 - absLat * 0.11)),
      sw_radiation_sum: round1(Math.max(6, 22 - absLat * 0.2)),
      sw_radiation_peak: Math.round(Math.max(250, 820 - absLat * 7)),
      dni_peak: Math.round(Math.max(300, 760 - absLat * 6)),
      cloud_cover_mean: i % 3 === 0 ? 74 : 28,
      cloud_low_mean: i % 3 === 0 ? 48 : 14,
      cloud_mid_mean: i % 3 === 0 ? 35 : 12,
      cloud_high_mean: 22,
      cape_max: i % 3 === 0 ? 480 : 90,
      pblh_max: 1150,
      freezing_level_mean: Math.round(Math.max(800, 4400 - absLat * 48)),
      lcl_mean: calcLCL(tMean, tdMean),
      visibility_min: i % 3 === 0 ? 9.5 : 24.1,
      air_density: calcAirDensity(tMean, 64, psfc),
      theta_e: calcThetaE(tMean, tdMean, psfc),
      mixing_ratio: calcMixingRatio(tdMean, psfc),
      sunrise: `${dateStr}T06:18`,
      sunset: `${dateStr}T17:52`,
      daylight_duration: 41640,
      sunshine_duration: 31200,
    });
  }

  const hourly: HourlyTelemetry = {
    time: [],
    temp: [],
    apparent: [],
    dew_point: [],
    wet_bulb: [],
    rh: [],
    vpd: [],
    pressure_msl: [],
    surface_pressure: [],
    wind_speed: [],
    wind_gusts: [],
    wind_dir: [],
    precip: [],
    precip_prob: [],
    cloud_total: [],
    cloud_low: [],
    cloud_mid: [],
    cloud_high: [],
    visibility: [],
    uv_index: [],
    sw_rad: [],
    dni: [],
    cape: [],
    pblh: [],
    freezing_level: [],
  };

  for (let h = 0; h < 96; h++) {
    const dayIdx = Math.floor(h / 24);
    const hrOfDay = h % 24;
    const dItem = daily[dayIdx];
    const diurnalPhase = Math.sin(((hrOfDay - 5) / 24) * Math.PI * 2);
    const t = round1(dItem.temp_mean + (dItem.temp_range / 2) * diurnalPhase);
    const td = round1(dItem.dew_point_mean + diurnalPhase * 0.9);
    const datePrefix = dItem.date;
    hourly.time.push(`${datePrefix}T${String(hrOfDay).padStart(2, "0")}:00`);
    hourly.temp.push(t);
    hourly.apparent.push(round1(t + diurnalPhase * 0.6));
    hourly.dew_point.push(td);
    hourly.wet_bulb.push(round1(t - (t - td) * 0.36));
    hourly.rh.push(Math.round(Math.max(25, Math.min(96, 68 - diurnalPhase * 18))));
    hourly.vpd.push(round2(Math.max(0.15, 0.85 + diurnalPhase * 0.55)));
    hourly.pressure_msl.push(round1(dItem.pressure_msl_mean + Math.sin(h * 0.25) * 1.8));
    hourly.surface_pressure.push(dItem.surface_pressure_mean);
    hourly.wind_speed.push(round1(Math.max(4, dItem.wind_speed_max * (0.65 + 0.3 * diurnalPhase))));
    hourly.wind_gusts.push(round1(Math.max(8, dItem.wind_gusts_max * (0.65 + 0.3 * diurnalPhase))));
    hourly.wind_dir.push((dItem.wind_dir_dominant + h * 3) % 360);
    hourly.precip.push(hrOfDay > 13 && hrOfDay < 18 ? round1(dItem.precip_sum / 4) : 0);
    hourly.precip_prob.push(dItem.precip_prob_max);
    hourly.cloud_total.push(dItem.cloud_cover_mean);
    hourly.cloud_low.push(dItem.cloud_low_mean);
    hourly.cloud_mid.push(dItem.cloud_mid_mean);
    hourly.cloud_high.push(dItem.cloud_high_mean);
    hourly.visibility.push(dItem.visibility_min);
    const sunUp = hrOfDay >= 6 && hrOfDay <= 18 ? Math.sin(((hrOfDay - 6) / 12) * Math.PI) : 0;
    hourly.uv_index.push(round1(dItem.uv_index_max * sunUp));
    hourly.sw_rad.push(Math.round(dItem.sw_radiation_peak * sunUp));
    hourly.dni.push(Math.round(dItem.dni_peak * sunUp));
    hourly.cape.push(Math.round(dItem.cape_max * Math.max(0, diurnalPhase)));
    hourly.pblh.push(Math.round(300 + (dItem.pblh_max - 300) * Math.max(0, sunUp)));
    hourly.freezing_level.push(dItem.freezing_level_mean);
  }

  const d0 = daily[0];
  return {
    location: loc,
    utc_offset_seconds: Math.round((loc.longitude / 15) * 3600),
    timezone_abbreviation: "LOC",
    fetched_at: now.toISOString(),
    source: "synthetic-fallback",
    current: {
      time: hourly.time[12],
      weather_code: d0.weather_code,
      temp: d0.temp_mean,
      apparent: round1(d0.temp_mean + 0.5),
      dew_point: d0.dew_point_mean,
      dew_depression: round1(d0.temp_mean - d0.dew_point_mean),
      wet_bulb: d0.wet_bulb_mean,
      rh: d0.rh_mean,
      vpd: d0.vpd_mean,
      pressure_msl: d0.pressure_msl_mean,
      surface_pressure: d0.surface_pressure_mean,
      pressure_tendency_3h: -0.6,
      pressure_tendency_24h: 1.4,
      wind_speed: round1(d0.wind_speed_max * 0.7),
      wind_gusts: round1(d0.wind_gusts_max * 0.75),
      wind_dir: d0.wind_dir_dominant,
      gust_factor: d0.gust_factor,
      precip: 0,
      cloud_total: d0.cloud_cover_mean,
      cloud_low: d0.cloud_low_mean,
      cloud_mid: d0.cloud_mid_mean,
      cloud_high: d0.cloud_high_mean,
      visibility: d0.visibility_min,
      uv_index: round1(d0.uv_index_max * 0.6),
      sw_rad: Math.round(d0.sw_radiation_peak * 0.65),
      dni: Math.round(d0.dni_peak * 0.65),
      cape: d0.cape_max,
      pblh: d0.pblh_max,
      freezing_level: d0.freezing_level_mean,
      lcl: d0.lcl_mean,
      air_density: d0.air_density,
      theta_e: d0.theta_e,
      mixing_ratio: d0.mixing_ratio,
      vapor_pressure: round1(calcSaturationVaporPressure(d0.dew_point_mean)),
      aqi_us: 34,
      pm2_5: 8.2,
      pm10: 16.4,
      ozone: 58,
      aod: 0.11,
    },
    daily,
    hourly,
  };
}
