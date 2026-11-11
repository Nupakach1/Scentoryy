import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter, interval, merge } from 'rxjs';
import { ApiService } from '../dich-vu/api.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GiaoDienService } from '../dich-vu/giao-dien.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ThoiGianThucService } from '../dich-vu/thoi-gian-thuc.service';

/** Số đếm hiện trên menu: đơn chờ xử lý, đổi trả chờ duyệt, tin chưa đọc. */
type SoDem = { orders: number; returns: number; messages: number };

/** Khung phân hệ quản trị — dùng bộ CSS quan-tri.css, menu kèm huy hiệu số đếm cập nhật theo thời gian thực. */
@Component({
  selector: 'app-khung-quan-tri',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: '../../html/bo-cuc/khung-quan-tri.html',
})
export class KhungQuanTri implements OnInit, OnDestroy {
  xt = inject(XacThucService);
  tb = inject(ThongBaoService);
  private gd = inject(GiaoDienService);
  private rt = inject(ThoiGianThucService);
  private api = inject(ApiService);
  private router = inject(Router);
  private sub?: Subscription;
  so = signal<SoDem>({ orders: 0, returns: 0, messages: 0 });
  viet = computed(() => (this.xt.nguoiDung()?.fullName ?? 'A').split(/\s+/).slice(-2).map((s) => s[0]).join('').toUpperCase());
  /** [đường dẫn, biểu tượng, tên mục, khóa số đếm] */
  readonly menu: Array<[string, string, string, keyof SoDem | '']> = [
    ['tong-quan', '◧', 'Tổng quan', ''], ['san-pham', '◇', 'Sản phẩm', ''], ['don-hang', '▤', 'Đơn hàng', 'orders'],
    ['doi-tra', '↺', 'Đổi trả', 'returns'], ['khach-hang', '◉', 'Khách hàng', ''], ['hop-thu', '✉', 'Hộp thư', 'messages'],
    ['danh-gia-goi-y', '✦', 'Đánh giá gợi ý', ''],
  ];
  readonly goiY: Record<keyof SoDem, string> = { orders: 'đơn chờ xử lý', returns: 'yêu cầu chờ duyệt', messages: 'tin chưa đọc' };
  dem(k: keyof SoDem | '') { return k ? this.so()[k] : 0; }
  hienSo(n: number) { return n > 99 ? '99+' : String(n); }
  ngOnInit() {
    this.gd.dungBo('quan-tri');
    this.gd.datBody('qt-trang');
    this.rt.ketNoi();
    this.rt.tinMoi.subscribe((m) => { if (m.to === null) this.tb.hien('Tin nhắn mới từ khách hàng', m.content.slice(0, 80), 'info', '/admin/hop-thu', 'Mở hộp thư'); });
    this.taiSo();
    // Tải lại khi: có sự kiện realtime, có tin mới, chuyển trang, hoặc định kỳ 30 giây
    this.sub = merge(this.rt.lamMoiSo, this.rt.tinMoi, this.router.events.pipe(filter((e) => e instanceof NavigationEnd)), interval(30_000))
      .subscribe(() => this.taiSo());
  }
  ngOnDestroy() { this.sub?.unsubscribe(); }
  async taiSo() {
    const s = await this.api.get<SoDem>('/admin/badges').catch(() => null);
    if (s) this.so.set(s);
  }
  dangXuat() { this.rt.ngat(); this.xt.dangXuat('/admin/dang-nhap'); }
}
