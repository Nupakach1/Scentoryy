import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ERRORS, type ErrorCode } from "../cau-hinh/maLoi";

/**
 * Lỗi nghiệp vụ mang mã ERR chuẩn OpenBA (docs/scentory/srs/error-matrix.md).
 * HTTP status và thông báo mặc định lấy từ ma trận lỗi; có thể ghi đè message.
 */
export class AppError extends Error {
  public readonly status: number;
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown
  ) {
    super(message ?? ERRORS[code].message);
    this.status = ERRORS[code].http;
    this.name = "AppError";
  }
}

/** Khuôn phản hồi lỗi chung (rule 10). */
function sendError(res: Response, status: number, code: string, message: string, details?: unknown): void {
  res.status(status).json({
    success: false,
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    meta: null,
    timestamp: new Date().toISOString(),
  });
}

export function notFound(_req: Request, res: Response): void {
  sendError(res, 404, "ERR-SYS-404-01", ERRORS["ERR-SYS-404-01"].message);
}

/** Error middleware — KHÔNG BAO GIỜ trả stack trace cho client. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof z.ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    sendError(res, 422, "ERR-VAL-422-01", ERRORS["ERR-VAL-422-01"].message, details);
    return;
  }
  if (typeof err === "object" && err !== null && "type" in err) {
    const type = (err as { type?: unknown }).type;
    if (type === "entity.parse.failed") {
      sendError(res, 400, "ERR-VAL-400-01", ERRORS["ERR-VAL-400-01"].message);
      return;
    }
    if (type === "entity.too.large") {
      sendError(res, 422, "ERR-VAL-422-01", "Dữ liệu gửi lên quá lớn.");
      return;
    }
  }
  if (typeof err === "object" && err !== null && (err as { name?: string }).name === "CastError") {
    sendError(res, 422, "ERR-VAL-422-01", "Mã định danh không hợp lệ.");
    return;
  }
  console.error(err);
  sendError(res, 500, "ERR-SYS-500-01", ERRORS["ERR-SYS-500-01"].message);
}
