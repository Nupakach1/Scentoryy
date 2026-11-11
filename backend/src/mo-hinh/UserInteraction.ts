import { Schema, model, type Types } from "mongoose";
import { INTERACTION_TYPES, type InteractionType } from "../cau-hinh/nghiepVu";

/**
 * Hành vi vi mô — collection `UserInteractions`.
 * Nguồn tín hiệu làm giàu hồ sơ mùi hương (BR-MTCH-005) và dữ liệu cho lộ trình
 * Collaborative Filtering (Chương 3, mục 3.3.4).
 */
export interface UserInteractionDoc {
  UserID: Types.ObjectId;
  ProductID: Types.ObjectId;
  ActionType: InteractionType;
  Timestamp: Date;
}

const UserInteractionSchema = new Schema<UserInteractionDoc>(
  {
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ActionType: { type: String, enum: INTERACTION_TYPES, required: true },
    Timestamp: { type: Date, default: Date.now },
  },
  { collection: "UserInteractions", timestamps: false }
);
UserInteractionSchema.index({ UserID: 1, Timestamp: -1 });

export const UserInteraction = model<UserInteractionDoc>("UserInteraction", UserInteractionSchema, "UserInteractions");
