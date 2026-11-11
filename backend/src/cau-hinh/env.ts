import dotenv from "dotenv";
import { z } from "zod";

// Nạp .env (KHÔNG ghi đè biến đã có trong process.env — test env được ưu tiên).
dotenv.config({ quiet: true });

/** Chuỗi rỗng ("") → undefined để kích hoạt default của zod. */
function emptyToUndefined(value: unknown): unknown {
  return value === "" || value === null ? undefined : value;
}

const EnvSchema = z.object({
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().min(1, "MONGODB_URI là bắt buộc")),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  NODE_ENV: z.preprocess(
    emptyToUndefined,
    z.enum(["development", "production", "test"]).default("development")
  ),
  JWT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(32, "JWT_SECRET phải dài ít nhất 32 ký tự")
  ),
  WEATHER_API_KEY: z.preprocess(emptyToUndefined, z.string().default("")),
  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().default("")),
  // ---- SMTP (tùy chọn — mailService UC-AUTH-003) ----
  // Thiếu (hoặc để trống) → mailService fallback log OTP ra console.
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().default("")),
  SMTP_PORT: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(65535).default(587)
  ),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().default("")),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().default("")),
});

/**
 * Validate biến môi trường NGAY KHI STARTUP (fail fast):
 * thiếu / sai → log rõ từng dòng rồi `process.exit(1)`.
 */
function loadEnv(): z.infer<typeof EnvSchema> {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Thiếu / sai biến môi trường (.env):");
    for (const issue of parsed.error.issues) {
      console.error(`   - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    console.error("   → Sao chép .env.example thành .env rồi điền giá trị.");
    if (process.env.VERCEL) throw new Error("Thiếu biến môi trường trên Vercel");
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
