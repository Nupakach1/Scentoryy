import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizService } from '../dich-vu/quiz.service';
import { ViTriService } from '../dich-vu/vi-tri.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { HoSo, KetQuaMatch, SanPham } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

/** Top 3 gợi ý Scent Match — UC-MTCH-001 (FR-MTCH-REC-001..003, BR-MTCH-001..004), có lý do theo từng tiêu chí. */
@Component({ selector: 'app-goi-y', standalone: true, imports: [RouterLink, TienPipe], templateUrl: '../../html/trang-khach/goi-y.html' })
export class GoiY implements OnInit {
  private q = inject(QuizService);
  private vt = inject(ViTriService);
  private api = inject(ApiService);
  private gio = inject(GioHangService);
  private tb = inject(ThongBaoService);
  private router = inject(Router);
  anh = anhSP;
  ds = signal<KetQuaMatch[]>([]);
  hs = signal<HoSo | null>(null);
  thoiTiet = signal<any>(null);
  tongSP = signal(0);
  dangTai = signal(true);

  async ngOnInit() {
    const hs = await this.q.taiHoSo();
    if (!hs) { this.router.navigate(['/scent-quiz/buoc/1']); return; }
    this.hs.set(hs);
    const vt = await this.vt.lay();
    const r = await this.q.goiY(3, vt).catch(() => ({ data: [], meta: null }));
    this.ds.set(r.data); this.thoiTiet.set(r.meta?.weather ?? null); this.dangTai.set(false);
    this.api.getFull<unknown[]>('/products', { limit: 1 }).then((x) => this.tongSP.set(x.meta?.['total'] ?? 0)).catch(() => undefined);
  }
  lyDo(m: KetQuaMatch) { return [...m.breakdown].filter((b) => b.score != null).sort((a, b) => b.contribution - a.contribution).slice(0, 2); }
  async them(p: SanPham) {
    try { if (await this.gio.them(p, 1)) this.tb.hien('Đã thêm vào giỏ hàng', p.name, 'success', '/gio-hang', 'Xem giỏ hàng →'); }
    catch (e) { this.tb.loi('Không thêm được', (e as LoiUngDung).message); }
  }
}
