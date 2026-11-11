/**
 * Tiện ích tài khoản — UC-ACC-001 (wishlist, BR-ACC-004), UC-ACC-002 (sổ địa chỉ, BR-ACC-003).
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { MAX_ADDRESSES } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { requireAuth } from "../trung-gian/auth";
import { Address } from "../mo-hinh/Address";
import { Product } from "../mo-hinh/Product";
import { Wishlist } from "../mo-hinh/Wishlist";
import { toAddressDto, toProductDto } from "../dich-vu/dto";
import { trackInteraction } from "../dich-vu/behavior";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";
import { PHONE_RE } from "../tien-ich/password";

export const wishlistRouter = Router();
export const addressesRouter = Router();
wishlistRouter.use(requireAuth);
addressesRouter.use(requireAuth);

const oid = z.string().regex(/^[0-9a-f]{24}$/i, "Mã không hợp lệ");

// GET /api/v1/wishlist — FR-ACC-WSH-002
wishlistRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await Wishlist.find({ UserID: req.user!.sub }).sort({ CreatedAt: -1 }).populate("ProductID").lean();
    const items = rows
      .filter((r) => r.ProductID && (r.ProductID as unknown as { IsActive: boolean }).IsActive)
      .map((r) => ({ addedAt: r.CreatedAt, product: toProductDto(r.ProductID) }));
    ok(res, items, { total: items.length });
  })
);

// PUT /api/v1/wishlist/items/:productId — FR-ACC-WSH-001 (idempotent)
wishlistRouter.put(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const productId = oid.parse(req.params.productId);
    const p = await Product.findOne({ _id: productId, IsActive: true }, "_id").lean();
    if (!p) throw new AppError("ERR-CAT-404-01");
    const r = await Wishlist.updateOne({ UserID: req.user!.sub, ProductID: productId }, { $setOnInsert: { CreatedAt: new Date() } }, { upsert: true });
    if (r.upsertedCount) await trackInteraction(req.user!.sub, productId, "wishlist");
    ok(res, { productId, inWishlist: true });
  })
);

wishlistRouter.delete(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const productId = oid.parse(req.params.productId);
    await Wishlist.deleteOne({ UserID: req.user!.sub, ProductID: productId });
    ok(res, { productId, inWishlist: false });
  })
);

const AddressBody = z.object({
  label: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(PHONE_RE, "Số điện thoại 9–15 chữ số"),
  address: z.string().trim().min(3).max(255),
  ward: z.string().trim().min(1).max(100),
  district: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  isDefault: z.boolean().optional(),
});

const toDoc = (b: Partial<z.infer<typeof AddressBody>>) => ({
  ...(b.label !== undefined ? { Label: b.label } : {}),
  ...(b.fullName !== undefined ? { RecipientName: b.fullName } : {}),
  ...(b.phone !== undefined ? { Phone: b.phone } : {}),
  ...(b.address !== undefined ? { AddressLine: b.address } : {}),
  ...(b.ward !== undefined ? { Ward: b.ward } : {}),
  ...(b.district !== undefined ? { District: b.district } : {}),
  ...(b.city !== undefined ? { City: b.city } : {}),
});

async function listAddresses(userId: string) {
  return (await Address.find({ UserID: userId }).sort({ IsDefault: -1, CreatedAt: -1 }).lean()).map(toAddressDto);
}

async function setDefault(userId: string, id: Types.ObjectId | string) {
  await Address.updateMany({ UserID: userId, _id: { $ne: id } }, { $set: { IsDefault: false } });
  await Address.updateOne({ UserID: userId, _id: id }, { $set: { IsDefault: true } });
}

// GET /api/v1/addresses — FR-ACC-ADR-001
addressesRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await listAddresses(req.user!.sub)))
);

addressesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const b = AddressBody.parse(req.body);
    const count = await Address.countDocuments({ UserID: req.user!.sub });
    if (count >= MAX_ADDRESSES) throw new AppError("ERR-ACC-409-01");
    const a = await Address.create({ UserID: req.user!.sub, ...toDoc(b), IsDefault: count === 0 || Boolean(b.isDefault) });
    if (a.IsDefault) await setDefault(req.user!.sub, a._id);
    created(res, await listAddresses(req.user!.sub));
  })
);

addressesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const b = AddressBody.partial().parse(req.body);
    const a = await Address.findOneAndUpdate({ _id: id, UserID: req.user!.sub }, { $set: toDoc(b) }, { new: true, runValidators: true });
    if (!a) throw new AppError("ERR-ACC-404-01");
    if (b.isDefault) await setDefault(req.user!.sub, a._id);
    ok(res, await listAddresses(req.user!.sub));
  })
);

addressesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = oid.parse(req.params.id);
    const a = await Address.findOneAndDelete({ _id: id, UserID: req.user!.sub });
    if (!a) throw new AppError("ERR-ACC-404-01");
    if (a.IsDefault) {
      const next = await Address.findOne({ UserID: req.user!.sub }).sort({ CreatedAt: -1 });
      if (next) await setDefault(req.user!.sub, next._id);
    }
    ok(res, await listAddresses(req.user!.sub));
  })
);
