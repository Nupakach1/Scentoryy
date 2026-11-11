/**
 * Lưu tệp minh chứng/ảnh đánh giá trong MongoDB GridFS (bucket `Uploads`)
 * để không mất tệp khi chạy serverless (Vercel) — BR-RET-002, NFR-SEC-003.
 */
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";

const BUCKET = "Uploads";

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Chưa kết nối CSDL");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export async function saveFile(buffer: Buffer, filename: string, contentType: string, ownerId: string): Promise<string> {
  const stream = bucket().openUploadStream(filename, { metadata: { contentType, ownerId } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer).pipe(stream).on("finish", () => resolve()).on("error", reject);
  });
  return String(stream.id);
}

export async function findFile(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const files = await bucket().find({ _id: new Types.ObjectId(id) }).toArray();
  return files[0] ?? null;
}

export function openFile(id: string) {
  return bucket().openDownloadStream(new Types.ObjectId(id));
}
