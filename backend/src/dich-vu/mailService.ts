import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../cau-hinh/env";

/**
 * Mail service cho UC-AUTH-003 (khôi phục mật khẩu).
 *
 * Chiến lược gửi (theo yêu cầu chức năng):
 * - DEV / TEST  → luôn log OTP ra console (không cần SMTP).
 * - PRODUCTION  → nếu cấu hình đủ `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
 *   thì gửi thật qua SMTP; THIẾU hoặc gửi THẤT BẠI → fallback log console
 *   (như vậy luồng khôi phục không bao giờ bị chặn vì mail).
 *
 * Bảo mật: KHÔNG BAO GIỜ log `SMTP_PASS`; ở production đã gửi thành công
 * thì KHÔNG log nội dung OTP ra console.
 */

/** Cấu hình SMTP đã đầy đủ chưa? */
export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

/** Transporter tạo lười (chỉ cần khi gửi thật ở production). */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Gửi email OTP khôi phục mật khẩu.
 * @param email - Địa chỉ người nhận
 * @param otp   - OTP 6 chữ số (chỉ dùng để gửi — KHÔNG lưu/log ở production)
 */
export async function sendPasswordResetOtp(email: string, otp: string): Promise<void> {
  const subject = "Mã xác thực khôi phục mật khẩu — Scentory";
  const text = [
    `Xin chào,`,
    ``,
    `Mã xác thực khôi phục mật khẩu của bạn là: ${otp}`,
    `Mã có hiệu lực trong 3 phút và chỉ dùng một lần.`,
    `Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email — mật khẩu của bạn không thay đổi.`,
    ``,
    `Trân trọng,`,
    `Đội ngũ Scentory`,
  ].join("\n");

  // DEV / TEST hoặc thiếu cấu hình SMTP → log console.
  if (env.NODE_ENV !== "production" || !isSmtpConfigured()) {
    console.log(`[mailService][dev-fallback] OTP cho ${email}: ${otp}`);
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"Scentory" <${env.SMTP_USER}>`,
      to: email,
      subject,
      text,
    });
    // Đã gửi thật — chỉ log KHÔNG kèm nội dung OTP.
    console.log(`[mailService] Đã gửi email OTP tới ${email}`);
  } catch (err) {
    // Gửi thất bại → fallback console để khách vẫn khôi phục được ở môi trường thật.
    console.error("[mailService] Gửi email SMTP thất bại, fallback log console:", err);
    console.log(`[mailService][dev-fallback] OTP cho ${email}: ${otp}`);
  }
}
