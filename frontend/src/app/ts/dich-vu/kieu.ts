/** Kiểu dữ liệu DTO của API /api/v1 (docs/scentory/api/api-spec.md). */
export interface PhanHoi<T> { success: boolean; data: T; error: LoiApi | null; meta: Record<string, any> | null; timestamp: string }
export interface LoiApi { code: string; message: string; details?: Array<{ field: string; message: string }> }

export interface NguoiDung { id: string; fullName: string; email: string; phoneNumber: string | null; role: 'customer' | 'admin'; status: string; hasScentProfile?: boolean; createdAt?: string; blockReason?: string | null }

export interface SanPham {
  id: string; sku: string; name: string; brand: string; price: number; stock: number; concentration: string; volume: number;
  family: string; topNotes: string; middleNotes: string; baseNotes: string; projection: string; longevity: string; occasion: string;
  description: string | null; imageUrl: string | null; galleryUrls: string[]; soldCount: number; avgRating: number; reviewCount: number; isActive: boolean;
  related?: SanPham[];
}
export interface TieuChi { key: string; label: string; weight: number; appliedWeight: number; score: number | null; contribution: number; reason: string }
export interface KetQuaMatch { product: SanPham; matchScore: number; appliedWeight: number; breakdown: TieuChi[] }

export interface HoSo {
  isCompleted: boolean; profileTitle: string | null; lede?: string | null; preferredFamilies: string[]; familyRatings: Record<string, number> | null;
  preferredProjection: string | null; expectedOccasion: string | null; preferredVolume: string | null; saved?: boolean;
  quizAnswers?: CauTraLoiQuiz | null;
}
export interface CauTraLoiQuiz { style: string; includeUnisex: boolean; tone: string; mood: string; aura: string; habit: string; age: number }

export interface DongGio { id: string; product: SanPham; quantity: number; lineTotal: number; maxQuantity: number }
export interface GioHang { items: DongGio[]; itemCount: number; subtotal: number }

export interface DongDon { id: string; productId: string; productName: string; quantity: number; unitPrice: number; lineTotal: number; product: SanPham | null }
export interface DonHang {
  id: string; orderCode: string; recipientName: string; phone: string; shippingAddress: string; deliveryMethod: 'STANDARD' | 'EXPRESS';
  subtotal: number; shippingFee: number; discountAmount: number; totalAmount: number; voucherCode: string | null;
  paymentMethod: 'COD' | 'QR' | 'CARD'; paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; paymentExpiresAt: string | null; cardLast4: string | null;
  status: 'PROCESSING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'; statusLabel: string; trackingCode: string | null; orderNote: string | null;
  cancelReason: string | null; timeline: Array<{ status: string; at: string; by: string; note: string | null }>; deliveredAt: string | null; createdAt: string;
  items?: DongDon[]; returnRequest?: YeuCauDoiTra | null; reviews?: DanhGia[]; customer?: { id: string; fullName: string; email: string };
}
export interface YeuCauDoiTra { id: string; orderId: string; orderCode?: string; requestType: string; items: Array<{ productId: string; quantity: number }>; reason: string; description: string | null; evidenceUrl: string; isIntactSeal: boolean; refundAmount: number; status: string; adminResponse: string | null; createdAt: string; customer?: { fullName: string; email: string } }
export interface DanhGia { id: string; productId: string; orderId: string; author: string | null; overallRating: number; reviewText: string | null; actualProjection: string; matchScoreRating: number | null; createdAt: string }
export interface DiaChi { id: string; label: string; fullName: string; phone: string; address: string; ward: string; district: string; city: string; isDefault: boolean }
export interface ThuongHieu { id: string; name: string; slug: string; description: string; origin: string; style: string; imageUrl: string; productCount?: number; minPrice?: number; products?: SanPham[] }
export interface NhomHuong { id: string; name: string; nameVi: string; description: string; keyNotes: string; vibe: string; imageUrl: string; productCount: number; soldCount: number; correlated: string[] }
export interface TinNhan { id: string; from: string; to: string | null; content: string; orderId: string | null; read: boolean; createdAt: string }

export const NHAN_TRANG_THAI: Record<string, string> = { PROCESSING: 'Đang xử lý', SHIPPING: 'Đang giao hàng', DELIVERED: 'Đã giao hàng', CANCELLED: 'Đã hủy' };
export const NHAN_THANH_TOAN: Record<string, string> = { PENDING: 'Chờ thanh toán', PAID: 'Đã thanh toán', FAILED: 'Thất bại', REFUNDED: 'Đã hoàn tiền' };
export const NHAN_PHUONG_THUC: Record<string, string> = { COD: 'Thanh toán khi nhận hàng (COD)', QR: 'Chuyển khoản QR (VietQR / Napas 247)', CARD: 'Thẻ quốc tế (Visa / Mastercard)' };
export const NHAN_DOI_TRA: Record<string, string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', COMPLETED: 'Hoàn tất' };
