import { Component, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { GiaoDienService } from '../dich-vu/giao-dien.service';

/** Quên mật khẩu — UC-AUTH-003: email → OTP 6 số hiệu lực 3 phút, tối đa 5 lần nhập (BR-AUTH-004) → mật khẩu mới → hoàn tất. */
@Component({ selector: 'app-quen-mat-khau', standalone: true, imports: [RouterLink, FormsModule], templateUrl: '../../html/trang-khach/quen-mat-khau.html' })
export class QuenMatKhau implements OnDestroy {
  private api = inject(ApiService);
  private gd = inject(GiaoDienService);
  buoc = signal<1 | 2 | 3 | 4>(1);
  email = ''; otp = ''; mk = ''; mk2 = '';
  token = '';
  loi = signal('');
  dang = signal(false);
  conLai = signal(0);
  private hen?: ReturnType<typeof setInterval>;
  readonly tenBuoc = ['Nhập email', 'Mã xác thực OTP', 'Đặt lại mật khẩu', 'Hoàn tất'];

  ngOnDestroy() { clearInterval(this.hen); }
  private async chay(f: () => Promise<void>) {
    this.loi.set(''); this.dang.set(true);
    try { await f(); } catch (e) { this.loi.set((e as LoiUngDung).message); } finally { this.dang.set(false); }
  }
  guiEmail() {
    if (!/^\S+@\S+\.\S+$/.test(this.email.trim())) { this.loi.set('Email không đúng định dạng.'); return; }
    this.chay(async () => {
      const r = await this.api.post<{ expiresInSeconds: number; demoOtp?: string; demoMode?: boolean }>('/auth/password-resets', { email: this.email.trim() });
      // Chế độ demo (chưa có SMTP) mà không nhận được mã → email chưa đăng ký, báo ngay thay vì để người dùng chờ thư
      if (r.demoMode && !r.demoOtp) { this.loi.set('Email này chưa đăng ký tài khoản Scentory. Vui lòng kiểm tra lại hoặc đăng ký tài khoản mới.'); return; }
      this.buoc.set(2); this.demNguoc(r.expiresInSeconds ?? 180);
      // Chưa kết nối dịch vụ email → hiện hộp thoại OTP giả lập (giao diện gốc: showDemoOtpDialog)
      if (r.demoOtp && /^\d{6}$/.test(r.demoOtp)) { this.maDemo.set(r.demoOtp); this.moDemo.set(true); }
    });
  }
  private demNguoc(s: number) { clearInterval(this.hen); this.conLai.set(s); this.hen = setInterval(() => { this.conLai.update((v) => Math.max(0, v - 1)); if (!this.conLai()) clearInterval(this.hen); }, 1000); }
  /** Hộp thoại OTP giả lập */
  maDemo = signal('');
  moDemo = signal(false);
  daChep = signal('Sao chép mã');
  dienTuDong() { this.otp = this.maDemo(); this.moDemo.set(false); }
  async chepMa() {
    try { await navigator.clipboard.writeText(this.maDemo()); this.daChep.set('✓ Đã sao chép'); } catch { this.daChep.set('Không sao chép được'); }
    setTimeout(() => this.daChep.set('Sao chép mã'), 1800);
  }
  dongHoDemo() { const s = this.conLai(); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  dongHo() { const s = this.conLai(); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  xacThuc() {
    if (!/^\d{6}$/.test(this.otp.trim())) { this.loi.set('Mã OTP gồm 6 chữ số.'); return; }
    this.chay(async () => { const r = await this.api.post<{ resetToken: string }>('/auth/password-resets/verify', { email: this.email.trim(), otp: this.otp.trim() }); this.token = r.resetToken; this.buoc.set(3); });
  }
  datLai() {
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(this.mk)) { this.loi.set('Mật khẩu 8–64 ký tự, gồm ít nhất một chữ cái và một chữ số.'); return; }
    if (this.mk !== this.mk2) { this.loi.set('Mật khẩu nhập lại không khớp.'); return; }
    this.chay(async () => {
      await this.api.post('/auth/password-resets/confirm', { resetToken: this.token, newPassword: this.mk, confirmPassword: this.mk2 });
      this.buoc.set(4); this.gd.datBody('password-page success-password');
    });
  }
}
