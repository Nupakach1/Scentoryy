import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { SanPham, ThuongHieu } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

/** Chi tiết thương hiệu — UC-CAT-004 (FR-CAT-BRD-002): câu chuyện, bộ sưu tập lọc theo nhóm hương. */
@Component({
  selector: 'app-chi-tiet-thuong-hieu',
  standalone: true,
  imports: [RouterLink, TienPipe],
  templateUrl: '../../html/trang-khach/chi-tiet-thuong-hieu.html',
})
export class ChiTietThuongHieu {
  slug = input.required<string>();
  private api = inject(ApiService);
  private gio = inject(GioHangService);
  yt = inject(YeuThichService);
  private tb = inject(ThongBaoService);
  anh = anhSP;
  th = signal<ThuongHieu | null>(null);
  loi = signal('');
  loc = signal('');
  nhomCo = computed(() => [...new Set((this.th()?.products ?? []).map((p) => p.family))]);
  spLoc = computed(() => (this.th()?.products ?? []).filter((p) => !this.loc() || p.family === this.loc()));
  doanVan = computed(() => (this.th()?.description ?? '').split(/(?<=\.)\s+(?=[A-ZĐÀ-Ỹ])/).reduce<string[]>((a, c, i) => { const k = Math.floor(i / 3); a[k] = (a[k] ? a[k] + ' ' : '') + c; return a; }, []));
  anhDoc = computed(() => this.th()?.imageUrl.replace('-ngang', '-doc') ?? '');

  constructor() {
    this.yt.tai();
    effect(() => { const s = this.slug(); this.loi.set(''); this.loc.set('');
      this.api.get<ThuongHieu>(`/brands/${encodeURIComponent(s)}`).then((b) => this.th.set(b)).catch((e: LoiUngDung) => this.loi.set(e.message)); }, { allowSignalWrites: true });
  }
  async them(p: SanPham) {
    try { if (await this.gio.them(p, 1)) this.tb.hien('Đã thêm vào giỏ hàng', p.name, 'success', '/gio-hang', 'Xem giỏ hàng →'); }
    catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
}
