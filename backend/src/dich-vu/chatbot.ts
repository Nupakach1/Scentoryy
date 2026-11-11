/**
 * Scent Concierge — chatbot trả lời theo luật từ khóa (BR-MSG-002, FR-MSG-BOT-001).
 * Hàm thuần: không gọi mô hình ngôn ngữ, câu trả lời giải thích được và kiểm thử được.
 */
import { DELIVERY_METHODS, QR_PAYMENT_WINDOW_MS } from "../cau-hinh/nghiepVu";

export interface BotReply { intent: string; answer: string; suggestEscalation: boolean; link?: string }

const fee = (n: number) => (n === 0 ? "miễn phí" : n.toLocaleString("vi-VN") + "đ");
const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

const RULES: Array<{ intent: string; keys: string[]; answer: string; link?: string }> = [
  {
    intent: "shipping",
    keys: ["giao hang", "van chuyen", "phi ship", "ship", "bao lau", "hoa toc"],
    answer: `Scentory có 2 hình thức giao: ${DELIVERY_METHODS.STANDARD.label} (${fee(DELIVERY_METHODS.STANDARD.fee)}, ${DELIVERY_METHODS.STANDARD.eta}) và ${DELIVERY_METHODS.EXPRESS.label} (${fee(DELIVERY_METHODS.EXPRESS.fee)}). Mỗi chai được niêm phong và đóng hộp bảo ôn.`,
  },
  {
    intent: "return",
    keys: ["doi tra", "hoan tien", "tra hang", "doi hang", "loi", "seal"],
    answer: "Bạn được gửi yêu cầu đổi trả trong 7 ngày kể từ khi nhận hàng, kèm 1 ảnh/video minh chứng (JPG, PNG hoặc MP4, tối đa 10 MB). Vào Đơn hàng của tôi → chọn đơn đã giao → Yêu cầu đổi trả.",
    link: "/tai-khoan/don-hang",
  },
  {
    intent: "payment",
    keys: ["thanh toan", "cod", "qr", "the", "chuyen khoan", "visa"],
    answer: `Scentory nhận thanh toán khi nhận hàng (COD), chuyển khoản QR (phiên thanh toán ${QR_PAYMENT_WINDOW_MS / 60000} phút) và thẻ quốc tế. Hệ thống không lưu số thẻ của bạn.`,
  },
  {
    intent: "quiz",
    keys: ["quiz", "goi y", "hop voi", "chon mui", "tu van", "mui nao", "scent match"],
    answer: "Hãy làm Scent Quiz 8 bước (khoảng 2 phút) — Scentory sẽ lập hồ sơ mùi hương và chấm điểm phù hợp cho từng chai, kèm lý do theo nhóm hương, hoàn cảnh, độ tỏa và thời tiết.",
    link: "/scent-quiz/buoc/1",
  },
  {
    intent: "order",
    keys: ["don hang", "theo doi", "ma van don", "huy don", "trang thai"],
    answer: "Bạn xem trạng thái đơn tại Đơn hàng của tôi. Đơn đang xử lý có thể tự hủy; đơn đang giao vui lòng nhắn cho nhân viên Scentory.",
    link: "/tai-khoan/don-hang",
  },
  {
    intent: "voucher",
    keys: ["voucher", "ma giam", "khuyen mai", "uu dai", "giam gia"],
    answer: "Ưu đãi hiện có: SCENTORY10 (giảm 10% cho đơn từ 2.000.000đ), WELCOME50 (giảm 50.000đ), FREESHIP (hỗ trợ phí giao hỏa tốc đến 35.000đ). Mỗi đơn dùng 1 mã.",
  },
  {
    intent: "greeting",
    keys: ["xin chao", "chao", "hello", "hi "],
    answer: "Xin chào! Mình là Scent Concierge. Bạn có thể hỏi về giao hàng, đổi trả, thanh toán, ưu đãi hoặc nhờ mình gợi ý mùi hương.",
  },
];

export function botAnswer(message: string): BotReply {
  const text = ` ${strip(message)} `;
  for (const r of RULES) {
    if (r.keys.some((k) => text.includes(k))) return { intent: r.intent, answer: r.answer, suggestEscalation: false, link: r.link };
  }
  return {
    intent: "unknown",
    answer: "Mình chưa có câu trả lời phù hợp cho câu hỏi này. Bạn có muốn chuyển cuộc trò chuyện tới nhân viên Scentory không?",
    suggestEscalation: true,
    link: "/hop-thu",
  };
}
