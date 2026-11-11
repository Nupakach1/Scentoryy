import { Schema, model, type Types } from "mongoose";

/**
 * Người dùng — collection `Users`, đặt tên TRÙNG KHỚP docs/scentory/srs/erd.md.
 * PK (`UserID` trong báo cáo) → `_id` (ObjectId) của MongoDB.
 */
export interface UserDoc {
  FullName: string;
  Email: string;
  PhoneNumber?: string | null;
  PasswordHash: string;
  Role: "customer" | "admin";
  Status: "Active" | "Blocked";
  FailedAttempts: number;
  LockedUntil: Date | null;
  BlockReason?: string | null;
  /** Bit thu hồi phiên: tăng khi admin khóa/mở khóa → JWT cũ hết hiệu lực. */
  TokenVersion: number;
  CreatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    FullName: { type: String, required: true, trim: true, maxlength: 100 },
    Email: {
      type: String,
      required: true,
      unique: true, // Email: Unique, Not Null
      lowercase: true,
      trim: true,
      maxlength: 150,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    PhoneNumber: {
      // Unique, Nullable — index riêng bên dưới (partial index)
      type: String,
      trim: true,
      maxlength: 15,
      match: /^\+?\d{9,15}$/,
      default: null,
    },
    PasswordHash: { type: String, required: true, select: false },
    Role: { type: String, enum: ["customer", "admin"], required: true },
    // Đúng 2 giá trị theo báo cáo — KHÔNG có "user"
    Status: {
      type: String,
      enum: ["Active", "Blocked"],
      default: "Active",
    },
    FailedAttempts: { type: Number, default: 0 },
    LockedUntil: { type: Date, default: null },
    BlockReason: { type: String, maxlength: 255, default: null },
    // Bit thu hồi phiên (UC-USR-001): JWT mang claim `ver` = TokenVersion;
    // khi admin khóa/mở khóa tài khoản → tăng TokenVersion → mọi cookie cũ bị vô hiệu.
    TokenVersion: { type: Number, default: 0, min: 0 },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Users", timestamps: false } // ← tên collection đúng báo cáo
);

// PhoneNumber unique NHƯNG nullable: partial index để nhiều null không va nhau
UserSchema.index(
  { PhoneNumber: 1 },
  { unique: true, partialFilterExpression: { PhoneNumber: { $type: "string" } } }
);

export const User = model<UserDoc>("User", UserSchema, "Users");

/** Kiểu ObjectId tiện dụng khi populate / query. */
export type UserId = Types.ObjectId;
