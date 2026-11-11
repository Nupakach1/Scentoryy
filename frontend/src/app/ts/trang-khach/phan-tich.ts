import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../dich-vu/quiz.service';
import { HoSo, KetQuaMatch } from '../dich-vu/kieu';
import { anhNhom } from '../dich-vu/dinh-dang';

/** Bước 8 của Scent Quiz — màn hình phân tích (UC-QUIZ-001 bước 9–10): hiển thị hồ sơ vừa sinh và tác phẩm khớp nhất. */
@Component({ selector: 'app-phan-tich', standalone: true, templateUrl: '../../html/trang-khach/phan-tich.html' })
export class PhanTich implements OnInit, OnDestroy {
  private q = inject(QuizService);
  private router = inject(Router);
  hs = signal<HoSo | null>(null);
  top = signal<KetQuaMatch | null>(null);
  pt = signal(0);
  anhNhom = anhNhom;
  private hen?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    this.hen = setInterval(() => this.pt.update((v) => Math.min(100, v + 4)), 90);
    const hs = this.q.hoSo() ?? (await this.q.taiHoSo());
    if (!hs) { this.router.navigate(['/scent-quiz/buoc/1']); return; }
    this.hs.set(hs);
    const r = await this.q.goiY(3).catch(() => null);
    this.top.set(r?.data[0] ?? null);
  }
  ngOnDestroy() { clearInterval(this.hen); }
  ve(f: string[] | undefined, i: number) { return f?.[i] ?? f?.[0] ?? null; }
  xem() { this.router.navigate(['/scent-quiz/ho-so']); }
}
