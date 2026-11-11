/**
 * Làm giàu hồ sơ mùi hương từ hành vi — BR-MTCH-005 (UC-MTCH-001, FR-MTCH-BHV-001).
 * Hàm `computeAdjustments` thuần để kiểm thử; `refreshProfileFromBehavior` đọc CSDL.
 */
import { Types } from "mongoose";
import { BEHAVIOR_RULES, BEHAVIOR_SIGNAL_POINTS, type InteractionType } from "../cau-hinh/nghiepVu";
import { normalizeFamily } from "../cau-hinh/scentMatch";
import { Order } from "../mo-hinh/Order";
import { OrderItem } from "../mo-hinh/OrderItem";
import { Product } from "../mo-hinh/Product";
import { Review } from "../mo-hinh/Review";
import { ScentProfile } from "../mo-hinh/ScentProfile";
import { UserInteraction } from "../mo-hinh/UserInteraction";

export type SignalKind = keyof typeof BEHAVIOR_SIGNAL_POINTS;
export interface Signal { family: string | null; kind: SignalKind }

export function computeAdjustments(signals: Signal[]): {
  scores: Record<string, number>;
  adjustments: Record<string, number>;
  signalCount: number;
} {
  const scores: Record<string, number> = {};
  for (const s of signals) {
    if (!s.family) continue;
    scores[s.family] = (scores[s.family] ?? 0) + BEHAVIOR_SIGNAL_POINTS[s.kind];
  }
  const positive = Object.values(scores).filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const adjustments: Record<string, number> = {};
  if (signals.length >= BEHAVIOR_RULES.minSignals) {
    for (const [family, score] of Object.entries(scores)) {
      if (score >= BEHAVIOR_RULES.raiseThreshold && positive > 0 && score / positive >= BEHAVIOR_RULES.raiseShare) {
        adjustments[family] = 1;
      } else if (score <= BEHAVIOR_RULES.lowerThreshold) {
        adjustments[family] = -1;
      }
    }
  }
  return { scores, adjustments, signalCount: signals.length };
}

/** Áp điều chỉnh hành vi lên FamilyRatings (giới hạn 1–5) — dùng khi chấm điểm. */
export function effectiveRatings(
  ratings: Map<string, number> | Record<string, number> | null | undefined,
  adjustments: Map<string, number> | Record<string, number> | null | undefined
): Record<string, number> {
  const base: Record<string, number> = ratings instanceof Map ? Object.fromEntries(ratings) : { ...(ratings ?? {}) };
  const adj: Record<string, number> = adjustments instanceof Map ? Object.fromEntries(adjustments) : { ...(adjustments ?? {}) };
  for (const [family, delta] of Object.entries(adj)) {
    base[family] = Math.max(1, Math.min(5, (base[family] ?? 2) + delta));
  }
  return base;
}

const KIND_OF: Partial<Record<InteractionType, SignalKind>> = {
  view: "view",
  click: "click",
  wishlist: "wishlist",
  add_to_cart: "add_to_cart",
};

export async function refreshProfileFromBehavior(userId: string): Promise<void> {
  const uid = new Types.ObjectId(userId);
  const since = new Date(Date.now() - BEHAVIOR_RULES.windowDays * 86_400_000);
  const [interactions, reviews, orders] = await Promise.all([
    UserInteraction.find({ UserID: uid, Timestamp: { $gte: since } }, "ProductID ActionType").lean(),
    Review.find({ UserID: uid, CreatedAt: { $gte: since } }, "ProductID OverallRating").lean(),
    Order.find({ UserID: uid, CreatedAt: { $gte: since }, Status: { $ne: "CANCELLED" } }, "_id").lean(),
  ]);
  const items = await OrderItem.find({ OrderID: { $in: orders.map((o) => o._id) } }, "ProductID").lean();
  const ids = [...interactions.map((x) => x.ProductID), ...reviews.map((r) => r.ProductID), ...items.map((i) => i.ProductID)];
  const products = await Product.find({ _id: { $in: ids } }, "ScentFamily").lean();
  const familyOf = new Map(products.map((p) => [String(p._id), normalizeFamily(p.ScentFamily)]));
  const fam = (id: unknown) => familyOf.get(String(id)) ?? null;
  const signals: Signal[] = [
    ...interactions.flatMap((x) => (KIND_OF[x.ActionType] ? [{ family: fam(x.ProductID), kind: KIND_OF[x.ActionType]! }] : [])),
    ...items.map((i) => ({ family: fam(i.ProductID), kind: "purchase" as const })),
    ...reviews
      .filter((r) => r.OverallRating >= 4 || r.OverallRating <= 2)
      .map((r) => ({ family: fam(r.ProductID), kind: (r.OverallRating >= 4 ? "review_good" : "review_bad") as SignalKind })),
  ];
  const result = computeAdjustments(signals);
  await ScentProfile.updateOne(
    { UserID: uid },
    { $set: { BehaviorScores: result.scores, BehaviorAdjustments: result.adjustments, LearnedAt: new Date() } }
  );
}

/** Ghi tương tác rồi làm giàu hồ sơ; lỗi chỉ ghi log, không chặn luồng chính. */
export async function trackInteraction(userId: string | undefined, productId: string, action: InteractionType): Promise<void> {
  if (!userId || !Types.ObjectId.isValid(productId)) return;
  try {
    await UserInteraction.create({ UserID: userId, ProductID: productId, ActionType: action });
    await refreshProfileFromBehavior(userId);
  } catch (e) {
    console.error("[BR-MTCH-005] Làm giàu hồ sơ thất bại:", (e as Error).message);
  }
}
