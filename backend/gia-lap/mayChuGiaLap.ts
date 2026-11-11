/* eslint-disable @typescript-eslint/no-explicit-any -- máy chủ giả lập dùng dữ liệu động trong bộ nhớ */
/**
 * MÁY CHỦ GIẢ LẬP API (chỉ dùng cho demo giao diện / chụp màn hình khi KHÔNG có MongoDB).
 *
 * - Cùng hợp đồng `/api/v1` và khuôn phản hồi {success,data,error,meta,timestamp} với backend thật.
 * - Tái sử dụng NGUYÊN các hàm thuần của backend: dữ liệu danh mục (kich-ban/duLieuDanhMuc), DTO (dich-vu/dto),
 *   Scent Match (dich-vu/scentMatch), ánh xạ quiz (dich-vu/quizMapping), chatbot, thanh toán (dich-vu/payment), đánh giá gợi ý.
 * - Dữ liệu nằm trong bộ nhớ, mất khi tắt. Không đọc/ghi CSDL dùng chung của nhóm.
 *
 * Chạy:  cd backend && npm run build:fe (hoặc ng build ở frontend) rồi `npx tsx tests/gia-lap/mayChuGiaLap.ts`
 *        → http://localhost:3100  (phục vụ luôn bản build Angular trong frontend/dist/scentory/browser)
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import { Server } from "socket.io";
import { Types } from "mongoose";
import { brandDocs, familyDocs, productDocs, voucherDocs } from "../src/kich-ban/duLieuDanhMuc";
import { toAddressDto, toMessageDto, toOrderDto, toProductDto, toProfileDto, toReturnDto, toReviewDto, toUserDto } from "../src/dich-vu/dto";
import { buildCorrelatedMap, calculateScentMatch, type MatchProfileInput } from "../src/dich-vu/scentMatch";
import { QuizAnswersSchema, deriveProfile } from "../src/dich-vu/quizMapping";
import { botAnswer } from "../src/dich-vu/chatbot";
import { generateOrderCode, orderTotals, validateCard, voucherDiscount } from "../src/dich-vu/payment";
import { classifyWeather, weatherScoreLookup } from "../src/dich-vu/weatherService";
import { offlineMetrics } from "../src/dich-vu/evaluation";
import { ERRORS, type ErrorCode } from "../src/cau-hinh/maLoi";
import { ADMIN_ORDER_TRANSITIONS, DELIVERY_METHODS, QR_PAYMENT_WINDOW_MS, RETURN_TRANSITIONS, type OrderStatus, type ReturnStatus } from "../src/cau-hinh/nghiepVu";

type Doc = Record<string, any>;
const PORT = Number(process.env.PORT ?? 3100);
const oid = () => new Types.ObjectId();
const now = () => new Date();
const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000);

// ------------------------------------------------------------------ dữ liệu
const families = familyDocs().map((f) => ({ _id: oid(), ...f }));
const brands = brandDocs().map((b) => ({ _id: oid(), ...b }));
const products: Doc[] = productDocs().map((p, i) => ({ _id: oid(), ...p, AvgRating: 0, ReviewCount: 0, CreatedAt: daysAgo(60 - i) }));
const vouchers = voucherDocs().map((v) => ({ _id: oid(), UsedCount: 0, ...v }));
const corr = buildCorrelatedMap(families.map((f) => ({ Name: f.Name, CorrelatedFamilies: f.CorrelatedFamilies })));
const bySku = (s: string) => products.find((p) => p.SKU === s)!;
const byId = (id: unknown) => products.find((p) => String(p._id) === String(id));

const users: Doc[] = [];
const mkUser = (FullName: string, Email: string, Role: "customer" | "admin", PhoneNumber: string | null, created: Date) => {
  const u = { _id: oid(), FullName, Email, Role, PhoneNumber, Status: "Active", BlockReason: null, Password: Role === "admin" ? "Admin@12345" : "Scentory123", CreatedAt: created };
  users.push(u);
  return u;
};
const admin = mkUser("Quản trị Scentory", "admin@scentory.vn", "admin", null, daysAgo(90));
const nga = mkUser("Nguyễn Thanh Nga", "nga@scentory.vn", "customer", "0901234567", daysAgo(40));
const long = mkUser("Trần Hoàng Long", "long@scentory.vn", "customer", "0912345678", daysAgo(25));
const phuong = mkUser("Lê Minh Phương", "phuong@scentory.vn", "customer", "0987654321", daysAgo(6));

const profiles: Doc[] = [];
function saveProfile(userId: unknown, answers: Doc) {
  const a = QuizAnswersSchema.parse(answers);
  const d = deriveProfile(a);
  const old = profiles.findIndex((p) => String(p.UserID) === String(userId));
  const doc = {
    _id: oid(), UserID: userId, IsCompleted: true, ProfileTitle: d.profileTitle, PreferredFamilies: d.preferredFamilies.join(", "),
    FamilyRatings: d.familyRatings, PreferredProjection: d.preferredProjection, ExpectedOccasion: d.expectedOccasion, PreferredVolume: d.preferredVolume,
    BudgetRange: null, BehaviorAdjustments: {}, UpdatedAt: now(),
    QuizAnswers: { Style: a.style, IncludeUnisex: a.includeUnisex, Tone: a.tone, Mood: a.mood, Aura: a.aura, Habit: a.habit, Age: a.age },
  };
  if (old >= 0) profiles[old] = doc; else profiles.push(doc);
  return { doc, lede: d.profileLede };
}
saveProfile(nga._id, { style: "feminine", includeUnisex: true, tone: "fresh_clean", mood: "day_energy", aura: "soft", habit: "daily_spritzer", age: 27 });
saveProfile(long._id, { style: "masculine", includeUnisex: false, tone: "warm_opulent", mood: "night_party", aura: "bold", habit: "scent_shifter", age: 31 });

const addresses: Doc[] = [
  { _id: oid(), UserID: nga._id, Label: "Nhà riêng", RecipientName: "Nguyễn Thanh Nga", Phone: "0901234567", AddressLine: "12 Lý Tự Trọng", Ward: "Phường Bến Nghé", District: "Quận 1", City: "TP. Hồ Chí Minh", IsDefault: true },
  { _id: oid(), UserID: nga._id, Label: "Văn phòng", RecipientName: "Nguyễn Thanh Nga", Phone: "0901234567", AddressLine: "45 Võ Văn Tần", Ward: "Phường Võ Thị Sáu", District: "Quận 3", City: "TP. Hồ Chí Minh", IsDefault: false },
];
const wishlist: Doc[] = ["BY-001", "DT-005", "LL-004"].map((s, i) => ({ _id: oid(), UserID: nga._id, ProductID: bySku(s)._id, CreatedAt: daysAgo(i) }));
const cartItems: Doc[] = [
  { _id: oid(), UserID: nga._id, ProductID: bySku("LL-001")._id, Quantity: 1 },
  { _id: oid(), UserID: nga._id, ProductID: bySku("BY-002")._id, Quantity: 2 },
];
const orders: Doc[] = [];
const orderItems: Doc[] = [];
function mkOrder(u: Doc, lines: Array<[string, number]>, status: OrderStatus, created: Date, opt: Doc = {}) {
  const sub = lines.reduce((s, [sku, q]) => s + bySku(sku).Price * q, 0);
  const t = orderTotals(sub, opt.delivery ?? "STANDARD", opt.discount ?? 0);
  const o: Doc = {
    _id: oid(), OrderCode: generateOrderCode(created), UserID: u._id, RecipientName: u.FullName, Phone: u.PhoneNumber,
    ShippingAddress: "12 Lý Tự Trọng, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh", DeliveryMethod: opt.delivery ?? "STANDARD",
    Subtotal: t.subtotal, ShippingFee: t.shippingFee, DiscountAmount: t.discountAmount, TotalAmount: t.totalAmount, VoucherCode: opt.voucher ?? null,
    PaymentMethod: opt.pay ?? "COD", PaymentStatus: opt.payStatus ?? (status === "DELIVERED" ? "PAID" : "PENDING"), PaymentExpiresAt: opt.expires ?? null,
    CardLast4: opt.card ?? null, Status: status, TrackingCode: status === "SHIPPING" || status === "DELIVERED" ? "GHN" + crypto.randomInt(1e8, 9e8) : null,
    OrderNote: null, CancelReason: opt.cancel ?? null, CancelledBy: opt.cancel ? "customer" : null, CreatedAt: created,
    DeliveredAt: status === "DELIVERED" ? new Date(created.getTime() + 2 * 86_400_000) : null,
    Timeline: [{ Status: "PROCESSING", At: created, By: "customer", Note: "Đặt hàng thành công" }],
  };
  if (status === "SHIPPING" || status === "DELIVERED") o.Timeline.push({ Status: "SHIPPING", At: new Date(created.getTime() + 86_400_000), By: "admin", Note: "Đã bàn giao vận chuyển" });
  if (status === "DELIVERED") o.Timeline.push({ Status: "DELIVERED", At: o.DeliveredAt, By: "admin", Note: "Giao hàng thành công" });
  if (status === "CANCELLED") o.Timeline.push({ Status: "CANCELLED", At: new Date(created.getTime() + 3_600_000), By: "customer", Note: opt.cancel });
  orders.push(o);
  for (const [sku, q] of lines) orderItems.push({ _id: oid(), OrderID: o._id, ProductID: bySku(sku)._id, ProductName: bySku(sku).Name, Quantity: q, FixedUnitPrice: bySku(sku).Price });
  return o;
}
const o1 = mkOrder(nga, [["DT-005", 1]], "DELIVERED", daysAgo(3));
mkOrder(nga, [["LL-004", 1]], "SHIPPING", daysAgo(1));
mkOrder(nga, [["BY-003", 1], ["CR-002", 1]], "PROCESSING", daysAgo(0, 2), { pay: "QR", expires: new Date(Date.now() + 11 * 60_000) });
mkOrder(nga, [["MM-001", 1]], "CANCELLED", daysAgo(9), { cancel: "Tôi tìm thấy ưu đãi tốt hơn / đổi ý không muốn mua nữa" });
const o5 = mkOrder(long, [["DP-006", 1]], "DELIVERED", daysAgo(5), { pay: "CARD", card: "1111", payStatus: "PAID", delivery: "EXPRESS" });
mkOrder(long, [["CR-001", 1], ["LL-001", 1]], "DELIVERED", daysAgo(14), { voucher: "SCENTORY10", discount: 1_000_000 });
mkOrder(phuong, [["BY-001", 1]], "PROCESSING", daysAgo(0, 5));
for (const it of orderItems) { const o = orders.find((x) => String(x._id) === String(it.OrderID))!; if (o.Status === "DELIVERED") bySku(byId(it.ProductID)!.SKU).SoldCount += it.Quantity; }

const reviews: Doc[] = [
  { _id: oid(), UserID: nga._id, OrderID: o1._id, ProductID: bySku("DT-005")._id, OverallRating: 5, ActualProjection: "MATCH", MatchScoreRating: 5, ReviewText: "Hương hoa hồng trong trẻo, rất hợp đi làm. Lưu hương khoảng 6 tiếng trên da.", CreatedAt: daysAgo(1) },
  { _id: oid(), UserID: long._id, OrderID: orders[5]._id, ProductID: bySku("LL-001")._id, OverallRating: 5, ActualProjection: "HIGHER", MatchScoreRating: 4, ReviewText: "Santal 33 khô xuống thành mùi gỗ đàn hương rất sang. Tỏa mạnh hơn mình nghĩ.", CreatedAt: daysAgo(8) },
  { _id: oid(), UserID: long._id, OrderID: orders[5]._id, ProductID: bySku("CR-001")._id, OverallRating: 4, ActualProjection: "MATCH", MatchScoreRating: 4, ReviewText: "Aventus nam tính, hợp tiệc tối.", CreatedAt: daysAgo(8) },
];
function refreshRatings() {
  for (const p of products) {
    const rs = reviews.filter((r) => String(r.ProductID) === String(p._id));
    p.ReviewCount = rs.length;
    p.AvgRating = rs.length ? Math.round((rs.reduce((s, r) => s + r.OverallRating, 0) / rs.length) * 10) / 10 : 0;
  }
}
refreshRatings();
const files = new Map<string, { buf: Buffer; type: string; owner: string }>();
const evidenceId = crypto.randomBytes(12).toString("hex");
files.set(evidenceId, { buf: fs.readFileSync(path.resolve(__dirname, "../../frontend/src/hinh-anh/san-pham/dp-006.webp")), type: "image/webp", owner: String(long._id) });
const returns: Doc[] = [{
  _id: oid(), OrderID: o5._id, UserID: long._id, RequestType: "REFUND", Items: [{ ProductID: bySku("DP-006")._id, Quantity: 1 }], Reason: "Sản phẩm bị lỗi / hư hỏng",
  Description: "Vòi xịt bị kẹt, không phun sương được.", EvidenceUrl: `/api/v1/uploads/${evidenceId}`, IsIntactSeal: false, RefundAmount: bySku("DP-006").Price,
  Status: "PENDING", AdminResponse: null, CreatedAt: daysAgo(1), ResolvedAt: null,
}];
const messages: Doc[] = [
  { _id: oid(), From: nga._id, To: null, Content: "Shop ơi, đơn Rose 31 của mình khi nào giao tới ạ?", OrderID: orders[1]._id, Read: true, CreatedAt: daysAgo(0, 5) },
  { _id: oid(), From: admin._id, To: nga._id, Content: "Chào chị Nga, đơn đã bàn giao GHN, dự kiến giao trong hôm nay ạ.", OrderID: null, Read: true, CreatedAt: daysAgo(0, 4) },
  { _id: oid(), From: long._id, To: null, Content: "Mình đã gửi yêu cầu đổi trả Cuir Cannage, nhờ shop kiểm tra giúp.", OrderID: o5._id, Read: false, CreatedAt: daysAgo(0, 1) },
];
const sessions = new Map<string, string>();

// ------------------------------------------------------------------ tiện ích
const env = (res: Response, data: unknown, meta: unknown = null, status = 200) =>
  res.status(status).json({ success: true, data, error: null, meta, timestamp: new Date().toISOString() });
class Loi extends Error { constructor(public code: ErrorCode, msg?: string, public details?: Array<{ field: string; message: string }>) { super(msg ?? ERRORS[code].message); } }
const me = (req: Request) => { const sid = /(?:^|;\s*)gl_sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1]; const uid = sid ? sessions.get(sid) : undefined; return uid ? users.find((u) => String(u._id) === uid) : undefined; };
const can = (req: Request) => { const u = me(req); if (!u) throw new Loi("ERR-AUTH-401-02"); return u; };
const canAdmin = (req: Request) => { const u = can(req); if (u.Role !== "admin") throw new Loi("ERR-AUTH-403-02"); return u; };
const login = (res: Response, u: Doc) => { const sid = crypto.randomBytes(16).toString("hex"); sessions.set(sid, String(u._id)); res.setHeader("Set-Cookie", `gl_sid=${sid}; Path=/; HttpOnly; SameSite=Lax`); };
const pop = (it: Doc) => ({ ...it, ProductID: byId(it.ProductID) ?? it.ProductID });
const itemsOf = (o: Doc) => orderItems.filter((i) => String(i.OrderID) === String(o._id)).map(pop);
const withUser = (o: Doc) => ({ ...o, UserID: users.find((u) => String(u._id) === String(o.UserID)) });
const profileOf = (uid: unknown) => profiles.find((p) => String(p.UserID) === String(uid));
const weatherData = () => { const c = classifyWeather(31, 74, 2); return { band: c.band, label: c.label, hint: c.hint, temperature: 31, humidity: 74 }; };
const activeProducts = () => products.filter((p) => p.IsActive);
function filterProducts(q: Doc) {
  let ds = activeProducts();
  if (q.q) { const k = String(q.q).toLowerCase(); ds = ds.filter((p) => [p.Name, p.BrandName, p.TopNotes, p.MiddleNotes, p.BaseNotes, p.ScentFamily].join(" ").toLowerCase().includes(k)); }
  const inList = (v: unknown, f: string) => { if (v) { const s = String(v).split(",").map((x) => x.trim()); ds = ds.filter((p) => s.includes(p[f])); } };
  inList(q.family, "ScentFamily"); inList(q.brand, "BrandName"); inList(q.concentration, "Concentration");
  if (q.minPrice) ds = ds.filter((p) => p.Price >= Number(q.minPrice));
  if (q.maxPrice) ds = ds.filter((p) => p.Price <= Number(q.maxPrice));
  return ds;
}
const SORT: Record<string, (a: Doc, b: Doc) => number> = {
  name: (a, b) => a.Name.localeCompare(b.Name), newest: (a, b) => b.CreatedAt - a.CreatedAt, price_asc: (a, b) => a.Price - b.Price,
  price_desc: (a, b) => b.Price - a.Price, bestseller: (a, b) => b.SoldCount - a.SoldCount, rating: (a, b) => b.AvgRating - a.AvgRating,
};
function profileInput(p: Doc): MatchProfileInput {
  return { PreferredFamilies: p.PreferredFamilies, FamilyRatings: p.FamilyRatings, PreferredProjection: p.PreferredProjection, ExpectedOccasion: p.ExpectedOccasion, BudgetRange: null };
}
function score(profile: MatchProfileInput, ds: Doc[]) {
  const w = weatherData();
  return ds.map((p) => { const r = calculateScentMatch(profile, p as any, { band: w.band, temperature: w.temperature, humidity: w.humidity }, corr); return { product: toProductDto(p), matchScore: r.matchScore, appliedWeight: r.appliedWeight, breakdown: r.breakdown }; })
    .sort((a, b) => b.matchScore - a.matchScore || String(a.product.name).localeCompare(String(b.product.name)));
}
function cartOf(uid: unknown) {
  const items = cartItems.filter((c) => String(c.UserID) === String(uid)).map((c) => {
    const p = toProductDto(byId(c.ProductID)!);
    return { id: String(c._id), product: p, quantity: c.Quantity, lineTotal: Number(p.price) * c.Quantity, maxQuantity: Math.min(10, Number(p.stock)) };
  });
  return { items, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal: items.reduce((s, i) => s + i.lineTotal, 0) };
}
function addCart(uid: unknown, pid: string, qty: number) {
  const p = byId(pid); if (!p || !p.IsActive) throw new Loi("ERR-CAT-404-01");
  if (p.StockQuantity <= 0) throw new Loi("ERR-CART-409-01");
  const c = cartItems.find((x) => String(x.UserID) === String(uid) && String(x.ProductID) === pid);
  if (c) c.Quantity = Math.min(10, p.StockQuantity, c.Quantity + qty); else cartItems.push({ _id: oid(), UserID: uid, ProductID: p._id, Quantity: Math.min(10, p.StockQuantity, qty) });
}
function expireQr() {
  for (const o of orders) if (o.PaymentMethod === "QR" && o.PaymentStatus === "PENDING" && o.Status === "PROCESSING" && o.PaymentExpiresAt && o.PaymentExpiresAt < now()) cancel(o, "system", "Quá hạn thanh toán QR 15 phút");
}
function cancel(o: Doc, by: string, reason: string) {
  o.Status = "CANCELLED"; o.CancelReason = reason; o.CancelledBy = by;
  if (o.PaymentStatus === "PAID") o.PaymentStatus = "REFUNDED"; else if (o.PaymentStatus === "PENDING") o.PaymentStatus = "FAILED";
  o.Timeline.push({ Status: "CANCELLED", At: now(), By: by, Note: reason });
  for (const i of orderItems.filter((x) => String(x.OrderID) === String(o._id))) { const p = byId(i.ProductID); if (p) p.StockQuantity += i.Quantity; }
}

// ------------------------------------------------------------------ định tuyến
const app = express();
app.use(express.json({ limit: "100kb" }));
const api = express.Router();
const h = (f: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) => { try { const r = f(req, res); if (r instanceof Promise) r.catch(next); } catch (e) { next(e); } };

// AUTH
api.get("/auth/me", h((req, res) => { const u = can(req); env(res, { ...toUserDto(u), hasScentProfile: Boolean(profileOf(u._id)) }); }));
api.post("/auth/login", h((req, res) => {
  const u = users.find((x) => x.Email === String(req.body.email ?? "").toLowerCase() && x.Role === "customer");
  if (!u || u.Password !== req.body.password) throw new Loi("ERR-AUTH-401-01");
  if (u.Status === "Blocked") throw new Loi("ERR-AUTH-403-01");
  login(res, u); env(res, { ...toUserDto(u), hasScentProfile: Boolean(profileOf(u._id)) });
}));
api.post("/auth/admin/sessions", h((req, res) => {
  const u = users.find((x) => x.Email === String(req.body.email ?? "").toLowerCase());
  if (!u || u.Password !== req.body.password) throw new Loi("ERR-AUTH-401-01");
  if (u.Role !== "admin") throw new Loi("ERR-AUTH-403-02");
  login(res, u); env(res, toUserDto(u));
}));
api.post("/auth/register", h((req, res) => {
  const b = req.body;
  if (users.some((u) => u.Email === String(b.email).toLowerCase())) throw new Loi("ERR-AUTH-409-01");
  const u = mkUser(b.fullName, String(b.email).toLowerCase(), "customer", b.phoneNumber ?? null, now());
  u.Password = b.password; login(res, u); env(res, { ...toUserDto(u), hasScentProfile: false }, null, 201);
}));
api.post("/auth/logout", h((req, res) => { res.setHeader("Set-Cookie", "gl_sid=; Path=/; Max-Age=0"); env(res, { loggedOut: true }); }));
api.post("/auth/password-resets", h((_req, res) => env(res, { message: "Nếu email tồn tại, mã OTP đã được gửi.", expiresInSeconds: 180, demoOtp: "123456" }, null, 202)));
api.post("/auth/password-resets/verify", h((req, res) => { if (req.body.otp !== "123456") throw new Loi("ERR-AUTH-400-01"); env(res, { resetToken: "gia-lap", expiresInSeconds: 600 }); }));
api.post("/auth/password-resets/confirm", h((_req, res) => env(res, { message: "Mật khẩu đã được đặt lại thành công." })));

// CATALOG
api.get("/products", h((req, res) => {
  const q = req.query as Doc;
  const page = Math.max(1, Number(q.page) || 1), limit = Math.min(100, Number(q.limit) || 12);
  const ds = filterProducts(q).sort(SORT[q.sort ?? "name"] ?? SORT.name);
  const facet = (f: string) => Object.entries(activeProducts().reduce<Record<string, number>>((m, p) => ((m[p[f]] = (m[p[f]] ?? 0) + 1), m), {})).sort().map(([value, count]) => ({ value, count }));
  env(res, ds.slice((page - 1) * limit, page * limit).map(toProductDto), { page, limit, total: ds.length, pages: Math.ceil(ds.length / limit), facets: { families: facet("ScentFamily"), brands: facet("BrandName"), concentrations: facet("Concentration") } });
}));
api.get("/products/:id", h((req, res) => {
  const id = String(req.params.id);
  const p = byId(id) ?? products.find((x) => x.SKU === id.toUpperCase());
  if (!p || !p.IsActive) throw new Loi("ERR-CAT-404-01");
  env(res, { ...toProductDto(p), related: activeProducts().filter((x) => x.ScentFamily === p.ScentFamily && x !== p).slice(0, 4).map(toProductDto) });
}));
api.get("/brands", h((_req, res) => env(res, brands.map((b) => { const ps = activeProducts().filter((p) => p.BrandName === b.Name);
  return { id: String(b._id), name: b.Name, slug: b.Slug, description: b.Description, origin: b.Origin, style: b.Style, imageUrl: b.ImageUrl, productCount: ps.length, minPrice: Math.min(...ps.map((p) => p.Price)) }; }))));
api.get("/brands/:slug", h((req, res) => { const b = brands.find((x) => x.Slug === req.params.slug); if (!b) throw new Loi("ERR-CAT-404-01", "Thương hiệu không tồn tại.");
  env(res, { id: String(b._id), name: b.Name, slug: b.Slug, description: b.Description, origin: b.Origin, style: b.Style, imageUrl: b.ImageUrl, products: activeProducts().filter((p) => p.BrandName === b.Name).sort(SORT.bestseller).map(toProductDto) }); }));
api.get("/scent-families", h((_req, res) => env(res, families.map((f) => { const ps = activeProducts().filter((p) => p.ScentFamily === f.Name);
  return { id: String(f._id), name: f.Name, nameVi: f.NameVi, description: f.Description, keyNotes: f.KeyNotes, vibe: f.Vibe, imageUrl: f.ImageUrl, correlated: f.CorrelatedFamilies, productCount: ps.length, soldCount: ps.reduce((s, p) => s + p.SoldCount, 0) }; }))));

// PERSONALIZATION
api.post("/quiz/submissions", h((req, res) => {
  const a = QuizAnswersSchema.safeParse(req.body);
  if (!a.success) throw new Loi("ERR-QUIZ-422-01", undefined, a.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })));
  const u = me(req);
  if (!u) { const d = deriveProfile(a.data); return env(res, { ...toProfileDto({ IsCompleted: true, ProfileTitle: d.profileTitle, PreferredFamilies: d.preferredFamilies.join(", "), FamilyRatings: d.familyRatings, PreferredProjection: d.preferredProjection, ExpectedOccasion: d.expectedOccasion, PreferredVolume: d.preferredVolume, QuizAnswers: { Style: a.data.style, IncludeUnisex: a.data.includeUnisex, Tone: a.data.tone, Mood: a.data.mood, Aura: a.data.aura, Habit: a.data.habit, Age: a.data.age } }), lede: d.profileLede, saved: false }, null, 201); }
  const r = saveProfile(u._id, a.data); env(res, { ...toProfileDto(r.doc), lede: r.lede, saved: true }, null, 201);
}));
api.get("/quiz/profile", h((req, res) => { const u = can(req); const p = profileOf(u._id); if (!p) throw new Loi("ERR-MTCH-409-01");
  env(res, { ...toProfileDto(p), lede: deriveProfile(QuizAnswersSchema.parse({ style: p.QuizAnswers.Style, includeUnisex: p.QuizAnswers.IncludeUnisex, tone: p.QuizAnswers.Tone, mood: p.QuizAnswers.Mood, aura: p.QuizAnswers.Aura, habit: p.QuizAnswers.Habit, age: p.QuizAnswers.Age })).profileLede }); }));
api.get("/match/products/:id", h((req, res) => { const u = can(req); const p = profileOf(u._id); if (!p) throw new Loi("ERR-MTCH-409-01");
  const prod = byId(req.params.id) ?? products.find((x) => x.SKU === String(req.params.id).toUpperCase()); if (!prod) throw new Loi("ERR-CAT-404-01");
  env(res, score(profileInput(p), [prod])[0], { weather: weatherData() }); }));
api.get("/match/products", h((req, res) => { const u = can(req); const p = profileOf(u._id); if (!p) throw new Loi("ERR-MTCH-409-01");
  const s = score(profileInput(p), filterProducts(req.query as Doc).filter((x) => x.StockQuantity > 0)); env(res, s.slice(0, Number(req.query.limit) || s.length), { total: s.length, weather: weatherData() }); }));
api.post("/match/preview", h((req, res) => { const a = QuizAnswersSchema.safeParse(req.body.answers); if (!a.success) throw new Loi("ERR-MTCH-409-01");
  const d = deriveProfile(a.data); const s = score({ PreferredFamilies: d.preferredFamilies.join(", "), FamilyRatings: d.familyRatings, PreferredProjection: d.preferredProjection, ExpectedOccasion: d.expectedOccasion, BudgetRange: null }, filterProducts(req.body).filter((x) => x.StockQuantity > 0));
  env(res, s.slice(0, Number(req.body.limit) || 3), { total: s.length, weather: weatherData() }); }));
api.get("/weather", h((_req, res) => { const w = weatherData(); const sc: Record<string, number> = {}; for (const [f, v] of Object.entries(weatherScoreLookup(w.band))) sc[f] = Math.round(v * 100);
  env(res, { locationName: "TP. Hồ Chí Minh", ...w, scores: sc, fetchedAt: now() }); }));
api.post("/interactions", h((req, res) => { can(req); env(res, { recorded: true }, null, 201); }));

// ACCOUNT
api.get("/wishlist", h((req, res) => { const u = can(req); env(res, wishlist.filter((w) => String(w.UserID) === String(u._id)).map((w) => ({ addedAt: w.CreatedAt, product: toProductDto(byId(w.ProductID)!) }))); }));
api.put("/wishlist/items/:pid", h((req, res) => { const u = can(req); if (!wishlist.some((w) => String(w.UserID) === String(u._id) && String(w.ProductID) === req.params.pid)) wishlist.unshift({ _id: oid(), UserID: u._id, ProductID: req.params.pid, CreatedAt: now() }); env(res, { added: true }); }));
api.delete("/wishlist/items/:pid", h((req, res) => { const u = can(req); const i = wishlist.findIndex((w) => String(w.UserID) === String(u._id) && String(w.ProductID) === req.params.pid); if (i >= 0) wishlist.splice(i, 1); env(res, { removed: true }); }));
const myAddr = (u: Doc) => addresses.filter((a) => String(a.UserID) === String(u._id)).sort((a, b) => Number(b.IsDefault) - Number(a.IsDefault));
api.get("/addresses", h((req, res) => env(res, myAddr(can(req)).map(toAddressDto))));
api.post("/addresses", h((req, res) => { const u = can(req); const b = req.body; const first = !myAddr(u).length;
  if (b.isDefault) myAddr(u).forEach((a) => (a.IsDefault = false));
  const a = { _id: oid(), UserID: u._id, Label: b.label, RecipientName: b.fullName, Phone: b.phone, AddressLine: b.address, Ward: b.ward, District: b.district, City: b.city, IsDefault: first || Boolean(b.isDefault) };
  addresses.push(a); env(res, toAddressDto(a), null, 201); }));
api.patch("/addresses/:id", h((req, res) => { const u = can(req); const a = myAddr(u).find((x) => String(x._id) === req.params.id); if (!a) throw new Loi("ERR-SYS-404-01"); const b = req.body;
  if (b.isDefault) myAddr(u).forEach((x) => (x.IsDefault = false));
  Object.assign(a, Object.fromEntries(Object.entries({ Label: b.label, RecipientName: b.fullName, Phone: b.phone, AddressLine: b.address, Ward: b.ward, District: b.district, City: b.city, IsDefault: b.isDefault }).filter(([, v]) => v !== undefined)));
  env(res, toAddressDto(a)); }));
api.delete("/addresses/:id", h((req, res) => { const u = can(req); const i = addresses.findIndex((x) => String(x._id) === req.params.id && String(x.UserID) === String(u._id)); if (i >= 0) addresses.splice(i, 1); env(res, { deleted: true }); }));

// CART
api.get("/cart", h((req, res) => env(res, cartOf(can(req)._id))));
api.post("/cart/items", h((req, res) => { const u = can(req); addCart(u._id, req.body.productId, Number(req.body.quantity) || 1); env(res, cartOf(u._id), null, 201); }));
api.patch("/cart/items/:id", h((req, res) => { const u = can(req); const c = cartItems.find((x) => String(x._id) === req.params.id); if (!c) throw new Loi("ERR-CART-404-01");
  const p = byId(c.ProductID)!; const q = Number(req.body.quantity); if (q < 1 || q > Math.min(10, p.StockQuantity)) throw new Loi("ERR-CART-409-01"); c.Quantity = q; env(res, cartOf(u._id)); }));
api.delete("/cart/items/:id", h((req, res) => { const u = can(req); const i = cartItems.findIndex((x) => String(x._id) === req.params.id); if (i >= 0) cartItems.splice(i, 1); env(res, cartOf(u._id)); }));
api.post("/cart/merge", h((req, res) => { const u = can(req); for (const it of req.body.items ?? []) { try { addCart(u._id, it.productId, it.quantity); } catch { /* bỏ qua dòng lỗi */ } } env(res, cartOf(u._id)); }));

// ORDERS & VOUCHERS
api.get("/vouchers", h((_req, res) => env(res, vouchers.map((v) => ({ code: v.Code, title: v.Title, description: v.Description, type: v.DiscountType, value: v.DiscountValue, minOrderAmount: v.MinOrderAmount, maxDiscountAmount: v.MaxDiscountAmount ?? null, endAt: v.EndAt })))));
api.post("/vouchers/validate", h((req, res) => { const v = vouchers.find((x) => x.Code === String(req.body.code).toUpperCase()) ?? null; const fee = DELIVERY_METHODS[req.body.deliveryMethod as "STANDARD"].fee;
  const d = voucherDiscount(v as any, Number(req.body.subtotal), fee); if (d == null) throw new Loi("ERR-PRM-422-01");
  env(res, { code: v!.Code, title: v!.Title, discount: d, ...orderTotals(Number(req.body.subtotal), req.body.deliveryMethod, d) }); }));
api.post("/orders", h((req, res) => {
  const u = can(req); const b = req.body;
  const lines: Array<{ productId: string; quantity: number }> = b.buyNow ? [b.buyNow] : cartItems.filter((c) => (b.itemIds ?? []).includes(String(c._id))).map((c) => ({ productId: String(c.ProductID), quantity: c.Quantity }));
  if (!lines.length) throw new Loi("ERR-ORD-400-01");
  for (const l of lines) { const p = byId(l.productId); if (!p || p.StockQuantity < l.quantity) throw new Loi("ERR-ORD-409-01"); }
  let card: string | null = null;
  if (b.paymentMethod === "CARD") { card = validateCard(b.card); if (!card) throw new Loi("ERR-PAY-422-01"); }
  const sub = lines.reduce((s, l) => s + byId(l.productId)!.Price * l.quantity, 0);
  const fee = DELIVERY_METHODS[b.deliveryMethod as "STANDARD"].fee;
  const v = b.voucherCode ? vouchers.find((x) => x.Code === String(b.voucherCode).toUpperCase()) ?? null : null;
  const disc = b.voucherCode ? voucherDiscount(v as any, sub, fee) : 0; if (disc == null) throw new Loi("ERR-PRM-422-01");
  const t = orderTotals(sub, b.deliveryMethod, disc); const r = b.recipient;
  const o: Doc = { _id: oid(), OrderCode: generateOrderCode(), UserID: u._id, RecipientName: r.fullName, Phone: r.phone, ShippingAddress: [r.addressLine, r.ward, r.district, r.city].join(", "),
    DeliveryMethod: b.deliveryMethod, Subtotal: t.subtotal, ShippingFee: t.shippingFee, DiscountAmount: t.discountAmount, TotalAmount: t.totalAmount, VoucherCode: v?.Code ?? null,
    PaymentMethod: b.paymentMethod, PaymentStatus: b.paymentMethod === "CARD" ? "PAID" : "PENDING", PaymentExpiresAt: b.paymentMethod === "QR" ? new Date(Date.now() + QR_PAYMENT_WINDOW_MS) : null,
    PaidAt: b.paymentMethod === "CARD" ? now() : null, CardLast4: card, Status: "PROCESSING", TrackingCode: null, OrderNote: r.note ?? null, CreatedAt: now(),
    Timeline: [{ Status: "PROCESSING", At: now(), By: "customer", Note: "Đặt hàng thành công" }] };
  orders.push(o); io?.to("admins").emit("admin:badges");
  for (const l of lines) { const p = byId(l.productId)!; p.StockQuantity -= l.quantity; orderItems.push({ _id: oid(), OrderID: o._id, ProductID: p._id, ProductName: p.Name, Quantity: l.quantity, FixedUnitPrice: p.Price }); }
  if (!b.buyNow) for (const id of b.itemIds) { const i = cartItems.findIndex((c) => String(c._id) === id); if (i >= 0) cartItems.splice(i, 1); }
  env(res, toOrderDto(o, itemsOf(o)), null, 201);
}));
api.get("/orders", h((req, res) => { const u = can(req); expireQr(); const mine = orders.filter((o) => String(o.UserID) === String(u._id)).sort((a, b) => b.CreatedAt - a.CreatedAt);
  const st = req.query.status as string | undefined; const ds = st ? mine.filter((o) => o.Status === st) : mine;
  const c: Record<string, number> = { ALL: mine.length, PROCESSING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 }; for (const o of mine) c[o.Status]++;
  const page = Number(req.query.page) || 1, limit = Number(req.query.limit) || 10;
  env(res, ds.slice((page - 1) * limit, page * limit).map((o) => toOrderDto(o, itemsOf(o))), { page, limit, total: ds.length, counts: c }); }));
api.get("/orders/:id", h((req, res) => { const u = can(req); expireQr(); const o = orders.find((x) => String(x._id) === req.params.id && String(x.UserID) === String(u._id)); if (!o) throw new Loi("ERR-ORD-404-01");
  const r = returns.find((x) => String(x.OrderID) === String(o._id));
  env(res, { ...toOrderDto(o, itemsOf(o)), returnRequest: r ? toReturnDto(r) : null, reviews: reviews.filter((x) => String(x.OrderID) === String(o._id)).map(toReviewDto) }); }));
api.post("/orders/:id/cancellation", h((req, res) => { const u = can(req); const o = orders.find((x) => String(x._id) === req.params.id && String(x.UserID) === String(u._id)); if (!o) throw new Loi("ERR-ORD-404-01");
  if (o.Status !== "PROCESSING") throw new Loi("ERR-ORD-409-02"); cancel(o, "customer", req.body.note ? `${req.body.reason} — ${req.body.note}` : req.body.reason); env(res, toOrderDto(o)); }));
api.post("/orders/:id/payments/qr/confirm", h((req, res) => { const u = can(req); expireQr(); const o = orders.find((x) => String(x._id) === req.params.id && String(x.UserID) === String(u._id)); if (!o) throw new Loi("ERR-ORD-404-01");
  if (o.PaymentMethod !== "QR" || o.PaymentStatus !== "PENDING" || o.Status !== "PROCESSING") throw new Loi("ERR-PAY-409-01");
  o.PaymentStatus = "PAID"; o.PaidAt = now(); o.Timeline.push({ Status: "PROCESSING", At: now(), By: "customer", Note: "Đã xác nhận chuyển khoản QR" }); env(res, toOrderDto(o)); }));

// AFTER-SALES
api.post("/uploads", h((req, res) => { const u = can(req); const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c)); req.on("end", () => { const id = crypto.randomBytes(12).toString("hex"); files.set(id, { buf: Buffer.concat(chunks), type: "image/jpeg", owner: String(u._id) }); env(res, { id, url: `/api/v1/uploads/${id}` }, null, 201); }); }));
api.get("/uploads/:id", h((req, res) => { const f = files.get(String(req.params.id)); if (!f) throw new Loi("ERR-SYS-404-01"); res.setHeader("Content-Type", f.type); res.end(f.buf); }));
api.post("/returns", h((req, res) => { const u = can(req); const b = req.body; const o = orders.find((x) => String(x._id) === b.orderId && String(x.UserID) === String(u._id)); if (!o) throw new Loi("ERR-ORD-404-01");
  if (o.Status !== "DELIVERED") throw new Loi("ERR-RET-409-03"); if (returns.some((r) => String(r.OrderID) === b.orderId)) throw new Loi("ERR-RET-409-02"); if (!b.evidenceUrl) throw new Loi("ERR-RET-422-01");
  const refund = (b.items as Doc[]).reduce((s, i) => s + byId(i.productId)!.Price * i.quantity, 0);
  const r = { _id: oid(), OrderID: o._id, UserID: u._id, RequestType: b.requestType, Items: b.items.map((i: Doc) => ({ ProductID: i.productId, Quantity: i.quantity })), Reason: b.reason, Description: b.description ?? null,
    EvidenceUrl: b.evidenceUrl, IsIntactSeal: b.isIntactSeal, RefundAmount: b.requestType === "REFUND" ? refund : 0, Status: "PENDING", AdminResponse: null, CreatedAt: now(), ResolvedAt: null };
  returns.push(r); io?.to("admins").emit("admin:badges"); env(res, toReturnDto(r), null, 201); }));
api.get("/reviews", h((req, res) => { const ds = reviews.filter((r) => String(r.ProductID) === req.query.productId).map((r) => ({ ...r, UserID: users.find((u) => String(u._id) === String(r.UserID)) }));
  env(res, ds.map(toReviewDto), { total: ds.length, avgRating: ds.length ? Math.round((ds.reduce((s, r) => s + r.OverallRating, 0) / ds.length) * 10) / 10 : 0 }); }));
api.post("/reviews", h((req, res) => { const u = can(req); const b = req.body; const o = orders.find((x) => String(x._id) === b.orderId && String(x.UserID) === String(u._id) && x.Status === "DELIVERED"); if (!o) throw new Loi("ERR-REV-403-01");
  if (reviews.some((r) => String(r.OrderID) === b.orderId && String(r.ProductID) === b.productId)) throw new Loi("ERR-REV-409-01");
  const r = { _id: oid(), UserID: u._id, OrderID: o._id, ProductID: b.productId, OverallRating: b.overallRating, ActualProjection: b.actualProjection ?? "MATCH", MatchScoreRating: b.matchScoreRating ?? null, ReviewText: b.reviewText ?? null, CreatedAt: now() };
  reviews.push(r); refreshRatings(); env(res, toReviewDto(r), null, 201); }));

// MESSAGES
let io: Server | null = null;
function postMsg(u: Doc, b: Doc) {
  const content = String(b.content ?? "").trim(); if (!content || content.length > 1000) throw new Loi("ERR-MSG-422-01");
  const to = u.Role === "admin" ? b.to : null;
  const m = { _id: oid(), From: u._id, To: to, Content: content, OrderID: b.orderId ?? null, Read: false, CreatedAt: now() };
  messages.push(m); const dto = toMessageDto(m); io?.to(`uid:${u.Role === "admin" ? to : u._id}`).to("admins").emit("message:new", dto); return dto;
}
api.post("/chatbot/messages", h((req, res) => env(res, botAnswer(String(req.body.message ?? "")))));
api.get("/messages", h((req, res) => { const u = can(req); const uid = u.Role === "admin" ? String(req.query.with) : String(u._id);
  for (const m of messages) if (u.Role === "admin" ? String(m.From) === uid && m.To === null : String(m.To) === uid) m.Read = true;
  env(res, messages.filter((m) => (String(m.From) === uid && m.To === null) || String(m.To) === uid).sort((a, b) => a.CreatedAt - b.CreatedAt).map(toMessageDto)); }));
api.post("/messages", h((req, res) => env(res, postMsg(can(req), req.body), null, 201)));
api.get("/admin/conversations", h((req, res) => { canAdmin(req); const g = new Map<string, Doc[]>();
  for (const m of messages) { const c = String(m.To ?? m.From); g.set(c, [...(g.get(c) ?? []), m]); }
  env(res, [...g.entries()].map(([uid, ms]) => { const u = users.find((x) => String(x._id) === uid)!; const last = ms.sort((a, b) => b.CreatedAt - a.CreatedAt)[0];
    return { userId: uid, fullName: u.FullName, email: u.Email, lastMessage: last.Content, lastAt: last.CreatedAt, unread: ms.filter((m) => m.To === null && !m.Read).length }; }).sort((a, b) => +b.lastAt - +a.lastAt)); }));

// ADMIN
api.get("/admin/badges", h((req, res) => { canAdmin(req); expireQr();
  env(res, { orders: orders.filter((o) => o.Status === "PROCESSING").length, returns: returns.filter((r) => r.Status === "PENDING").length, messages: messages.filter((m) => m.To === null && !m.Read).length }); }));
api.get("/admin/dashboard", h((req, res) => { canAdmin(req); expireQr();
  const to = req.query.to ? new Date(String(req.query.to)) : now(); const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86_400_000);
  const inR = orders.filter((o) => o.CreatedAt >= from && o.CreatedAt <= to);
  const counts: Record<string, number> = { PROCESSING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 }; for (const o of inR) counts[o.Status]++;
  const refunds = returns.filter((r) => r.Status === "COMPLETED" && r.RequestType === "REFUND").reduce((s, r) => s + r.RefundAmount, 0);
  const top = new Map<string, Doc>(); for (const i of orderItems) { const o = inR.find((x) => String(x._id) === String(i.OrderID) && x.Status === "DELIVERED"); if (!o) continue;
    const t = top.get(String(i.ProductID)) ?? { productId: String(i.ProductID), name: i.ProductName, quantity: 0, revenue: 0 }; t.quantity += i.Quantity; t.revenue += i.Quantity * i.FixedUnitPrice; top.set(String(i.ProductID), t); }
  const daily = new Map<string, Doc>(); for (const o of inR.filter((x) => x.Status !== "CANCELLED")) { const d = new Date(o.CreatedAt.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    const x = daily.get(d) ?? { date: d, orders: 0, amount: 0 }; x.orders++; x.amount += o.TotalAmount; daily.set(d, x); }
  env(res, { range: { from, to }, revenue: inR.filter((o) => o.Status === "DELIVERED").reduce((s, o) => s + o.TotalAmount, 0) - refunds, ordersByStatus: counts, totalOrders: inR.length,
    newCustomers: users.filter((u) => u.Role === "customer" && u.CreatedAt >= from).length, totalProducts: activeProducts().length,
    lowStock: activeProducts().filter((p) => p.StockQuantity <= 5).map(toProductDto), topProducts: [...top.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    recentOrders: [...orders].sort((a, b) => b.CreatedAt - a.CreatedAt).slice(0, 10).map((o) => toOrderDto(withUser(o))), pendingReturns: returns.filter((r) => r.Status === "PENDING").length,
    unreadMessages: messages.filter((m) => m.To === null && !m.Read).length, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)) }); }));
api.get("/admin/products", h((req, res) => { canAdmin(req); let ds = [...products]; const q = String(req.query.q ?? "").toLowerCase();
  if (q) ds = ds.filter((p) => [p.Name, p.SKU, p.BrandName].join(" ").toLowerCase().includes(q)); if (req.query.status) ds = ds.filter((p) => p.IsActive === (req.query.status === "active"));
  env(res, ds.sort((a, b) => a.SKU.localeCompare(b.SKU)).map(toProductDto)); }));
const prodDoc = (b: Doc) => Object.fromEntries(Object.entries({ SKU: b.sku?.toUpperCase(), Name: b.name, BrandName: b.brand, Price: b.price, StockQuantity: b.stock, Concentration: b.concentration, Volume: b.volume,
  ScentFamily: b.family, TopNotes: b.topNotes, MiddleNotes: b.middleNotes, BaseNotes: b.baseNotes, Projection: b.projection, Longevity: b.longevity, Occasion: b.occasion, Description: b.description, ImageUrl: b.imageUrl, IsActive: b.isActive }).filter(([, v]) => v !== undefined));
api.post("/admin/products", h((req, res) => { canAdmin(req); if (products.some((p) => p.SKU === String(req.body.sku).toUpperCase() || p.Name === req.body.name)) throw new Loi("ERR-PRD-409-01");
  const p = { _id: oid(), SoldCount: 0, AvgRating: 0, ReviewCount: 0, GalleryUrls: [], CreatedAt: now(), IsActive: true, ...prodDoc(req.body) }; products.push(p); env(res, toProductDto(p), null, 201); }));
api.patch("/admin/products/:id", h((req, res) => { canAdmin(req); const p = byId(req.params.id); if (!p) throw new Loi("ERR-CAT-404-01"); Object.assign(p, prodDoc(req.body)); env(res, toProductDto(p)); }));
api.delete("/admin/products/:id", h((req, res) => { canAdmin(req); const p = byId(req.params.id); if (!p) throw new Loi("ERR-CAT-404-01"); p.IsActive = false; env(res, toProductDto(p)); }));
api.get("/admin/orders", h((req, res) => { canAdmin(req); expireQr(); let ds = [...orders].sort((a, b) => b.CreatedAt - a.CreatedAt).map(withUser);
  if (req.query.status) ds = ds.filter((o) => o.Status === req.query.status);
  const q = String(req.query.q ?? "").toLowerCase(); if (q) ds = ds.filter((o) => [o.OrderCode, o.RecipientName, o.Phone, o.UserID?.Email, o.UserID?.FullName].join(" ").toLowerCase().includes(q));
  const counts: Record<string, number> = {}; for (const o of orders) counts[o.Status] = (counts[o.Status] ?? 0) + 1;
  const page = Number(req.query.page) || 1, limit = Number(req.query.limit) || 20;
  env(res, ds.slice((page - 1) * limit, page * limit).map((o) => toOrderDto(o)), { page, limit, total: ds.length, counts }); }));
api.get("/admin/orders/:id", h((req, res) => { canAdmin(req); const o = orders.find((x) => String(x._id) === req.params.id); if (!o) throw new Loi("ERR-ORD-404-01");
  const r = returns.find((x) => String(x.OrderID) === String(o._id)); env(res, { ...toOrderDto(withUser(o), itemsOf(o)), returnRequest: r ? toReturnDto(r) : null }); }));
api.patch("/admin/orders/:id/status", h((req, res) => { canAdmin(req); const o = orders.find((x) => String(x._id) === req.params.id); if (!o) throw new Loi("ERR-ORD-404-01");
  const next = req.body.status as OrderStatus; if (!ADMIN_ORDER_TRANSITIONS[o.Status as OrderStatus].includes(next)) throw new Loi("ERR-ORD-409-03");
  if (next === "SHIPPING") { if (!req.body.trackingCode) throw new Loi("ERR-ORD-422-01"); if (o.PaymentMethod !== "COD" && o.PaymentStatus !== "PAID") throw new Loi("ERR-PAY-409-02"); o.TrackingCode = req.body.trackingCode; }
  if (next === "CANCELLED") cancel(o, "admin", req.body.note ?? "Quản trị viên hủy đơn");
  else { o.Status = next; if (next === "DELIVERED") { o.DeliveredAt = now(); if (o.PaymentMethod === "COD") o.PaymentStatus = "PAID"; } o.Timeline.push({ Status: next, At: now(), By: "admin", Note: req.body.note ?? null }); }
  env(res, toOrderDto(withUser(o), itemsOf(o))); }));
const retPop = (r: Doc) => ({ ...r, OrderID: orders.find((o) => String(o._id) === String(r.OrderID)), UserID: users.find((u) => String(u._id) === String(r.UserID)) });
api.get("/admin/returns", h((req, res) => { canAdmin(req); env(res, returns.filter((r) => !req.query.status || r.Status === req.query.status).sort((a, b) => b.CreatedAt - a.CreatedAt).map(retPop).map(toReturnDto)); }));
api.patch("/admin/returns/:id", h((req, res) => { const a = canAdmin(req); const r = returns.find((x) => String(x._id) === req.params.id); if (!r) throw new Loi("ERR-SYS-404-01");
  if (!RETURN_TRANSITIONS[r.Status as ReturnStatus].includes(req.body.status)) throw new Loi("ERR-RET-409-04");
  if (req.body.status === "REJECTED" && !req.body.adminResponse) throw new Loi("ERR-VAL-422-01", "Vui lòng nhập phản hồi khi từ chối.");
  r.Status = req.body.status; if (req.body.adminResponse) r.AdminResponse = req.body.adminResponse; if (r.Status !== "APPROVED") r.ResolvedAt = now();
  if (r.Status === "COMPLETED" && r.RequestType === "REFUND") { const o = orders.find((x) => String(x._id) === String(r.OrderID)); if (o) o.PaymentStatus = "REFUNDED"; }
  postMsg(a, { to: String(r.UserID), content: `Yêu cầu đổi trả của bạn ${({ APPROVED: "đã được duyệt", REJECTED: "đã bị từ chối", COMPLETED: "đã hoàn tất" } as Doc)[r.Status]}.` });
  env(res, toReturnDto(retPop(r))); }));
api.get("/admin/users", h((req, res) => { canAdmin(req); let ds = users.filter((u) => u.Role === "customer"); const q = String(req.query.q ?? "").toLowerCase();
  if (q) ds = ds.filter((u) => (u.FullName + u.Email).toLowerCase().includes(q)); if (req.query.status) ds = ds.filter((u) => u.Status === req.query.status);
  env(res, ds.map((u) => { const os = orders.filter((o) => String(o.UserID) === String(u._id)); return { ...toUserDto(u), hasScentProfile: Boolean(profileOf(u._id)), orderCount: os.length, totalSpent: os.filter((o) => o.Status === "DELIVERED").reduce((s, o) => s + o.TotalAmount, 0) }; })); }));
api.get("/admin/users/:id", h((req, res) => { canAdmin(req); const u = users.find((x) => String(x._id) === req.params.id); if (!u) throw new Loi("ERR-USR-404-01"); const p = profileOf(u._id);
  env(res, { ...toUserDto(u), scentProfile: p ? toProfileDto(p) : null, orders: orders.filter((o) => String(o.UserID) === String(u._id)).map((o) => toOrderDto(o)) }); }));
api.patch("/admin/users/:id/status", h((req, res) => { canAdmin(req); const u = users.find((x) => String(x._id) === req.params.id); if (!u) throw new Loi("ERR-USR-404-01");
  if (u.Role === "admin") throw new Loi("ERR-USR-409-01"); if (req.body.status === "Blocked" && !req.body.reason) throw new Loi("ERR-USR-422-01");
  u.Status = req.body.status; u.BlockReason = u.Status === "Blocked" ? req.body.reason : null; for (const [k, v] of sessions) if (v === String(u._id)) sessions.delete(k); env(res, toUserDto(u)); }));
api.get("/admin/recommendation-metrics", h((req, res) => { canAdmin(req);
  const off = offlineMetrics(activeProducts() as any, families.map((f) => ({ Name: f.Name, CorrelatedFamilies: f.CorrelatedFamilies })));
  env(res, { offline: off, online: { sampleSize: reviews.length, enoughSamples: reviews.length >= 5, avgMatchScoreRating: null, spearmanScoreVsRating: null, completedProfiles: profiles.length } }); }));

api.use((_req, _res, next) => next(new Loi("ERR-SYS-404-01")));
app.use("/api/v1", api);
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err instanceof Loi ? err : new Loi("ERR-SYS-500-01", (err as Error)?.message);
  res.status(ERRORS[e.code]?.http ?? 500).json({ success: false, data: null, error: { code: e.code, message: e.message, details: e.details ?? [] }, meta: null, timestamp: new Date().toISOString() });
});
const DIST = path.resolve(__dirname, "../../frontend/dist/scentory/browser");
app.use(express.static(DIST));
app.use((_req, res) => res.sendFile(path.join(DIST, "index.html")));

const server = http.createServer(app);
io = new Server(server, { cors: { origin: true, credentials: true } });
io.on("connection", (s) => { const sid = /(?:^|;\s*)gl_sid=([^;]+)/.exec(s.handshake.headers.cookie ?? "")?.[1]; const uid = sid ? sessions.get(sid) : undefined; const u = users.find((x) => String(x._id) === uid);
  if (!u) return; s.join(`uid:${u._id}`); if (u.Role === "admin") s.join("admins"); });
server.listen(PORT, () => console.log(`[gia-lap] http://localhost:${PORT}  (khách: nga@scentory.vn / Scentory123 · admin: admin@scentory.vn / Admin@12345 · OTP thử: 123456)`));
