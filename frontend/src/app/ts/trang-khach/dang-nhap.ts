import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { LoiUngDung } from '../dich-vu/api.service';

/** Đăng nhập — UC-AUTH-002 (FR-AUTH-LGN-001): sai 5 lần/15 phút bị khóa tạm (BR-AUTH-003); giỏ và hồ sơ tạm được hợp nhất. */
@Component({ selector: 'app-dang-nhap', standalone: true, imports: [RouterLink, FormsModule], templateUrl: '../../html/trang-khach/dang-nhap.html' })
export class DangNhap {
  private xt = inject(XacThucService);
  private tb = inject(ThongBaoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  matKhau = '';
  hien = signal(false);
  loi = signal<{ tieuDe: string; noiDung: string } | null>(null);
  loiTruong = signal<Record<string, string>>({});
  dang = signal(false);
  readonly thamSo = this.route.snapshot.queryParams;

  async gui() {
    const l: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(this.email.trim())) l['email'] = 'Email không đúng định dạng.';
    if (!this.matKhau) l['password'] = 'Vui lòng nhập mật khẩu.';
    this.loiTruong.set(l);
    if (Object.keys(l).length) return;
    this.dang.set(true); this.loi.set(null);
    try {
      await this.xt.dangNhap(this.email.trim(), this.matKhau);
      this.tb.thanhCong('Đăng nhập thành công', `Chào mừng ${this.xt.nguoiDung()?.fullName} trở lại Scentory.`);
      const next = this.route.snapshot.queryParamMap.get('next');
      this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (e) {
      const x = e as LoiUngDung;
      this.loi.set({ tieuDe: x.code === 'ERR-AUTH-423-01' ? 'Tài khoản tạm khóa' : x.code === 'ERR-AUTH-403-01' ? 'Tài khoản bị khóa' : 'Đăng nhập không thành công', noiDung: x.message });
    } finally { this.dang.set(false); }
  }
}
