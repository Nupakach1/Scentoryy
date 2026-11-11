/**
 * Sau bán hàng — UC-RET-001 (đổi trả, BR-RET-001/002), UC-REV-001 (đánh giá, BR-REV-001/002),
 * tệp minh chứng GridFS (POST/GET /api/v1/uploads).
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { ACTUAL_PROJECTIONS, RETURN_REASONS, RETURN_TYPES, RETURN_WINDOW_MS, REVIEW_TEXT_MAX } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { requireAuth } from "../trung-gian/auth";
import { evidenceUpload, uploadErrors } from "../trung-gian/upload";
import { Order } from "../mo-hinh/Order";
import { OrderItem } from "../mo-hinh/OrderItem";
import { Product } from "../mo-hinh/Product";
import { ReturnRequest } from "../mo-hinh/ReturnRequest";
import { Review } from "../mo-hinh/Review";
import { findFile, openFile, saveFile } from "../dich-vu/storage";
import { trackInteraction } from "../dich-vu/behavior";
import { toReturnDto, toReviewDto } from "../dich-vu/dto";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";
import { emitAdminBadges } from "../thoi-gian-thuc/socket";

export const returnsRouter = Router();
export const reviewsRouter = Router();
export const uploadsRouter = Router();

const oid = z.string().regex(/^[0-9a-f]{24}$/i, "Mã không hợp lệ");

// POST /api/v1/uploads — tải 1 tệp (≤10 MB, JPG/PNG/MP4)
uploadsRouter.post(
  "/",
  requireAuth,
  (req, res, next) => evidenceUpload(req, res, (err?: unknown) => (err ? next(uploadErrors(err)) : next())),
  asyncHandler(async (req, res) => {
    const f = req.file;
    if (!f || f.size === 0) throw new AppError("ERR-RET-422-01");
    const id = await saveFile(f.buffer, f.originalname, f.mimetype, req.user!.sub);
    created(res, { id, url: `/api/v1/uploads/${id}`, contentType: f.mimetype, size: f.size });
  })
);

// GET /api/v1/uploads/:id — chủ sở hữu hoặc admin
uploadsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await findFile(String(req.params.id));
    if (!file) throw new AppError("ERR-SYS-404-01");
    const meta = (file.metadata ?? {}) as { contentType?: string; ownerId?: string };
    if (req.user!.role !== "admin" && meta.ownerId !== req.user!.sub) throw new AppError("ERR-AUTH-403-01");
    res.setHeader("Content-Type", meta.contentType ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=3600");
    openFile(String(file._id)).pipe(res);
  })
);

const ReturnBody = z.object({
  orderId: oid,
  requestType: z.enum(RETURN_TYPES),
  items: z.array(z.object({ productId: oid, quantity: z.number().int().min(1) })).min(1),
  reason: z.enum(RETURN_REASONS),
  description: z.string().trim().max(1000).optional(),
  isIntactSeal: z.boolean(),
  evidenceUrl: z.string().regex(/^\/api\/v1\/uploads\/[0-9a-f]{24}$/i, "Thiếu tệp minh chứng"),
});

// POST /api/v1/returns — FR-RET-REQ-001
returnsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = ReturnBody.safeParse(req.body);
    if (!parsed.success) {
      const evidenceIssue = parsed.error.issues.some((i) => i.path[0] === "evidenceUrl");
      throw new AppError(evidenceIssue ? "ERR-RET-422-01" : "ERR-VAL-422-01", undefined,
        parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
    }
    const b = parsed.data;
    const order = await Order.findOne({ _id: b.orderId, UserID: req.user!.sub }).lean();
    if (!order) throw new AppError("ERR-ORD-404-01");
    if (order.Status !== "DELIVERED" || !order.DeliveredAt) throw new AppError("ERR-RET-409-03");
    if (Date.now() - new Date(order.DeliveredAt).getTime() > RETURN_WINDOW_MS) throw new AppError("ERR-RET-409-01");
    if (await ReturnRequest.exists({ OrderID: order._id })) throw new AppError("ERR-RET-409-02");
    const file = await findFile(b.evidenceUrl.split("/").pop()!);
    if (!file || (file.metadata as { ownerId?: string })?.ownerId !== req.user!.sub) throw new AppError("ERR-RET-422-01");
    const bought = new Map((await OrderItem.find({ OrderID: order._id }).lean()).map((i) => [String(i.ProductID), i]));
    let refund = 0;
    for (const it of b.items) {
      const line = bought.get(it.productId);
      if (!line || it.quantity > line.Quantity) throw new AppError("ERR-VAL-422-01", "Số lượng đổi trả vượt số lượng đã mua.");
      refund += line.FixedUnitPrice * it.quantity;
    }
    const r = await ReturnRequest.create({
      OrderID: order._id, UserID: req.user!.sub, RequestType: b.requestType,
      Items: b.items.map((i) => ({ ProductID: i.productId, Quantity: i.quantity })),
      Reason: b.reason, Description: b.description ?? null, EvidenceUrl: b.evidenceUrl, IsIntactSeal: b.isIntactSeal,
      RefundAmount: b.requestType === "REFUND" ? refund : 0,
    });
    emitAdminBadges();
    created(res, toReturnDto(r));
  })
);

// GET /api/v1/returns?orderId= — FR-RET-REQ-002
returnsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { UserID: req.user!.sub };
    if (req.query.orderId) filter.OrderID = oid.parse(req.query.orderId);
    const list = await ReturnRequest.find(filter).sort({ CreatedAt: -1 }).populate("OrderID", "OrderCode").lean();
    ok(res, list.map(toReturnDto));
  })
);

// GET /api/v1/reviews?productId= — FR-CAT-DTL-003
reviewsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const productId = oid.parse(req.query.productId);
    const list = await Review.find({ ProductID: productId }).sort({ CreatedAt: -1 }).limit(50).populate("UserID", "FullName").lean();
    const avg = list.length ? Math.round((list.reduce((s, r) => s + r.OverallRating, 0) / list.length) * 10) / 10 : 0;
    ok(res, list.map(toReviewDto), { total: list.length, avgRating: avg });
  })
);

// POST /api/v1/reviews — FR-REV-CRT-001
reviewsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const b = z
      .object({
        orderId: oid,
        productId: oid,
        overallRating: z.number().int().min(1).max(5),
        reviewText: z.string().trim().max(REVIEW_TEXT_MAX).optional(),
        actualProjection: z.enum(ACTUAL_PROJECTIONS).default("MATCH"),
        matchScoreRating: z.number().int().min(1).max(5).optional(),
        imageUrl: z.string().max(255).optional(),
      })
      .parse(req.body);
    const order = await Order.findOne({ _id: b.orderId, UserID: req.user!.sub, Status: "DELIVERED" }).lean();
    if (!order || !(await OrderItem.exists({ OrderID: b.orderId, ProductID: b.productId }))) throw new AppError("ERR-REV-403-01");
    let review;
    try {
      review = await Review.create({
        UserID: req.user!.sub, ProductID: b.productId, OrderID: b.orderId, OverallRating: b.overallRating,
        ReviewText: b.reviewText || null, ActualProjection: b.actualProjection, MatchScoreRating: b.matchScoreRating ?? null, ImageUrl: b.imageUrl ?? null,
      });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new AppError("ERR-REV-409-01");
      throw e;
    }
    // BR-REV-002
    const agg = await Review.aggregate([{ $match: { ProductID: new Types.ObjectId(b.productId) } }, { $group: { _id: null, avg: { $avg: "$OverallRating" }, n: { $sum: 1 } } }]);
    await Product.updateOne({ _id: b.productId }, { $set: { AvgRating: Math.round((agg[0]?.avg ?? 0) * 10) / 10, ReviewCount: agg[0]?.n ?? 0 } });
    await trackInteraction(req.user!.sub, b.productId, "reviewed");
    created(res, toReviewDto(review));
  })
);
