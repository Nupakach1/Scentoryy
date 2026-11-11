/**
 * Ứng dụng Express — gắn middleware bảo mật và toàn bộ router `/api/v1` (docs/scentory/api/api-spec.md).
 * Xuất `app` để kiểm thử và để Vercel chạy dạng hàm serverless; `server.ts` mới listen.
 */
import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { env } from "./cau-hinh/env";
import { AUTH_RATE_LIMIT_PER_MIN } from "./cau-hinh/nghiepVu";
import { errorHandler, notFound } from "./trung-gian/error";
import { ok } from "./tien-ich/phanHoi";
import { authRouter } from "./dinh-tuyen/auth";
import { brandsRouter, familiesRouter, productsRouter } from "./dinh-tuyen/catalog";
import { interactionsRouter, matchRouter, quizRouter, weatherRouter } from "./dinh-tuyen/personalization";
import { addressesRouter, wishlistRouter } from "./dinh-tuyen/account";
import { cartRouter } from "./dinh-tuyen/cart";
import { ordersRouter, vouchersRouter } from "./dinh-tuyen/orders";
import { returnsRouter, reviewsRouter, uploadsRouter } from "./dinh-tuyen/aftersales";
import { chatbotRouter, conversationsRouter, messagesRouter } from "./dinh-tuyen/messages";
import { adminRouter } from "./dinh-tuyen/admin";

export const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());

// BR-SEC-005 — giới hạn tần suất API xác thực
if (env.NODE_ENV !== "test") {
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: AUTH_RATE_LIMIT_PER_MIN,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ success: false, data: null, error: { code: "ERR-AUTH-429-01", message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút." }, meta: null, timestamp: new Date().toISOString() }),
  });
  for (const p of ["login", "register", "admin/sessions", "password-resets"]) app.use(`/api/v1/auth/${p}`, limiter);
}

const api = express.Router();
api.get("/health", (_req, res) => ok(res, { status: "ok", db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" }));
api.use("/auth", authRouter);
api.use("/products", productsRouter);
api.use("/brands", brandsRouter);
api.use("/scent-families", familiesRouter);
api.use("/quiz", quizRouter);
api.use("/match", matchRouter);
api.use("/weather", weatherRouter);
api.use("/interactions", interactionsRouter);
api.use("/wishlist", wishlistRouter);
api.use("/addresses", addressesRouter);
api.use("/cart", cartRouter);
api.use("/orders", ordersRouter);
api.use("/vouchers", vouchersRouter);
api.use("/returns", returnsRouter);
api.use("/reviews", reviewsRouter);
api.use("/uploads", uploadsRouter);
api.use("/chatbot", chatbotRouter);
api.use("/messages", messagesRouter);
api.use("/admin/conversations", conversationsRouter);
api.use("/admin", adminRouter);
api.use(notFound);
app.use("/api/v1", api);

// Phục vụ giao diện Angular đã build (một cổng duy nhất khi chạy máy cá nhân)
const FRONTEND_DIST = path.resolve(__dirname, "..", "..", "frontend", "dist", "scentory", "browser");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, { maxAge: "7d", index: false }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res.type("html").send(
      `<meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;max-width:640px">
      <h2>Máy chủ Scentory đang chạy</h2><p>Chưa có bản build giao diện. Hãy chạy <code>npm run build</code> trong thư mục <b>frontend</b>
      (hoặc <code>bat/1-cai-dat-lan-dau.bat</code>), rồi tải lại trang. Kiểm tra API: <a href="/api/v1/health">/api/v1/health</a></p></body>`
    )
  );
}
app.use(notFound);
app.use(errorHandler);
