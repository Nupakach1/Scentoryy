import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { NguoiDung } from './kieu';

/** Phiên đăng nhập (UC-AUTH-001..004). Token nằm trong cookie httpOnly — client chỉ giữ thông tin người dùng. */
@Injectable({ providedIn: 'root' })
export class XacThucService {
  private api = inject(ApiService);
  private router = inject(Router);
  nguoiDung = signal<NguoiDung | null>(null);
  daTai = signal(false);
  daDangNhap = computed(() => !!this.nguoiDung());
  laAdmin = computed(() => this.nguoiDung()?.role === 'admin');
  private dangTai: Promise<void> | null = null;
  /** Hook để giỏ/quiz đồng bộ dữ liệu tạm sau khi đăng nhập (BR-ACC-002, BR-QUIZ-004). */
  sauDangNhap: Array<() => Promise<void>> = [];

  taiPhien(): Promise<void> {
    this.dangTai ??= this.api.get<NguoiDung>('/auth/me')
      .then((u) => this.nguoiDung.set(u))
      .catch(() => this.nguoiDung.set(null))
      .finally(() => this.daTai.set(true));
    return this.dangTai;
  }
  async capNhat() { this.dangTai = null; await this.taiPhien(); }

  private async hoanTat(u: NguoiDung) {
    this.nguoiDung.set(u);
    for (const f of this.sauDangNhap) await f().catch(() => undefined);
    await this.capNhat();
  }
  async dangNhap(email: string, password: string) { await this.hoanTat(await this.api.post<NguoiDung>('/auth/login', { email, password })); }
  async dangNhapAdmin(email: string, password: string) { this.nguoiDung.set(await this.api.post<NguoiDung>('/auth/admin/sessions', { email, password })); }
  async dangKy(b: { fullName: string; email: string; phoneNumber?: string; password: string; confirmPassword: string; acceptTerms: boolean }) {
    await this.hoanTat(await this.api.post<NguoiDung>('/auth/register', b));
  }
  async dangXuat(den = '/') {
    await this.api.post('/auth/logout').catch(() => undefined);
    this.nguoiDung.set(null);
    this.router.navigateByUrl(den);
  }
}
