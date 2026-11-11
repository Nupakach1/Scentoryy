/**
 * Hằng số nghiệp vụ — mỗi hằng số gắn với một quy tắc BR trong
 * docs/scentory/srs/business-rules.md. Đổi quy tắc → đổi ở đây, không rải trong route.
 */

// BR-SEC-001 · BR-SEC-002 · BR-SEC-003 · BR-SEC-004 · BR-SEC-005
export const BCRYPT_COST = 12;
export const LOCK_AFTER_FAILURES = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const OTP_MAX_PER_WINDOW = 3;
export const RESET_TOKEN_TTL_S = 5 * 60;
export const AUTH_RATE_LIMIT_PER_MIN = 20;

// BR-ACC-003 · BR-ACC-004
export const MAX_ADDRESSES = 5;

// BR-CAT-001
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

// BR-CART-001
export const MAX_QTY_PER_LINE = 10;

// BR-PRIC-001
export const DELIVERY_METHODS = {
  STANDARD: { label: "Giao hàng tiêu chuẩn", fee: 0, eta: "2 – 4 ngày làm việc" },
  EXPRESS: { label: "Giao hỏa tốc nội thành 2h", fee: 50_000, eta: "Nhận trong ngày tại TP.HCM & Hà Nội" },
} as const;
export type DeliveryMethod = keyof typeof DELIVERY_METHODS;

// BR-PAY-001..003
export const PAYMENT_METHODS = ["COD", "QR", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const QR_PAYMENT_WINDOW_MS = 15 * 60 * 1000;

// BR-ORD-002..004 — máy trạng thái đơn hàng (docs/scentory/srs/states.md)
export const ORDER_STATUSES = ["PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PROCESSING: "Đang xử lý",
  SHIPPING: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  CANCELLED: "Đã hủy",
};
/** Ma trận chuyển dịch hợp lệ do Admin thực hiện (BR-ORD-003). */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PROCESSING: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};
export const CANCELLATION_REASONS = [
  "Tôi muốn thay đổi mùi hương khác / kích thước chai",
  "Tôi muốn thay đổi địa chỉ hoặc số điện thoại nhận hàng",
  "Tôi tìm thấy ưu đãi tốt hơn / đổi ý không muốn mua nữa",
  "Lý do khác",
] as const;

// BR-RET-001..003
export const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const RETURN_TYPES = ["EXCHANGE", "REFUND"] as const;
export const RETURN_STATUSES = ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
};
export const RETURN_REASONS = [
  "Sản phẩm bị lỗi / hư hỏng",
  "Không đúng sản phẩm đã đặt",
  "Không còn nhu cầu sử dụng",
  "Lý do khác",
] as const;
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = ["image/jpeg", "image/png", "video/mp4"] as const;

// BR-REV-001
export const REVIEW_TEXT_MAX = 500;
export const ACTUAL_PROJECTIONS = ["LOWER", "MATCH", "HIGHER"] as const;

// BR-MSG-001
export const MESSAGE_MAX_LENGTH = 1000;
export const MESSAGE_RATE_MAX = 10;
export const MESSAGE_RATE_WINDOW_MS = 10_000;

// BR-QUIZ-001
export const QUIZ_AGE_MIN = 16;
export const QUIZ_AGE_MAX = 80;

// BR-MTCH-005 — làm giàu hồ sơ từ hành vi
export const BEHAVIOR_SIGNAL_POINTS = {
  view: 1,
  click: 1,
  add_to_cart: 3,
  wishlist: 4,
  purchase: 5,
  review_good: 5,
  review_bad: -5,
} as const;
export const BEHAVIOR_RULES = {
  windowDays: 90,
  minSignals: 5,
  raiseThreshold: 10,
  raiseShare: 0.25,
  lowerThreshold: -5,
} as const;
export const INTERACTION_TYPES = ["view", "click", "wishlist", "add_to_cart", "purchase", "reviewed"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
