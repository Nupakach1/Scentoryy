import { Component, OnInit, computed, inject, input, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { QuizService } from '../dich-vu/quiz.service';
import { ViTriService } from '../dich-vu/vi-tri.service';
import { DanhGia, KetQuaMatch, SanPham } from '../dich-vu/kieu';
import { TienPipe, NgayPipe, anhSP, anhSP2 } from '../dich-vu/dinh-dang';

const DOT: Record<string, number> = { 'Ngắn': 2, 'Vừa': 3, 'Lâu': 4, 'Nhẹ': 2, 'Mạnh': 5 };
const GIO: Record<string, string> = { 'Ngắn': '2 – 4 giờ', 'Vừa': '4 – 6 giờ', 'Lâu': '6 – 8 giờ' };
const TOA: Record<string, string> = { 'Nhẹ': 'Sát da', 'Vừa': 'Một sải tay', 'Mạnh': 'Lan tỏa cả phòng' };
const NHAN_TC: Record<string, string> = { family: '✦', projection: '◉', occasion: '✧', volume: '◇', weather: '☀' };
const NHAN_THUC_TE: Record<string, string> = { LOWER: 'Nhẹ hơn mô tả', MATCH: 'Đúng như mô tả', HIGHER: 'Mạnh hơn mô tả' };

/**
 * Chi tiết sản phẩm — UC-CAT-002: giá, tồn kho, tháp hương, phân tích Scent Match (FR-CAT-DTL-002),
 * đánh giá (FR-CAT-DTL-003), ghi nhận lượt xem (FR-CAT-DTL-004), thêm giỏ/mua ngay (UC-CART-001, UC-ORD-001).
 */
@Component({
  selector: 'app-chi-tiet-san-pham',
  standalone: true,
  imports: [RouterLink, TienPipe, NgayPipe],
  templateUrl: '../../html/trang-khach/chi-tiet-san-pham.html',
})
export class ChiTietSanPham implements OnInit {
  sku = input.required<string>();
  private api = inject(ApiService);
  private router = inject(Router);
  xt = inject(XacThucService);
  private gio = inject(GioHangService);
  yt = inject(YeuThichService);
  private tb = inject(ThongBaoService);
  private quiz = inject(QuizService);
  private vt = inject(ViTriService);

  sp = signal<SanPham | null>(null);
  loi = signal('');
  anhChinh = signal('');
  sl = signal(1);
  match = signal<KetQuaMatch | null>(null);
  danhGia = signal<DanhGia[]>([]);
  diemTB = signal(0);
  thoiTiet = signal<{ temperature: number; label: string; hint: string } | null>(null);
  nhanThucTe = NHAN_THUC_TE;
  anhSP2 = anhSP2;

  anhs = computed(() => { const p = this.sp(); return p ? [anhSP(p), ...p.galleryUrls].filter((v, i, a) => a.indexOf(v) === i) : []; });
  tang = computed(() => {
    const p = this.sp(); if (!p) return [];
    const t = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    return [
      { so: '01', ten: 'Hương đầu', phu: 'Khởi đầu', gio: '0 — 30 phút', notes: t(p.topNotes), mo: 'Lớp hương đầu tiên chạm tới khứu giác, tươi sáng và bay hơi nhanh nhất.', track: 'left:0%;width:6%' },
      { so: '02', ten: 'Hương giữa', phu: 'Linh hồn', gio: '30 phút — 4 giờ', notes: t(p.middleNotes), mo: 'Trái tim của mùi hương, định hình cá tính khi hương đầu lắng xuống.', track: 'left:4%;width:36%' },
      { so: '03', ten: 'Hương cuối', phu: 'Dấu ấn lưu', gio: '4 — 12 giờ', notes: t(p.baseNotes), mo: 'Nền hương sâu và bền, đọng lại trên da và vải suốt nhiều giờ.', track: 'left:30%;width:70%' },
    ];
  });
  phanBo = computed(() => {
    const ds = this.danhGia(); const n = ds.length || 1;
    return [5, 4, 3, 2, 1].map((s) => ({ s, pct: Math.round((ds.filter((d) => d.overallRating === s).length / n) * 100) }));
  });
  hopThoiTiet = computed(() => {
    const f = this.sp()?.family ?? '';
    if (/Citrus|Aquatic/.test(f)) return { icon: '☀', tieuDe: 'Hợp trời nắng / nóng ẩm', mo: 'Nốt hương tươi, nhẹ và thoáng — dễ chịu khi nhiệt độ cao và độ ẩm lớn.' };
    if (/Floral/.test(f)) return { icon: '◐', tieuDe: 'Hợp trời ấm dịu', mo: 'Hương hoa mềm mại, bung tỏa đẹp nhất trong tiết trời xuân dịu nắng.' };
    return { icon: '❄', tieuDe: 'Hợp trời mát / se lạnh', mo: 'Nốt hương ấm và có chiều sâu, tỏa đẹp hơn khi nhiệt độ dịu hoặc dùng vào buổi tối.' };
  });

  constructor() { effect(() => { const s = this.sku(); if (s) this.tai(s); }, { allowSignalWrites: true }); }
  ngOnInit() { this.yt.tai(); }

  async tai(sku: string) {
    this.loi.set(''); this.sp.set(null); this.match.set(null); this.sl.set(1);
    try {
      const p = await this.api.get<SanPham>(`/products/${encodeURIComponent(sku)}`);
      this.sp.set(p); this.anhChinh.set(anhSP(p));
      window.scrollTo({ top: 0 });
    } catch (e) { this.loi.set((e as LoiUngDung).message); return; }
    const p = this.sp()!;
    this.api.getFull<DanhGia[]>('/reviews', { productId: p.id }).then((r) => { this.danhGia.set(r.data); this.diemTB.set(r.meta?.['avgRating'] ?? 0); }).catch(() => undefined);
    const vt = await this.vt.lay();
    this.api.get<any>('/weather', vt).then((w) => this.thoiTiet.set(w)).catch(() => undefined);
    await this.xt.taiPhien();
    if (this.xt.daDangNhap() && !this.xt.laAdmin()) {
      this.api.post('/interactions', { productId: p.id, actionType: 'view' }).catch(() => undefined);
      if (this.xt.nguoiDung()?.hasScentProfile) this.match.set(await this.api.get<KetQuaMatch>(`/match/products/${p.id}`, vt).catch(() => null));
    } else if (!this.xt.daDangNhap()) {
      const r = await this.quiz.goiY(12, { ...vt }).catch(() => null);
      this.match.set(r?.data.find((x) => x.product.id === p.id) ?? null);
    }
  }
  sao(n: number) { const r = Math.round(n); return '★'.repeat(r) + '☆'.repeat(5 - r); }
  dots(v: string) { const n = DOT[v] ?? 3; return [0, 1, 2, 3, 4].map((i) => i < n); }
  gio_(v: string) { return GIO[v] ?? v; }
  toa(v: string) { return TOA[v] ?? v; }
  icon(k: string) { return NHAN_TC[k] ?? '✦'; }
  vong() { const c = 2 * Math.PI * 52; return { c, off: c * (1 - (this.match()?.matchScore ?? 0) / 100) }; }
  nhanMatch(s: number) { return s >= 80 ? 'Rất hợp với bạn' : s >= 60 ? 'Đáng để trải nghiệm' : s >= 40 ? 'Có thể thử' : 'Ít tương thích'; }
  doiSL(d: number) { const p = this.sp(); if (p) this.sl.set(Math.max(1, Math.min(Math.min(10, p.stock), this.sl() + d))); }
  async them() {
    const p = this.sp()!;
    try { if (await this.gio.them(p, this.sl())) this.tb.hien('Đã thêm vào giỏ hàng', `${p.name} × ${this.sl()}`, 'success', '/gio-hang', 'Xem giỏ hàng →'); }
    catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
  muaNgay() {
    const p = this.sp()!;
    this.router.navigate(['/thanh-toan'], { queryParams: { muaNgay: p.id, sl: this.sl() } });
  }
}
