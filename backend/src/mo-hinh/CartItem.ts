import { Schema, model, type Types } from "mongoose";

/** Dòng giỏ hàng — collection `CartItems`; số lượng 1–10 (BR-CART-001). */
export interface CartItemDoc {
  CartID: Types.ObjectId;
  ProductID: Types.ObjectId;
  Quantity: number;
  AddedAt: Date;
}

const CartItemSchema = new Schema<CartItemDoc>(
  {
    CartID: { type: Schema.Types.ObjectId, ref: "Cart", required: true },
    ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    Quantity: { type: Number, required: true, min: 1, max: 10 },
    AddedAt: { type: Date, default: Date.now },
  },
  { collection: "CartItems", timestamps: false }
);
CartItemSchema.index({ CartID: 1, ProductID: 1 }, { unique: true });

export const CartItem = model<CartItemDoc>("CartItem", CartItemSchema, "CartItems");
