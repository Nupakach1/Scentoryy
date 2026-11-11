/**
 * Nghiệp vụ đơn hàng — UC-ORD-001..004.
 * Trừ/hoàn kho (BR-INV-001), FSM đơn & thanh toán (BR-ORD-002..004, BR-PAY-001..003).
 */
import { Types } from "mongoose";
import {
  ADMIN_ORDER_TRANSITIONS,
  QR_PAYMENT_WINDOW_MS,
  type DeliveryMethod,
  type OrderStatus,
  type PaymentMethod,
} from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { Order, type OrderDoc } from "../mo-hinh/Order";
import { OrderItem } from "../mo-hinh/OrderItem";
import { Product } from "../mo-hinh/Product";
import { Voucher } from "../mo-hinh/Voucher";
import { generateOrderCode, orderTotals, validateCard, voucherDiscount, type CardInput } from "./payment";

export interface OrderLine { productId: string; quantity: number }

export interface CreateOrderInput {
  userId: string;
  lines: OrderLine[];
  recipient: { fullName: string; phone: string; addressLine: string; ward: string; district: string; city: string; note?: string };
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
  card?: CardInput;
}

/** Trừ kho có điều kiện cho từng dòng; lỗi → hoàn các dòng đã trừ (BR-INV-001, NFR-REL-001). */
async function deductStock(lines: Array<{ id: Types.ObjectId; qty: number }>): Promise<void> {
  const done: Array<{ id: Types.ObjectId; qty: number }> = [];
  for (const l of lines) {
    const r = await Product.updateOne(
      { _id: l.id, IsActive: true, StockQuantity: { $gte: l.qty } },
      { $inc: { StockQuantity: -l.qty } }
    );
    if (r.modifiedCount !== 1) {
      for (const d of done) await Product.updateOne({ _id: d.id }, { $inc: { StockQuantity: d.qty } });
      throw new AppError("ERR-ORD-409-01");
    }
    done.push(l);
  }
}

export async function restoreStock(orderId: Types.ObjectId): Promise<void> {
  const items = await OrderItem.find({ OrderID: orderId }).lean();
  for (const i of items) await Product.updateOne({ _id: i.ProductID }, { $inc: { StockQuantity: i.Quantity } });
}

export async function createOrder(input: CreateOrderInput) {
  if (input.lines.length === 0) throw new AppError("ERR-ORD-400-01");
  const ids = input.lines.map((l) => new Types.ObjectId(l.productId));
  const products = await Product.find({ _id: { $in: ids }, IsActive: true }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const resolved = input.lines.map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw new AppError("ERR-CAT-404-01");
    if (p.StockQuantity < l.quantity) throw new AppError("ERR-ORD-409-01", `Sản phẩm ${p.Name} không đủ tồn kho.`);
    return { product: p, qty: l.quantity };
  });
  const subtotal = resolved.reduce((s, r) => s + r.product.Price * r.qty, 0);

  // BR-PROMO-001
  let discount = 0;
  let voucherCode: string | null = null;
  if (input.voucherCode) {
    const v = await Voucher.findOne({ Code: input.voucherCode.trim().toUpperCase() }).lean();
    const fee = orderTotals(subtotal, input.deliveryMethod, 0).shippingFee;
    const amount = voucherDiscount(v, subtotal, fee);
    if (amount == null) throw new AppError("ERR-PRM-422-01");
    discount = amount;
    voucherCode = v!.Code;
  }
  const totals = orderTotals(subtotal, input.deliveryMethod, discount);

  // BR-PAY-003 — kiểm tra thẻ TRƯỚC khi trừ kho
  let cardLast4: string | null = null;
  if (input.paymentMethod === "CARD") {
    cardLast4 = validateCard(input.card as CardInput);
    if (!cardLast4) throw new AppError("ERR-PAY-422-01");
  }

  await deductStock(resolved.map((r) => ({ id: r.product._id, qty: r.qty })));

  const now = new Date();
  const r = input.recipient;
  let order;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      order = await Order.create({
        OrderCode: generateOrderCode(now),
        UserID: input.userId,
        RecipientName: r.fullName,
        Phone: r.phone,
        ShippingAddress: [r.addressLine, r.ward, r.district, r.city].filter(Boolean).join(", "),
        DeliveryMethod: input.deliveryMethod,
        Subtotal: totals.subtotal,
        ShippingFee: totals.shippingFee,
        DiscountAmount: totals.discountAmount,
        TotalAmount: totals.totalAmount,
        VoucherCode: voucherCode,
        PaymentMethod: input.paymentMethod,
        PaymentStatus: input.paymentMethod === "CARD" ? "PAID" : "PENDING",
        PaymentExpiresAt: input.paymentMethod === "QR" ? new Date(now.getTime() + QR_PAYMENT_WINDOW_MS) : null,
        PaidAt: input.paymentMethod === "CARD" ? now : null,
        CardLast4: cardLast4,
        Status: "PROCESSING",
        OrderNote: r.note || null,
        StockDeducted: true,
        Timeline: [{ Status: "PROCESSING", At: now, By: "customer", Note: "Đặt hàng thành công" }],
      });
      break;
    } catch (e) {
      if ((e as { code?: number }).code !== 11000 || attempt === 4) {
        for (const x of resolved) await Product.updateOne({ _id: x.product._id }, { $inc: { StockQuantity: x.qty } });
        throw e;
      }
    }
  }
  await OrderItem.insertMany(
    resolved.map((x) => ({ OrderID: order!._id, ProductID: x.product._id, ProductName: x.product.Name, Quantity: x.qty, FixedUnitPrice: x.product.Price }))
  );
  if (voucherCode) await Voucher.updateOne({ Code: voucherCode }, { $inc: { UsedCount: 1 } });
  return order!;
}

/** BR-PAY-002 — hủy đơn QR quá hạn (gọi lười khi đọc đơn, phù hợp môi trường serverless). */
export async function expireStaleQrOrders(filter: Record<string, unknown> = {}): Promise<number> {
  const stale = await Order.find({
    ...filter,
    PaymentMethod: "QR",
    PaymentStatus: "PENDING",
    Status: "PROCESSING",
    PaymentExpiresAt: { $lt: new Date() },
  });
  for (const o of stale) {
    await cancelOrder(o, "system", "Quá hạn thanh toán QR 15 phút");
    o.PaymentStatus = "FAILED";
    await o.save();
  }
  return stale.length;
}

type OrderHydrated = Awaited<ReturnType<typeof Order.findOne>> & OrderDoc;

/** Hủy đơn + hoàn kho đúng một lần + cập nhật thanh toán (BR-INV-001, BR-ORD-004). */
export async function cancelOrder(order: NonNullable<OrderHydrated>, by: "customer" | "admin" | "system", reason: string) {
  const res = await Order.updateOne(
    { _id: order._id, Status: { $in: ["PROCESSING", "SHIPPING"] } },
    {
      $set: {
        Status: "CANCELLED",
        CancelReason: reason,
        CancelledBy: by,
        PaymentStatus: order.PaymentStatus === "PAID" ? "REFUNDED" : "FAILED",
        StockDeducted: false,
      },
      $push: { Timeline: { Status: "CANCELLED", At: new Date(), By: by, Note: reason } },
    }
  );
  if (res.modifiedCount !== 1) throw new AppError("ERR-ORD-409-02");
  if (order.StockDeducted) await restoreStock(order._id);
  const fresh = await Order.findById(order._id);
  Object.assign(order, fresh?.toObject() ?? {});
  return fresh;
}

/** Admin chuyển trạng thái theo ma trận FSM (BR-ORD-003). */
export async function adminTransition(orderId: string, next: OrderStatus, opts: { trackingCode?: string; note?: string }) {
  if (!Types.ObjectId.isValid(orderId)) throw new AppError("ERR-ORD-404-01");
  await expireStaleQrOrders({ _id: new Types.ObjectId(orderId) });
  const order = await Order.findById(orderId);
  if (!order) throw new AppError("ERR-ORD-404-01");
  const current = order.Status as OrderStatus;
  if (!ADMIN_ORDER_TRANSITIONS[current].includes(next)) throw new AppError("ERR-ORD-409-03");
  if (next === "CANCELLED") {
    return cancelOrder(order, "admin", opts.note?.trim() || "Admin hủy đơn");
  }
  const update: Record<string, unknown> = { Status: next };
  if (next === "SHIPPING") {
    if (!opts.trackingCode?.trim()) throw new AppError("ERR-ORD-422-01");
    if (order.PaymentMethod !== "COD" && order.PaymentStatus !== "PAID") throw new AppError("ERR-PAY-409-02");
    update.TrackingCode = opts.trackingCode.trim();
  }
  if (next === "DELIVERED") {
    update.DeliveredAt = new Date();
    if (order.PaymentMethod === "COD" && order.PaymentStatus === "PENDING") {
      update.PaymentStatus = "PAID";
      update.PaidAt = new Date();
    }
  }
  const res = await Order.updateOne(
    { _id: order._id, Status: current },
    { $set: update, $push: { Timeline: { Status: next, At: new Date(), By: "admin", Note: opts.note || (next === "SHIPPING" ? `Mã vận đơn ${opts.trackingCode}` : null) } } }
  );
  if (res.modifiedCount !== 1) throw new AppError("ERR-ORD-409-03");
  if (next === "DELIVERED") {
    const items = await OrderItem.find({ OrderID: order._id }).lean();
    for (const i of items) await Product.updateOne({ _id: i.ProductID }, { $inc: { SoldCount: i.Quantity } });
  }
  return Order.findById(order._id);
}
