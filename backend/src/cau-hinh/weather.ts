/**
 * Cấu hình Weather — nguồn sự thật duy nhất cho ngưỡng, mã thời tiết,
 * cache và vị trí mặc định. Không hardcode các giá trị này trong service/route.
 */

/** Ngưỡng nhiệt độ (°C) phân dải theo BR-MTCH-003. */
export const WEATHER_BAND_THRESHOLDS = {
  hotAbove: 28,
  warmAbove: 22,
  coolAbove: 18,
} as const;

/** Mã WMO coi là mưa (drizzle / mưa / mưa rào / dông). */
export const WEATHER_RAIN_CODES: number[] = [
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
];

/** Mã WMO coi là tuyết. */
export const WEATHER_SNOW_CODES: number[] = [71, 73, 75, 77, 85, 86];

/** Thời gian sống của cache thời tiết trong bộ nhớ (15 phút). */
export const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;

/** Timeout gọi Open-Meteo (5 giây). */
export const WEATHER_FETCH_TIMEOUT_MS = 5000;

/** Endpoint Open-Meteo (không cần API key). */
export const WEATHER_API_BASE_URL = "https://api.open-meteo.com/v1/forecast";

/** Dữ liệu dự phòng khi API không trả field (không dùng để che giấu lỗi mạng). */
export const WEATHER_FALLBACK = {
  temperature: 25,
  humidity: 60,
  weatherCode: 0,
} as const;

/** Nhãn vị trí hiển thị trên weather badge (frontend đọc `locationName`). */
export const WEATHER_LOCATION_LABEL = "TP. Hồ Chí Minh";

/** Số chữ số thập phân dùng làm khóa cache tọa độ. */
export const WEATHER_CACHE_COORD_PRECISION = 2;

/** Vị trí mặc định khi client không gửi tọa độ hợp lệ (TP.HCM). */
export const DEFAULT_LOCATION = { lat: 10.8231, lon: 106.6297 } as const;

/**
 * Nhãn alias nhóm hương (Scentory + Michael Edwards) để lớp tương thích
 * frontend cũ đọc được bảng điểm thời tiết mà không cần đổi hợp đồng API.
 */
export const WEATHER_ALIAS_LABELS = [
  "Woody",
  "Oriental/Amber",
  "Amber",
  "Gourmand",
  "Floral",
  "Fresh/Citrus",
  "Fresh",
  "Citrus",
  "Aromatic",
  "Fougère",
  "Aquatic",
  "Green",
  "Chypre",
  "Leather",
  "Musk",
] as const;
