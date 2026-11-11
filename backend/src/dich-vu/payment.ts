/**
 * Thanh toán mô phỏng — BR-PAY-001..003, BR-PROMO-001, BR-PRIC-001.
 * Hàm thuần, không truy cập CSDL.
 */
import { DELIVERY_METHODS, type DeliveryMethod } from "../cau-hinh/nghiepVu";

/** Thuật toán Luhn cho số thẻ (BR-PAY-003). */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\s+/g, "");
  if (!/^\d{16}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export interface CardInput { number: string; holder: string; expiry: string; cvv: string }

/** Kiểm tra thẻ mô phỏng; trả về 4 số cuối khi hợp lệ, null khi sai. */
export function validateCard(card: CardInput, now = new Date()): string | null {
  if (!card || !luhnValid(card.number)) return null;
  if (!/^\d{3}$/.test(card.cvv ?? "")) return null;
  if (!card.holder || !card.holder.trim()) return null;
  const m = /^(\d{2})\/(\d{2})$/.exec(card.expiry ?? "");
  if (!m) return null;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return null;
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  if (endOfMonth < now) return null;
  return card.number.replace(/\s+/g, "").slice(-4);
}

export interface VoucherLike {
  Code: string;
  DiscountType: "PERCENT" | "FIXED" | "SHIPPING";
  DiscountValue: number;
  MinOrderAmount: number;
  MaxDiscountAmount?: number | null;
  UsageLimit?: number | null;
  UsedCount: number;
  StartAt: Date;
  EndAt: Date;
  IsActive: boolean;
}

/** Số tiền giảm của voucher, hoặc null nếu không đủ điều kiện (BR-PROMO-001). */
export function voucherDiscount(v: VoucherLike | null, subtotal: number, shippingFee: number, now = new Date()): number | null {
  if (!v || !v.IsActive) return null;
  if (v.StartAt > now || v.EndAt < now) return null;
  if (v.UsageLimit != null && v.UsedCount >= v.UsageLimit) return null;
  if (subtotal < (v.MinOrderAmount ?? 0)) return null;
  let amount: number;
  if (v.DiscountType === "PERCENT") {
    amount = Math.round((subtotal * v.DiscountValue) / 100);
    if (v.MaxDiscountAmount != null) amount = Math.min(amount, v.MaxDiscountAmount);
  } else if (v.DiscountType === "FIXED") {
    amount = v.DiscountValue;
  } else {
    if (shippingFee <= 0) return null;
    amount = Math.min(shippingFee, v.DiscountValue);
  }
  return Math.min(amount, subtotal + shippingFee);
}

/** Tổng tiền đơn (BR-PRIC-001). */
export function orderTotals(subtotal: number, delivery: DeliveryMethod, discount: number) {
  const shippingFee = DELIVERY_METHODS[delivery].fee;
  const totalAmount = Math.max(0, subtotal + shippingFee - discount);
  return { subtotal, shippingFee, discountAmount: discount, totalAmount };
}

/** Mã đơn SC-YYMMDD-XXXX (BR-ORD-001). */
export function generateOrderCode(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `SC-${yy}${mm}${dd}-${rnd}`;
}
