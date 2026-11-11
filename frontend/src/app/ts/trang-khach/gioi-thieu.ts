import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../dich-vu/api.service';

/** Trang giới thiệu Scentory (nội dung tĩnh, số liệu danh mục lấy từ API). */
@Component({ selector: 'app-gioi-thieu', standalone: true, imports: [RouterLink], templateUrl: '../../html/trang-khach/gioi-thieu.html' })
export class GioiThieu implements OnInit {
  private api = inject(ApiService);
  so = signal({ nhom: 6, sp: 0, th: 6 });
  async ngOnInit() {
    const [f, p, b] = await Promise.all([
      this.api.get<unknown[]>('/scent-families').catch(() => []),
      this.api.getFull<unknown[]>('/products', { limit: 1 }).catch(() => ({ meta: { total: 0 } }) as any),
      this.api.get<unknown[]>('/brands').catch(() => []),
    ]);
    this.so.set({ nhom: f.length, sp: p.meta?.total ?? 0, th: b.length });
  }
  hai(n: number) { return String(n).padStart(2, '0'); }
}
