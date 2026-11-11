/** Barrel 17 model — tên collection PascalCase khớp docs/scentory/srs/erd.md. */
import type { Model } from "mongoose";
import { User } from "./User";
import { ScentProfile } from "./ScentProfile";
import { Product } from "./Product";
import { Brand } from "./Brand";
import { ScentFamily } from "./ScentFamily";
import { Cart } from "./Cart";
import { CartItem } from "./CartItem";
import { Order } from "./Order";
import { OrderItem } from "./OrderItem";
import { ReturnRequest } from "./ReturnRequest";
import { Review } from "./Review";
import { UserInteraction } from "./UserInteraction";
import { Message } from "./Message";
import { Voucher } from "./Voucher";
import { PasswordResetOtp } from "./PasswordResetOtp";
import { Address } from "./Address";
import { Wishlist } from "./Wishlist";

export {
  User, ScentProfile, Product, Brand, ScentFamily, Cart, CartItem, Order, OrderItem,
  ReturnRequest, Review, UserInteraction, Message, Voucher, PasswordResetOtp, Address, Wishlist,
};

/** Registry cho test kiểm tra quy ước đặt tên collection. */
export const ALL_MODELS: ReadonlyArray<Model<unknown>> = [
  User, ScentProfile, Product, Brand, ScentFamily, Cart, CartItem, Order, OrderItem,
  ReturnRequest, Review, UserInteraction, Message, Voucher, PasswordResetOtp, Address, Wishlist,
] as unknown as ReadonlyArray<Model<unknown>>;
