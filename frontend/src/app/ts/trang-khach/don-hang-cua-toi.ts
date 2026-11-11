import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DonHang, NHAN_PHUONG_THUC } from '../dich-vu/kieu';
import { TienPipe, NgayPipe, anhSP } from '../dich-vu/dinh-dang';
import { conHanDoiTra, mocDon } from '../dich-vu/theo-doi-don';
import { ThanhTaiKhoan } from '../dung-chung/thanh-tai-khoan';
import { HopThoaiHuyDon } from '../dung-chung/hop-thoai-huy-don';

type Tab = 'ALL' | 'PROCESSING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

/** Đơn hàng của tôi — UC-ORD-002 (FR-ORD-HIS-001): lọc theo trạng thái, theo dõi 4 mốc, hủy (UC-ORD-003), đổi trả (UC-RET-001), mua lại. */
@Component({ selector: 'app-don-hang-cua-toi', standalone: true, imports: [RouterLink, TienPipe, NgayPipe, ThanhTaiKhoan, HopThoaiHuyDon], templateUrl: '../../html/trang-khach/don-hang-cua-toi.html' })
export class DonHangCuaToi implements OnInit {
  private api = inject(ApiService);
  private gio = inject(GioHangService);
  private tb = inject(ThongBaoService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  anh = anhSP;
  moc = mocDon;
  hanDoiTra = conHanDoiTra;
  nhanTT = NHAN_PHUONG_THUC;
  ds = signal<DonHang[]>([]);
  dem = signal<Record<string, number>>({ ALL: 0, PROCESSING: 0, SHIPPING: 0, DELIVERED: 0, CANCELLED: 0 });
  tab = signal<Tab>('ALL');
  trang = signal(1); tong = signal(0);
  dangTai = signal(true);
  huy = signal<DonHang | null>(null);
  tongChi = signal(0);
  readonly tabs: Array<[Tab, string]> = [['ALL', 'Tất cả'], ['PROCESSING', 'Đang xử lý'], ['SHIPPING', 'Đang giao'], ['DELIVERED', 'Đã giao'], ['CANCELLED', 'Đã hủy']];
  soTrang = computed(() => Math.max(1, Math.ceil(this.tong() / 10)));

  async ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('trangThai') as Tab | null;
    if (t && this.tabs.some((x) => x[0] === t)) this.tab.set(t);
    await this.tai();
  }
  async tai(trang = 1) {
    this.dangTai.set(true);
    try {
      const r = await this.api.getFull<DonHang[]>('/orders', { status: this.tab() === 'ALL' ? undefined : this.tab(), page: trang, limit: 10 });
      this.ds.set(r.data); this.dem.set(r.meta?.['counts'] ?? this.dem()); this.tong.set(r.meta?.['total'] ?? r.data.length); this.trang.set(trang);
      if (this.tab() === 'ALL' && trang === 1) this.tongChi.set(r.data.filter((d) => d.status !== 'CANCELLED').reduce((s, d) => s + d.totalAmount, 0));
    } catch (e) { this.tb.loi('Không tải được đơn hàng', (e as LoiUngDung).message); }
    finally { this.dangTai.set(false); }
  }
  doiTab(t: Tab) { this.tab.set(t); this.router.navigate([], { queryParams: { trangThai: t === 'ALL' ? null : t }, replaceUrl: true }); this.tai(1); }
  soChai(d: DonHang) { return (d.items ?? []).reduce((s, i) => s + i.quantity, 0); }
  async muaLai(d: DonHang) {
    try {
      for (const i of d.items ?? []) if (i.product && i.product.isActive && i.product.stock > 0) await this.gio.them(i.product, i.quantity);
      this.tb.hien('Đã thêm lại vào giỏ', `Các sản phẩm còn hàng của đơn ${d.orderCode}`, 'success', '/gio-hang', 'Xem giỏ hàng →');
    } catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
  daHuy() { this.huy.set(null); this.tai(this.trang()); }
  trangSo() { return Array.from({ length: this.soTrang() }, (_, i) => i + 1); }
}
