import mongoose from "mongoose";

/** Kết nối MongoDB Atlas; tái sử dụng kết nối giữa các lần gọi hàm serverless (Vercel). */
let pending: Promise<typeof mongoose> | null = null;

export async function connectDB(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  const st = mongoose.connection.readyState; // 0 ngắt · 1 đã nối · 2 đang nối · 3 đang ngắt
  if (st === 1) return;
  // Serverless (Vercel) có thể đóng kết nối giữa hai lượt gọi → bỏ lời hứa cũ để kết nối lại
  if (st === 0 || st === 3) pending = null;
  try {
    pending ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
    await pending;
    console.log(`Đã kết nối MongoDB (cơ sở dữ liệu: ${mongoose.connection.name})`);
  } catch (err) {
    pending = null;
    const msg = (err as Error).message ?? "";
    if (/bad auth|Authentication failed/i.test(msg)) console.error("[LỖI] Sai tên đăng nhập hoặc mật khẩu Database User trong MONGODB_URI.");
    else if (/ENOTFOUND|querySrv|timed out|Server selection/i.test(msg)) console.error("[LỖI] Không kết nối được cụm Atlas: kiểm tra Network Access (IP) và mạng Internet.");
    else console.error("[LỖI] Kết nối MongoDB thất bại:", msg);
    if (process.env.VERCEL) throw err;
    process.exit(1);
  }
}
