import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ThongBaoService } from './thong-bao.service';
import { CongDangNhapService } from './cong-dang-nhap.service';
import { ApiService } from './api.service';
import { XacThucService } from './xac-thuc.service';
import { DongGio, GioHang, SanPham } from './kieu';

const KHOA = 'scentory_gio_tam';
/** Sản phẩm khách bấm "Thêm vào giỏ" khi chưa đăng nhập — tự thêm sau khi đăng nhập/đăng ký. */
const KHOA_CHO = 'scentory_cho_them_gio';
const MAX = 10;

/**
 * Giỏ hàng (UC-CART-001). Chỉ khách hàng đã đăng nhập mới thêm được vào giỏ (BR-CART-001):
 * khách vãng lai bấm "Thêm vào giỏ" → hộp thoại "Đăng nhập để giỏ hàng"; sản phẩm được tự thêm sau khi đăng nhập/đăng ký.
 * Giỏ tạm trên trình duyệt (phiên bản cũ) vẫn được hợp nhất nếu còn sót lại.
 */
@Injectable({ providedIn: 'root' })
export class GioHangService {
  private api = inject(ApiService);
  private xt = inject(XacThucService);
  private router = inject(Router);
  private tb = inject(ThongBaoService);
  private cong = inject(CongDangNhapService);
  gio = signal<GioHang>({ items: [], itemCount: 0, subtotal: 0 });
  soLuong = computed(() => this.gio().itemCount);
  /** id dòng được chọn để thanh toán */
  chon = signal<Set<string>>(new Set());

  constructor() {
    this.xt.sauDangNhap.push(async () => {
      const tam = this.docTam();
      if (tam.length) await this.api.post('/cart/merge', { items: tam.map((t) => ({ productId: t.product.id, quantity: t.quantity })) });
      localStorage.removeItem(KHOA);
      const cho = this.docCho();
      if (cho) {
        sessionStorage.removeItem(KHOA_CHO);
        try {
          await this.api.post('/cart/items', { productId: cho.id, quantity: cho.qty });
          this.tb.hien('Đã thêm vào giỏ hàng', cho.ten, 'success', '/gio-hang', 'Xem giỏ hàng →');
        } catch { /* hết hàng / ngừng bán: bỏ qua, khách tự thêm lại */ }
      }
      await this.tai();
    });
  }
  private docCho(): { id: string; qty: number; ten: string } | null { try { return JSON.parse(sessionStorage.getItem(KHOA_CHO) || 'null'); } catch { return null; } }
  private docTam(): DongGio[] { try { return JSON.parse(localStorage.getItem(KHOA) || '[]'); } catch { return []; } }
  private ghiTam(items: DongGio[]) {
    localStorage.setItem(KHOA, JSON.stringify(items));
    this.datGio({ items, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal: items.reduce((s, i) => s + i.lineTotal, 0) });
  }
  private datGio(g: GioHang) {
    this.gio.set(g);
    const ids = new Set(g.items.map((i) => i.id));
    const cur = [...this.chon()].filter((x) => ids.has(x));
    this.chon.set(new Set(cur.length || !g.items.length ? cur : g.items.map((i) => i.id)));
  }
  async tai() {
    await this.xt.taiPhien();
    if (this.xt.daDangNhap() && !this.xt.laAdmin()) this.datGio(await this.api.get<GioHang>('/cart'));
    else this.ghiTam(this.docTam());
  }
  /** Trả về true nếu đã thêm; false nếu khách chưa đăng nhập (đã hiện hộp thoại yêu cầu đăng nhập). */
  async them(p: SanPham, qty = 1): Promise<boolean> {
    await this.xt.taiPhien();
    if (!this.xt.daDangNhap()) {
      try { sessionStorage.setItem(KHOA_CHO, JSON.stringify({ id: p.id, qty, ten: p.name })); } catch { /* trình duyệt chặn lưu trữ */ }
      this.cong.hien('giỏ hàng', this.router.url);
      return false;
    }
    const g = await this.api.post<GioHang>('/cart/items', { productId: p.id, quantity: qty });
    this.datGio(g);
    const dong = g.items.find((i) => i.product.id === p.id);
    if (dong) this.chon.update((s) => new Set(s).add(dong.id));
    return true;
  }
  async doiSoLuong(d: DongGio, qty: number) {
    qty = Math.max(1, Math.min(d.maxQuantity, qty));
    if (this.xt.daDangNhap()) { this.datGio(await this.api.patch<GioHang>(`/cart/items/${d.id}`, { quantity: qty })); return; }
    const items = this.docTam().map((i) => (i.id === d.id ? { ...i, quantity: qty, lineTotal: qty * i.product.price } : i));
    this.ghiTam(items);
  }
  async xoa(d: DongGio) {
    if (this.xt.daDangNhap()) { this.datGio(await this.api.delete<GioHang>(`/cart/items/${d.id}`)); return; }
    this.ghiTam(this.docTam().filter((i) => i.id !== d.id));
  }
  datChon(id: string, on: boolean) { this.chon.update((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; }); }
  dongDaChon() { return this.gio().items.filter((i) => this.chon().has(i.id)); }
}
