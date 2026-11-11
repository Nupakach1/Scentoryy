/**
 * Scent Match — lõi chấm điểm mức độ phù hợp (BR-MTCH-001, BR-MTCH-002).
 *
 *   ScentMatch(u,p) = ( Σ wᵢ·sᵢ(u,p) / Σ wᵢ ) × 100%
 *
 * - sᵢ ∈ [0,1] là điểm con của từng tiêu chí.
 * - Nếu một tiêu chí thiếu dữ liệu → `null`, bị loại khỏi MẪU SỐ (chuẩn hóa
 *   động) thay vì gán 0, đúng BR-MTCH-002 / UC-MTCH-001 nhánh 3a.
 * - Mọi hàm ở đây là pure function để test độc lập, không truy cập DB.
 */
import {
  BUDGET_DECAY_WINDOW,
  CRITERION_LABELS,
  FAMILY_RATING_FAVORITE_MIN,
  MATCH_SCORE_STEPS,
  OCCASION_SCORES,
  PERCENT_SCALE,
  PROJECTION_SCORES,
  SCENT_MATCH_WEIGHTS,
  WEATHER_BAND_LABELS,
  WEATHER_FAMILY_SCORES,
  type MatchCriterion,
  type ScentoryFamily,
  type WeatherBand,
  normalizeBudgetRange,
  normalizeFamily,
  normalizeFamilyList,
  normalizeOccasion,
  normalizeProjectionRank,
  splitOccasions,
} from "../cau-hinh/scentMatch";

/** Dữ liệu hồ sơ cần cho việc chấm điểm (subset của ScentProfiles). */
export interface MatchProfileInput {
  PreferredFamilies?: string | null;
  FamilyRatings?: Map<string, number> | Record<string, number> | null;
  PreferredProjection?: string | null;
  ExpectedOccasion?: string | null;
  BudgetRange?: string | null;
}

/** Dữ liệu sản phẩm cần cho việc chấm điểm (subset của Products). */
export interface MatchProductInput {
  ScentFamily?: string | null;
  Projection?: string | null;
  Occasion?: string | null;
  Price?: number | null;
}

export interface WeatherInput {
  band: WeatherBand;
  temperature: number;
  humidity: number;
}

export interface CriterionScore {
  score: number;
  reason: string;
}

export interface CriterionBreakdown {
  key: MatchCriterion;
  label: string;
  /** Trọng số cấu hình (0–1). */
  weight: number;
  /** Trọng số thực sự được dùng (0 nếu tiêu chí bị bỏ). */
  appliedWeight: number;
  /** Điểm con 0–1, hoặc null nếu thiếu dữ liệu. */
  score: number | null;
  /** w·s (0 nếu bị bỏ). */
  contribution: number;
  reason: string;
}

export interface MatchResult {
  matchScore: number;
  /** Tổng trọng số còn lại sau khi loại tiêu chí thiếu dữ liệu. */
  appliedWeight: number;
  breakdown: CriterionBreakdown[];
}

/** Map nhóm hương → tập nhóm lân cận (dựng từ ScentFamilies.CorrelatedFamilies). */
export type CorrelatedMap = Map<ScentoryFamily, Set<ScentoryFamily>>;

interface FamilyLike {
  Name?: string | null;
  CorrelatedFamilies?: string[] | null;
}

/**
 * Dựng quan hệ "nhóm lân cận" từ dữ liệu DB.
 * `CorrelatedFamilies` trong seed dùng tên Michael Edwards nên phải chuẩn hóa.
 * Quan hệ được làm đối xứng để "lân cận" có ý nghĩa hai chiều.
 */
export function buildCorrelatedMap(families: FamilyLike[]): CorrelatedMap {
  const map: CorrelatedMap = new Map();

  const ensure = (family: ScentoryFamily): Set<ScentoryFamily> => {
    const existing = map.get(family);
    if (existing) return existing;
    const created = new Set<ScentoryFamily>([family]);
    map.set(family, created);
    return created;
  };

  for (const doc of families) {
    const name = normalizeFamily(doc.Name);
    if (!name) continue;
    const neighbours = ensure(name);
    for (const raw of doc.CorrelatedFamilies ?? []) {
      const neighbour = normalizeFamily(raw);
      if (!neighbour) continue;
      neighbours.add(neighbour);
      ensure(neighbour).add(name);
    }
  }

  return map;
}

/** Lấy danh sách nhóm hương khách thích (PreferredFamilies + FamilyRatings ≥ 4). */
export function preferredFamilyList(profile: MatchProfileInput): ScentoryFamily[] {
  const result = new Set<ScentoryFamily>();

  for (const family of normalizeFamilyList(profile.PreferredFamilies)) {
    result.add(family);
  }

  const ratings = profile.FamilyRatings;
  if (ratings) {
    const entries: Array<[string, number]> =
      ratings instanceof Map ? Array.from(ratings.entries()) : Object.entries(ratings);
    for (const [name, value] of entries) {
      if (Number(value) >= FAMILY_RATING_FAVORITE_MIN) {
        const family = normalizeFamily(name);
        if (family) result.add(family);
      }
    }
  }

  return Array.from(result);
}

/* -------------------------------------------------------------------------- */
/* 1. Nhóm hương — exact 1.0 / lân cận 0.5 / lệch 0 (BR-MTCH-001)              */
/* -------------------------------------------------------------------------- */
export function scoreScentFamily(
  profile: MatchProfileInput,
  product: MatchProductInput,
  correlated: CorrelatedMap
): CriterionScore | null {
  const productFamily = normalizeFamily(product.ScentFamily);
  if (!productFamily) return null;

  const preferences = preferredFamilyList(profile);
  if (preferences.length === 0) return null;

  let bestNeighbour = false;

  for (const preference of preferences) {
    if (preference === productFamily) {
      return {
        score: MATCH_SCORE_STEPS.exact,
        reason: `Nhóm hương "${productFamily}" khớp chính xác sở thích của bạn.`,
      };
    }
    if (correlated.get(preference)?.has(productFamily)) {
      bestNeighbour = true;
    }
  }

  if (bestNeighbour) {
    return {
      score: MATCH_SCORE_STEPS.neighbour,
      reason: `Nhóm hương "${productFamily}" là nhóm lân cận với sở thích của bạn.`,
    };
  }

  return {
    score: MATCH_SCORE_STEPS.none,
    reason: `Nhóm hương "${productFamily}" không nằm trong nhóm bạn yêu thích.`,
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Hoàn cảnh — chứa đầy đủ 1.0 / một phần 0.5 / không 0                     */
/* -------------------------------------------------------------------------- */
export function scoreOccasion(
  profile: MatchProfileInput,
  product: MatchProductInput
): CriterionScore | null {
  const wanted = normalizeOccasion(profile.ExpectedOccasion);
  if (!wanted) return null;

  const occasions = splitOccasions(product.Occasion);
  if (occasions.length === 0) return null;

  const wantedKey = wanted.toLowerCase();
  const exact = occasions.some((item) => item.toLowerCase() === wantedKey);
  if (exact) {
    return { score: OCCASION_SCORES.full, reason: `Sản phẩm phù hợp với dịp "${wanted}".` };
  }

  const partial = occasions.some((item) => {
    const key = item.toLowerCase();
    return key.includes(wantedKey) || wantedKey.includes(key);
  });
  if (partial) {
    return {
      score: OCCASION_SCORES.partial,
      reason: `Sản phẩm phù hợp một phần với dịp "${wanted}".`,
    };
  }

  return {
    score: OCCASION_SCORES.none,
    reason: `Sản phẩm không được thiết kế cho dịp "${wanted}".`,
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Độ tỏa — cùng bậc 1.0 / chênh 1 bậc 0.5 / chênh ≥ 2 bậc 0               */
/* -------------------------------------------------------------------------- */
export function scoreProjection(
  profile: MatchProfileInput,
  product: MatchProductInput
): CriterionScore | null {
  const wantedRank = normalizeProjectionRank(profile.PreferredProjection);
  const productRank = normalizeProjectionRank(product.Projection);
  if (wantedRank === null || productRank === null) return null;

  const gap = Math.abs(wantedRank - productRank);
  if (gap === 0) {
    return {
      score: PROJECTION_SCORES.same,
      reason: `Độ tỏa "${product.Projection}" đúng như mong muốn.`,
    };
  }
  if (gap === 1) {
    return {
      score: PROJECTION_SCORES.oneLevelAway,
      reason: `Độ tỏa chênh 1 bậc so với mong muốn ("${profile.PreferredProjection}" → "${product.Projection}").`,
    };
  }
  return {
    score: PROJECTION_SCORES.far,
    reason: `Độ tỏa lệch quá xa mong muốn ("${profile.PreferredProjection}" → "${product.Projection}").`,
  };
}

/* -------------------------------------------------------------------------- */
/* 4. Ngân sách — trong khoảng 1.0 / vượt giảm tuyến tính                       */
/* -------------------------------------------------------------------------- */
export function scoreBudget(
  profile: MatchProfileInput,
  product: MatchProductInput
): CriterionScore | null {
  const band = normalizeBudgetRange(profile.BudgetRange);
  if (!band) return null;

  const price = Number(product.Price);
  if (!Number.isFinite(price) || price < 0) return null;

  if (price <= band.max) {
    return {
      score: MATCH_SCORE_STEPS.exact,
      reason: `Giá ${formatVnd(price)} nằm trong ngân sách "${band.label}".`,
    };
  }

  if (!Number.isFinite(band.max)) {
    return {
      score: MATCH_SCORE_STEPS.exact,
      reason: `Giá ${formatVnd(price)} nằm trong ngân sách của bạn.`,
    };
  }

  const overflow = price - band.max;
  const window = band.max * BUDGET_DECAY_WINDOW;
  const score = window > 0 ? clamp01(1 - overflow / window) : MATCH_SCORE_STEPS.none;
  const overPercent = Math.round((overflow / band.max) * PERCENT_SCALE);

  return {
    score,
    reason: `Giá vượt ngân sách "${band.label}" khoảng ${overPercent}% — điểm giảm tuyến tính.`,
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Thời tiết — theo BR-MTCH-003                                               */
/* -------------------------------------------------------------------------- */
export function scoreWeather(
  weather: WeatherInput | null | undefined,
  product: MatchProductInput
): CriterionScore | null {
  if (!weather) return null;
  const family = normalizeFamily(product.ScentFamily);
  if (!family) return null;

  const table = WEATHER_FAMILY_SCORES[weather.band];
  const score = table[family];
  if (typeof score !== "number") return null;

  const label = WEATHER_BAND_LABELS[weather.band];
  if (score >= MATCH_SCORE_STEPS.exact) {
    return { score: MATCH_SCORE_STEPS.exact, reason: `Thời tiết "${label}" rất ưu tiên nhóm hương này.` };
  }
  if (score >= MATCH_SCORE_STEPS.neighbour) {
    return { score, reason: `Nhóm hương trung tính với thời tiết "${label}".` };
  }
  return { score, reason: `Nhóm hương trái mùa với thời tiết "${label}".` };
}

/* -------------------------------------------------------------------------- */
/* Tổng hợp                                                                     */
/* -------------------------------------------------------------------------- */
export function calculateScentMatch(
  profile: MatchProfileInput,
  product: MatchProductInput,
  weather: WeatherInput | null | undefined,
  correlated: CorrelatedMap,
  weights: Partial<Record<MatchCriterion, number>> = SCENT_MATCH_WEIGHTS
): MatchResult {
  const criteria: Array<{ key: MatchCriterion; result: CriterionScore | null }> = [
    { key: "scentFamily", result: scoreScentFamily(profile, product, correlated) },
    { key: "occasion", result: scoreOccasion(profile, product) },
    { key: "projection", result: scoreProjection(profile, product) },
    { key: "budget", result: scoreBudget(profile, product) },
    { key: "weather", result: scoreWeather(weather, product) },
  ];

  let weightedSum = 0;
  let appliedWeight = 0;

  const breakdown: CriterionBreakdown[] = criteria.map(({ key, result }) => {
    const weight = weights[key] ?? SCENT_MATCH_WEIGHTS[key];
    if (result) {
      weightedSum += weight * result.score;
      appliedWeight += weight;
    }
    return {
      key,
      label: CRITERION_LABELS[key],
      weight,
      appliedWeight: result ? weight : 0,
      score: result ? result.score : null,
      contribution: result ? weight * result.score : 0,
      reason: result ? result.reason : "Thiếu dữ liệu — tiêu chí được bỏ khỏi mẫu số.",
    };
  });

  const matchScore =
    appliedWeight > 0
      ? Math.round((weightedSum / appliedWeight) * PERCENT_SCALE)
      : 0;

  return { matchScore, appliedWeight, breakdown };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function formatVnd(value: number): string {
  return value.toLocaleString("vi-VN") + "đ";
}

/** Re-export để route/service khác dùng chung (tránh import vòng). */
export type { MatchCriterion, ScentoryFamily, WeatherBand };
