/**
 * Socket.IO — đẩy tin nhắn realtime cho UC-MSG-001 / UC-MSG-002.
 * Xác thực ngay lúc handshake bằng cookie httpOnly; tin luôn được LƯU CSDL trước khi phát (BR-MSG-001).
 */
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../cau-hinh/env";
import { MESSAGE_RATE_MAX, MESSAGE_RATE_WINDOW_MS } from "../cau-hinh/nghiepVu";
import type { JwtPayload } from "../trung-gian/auth";
import { postMessage } from "../dinh-tuyen/messages"; // vòng phụ thuộc an toàn: chỉ gọi lúc chạy

let io: Server | null = null;
const sendTimes = new Map<string, number[]>();

/** Giới hạn ≤ 10 tin/10 giây/người (BR-MSG-001). */
export function allowMessage(userId: string, now = Date.now()): boolean {
  const recent = (sendTimes.get(userId) ?? []).filter((t) => now - t < MESSAGE_RATE_WINDOW_MS);
  if (recent.length >= MESSAGE_RATE_MAX) {
    sendTimes.set(userId, recent);
    return false;
  }
  recent.push(now);
  sendTimes.set(userId, recent);
  return true;
}

/** Phát tin mới tới phòng của khách và phòng admins (bỏ qua nếu chạy serverless không có Socket.IO). */
export function emitMessage(message: unknown, customerId: string): void {
  io?.to(`uid:${customerId}`).to("admins").emit("message:new", message);
}

/** Báo các phiên quản trị làm mới số đếm trên menu (đơn mới, yêu cầu đổi trả mới, tin mới). */
export function emitAdminBadges(): void {
  io?.to("admins").emit("admin:badges");
}

function tokenFromCookie(raw: string | undefined): string | undefined {
  const entry = raw?.split(/;\s*/).find((c) => c.startsWith("token="));
  return entry ? decodeURIComponent(entry.slice(6)) : undefined;
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => {
    const token = tokenFromCookie(socket.handshake.headers.cookie);
    if (!token) return next(new Error("ERR-AUTH-401-02"));
    try {
      socket.data.user = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      next();
    } catch {
      next(new Error("ERR-AUTH-401-02"));
    }
  });
  io.on("connection", (socket) => {
    const user = socket.data.user as JwtPayload;
    socket.join(`uid:${user.sub}`);
    if (user.role === "admin") socket.join("admins");
    // Gửi tin qua socket dùng chung nghiệp vụ với REST
    socket.on("message:send", (payload: unknown, ack?: (r: unknown) => void) => {
      Promise.resolve()
        .then(() => postMessage(user, payload))
        .then((m) => ack?.({ ok: true, data: m }))
        .catch((e: { code?: string; message?: string }) => ack?.({ ok: false, error: { code: e.code ?? "ERR-SYS-500-01", message: e.message } }));
    });
  });
  return io;
}
