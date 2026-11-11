import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DonHang } from '../dich-vu/kieu';

const LY_DO = [
  ['Tôi muốn thay đổi mùi hương khác / kích thước chai', 'Cố vấn Scentory sẵn lòng gợi ý nốt hương thay thế phù hợp với phong cách của bạn.'],
  ['Tôi muốn thay đổi địa chỉ hoặc số điện thoại nhận hàng', 'Bạn có thể cập nhật sổ địa chỉ rồi đặt lại đơn mới.'],
  ['Tôi tìm thấy ưu đãi tốt hơn / đổi ý không muốn mua nữa', 'Được lựa chọn nhiều nhất bởi khách hàng cân nhắc lại ngân sách.'],
  ['Lý do khác', 'Vui lòng nêu rõ bên dưới để chúng tôi kịp thời cải thiện.'],
];

/** Hộp thoại hủy đơn — UC-ORD-003 (FR-ORD-CNL-001): chỉ khi PROCESSING (BR-ORD-002), hoàn tồn kho và hoàn tiền nếu đã thanh toán. */
@Component({
  selector: 'app-hop-thoai-huy-don',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="cancel-backdrop sc-modal" (click)="dong.emit()">
    <div class="cancel-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <button class="dialog-close" (click)="dong.emit()" aria-label="Đóng">×</button>
      <div class="dialog-title"><span>▱</span><div><p>HỦY ĐƠN HÀNG TRỰC TUYẾN</p><h1>Xác nhận yêu cầu hủy đơn hàng</h1></div></div>
      <div class="dialog-info">ⓘ　Đơn hàng <b>#{{ don().orderCode }}</b> đang ở trạng thái <b>“Đang xử lý”</b> (chưa bàn giao đơn vị vận chuyển) nên có thể hủy trực tiếp.
        @if (don().paymentStatus === 'PAID') { Số tiền đã thanh toán sẽ được <b>hoàn lại</b>. }</div>
      <h3>VUI LÒNG CHỌN LÝ DO HỦY ĐƠN <sup>*</sup></h3>
      <p class="dialog-lede">Phản hồi của bạn giúp Scentory hoàn thiện dịch vụ tốt hơn mỗi ngày.</p>
      @for (l of lyDo; track l[0]; let i = $index) {
        <label class="reason" [class.selected]="chon() === l[0]" [class.green]="i === 2" (click)="chon.set(l[0])" style="cursor:pointer"><b>{{ chon() === l[0] ? '●' : '○' }}　{{ l[0] }}</b><span>{{ l[1] }}</span></label>
      }
      <h3>GHI CHÚ CHI TIẾT {{ chon() === 'Lý do khác' ? '*' : '(TÙY CHỌN)' }}</h3>
      <textarea class="dialog-textarea" [(ngModel)]="ghiChu" maxlength="200" rows="3" style="width:100%;box-sizing:border-box;font:inherit" placeholder="Chia sẻ thêm lý do để Scentory hoàn thiện dịch vụ..."></textarea>
      @if (loi()) { <p style="color:#c51d1d;font-size:12px">{{ loi() }}</p> }
      <div class="dialog-warning">⚠　<b>Lưu ý:</b> Sau khi xác nhận hủy, đơn hàng dừng xử lý ngay lập tức và không thể khôi phục.</div>
      <div class="dialog-actions"><button (click)="dong.emit()">Giữ lại đơn hàng</button><button class="danger" (click)="xacNhan()" [disabled]="dang()">▣　{{ dang() ? 'Đang hủy…' : 'Xác nhận hủy đơn hàng' }}</button></div>
    </div>
  </div>`,
})
export class HopThoaiHuyDon {
  don = input.required<DonHang>();
  dong = output<void>();
  daHuy = output<DonHang>();
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  lyDo = LY_DO;
  chon = signal(LY_DO[0][0]);
  ghiChu = '';
  loi = signal('');
  dang = signal(false);
  async xacNhan() {
    if (this.chon() === 'Lý do khác' && !this.ghiChu.trim()) { this.loi.set('Vui lòng nhập ghi chú khi chọn “Lý do khác”.'); return; }
    this.dang.set(true);
    try {
      const d = await this.api.post<DonHang>(`/orders/${this.don().id}/cancellation`, { reason: this.chon(), note: this.ghiChu.trim() || undefined });
      this.tb.thanhCong('Đã hủy đơn hàng', `Đơn ${d.orderCode} đã được hủy.`);
      this.daHuy.emit(d);
    } catch (e) { this.loi.set((e as LoiUngDung).message); } finally { this.dang.set(false); }
  }
}
