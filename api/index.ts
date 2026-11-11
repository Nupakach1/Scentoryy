/**
 * Điểm vào serverless cho Vercel: dùng chung Express app của backend.
 * Socket.IO không chạy được trên serverless → tin nhắn vẫn lưu/đọc qua REST (UC-MSG-001), chỉ mất đẩy realtime.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../backend/src/app";
import { connectDB } from "../backend/src/csdl/connect";
import { env } from "../backend/src/cau-hinh/env";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await connectDB(env.MONGODB_URI); // có cache kết nối giữa các lần gọi
  return app(req as never, res as never);
}
