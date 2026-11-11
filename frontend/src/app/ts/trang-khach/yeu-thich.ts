import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { SanPham } from '../dich-vu/kieu';
import { TheSanPham } from '../dung-chung/the-san-pham';

/** Danh sách yêu thích — UC-ACC-001 (FR-ACC-WSH-001..002); thao tác yêu thích là tín hiệu hành vi cho hồ sơ (BR-MTCH-005). */
@Component({ selector: 'app-yeu-thich', standalone: true, imports: [RouterLink, TheSanPham], templateUrl: '../../html/trang-khach/yeu-thich.html' })
export class YeuThich implements OnInit {
  yt = inject(YeuThichService);
  goc = signal<SanPham[]>([]);
  dangTai = signal(true);
  ds = computed(() => this.goc().filter((p) => this.yt.co(p.id)));
  async ngOnInit() { try { this.goc.set(await this.yt.tai()); } finally { this.dangTai.set(false); } }
}
