import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../dich-vu/api.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { LoiUngDung } from '../dich-vu/api.service';
import { NhomHuong, SanPham } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

/** Trang chủ — banner, nhóm hương chủ đạo, sản phẩm nổi bật (UC-CAT-001), lời mời Scent Quiz (UC-QUIZ-001). */
@Component({
  selector: 'app-trang-chu',
  standalone: true,
  imports: [RouterLink, TienPipe],
  templateUrl: '../../html/trang-khach/trang-chu.html',
})
export class TrangChu implements OnInit, OnDestroy {
  private api = inject(ApiService);
  gio = inject(GioHangService);
  yt = inject(YeuThichService);
  private tb = inject(ThongBaoService);
  anh = anhSP;

  slide = signal(0);
  nhom = signal<NhomHuong[]>([]);
  tongNhom = signal(8);
  sanPham = signal<SanPham[]>([]);
  tab = signal<'name' | 'bestseller' | 'newest' | 'price_asc'>('bestseller');
  luaChonMo = signal(1);
  private hen?: ReturnType<typeof setInterval>;

  readonly slides = [
    { cls: 'hero-slide-perfume', tag: '● HAUTE PARFUMERIE & SCENT PROFILE', h: ['CHÀO MỪNG ĐẾN VỚI', 'SCENTORY'], link: '/nuoc-hoa', nut: 'KHÁM PHÁ NƯỚC HOA →',
      p: 'Scentory là nền tảng mua sắm nước hoa niche chính hãng, tuyển chọn các tác phẩm từ Le Labo, Byredo, Diptyque, Dior Privée, Maison Margiela và Creed. Khám phá nốt hương, so sánh các mùi hương và chọn chai signature của riêng bạn.', trust: true },
    { cls: 'hero-slide-families', tag: '● KHẢO LUẬN KHỨU GIÁC', h: ['KHÁM PHÁ CÁC', 'NHÓM HƯƠNG'], link: '/nhom-huong', nut: 'XEM NHÓM HƯƠNG →',
      p: 'Từ gỗ trầm ấm, hoa cỏ thanh tao đến thảo mộc tươi mát và hổ phách nồng nàn. Tìm hiểu bản đồ mùi hương để biết gu của bạn thuộc về nhóm nào.' },
    { cls: 'hero-slide-quiz', tag: '● SCENT MATCH AI™', h: ['TÌM MÙI HƯƠNG', 'SIGNATURE CỦA BẠN'], link: '/scent-quiz/buoc/1', nut: 'LÀM SCENT QUIZ →',
      p: 'Trả lời 8 câu hỏi ngắn về phong cách, cảm xúc và thói quen. Scent Match AI™ sẽ lập hồ sơ khứu giác và gợi ý những chai phù hợp nhất với bạn.' },
    { cls: 'hero-slide-brands', tag: '● NHÀ CHẾ TÁC MÙI HƯƠNG', h: ['NHỮNG NHÀ ĐIỀU HƯƠNG', 'DANH TIẾNG'], link: '/thuong-hieu', nut: 'XEM THƯƠNG HIỆU →',
      p: 'Le Labo, Byredo, Diptyque, Maison Margiela, Dior Privée, Creed. Những thương hiệu niche được tuyển chọn kỹ, nguồn gốc rõ ràng và hoàn toàn chính hãng.' },
  ];
  readonly luaChon = [
    ['RỪNG SƯƠNG MÙ TĨNH MỊCH', 'Mùi gỗ thông ẩm ướt, đá lạnh và rêu phong thanh khiết.'],
    ['THƯ VIỆN GỖ SỒI CỔ ĐIỂN', 'Trang sách cũ, hổ phách ấm và ánh nến le lói trầm mặc.'],
    ['VƯỜN CAM CHANH ĐỊA TRUNG HẢI', 'Vỏ cam rực rỡ, lá sung tươi ngái và hoa nở trong nắng sớm.'],
    ['BỜ BIỂN ĐÁ LỘNG GIÓ', 'Muối khoáng mặn mòi, rong biển tươi và gió đại dương.'],
  ];
  readonly lopNhom = ['fc-wood', 'fc-floral', 'fc-fresh', 'fc-smoke'];

  async ngOnInit() {
    this.hen = setInterval(() => this.chuyen(1), 6000);
    this.api.get<NhomHuong[]>('/scent-families').then((d) => { this.tongNhom.set(d.length); this.nhom.set([...d].sort((a, b) => b.productCount - a.productCount).slice(0, 4)); }).catch(() => undefined);
    this.yt.tai();
    await this.taiSP();
  }
  ngOnDestroy() { clearInterval(this.hen); }
  chuyen(b: number) { this.slide.update((s) => (s + b + this.slides.length) % this.slides.length); }
  bamChuyen(b: number) { clearInterval(this.hen); this.chuyen(b); this.hen = setInterval(() => this.chuyen(1), 6000); }
  async doiTab(t: 'name' | 'bestseller' | 'newest' | 'price_asc') { this.tab.set(t); await this.taiSP(); }
  async taiSP() { this.sanPham.set(await this.api.get<SanPham[]>('/products', { sort: this.tab(), limit: 3 }).catch(() => [])); }
  notes(p: SanPham) { return p.topNotes.split(',').concat(p.middleNotes.split(',')).map((s) => s.trim()).filter(Boolean).slice(0, 3); }
  mua(p: SanPham) {
    const f = p.family;
    if (/Citrus|Aquatic/.test(f)) return ['☀', 'Mùa hè • Ngày nắng (> 28°C)'];
    if (/Floral/.test(f)) return ['🌸', 'Mùa xuân • Nắng ấm (20 - 30°C)'];
    if (/Amber|Woody/.test(f)) return ['❄', 'Thu Đông • Đêm lạnh (< 24°C)'];
    return ['🌙', 'Đêm tiệc • Bốn mùa'];
  }
  async them(p: SanPham) {
    try { if (await this.gio.them(p, 1)) this.tb.hien('Đã thêm vào giỏ hàng', p.name, 'success', '/gio-hang', 'Xem giỏ hàng →'); }
    catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
}
