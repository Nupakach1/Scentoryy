import { Injectable, signal } from '@angular/core';

/**
 * Hộp thoại "Đăng nhập để …" (giao diện gốc: showAuthGate trong header.js).
 * Khách chưa đăng nhập bấm Thêm vào giỏ / Yêu thích / Scent Quiz → hiện hộp thoại thay vì chuyển trang.
 */
@Injectable({ providedIn: 'root' })
export class CongDangNhapService {
  /** Null = đóng; còn lại là hành động hiển thị trong tiêu đề và trang quay về sau khi đăng nhập. */
  mo = signal<{ hanhDong: string; next: string } | null>(null);
  hien(hanhDong: string, next: string) { this.mo.set({ hanhDong, next }); }
  dong() { this.mo.set(null); }
}
