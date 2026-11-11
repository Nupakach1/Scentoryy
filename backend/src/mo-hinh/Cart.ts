import { Schema, model, type Types } from "mongoose";

/**
 * Giỏ hàng — collection `Carts`, docs/scentory/srs/erd.md.
 * 1 giỏ hàng duy nhất cho mỗi khách (`UserID` unique).
 */
export interface CartDoc {
  UserID: Types.ObjectId;
  UpdatedAt: Date;
}

const CartSchema = new Schema<CartDoc>(
  {
    UserID: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // FK Users.UserID, Unique (báo cáo)
    },
    UpdatedAt: { type: Date, default: Date.now },
  },
  { collection: "Carts", timestamps: false }
);

export const Cart = model<CartDoc>("Cart", CartSchema, "Carts");

/** Kiểu ObjectId tiện dụng khi populate / query. */
export type CartId = Types.ObjectId;
