import { Schema, model, type Types } from "mongoose";

/** Dòng đơn hàng — `FixedUnitPrice` chốt tại thời điểm đặt (BR-PRIC-001). */
export interface OrderItemDoc {
  OrderID: Types.ObjectId;
  ProductID: Types.ObjectId;
  ProductName: string;
  Quantity: number;
  FixedUnitPrice: number;
}

const OrderItemSchema = new Schema<OrderItemDoc>(
  {
    OrderID: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    ProductName: { type: String, required: true, trim: true, maxlength: 150 },
    Quantity: { type: Number, required: true, min: 1 },
    FixedUnitPrice: { type: Number, required: true, min: 0 },
  },
  { collection: "OrderItems", timestamps: false }
);
OrderItemSchema.index({ OrderID: 1 });
OrderItemSchema.index({ ProductID: 1 });

export const OrderItem = model<OrderItemDoc>("OrderItem", OrderItemSchema, "OrderItems");
