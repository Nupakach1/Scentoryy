/**
 * Cá nhân hóa — UC-QUIZ-001 (Scent Quiz), UC-MTCH-001 (Scent Match), FR-CAT-DTL-002/004.
 * Quy tắc: BR-QUIZ-001..004, BR-MTCH-001..005.
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { INTERACTION_TYPES } from "../cau-hinh/nghiepVu";
import { PERCENT_SCALE } from "../cau-hinh/scentMatch";
import { DEFAULT_LOCATION, WEATHER_LOCATION_LABEL } from "../cau-hinh/weather";
import { AppError } from "../trung-gian/error";
import { optionalAuth, requireAuth } from "../trung-gian/auth";
import { Product } from "../mo-hinh/Product";
import { ScentFamily } from "../mo-hinh/ScentFamily";
import { ScentProfile } from "../mo-hinh/ScentProfile";
import { QuizAnswersSchema, deriveProfile } from "../dich-vu/quizMapping";
import { buildCorrelatedMap, calculateScentMatch, type MatchProfileInput, type WeatherInput } from "../dich-vu/scentMatch";
import { fetchWeather, weatherScoreLookup } from "../dich-vu/weatherService";
import { effectiveRatings, trackInteraction } from "../dich-vu/behavior";
import { toProductDto, toProfileDto } from "../dich-vu/dto";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";
import { ProductListQuery, buildProductFilter } from "./catalog";

export const quizRouter = Router();
export const matchRouter = Router();
export const weatherRouter = Router();
export const interactionsRouter = Router();

// POST /api/v1/quiz/submissions — FR-QUIZ-PRF-001
quizRouter.post(
  "/submissions",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = QuizAnswersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("ERR-QUIZ-422-01", undefined, parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
    }
    const a = parsed.data;
    const d = deriveProfile(a);
    const doc = {
      QuizAnswers: { Style: a.style, IncludeUnisex: a.includeUnisex, Tone: a.tone, Mood: a.mood, Aura: a.aura, Habit: a.habit, Age: a.age },
      PreferredFamilies: d.preferredFamilies.join(", "),
      FamilyRatings: d.familyRatings,
      PreferredProjection: d.preferredProjection,
      ExpectedOccasion: d.expectedOccasion,
      PreferredVolume: d.preferredVolume,
      ProfileTitle: d.profileTitle,
      IsCompleted: true,
      UpdatedAt: new Date(),
    };
    if (!req.user) {
      // BR-QUIZ-004: khách vãng lai nhận hồ sơ tạm, không lưu CSDL
      return created(res, { ...toProfileDto(doc), lede: d.profileLede, saved: false });
    }
    const profile = await ScentProfile.findOneAndUpdate(
      { UserID: req.user.sub },
      { $set: { ...doc, UserID: req.user.sub } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    created(res, { ...toProfileDto(profile), lede: d.profileLede, saved: true });
  })
);

// GET /api/v1/quiz/profile — FR-QUIZ-PRF-002
quizRouter.get(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await ScentProfile.findOne({ UserID: req.user!.sub });
    if (!p || !p.IsCompleted) throw new AppError("ERR-MTCH-409-01");
    const lede = p.QuizAnswers
      ? deriveProfile({
          style: p.QuizAnswers.Style, includeUnisex: p.QuizAnswers.IncludeUnisex, tone: p.QuizAnswers.Tone,
          mood: p.QuizAnswers.Mood, aura: p.QuizAnswers.Aura, habit: p.QuizAnswers.Habit, age: p.QuizAnswers.Age,
        }).profileLede
      : null;
    ok(res, { ...toProfileDto(p), lede });
  })
);

/** Đọc thời tiết; lỗi → null (BR-MTCH-002, ERR-MTCH-503-01 dạng cảnh báo). */
async function weatherFor(lat?: number, lon?: number): Promise<{ weather: WeatherInput | null; meta: Record<string, unknown> }> {
  const target = typeof lat === "number" && typeof lon === "number" ? { lat, lon } : DEFAULT_LOCATION;
  try {
    const w = await fetchWeather(target.lat, target.lon);
    return { weather: { band: w.band, temperature: w.temperature, humidity: w.humidity }, meta: { band: w.band, label: w.label, temperature: w.temperature, humidity: w.humidity } };
  } catch (e) {
    console.warn("[ERR-MTCH-503-01]", (e as Error).message);
    return { weather: null, meta: { warning: "ERR-MTCH-503-01" } };
  }
}

const MatchQuery = ProductListQuery.extend({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
});

/** Nguồn hồ sơ: hồ sơ đã lưu (khách hàng) hoặc hồ sơ tạm gửi kèm (khách vãng lai, BR-QUIZ-004). */
async function resolveProfile(userId: string | undefined, guest?: unknown): Promise<MatchProfileInput> {
  if (userId) {
    const p = await ScentProfile.findOne({ UserID: userId });
    if (!p || !p.IsCompleted) throw new AppError("ERR-MTCH-409-01");
    return {
      PreferredFamilies: p.PreferredFamilies,
      FamilyRatings: effectiveRatings(p.FamilyRatings, p.BehaviorAdjustments),
      PreferredProjection: p.PreferredProjection,
      ExpectedOccasion: p.ExpectedOccasion,
      BudgetRange: p.BudgetRange,
    };
  }
  const g = QuizAnswersSchema.safeParse(guest);
  if (!g.success) throw new AppError("ERR-MTCH-409-01");
  const d = deriveProfile(g.data);
  return {
    PreferredFamilies: d.preferredFamilies.join(", "),
    FamilyRatings: d.familyRatings,
    PreferredProjection: d.preferredProjection,
    ExpectedOccasion: d.expectedOccasion,
    BudgetRange: null,
  };
}

async function scoreProducts(profile: MatchProfileInput, filter: Record<string, unknown>, lat?: number, lon?: number) {
  const [{ weather, meta }, products, families] = await Promise.all([
    weatherFor(lat, lon),
    Product.find(filter).lean(),
    ScentFamily.find({ IsActive: true }).lean(),
  ]);
  const corr = buildCorrelatedMap(families.map((f) => ({ Name: f.Name, CorrelatedFamilies: f.CorrelatedFamilies })));
  const scored = products
    .map((p) => {
      const r = calculateScentMatch(profile, p, weather, corr);
      return { product: toProductDto(p), matchScore: r.matchScore, appliedWeight: r.appliedWeight, breakdown: r.breakdown };
    })
    .sort((a, b) => b.matchScore - a.matchScore || String(a.product.name).localeCompare(String(b.product.name)));
  return { scored, weather: meta };
}

// GET /api/v1/match/products — FR-MTCH-SCR-001 (khách hàng)
matchRouter.get(
  "/products",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = MatchQuery.parse(req.query);
    const profile = await resolveProfile(req.user!.sub);
    const { scored, weather } = await scoreProducts(profile, buildProductFilter(q), q.lat, q.lon);
    const limit = q.limit ?? scored.length;
    ok(res, scored.slice(0, limit), { total: scored.length, weather });
  })
);

// POST /api/v1/match/preview — Top 3 cho khách vãng lai (FR-QUIZ-REC-001)
matchRouter.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const body = z.object({ answers: z.unknown(), limit: z.number().int().min(1).max(12).optional(), lat: z.number().optional(), lon: z.number().optional() }).parse(req.body);
    const profile = await resolveProfile(undefined, body.answers);
    const { scored, weather } = await scoreProducts(profile, { IsActive: true }, body.lat, body.lon);
    ok(res, scored.slice(0, body.limit ?? 3), { total: scored.length, weather });
  })
);

// GET /api/v1/match/products/:id — FR-CAT-DTL-002
matchRouter.get(
  "/products/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const q = MatchQuery.pick({ lat: true, lon: true }).parse(req.query);
    const id = String(req.params.id);
    const filter = Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id), IsActive: true } : { SKU: id.toUpperCase(), IsActive: true };
    const profile = await resolveProfile(req.user!.sub);
    const { scored, weather } = await scoreProducts(profile, filter, q.lat, q.lon);
    if (!scored[0]) throw new AppError("ERR-CAT-404-01");
    ok(res, scored[0], { weather });
  })
);

// GET /api/v1/weather — FR-MTCH-WTH-001
weatherRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = z.object({ lat: z.coerce.number().min(-90).max(90).optional(), lon: z.coerce.number().min(-180).max(180).optional() }).parse(req.query);
    const t = q.lat != null && q.lon != null ? { lat: q.lat, lon: q.lon } : DEFAULT_LOCATION;
    let w;
    try {
      w = await fetchWeather(t.lat, t.lon);
    } catch {
      return ok(res, null, { warning: "ERR-MTCH-503-01" });
    }
    const scores: Record<string, number> = {};
    for (const [f, v] of Object.entries(weatherScoreLookup(w.band))) scores[f] = Math.round(v * PERCENT_SCALE);
    ok(res, {
      locationName: q.lat != null ? null : WEATHER_LOCATION_LABEL,
      temperature: w.temperature, humidity: w.humidity, band: w.band, label: w.label, hint: w.hint, scores, fetchedAt: w.fetchedAt,
    });
  })
);

// POST /api/v1/interactions — FR-CAT-DTL-004, FR-MTCH-BHV-001
interactionsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const b = z.object({ productId: z.string().regex(/^[0-9a-f]{24}$/i), actionType: z.enum(INTERACTION_TYPES) }).parse(req.body);
    await trackInteraction(req.user!.sub, b.productId, b.actionType);
    created(res, { recorded: true });
  })
);
