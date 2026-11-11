/**
 * npm run seed:demo -- --xac-nhan
 * XÓA dữ liệu giao dịch (đơn, giỏ, đánh giá, đổi trả, tin nhắn, hành vi, địa chỉ, wishlist) và
 * nạp bộ dữ liệu minh họa cho 3 khách hàng. CHỈ một người trong nhóm chạy (Atlas dùng chung).
 */
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { env } from "../cau-hinh/env";
import { BCRYPT_COST, DELIVERY_METHODS } from "../cau-hinh/nghiepVu";
import { connectDB } from "../csdl/connect";
import {
  Address, Cart, CartItem, Message, Order, OrderItem, Product, ReturnRequest, Review, ScentProfile, User,
  UserInteraction, Wishlist,
} from "../mo-hinh";
import { deriveProfile, type QuizAnswersInput } from "../dich-vu/quizMapping";
import { refreshProfileFromBehavior } from "../dich-vu/behavior";
import { seedAdmin, seedCatalog } from "./seed";

const DAY = 86_400_000;
const PASSWORD = "Scentory123";

const CUSTOMERS: Array<{ name: string; email: string; phone: string; quiz?: QuizAnswersInput }> = [
  { name: "Nguyễn Thanh Nga", email: "nga@scentory.vn", phone: "0901234567",
    quiz: { style: "feminine", includeUnisex: true, tone: "fresh_clean", mood: "day_energy", aura: "soft", habit: "daily_spritzer", age: 27 } },
  { name: "Trần Hoàng Long", email: "long@scentory.vn", phone: "0912345678" },
  { name: "Lê Minh Phương", email: "phuong@scentory.vn", phone: "0987654321",
    quiz: { style: "masculine", includeUnisex: false, tone: "warm_opulent", mood: "night_party", aura: "bold", habit: "scent_shifter", age: 31 } },
];

type Line = [sku: string, qty: number];
interface DemoOrder {
  email: string; daysAgo: number; status: "PROCESSING" | "SHIPPING" | "DELIVERED" | "CANCELLED";
  pay: "COD" | "QR" | "CARD"; delivery: "STANDARD" | "EXPRESS"; lines: Line[]; tracking?: string; cancel?: string; deliveredDaysAgo?: number;
}
const ORDERS: DemoOrder[] = [
  { email: "nga@scentory.vn", daysAgo: 4, status: "DELIVERED", pay: "CARD", delivery: "STANDARD", lines: [["BY-003", 1], ["DT-005", 1]], tracking: "GHN58201734", deliveredDaysAgo: 2 },
  { email: "nga@scentory.vn", daysAgo: 2, status: "SHIPPING", pay: "COD", delivery: "EXPRESS", lines: [["LL-004", 1]], tracking: "GHN58209911" },
  { email: "nga@scentory.vn", daysAgo: 0, status: "PROCESSING", pay: "COD", delivery: "STANDARD", lines: [["MM-003", 2]] },
  { email: "nga@scentory.vn", daysAgo: 12, status: "CANCELLED", pay: "QR", delivery: "STANDARD", lines: [["CR-001", 1]], cancel: "Quá hạn thanh toán QR 15 phút" },
  { email: "phuong@scentory.vn", daysAgo: 20, status: "DELIVERED", pay: "COD", delivery: "STANDARD", lines: [["LL-001", 1], ["DP-005", 1]], tracking: "GHTK7731025", deliveredDaysAgo: 17 },
  { email: "phuong@scentory.vn", daysAgo: 6, status: "DELIVERED", pay: "CARD", delivery: "EXPRESS", lines: [["DP-006", 1]], tracking: "GHN58100022", deliveredDaysAgo: 5 },
  { email: "long@scentory.vn", daysAgo: 1, status: "PROCESSING", pay: "CARD", delivery: "STANDARD", lines: [["BY-001", 1]] },
];

function code(d: Date, i: number) {
  return `SC-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${(4100 + i * 137) % 9000 + 1000}`;
}

async function main() {
  if (!process.argv.includes("--xac-nhan")) {
    console.error("Lệnh này XÓA dữ liệu giao dịch trên Atlas. Chạy lại kèm cờ: npm run seed:demo -- --xac-nhan");
    process.exit(1);
  }
  await connectDB(env.MONGODB_URI);
  await seedCatalog();
  await seedAdmin();
  await Promise.all([Order, OrderItem, Review, ReturnRequest, Message, UserInteraction, Address, Wishlist, CartItem].map((m) => (m as typeof Order).deleteMany({})));
  const demoEmails = CUSTOMERS.map((c) => c.email);
  const old = await User.find({ Email: { $in: demoEmails } }, "_id").lean();
  await Promise.all([User.deleteMany({ _id: { $in: old.map((o) => o._id) } }), ScentProfile.deleteMany({ UserID: { $in: old.map((o) => o._id) } }), Cart.deleteMany({ UserID: { $in: old.map((o) => o._id) } })]);

  const hash = await bcrypt.hash(PASSWORD, BCRYPT_COST);
  const users = new Map<string, Types.ObjectId>();
  for (const [i, c] of CUSTOMERS.entries()) {
    const u = await User.create({ FullName: c.name, Email: c.email, PhoneNumber: c.phone, PasswordHash: hash, Role: "customer", Status: "Active", CreatedAt: new Date(Date.now() - (40 - i * 10) * DAY) });
    users.set(c.email, u._id);
    await Cart.create({ UserID: u._id });
    if (c.quiz) {
      const d = deriveProfile(c.quiz);
      await ScentProfile.create({
        UserID: u._id, IsCompleted: true, ProfileTitle: d.profileTitle, PreferredFamilies: d.preferredFamilies.join(", "), FamilyRatings: d.familyRatings,
        PreferredProjection: d.preferredProjection, ExpectedOccasion: d.expectedOccasion, PreferredVolume: d.preferredVolume,
        QuizAnswers: { Style: c.quiz.style, IncludeUnisex: c.quiz.includeUnisex, Tone: c.quiz.tone, Mood: c.quiz.mood, Aura: c.quiz.aura, Habit: c.quiz.habit, Age: c.quiz.age },
      });
    } else {
      await ScentProfile.create({ UserID: u._id, IsCompleted: false });
    }
    await Address.create({ UserID: u._id, Label: "Nhà riêng", RecipientName: c.name, Phone: c.phone, AddressLine: ["12 Lý Tự Trọng", "45 Tràng Tiền", "88 Nguyễn Huệ"][i], Ward: ["Bến Nghé", "Tràng Tiền", "Bến Nghé"][i], District: ["Quận 1", "Hoàn Kiếm", "Quận 1"][i], City: ["TP. Hồ Chí Minh", "Hà Nội", "TP. Hồ Chí Minh"][i], IsDefault: true });
  }
  await Address.create({ UserID: users.get("nga@scentory.vn"), Label: "Văn phòng", RecipientName: "Nguyễn Thanh Nga", Phone: "0901234567", AddressLine: "Tầng 9, 2 Hải Triều", Ward: "Bến Nghé", District: "Quận 1", City: "TP. Hồ Chí Minh", IsDefault: false });

  const products = new Map((await Product.find({}).lean()).map((p) => [p.SKU as string, p]));
  const orderIds: Types.ObjectId[] = [];
  for (const [i, o] of ORDERS.entries()) {
    const uid = users.get(o.email)!;
    const created = new Date(Date.now() - o.daysAgo * DAY - 3600_000);
    const lines = o.lines.map(([sku, qty]) => ({ p: products.get(sku)!, qty }));
    const subtotal = lines.reduce((s, l) => s + l.p.Price * l.qty, 0);
    const fee = DELIVERY_METHODS[o.delivery].fee;
    const addr = await Address.findOne({ UserID: uid, IsDefault: true }).lean();
    const timeline: Array<{ Status: string; At: Date; By: "customer" | "admin" | "system"; Note?: string | null }> = [{ Status: "PROCESSING", At: created, By: "customer", Note: "Đặt hàng thành công" }];
    if (o.status === "SHIPPING" || o.status === "DELIVERED") timeline.push({ Status: "SHIPPING", At: new Date(created.getTime() + 20 * 3600_000), By: "admin", Note: `Mã vận đơn ${o.tracking}` });
    if (o.status === "DELIVERED") timeline.push({ Status: "DELIVERED", At: new Date(Date.now() - (o.deliveredDaysAgo ?? 0) * DAY), By: "admin", Note: null });
    if (o.status === "CANCELLED") timeline.push({ Status: "CANCELLED", At: new Date(created.getTime() + 16 * 60_000), By: "system", Note: o.cancel ?? null });
    const paid = o.pay === "CARD" || o.status === "DELIVERED";
    const order = await Order.create({
      OrderCode: code(created, i), UserID: uid, RecipientName: addr!.RecipientName, Phone: addr!.Phone,
      ShippingAddress: [addr!.AddressLine, addr!.Ward, addr!.District, addr!.City].join(", "), DeliveryMethod: o.delivery,
      Subtotal: subtotal, ShippingFee: fee, DiscountAmount: 0, TotalAmount: subtotal + fee, PaymentMethod: o.pay,
      PaymentStatus: o.status === "CANCELLED" ? "FAILED" : paid ? "PAID" : "PENDING", PaidAt: paid ? created : null,
      CardLast4: o.pay === "CARD" ? "1111" : null, Status: o.status, TrackingCode: o.tracking ?? null, CancelReason: o.cancel ?? null,
      CancelledBy: o.status === "CANCELLED" ? "system" : null, Timeline: timeline, StockDeducted: o.status !== "CANCELLED",
      DeliveredAt: o.status === "DELIVERED" ? new Date(Date.now() - (o.deliveredDaysAgo ?? 0) * DAY) : null, CreatedAt: created,
      PaymentExpiresAt: o.pay === "QR" ? new Date(created.getTime() + 15 * 60_000) : null,
    });
    orderIds.push(order._id);
    await OrderItem.insertMany(lines.map((l) => ({ OrderID: order._id, ProductID: l.p._id, ProductName: l.p.Name, Quantity: l.qty, FixedUnitPrice: l.p.Price })));
    for (const l of lines) await UserInteraction.create({ UserID: uid, ProductID: l.p._id, ActionType: "purchase", Timestamp: created });
  }

  // Đánh giá cho đơn đã giao
  const nga = users.get("nga@scentory.vn")!, phuong = users.get("phuong@scentory.vn")!;
  const rv = [
    { u: nga, o: orderIds[0], sku: "BY-003", r: 5, t: "Blanche sạch và mềm như vải mới giặt, đúng gu đi làm của mình.", pr: "MATCH", m: 5 },
    { u: phuong, o: orderIds[4], sku: "LL-001", r: 5, t: "Santal 33 ấm, lưu hương cả ngày, đúng gợi ý của Scent Match.", pr: "HIGHER", m: 5 },
    { u: phuong, o: orderIds[4], sku: "DP-005", r: 4, t: "Ambre Nuit sang nhưng hơi nồng với thời tiết Sài Gòn buổi trưa.", pr: "MATCH", m: 4 },
    { u: phuong, o: orderIds[5], sku: "DP-006", r: 4, t: "Cuir Cannage da thuộc mềm, hợp đi tiệc.", pr: "MATCH", m: 4 },
    { u: nga, o: orderIds[0], sku: "DT-005", r: 4, t: "Eau Rose dịu, hơi nhanh bay.", pr: "LOWER", m: 4 },
  ] as const;
  for (const x of rv) {
    const p = products.get(x.sku)!;
    await Review.create({ UserID: x.u, OrderID: x.o, ProductID: p._id, OverallRating: x.r, ReviewText: x.t, ActualProjection: x.pr, MatchScoreRating: x.m, CreatedAt: new Date(Date.now() - DAY) });
  }
  for (const sku of new Set(rv.map((x) => x.sku))) {
    const list = rv.filter((x) => x.sku === sku);
    await Product.updateOne({ SKU: sku }, { $set: { AvgRating: Math.round((list.reduce((s, x) => s + x.r, 0) / list.length) * 10) / 10, ReviewCount: list.length } });
  }
  // Yêu cầu đổi trả đang chờ (đơn giao cách đây 5 ngày)
  const cr = products.get("DP-006")!;
  await ReturnRequest.create({ OrderID: orderIds[5], UserID: phuong, RequestType: "EXCHANGE", Items: [{ ProductID: cr._id, Quantity: 1 }], Reason: "Sản phẩm bị lỗi / hư hỏng", Description: "Vòi xịt bị kẹt sau 2 ngày sử dụng.", EvidenceUrl: "/hinh-anh/san-pham/dp-006.webp", IsIntactSeal: false, RefundAmount: 0, Status: "PENDING", CreatedAt: new Date(Date.now() - DAY) });
  // Wishlist, hành vi, giỏ
  for (const sku of ["LL-002", "DT-004", "MM-001"]) {
    await Wishlist.create({ UserID: nga, ProductID: products.get(sku)!._id });
    await UserInteraction.create({ UserID: nga, ProductID: products.get(sku)!._id, ActionType: "wishlist" });
  }
  for (const sku of ["BY-004", "BY-003", "DT-001", "DT-005", "LL-002", "DT-004"]) await UserInteraction.create({ UserID: nga, ProductID: products.get(sku)!._id, ActionType: "view" });
  const ngaCart = await Cart.findOne({ UserID: nga });
  await CartItem.create({ CartID: ngaCart!._id, ProductID: products.get("DT-004")!._id, Quantity: 1 });
  // Tin nhắn
  const admin = await User.findOne({ Role: "admin" });
  await Message.create({ From: nga, To: null, Content: "Chào shop, đơn Rose 31 của mình khi nào giao tới ạ?", OrderID: orderIds[1], CreatedAt: new Date(Date.now() - 3 * 3600_000) });
  await Message.create({ From: admin!._id, To: nga, Content: "Chào chị Nga, đơn đã bàn giao cho GHN, dự kiến giao trong hôm nay ạ.", OrderID: orderIds[1], Read: true, CreatedAt: new Date(Date.now() - 2 * 3600_000) });
  await Message.create({ From: phuong, To: null, Content: "Mình đã gửi yêu cầu đổi Cuir Cannage vì vòi xịt bị kẹt, shop kiểm tra giúp mình.", CreatedAt: new Date(Date.now() - 3600_000) });
  for (const uid of [nga, phuong]) await refreshProfileFromBehavior(String(uid));
  console.log(`Đã nạp dữ liệu minh họa: 3 khách hàng (mật khẩu ${PASSWORD}), ${ORDERS.length} đơn, ${rv.length} đánh giá, 1 yêu cầu đổi trả, 3 tin nhắn.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Nạp dữ liệu minh họa thất bại:", e);
    process.exit(1);
  });
