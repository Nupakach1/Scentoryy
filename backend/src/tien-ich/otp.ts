import { createHash, randomInt } from "node:crypto";

/**
 * Sinh OTP 6 chữ số ngẫu nhiên an toàn (UC-AUTH-003).
 * Dùng `crypto.randomInt` — không thiên lệch như `Math.random`,
 * luôn đủ 6 chữ số (000000–999999).
 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Băm SHA-256 (hex) — dùng cho `ResetTokenHash` trong `PasswordResetOtps`:
 * lưu HASH của JWT one-time, không lưu token gốc (không lộ token trong DB).
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
