/**
 * Điểm khởi chạy máy chủ: kết nối MongoDB Atlas → tạo HTTP server → gắn Socket.IO → listen.
 */
import http from "node:http";
import { app } from "./app";
import { env } from "./cau-hinh/env";
import { connectDB } from "./csdl/connect";
import { initSocket } from "./thoi-gian-thuc/socket";

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  const server = http.createServer(app);
  const io = initSocket(server);
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(err.code === "EADDRINUSE" ? `[LỖI] Cổng ${env.PORT} đang được dùng — tắt cửa sổ đang chạy hoặc đổi PORT trong .env.` : err);
    process.exit(1);
  });
  server.listen(Number(env.PORT), () => {
    console.log(`Scentory đang chạy: http://localhost:${env.PORT}`);
    console.log(`  - API     : http://localhost:${env.PORT}/api/v1/health`);
    console.log(`  - Quản trị: http://localhost:${env.PORT}/admin/dang-nhap`);
  });
  const stop = () => {
    io.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error("Không khởi động được máy chủ:", err);
  process.exit(1);
});
