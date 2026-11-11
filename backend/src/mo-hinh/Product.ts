import { Schema, model, type Types } from "mongoose";

/**
 * Sản phẩm nước hoa — collection `Products` (docs/scentory/srs/erd.md).
 * IsActive=false là XÓA MỀM (BR-ADM-001) để giữ lịch sử đơn hàng.
 */
export interface ProductDoc {
  _id: Types.ObjectId;
  SKU?: string | null;
  Name: string;
  BrandName: string;
  Price: number;
  StockQuantity: number;
  Concentration: string;
  Volume: number;
  ScentFamily: string;
  TopNotes: string;
  MiddleNotes: string;
  BaseNotes: string;
  Projection: string;
  Longevity: string;
  Occasion: string;
  Description?: string | null;
  ImageUrl?: string | null;
  GalleryUrls: string[];
  SoldCount: number;
  AvgRating: number;
  ReviewCount: number;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

const ProductSchema = new Schema<ProductDoc>(
  {
    SKU: { type: String, trim: true, maxlength: 50, default: null },
    Name: { type: String, required: true, unique: true, trim: true, maxlength: 150 },
    BrandName: { type: String, required: true, trim: true, maxlength: 100 },
    Price: { type: Number, required: true, min: 1 },
    StockQuantity: { type: Number, required: true, min: 0 },
    Concentration: { type: String, required: true, trim: true, maxlength: 50 },
    Volume: { type: Number, default: 50, min: 1 },
    ScentFamily: { type: String, required: true, trim: true, maxlength: 100 },
    TopNotes: { type: String, required: true, trim: true, maxlength: 255 },
    MiddleNotes: { type: String, required: true, trim: true, maxlength: 255 },
    BaseNotes: { type: String, required: true, trim: true, maxlength: 255 },
    Projection: { type: String, required: true, enum: ["Nhẹ", "Vừa", "Mạnh"] },
    Longevity: { type: String, required: true, enum: ["Ngắn", "Vừa", "Lâu"] },
    Occasion: { type: String, required: true, trim: true, maxlength: 255 },
    Description: { type: String, trim: true, maxlength: 2000, default: null },
    ImageUrl: { type: String, trim: true, maxlength: 255, default: null },
    GalleryUrls: { type: [String], default: [] },
    SoldCount: { type: Number, default: 0, min: 0 },
    AvgRating: { type: Number, default: 0, min: 0, max: 5 },
    ReviewCount: { type: Number, default: 0, min: 0 },
    IsActive: { type: Boolean, default: true },
    CreatedAt: { type: Date, default: Date.now },
    UpdatedAt: { type: Date, default: Date.now },
  },
  { collection: "Products", timestamps: false }
);

ProductSchema.index({ SKU: 1 }, { unique: true, sparse: true });
ProductSchema.index({ ScentFamily: 1, IsActive: 1 });
ProductSchema.index({ BrandName: 1, IsActive: 1 });
ProductSchema.index({ Price: 1, IsActive: 1 });

export const Product = model<ProductDoc>("Product", ProductSchema, "Products");
