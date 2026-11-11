import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SanPham, TieuChi } from '../dich-vu/kieu';
import { TienPipe, anhSP, anhSP2 } from '../dich-vu/dinh-dang';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { LoiUngDung } from '../dich-vu/api.service';

/** Thẻ sản phẩm `.catalog-card` (UC-CAT-001), hiển thị điểm Scent Match khi có hồ sơ (BR-MTCH-004). */
@Component({
  selector: 'app-the-san-pham',
  standalone: true,
  imports: [RouterLink, TienPipe],
  templateUrl: '../../html/dung-chung/the-san-pham.html',
})
export class TheSanPham {
  sp = input.required<SanPham>();
  diem = input<number | null>(null);
  tieuChi = input<TieuChi[] | null>(null);
  gio = inject(GioHangService);
  yt = inject(YeuThichService);
  private tb = inject(ThongBaoService);
  anh = anhSP;
  anh2 = anhSP2;
  thoiTiet() { return this.tieuChi()?.find((t) => t.key === 'weather' && t.score != null) ?? null; }
  bieuTuong(s: number) { return s >= 1 ? '☀' : s >= 0.5 ? '◐' : '❄'; }
  async them() {
    try {
      if (!(await this.gio.them(this.sp(), 1))) return;
      this.tb.hien('Đã thêm vào giỏ hàng', this.sp().name, 'success', '/gio-hang', 'Xem giỏ hàng →');
    } catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
}
