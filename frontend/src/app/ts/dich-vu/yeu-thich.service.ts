import { Injectable, inject, signal } from '@angular/core';
import { CongDangNhapService } from './cong-dang-nhap.service';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { XacThucService } from './xac-thuc.service';
import { ThongBaoService } from './thong-bao.service';
import { SanPham } from './kieu';

/** Danh sách yêu thích (UC-ACC-001, BR-ACC-004). */
@Injectable({ providedIn: 'root' })
export class YeuThichService {
  private api = inject(ApiService);
  private xt = inject(XacThucService);
  private tb = inject(ThongBaoService);
  private router = inject(Router);
  private cong = inject(CongDangNhapService);
  ids = signal<Set<string>>(new Set());
  async tai(): Promise<SanPham[]> {
    await this.xt.taiPhien();
    if (!this.xt.daDangNhap() || this.xt.laAdmin()) { this.ids.set(new Set()); return []; }
    const ds = await this.api.get<Array<{ product: SanPham }>>('/wishlist');
    this.ids.set(new Set(ds.map((x) => x.product.id)));
    return ds.map((x) => x.product);
  }
  co(id: string) { return this.ids().has(id); }
  async batTat(p: SanPham) {
    await this.xt.taiPhien();
    if (!this.xt.daDangNhap()) { this.cong.hien('yêu thích', this.router.url); return; }
    const co = this.co(p.id);
    if (co) await this.api.delete(`/wishlist/items/${p.id}`); else await this.api.put(`/wishlist/items/${p.id}`);
    this.ids.update((s) => { const n = new Set(s); co ? n.delete(p.id) : n.add(p.id); return n; });
    this.tb.hien(co ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích', p.name, co ? 'info' : 'success');
  }
}
