import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GiaoDienService } from '../dich-vu/giao-dien.service';
import { LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';

/** Đăng ký — UC-AUTH-001 (FR-AUTH-REG-001..003): email duy nhất (BR-AUTH-001), mật khẩu 8–64 ký tự có chữ và số (BR-AUTH-002). */
@Component({ selector: 'app-dang-ky', standalone: true, imports: [RouterLink, FormsModule], templateUrl: '../../html/trang-khach/dang-ky.html' })
export class DangKy {
  xt = inject(XacThucService);
  private gd = inject(GiaoDienService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private tb = inject(ThongBaoService);
  readonly thamSo = this.route.snapshot.queryParams;
  f = { fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '', acceptTerms: false };
  hien = signal(false);
  loiTruong = signal<Record<string, string>>({});
  loiChung = signal('');
  dang = signal(false);
  xong = signal(false);

  private kiemTra() {
    const l: Record<string, string> = {}; const f = this.f;
    if (f.fullName.trim().length < 2) l['fullName'] = 'Vui lòng nhập họ và tên (2–100 ký tự).';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) l['email'] = 'Email không đúng định dạng.';
    if (f.phoneNumber && !/^\+?\d{9,15}$/.test(f.phoneNumber.replace(/\s/g, ''))) l['phoneNumber'] = 'Số điện thoại 9–15 chữ số.';
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(f.password)) l['password'] = 'Mật khẩu 8–64 ký tự, gồm ít nhất một chữ cái và một chữ số.';
    if (f.confirmPassword !== f.password) l['confirmPassword'] = 'Mật khẩu nhập lại không khớp.';
    if (!f.acceptTerms) l['acceptTerms'] = 'Bạn cần đồng ý điều khoản dịch vụ.';
    this.loiTruong.set(l);
    return !Object.keys(l).length;
  }
  async gui() {
    this.loiChung.set('');
    if (!this.kiemTra()) { this.loiChung.set('Vui lòng kiểm tra và hoàn thiện các mục được đánh dấu bên dưới.'); return; }
    this.dang.set(true);
    try {
      await this.xt.dangKy({ ...this.f, fullName: this.f.fullName.trim(), email: this.f.email.trim(), phoneNumber: this.f.phoneNumber.replace(/\s/g, '') || undefined });
      // Đến từ "Thêm vào giỏ" / Scent Quiz → quay lại đúng trang đang xem
      const next = this.route.snapshot.queryParamMap.get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        this.tb.thanhCong('Tạo tài khoản thành công', `Chào mừng ${this.xt.nguoiDung()?.fullName} đến với Scentory.`);
        this.router.navigateByUrl(next);
        return;
      }
      this.xong.set(true);
      this.gd.datBody('auth-final-page');
      window.scrollTo({ top: 0 });
    } catch (e) {
      const x = e as LoiUngDung;
      const l: Record<string, string> = {};
      for (const d of x.details ?? []) l[d.field] = d.message;
      if (x.code === 'ERR-AUTH-409-01') l['email'] = 'Email này đã được đăng ký. Hãy đăng nhập hoặc khôi phục mật khẩu.';
      this.loiTruong.set(l); this.loiChung.set(x.message);
    } finally { this.dang.set(false); }
  }
}
