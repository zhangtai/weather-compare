import { join } from "path";
import { CURATED_CITIES, COMPARISON_PRESETS, type CityLocation } from "./presets";
import { fetchCityWeather, searchLocations } from "./meteo";

const PUBLIC_DIR = join(import.meta.dir, "..", "public");
const PORT = Number(process.env.PORT || 3000);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function getMimeType(pathname: string): string {
  const ext = pathname.slice(pathname.lastIndexOf("."));
  return MIME_TYPES[ext] || "application/octet-stream";
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    // API: Presets & curated station catalog
    if (pathname === "/api/presets" && req.method === "GET") {
      return Response.json({
        curated: CURATED_CITIES,
        presets: COMPARISON_PRESETS,
      });
    }

    // API: Search locations
    if (pathname === "/api/search" && req.method === "GET") {
      const q = url.searchParams.get("q") || "";
      const results = await searchLocations(q);
      return Response.json({ results });
    }

    // API: Single or batch city forecast comparison (max 3 cities enforced)
    if (pathname === "/api/compare" && req.method === "POST") {
      try {
        const body = (await req.json()) as { cities?: CityLocation[] };
        const rawCities = Array.isArray(body.cities) ? body.cities.slice(0, 3) : [];
        if (rawCities.length === 0) {
          return Response.json({ error: "No cities provided" }, { status: 400 });
        }
        const payloads = await Promise.all(rawCities.map((c) => fetchCityWeather(c)));
        return Response.json({ cities: payloads });
      } catch (err: any) {
        return Response.json(
          { error: err?.message || "Failed to fetch comparison data" },
          { status: 500 }
        );
      }
    }

    // API: Reverse / custom coordinate lookup
    if (pathname === "/api/station" && req.method === "GET") {
      const lat = Number(url.searchParams.get("lat"));
      const lon = Number(url.searchParams.get("lon"));
      const name = url.searchParams.get("name") || "Custom Station";
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return Response.json({ error: "Invalid coordinates" }, { status: 400 });
      }
      const loc: CityLocation = {
        id: `loc_${lat.toFixed(2)}_${lon.toFixed(2)}`,
        name,
        country: "GPS",
        country_code: "LOC",
        latitude: Math.round(lat * 100) / 100,
        longitude: Math.round(lon * 100) / 100,
        elevation: 0,
        timezone: "auto",
      };
      const payload = await fetchCityWeather(loc);
      return Response.json(payload);
    }

    // Serve static files from /public
    const targetPath = pathname === "/" ? "/index.html" : pathname;
    const safePath = join(PUBLIC_DIR, targetPath);
    if (!safePath.startsWith(PUBLIC_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(safePath);
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": getMimeType(safePath),
          "Cache-Control": "no-cache",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`WX·COMPARE running on http://localhost:${server.port}`);
