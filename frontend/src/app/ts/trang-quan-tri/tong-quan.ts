import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DonHang, NHAN_TRANG_THAI, SanPham } from '../dich-vu/kieu';
import { TienPipe, NgayPipe } from '../dich-vu/dinh-dang';
import { MAU_DON } from './dung-chung-qt';

interface Dash {
  revenue: number; totalOrders: number; ordersByStatus: Record<string, number>; newCustomers: number; totalProducts: number;
  lowStock: SanPham[]; topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
  recentOrders: DonHang[]; pendingReturns: number; unreadMessages: number; daily: Array<{ date: string; orders: number; amount: number }>;
}

/** Tổng quan — UC-DASH-001 (FR-DASH-KPI-001..003): doanh thu thuần = đơn DELIVERED − hoàn tiền (BR-DASH-001). */
@Component({ selector: 'app-tong-quan', standalone: true, imports: [RouterLink, FormsModule, TienPipe, NgayPipe], templateUrl: '../../html/trang-quan-tri/tong-quan.html' })
export class TongQuan implements OnInit {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  d = signal<Dash | null>(null);
  tu = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  den = new Date().toISOString().slice(0, 10);
  nhan = NHAN_TRANG_THAI; mau = MAU_DON;
  maxNgay = computed(() => Math.max(1, ...(this.d()?.daily ?? []).map((x) => x.amount)));
  ngOnInit() { this.tai(); }
  async tai() {
    try { this.d.set(await this.api.get<Dash>('/admin/dashboard', { from: this.tu, to: this.den + 'T23:59:59' })); }
    catch (e) { this.tb.loi('Không tải được số liệu', (e as LoiUngDung).message); }
  }
  trangThai() { return Object.entries(this.d()?.ordersByStatus ?? {}); }
}
