/**
 * Cấu hình Scent Match — nguồn sự thật duy nhất cho trọng số & quy tắc.
 *
 * Theo docs/scentory/srs/business-rules.md:
 *   - BR-MTCH-001: ánh xạ Scent Quiz → ScentProfiles (30/25/20/15/10)
 *   - BR-MTCH-001: năm tiêu chí chấm điểm
 *   - BR-MTCH-003: ánh xạ điều kiện thời tiết → nhóm hương ưu tiên
 *
 * Tất cả giá trị ở đây là DỮ LIỆU CẤU HÌNH (không nằm rải rác trong route),
 * để chỉnh trọng số/ngưỡng không phải sửa logic tính điểm.
 */

/** Tám nhóm hương Michael Edwards dùng trên toàn hệ thống Scentory (Products.ScentFamily). */
export const SCENTORY_FAMILIES = [
  "Woody",
  "Aromatic",
  "Floral",
  "Fresh/Citrus",
  "Fougère",
  "Oriental/Amber",
  "Chypre",
  "Gourmand",
] as const;

export type ScentoryFamily = (typeof SCENTORY_FAMILIES)[number];

/** BR-MTCH-001 — trọng số năm tiêu chí (tổng = 1.0). */
export const SCENT_MATCH_WEIGHTS = {
  scentFamily: 0.3,
  occasion: 0.25,
  projection: 0.2,
  budget: 0.15,
  weather: 0.1,
} as const;

export type MatchCriterion = keyof typeof SCENT_MATCH_WEIGHTS;

export const CRITERION_LABELS: Record<MatchCriterion, string> = {
  scentFamily: "Nhóm hương",
  occasion: "Hoàn cảnh",
  projection: "Độ tỏa",
  budget: "Ngân sách",
  weather: "Thời tiết",
};

/**
 * BR-MTCH-001 — điểm con dùng chung.
 *   exact 1.0 · neighbour 0.5 · none 0.0
 */
export const MATCH_SCORE_STEPS = {
  exact: 1,
  neighbour: 0.5,
  none: 0,
} as const;

/** Hoàn cảnh: khớp đầy đủ 1.0 · khớp một phần 0.5 · không khớp 0.0 */
export const OCCASION_SCORES = {
  full: 1,
  partial: 0.5,
  none: 0,
} as const;

/** Độ tỏa: cùng bậc 1.0 · chênh 1 bậc 0.5 · lệch ≥ 2 bậc 0.0 */
export const PROJECTION_SCORES = {
  same: 1,
  oneLevelAway: 0.5,
  far: 0,
} as const;

/** Ngưỡng đánh giá sao được coi là "yêu thích" trong FamilyRatings. */
export const FAMILY_RATING_FAVORITE_MIN = 4;

/** Hệ số quy đổi điểm con 0–1 sang phần trăm 0–100. */
export const PERCENT_SCALE = 100;

/** Giá trị mặc định khi seed sản phẩm (không nằm trong brand JSON). */
export const DEFAULT_STOCK_QUANTITY = 100;
export const DEFAULT_CONCENTRATION = "EDP";

/**
 * Chuẩn hóa tên nhóm hương về 8 nhóm Michael Edwards.
 * Nhận cả tên 6 nhóm Scentory cũ (hồ sơ/sản phẩm đã lưu trước bản 2.3) để không mất dữ liệu.
 */
export const FAMILY_ALIAS_LIST: Array<[string, ScentoryFamily]> = [
  ["woody", "Woody"],
  ["aromatic", "Aromatic"],
  ["floral", "Floral"],
  ["fresh/citrus", "Fresh/Citrus"],
  ["fresh / citrus", "Fresh/Citrus"],
  ["fresh", "Fresh/Citrus"],
  ["citrus", "Fresh/Citrus"],
  ["fougère", "Fougère"],
  ["fougere", "Fougère"],
  ["oriental/amber", "Oriental/Amber"],
  ["oriental / amber", "Oriental/Amber"],
  ["oriental", "Oriental/Amber"],
  ["amber", "Oriental/Amber"],
  ["chypre", "Chypre"],
  ["gourmand", "Gourmand"],
  // 6 nhóm Scentory cũ → nhóm Michael Edwards gần nhất
  ["woody & smoky", "Woody"],
  ["floral & powdery", "Floral"],
  ["amber & gourmand", "Oriental/Amber"],
  ["citrus & aromatic", "Fresh/Citrus"],
  ["aquatic & green", "Aromatic"],
  ["leather & clean musk", "Chypre"],
  ["aquatic", "Aromatic"],
  ["green", "Aromatic"],
  ["leather", "Chypre"],
  ["musk", "Chypre"],
];

const FAMILY_ALIASES = new Map<string, ScentoryFamily>(FAMILY_ALIAS_LIST);

/** Chuẩn hóa an toàn: bỏ khoảng trắng thừa, so khớp không phân biệt hoa/thường. */
export function normalizeFamily(value: string | null | undefined): ScentoryFamily | null {
  if (!value) return null;
  const key = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  return FAMILY_ALIASES.get(key) ?? null;
}

/** Các khoảng ngân sách hợp lệ (khóa được lưu trong ScentProfiles.BudgetRange). */
export interface BudgetBand {
  min: number;
  max: number;
  label: string;
}

export const BUDGET_BANDS: Record<string, BudgetBand> = {
  "dưới 4.5tr": { min: 0, max: 4_500_000, label: "Dưới 4.5 triệu" },
  "4.5-6tr": { min: 4_500_000, max: 6_000_000, label: "4.5 – 6 triệu" },
  "6-7.5tr": { min: 6_000_000, max: 7_500_000, label: "6 – 7.5 triệu" },
  "trên 7.5tr": { min: 7_500_000, max: Number.POSITIVE_INFINITY, label: "Trên 7.5 triệu" },
  // Khoảng cũ (tương thích dữ liệu đã lưu trước khi nâng cấp quiz)
  "dưới 500k": { min: 0, max: 500_000, label: "Dưới 500.000đ" },
  "500k-1tr": { min: 500_000, max: 1_000_000, label: "500.000 – 1 triệu" },
  "1tr-2tr": { min: 1_000_000, max: 2_000_000, label: "1 – 2 triệu" },
  "trên 2tr": { min: 2_000_000, max: Number.POSITIVE_INFINITY, label: "Trên 2 triệu" },
};

/** Cửa sổ giảm tuyến tính khi giá vượt ngưỡng trên (50% của max). */
export const BUDGET_DECAY_WINDOW = 0.5;

export function normalizeBudgetRange(value: string | null | undefined): BudgetBand | null {
  const key = canonicalBudgetKey(value);
  return key ? BUDGET_BANDS[key] : null;
}

/** Khóa chuẩn của khoảng ngân sách (dùng để lưu vào ScentProfiles). */
export function canonicalBudgetKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalize = (input: string): string =>
    input.trim().toLowerCase().replace(/\s+/g, "").replace(/,/g, ".");
  const key = normalize(String(value));
  for (const candidate of Object.keys(BUDGET_BANDS)) {
    if (normalize(candidate) === key) return candidate;
  }
  return null;
}

/** Tách danh sách nhóm hương (dấu phẩy/chấm phẩy/gạch) → tên Scentory chuẩn. */
export function normalizeFamilyList(value: string | null | undefined): ScentoryFamily[] {
  if (!value) return [];
  const result = new Set<ScentoryFamily>();
  for (const part of String(value).split(/[,;|]/)) {
    const family = normalizeFamily(part);
    if (family) result.add(family);
  }
  return Array.from(result);
}

/** Các mức độ tỏa hương và thứ hạng tương đối (BR-MTCH-001: chênh 1 bậc = 0.5). */
const PROJECTION_RANK_LIST: Array<[string, number]> = [
  ["nhẹ", 1],
  ["nhe", 1],
  ["light", 1],
  ["gần", 1],
  ["gan", 1],
  ["thoang thoảng", 1],
  ["vừa", 2],
  ["vua", 2],
  ["trung bình", 2],
  ["moderate", 2],
  ["medium", 2],
  ["mạnh", 3],
  ["manh", 3],
  ["strong", 3],
  ["xa", 3],
  ["tỏa xa", 3],
];

const PROJECTION_RANKS = new Map<string, number>(PROJECTION_RANK_LIST);

export function normalizeProjectionRank(value: string | null | undefined): number | null {
  if (!value) return null;
  const key = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  return PROJECTION_RANKS.get(key) ?? null;
}

/** Tên hiển thị chuẩn của ba mức độ tỏa hương. */
export const CANONICAL_PROJECTIONS = ["Nhẹ", "Vừa", "Mạnh"] as const;
export type CanonicalProjection = (typeof CANONICAL_PROJECTIONS)[number];

export function normalizeProjection(value: string | null | undefined): CanonicalProjection | null {
  const rank = normalizeProjectionRank(value);
  if (rank === 1) return "Nhẹ";
  if (rank === 2) return "Vừa";
  if (rank === 3) return "Mạnh";
  return null;
}

/**
 * Hoàn cảnh sử dụng.
 * BR-MTCH-001: ngữ cảnh sản phẩm chứa dịp khách chọn = 1.0; chứa một phần = 0.5.
 */
const OCCASION_ALIAS_LIST: Array<[string, string]> = [
  ["hàng ngày", "Hàng ngày"],
  ["hang ngay", "Hàng ngày"],
  ["daily", "Hàng ngày"],
  ["everyday", "Hàng ngày"],
  ["công sở", "Công sở"],
  ["cong so", "Công sở"],
  ["office", "Công sở"],
  ["work", "Công sở"],
  ["hẹn hò", "Hẹn hò"],
  ["hen ho", "Hẹn hò"],
  ["date", "Hẹn hò"],
  ["tiệc tối", "Tiệc tối"],
  ["tiec toi", "Tiệc tối"],
  ["party", "Tiệc tối"],
  ["evening", "Tiệc tối"],
  ["du lịch", "Du lịch"],
  ["du lich", "Du lịch"],
  ["travel", "Du lịch"],
];

const OCCASION_ALIASES = new Map<string, string>(OCCASION_ALIAS_LIST);

export const CANONICAL_OCCASIONS = [
  "Hàng ngày",
  "Công sở",
  "Hẹn hò",
  "Tiệc tối",
  "Du lịch",
] as const;

export function normalizeOccasion(value: string | null | undefined): string | null {
  if (!value) return null;
  return canonicalOccasion(value) ?? String(value).trim();
}

/** Trả về đúng tên dịp chuẩn, hoặc null nếu không nhận diện được. */
export function canonicalOccasion(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = String(value).trim().toLowerCase().replace(/\s+/g, " ");
  return OCCASION_ALIASES.get(key) ?? null;
}

/** Tách chuỗi ngữ cảnh ("Hàng ngày, Hẹn hò") thành danh sách đã chuẩn hóa. */
export function splitOccasions(value: string | null | undefined): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;|/]/)
    .map((part) => normalizeOccasion(part))
    .filter((part): part is string => Boolean(part));
}

/**
 * BR-MTCH-003 — dải thời tiết và nhóm hương ưu tiên.
 * Điểm con: 1.0 = ưu tiên, 0.5 = trung tính, 0.0 = trái mùa.
 */
export type WeatherBand = "hotHumid" | "warm" | "cool" | "cold";

export const WEATHER_BAND_LABELS: Record<WeatherBand, string> = {
  hotHumid: "Nóng ẩm",
  warm: "Ấm vừa",
  cool: "Mát",
  cold: "Lạnh",
};

export const WEATHER_BAND_HINTS: Record<WeatherBand, string> = {
  hotHumid: "Ưu tiên hương cam chanh, biển và thảo mộc tươi mát",
  warm: "Cân bằng giữa thanh mát và lưu hương cho cả ngày dài",
  cool: "Tầng hương giữa bộc lộ rõ, phù hợp hương hoa và gỗ nhẹ",
  cold: "Ưu tiên hương ấm nồng, gỗ, hổ phách và da thuộc",
};

export const WEATHER_FAMILY_SCORES: Record<WeatherBand, Record<ScentoryFamily, number>> = {
  hotHumid: { Woody: 0.5, Aromatic: 1, Floral: 0.5, "Fresh/Citrus": 1, Fougère: 0.5, "Oriental/Amber": 0, Chypre: 0.5, Gourmand: 0 },
  warm: { Woody: 0.5, Aromatic: 1, Floral: 1, "Fresh/Citrus": 1, Fougère: 1, "Oriental/Amber": 0.5, Chypre: 0.5, Gourmand: 0.5 },
  cool: { Woody: 1, Aromatic: 0.5, Floral: 1, "Fresh/Citrus": 0.5, Fougère: 1, "Oriental/Amber": 0.5, Chypre: 1, Gourmand: 0.5 },
  cold: { Woody: 1, Aromatic: 0, Floral: 0.5, "Fresh/Citrus": 0, Fougère: 0.5, "Oriental/Amber": 1, Chypre: 0.5, Gourmand: 1 },
};

/**
 * Suy ra Projection/Longevity từ nồng độ thật của từng chai
 * (brand JSON: "EDP · 50ml", "Extrait · 60ml", "EDT · 100ml").
 * Dùng cho seed — không phải dữ liệu bịa từng sản phẩm.
 */
export const CONCENTRATION_PROFILE: Record<
  string,
  { projection: CanonicalProjection; longevity: string }
> = {
  extrait: { projection: "Mạnh", longevity: "Lâu" },
  "eau de parfum": { projection: "Vừa", longevity: "Lâu" },
  edp: { projection: "Vừa", longevity: "Lâu" },
  "eau de toilette": { projection: "Nhẹ", longevity: "Vừa" },
  edt: { projection: "Nhẹ", longevity: "Vừa" },
  "eau de cologne": { projection: "Nhẹ", longevity: "Ngắn" },
  edc: { projection: "Nhẹ", longevity: "Ngắn" },
};

export function deriveConcentrationProfile(raw: string | null | undefined): {
  projection: CanonicalProjection;
  longevity: string;
  concentration: string;
} {
  const concentration = String(raw ?? "")
    .split("·")[0]
    .trim();
  const key = concentration.toLowerCase();
  const preset = CONCENTRATION_PROFILE[key] ?? { projection: "Vừa", longevity: "Lâu" };
  return { ...preset, concentration: concentration || DEFAULT_CONCENTRATION };
}

/**
 * Hoàn cảnh theo nhóm hương — suy ra từ cảm hứng/đặc tính của nhóm
 * (dữ liệu `nhom-huong.json`: "Thần thái", "Nốt hương chủ đạo").
 */
export const FAMILY_OCCASIONS: Record<ScentoryFamily, string[]> = {
  Woody: ["Hẹn hò", "Tiệc tối", "Công sở"],
  Aromatic: ["Hàng ngày", "Du lịch", "Công sở"],
  Floral: ["Hàng ngày", "Công sở", "Hẹn hò"],
  "Fresh/Citrus": ["Hàng ngày", "Công sở", "Du lịch"],
  Fougère: ["Công sở", "Hàng ngày", "Hẹn hò"],
  "Oriental/Amber": ["Hẹn hò", "Tiệc tối"],
  Chypre: ["Công sở", "Hẹn hò", "Tiệc tối"],
  Gourmand: ["Hẹn hò", "Hàng ngày"],
};

/** Nốt hương giữa/nền theo nhóm hương (từ `nhom-huong.json`). */
export const FAMILY_NOTES: Record<ScentoryFamily, { middle: string; base: string }> = {
  Woody: { middle: "Tuyết tùng, Hoắc hương", base: "Đàn hương, Cỏ hương bài" },
  Aromatic: { middle: "Bách xù, Trà đen", base: "Rong biển, Xạ hương trắng" },
  Floral: { middle: "Hoa hồng, Hoa nhài", base: "Hoa diên vĩ, Mẫu đơn" },
  "Fresh/Citrus": { middle: "Bưởi, Quýt", base: "Cam bergamot, Chanh" },
  Fougère: { middle: "Oải hương, Quế", base: "Cam bergamot, Đậu Tonka" },
  "Oriental/Amber": { middle: "Nhũ hương, Hoa hồng", base: "Hổ phách, Vani" },
  Chypre: { middle: "Hoa hồng, Hoa nhài", base: "Rêu sồi, Hoắc hương" },
  Gourmand: { middle: "Cà phê, Tiêu hồng", base: "Vani, Hoa cam" },
};
