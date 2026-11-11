import { Schema, model, type Types } from "mongoose";

/** Thời hạn OTP theo UC-AUTH-003: 3 phút, tối đa 5 lần nhập sai. */
export const OTP_TTL_MS = 3 * 60 * 1000;
export const OTP_MAX_FAILED_ATTEMPTS = 5;

/**
 * OTP khôi phục mật khẩu — collection `PasswordResetOtps` (UC-AUTH-003).
 *
 * Bảng bổ sung (báo cáo không có) — cùng quy ước PascalCase:
 * - Mã 6 chữ số, hiệu lực 3 phút (`ExpiresAt = CreatedAt + 3 phút`);
 * - Mỗi email tối đa 3 mã trong 60 phút; **mã mới vô hiệu mã trước**
 *   (đánh dấu mọi OTP chưa dùng của email là `IsUsed = true` khi tạo mã mới);
 * - Tối đa 5 lần nhập sai → mã bị vô hiệu (`FailedAttempts` đạt ngưỡng);
 * - Lưu dạng BĂM (`OtpHash`, `select: false`) — không bao giờ log/trả hash;
 * - Tài khoản Blocked không nhận OTP (kiểm tra Status ở service).
 *
 * Phiên đặt lại mật khẩu 5 phút sau khi OTP hợp lệ dùng JWT one-time
 * (claim `purpose: "password-reset"`) — KHÔNG cần collection riêng:
 * lưu SHA-256 của JWT vào `ResetTokenHash` (không lưu token gốc),
 * `ResetTokenUsedAt` != null → phiên đã tiêu thụ, không dùng lại được.
 */
export interface PasswordResetOtpDoc {
  Email: string;
  UserID: Types.ObjectId;
  OtpHash: string;
  ExpiresAt: Date;
  IsUsed: boolean;
  FailedAttempts: number;
  /** SHA-256 của ResetToken (JWT one-time, TTL 5 phút) — null khi chưa verify OTP. */
  ResetTokenHash: string | null;
  /** Thời điểm phiên đặt lại bị tiêu thụ (dùng một lần). */
  ResetTokenUsedAt: Date | null;
  CreatedAt: Date;
}

const PasswordResetOtpSchema = new Schema<PasswordResetOtpDoc>(
  {
    Email: { type: String, required: true, lowercase: true, trim: true, maxlength: 150 },
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    OtpHash: { type: String, required: true, select: false }, // không trả ra API
    ExpiresAt: { type: Date, required: true },
    IsUsed: { type: Boolean, default: false },
    FailedAttempts: { type: Number, default: 0, min: 0, max: OTP_MAX_FAILED_ATTEMPTS },
    ResetTokenHash: { type: String, default: null, select: false }, // không trả ra API
    ResetTokenUsedAt: { type: Date, default: null },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "PasswordResetOtps", timestamps: false }
);

// Tạo mã mới: đếm 3 mã/60 phút + tìm mã hiện hành của email
PasswordResetOtpSchema.index({ Email: 1, CreatedAt: -1 });
// Kiểm tra mã khi khách nhập OTP (còn hạn / chưa dùng / chưa quá 5 lần sai)
PasswordResetOtpSchema.index({ Email: 1, IsUsed: 1, ExpiresAt: 1 });
// Tra cứu phiên đặt lại theo hash JWT khi reset-password (unique + partial vì null phổ biến)
PasswordResetOtpSchema.index(
  { ResetTokenHash: 1 },
  { unique: true, partialFilterExpression: { ResetTokenHash: { $type: "string" } } }
);

export const PasswordResetOtp = model<PasswordResetOtpDoc>(
  "PasswordResetOtp",
  PasswordResetOtpSchema,
  "PasswordResetOtps"
);

/** Kiểu ObjectId tiện dụng khi populate / query. */
export type PasswordResetOtpId = Types.ObjectId;
