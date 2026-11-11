/**
 * Quản trị — UC-PRD-001, UC-ORD-004, UC-RET-002, UC-USR-001, UC-DASH-001, UC-DASH-002.
 * Mọi route yêu cầu role admin (BR-SEC-006).
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { ORDER_STATUSES, RETURN_TRANSITIONS, type ReturnStatus } from "../cau-hinh/nghiepVu";
import { SCENTORY_FAMILIES } from "../cau-hinh/scentMatch";
import { AppError } from "../trung-gian/error";
import { adminOnly } from "../trung-gian/auth";
import { Message } from "../mo-hinh/Message";
import { Order } from "../mo-hinh/Order";
import { OrderItem } from "../mo-hinh/OrderItem";
import { Product } from "../mo-hinh/Product";
import { ReturnRequest } from "../mo-hinh/ReturnRequest";
import { Review } from "../mo-hinh/Review";
import { ScentFamily } from "../mo-hinh/ScentFamily";
import { ScentProfile } from "../mo-hinh/ScentProfile";
import { User } from "../mo-hinh/User";
import { adminTransition, expireStaleQrOrders } from "../dich-vu/orderService";
import { buildCorrelatedMap, calculateScentMatch } from "../dich-vu/scentMatch";
import { offlineMetrics, spearman } from "../dich-vu/evaluation";
import { effectiveRatings } from "../dich-vu/behavior";
import { toOrderDto, toProductDto, toProfileDto, toReturnDto, toUserDto } from "../dich-vu/dto";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created, paging } from "../tien-ich/phanHoi";

export const adminRouter = Router();
adminRouter.use(...adminOnly);

const oid = z.string().regex(/^[0-9a-f]{24}$/i, "Mã không hợp lệ");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------- UC-DASH-001
adminRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - 30 * 86_400_000);
    if (from > to) throw new AppError("ERR-VAL-422-01", "Ngày bắt đầu phải trước ngày kết thúc.");
    await expireStaleQrOrders();
    const range = { CreatedAt: { $gte: from, $lte: to } };
    const [byStatus, revenue, refunds, newCustomers, lowStock, top, recent, pendingReturns, unreadMessages, daily] = await Promise.all([
      Order.aggregate([{ $match: range }, { $group: { _id: "$Status", n: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { ...range, Status: "DELIVERED" } }, { $group: { _id: null, total: { $sum: "$TotalAmount" } } }]),
      ReturnRequest.aggregate([{ $match: { Status: "COMPLETED", RequestType: "REFUND", ResolvedAt: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: "$RefundAmount" } } }]),
      User.countDocuments({ Role: "customer", ...range }),
      Product.find({ IsActive: true, StockQuantity: { $lte: 5 } }).sort({ StockQuantity: 1 }).limit(10).lean(),
      OrderItem.aggregate([
        { $lookup: { from: "Orders", localField: "OrderID", foreignField: "_id", as: "o" } },
        { $unwind: "$o" },
        { $match: { "o.Status": "DELIVERED", "o.CreatedAt": { $gte: from, $lte: to } } },
        { $group: { _id: "$ProductID", name: { $first: "$ProductName" }, quantity: { $sum: "$Quantity" }, revenue: { $sum: { $multiply: ["$Quantity", "$FixedUnitPrice"] } } } },
        { $sort: { quantity: -1 } }, { $limit: 5 },
      ]),
      Order.find().sort({ CreatedAt: -1 }).limit(10).populate("UserID", "FullName Email").lean(),
      ReturnRequest.countDocuments({ Status: "PENDING" }),
      Message.countDocuments({ To: null, Read: false }),
      Order.aggregate([
        { $match: { ...range, Status: { $ne: "CANCELLED" } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$CreatedAt", timezone: "+07:00" } }, orders: { $sum: 1 }, amount: { $sum: "$TotalAmount" } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const counts: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const s of byStatus as Array<{ _id: string; n: number }>) counts[s._id] = s.n;
    ok(res, {
      range: { from, to },
      revenue: (revenue[0]?.total ?? 0) - (refunds[0]?.total ?? 0),
      ordersByStatus: counts,
      totalOrders: Object.values(counts).reduce((a, b) => a + b, 0),
      newCustomers,
      totalProducts: await Product.countDocuments({ IsActive: true }),
      lowStock: lowStock.map(toProductDto),
      topProducts: top.map((t: { _id: unknown; name: string; quantity: number; revenue: number }) => ({ productId: String(t._id), name: t.name, quantity: t.quantity, revenue: t.revenue })),
      recentOrders: recent.map((o) => toOrderDto(o)),
      pendingReturns,
      unreadMessages,
      daily: daily.map((d: { _id: string; orders: number; amount: number }) => ({ date: d._id, orders: d.orders, amount: d.amount })),
    });
  })
);

// Số đếm hiển thị trên menu quản trị: đơn chờ xử lý, đổi trả chờ duyệt, tin chưa đọc
adminRouter.get(
  "/badges",
  asyncHandler(async (_req, res) => {
    const [orders, returns, messages] = await Promise.all([
      Order.countDocuments({ Status: "PROCESSING" }),
      ReturnRequest.countDocuments({ Status: "PENDING" }),
      Message.countDocuments({ To: null, Read: false }),
    ]);
    ok(res, { orders, returns, messages });
  })
);

// ------------------------------------------------------------- UC-PRD-001
const ProductBody = z.object({
  sku: z.string().trim().min(2).max(50),
  name: z.string().trim().min(1).max(150),
  brand: z.string().trim().min(1).max(100),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  concentration: z.string().trim().min(1).max(50),
  volume: z.number().int().positive().default(50),
  family: z.enum(SCENTORY_FAMILIES),
  topNotes: z.string().trim().min(1).max(255),
  middleNotes: z.string().trim().min(1).max(255),
  baseNotes: z.string().trim().min(1).max(255),
  projection: z.enum(["Nhẹ", "Vừa", "Mạnh"]),
  longevity: z.enum(["Ngắn", "Vừa", "Lâu"]),
  occasion: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().trim().max(255).optional().nullable(),
  isActive: z.boolean().optional(),
});
const toProductDoc = (b: Partial<z.infer<typeof ProductBody>>) => {
  const m: Record<string, unknown> = {
    SKU: b.sku?.toUpperCase(), Name: b.name, BrandName: b.brand, Price: b.price, StockQuantity: b.stock, Concentration: b.concentration,
    Volume: b.volume, ScentFamily: b.family, TopNotes: b.topNotes, MiddleNotes: b.middleNotes, BaseNotes: b.baseNotes,
    Projection: b.projection, Longevity: b.longevity, Occasion: b.occasion, Description: b.description, ImageUrl: b.imageUrl, IsActive: b.isActive,
  };
  for (const k of Object.keys(m)) if (m[k] === undefined) delete m[k];
  return m;
};

adminRouter.get(
  "/products",
  asyncHandler(async (req, res) => {
    const q = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(["active", "inactive"]).optional() }).parse(req.query);
    const filter: Record<string, unknown> = {};
    if (q.q) filter.$or = [{ Name: new RegExp(escapeRe(q.q), "i") }, { SKU: new RegExp(escapeRe(q.q), "i") }, { BrandName: new RegExp(escapeRe(q.q), "i") }];
    if (q.status) filter.IsActive = q.status === "active";
    ok(res, (await Product.find(filter).sort({ SKU: 1 }).lean()).map(toProductDto));
  })
);

async function ensureUnique(name?: string, sku?: string, exceptId?: string) {
  const or = [...(name ? [{ Name: name }] : []), ...(sku ? [{ SKU: sku.toUpperCase() }] : [])];
  if (!or.length) return;
  const dup = await Product.findOne({ $or: or, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, "_id").lean();
  if (dup) throw new AppError("ERR-PRD-409-01");
}

adminRouter.post(
  "/products",
  asyncHandler(async (req, res) => {
    const b = ProductBody.parse(req.body);
    await ensureUnique(b.name, b.sku);
    const p = await Product.create({ ...toProductDoc(b), CreatedAt: new Date(), UpdatedAt: new Date() });
    created(res, toProductDto(p));
  })
);

adminRouter.patch(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = ProductBody.partial().parse(req.body);
    await ensureUnique(b.name, b.sku, id);
    const p = await Product.findByIdAndUpdate(id, { $set: { ...toProductDoc(b), UpdatedAt: new Date() } }, { new: true, runValidators: true });
    if (!p) throw new AppError("ERR-CAT-404-01");
    ok(res, toProductDto(p));
  })
);

// Ngừng bán = xóa mềm (BR-ADM-001)
adminRouter.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const p = await Product.findByIdAndUpdate(id, { $set: { IsActive: false, UpdatedAt: new Date() } }, { new: true });
    if (!p) throw new AppError("ERR-CAT-404-01");
    ok(res, toProductDto(p));
  })
);

// ------------------------------------------------------------- UC-ORD-004
adminRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    await expireStaleQrOrders();
    const q = z.object({ status: z.enum(ORDER_STATUSES).optional(), q: z.string().trim().max(100).optional() }).parse({ ...req.query, status: req.query.status || undefined });
    const { page, limit, skip } = paging(req.query as Record<string, unknown>, 20, 100);
    const filter: Record<string, unknown> = {};
    if (q.status) filter.Status = q.status;
    if (q.q) {
      const re = new RegExp(escapeRe(q.q), "i");
      const users = await User.find({ $or: [{ FullName: re }, { Email: re }] }, "_id").lean();
      filter.$or = [{ OrderCode: re }, { RecipientName: re }, { Phone: re }, { UserID: { $in: users.map((u) => u._id) } }];
    }
    const [list, total, counts] = await Promise.all([
      Order.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).populate("UserID", "FullName Email").lean(),
      Order.countDocuments(filter),
      Order.aggregate([{ $group: { _id: "$Status", n: { $sum: 1 } } }]),
    ]);
    ok(res, list.map((o) => toOrderDto(o)), { page, limit, total, counts: Object.fromEntries((counts as Array<{ _id: string; n: number }>).map((c) => [c._id, c.n])) });
  })
);

adminRouter.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const o = await Order.findById(id).populate("UserID", "FullName Email").lean();
    if (!o) throw new AppError("ERR-ORD-404-01");
    const [items, ret] = await Promise.all([OrderItem.find({ OrderID: o._id }).populate("ProductID").lean(), ReturnRequest.findOne({ OrderID: o._id }).lean()]);
    ok(res, { ...toOrderDto(o, items), returnRequest: ret ? toReturnDto(ret) : null });
  })
);

adminRouter.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = z.object({ status: z.enum(ORDER_STATUSES), trackingCode: z.string().trim().max(100).optional(), note: z.string().trim().max(255).optional() }).parse(req.body);
    const o = await adminTransition(id, b.status, b);
    const items = await OrderItem.find({ OrderID: id }).populate("ProductID").lean();
    ok(res, toOrderDto(o, items));
  })
);

// ------------------------------------------------------------- UC-RET-002
adminRouter.get(
  "/returns",
  asyncHandler(async (req, res) => {
    const status = z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED"]).optional().parse(req.query.status || undefined);
    const list = await ReturnRequest.find(status ? { Status: status } : {}).sort({ CreatedAt: -1 })
      .populate("OrderID", "OrderCode").populate("UserID", "FullName Email").lean();
    ok(res, list.map(toReturnDto));
  })
);

adminRouter.patch(
  "/returns/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = z.object({ status: z.enum(["APPROVED", "REJECTED", "COMPLETED"]), adminResponse: z.string().trim().max(255).optional() }).parse(req.body);
    const r = await ReturnRequest.findById(id);
    if (!r) throw new AppError("ERR-SYS-404-01");
    if (!RETURN_TRANSITIONS[r.Status as ReturnStatus].includes(b.status)) throw new AppError("ERR-RET-409-04");
    if (b.status === "REJECTED" && !b.adminResponse) throw new AppError("ERR-VAL-422-01", "Vui lòng nhập phản hồi khi từ chối.");
    r.Status = b.status;
    if (b.adminResponse) r.AdminResponse = b.adminResponse;
    if (b.status !== "APPROVED") r.ResolvedAt = new Date();
    await r.save();
    if (b.status === "COMPLETED") {
      if (r.IsIntactSeal) for (const i of r.Items) await Product.updateOne({ _id: i.ProductID }, { $inc: { StockQuantity: i.Quantity } });
      if (r.RequestType === "REFUND") await Order.updateOne({ _id: r.OrderID }, { $set: { PaymentStatus: "REFUNDED" } });
    }
    const note = { APPROVED: "đã được duyệt", REJECTED: "đã bị từ chối", COMPLETED: "đã hoàn tất" }[b.status];
    await Message.create({ From: req.user!.sub, To: r.UserID, OrderID: r.OrderID, Content: `Yêu cầu đổi trả của bạn ${note}.${b.adminResponse ? " Phản hồi: " + b.adminResponse : ""}` });
    ok(res, toReturnDto(await ReturnRequest.findById(id).populate("OrderID", "OrderCode").populate("UserID", "FullName Email").lean()));
  })
);

// ------------------------------------------------------------- UC-USR-001
adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = z.object({ q: z.string().trim().max(100).optional(), status: z.enum(["Active", "Blocked"]).optional() }).parse(req.query);
    const filter: Record<string, unknown> = { Role: "customer" };
    if (q.q) filter.$or = [{ FullName: new RegExp(escapeRe(q.q), "i") }, { Email: new RegExp(escapeRe(q.q), "i") }];
    if (q.status) filter.Status = q.status;
    const users = await User.find(filter).sort({ CreatedAt: -1 }).lean();
    const stats = await Order.aggregate([
      { $match: { UserID: { $in: users.map((u) => u._id) } } },
      { $group: { _id: "$UserID", orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ["$Status", "DELIVERED"] }, "$TotalAmount", 0] } } } },
    ]);
    const byId = new Map(stats.map((s: { _id: unknown; orders: number; spent: number }) => [String(s._id), s]));
    ok(res, users.map((u) => ({ ...toUserDto(u), orderCount: byId.get(String(u._id))?.orders ?? 0, totalSpent: byId.get(String(u._id))?.spent ?? 0 })));
  })
);

adminRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const u = await User.findById(id).lean();
    if (!u) throw new AppError("ERR-USR-404-01");
    const [profile, orders] = await Promise.all([ScentProfile.findOne({ UserID: id }).lean(), Order.find({ UserID: id }).sort({ CreatedAt: -1 }).limit(20).lean()]);
    ok(res, { ...toUserDto(u), scentProfile: profile ? toProfileDto(profile) : null, orders: orders.map((o) => toOrderDto(o)) });
  })
);

adminRouter.patch(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = z.object({ status: z.enum(["Active", "Blocked"]), reason: z.string().trim().max(255).optional() }).parse(req.body);
    const u = await User.findById(id);
    if (!u) throw new AppError("ERR-USR-404-01");
    if (u.Role === "admin" || String(u._id) === req.user!.sub) throw new AppError("ERR-USR-409-01");
    if (b.status === "Blocked" && !b.reason) throw new AppError("ERR-USR-422-01");
    u.Status = b.status;
    u.BlockReason = b.status === "Blocked" ? b.reason! : null;
    u.TokenVersion = (u.TokenVersion ?? 0) + 1; // BR-SEC-003: thu hồi phiên
    await u.save();
    ok(res, toUserDto(u));
  })
);

// ------------------------------------------------------------- UC-DASH-002
adminRouter.get(
  "/recommendation-metrics",
  asyncHandler(async (_req, res) => {
    const [products, families, reviews, profiles] = await Promise.all([
      Product.find({ IsActive: true }).lean(),
      ScentFamily.find({ IsActive: true }).lean(),
      Review.find({}).lean(),
      ScentProfile.find({ IsCompleted: true }).lean(),
    ]);
    const offline = offlineMetrics(products, families.map((f) => ({ Name: f.Name, CorrelatedFamilies: f.CorrelatedFamilies })));
    const corr = buildCorrelatedMap(families.map((f) => ({ Name: f.Name, CorrelatedFamilies: f.CorrelatedFamilies })));
    const byUser = new Map(profiles.map((p) => [String(p.UserID), p]));
    const byProduct = new Map(products.map((p) => [String(p._id), p]));
    const pairs: Array<[number, number]> = [];
    for (const r of reviews) {
      const prof = byUser.get(String(r.UserID));
      const prod = byProduct.get(String(r.ProductID));
      if (!prof || !prod) continue;
      const score = calculateScentMatch({ ...prof, FamilyRatings: effectiveRatings(prof.FamilyRatings, prof.BehaviorAdjustments) }, prod, null, corr).matchScore;
      pairs.push([score, r.OverallRating]);
    }
    const msr = reviews.filter((r) => r.MatchScoreRating != null).map((r) => r.MatchScoreRating as number);
    const enough = reviews.length >= 5;
    ok(res, {
      offline,
      online: {
        sampleSize: reviews.length,
        enoughSamples: enough,
        avgMatchScoreRating: enough && msr.length ? Math.round((msr.reduce((a, b) => a + b, 0) / msr.length) * 100) / 100 : null,
        spearmanScoreVsRating: enough ? spearman(pairs.map((p) => p[0]), pairs.map((p) => p[1])) : null,
        completedProfiles: profiles.length,
      },
    });
  })
);

export { Types };
