import { Schema, model } from "mongoose";

/** Thương hiệu — collection `Brands` (UC-CAT-003). */
export interface BrandDoc {
  Name: string;
  Slug: string;
  Description?: string | null;
  Origin?: string | null;
  Style?: string | null;
  ImageUrl?: string | null;
  IsActive: boolean;
  CreatedAt: Date;
}

const BrandSchema = new Schema<BrandDoc>(
  {
    Name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    Slug: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 100 },
    Description: { type: String, trim: true, maxlength: 2000, default: null },
    Origin: { type: String, trim: true, maxlength: 100, default: null },
    Style: { type: String, trim: true, maxlength: 255, default: null },
    ImageUrl: { type: String, trim: true, maxlength: 255, default: null },
    IsActive: { type: Boolean, default: true },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Brands", timestamps: false }
);

export const Brand = model<BrandDoc>("Brand", BrandSchema, "Brands");
