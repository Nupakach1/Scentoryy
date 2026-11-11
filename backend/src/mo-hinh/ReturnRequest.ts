import { Schema, model, type Types } from "mongoose";
import { RETURN_STATUSES, RETURN_TYPES, type ReturnStatus } from "../cau-hinh/nghiepVu";

/** Yêu cầu đổi trả — collection `ReturnRequests` (UC-RET-001, UC-RET-002, BR-RET-001..003). */
export interface ReturnRequestDoc {
  OrderID: Types.ObjectId;
  UserID: Types.ObjectId;
  RequestType: (typeof RETURN_TYPES)[number];
  Items: Array<{ ProductID: Types.ObjectId; Quantity: number }>;
  Reason: string;
  Description?: string | null;
  EvidenceUrl: string;
  IsIntactSeal: boolean;
  RefundAmount: number;
  Status: ReturnStatus;
  AdminResponse?: string | null;
  CreatedAt: Date;
  ResolvedAt?: Date | null;
}

const ReturnRequestSchema = new Schema<ReturnRequestDoc>(
  {
    OrderID: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    RequestType: { type: String, enum: RETURN_TYPES, required: true },
    Items: {
      type: [
        new Schema(
          {
            ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            Quantity: { type: Number, required: true, min: 1 },
          },
          { _id: false }
        ),
      ],
      validate: { validator: (v: unknown[]) => Array.isArray(v) && v.length > 0, message: "Cần ít nhất 1 sản phẩm" },
    },
    Reason: { type: String, required: true, trim: true, maxlength: 255 },
    Description: { type: String, trim: true, maxlength: 1000, default: null },
    EvidenceUrl: { type: String, required: true, trim: true, maxlength: 255 },
    IsIntactSeal: { type: Boolean, required: true },
    RefundAmount: { type: Number, default: 0, min: 0 },
    Status: { type: String, enum: RETURN_STATUSES, default: "PENDING" },
    AdminResponse: { type: String, trim: true, maxlength: 255, default: null },
    CreatedAt: { type: Date, default: Date.now },
    ResolvedAt: { type: Date, default: null },
  },
  { collection: "ReturnRequests", timestamps: false }
);
ReturnRequestSchema.index({ Status: 1, CreatedAt: -1 });

export const ReturnRequest = model<ReturnRequestDoc>("ReturnRequest", ReturnRequestSchema, "ReturnRequests");
