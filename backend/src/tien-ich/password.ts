/**
 * Chính sách mật khẩu — thống nhất UC-AUTH-001 (đăng ký) & UC-AUTH-003 (khôi phục):
 * dài 8–64 ký tự, CÓ ít nhất 1 chữ cái VÀ 1 chữ số.
 */
export const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

/** Số điện thoại: 9–15 chữ số, có thể bắt đầu bằng '+'. */
export const PHONE_RE = /^\+?\d{9,15}$/;

/** Email format — kiểm tra TRƯỚC khi chạm DB (không dùng .email() để không phụ thuộc version zod). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ObjectId hex string (validate query param `with`). */
export const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Đúng chính sách mật khẩu? */
export function isValidPassword(password: string): boolean {
  return PASSWORD_RE.test(password);
}
