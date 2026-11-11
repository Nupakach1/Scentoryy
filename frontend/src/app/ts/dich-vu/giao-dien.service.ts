import { Injectable } from '@angular/core';

/**
 * Đổi body class theo trang (CSS customer-ui định danh bằng body class)
 * và đổi bộ CSS giữa phân hệ khách hàng / quản trị để hai bộ không xung đột.
 */
@Injectable({ providedIn: 'root' })
export class GiaoDienService {
  private boHienTai = 'khach-hang';
  datBody(lop: string) { document.body.className = lop || ''; }
  dungBo(bo: 'khach-hang' | 'quan-tri') {
    if (bo === this.boHienTai) return;
    this.boHienTai = bo;
    const link = document.getElementById('gd-css') as HTMLLinkElement | null;
    if (link) link.href = `${bo}.css`;
  }
}
