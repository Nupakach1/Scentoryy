import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { LoiUngDung } from '../dich-vu/api.service';
import { DongGio } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

/**
 * Giỏ hàng — UC-CART-001 (FR-CART-ADD/UPD/DEL/SEL-001): chọn dòng để thanh toán, đổi số lượng (1–10, ≤ tồn kho, BR-CART-002), xóa.
 */
@Component({ selector: 'app-gio-hang', standalone: true, imports: [RouterLink, TienPipe], templateUrl: '../../html/trang-khach/gio-hang.html' })
export class GioHangTrang implements OnInit {
  g = inject(GioHangService);
  private tb = inject(ThongBaoService);
  private xt = inject(XacThucService);
  private router = inject(Router);
  anh = anhSP;
  daChon = computed(() => this.g.gio().items.filter((i) => this.g.chon().has(i.id)));
  tamTinh = computed(() => this.daChon().reduce((s, i) => s + i.lineTotal, 0));
  soChai = computed(() => this.daChon().reduce((s, i) => s + i.quantity, 0));
  tatCa = computed(() => this.g.gio().items.length > 0 && this.daChon().length === this.g.gio().items.length);

  ngOnInit() { this.g.tai().catch(() => undefined); }
  chonTatCa(on: boolean) { this.g.chon.set(new Set(on ? this.g.gio().items.map((i) => i.id) : [])); }
  async doi(d: DongGio, v: number) {
    if (!Number.isFinite(v)) return;
    if (v > d.maxQuantity) this.tb.loi('Vượt giới hạn', `Tối đa ${d.maxQuantity} sản phẩm cho dòng này.`);
    try { await this.g.doiSoLuong(d, v); } catch (e) { this.tb.loi('Không cập nhật được', (e as LoiUngDung).message); }
  }
  async xoa(d: DongGio) {
    try { await this.g.xoa(d); this.tb.hien('Đã xóa khỏi giỏ', d.product.name); } catch (e) { this.tb.loi('Không xóa được', (e as LoiUngDung).message); }
  }
  thanhToan() {
    if (!this.daChon().length) { this.tb.loi('Chưa chọn sản phẩm', 'Hãy chọn ít nhất một sản phẩm để thanh toán.'); return; }
    if (this.daChon().some((d) => d.product.stock === 0)) { this.tb.loi('Có sản phẩm hết hàng', 'Bỏ chọn sản phẩm đã hết hàng trước khi thanh toán.'); return; }
    if (!this.xt.daDangNhap()) { this.tb.hien('Cần đăng nhập', 'Đăng nhập để thanh toán — giỏ hàng tạm sẽ được giữ nguyên.'); this.router.navigate(['/dang-nhap'], { queryParams: { next: '/thanh-toan' } }); return; }
    this.router.navigate(['/thanh-toan']);
  }
}
