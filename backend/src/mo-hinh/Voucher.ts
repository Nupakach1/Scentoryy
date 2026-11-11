import { Schema, model } from "mongoose";

/** Mã giảm giá — collection `Vouchers` (BR-PROMO-001). */
export const VOUCHER_TYPES = ["PERCENT", "FIXED", "SHIPPING"] as const;

export interface VoucherDoc {
  Code: string;
  Title: string;
  Description?: string | null;
  DiscountType: (typeof VOUCHER_TYPES)[number];
  DiscountValue: number;
  MinOrderAmount: number;
  MaxDiscountAmount?: number | null;
  UsageLimit?: number | null;
  UsedCount: number;
  StartAt: Date;
  EndAt: Date;
  IsActive: boolean;
  CreatedAt: Date;
}

const VoucherSchema = new Schema<VoucherDoc>(
  {
    Code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 50 },
    Title: { type: String, required: true, trim: true, maxlength: 150 },
    Description: { type: String, trim: true, maxlength: 255, default: null },
    DiscountType: { type: String, enum: VOUCHER_TYPES, required: true },
    DiscountValue: { type: Number, required: true, min: 0 },
    MinOrderAmount: { type: Number, default: 0, min: 0 },
    MaxDiscountAmount: { type: Number, default: null, min: 0 },
    UsageLimit: { type: Number, default: null, min: 1 },
    UsedCount: { type: Number, default: 0, min: 0 },
    StartAt: { type: Date, required: true },
    EndAt: { type: Date, required: true },
    IsActive: { type: Boolean, default: true },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Vouchers", timestamps: false }
);

export const Voucher = model<VoucherDoc>("Voucher", VoucherSchema, "Vouchers");
