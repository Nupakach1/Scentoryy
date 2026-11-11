import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { XacThucService } from '../dich-vu/xac-thuc.service';

/** Thanh điều hướng tài khoản `.account-side` dùng chung cho các trang UC-ORD-002, UC-RET-001, UC-ACC-001/002, UC-MSG-001. */
@Component({
  selector: 'app-thanh-tai-khoan',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
  <aside class="account-side">
    <div class="avatar">{{ viet() }}</div>
    <h3>{{ xt.nguoiDung()?.fullName }}</h3>
    <p>{{ xt.nguoiDung()?.email }}</p>
    <nav>
      <a routerLink="/tai-khoan/don-hang" routerLinkActive="active" [class.active]="muc() === 'don'">Đơn hàng của tôi</a>
      <a routerLink="/tai-khoan/don-hang" [queryParams]="{ trangThai: 'DELIVERED' }" [class.active]="muc() === 'doi-tra'">Đổi trả &amp; hoàn tiền</a>
      <a routerLink="/tai-khoan/so-dia-chi" routerLinkActive="active">Sổ địa chỉ</a>
      <a routerLink="/yeu-thich" routerLinkActive="active">Danh sách yêu thích</a>
      <a routerLink="/hop-thu" routerLinkActive="active">Hộp thư với Shop</a>
      <a routerLink="/scent-quiz/ho-so" routerLinkActive="active">Scent Profile</a>
    </nav>
    <a class="logout" href="javascript:void(0)" (click)="xt.dangXuat()" style="cursor: pointer;">Đăng xuất</a>
  </aside>`,
})
export class ThanhTaiKhoan {
  xt = inject(XacThucService);
  muc = input<'don' | 'doi-tra' | ''>('');
  viet = computed(() => (this.xt.nguoiDung()?.fullName ?? '?').split(/\s+/).filter(Boolean).slice(-2).map((s) => s[0]).join('').toUpperCase());
}
