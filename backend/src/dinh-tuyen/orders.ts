/**
 * Đơn hàng phía khách — UC-ORD-001 (đặt hàng & thanh toán), UC-ORD-002 (theo dõi), UC-ORD-003 (hủy).
 * Voucher — FR-ORD-CHKT-003 (BR-PROMO-001).
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { CANCELLATION_REASONS, DELIVERY_METHODS, ORDER_STATUSES, PAYMENT_METHODS } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { requireAuth } from "../trung-gian/auth";
import { Cart } from "../mo-hinh/Cart";
import { CartItem } from "../mo-hinh/CartItem";
import { Order } from "../mo-hinh/Order";
import { OrderItem } from "../mo-hinh/OrderItem";
import { ReturnRequest } from "../mo-hinh/ReturnRequest";
import { Review } from "../mo-hinh/Review";
import { Voucher } from "../mo-hinh/Voucher";
import { cancelOrder, createOrder, expireStaleQrOrders } from "../dich-vu/orderService";
import { orderTotals, voucherDiscount } from "../dich-vu/payment";
import { refreshProfileFromBehavior } from "../dich-vu/behavior";
import { toOrderDto, toReturnDto, toReviewDto } from "../dich-vu/dto";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created, paging } from "../tien-ich/phanHoi";
import { PHONE_RE } from "../tien-ich/password";
import { emitAdminBadges } from "../thoi-gian-thuc/socket";

export const ordersRouter = Router();
export const vouchersRouter = Router();
ordersRouter.use(requireAuth);

const oid = z.string().regex(/^[0-9a-f]{24}$/i, "Mã không hợp lệ");

const CreateBody = z
  .object({
    itemIds: z.array(oid).min(1).optional(),
    buyNow: z.object({ productId: oid, quantity: z.number().int().min(1).max(10) }).optional(),
    recipient: z.object({
      fullName: z.string().trim().min(2).max(100),
      phone: z.string().trim().regex(PHONE_RE, "Số điện thoại 9–15 chữ số"),
      addressLine: z.string().trim().min(3).max(150),
      ward: z.string().trim().min(1).max(60),
      district: z.string().trim().min(1).max(60),
      city: z.string().trim().min(1).max(60),
      note: z.string().trim().max(255).optional(),
    }),
    deliveryMethod: z.enum(Object.keys(DELIVERY_METHODS) as ["STANDARD", "EXPRESS"]),
    paymentMethod: z.enum(PAYMENT_METHODS),
    voucherCode: z.string().trim().max(50).optional().nullable(),
    card: z.object({ number: z.string(), holder: z.string(), expiry: z.string(), cvv: z.string() }).optional(),
  })
  .refine((b) => b.itemIds || b.buyNow, { message: "Chọn sản phẩm để đặt hàng", path: ["itemIds"] });

// POST /api/v1/orders — FR-ORD-CHKT-001..005
ordersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const b = CreateBody.parse(req.body);
    const userId = req.user!.sub;
    let lines: Array<{ productId: string; quantity: number }>;
    let cartLineIds: string[] = [];
    if (b.buyNow) {
      lines = [{ productId: b.buyNow.productId, quantity: b.buyNow.quantity }];
    } else {
      const cart = await Cart.findOne({ UserID: userId });
      if (!cart) throw new AppError("ERR-ORD-400-01");
      const rows = await CartItem.find({ CartID: cart._id, _id: { $in: b.itemIds } }).lean();
      if (rows.length === 0) throw new AppError("ERR-ORD-400-01");
      lines = rows.map((r) => ({ productId: String(r.ProductID), quantity: r.Quantity }));
      cartLineIds = rows.map((r) => String(r._id));
    }
    const order = await createOrder({
      userId, lines, recipient: b.recipient, deliveryMethod: b.deliveryMethod, paymentMethod: b.paymentMethod,
      voucherCode: b.voucherCode, card: b.card,
    });
    if (cartLineIds.length) await CartItem.deleteMany({ _id: { $in: cartLineIds } }); // chỉ xóa dòng đã đặt
    void refreshProfileFromBehavior(userId).catch(() => undefined);
    const items = await OrderItem.find({ OrderID: order._id }).populate("ProductID").lean();
    emitAdminBadges();
    created(res, toOrderDto(order, items));
  })
);

// GET /api/v1/orders — FR-ORD-HIS-001
ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = new Types.ObjectId(req.user!.sub);
    await expireStaleQrOrders({ UserID: userId });
    const status = z.enum(ORDER_STATUSES).optional().parse(req.query.status || undefined);
    const { page, limit, skip } = paging(req.query as Record<string, unknown>, 10, 50);
    const filter: Record<string, unknown> = { UserID: userId, ...(status ? { Status: status } : {}) };
    const [orders, total, counts] = await Promise.all([
      Order.find(filter).sort({ CreatedAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
      Order.aggregate([{ $match: { UserID: userId } }, { $group: { _id: "$Status", n: { $sum: 1 } } }]),
    ]);
    const items = await OrderItem.find({ OrderID: { $in: orders.map((o) => o._id) } }).populate("ProductID").lean();
    const byOrder = new Map<string, unknown[]>();
    for (const i of items) byOrder.set(String(i.OrderID), [...(byOrder.get(String(i.OrderID)) ?? []), i]);
    const c: Record<string, number> = { ALL: 0, PROCESSING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const x of counts as Array<{ _id: string; n: number }>) { c[x._id] = x.n; c.ALL += x.n; }
    ok(res, orders.map((o) => toOrderDto(o, byOrder.get(String(o._id)) ?? [])), { page, limit, total, counts: c });
  })
);

// GET /api/v1/orders/:id — FR-ORD-HIS-002
ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    await expireStaleQrOrders({ _id: new Types.ObjectId(id) });
    const order = await Order.findOne({ _id: id, UserID: req.user!.sub }).lean();
    if (!order) throw new AppError("ERR-ORD-404-01");
    const [items, ret, reviews] = await Promise.all([
      OrderItem.find({ OrderID: order._id }).populate("ProductID").lean(),
      ReturnRequest.findOne({ OrderID: order._id }).lean(),
      Review.find({ OrderID: order._id }).lean(),
    ]);
    ok(res, { ...toOrderDto(order, items), returnRequest: ret ? toReturnDto(ret) : null, reviews: reviews.map(toReviewDto) });
  })
);

// POST /api/v1/orders/:id/cancellation — FR-ORD-CNL-001
ordersRouter.post(
  "/:id/cancellation",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = z.object({ reason: z.enum(CANCELLATION_REASONS), note: z.string().trim().max(200).optional() }).parse(req.body);
    const order = await Order.findOne({ _id: id, UserID: req.user!.sub });
    if (!order) throw new AppError("ERR-ORD-404-01");
    if (order.Status !== "PROCESSING") throw new AppError("ERR-ORD-409-02");
    const fresh = await cancelOrder(order, "customer", b.note ? `${b.reason} — ${b.note}` : b.reason);
    emitAdminBadges();
    ok(res, toOrderDto(fresh));
  })
);

// POST /api/v1/orders/:id/payments/qr/confirm — FR-ORD-CHKT-004 (BR-PAY-002)
ordersRouter.post(
  "/:id/payments/qr/confirm",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    await expireStaleQrOrders({ _id: new Types.ObjectId(id) });
    const order = await Order.findOne({ _id: id, UserID: req.user!.sub });
    if (!order) throw new AppError("ERR-ORD-404-01");
    if (order.PaymentMethod !== "QR" || order.PaymentStatus !== "PENDING" || order.Status !== "PROCESSING") throw new AppError("ERR-PAY-409-01");
    order.PaymentStatus = "PAID";
    order.PaidAt = new Date();
    order.Timeline.push({ Status: "PROCESSING", At: new Date(), By: "customer", Note: "Đã xác nhận chuyển khoản QR" });
    await order.save();
    ok(res, toOrderDto(order));
  })
);

// GET /api/v1/vouchers — danh sách đang hiệu lực
vouchersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const list = await Voucher.find({ IsActive: true, StartAt: { $lte: now }, EndAt: { $gte: now } }).sort({ MinOrderAmount: 1 }).lean();
    ok(res, list.map((v) => ({
      code: v.Code, title: v.Title, description: v.Description, type: v.DiscountType, value: v.DiscountValue,
      minOrderAmount: v.MinOrderAmount, maxDiscountAmount: v.MaxDiscountAmount ?? null, endAt: v.EndAt,
    })));
  })
);

// POST /api/v1/vouchers/validate — FR-ORD-CHKT-003
vouchersRouter.post(
  "/validate",
  asyncHandler(async (req, res) => {
    const b = z.object({ code: z.string().trim().min(1).max(50), subtotal: z.number().min(0), deliveryMethod: z.enum(["STANDARD", "EXPRESS"]) }).parse(req.body);
    const v = await Voucher.findOne({ Code: b.code.toUpperCase() }).lean();
    const fee = orderTotals(b.subtotal, b.deliveryMethod, 0).shippingFee;
    const discount = voucherDiscount(v, b.subtotal, fee);
    if (discount == null) throw new AppError("ERR-PRM-422-01");
    ok(res, { code: v!.Code, title: v!.Title, discount, ...orderTotals(b.subtotal, b.deliveryMethod, discount) });
  })
);
