import { Schema, model, type Types } from "mongoose";

/** Sổ địa chỉ — collection `Addresses`; ≤ 5 địa chỉ, đúng 1 mặc định (BR-ACC-003). */
export interface AddressDoc {
  UserID: Types.ObjectId;
  Label: string;
  RecipientName: string;
  Phone: string;
  AddressLine: string;
  Ward: string;
  District: string;
  City: string;
  IsDefault: boolean;
  CreatedAt: Date;
}

const AddressSchema = new Schema<AddressDoc>(
  {
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    Label: { type: String, required: true, trim: true, maxlength: 50 },
    RecipientName: { type: String, required: true, trim: true, maxlength: 100 },
    Phone: { type: String, required: true, trim: true, match: /^\+?\d{9,15}$/ },
    AddressLine: { type: String, required: true, trim: true, maxlength: 255 },
    Ward: { type: String, required: true, trim: true, maxlength: 100 },
    District: { type: String, required: true, trim: true, maxlength: 100 },
    City: { type: String, required: true, trim: true, maxlength: 100 },
    IsDefault: { type: Boolean, default: false },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Addresses", timestamps: false }
);

export const Address = model<AddressDoc>("Address", AddressSchema, "Addresses");
