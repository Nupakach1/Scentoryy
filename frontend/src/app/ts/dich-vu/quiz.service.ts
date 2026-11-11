import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { XacThucService } from './xac-thuc.service';
import { CauTraLoiQuiz, HoSo, KetQuaMatch } from './kieu';

const KHOA_NHAP = 'scentory_quiz_nhap';
const KHOA_HO_SO = 'scentory_ho_so_tam';

/**
 * Scent Quiz 8 bước (UC-QUIZ-001). Câu trả lời lưu tạm sessionStorage (BR-QUIZ-001);
 * khách vãng lai giữ hồ sơ tạm ở localStorage và đồng bộ khi đăng nhập (BR-QUIZ-004).
 */
@Injectable({ providedIn: 'root' })
export class QuizService {
  private api = inject(ApiService);
  private xt = inject(XacThucService);
  traLoi = signal<Partial<CauTraLoiQuiz>>(this.doc(sessionStorage, KHOA_NHAP) ?? {});
  hoSo = signal<HoSo | null>(null);

  constructor() {
    this.xt.sauDangNhap.push(async () => {
      const tam = this.doc<{ answers: CauTraLoiQuiz }>(localStorage, KHOA_HO_SO);
      if (tam?.answers && !this.xt.nguoiDung()?.hasScentProfile) await this.api.post('/quiz/submissions', tam.answers).catch(() => undefined);
      localStorage.removeItem(KHOA_HO_SO);
    });
  }
  private doc<T>(s: Storage, k: string): T | null { try { return JSON.parse(s.getItem(k) || 'null'); } catch { return null; } }
  dat<K extends keyof CauTraLoiQuiz>(k: K, v: CauTraLoiQuiz[K]) {
    this.traLoi.update((a) => ({ ...a, [k]: v }));
    sessionStorage.setItem(KHOA_NHAP, JSON.stringify(this.traLoi()));
  }
  lamLai() { this.traLoi.set({}); sessionStorage.removeItem(KHOA_NHAP); }
  du(): boolean {
    const a = this.traLoi();
    return ['style', 'includeUnisex', 'tone', 'mood', 'aura', 'habit', 'age'].every((k) => (a as any)[k] !== undefined && (a as any)[k] !== null);
  }
  async gui(): Promise<HoSo> {
    const a = this.traLoi() as CauTraLoiQuiz;
    const hs = await this.api.post<HoSo>('/quiz/submissions', a);
    if (!hs.saved) localStorage.setItem(KHOA_HO_SO, JSON.stringify({ answers: a, profile: hs }));
    this.hoSo.set(hs);
    return hs;
  }
  /** Hồ sơ hiện tại: tài khoản → API; khách vãng lai → hồ sơ tạm. */
  async taiHoSo(): Promise<HoSo | null> {
    await this.xt.taiPhien();
    if (this.xt.daDangNhap()) {
      try { const h = await this.api.get<HoSo>('/quiz/profile'); this.hoSo.set(h); return h; } catch { this.hoSo.set(null); return null; }
    }
    const tam = this.doc<{ profile: HoSo }>(localStorage, KHOA_HO_SO);
    this.hoSo.set(tam?.profile ?? null);
    return this.hoSo();
  }
  cauTraLoiTam(): CauTraLoiQuiz | null { return this.doc<{ answers: CauTraLoiQuiz }>(localStorage, KHOA_HO_SO)?.answers ?? null; }
  /** Gợi ý theo hồ sơ (UC-MTCH-001) — khách hàng: GET /match/products; khách vãng lai: POST /match/preview. */
  async goiY(gioiHan = 3, q: Record<string, any> = {}): Promise<{ data: KetQuaMatch[]; meta: any }> {
    await this.xt.taiPhien();
    if (this.xt.daDangNhap()) return this.api.getFull<KetQuaMatch[]>('/match/products', { limit: gioiHan, ...q });
    const answers = this.cauTraLoiTam();
    if (!answers) return { data: [], meta: null };
    return this.api.postFull<KetQuaMatch[]>('/match/preview', { answers, limit: Math.min(gioiHan, 12), ...q });
  }
}
