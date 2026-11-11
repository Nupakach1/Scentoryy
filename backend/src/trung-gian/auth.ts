import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../cau-hinh/env";
import { User } from "../mo-hinh/User";
import { AppError } from "./error";

/** Payload JWT — vai trò CHỈ lấy từ đây (đã ký), không bao giờ từ body/query (BR-SEC-006). */
export interface JwtPayload {
  sub: string;
  role: "customer" | "admin";
  ver?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function readToken(req: Request): string | undefined {
  return (req.cookies?.token as string | undefined) || undefined;
}

/**
 * Bắt buộc đăng nhập (BR-SEC-003): JWT hợp lệ + tài khoản còn Active +
 * claim `ver` khớp TokenVersion (admin khóa/mở khóa → phiên cũ bị thu hồi).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) return next(new AppError("ERR-AUTH-401-02"));
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return next(new AppError("ERR-AUTH-401-02"));
  }
  User.findById(payload.sub)
    .select("Status TokenVersion Role")
    .lean()
    .then((u) => {
      if (!u || u.Status !== "Active" || (u.TokenVersion ?? 0) !== (payload.ver ?? 0)) {
        return next(new AppError("ERR-AUTH-401-02"));
      }
      req.user = { sub: payload.sub, role: u.Role, ver: payload.ver };
      next();
    })
    .catch(next);
}

/** Bắt buộc đúng vai trò — dùng sau requireAuth. */
export function requireRole(role: JwtPayload["role"]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) return next(new AppError("ERR-AUTH-403-01"));
    next();
  };
}

/** Xác thực tùy chọn: có cookie hợp lệ → gắn req.user, không thì coi là khách vãng lai. */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!readToken(req)) return next();
  requireAuth(req, res, (err?: unknown) => {
    if (err) req.user = undefined;
    next();
  });
}

export const adminOnly = [requireAuth, requireRole("admin")];
