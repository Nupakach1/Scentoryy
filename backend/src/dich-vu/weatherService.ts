/**
 * Weather service — gọi Open-Meteo và phân loại về 4 dải của BR-MTCH-003.
 *
 * - Dùng chung cho route `/api/weather` và cho Scent Match (tiêu chí 10%).
 * - Cache trong bộ nhớ 15 phút cho mỗi cặp tọa độ (làm tròn 2 chữ số).
 * - Không cần API key (khác OpenWeatherMap), vẫn đúng dữ liệu nhiệt độ/độ ẩm.
 */
import {
  SCENTORY_FAMILIES,
  WEATHER_BAND_HINTS,
  WEATHER_BAND_LABELS,
  WEATHER_FAMILY_SCORES,
  type ScentoryFamily,
  type WeatherBand,
  normalizeFamily,
} from "../cau-hinh/scentMatch";
import {
  WEATHER_ALIAS_LABELS,
  WEATHER_API_BASE_URL,
  WEATHER_BAND_THRESHOLDS,
  WEATHER_CACHE_COORD_PRECISION,
  WEATHER_CACHE_TTL_MS,
  WEATHER_FALLBACK,
  WEATHER_FETCH_TIMEOUT_MS,
  WEATHER_RAIN_CODES,
  WEATHER_SNOW_CODES,
} from "../cau-hinh/weather";

export interface WeatherData {
  band: WeatherBand;
  label: string;
  hint: string;
  temperature: number;
  humidity: number;
  weatherCode: number;
  isRaining: boolean;
  isSnowing: boolean;
  source: "open-meteo";
  fetchedAt: string;
  cached: boolean;
}

export interface WeatherClassification {
  band: WeatherBand;
  label: string;
  hint: string;
  isRaining: boolean;
  isSnowing: boolean;
}

const RAIN_CODES = new Set<number>(WEATHER_RAIN_CODES);
const SNOW_CODES = new Set<number>(WEATHER_SNOW_CODES);

const cache = new Map<string, { data: WeatherData; expiresAt: number }>();

/**
 * Phân loại thời tiết theo BR-MTCH-003:
 *   > 28°C → Nóng ẩm | 22–28°C → Ấm vừa | 18–22°C → Mát | < 18°C → Lạnh.
 * Có tuyết → luôn xếp vào dải Lạnh (bất kể nhiệt độ đo được).
 */
export function classifyWeather(
  temperature: number,
  _humidity: number,
  weatherCode: number
): WeatherClassification {
  const isRaining = RAIN_CODES.has(weatherCode);
  const isSnowing = SNOW_CODES.has(weatherCode);

  const { hotAbove, warmAbove, coolAbove } = WEATHER_BAND_THRESHOLDS;

  let band: WeatherBand;
  if (isSnowing) {
    band = "cold";
  } else if (temperature > hotAbove) {
    band = "hotHumid";
  } else if (temperature >= warmAbove) {
    band = "warm";
  } else if (temperature >= coolAbove) {
    band = "cool";
  } else {
    band = "cold";
  }

  return {
    band,
    label: WEATHER_BAND_LABELS[band],
    hint: WEATHER_BAND_HINTS[band],
    isRaining,
    isSnowing,
  };
}

/** Điểm thời tiết 0–1 cho từng nhóm hương theo dải hiện tại (BR-MTCH-003). */
export function weatherScoresForBand(band: WeatherBand): Record<ScentoryFamily, number> {
  return { ...WEATHER_FAMILY_SCORES[band] };
}

/**
 * Trả về `{ family: điểm 0–1 }` cho MỌI tên nhóm hương (Scentory + Michael
 * Edwards) để frontend cũ (weather badge) đọc được mà không cần đổi hợp đồng.
 */
export function weatherScoreLookup(band: WeatherBand): Record<string, number> {
  const table = WEATHER_FAMILY_SCORES[band];
  const result: Record<string, number> = {};

  for (const family of SCENTORY_FAMILIES) {
    result[family] = table[family];
  }

  for (const alias of WEATHER_ALIAS_LABELS) {
    const family = normalizeFamily(alias);
    if (family) result[alias] = table[family];
  }

  return result;
}

export function clearWeatherCache(): void {
  cache.clear();
}

/**
 * Lấy thời tiết hiện tại theo tọa độ (Open-Meteo, cache 15 phút).
 * Ném lỗi nếu mạng/API thất bại — caller quyết định bỏ tiêu chí hay báo lỗi.
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const precision = WEATHER_CACHE_COORD_PRECISION;
  const key = `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return { ...hit.data, cached: true };
  }

  const url =
    WEATHER_API_BASE_URL +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,weather_code" +
    "&timezone=auto";

  const response = await fetch(url, {
    signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
    };
  };

  const current = payload.current ?? {};
  const temperature = Number(current.temperature_2m ?? WEATHER_FALLBACK.temperature);
  const humidity = Number(current.relative_humidity_2m ?? WEATHER_FALLBACK.humidity);
  const weatherCode = Number(current.weather_code ?? WEATHER_FALLBACK.weatherCode);
  const classification = classifyWeather(temperature, humidity, weatherCode);

  const data: WeatherData = {
    ...classification,
    temperature,
    humidity,
    weatherCode,
    source: "open-meteo",
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  cache.set(key, { data, expiresAt: Date.now() + WEATHER_CACHE_TTL_MS });
  return data;
}
