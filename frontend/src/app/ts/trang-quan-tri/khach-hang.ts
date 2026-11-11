import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DonHang, HoSo, NguoiDung, NHAN_TRANG_THAI } from '../dich-vu/kieu';
import { TienPipe, NgayPipe } from '../dich-vu/dinh-dang';
import { MAU_DON } from './dung-chung-qt';

type KH = NguoiDung & { orderCount: number; totalSpent: number };

/** Quản lý khách hàng — UC-USR-001 (FR-USR-ADM-001..002): khóa cần lý do, thu hồi phiên ngay (BR-SEC-003); không khóa admin. */
@Component({ selector: 'app-quan-ly-khach-hang', standalone: true, imports: [RouterLink, FormsModule, TienPipe, NgayPipe], templateUrl: '../../html/trang-quan-tri/khach-hang.html' })
export class QuanLyKhachHang implements OnInit {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  nhan = NHAN_TRANG_THAI; mau = MAU_DON;
  ds = signal<KH[]>([]);
  q = ''; tt = '';
  xem = signal<(NguoiDung & { scentProfile: HoSo | null; orders: DonHang[] }) | null>(null);
  khoa = signal<KH | null>(null);
  lyDo = '';
  ngOnInit() { this.tai(); }
  async tai() { this.ds.set(await this.api.get<KH[]>('/admin/users', { q: this.q || undefined, status: this.tt || undefined }).catch(() => [])); }
  async moXem(u: KH) { this.xem.set(await this.api.get(`/admin/users/${u.id}`)); }
  async doiTT(u: KH, status: 'Active' | 'Blocked', reason?: string) {
    try {
      await this.api.patch(`/admin/users/${u.id}/status`, { status, reason });
      this.tb.thanhCong(status === 'Blocked' ? 'Đã khóa tài khoản' : 'Đã mở khóa', u.fullName);
      this.khoa.set(null); this.lyDo = ''; this.tai();
    } catch (e) { this.tb.loi('Không thực hiện được', (e as LoiUngDung).message); }
  }
  xacNhanKhoa() { const u = this.khoa(); if (!u) return; if (!this.lyDo.trim()) { this.tb.loi('Thiếu lý do', 'Nhập lý do khóa tài khoản.'); return; } this.doiTT(u, 'Blocked', this.lyDo.trim()); }
}
