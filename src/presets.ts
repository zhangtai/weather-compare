export interface CityLocation {
  id: string;
  name: string;
  country: string;
  country_code: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  icao?: string;
}

export interface ComparisonPreset {
  id: string;
  label: string;
  tag: string;
  cityIds: [string, string, string];
}

export const CURATED_CITIES: CityLocation[] = [
  {
    id: "gzh",
    name: "Guangzhou",
    country: "China",
    country_code: "CN",
    admin1: "Guangdong",
    latitude: 23.1289,
    longitude: 113.2533,
    elevation: 44,
    timezone: "Asia/Shanghai",
    icao: "ZGGG",
  },
  {
    id: "yil",
    name: "Yilan",
    country: "China",
    country_code: "CN",
    admin1: "Heilongjiang",
    latitude: 46.3223,
    longitude: 129.5608,
    elevation: 16,
    timezone: "Asia/Shanghai",
    icao: "ZYHB",
  },
  {
    id: "bji",
    name: "Beijing",
    country: "China",
    country_code: "CN",
    admin1: "Heilongjiang",
    latitude: 39.9042,
    longitude: 116.4074,
    elevation: 16,
    timezone: "Asia/Shanghai",
    icao: "ZBAA",
  },
];

export const COMPARISON_PRESETS: ComparisonPreset[] = [
  {
    id: "default-tri",
    label: "GZH · YIL · BEI",
    tag: "Mid-Lat Trio",
    cityIds: ["gzh", "yil", "bji"],
  },
];
