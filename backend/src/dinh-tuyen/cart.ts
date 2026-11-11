/**
 * Giỏ hàng — UC-CART-001 (FR-CART-ITM-001/002, FR-CART-SUM-001, FR-CART-SYN-001), BR-CART-001.
 */
import { Router } from "express";
import { z } from "zod";
import { MAX_QTY_PER_LINE } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { requireAuth } from "../trung-gian/auth";
import { Cart } from "../mo-hinh/Cart";
import { CartItem } from "../mo-hinh/CartItem";
import { Product } from "../mo-hinh/Product";
import { toProductDto } from "../dich-vu/dto";
import { trackInteraction } from "../dich-vu/behavior";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";

export const cartRouter = Router();
cartRouter.use(requireAuth);

const oid = z.string().regex(/^[0-9a-f]{24}$/i, "Mã không hợp lệ");

async function cartOf(userId: string) {
  return (await Cart.findOne({ UserID: userId })) ?? (await Cart.create({ UserID: userId }));
}

/** Tóm tắt giỏ: dòng sản phẩm (đã lọc sản phẩm ngừng bán), số tác phẩm, tạm tính. */
export async function cartSummary(userId: string) {
  const cart = await cartOf(userId);
  const rows = await CartItem.find({ CartID: cart._id }).sort({ AddedAt: -1 }).populate("ProductID").lean();
  const items = rows
    .filter((r) => r.ProductID && (r.ProductID as unknown as { IsActive: boolean }).IsActive)
    .map((r) => {
      const p = toProductDto(r.ProductID);
      return { id: String(r._id), product: p, quantity: r.Quantity, lineTotal: Number(p.price) * r.Quantity, maxQuantity: Math.min(MAX_QTY_PER_LINE, Number(p.stock)) };
    });
  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    subtotal: items.reduce((s, i) => s + i.lineTotal, 0),
  };
}

/** Cộng dồn có giới hạn min(tồn kho, 10) — BR-CART-001. */
async function addLine(userId: string, productId: string, qty: number, strict: boolean) {
  const product = await Product.findOne({ _id: productId, IsActive: true }).lean();
  if (!product) throw new AppError("ERR-CAT-404-01");
  const cart = await cartOf(userId);
  const line = await CartItem.findOne({ CartID: cart._id, ProductID: productId });
  const want = (line?.Quantity ?? 0) + qty;
  const cap = Math.min(MAX_QTY_PER_LINE, product.StockQuantity);
  if (want > cap && strict) throw new AppError("ERR-CART-409-01", `Chỉ có thể đặt tối đa ${cap} sản phẩm ${product.Name}.`);
  const final = Math.min(want, cap);
  if (final < 1) return;
  if (line) {
    line.Quantity = final;
    await line.save();
  } else {
    await CartItem.create({ CartID: cart._id, ProductID: productId, Quantity: final });
  }
  await Cart.updateOne({ _id: cart._id }, { $set: { UpdatedAt: new Date() } });
}

// GET /api/v1/cart
cartRouter.get("/", asyncHandler(async (req, res) => ok(res, await cartSummary(req.user!.sub))));

// POST /api/v1/cart/items
cartRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const b = z.object({ productId: oid, quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE) }).parse(req.body);
    await addLine(req.user!.sub, b.productId, b.quantity, true);
    await trackInteraction(req.user!.sub, b.productId, "add_to_cart");
    created(res, await cartSummary(req.user!.sub));
  })
);

// PATCH /api/v1/cart/items/:itemId
cartRouter.patch(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = oid.parse(req.params.itemId);
    const b = z.object({ quantity: z.number().int().min(1) }).parse(req.body);
    const cart = await cartOf(req.user!.sub);
    const line = await CartItem.findOne({ _id: itemId, CartID: cart._id }).populate("ProductID");
    if (!line) throw new AppError("ERR-CART-404-01");
    const p = line.ProductID as unknown as { StockQuantity: number; Name: string };
    const cap = Math.min(MAX_QTY_PER_LINE, p.StockQuantity);
    if (b.quantity > cap) throw new AppError("ERR-CART-409-01", `Chỉ có thể đặt tối đa ${cap} sản phẩm ${p.Name}.`);
    line.Quantity = b.quantity;
    await line.save();
    ok(res, await cartSummary(req.user!.sub));
  })
);

// DELETE /api/v1/cart/items/:itemId
cartRouter.delete(
  "/items/:itemId",
  asyncHandler(async (req, res) => {
    const itemId = oid.parse(req.params.itemId);
    const cart = await cartOf(req.user!.sub);
    const r = await CartItem.deleteOne({ _id: itemId, CartID: cart._id });
    if (r.deletedCount === 0) throw new AppError("ERR-CART-404-01");
    ok(res, await cartSummary(req.user!.sub));
  })
);

// POST /api/v1/cart/merge — FR-CART-SYN-001 (không ném lỗi, tự cắt theo giới hạn)
cartRouter.post(
  "/merge",
  asyncHandler(async (req, res) => {
    const b = z.object({ items: z.array(z.object({ productId: oid, quantity: z.number().int().min(1).max(99) })).max(50) }).parse(req.body);
    for (const i of b.items) {
      try {
        await addLine(req.user!.sub, i.productId, i.quantity, false);
      } catch {
        /* sản phẩm ngừng bán: bỏ qua */
      }
    }
    ok(res, await cartSummary(req.user!.sub));
  })
);
