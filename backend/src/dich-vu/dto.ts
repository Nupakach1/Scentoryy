/**
 * Chuyển tài liệu MongoDB (PascalCase) → DTO JSON camelCase của API (docs/scentory/api/api-spec.md).
 * Không bao giờ để lộ trường nhạy cảm (PasswordHash, OtpHash…).
 */
import { ORDER_STATUS_LABELS, type OrderStatus } from "../cau-hinh/nghiepVu";

type AnyDoc = Record<string, unknown> & { _id?: unknown };
const id = (v: unknown) => (v == null ? null : String(v));
const plain = (d: unknown): AnyDoc => {
  if (d && typeof (d as { toObject?: unknown }).toObject === "function") return (d as { toObject: () => AnyDoc }).toObject();
  return (d ?? {}) as AnyDoc;
};
const mapToObj = (m: unknown) => (m instanceof Map ? Object.fromEntries(m) : (m as Record<string, number>) ?? null);

export function toUserDto(d: unknown) {
  const u = plain(d);
  return {
    id: id(u._id),
    fullName: u.FullName,
    email: u.Email,
    phoneNumber: u.PhoneNumber ?? null,
    role: u.Role,
    status: u.Status,
    blockReason: u.BlockReason ?? null,
    createdAt: u.CreatedAt,
  };
}

export function toProductDto(d: unknown) {
  const p = plain(d);
  return {
    id: id(p._id),
    sku: p.SKU ?? null,
    name: p.Name,
    brand: p.BrandName,
    price: p.Price,
    stock: p.StockQuantity,
    concentration: p.Concentration,
    volume: p.Volume ?? 50,
    family: p.ScentFamily,
    topNotes: p.TopNotes,
    middleNotes: p.MiddleNotes,
    baseNotes: p.BaseNotes,
    projection: p.Projection,
    longevity: p.Longevity,
    occasion: p.Occasion,
    description: p.Description ?? null,
    imageUrl: p.ImageUrl ?? null,
    galleryUrls: p.GalleryUrls ?? [],
    soldCount: p.SoldCount ?? 0,
    avgRating: p.AvgRating ?? 0,
    reviewCount: p.ReviewCount ?? 0,
    isActive: p.IsActive,
    createdAt: p.CreatedAt,
  };
}

export function toProfileDto(d: unknown) {
  const p = plain(d);
  const qa = (p.QuizAnswers ?? null) as Record<string, unknown> | null;
  return {
    id: id(p._id),
    isCompleted: Boolean(p.IsCompleted),
    profileTitle: p.ProfileTitle ?? null,
    preferredFamilies: p.PreferredFamilies ? String(p.PreferredFamilies).split(",").map((s) => s.trim()).filter(Boolean) : [],
    familyRatings: mapToObj(p.FamilyRatings),
    preferredProjection: p.PreferredProjection ?? null,
    expectedOccasion: p.ExpectedOccasion ?? null,
    preferredVolume: p.PreferredVolume ?? null,
    budgetRange: p.BudgetRange ?? null,
    behaviorAdjustments: mapToObj(p.BehaviorAdjustments),
    quizAnswers: qa
      ? { style: qa.Style, includeUnisex: qa.IncludeUnisex, tone: qa.Tone, mood: qa.Mood, aura: qa.Aura, habit: qa.Habit, age: qa.Age }
      : null,
    updatedAt: p.UpdatedAt,
  };
}

export function toOrderItemDto(d: unknown) {
  const i = plain(d);
  const prod = i.ProductID && typeof i.ProductID === "object" && "Name" in (i.ProductID as object) ? toProductDto(i.ProductID) : null;
  return {
    id: id(i._id),
    productId: prod ? prod.id : id(i.ProductID),
    productName: i.ProductName,
    quantity: i.Quantity,
    unitPrice: i.FixedUnitPrice,
    lineTotal: Number(i.FixedUnitPrice) * Number(i.Quantity),
    product: prod,
  };
}

export function toOrderDto(d: unknown, items?: unknown[]) {
  const o = plain(d);
  const user = o.UserID && typeof o.UserID === "object" && "FullName" in (o.UserID as object) ? (o.UserID as AnyDoc) : null;
  return {
    id: id(o._id),
    orderCode: o.OrderCode,
    userId: user ? id(user._id) : id(o.UserID),
    customer: user ? { id: id(user._id), fullName: user.FullName, email: user.Email } : undefined,
    recipientName: o.RecipientName,
    phone: o.Phone,
    shippingAddress: o.ShippingAddress,
    deliveryMethod: o.DeliveryMethod,
    subtotal: o.Subtotal,
    shippingFee: o.ShippingFee,
    discountAmount: o.DiscountAmount,
    totalAmount: o.TotalAmount,
    voucherCode: o.VoucherCode ?? null,
    paymentMethod: o.PaymentMethod,
    paymentStatus: o.PaymentStatus,
    paymentExpiresAt: o.PaymentExpiresAt ?? null,
    paidAt: o.PaidAt ?? null,
    cardLast4: o.CardLast4 ?? null,
    status: o.Status,
    statusLabel: ORDER_STATUS_LABELS[o.Status as OrderStatus],
    trackingCode: o.TrackingCode ?? null,
    orderNote: o.OrderNote ?? null,
    cancelReason: o.CancelReason ?? null,
    cancelledBy: o.CancelledBy ?? null,
    timeline: ((o.Timeline as AnyDoc[]) ?? []).map((t) => ({ status: t.Status, at: t.At, by: t.By, note: t.Note ?? null })),
    deliveredAt: o.DeliveredAt ?? null,
    createdAt: o.CreatedAt,
    ...(items ? { items: items.map(toOrderItemDto) } : {}),
  };
}

export function toAddressDto(d: unknown) {
  const a = plain(d);
  return {
    id: id(a._id),
    label: a.Label,
    fullName: a.RecipientName,
    phone: a.Phone,
    address: a.AddressLine,
    ward: a.Ward,
    district: a.District,
    city: a.City,
    isDefault: a.IsDefault,
  };
}

export function toReviewDto(d: unknown) {
  const r = plain(d);
  const user = r.UserID && typeof r.UserID === "object" && "FullName" in (r.UserID as object) ? (r.UserID as AnyDoc) : null;
  return {
    id: id(r._id),
    productId: id(r.ProductID),
    orderId: id(r.OrderID),
    author: user ? String(user.FullName) : null,
    overallRating: r.OverallRating,
    reviewText: r.ReviewText ?? null,
    actualProjection: r.ActualProjection,
    matchScoreRating: r.MatchScoreRating ?? null,
    imageUrl: r.ImageUrl ?? null,
    createdAt: r.CreatedAt,
  };
}

export function toReturnDto(d: unknown) {
  const r = plain(d);
  const order = r.OrderID && typeof r.OrderID === "object" && "OrderCode" in (r.OrderID as object) ? (r.OrderID as AnyDoc) : null;
  const user = r.UserID && typeof r.UserID === "object" && "FullName" in (r.UserID as object) ? (r.UserID as AnyDoc) : null;
  return {
    id: id(r._id),
    orderId: order ? id(order._id) : id(r.OrderID),
    orderCode: order ? order.OrderCode : undefined,
    customer: user ? { id: id(user._id), fullName: user.FullName, email: user.Email } : undefined,
    requestType: r.RequestType,
    items: ((r.Items as AnyDoc[]) ?? []).map((i) => ({ productId: id(i.ProductID), quantity: i.Quantity })),
    reason: r.Reason,
    description: r.Description ?? null,
    evidenceUrl: r.EvidenceUrl,
    isIntactSeal: r.IsIntactSeal,
    refundAmount: r.RefundAmount ?? 0,
    status: r.Status,
    adminResponse: r.AdminResponse ?? null,
    createdAt: r.CreatedAt,
    resolvedAt: r.ResolvedAt ?? null,
  };
}

export function toMessageDto(d: unknown) {
  const m = plain(d);
  return {
    id: id(m._id),
    from: id(m.From),
    to: id(m.To),
    content: m.Content,
    orderId: id(m.OrderID),
    read: Boolean(m.Read),
    createdAt: m.CreatedAt,
  };
}
