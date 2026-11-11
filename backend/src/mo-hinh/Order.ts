import { Schema, model, type Types } from "mongoose";
import {
  DELIVERY_METHODS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "../cau-hinh/nghiepVu";

/**
 * Đơn hàng — collection `Orders`.
 * Status theo FSM đơn hàng, PaymentStatus theo FSM thanh toán (docs/scentory/srs/states.md).
 */
export interface TimelineEntry {
  Status: string;
  At: Date;
  By: "customer" | "admin" | "system";
  Note?: string | null;
}

export interface OrderDoc {
  OrderCode: string;
  UserID: Types.ObjectId;
  RecipientName: string;
  Phone: string;
  ShippingAddress: string;
  DeliveryMethod: keyof typeof DELIVERY_METHODS;
  Subtotal: number;
  ShippingFee: number;
  DiscountAmount: number;
  TotalAmount: number;
  VoucherCode?: string | null;
  PaymentMethod: PaymentMethod;
  PaymentStatus: PaymentStatus;
  PaymentExpiresAt?: Date | null;
  PaidAt?: Date | null;
  CardLast4?: string | null;
  Status: OrderStatus;
  TrackingCode?: string | null;
  OrderNote?: string | null;
  CancelReason?: string | null;
  CancelledBy?: "customer" | "admin" | "system" | null;
  Timeline: TimelineEntry[];
  StockDeducted: boolean;
  DeliveredAt?: Date | null;
  CreatedAt: Date;
}

const TimelineSchema = new Schema<TimelineEntry>(
  {
    Status: { type: String, required: true },
    At: { type: Date, default: Date.now },
    By: { type: String, enum: ["customer", "admin", "system"], required: true },
    Note: { type: String, maxlength: 255, default: null },
  },
  { _id: false }
);

const OrderSchema = new Schema<OrderDoc>(
  {
    OrderCode: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    RecipientName: { type: String, required: true, trim: true, maxlength: 100 },
    Phone: { type: String, required: true, trim: true, maxlength: 15 },
    ShippingAddress: { type: String, required: true, trim: true, maxlength: 255 },
    DeliveryMethod: { type: String, enum: Object.keys(DELIVERY_METHODS), default: "STANDARD" },
    Subtotal: { type: Number, required: true, min: 0 },
    ShippingFee: { type: Number, default: 0, min: 0 },
    DiscountAmount: { type: Number, default: 0, min: 0 },
    TotalAmount: { type: Number, required: true, min: 0 },
    VoucherCode: { type: String, trim: true, maxlength: 50, default: null },
    PaymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    PaymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "PENDING" },
    PaymentExpiresAt: { type: Date, default: null },
    PaidAt: { type: Date, default: null },
    CardLast4: { type: String, maxlength: 4, default: null },
    Status: { type: String, enum: ORDER_STATUSES, default: "PROCESSING" },
    TrackingCode: { type: String, trim: true, maxlength: 100, default: null },
    OrderNote: { type: String, trim: true, maxlength: 255, default: null },
    CancelReason: { type: String, trim: true, maxlength: 255, default: null },
    CancelledBy: { type: String, enum: ["customer", "admin", "system", null], default: null },
    Timeline: { type: [TimelineSchema], default: [] },
    StockDeducted: { type: Boolean, default: false },
    DeliveredAt: { type: Date, default: null },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Orders", timestamps: false }
);

OrderSchema.index({ UserID: 1, CreatedAt: -1 });
OrderSchema.index({ Status: 1, CreatedAt: -1 });
OrderSchema.index({ PaymentMethod: 1, PaymentStatus: 1, PaymentExpiresAt: 1 });

export const Order = model<OrderDoc>("Order", OrderSchema, "Orders");
