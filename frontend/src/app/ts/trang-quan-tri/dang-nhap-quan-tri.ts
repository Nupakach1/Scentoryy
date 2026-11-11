import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GiaoDienService } from '../dich-vu/giao-dien.service';
import { LoiUngDung } from '../dich-vu/api.service';

/** Đăng nhập quản trị — UC-AUTH-004 (FR-AUTH-ADM-001): cổng riêng, chỉ vai trò admin (BR-SEC-001). */
@Component({ selector: 'app-dang-nhap-quan-tri', standalone: true, imports: [FormsModule, RouterLink], templateUrl: '../../html/trang-quan-tri/dang-nhap-quan-tri.html' })
export class DangNhapQuanTri implements OnInit {
  private xt = inject(XacThucService);
  private gd = inject(GiaoDienService);
  private router = inject(Router);
  email = ''; matKhau = '';
  loi = signal(''); dang = signal(false);
  async ngOnInit() {
    this.gd.dungBo('quan-tri'); this.gd.datBody('qt-trang');
    await this.xt.taiPhien();
    if (this.xt.laAdmin()) this.router.navigateByUrl('/admin/tong-quan');
  }
  async gui() {
    if (!this.email.trim() || !this.matKhau) { this.loi.set('Nhập email và mật khẩu.'); return; }
    this.dang.set(true); this.loi.set('');
    try { await this.xt.dangNhapAdmin(this.email.trim(), this.matKhau); this.router.navigateByUrl('/admin/tong-quan'); }
    catch (e) { this.loi.set((e as LoiUngDung).message); }
    finally { this.dang.set(false); }
  }
}
