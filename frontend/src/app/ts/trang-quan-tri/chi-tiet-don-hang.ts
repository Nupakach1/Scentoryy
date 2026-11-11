import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ThoiGianThucService } from '../dich-vu/thoi-gian-thuc.service';
import { DonHang, NHAN_DOI_TRA, NHAN_PHUONG_THUC, NHAN_THANH_TOAN, NHAN_TRANG_THAI } from '../dich-vu/kieu';
import { TienPipe, NgayPipe, anhSP } from '../dich-vu/dinh-dang';
import { CHUYEN_DON, MAU_DON, MAU_TT } from './dung-chung-qt';

/**
 * Chi tiết & cập nhật đơn — UC-ORD-004 (FR-ORD-ADM-002): chỉ chuyển trạng thái hợp lệ (BR-ORD-002);
 * sang SHIPPING cần mã vận đơn và đơn QR/Thẻ đã thanh toán; hủy hoàn tồn kho (BR-ORD-003).
 */
@Component({ selector: 'app-chi-tiet-don-hang-qt', standalone: true, imports: [RouterLink, FormsModule, TienPipe, NgayPipe], templateUrl: '../../html/trang-quan-tri/chi-tiet-don-hang.html' })
export class ChiTietDonHangQT {
  id = input.required<string>();
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  private rt = inject(ThoiGianThucService);
  anh = anhSP;
  nhan = NHAN_TRANG_THAI; nhanTT = NHAN_THANH_TOAN; nhanPT = NHAN_PHUONG_THUC; nhanDT = NHAN_DOI_TRA; mau = MAU_DON; mauTT = MAU_TT;
  d = signal<DonHang | null>(null);
  den = signal(''); maVD = ''; ghiChu = '';
  loi = signal('');
  constructor() { effect(() => { this.tai(this.id()); }, { allowSignalWrites: true }); }
  async tai(id: string) { this.d.set(await this.api.get<DonHang>(`/admin/orders/${id}`)); this.den.set(''); this.maVD = this.d()?.trackingCode ?? ''; }
  chuyen() { return CHUYEN_DON[this.d()?.status ?? 'DELIVERED']; }
  async capNhat() {
    if (!this.den()) return;
    this.loi.set('');
    try {
      const d = await this.api.patch<DonHang>(`/admin/orders/${this.id()}/status`, { status: this.den(), trackingCode: this.maVD.trim() || undefined, note: this.ghiChu.trim() || undefined });
      this.tb.thanhCong('Đã cập nhật trạng thái', `${d.orderCode} → ${this.nhan[d.status]}`);
      this.ghiChu = ''; this.tai(this.id()); this.rt.lamMoiSo.next();
    } catch (e) { this.loi.set((e as LoiUngDung).message); }
  }
}
