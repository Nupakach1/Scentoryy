/**
 * npm run seed — KHÔNG xóa đơn hàng/tài khoản: upsert 8 nhóm hương, 6 thương hiệu, 37 sản phẩm, 3 voucher
 * và tài khoản Admin (admin@scentory.vn / Admin@12345 nếu chưa có). Chạy lại nhiều lần an toàn.
 */
import bcrypt from "bcryptjs";
import { env } from "../cau-hinh/env";
import { BCRYPT_COST } from "../cau-hinh/nghiepVu";
import { connectDB } from "../csdl/connect";
import { Brand, Product, ScentFamily, ScentProfile, User, Voucher } from "../mo-hinh";
import { SCENTORY_FAMILIES, normalizeFamily } from "../cau-hinh/scentMatch";
import { brandDocs, familyDocs, productDocs, voucherDocs } from "./duLieuDanhMuc";

/** Gộp khóa nhóm hương cũ (6 nhóm Scentory) sang 8 nhóm Michael Edwards, giữ giá trị lớn nhất / cộng dồn điều chỉnh. */
function doiKhoa(m: Map<string, number> | Record<string, number> | null | undefined, gop: "max" | "sum"): Record<string, number> | null {
  if (!m) return null;
  const out: Record<string, number> = {};
  for (const [k, v] of m instanceof Map ? m.entries() : Object.entries(m)) {
    const f = normalizeFamily(k);
    if (!f) continue;
    out[f] = out[f] === undefined ? v : gop === "max" ? Math.max(out[f], v) : out[f] + v;
  }
  return out;
}

/** Chuyển hồ sơ mùi hương đã lưu sang 8 nhóm (an toàn khi chạy lại). */
export async function migrateProfiles(): Promise<number> {
  let n = 0;
  for (const p of await ScentProfile.find()) {
    const ratings = doiKhoa(p.FamilyRatings, "max");
    const adj = doiKhoa((p as unknown as { BehaviorAdjustments?: Map<string, number> }).BehaviorAdjustments, "sum");
    const pref = p.PreferredFamilies
      ? [...new Set(p.PreferredFamilies.split(",").map((x) => normalizeFamily(x.trim())).filter(Boolean))].join(", ")
      : p.PreferredFamilies;
    const set: Record<string, unknown> = { PreferredFamilies: pref || null };
    if (ratings) set.FamilyRatings = ratings;
    if (adj) set.BehaviorAdjustments = adj;
    await ScentProfile.updateOne({ _id: p._id }, { $set: set });
    n++;
  }
  return n;
}

export async function seedCatalog(): Promise<void> {
  // 8 nhóm hương Michael Edwards; xóa các nhóm cũ không còn dùng
  await ScentFamily.deleteMany({ Name: { $nin: [...SCENTORY_FAMILIES] } });
  for (const f of familyDocs()) await ScentFamily.updateOne({ Name: f.Name }, { $set: f }, { upsert: true });
  for (const b of brandDocs()) await Brand.updateOne({ Name: b.Name }, { $set: b }, { upsert: true });
  for (const p of productDocs()) {
    const { StockQuantity, SoldCount, ...rest } = p;
    await Product.updateOne(
      { SKU: p.SKU },
      { $set: { ...rest, UpdatedAt: new Date() }, $setOnInsert: { StockQuantity, SoldCount, CreatedAt: new Date() } },
      { upsert: true }
    );
  }
  for (const v of voucherDocs()) {
    const { UsageLimit, ...rest } = v;
    await Voucher.updateOne({ Code: v.Code }, { $set: rest, $setOnInsert: { UsageLimit, UsedCount: 0 } }, { upsert: true });
  }
  const soHoSo = await migrateProfiles();
  console.log(`Đã cập nhật: 8 nhóm hương, 6 thương hiệu, 37 sản phẩm, 3 voucher; chuyển ${soHoSo} hồ sơ mùi hương sang 8 nhóm.`);
}

export async function seedAdmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@scentory.vn").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  if (await User.exists({ Email: email })) return console.log(`Admin đã tồn tại: ${email}`);
  await User.create({ FullName: "Quản trị Scentory", Email: email, PasswordHash: await bcrypt.hash(password, BCRYPT_COST), Role: "admin", Status: "Active" });
  console.log(`Đã tạo Admin: ${email} / ${password}`);
}

if (require.main === module) {
  connectDB(env.MONGODB_URI)
    .then(seedCatalog)
    .then(seedAdmin)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("Seed thất bại:", e);
      process.exit(1);
    });
}
