import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuizService } from '../dich-vu/quiz.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { HoSo, KetQuaMatch, SanPham } from '../dich-vu/kieu';
import { MAU_NHOM, NHAN_QUIZ, NgayPipe, anhNhom, anhSP2 } from '../dich-vu/dinh-dang';

/** Hồ sơ mùi hương — UC-QUIZ-002 (FR-QUIZ-PRF-001): bánh xe nhóm hương, khí chất, nốt hương tương thích. */
@Component({ selector: 'app-ho-so-mui-huong', standalone: true, imports: [RouterLink, NgayPipe], templateUrl: '../../html/trang-khach/ho-so-mui-huong.html' })
export class HoSoMuiHuong implements OnInit {
  private q = inject(QuizService);
  private router = inject(Router);
  xt = inject(XacThucService);
  hs = signal<HoSo | null>(null);
  goiY = signal<KetQuaMatch[]>([]);
  dangChon = signal(0);
  dangTai = signal(true);
  homNay = new Date();
  anhNhom = anhNhom;
  anh2 = anhSP2;
  nhan = NHAN_QUIZ;

  phan = computed(() => {
    const r = this.hs()?.familyRatings ?? {};
    const tong = Object.values(r).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([ten, v]) => ({ ten, pct: Math.round((v / tong) * 100), mau: MAU_NHOM[ten] ?? '#999' }));
  });
  dangPhan = computed(() => this.phan().at(this.dangChon()) ?? null);
  cung = computed(() => {
    const C = 2 * Math.PI * 80; let off = 0;
    return this.phan().map((p) => { const len = (p.pct / 100) * C; const a = { mau: p.mau, dash: `${Math.max(0, len - 3)} ${C}`, off: -off }; off += len; return a; });
  });
  notes = computed(() => {
    const ds: string[] = [];
    for (const m of this.goiY()) for (const n of `${m.product.topNotes},${m.product.middleNotes},${m.product.baseNotes}`.split(',')) {
      const t = n.trim(); if (t && !ds.includes(t)) ds.push(t);
    }
    return ds.slice(0, 4).map((n, i) => ({ ten: n, sp: this.goiY()[i % Math.max(1, this.goiY().length)]?.product as SanPham | undefined }));
  });

  async ngOnInit() {
    const hs = await this.q.taiHoSo();
    this.dangTai.set(false);
    if (!hs) return;
    this.hs.set(hs);
    this.goiY.set((await this.q.goiY(4).catch(() => ({ data: [] as KetQuaMatch[] }))).data);
  }
  cauTraLoi() { return this.hs()?.quizAnswers ?? this.q.cauTraLoiTam(); }
  lamLai() { this.q.lamLai(); this.router.navigate(['/scent-quiz/buoc/1']); }
}
