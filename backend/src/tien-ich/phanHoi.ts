import type { Response } from "express";

/** Khuôn phản hồi thành công chung của API (docs/scentory/api/api-spec.md, rule 10). */
export function ok<T>(res: Response, data: T, meta: Record<string, unknown> | null = null, status = 200): void {
  res.status(status).json({ success: true, data, error: null, meta, timestamp: new Date().toISOString() });
}

export function created<T>(res: Response, data: T, meta: Record<string, unknown> | null = null): void {
  ok(res, data, meta, 201);
}

/** Đọc tham số phân trang (BR-CAT-001). */
export function paging(q: Record<string, unknown>, def = 12, max = 100): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number.parseInt(String(q.page ?? "1"), 10) || 1);
  const limit = Math.min(max, Math.max(1, Number.parseInt(String(q.limit ?? def), 10) || def));
  return { page, limit, skip: (page - 1) * limit };
}
