import { Schema, model, type Types } from "mongoose";

/**
 * Tin nhắn chat — collection `Messages` (bảng bổ sung, cùng quy ước PascalCase).
 * - `To = null`  → customer gửi cho "nhóm admin"
 * - `To = <uid>` → admin gửi cho customer cụ thể
 * LUÔNG LƯU VÀO DB TRƯỚC khi emit qua Socket.IO.
 */
export interface MessageDoc {
  From: Types.ObjectId;
  To: Types.ObjectId | null;
  Content: string;
  Read: boolean;
  /** Gắn chat với đơn hàng ("Liên hệ với shop" ở trang chi tiết đơn) — nullable. */
  OrderID?: Types.ObjectId | null;
  CreatedAt: Date;
}

const MessageSchema = new Schema<MessageDoc>(
  {
    From: { type: Schema.Types.ObjectId, ref: "User", required: true },
    To: { type: Schema.Types.ObjectId, ref: "User", default: null },
    Content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    Read: { type: Boolean, default: false },
    // Mở rộng đã chốt: tin nhắn có thể gắn với 1 đơn ("Liên hệ với shop").
    OrderID: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Messages", timestamps: false }
);

MessageSchema.index({ From: 1, CreatedAt: 1 });
MessageSchema.index({ To: 1, CreatedAt: 1 });
MessageSchema.index({ OrderID: 1, CreatedAt: 1 }, { sparse: true });

export const Message = model<MessageDoc>("Message", MessageSchema, "Messages");
