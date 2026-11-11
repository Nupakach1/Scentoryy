import { Schema, model } from "mongoose";

/**
 * Nhóm hương — collection `ScentFamilies` (UC-CAT-003).
 * `CorrelatedFamilies` dựng quan hệ "lân cận" cho tiêu chí nhóm hương của Scent Match (BR-MTCH-001).
 */
export interface ScentFamilyDoc {
  Name: string;
  NameVi?: string | null;
  Description?: string | null;
  KeyNotes?: string | null;
  Vibe?: string | null;
  CorrelatedFamilies: string[];
  ImageUrl?: string | null;
  IsActive: boolean;
  DisplayOrder: number;
  CreatedAt: Date;
}

const ScentFamilySchema = new Schema<ScentFamilyDoc>(
  {
    Name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    NameVi: { type: String, trim: true, maxlength: 150, default: null },
    Description: { type: String, trim: true, maxlength: 2000, default: null },
    KeyNotes: { type: String, trim: true, maxlength: 500, default: null },
    Vibe: { type: String, trim: true, maxlength: 255, default: null },
    CorrelatedFamilies: { type: [String], default: [] },
    ImageUrl: { type: String, trim: true, maxlength: 255, default: null },
    IsActive: { type: Boolean, default: true },
    DisplayOrder: { type: Number, default: 0, min: 0 },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "ScentFamilies", timestamps: false }
);

export const ScentFamily = model<ScentFamilyDoc>("ScentFamily", ScentFamilySchema, "ScentFamilies");
