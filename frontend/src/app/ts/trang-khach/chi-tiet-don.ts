import { Component, OnDestroy, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DongDon, DonHang, NHAN_DOI_TRA, NHAN_PHUONG_THUC, NHAN_THANH_TOAN } from '../dich-vu/kieu';
import { TienPipe, NgayPipe, anhSP } from '../dich-vu/dinh-dang';
import { conHanDoiTra, mocDon } from '../dich-vu/theo-doi-don';
import { HopThoaiHuyDon } from '../dung-chung/hop-thoai-huy-don';
import { HopThoaiDanhGia } from '../dung-chung/hop-thoai-danh-gia';

/**
 * Chi tiết đơn — UC-ORD-002 (FR-ORD-HIS-002): mốc trạng thái, thanh toán, giao nhận; hủy (UC-ORD-003),
 * thanh toán QR còn hạn (BR-PAY-002), đánh giá từng sản phẩm (UC-REV-001), đổi trả 7 ngày (UC-RET-001).
 */
@Component({ selector: 'app-chi-tiet-don', standalone: true, imports: [RouterLink, TienPipe, NgayPipe, HopThoaiHuyDon, HopThoaiDanhGia], templateUrl: '../../html/trang-khach/chi-tiet-don.html' })
export class ChiTietDon implements OnDestroy {
  id = input.required<string>();
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  private route = inject(ActivatedRoute);
  router = inject(Router);
  anh = anhSP;
  nhanTT = NHAN_PHUONG_THUC; nhanTToan = NHAN_THANH_TOAN; nhanDT = NHAN_DOI_TRA;
  d = signal<DonHang | null>(null);
  loi = signal('');
  moi = signal(false);
  huy = signal(false);
  danhGia = signal<DongDon | null>(null);
  conLai = signal(0);
  private hen?: ReturnType<typeof setInterval>;

  m = computed(() => (this.d() ? mocDon(this.d()!) : null));
  hanDoiTra = computed(() => (this.d() ? conHanDoiTra(this.d()!) : 0));
  tone = computed(() => ({ PROCESSING: 'od-tone-pending', SHIPPING: 'od-tone-shipping', DELIVERED: 'od-tone-done', CANCELLED: 'od-tone-cancelled' })[this.d()?.status ?? 'PROCESSING']);
  choQR = computed(() => { const d = this.d(); return !!d && d.paymentMethod === 'QR' && d.paymentStatus === 'PENDING' && d.status === 'PROCESSING'; });

  constructor() {
    this.moi.set(this.route.snapshot.queryParamMap.get('moi') === '1');
    effect(() => { this.tai(this.id()); }, { allowSignalWrites: true });
  }
  ngOnDestroy() { clearInterval(this.hen); }
  async tai(id: string) {
    try {
      const d = await this.api.get<DonHang>(`/orders/${id}`);
      this.d.set(d);
      clearInterval(this.hen);
      if (this.choQR()) { const tick = () => this.conLai.set(Math.max(0, Math.floor((new Date(d.paymentExpiresAt!).getTime() - Date.now()) / 1000))); tick(); this.hen = setInterval(tick, 1000); }
      const dg = this.route.snapshot.queryParamMap.get('danhGia');
      if (dg && d.status === 'DELIVERED') { const i = d.items?.find((x) => x.productId === dg); if (i && !this.daDanhGia(i)) this.danhGia.set(i); }
    } catch (e) { this.loi.set((e as LoiUngDung).message); }
  }
  daDanhGia(i: DongDon) { return !!this.d()?.reviews?.some((r) => r.productId === i.productId); }
  soSP() { return (this.d()?.items ?? []).reduce((s, i) => s + i.quantity, 0); }
  dongHo() { const s = this.conLai(); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  async xacNhanQR() {
    try { const d = await this.api.post<DonHang>(`/orders/${this.id()}/payments/qr/confirm`, {}); this.tb.thanhCong('Đã ghi nhận thanh toán', d.orderCode); this.tai(this.id()); }
    catch (e) { this.tb.loi('Không xác nhận được', (e as LoiUngDung).message); this.tai(this.id()); }
  }
  sauHuy() { this.huy.set(false); this.tai(this.id()); }
  sauDanhGia() { this.danhGia.set(null); this.router.navigate([], { queryParams: {}, replaceUrl: true }); this.tai(this.id()); }
}
