import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Bọc handler async để mọi lỗi (throw / promise reject) đều rơi vào
 * error middleware — hoạt động đúng trên cả Express 4 và 5.
 *
 * Ví dụ:
 *   router.get("/me", requireAuth, asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
