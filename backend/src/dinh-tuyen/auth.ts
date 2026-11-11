/**
 * Xác thực — UC-AUTH-001 (đăng ký), UC-AUTH-002 (đăng nhập/đăng xuất),
 * UC-AUTH-003 (khôi phục mật khẩu OTP), UC-AUTH-004 (đăng nhập quản trị).
 * Quy tắc: BR-SEC-001..005, BR-ACC-001, BR-ACC-002.
 */
import { Router, type Request, type Response } from "express";
import type { HydratedDocument } from "mongoose";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../cau-hinh/env";
import {
  BCRYPT_COST,
  LOCK_AFTER_FAILURES,
  LOCK_DURATION_MS,
  OTP_MAX_PER_WINDOW,
  OTP_SEND_WINDOW_MS,
  RESET_TOKEN_TTL_S,
  SESSION_MAX_AGE_MS,
} from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { requireAuth } from "../trung-gian/auth";
import { User, type UserDoc } from "../mo-hinh/User";
import { ScentProfile } from "../mo-hinh/ScentProfile";
import { Cart } from "../mo-hinh/Cart";
import { PasswordResetOtp, OTP_TTL_MS, OTP_MAX_FAILED_ATTEMPTS } from "../mo-hinh/PasswordResetOtp";
import { isSmtpConfigured, sendPasswordResetOtp } from "../dich-vu/mailService";
import { toUserDto } from "../dich-vu/dto";
import { generateOtp, sha256 } from "../tien-ich/otp";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";
import { EMAIL_RE, PASSWORD_RE, PHONE_RE } from "../tien-ich/password";

export const authRouter = Router();

const FORGOT_MESSAGE = "Nếu email hợp lệ, mã xác thực đã được gửi. Vui lòng kiểm tra hộp thư.";
const email = z.string().trim().toLowerCase().max(150).regex(EMAIL_RE, "Email không hợp lệ");
const password = z.string().regex(PASSWORD_RE, "Mật khẩu dài 8–64 ký tự, gồm ít nhất 1 chữ cái và 1 chữ số");

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự").max(100),
    email,
    phoneNumber: z.string().trim().regex(PHONE_RE, "Số điện thoại 9–15 chữ số").optional().or(z.literal("").transform(() => undefined)),
    password: z.string(),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: "Vui lòng đồng ý điều khoản" }),
  })
  .superRefine((d, ctx) => {
    if (!PASSWORD_RE.test(d.password)) ctx.addIssue({ code: "custom", path: ["password"], message: "weak" });
    if (d.password !== d.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "mismatch" });
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Thiếu email").max(150),
  password: z.string().min(1, "Thiếu mật khẩu").max(64),
});

/** Kiểm tra body; lỗi mật khẩu → ERR-AUTH-422-01, lỗi khác → ERR-VAL-422-01. */
function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (r.success) return r.data;
  const details = r.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  if (r.error.issues.some((i) => ["password", "confirmPassword", "newPassword"].includes(String(i.path[0])) && ["weak", "mismatch"].includes(i.message))) {
    throw new AppError("ERR-AUTH-422-01", undefined, details);
  }
  throw new AppError("ERR-VAL-422-01", undefined, details);
}

/** BR-SEC-002 — thông báo chung cho mọi lỗi đăng nhập, khóa 15 phút sau 5 lần sai. */
async function authenticate(identifier: string, plain: string): Promise<HydratedDocument<UserDoc>> {
  const user = await User.findOne({ $or: [{ Email: identifier }, { PhoneNumber: identifier }] }).select("+PasswordHash");
  if (!user || user.Status === "Blocked") throw new AppError("ERR-AUTH-401-01");
  const now = new Date();
  if (user.LockedUntil && user.LockedUntil > now) throw new AppError("ERR-AUTH-401-01");
  if (user.LockedUntil && user.LockedUntil <= now) {
    user.FailedAttempts = 0;
    user.LockedUntil = null;
  }
  if (!(await bcrypt.compare(plain, user.PasswordHash))) {
    user.FailedAttempts = (user.FailedAttempts ?? 0) + 1;
    if (user.FailedAttempts >= LOCK_AFTER_FAILURES) user.LockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    await user.save();
    throw new AppError("ERR-AUTH-401-01");
  }
  user.FailedAttempts = 0;
  user.LockedUntil = null;
  await user.save();
  return user;
}

/** BR-SEC-003 — JWT (sub, role, ver) trong cookie httpOnly 24 giờ. */
function issueSession(user: HydratedDocument<UserDoc>, res: Response): void {
  const token = jwt.sign({ sub: String(user._id), role: user.Role, ver: user.TokenVersion ?? 0 }, env.JWT_SECRET, { expiresIn: "1d" });
  res.cookie("token", token, { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_MAX_AGE_MS });
}

// POST /api/v1/auth/register — FR-AUTH-REG-001
authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const d = parse(registerSchema, req.body);
    const dup = await User.findOne({ $or: [{ Email: d.email }, ...(d.phoneNumber ? [{ PhoneNumber: d.phoneNumber }] : [])] });
    if (dup) throw new AppError("ERR-AUTH-409-01");
    let user;
    try {
      user = await User.create({
        FullName: d.fullName,
        Email: d.email,
        PhoneNumber: d.phoneNumber ?? null,
        PasswordHash: await bcrypt.hash(d.password, BCRYPT_COST),
        Role: "customer",
        Status: "Active",
      });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new AppError("ERR-AUTH-409-01");
      throw e;
    }
    try {
      await ScentProfile.create({ UserID: user._id, IsCompleted: false });
      await Cart.create({ UserID: user._id });
    } catch (e) {
      await Promise.all([User.deleteOne({ _id: user._id }), ScentProfile.deleteOne({ UserID: user._id })]);
      throw e;
    }
    issueSession(user, res); // UC-AUTH-001: tự đăng nhập sau đăng ký
    created(res, toUserDto(user));
  })
);

// POST /api/v1/auth/login — FR-AUTH-LGN-001
authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const d = parse(loginSchema, req.body);
    const user = await authenticate(d.email, d.password);
    issueSession(user, res);
    ok(res, toUserDto(user));
  })
);

// POST /api/v1/auth/admin/sessions — FR-AUTH-ADM-001
authRouter.post(
  "/admin/sessions",
  asyncHandler(async (req, res) => {
    const d = parse(loginSchema, req.body);
    const user = await authenticate(d.email, d.password);
    if (user.Role !== "admin") throw new AppError("ERR-AUTH-403-02");
    issueSession(user, res);
    ok(res, toUserDto(user));
  })
);

// POST /api/v1/auth/logout — FR-AUTH-LGN-002
authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production" });
  ok(res, { loggedOut: true });
});

// GET /api/v1/auth/me
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.sub);
    if (!user) throw new AppError("ERR-AUTH-401-02");
    const profile = await ScentProfile.findOne({ UserID: user._id }, "IsCompleted").lean();
    ok(res, { ...toUserDto(user), hasScentProfile: Boolean(profile?.IsCompleted) });
  })
);

// PATCH /api/v1/auth/me — cập nhật họ tên, SĐT
authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const d = parse(
      z.object({ fullName: z.string().trim().min(2).max(100).optional(), phoneNumber: z.string().trim().regex(PHONE_RE).optional() }),
      req.body
    );
    const user = await User.findById(req.user!.sub);
    if (!user) throw new AppError("ERR-AUTH-401-02");
    if (d.fullName) user.FullName = d.fullName;
    if (d.phoneNumber) user.PhoneNumber = d.phoneNumber;
    try {
      await user.save();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new AppError("ERR-AUTH-409-01");
      throw e;
    }
    ok(res, toUserDto(user));
  })
);

// POST /api/v1/auth/password-resets — FR-AUTH-OTP-001 (BR-SEC-004)
authRouter.post(
  "/password-resets",
  asyncHandler(async (req, res) => {
    let demoOtp: string | null = null;
    const d = parse(z.object({ email }), req.body);
    const user = await User.findOne({ Email: d.email });
    if (user && user.Status === "Active") {
      const sent = await PasswordResetOtp.countDocuments({ Email: d.email, CreatedAt: { $gte: new Date(Date.now() - OTP_SEND_WINDOW_MS) } });
      if (sent >= OTP_MAX_PER_WINDOW) throw new AppError("ERR-AUTH-429-01");
      await PasswordResetOtp.updateMany({ Email: d.email, IsUsed: false }, { $set: { IsUsed: true } });
      const otp = generateOtp();
      if (!isSmtpConfigured()) demoOtp = otp; // chưa có SMTP (môi trường học tập) → trả mã để giao diện hiện hộp thoại OTP giả lập
      await PasswordResetOtp.create({
        Email: d.email,
        UserID: user._id,
        OtpHash: await bcrypt.hash(otp, BCRYPT_COST),
        ExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      });
      await sendPasswordResetOtp(d.email, otp);
    }
    ok(res, { message: FORGOT_MESSAGE, expiresInSeconds: OTP_TTL_MS / 1000, ...(demoOtp ? { demoOtp } : {}) }, null, 202);
  })
);

// POST /api/v1/auth/password-resets/verify — FR-AUTH-OTP-002
authRouter.post(
  "/password-resets/verify",
  asyncHandler(async (req, res) => {
    const d = parse(z.object({ email, otp: z.string().trim().regex(/^\d{6}$/, "Mã gồm 6 chữ số") }), req.body);
    const rec = await PasswordResetOtp.findOne({ Email: d.email, IsUsed: false }).select("+OtpHash").sort({ CreatedAt: -1 });
    if (!rec || rec.ExpiresAt.getTime() <= Date.now() || (rec.FailedAttempts ?? 0) >= OTP_MAX_FAILED_ATTEMPTS) {
      throw new AppError("ERR-AUTH-400-01");
    }
    const user = await User.findById(rec.UserID);
    if (!user || user.Status !== "Active") throw new AppError("ERR-AUTH-400-01");
    if (!(await bcrypt.compare(d.otp, rec.OtpHash))) {
      rec.FailedAttempts = (rec.FailedAttempts ?? 0) + 1;
      await rec.save();
      throw new AppError("ERR-AUTH-400-01");
    }
    const resetToken = jwt.sign({ sub: String(user._id), purpose: "password-reset" }, env.JWT_SECRET, { expiresIn: RESET_TOKEN_TTL_S });
    const consumed = await PasswordResetOtp.findOneAndUpdate(
      { _id: rec._id, IsUsed: false },
      { $set: { IsUsed: true, ResetTokenHash: sha256(resetToken), ResetTokenUsedAt: null } }
    );
    if (!consumed) throw new AppError("ERR-AUTH-400-01");
    ok(res, { resetToken, expiresInSeconds: RESET_TOKEN_TTL_S });
  })
);

// POST /api/v1/auth/password-resets/confirm — FR-AUTH-OTP-003
authRouter.post(
  "/password-resets/confirm",
  asyncHandler(async (req, res) => {
    const d = parse(
      z
        .object({ resetToken: z.string().min(1).max(2048), newPassword: z.string(), confirmPassword: z.string() })
        .superRefine((x, ctx) => {
          if (!PASSWORD_RE.test(x.newPassword)) ctx.addIssue({ code: "custom", path: ["newPassword"], message: "weak" });
          if (x.newPassword !== x.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "mismatch" });
        }),
      req.body
    );
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(d.resetToken, env.JWT_SECRET) as jwt.JwtPayload;
    } catch {
      throw new AppError("ERR-AUTH-400-02");
    }
    if (payload.purpose !== "password-reset" || typeof payload.sub !== "string") throw new AppError("ERR-AUTH-400-02");
    const rec = await PasswordResetOtp.findOne({ ResetTokenHash: sha256(d.resetToken) });
    if (!rec || rec.ResetTokenUsedAt) throw new AppError("ERR-AUTH-400-02");
    const user = await User.findById(payload.sub);
    if (!user || user.Status !== "Active") throw new AppError("ERR-AUTH-400-02");
    const consumed = await PasswordResetOtp.findOneAndUpdate({ _id: rec._id, ResetTokenUsedAt: null }, { $set: { ResetTokenUsedAt: new Date() } });
    if (!consumed) throw new AppError("ERR-AUTH-400-02");
    user.PasswordHash = await bcrypt.hash(d.newPassword, BCRYPT_COST);
    user.FailedAttempts = 0;
    user.LockedUntil = null;
    user.TokenVersion = (user.TokenVersion ?? 0) + 1;
    await user.save();
    ok(res, { message: "Mật khẩu đã được đặt lại thành công." });
  })
);

/** Dùng lại cho test. */
export { password as passwordSchema };
