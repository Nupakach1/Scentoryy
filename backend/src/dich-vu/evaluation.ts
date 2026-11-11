/**
 * Đánh giá chất lượng gợi ý — UC-DASH-002 (FR-DASH-EVL-001), Chương 3 mục 3.4.
 * Ngoại tuyến: bộ 12 hồ sơ sinh từ mọi tổ hợp Scent Quiz (phong cách × tông × tâm trạng),
 * nhãn phù hợp tính theo luật độc lập với trọng số → Precision@3, HitRate@3, NDCG@3, độ phủ, độ ổn định.
 * Trực tuyến: đọc Reviews/Orders thật trên MongoDB Atlas.
 */
import { SCENT_MATCH_WEIGHTS, normalizeFamily, normalizeProjectionRank, splitOccasions } from "../cau-hinh/scentMatch";
import { buildCorrelatedMap, calculateScentMatch, type CorrelatedMap, type MatchProductInput } from "./scentMatch";
import { deriveProfile, type QuizAnswersInput } from "./quizMapping";

export interface EvalProduct extends MatchProductInput { Name: string }
interface EvalProfile {
  key: string;
  PreferredFamilies: string;
  FamilyRatings: Record<string, number>;
  PreferredProjection: string;
  ExpectedOccasion: string;
  BudgetRange: null;
}

const round = (x: number | null, n = 3) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** n) / 10 ** n);
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export function buildTestProfiles(): EvalProfile[] {
  const out: EvalProfile[] = [];
  for (const style of ["feminine", "masculine"] as const)
    for (const tone of ["warm_opulent", "fresh_clean"] as const)
      for (const mood of ["night_party", "day_energy", "mindful_relax"] as const) {
        const a: QuizAnswersInput = {
          style, tone, mood, includeUnisex: true,
          aura: mood === "night_party" ? "bold" : "soft",
          habit: "daily_spritzer", age: 28,
        };
        const d = deriveProfile(a);
        out.push({
          key: `${style}/${tone}/${mood}`,
          PreferredFamilies: d.preferredFamilies.join(", "),
          FamilyRatings: d.familyRatings,
          PreferredProjection: d.preferredProjection,
          ExpectedOccasion: d.expectedOccasion,
          BudgetRange: null,
        });
      }
  return out;
}

/** Nhãn kỳ vọng 0/1/2 theo luật, không dùng trọng số (tránh tự chấm điểm cho chính mình). */
export function relevance(p: EvalProfile, product: EvalProduct): number {
  const fam = normalizeFamily(product.ScentFamily);
  const liked = fam ? (p.FamilyRatings[fam] ?? 0) >= 4 : false;
  const occ = splitOccasions(product.Occasion);
  const wanted = splitOccasions(p.ExpectedOccasion);
  const ctx = occ.some((o) => wanted.includes(o));
  const pr = normalizeProjectionRank(product.Projection);
  const ur = normalizeProjectionRank(p.PreferredProjection);
  const proj = pr != null && ur != null && Math.abs(pr - ur) <= 1;
  const hits = [liked, ctx, proj].filter(Boolean).length;
  return hits === 3 ? 2 : hits === 2 ? 1 : 0;
}

function rank(p: EvalProfile, products: EvalProduct[], corr: CorrelatedMap, weights?: Record<string, number>) {
  return products
    .map((x) => ({ x, s: calculateScentMatch(p, x, null, corr, weights).matchScore }))
    .sort((a, b) => b.s - a.s || a.x.Name.localeCompare(b.x.Name));
}

export function offlineMetrics(products: EvalProduct[], families: Array<{ Name: string; CorrelatedFamilies: string[] }>, K = 3) {
  const corr = buildCorrelatedMap(families);
  const profiles = buildTestProfiles();
  const per = profiles.map((p) => {
    const ranked = rank(p, products, corr);
    const top = ranked.slice(0, K);
    const rels = top.map((r) => relevance(p, r.x));
    const ideal = products.map((x) => relevance(p, x)).sort((a, b) => b - a).slice(0, K);
    const dcg = rels.reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);
    const idcg = ideal.reduce((s, g, i) => s + (2 ** g - 1) / Math.log2(i + 2), 0);
    return {
      profile: p.key,
      topK: top.map((r) => ({ name: r.x.Name, score: r.s, relevance: relevance(p, r.x) })),
      precision: rels.filter((g) => g === 2).length / K,
      hit: rels.some((g) => g === 2) ? 1 : 0,
      ndcg: idcg ? dcg / idcg : null,
    };
  });
  const covered = new Set(per.flatMap((r) => r.topK.map((t) => t.name)));
  // Độ ổn định: biến thiên từng trọng số ±10%, tỉ lệ vị trí Top-K thay đổi
  const changes: number[] = [];
  for (const p of profiles) {
    const base = rank(p, products, corr).slice(0, K).map((r) => r.x.Name);
    for (const key of Object.keys(SCENT_MATCH_WEIGHTS)) {
      for (const f of [0.9, 1.1]) {
        const w = { ...SCENT_MATCH_WEIGHTS, [key]: SCENT_MATCH_WEIGHTS[key as keyof typeof SCENT_MATCH_WEIGHTS] * f };
        const alt = rank(p, products, corr, w).slice(0, K).map((r) => r.x.Name);
        changes.push(base.filter((n, i) => alt[i] !== n).length / K);
      }
    }
  }
  return {
    k: K,
    profiles: profiles.length,
    products: products.length,
    precisionAtK: round(mean(per.map((r) => r.precision))),
    hitRateAtK: round(mean(per.map((r) => r.hit))),
    ndcgAtK: round(mean(per.map((r) => r.ndcg).filter((x): x is number => x != null))),
    coverage: round(covered.size / Math.max(1, products.length)),
    stability: round(1 - (mean(changes) ?? 0)),
    detail: per,
  };
}

/** Hệ số tương quan hạng Spearman. */
export function spearman(x: number[], y: number[]): number | null {
  if (x.length < 3) return null;
  const ranks = (a: number[]) => {
    const s = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r: number[] = [];
    let i = 0;
    while (i < s.length) {
      let j = i;
      while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
      for (let k = i; k <= j; k++) r[s[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const rx = ranks(x), ry = ranks(y);
  const mx = mean(rx)!, my = mean(ry)!;
  const t = rx.reduce((s, v, i) => s + (v - mx) * (ry[i] - my), 0);
  const m = Math.sqrt(rx.reduce((s, v) => s + (v - mx) ** 2, 0) * ry.reduce((s, v) => s + (v - my) ** 2, 0));
  return m ? round(t / m) : null;
}
