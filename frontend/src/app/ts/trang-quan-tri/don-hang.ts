import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../dich-vu/api.service';
import { DonHang, NHAN_THANH_TOAN, NHAN_TRANG_THAI } from '../dich-vu/kieu';
import { TienPipe, NgayPipe } from '../dich-vu/dinh-dang';
import { MAU_DON, MAU_TT } from './dung-chung-qt';

/** Quản lý đơn hàng — UC-ORD-004 (FR-ORD-ADM-001): lọc trạng thái, tìm theo mã/khách/SĐT, phân trang 20. */
@Component({ selector: 'app-quan-ly-don-hang', standalone: true, imports: [RouterLink, FormsModule, TienPipe, NgayPipe], templateUrl: '../../html/trang-quan-tri/don-hang.html' })
export class QuanLyDonHang implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  nhan = NHAN_TRANG_THAI; nhanTT = NHAN_THANH_TOAN; mau = MAU_DON; mauTT = MAU_TT;
  ds = signal<DonHang[]>([]);
  dem = signal<Record<string, number>>({});
  tt = signal(''); q = '';
  trang = signal(1); tong = signal(0);
  soTrang = computed(() => Math.max(1, Math.ceil(this.tong() / 20)));
  readonly tabs = ['', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
  ngOnInit() { this.tt.set(this.route.snapshot.queryParamMap.get('trangThai') ?? ''); this.tai(1); }
  async tai(trang = 1) {
    const r = await this.api.getFull<DonHang[]>('/admin/orders', { status: this.tt() || undefined, q: this.q || undefined, page: trang, limit: 20 });
    this.ds.set(r.data); this.dem.set(r.meta?.['counts'] ?? {}); this.tong.set(r.meta?.['total'] ?? 0); this.trang.set(trang);
  }
  tongDem() { return Object.values(this.dem()).reduce((a, b) => a + b, 0); }
  chonTab(t: string) { this.tt.set(t); this.tai(1); }
  dsTrang() { return Array.from({ length: this.soTrang() }, (_, i) => i + 1); }
}
