import { Schema, model, type Types } from "mongoose";
import { ACTUAL_PROJECTIONS, REVIEW_TEXT_MAX } from "../cau-hinh/nghiepVu";

/** Đánh giá — collection `Reviews`; 1 đánh giá cho mỗi (đơn, sản phẩm) (BR-REV-001). */
export interface ReviewDoc {
  UserID: Types.ObjectId;
  ProductID: Types.ObjectId;
  OrderID: Types.ObjectId;
  OverallRating: number;
  ReviewText?: string | null;
  ActualProjection: (typeof ACTUAL_PROJECTIONS)[number];
  MatchScoreRating?: number | null;
  ImageUrl?: string | null;
  CreatedAt: Date;
}

const ReviewSchema = new Schema<ReviewDoc>(
  {
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    OrderID: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    OverallRating: { type: Number, required: true, min: 1, max: 5 },
    ReviewText: { type: String, trim: true, maxlength: REVIEW_TEXT_MAX, default: null },
    ActualProjection: { type: String, enum: ACTUAL_PROJECTIONS, default: "MATCH" },
    MatchScoreRating: { type: Number, min: 1, max: 5, default: null },
    ImageUrl: { type: String, trim: true, maxlength: 255, default: null },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Reviews", timestamps: false }
);
ReviewSchema.index({ OrderID: 1, ProductID: 1 }, { unique: true });
ReviewSchema.index({ ProductID: 1, CreatedAt: -1 });

export const Review = model<ReviewDoc>("Review", ReviewSchema, "Reviews");
