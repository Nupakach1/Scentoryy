import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { XacThucService } from './xac-thuc.service';
import { CongDangNhapService } from './cong-dang-nhap.service';

/** Trang cần đăng nhập (khách hàng: giỏ hàng, Scent Quiz, thanh toán, tài khoản) — chuyển tới /dang-nhap?next=... (FR-AUTH-LGN-003). */
export const canDangNhap: CanActivateFn = async (_r, state) => {
  const xt = inject(XacThucService);
  const router = inject(Router); // phải lấy trước await — inject() chỉ hợp lệ trong ngữ cảnh đồng bộ
  await xt.taiPhien();
  if (xt.daDangNhap()) return true;
  return router.createUrlTree(['/dang-nhap'], { queryParams: { next: state.url } });
};

/**
 * Scent Quiz, giỏ hàng: chưa đăng nhập → ở lại trang hiện tại và hiện hộp thoại "Đăng nhập để …"
 * (giao diện gốc). Mở thẳng bằng đường dẫn thì về Trang chủ rồi hiện hộp thoại.
 */
export const canDangNhapHopThoai: CanActivateFn = async (_r, state) => {
  const xt = inject(XacThucService);
  const router = inject(Router);
  const cong = inject(CongDangNhapService);
  await xt.taiPhien();
  if (xt.daDangNhap()) return true;
  cong.hien(state.url.startsWith('/scent-quiz') ? 'làm Scent Quiz' : 'xem giỏ hàng', state.url);
  return router.navigated ? false : router.createUrlTree(['/']);
};

/** Trang quản trị — BR-SEC-006. */
export const canAdmin: CanActivateFn = async () => {
  const xt = inject(XacThucService);
  const router = inject(Router);
  await xt.taiPhien();
  return xt.laAdmin() ? true : router.createUrlTree(['/admin/dang-nhap']);
};
