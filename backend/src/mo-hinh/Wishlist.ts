import { Schema, model, type Types } from "mongoose";

/** Danh sách yêu thích — collection `Wishlists`; unique (UserID, ProductID) (BR-ACC-004). */
export interface WishlistDoc {
  UserID: Types.ObjectId;
  ProductID: Types.ObjectId;
  CreatedAt: Date;
}

const WishlistSchema = new Schema<WishlistDoc>(
  {
    UserID: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ProductID: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    CreatedAt: { type: Date, default: Date.now },
  },
  { collection: "Wishlists", timestamps: false }
);
WishlistSchema.index({ UserID: 1, ProductID: 1 }, { unique: true });

export const Wishlist = model<WishlistDoc>("Wishlist", WishlistSchema, "Wishlists");
