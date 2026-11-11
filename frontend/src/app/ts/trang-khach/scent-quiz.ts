import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizService } from '../dich-vu/quiz.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { LoiUngDung } from '../dich-vu/api.service';
import { CauTraLoiQuiz } from '../dich-vu/kieu';

type Khoa = keyof CauTraLoiQuiz;
interface LuaChon { gt: any; tieuDe: string; phu: string; mo: string; the: string[]; anh: string; nhan?: string; lop?: string; huy?: string }

const A = (f: string) => `/hinh-anh/nhom-huong/${f}.webp`;
/** Bảy câu hỏi của Scent Quiz (BR-QUIZ-001) — khóa trùng QuizAnswersSchema phía backend. */
export const CAU_HOI: Array<{ khoa: Khoa; kicker: string; h1: string; lede: string; ds: LuaChon[] }> = [
  { khoa: 'style', kicker: 'HỒ SƠ CẢM QUAN', h1: 'Phong cách hương dành cho bạn?', lede: 'Hãy cho Scentory biết phong cách tôn vinh cá tính khứu giác của bạn nhất.', ds: [
    { gt: 'feminine', tieuDe: 'Hương Nữ Tính', phu: 'FEMININE', mo: 'Dịu dàng, thanh khiết hòa quyện cùng nét quyến rũ kiêu kỳ', the: [], anh: A('floral'), nhan: 'FLORAL · GOURMAND · SILK', lop: 'photo-feminine' },
    { gt: 'masculine', tieuDe: 'Hương Nam Tính', phu: 'MASCULINE', mo: 'Mạnh mẽ, ấm áp cùng chiều sâu phong trần lịch lãm', the: [], anh: A('woody'), nhan: 'WOODY · AMBER · SMOKE', lop: 'photo-masculine' },
  ] },
  { khoa: 'includeUnisex', kicker: 'ĐỊNH HÌNH PHONG CÁCH KHỨU GIÁC', h1: 'Bạn có muốn khám phá thêm nốt hương Unisex?', lede: 'Nước hoa Niche thường vượt qua ranh giới giới tính truyền thống để tôn vinh bản sắc và xúc cảm độc bản của người mặc.', ds: [
    { gt: true, tieuDe: 'Bao gồm cả hương Unisex', phu: 'Mở rộng trải nghiệm đa tầng', mo: 'Mở rộng không gian khám phá với những sáng tạo phá cách, phong phú và sâu lắng từ các bậc thầy điều hương.', the: ['Gỗ đàn hương', 'Hổ phách xám', 'Cam bergamot & Khói'], anh: '/hinh-anh/san-pham/ll-001-2.webp', huy: 'Đa tầng & Nghệ thuật' },
    { gt: false, tieuDe: 'Chỉ chọn hương riêng biệt theo phong cách trên', phu: '', mo: 'Tập trung vào các nốt hương kinh điển thuần nữ tính hoặc nam tính sắc bén theo lựa chọn ban đầu của bạn.', the: ['Hoa trắng & Phấn mềm', 'Trầm hương & Da thuộc'], anh: '/hinh-anh/san-pham/dt-001-2.webp', huy: 'Cổ điển & Chọn lọc' },
  ] },
  { khoa: 'tone', kicker: 'BẢN ĐỒ KHỨU GIÁC CÁ NHÂN', h1: 'Tông hương bạn thường hướng về?', lede: 'Chọn phong thái tổng thể mà bạn cảm thấy kết nối và rung cảm nhất khi hương thơm chạm nhẹ lên làn da.', ds: [
    { gt: 'warm_opulent', tieuDe: 'Ấm Áp & Sâu Lắng', phu: 'Warm & Opulent', mo: 'Hổ phách, Vani kem béo, Gỗ quý', the: ['Hổ Phách', 'Vani Kem Béo', 'Gỗ Quý'], anh: A('oriental'), nhan: 'NHÓM NỐT NỒNG NÀN', lop: 'warm' },
    { gt: 'fresh_clean', tieuDe: 'Tươi Mát & Rực Rỡ', phu: 'Fresh & Clean', mo: 'Cam chanh, Hoa cỏ giọt sương, Khoáng chất', the: ['Cam Chanh', 'Hoa Cỏ Giọt Sương', 'Khoáng Chất'], anh: A('citrus'), nhan: 'NHÓM NỐT KHÍ SẮC', lop: 'fresh' },
  ] },
  { khoa: 'mood', kicker: 'KHÔNG GIAN CẢM XÚC & KHÍ CHẤT', h1: 'Tâm trạng bạn muốn thiết lập qua mùi hương?', lede: 'Mùi hương là trang phục cảm xúc vô hình, dẫn lối tâm trạng của bạn trong không gian và khắc họa ấn tượng đầu tiên.', ds: [
    { gt: 'night_party', tieuDe: 'Tinh Tế & Sang Trọng', phu: 'Sophisticated', mo: 'Cấu trúc hương đa tầng, sâu sắc, hợp tiệc tối và những buổi hẹn hò.', the: ['Hổ phách', 'Hoa hồng Damask', 'Gỗ đàn hương'], anh: A('chypre'), nhan: 'HƯƠNG ĐÊM & YẾN TIỆC', lop: 'night' },
    { gt: 'day_energy', tieuDe: 'Vui Tươi & Phóng Khoáng', phu: 'Playful', mo: 'Những nốt hương nhẹ bẫng, tràn đầy năng lượng cho ngày dài ở công sở.', the: ['Cam Bergamot', 'Trái sung', 'Linh lan trắng'], anh: A('aromatic'), nhan: 'BAN NGÀY & TỰ DO', lop: 'day' },
    { gt: 'mindful_relax', tieuDe: 'Thư Thái & Tĩnh Tại', phu: 'Mindful', mo: 'Hương êm, sạch và gần gũi cho thời gian thư giãn, du lịch hay những ngày chậm rãi.', the: ['Trà trắng', 'Xạ hương', 'Gỗ tuyết tùng'], anh: A('fougere'), nhan: 'THƯ GIÃN & DU HÀNH', lop: 'day' },
  ] },
  { khoa: 'aura', kicker: 'KHẮC HỌA DẤU ẤN KHỨU GIÁC', h1: 'Thần thái bạn muốn tỏa ra?', lede: 'Dấu ấn vô hình bạn để lại trong tâm trí người đối diện mỗi khi bước qua.', ds: [
    { gt: 'bold', tieuDe: 'Táo Bạo & Khác Biệt', phu: 'Bold', mo: 'Mùi hương tỏa sáng mạnh mẽ, lưu luyến khó phai dành cho cá tính bản lĩnh.', the: ['♨ Nồng nàn, Sâu lắng  •  ⌁ Tỏa hương xa'], anh: A('fougere'), lop: 'bold' },
    { gt: 'soft', tieuDe: 'Dịu Dàng & Tinh Khôi', phu: 'Soft', mo: 'Mùi hương êm dịu, thanh khiết, tạo cảm giác thân mật cho chính bạn và người bên cạnh.', the: ['♧ Thanh khiết, Sát da  •  ♧ Thoang thoảng gần gũi'], anh: A('floral'), lop: 'soft' },
  ] },
  { khoa: 'habit', kicker: 'HÀNH TRÌNH ĐỊNH DANH PHONG CÁCH KHỨU GIÁC', h1: 'Thói quen sử dụng nước hoa của bạn?', lede: 'Hiểu được nhịp sống và tần suất xịt hương giúp Scentory gợi ý dung tích cùng độ bám tỏa tối ưu nhất cho riêng bạn.', ds: [
    { gt: 'scent_shifter', tieuDe: 'Người Biến Hóa Mùi Hương', phu: 'The Scent-Shifter', mo: 'Thích phối lớp hương và đổi mùi linh hoạt theo tâm trạng, trang phục hoặc tiết trời.', the: ['Gợi ý: nhiều chai nhỏ', 'Dung tích 50ml', 'Hương biến chuyển'], anh: A('gourmand'), nhan: 'KHÁM PHÁ & THỬ NGHIỆM', lop: 'discovery' },
    { gt: 'daily_spritzer', tieuDe: 'Hương Thơm Chữ Ký Hàng Ngày', phu: 'The Daily Spritzer', mo: 'Trung thành với một mùi hương biểu trưng, vài nốt xịt mỗi sáng để tự tin suốt ngày dài.', the: ['Gợi ý: Signature Bottle', 'Dung tích 100ml', 'Độ lưu hương lâu'], anh: A('woody'), nhan: 'DẤU ẤN CÁ NHÂN', lop: 'signature' },
  ] },
  { khoa: 'age', kicker: 'TỐI ƯU HÓA HỒ SƠ KHỨU GIÁC', h1: 'Độ tuổi của bạn?', lede: 'Scentory dùng thông tin độ tuổi để tối ưu phong cách gợi ý phù hợp nhất.', ds: [] },
];
const NHOM_TUOI: Array<[string, number]> = [['Dưới 22', 20], ['22 – 29', 26], ['30 – 39', 34], ['40 – 49', 44], ['50+', 55]];

/**
 * Scent Quiz 7 câu / 8 bước (UC-QUIZ-001, FR-QUIZ-ANS-001..003): câu 1–7 rồi bước phân tích.
 * Không cho bỏ qua câu bắt buộc (BR-QUIZ-001); câu trả lời giữ trong phiên để quay lại không mất.
 */
@Component({
  selector: 'app-scent-quiz',
  standalone: true,
  imports: [RouterLink],
  templateUrl: '../../html/trang-khach/scent-quiz.html',
})
export class ScentQuiz {
  buoc = input.required<string>();
  q = inject(QuizService);
  private router = inject(Router);
  private tb = inject(ThongBaoService);
  nhomTuoi = NHOM_TUOI;
  n = computed(() => Math.min(7, Math.max(1, Number(this.buoc()) || 1)));
  cau = computed(() => CAU_HOI[this.n() - 1]);
  chon = computed(() => (this.q.traLoi() as any)[this.cau().khoa]);
  tuoi = computed(() => (this.q.traLoi().age as number | undefined) ?? 27);
  dangGui = false;

  hai(n: number) { return String(n).padStart(2, '0'); }
  dsBuoc() { return [1, 2, 3, 4, 5, 6, 7]; }
  chonGT(gt: any) {
    this.q.dat(this.cau().khoa, gt);
    setTimeout(() => this.tiep(), 280);
  }
  datTuoi(t: number) { this.q.dat('age', Math.max(16, Math.min(80, t))); }
  lui() { this.n() > 1 ? this.router.navigate(['/scent-quiz/buoc', this.n() - 1]) : this.router.navigate(['/']); }
  async tiep() {
    if (this.chon() === undefined && this.cau().khoa !== 'age') { this.tb.loi('Chưa chọn đáp án', 'Vui lòng chọn một phương án để tiếp tục.'); return; }
    if (this.n() < 7) { this.router.navigate(['/scent-quiz/buoc', this.n() + 1]); return; }
    if (this.q.traLoi().age === undefined) this.datTuoi(this.tuoi());
    const thieu = CAU_HOI.findIndex((c) => (this.q.traLoi() as any)[c.khoa] === undefined);
    if (thieu >= 0) { this.tb.loi('Còn câu chưa trả lời', `Hãy hoàn thành câu ${thieu + 1} trước khi xem kết quả.`); this.router.navigate(['/scent-quiz/buoc', thieu + 1]); return; }
    if (this.dangGui) return;
    this.dangGui = true;
    try { await this.q.gui(); this.router.navigate(['/scent-quiz/phan-tich']); }
    catch (e) { this.tb.loi('Không lưu được hồ sơ', (e as LoiUngDung).message); }
    finally { this.dangGui = false; }
  }
}
