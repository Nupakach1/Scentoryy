/**
 * Tin nhắn — UC-MSG-001 (khách: chatbot + hộp thư), UC-MSG-002 (admin trả lời). BR-MSG-001, BR-MSG-002.
 * REST song song với Socket.IO để vẫn hoạt động trên môi trường serverless (Vercel).
 */
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { MESSAGE_MAX_LENGTH } from "../cau-hinh/nghiepVu";
import { AppError } from "../trung-gian/error";
import { adminOnly, requireAuth } from "../trung-gian/auth";
import { Message } from "../mo-hinh/Message";
import { Order } from "../mo-hinh/Order";
import { User } from "../mo-hinh/User";
import { botAnswer } from "../dich-vu/chatbot";
import { toMessageDto } from "../dich-vu/dto";
import { allowMessage, emitMessage } from "../thoi-gian-thuc/socket";
import { asyncHandler } from "../tien-ich/asyncHandler";
import { ok, created } from "../tien-ich/phanHoi";

export const chatbotRouter = Router();
export const messagesRouter = Router();
export const conversationsRouter = Router();

// POST /api/v1/chatbot/messages — FR-MSG-BOT-001
chatbotRouter.post(
  "/messages",
  asyncHandler(async (req, res) => {
    const r = z.object({ message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH) }).safeParse(req.body);
    if (!r.success) throw new AppError("ERR-MSG-422-01");
    ok(res, botAnswer(r.data.message));
  })
);

/** Lưu tin, kiểm tra nội dung/tần suất, đẩy realtime (BR-MSG-001). */
export async function postMessage(from: { sub: string; role: string }, body: unknown) {
  const r = z
    .object({ content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH), to: z.string().regex(/^[0-9a-f]{24}$/i).optional(), orderId: z.string().regex(/^[0-9a-f]{24}$/i).optional() })
    .safeParse(body);
  if (!r.success) throw new AppError("ERR-MSG-422-01");
  if (!allowMessage(from.sub)) throw new AppError("ERR-MSG-429-01");
  let to: Types.ObjectId | null = null;
  if (from.role === "admin") {
    if (!r.data.to || !(await User.exists({ _id: r.data.to }))) throw new AppError("ERR-USR-404-01");
    to = new Types.ObjectId(r.data.to);
  }
  if (r.data.orderId) {
    const owner = from.role === "admin" ? to : new Types.ObjectId(from.sub);
    if (!(await Order.exists({ _id: r.data.orderId, UserID: owner }))) throw new AppError("ERR-ORD-404-01");
  }
  const m = await Message.create({ From: from.sub, To: to, Content: r.data.content, OrderID: r.data.orderId ?? null });
  const dto = toMessageDto(m);
  emitMessage(dto, from.role === "admin" ? String(to) : from.sub);
  return dto;
}

// GET /api/v1/messages[?with=uid] — FR-MSG-INB-001, FR-MSG-ADM-001
messagesRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = req.user!;
    let uid: Types.ObjectId;
    if (u.role === "admin") {
      const w = z.string().regex(/^[0-9a-f]{24}$/i).safeParse(req.query.with);
      if (!w.success) throw new AppError("ERR-VAL-422-01", "Thiếu tham số with.");
      uid = new Types.ObjectId(w.data);
      await Message.updateMany({ From: uid, To: null, Read: false }, { $set: { Read: true } });
    } else {
      uid = new Types.ObjectId(u.sub);
      await Message.updateMany({ To: uid, Read: false }, { $set: { Read: true } });
    }
    const list = await Message.find({ $or: [{ From: uid, To: null }, { To: uid }] }).sort({ CreatedAt: 1 }).limit(500).lean();
    ok(res, list.map(toMessageDto));
  })
);

messagesRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => created(res, await postMessage(req.user!, req.body)))
);

// GET /api/v1/admin/conversations — FR-MSG-ADM-001
conversationsRouter.get(
  "/",
  ...adminOnly,
  asyncHandler(async (_req, res) => {
    const agg = await Message.aggregate([
      { $addFields: { customer: { $cond: [{ $eq: ["$To", null] }, "$From", "$To"] } } },
      { $sort: { CreatedAt: -1 } },
      { $group: { _id: "$customer", lastMessage: { $first: "$Content" }, lastAt: { $first: "$CreatedAt" },
          unread: { $sum: { $cond: [{ $and: [{ $eq: ["$To", null] }, { $eq: ["$Read", false] }] }, 1, 0] } } } },
      { $sort: { lastAt: -1 } },
      { $lookup: { from: "Users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $match: { "u.Role": "customer" } },
    ]);
    ok(res, agg.map((c) => ({ userId: String(c._id), fullName: c.u.FullName, email: c.u.Email, lastMessage: c.lastMessage, lastAt: c.lastAt, unread: c.unread })));
  })
);
