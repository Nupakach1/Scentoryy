import multer from "multer";
import { EVIDENCE_MAX_BYTES, EVIDENCE_MIME_TYPES } from "../cau-hinh/nghiepVu";
import { AppError } from "./error";

/** Nhận đúng 1 tệp JPG/PNG/MP4 ≤ 10 MB vào bộ nhớ (BR-RET-002). */
export const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((EVIDENCE_MIME_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new AppError("ERR-RET-422-01"));
  },
}).single("file");

/** Chuyển lỗi multer (vượt dung lượng) sang mã lỗi chuẩn. */
export function uploadErrors(err: unknown): unknown {
  if (err instanceof multer.MulterError) return new AppError("ERR-RET-422-01");
  return err;
}
