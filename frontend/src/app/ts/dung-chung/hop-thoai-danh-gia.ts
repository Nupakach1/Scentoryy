import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DongDon } from '../dich-vu/kieu';
import { anhSP } from '../dich-vu/dinh-dang';

/** Đánh giá sản phẩm — UC-REV-001 (FR-REV-CRT-001): chỉ đơn DELIVERED, mỗi sản phẩm/đơn một lần (BR-REV-001), phản hồi độ tỏa thực tế cập nhật hồ sơ (BR-MTCH-005). */
@Component({
  selector: 'app-hop-thoai-danh-gia',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="cancel-backdrop sc-modal" (click)="dong.emit()">
    <div class="cancel-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <button class="dialog-close" (click)="dong.emit()" aria-label="Đóng">×</button>
      <div class="dialog-title"><span>★</span><div><p>ĐÁNH GIÁ SẢN PHẨM</p><h1>{{ dong_().productName }}</h1></div></div>
      <div class="dialog-info" style="display:flex;gap:14px;align-items:center"><img [src]="anh(dong_().product)" alt="" style="width:56px;height:56px;object-fit:contain">
        <span>{{ dong_().product?.brand }} · {{ dong_().product?.concentration }} {{ dong_().product?.volume }}ml</span></div>
      <h3>MỨC ĐỘ HÀI LÒNG <sup>*</sup></h3>
      <div class="sc-stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="s <= sao()" (click)="sao.set(s)" [attr.aria-label]="s + ' sao'">★</button> }</div>
      <h3>ĐỘ TỎA HƯƠNG THỰC TẾ SO VỚI MÔ TẢ</h3>
      <p class="dialog-lede">Phản hồi này giúp Scent Match hiệu chỉnh độ tỏa ưa thích trong hồ sơ của bạn.</p>
      @for (o of doToa; track o[0]) { <label class="reason" [class.selected]="toa() === o[0]" (click)="toa.set(o[0])" style="cursor:pointer"><b>{{ toa() === o[0] ? '●' : '○' }}　{{ o[1] }}</b></label> }
      <h3>ĐIỂM SCENT MATCH CÓ ĐÚNG VỚI CẢM NHẬN? (TÙY CHỌN)</h3>
      <div class="sc-stars small">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="s <= khop()" (click)="khop.set(s)">★</button> }</div>
      <h3>NHẬN XÉT (TỐI ĐA 500 KÝ TỰ)</h3>
      <textarea class="dialog-textarea" [(ngModel)]="noiDung" maxlength="500" rows="4" style="width:100%;box-sizing:border-box;font:inherit" placeholder="Chia sẻ cảm nhận về mùi hương, độ lưu hương..."></textarea>
      <small style="color:#888">{{ noiDung.length }}/500</small>
      @if (loi()) { <p style="color:#c51d1d;font-size:12px">{{ loi() }}</p> }
      <div class="dialog-actions" style="margin-top:16px"><button (click)="dong.emit()">Để sau</button><button class="danger" style="background:#444d32" (click)="gui()" [disabled]="dang() || !sao()">{{ dang() ? 'Đang gửi…' : 'Gửi đánh giá' }}</button></div>
    </div>
  </div>`,
})
export class HopThoaiDanhGia {
  orderId = input.required<string>();
  dong_ = input.required<DongDon>({ alias: 'dongDon' });
  dong = output<void>();
  daGui = output<void>();
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  anh = anhSP;
  doToa = [['LOWER', 'Nhẹ hơn mô tả'], ['MATCH', 'Đúng như mô tả'], ['HIGHER', 'Mạnh hơn mô tả']];
  sao = signal(5); toa = signal('MATCH'); khop = signal(0);
  noiDung = '';
  loi = signal(''); dang = signal(false);
  async gui() {
    this.dang.set(true); this.loi.set('');
    try {
      await this.api.post('/reviews', { orderId: this.orderId(), productId: this.dong_().productId, overallRating: this.sao(), actualProjection: this.toa(),
        matchScoreRating: this.khop() || undefined, reviewText: this.noiDung.trim() || undefined });
      this.tb.thanhCong('Cảm ơn bạn đã đánh giá', this.dong_().productName);
      this.daGui.emit();
    } catch (e) { this.loi.set((e as LoiUngDung).message); } finally { this.dang.set(false); }
  }
}
