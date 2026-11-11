import bcrypt from "bcryptjs";
import { env } from "../cau-hinh/env";
import { connectDB } from "../csdl/connect";
import { User } from "../mo-hinh/User";
import { PASSWORD_RE } from "../tien-ich/password";

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@scentory.vn").trim().toLowerCase();
  const rawPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  if (!PASSWORD_RE.test(rawPassword)) {
    console.error("Mật khẩu không hợp lệ (8–64 ký tự, ≥1 chữ cái và ≥1 chữ số).");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const user = await User.findOne({ Email: email });
  if (user) {
    user.PasswordHash = passwordHash;
    user.Role = "admin";
    user.Status = "Active";
    user.FailedAttempts = 0;
    user.LockedUntil = null;
    user.TokenVersion = (user.TokenVersion || 0) + 1;
    await user.save();
    console.log(`Đã reset mật khẩu thành công cho admin: ${email} (Mật khẩu mới: ${rawPassword})`);
  } else {
    await User.create({
      FullName: "Scentory Admin",
      Email: email,
      PasswordHash: passwordHash,
      Role: "admin",
      Status: "Active",
      FailedAttempts: 0,
      TokenVersion: 1,
    });
    console.log(`Đã tạo mới tài khoản admin: ${email} với mật khẩu: ${rawPassword}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset admin password failed:", err);
    process.exit(1);
  });
