import { NHOM_HUONG, NHOM_NAM, NHOM_NU, neoNhom } from '../dich-vu/dinh-dang';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { GiaoDienService } from '../dich-vu/giao-dien.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { YeuThichService } from '../dich-vu/yeu-thich.service';
import { ApiService } from '../dich-vu/api.service';
import { ViTriService } from '../dich-vu/vi-tri.service';
import { CongDangNhapService } from '../dich-vu/cong-dang-nhap.service';

interface TinChat { tu: 'user' | 'bot'; noiDung: string; link?: string }

/**
 * Bố cục phân hệ khách hàng: header `.rebuild-header`, footer `.site-footer`,
 * Scent Concierge (UC-MSG-001, FR-MSG-BOT-001) và toast.
 */
/** Body class từng câu Scent Quiz (câu 1..7 ↔ màn hình quiz-step-1,2,4..8 của bản thiết kế). */
const LOP_BUOC_QUIZ = ['quiz-choice-page qz-page qz-quiz-step-1', 'quiz-option-page qz-page qz-quiz-step-2', 'quiz-family-page qz-page qz-quiz-step-4',
  'quiz-mood-page qz-page qz-quiz-step-5', 'quiz-aura-page qz-page qz-quiz-step-6', 'quiz-habit-page qz-page qz-quiz-step-7', 'age-page qz-page qz-quiz-step-8'];

@Component({
  selector: 'app-khung-khach',
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: '../../html/bo-cuc/khung-khach.html',
})
export class KhungKhach implements OnInit {
  xt = inject(XacThucService);
  gio = inject(GioHangService);
  tb = inject(ThongBaoService);
  private yt = inject(YeuThichService);
  private gd = inject(GiaoDienService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private vt = inject(ViTriService);
  cong = inject(CongDangNhapService);
  /** Đóng hộp thoại đăng nhập; bỏ luôn sản phẩm đang chờ thêm vào giỏ. */
  dongCong() { try { sessionStorage.removeItem('scentory_cho_them_gio'); } catch { /* bỏ qua */ } this.cong.dong(); }

  tuKhoa = '';
  thuongHieu = [
    { ten: 'LE LABO', ten2: 'Le Labo', slug: 'le-labo', so: 7 }, { ten: 'BYREDO', ten2: 'Byredo', slug: 'byredo', so: 6 },
    { ten: 'DIOR PRIVÉE', ten2: 'Dior Privée', slug: 'dior-privee', so: 7 }, { ten: 'MAISON MARGIELA', ten2: 'Maison Margiela', slug: 'maison-margiela', so: 6 },
    { ten: 'DIPTYQUE', ten2: 'Diptyque', slug: 'diptyque', so: 5 }, { ten: 'CREED', ten2: 'Creed', slug: 'creed', so: 6 },
  ];
  nhom = NHOM_HUONG;
  nhomNam = NHOM_NAM.join(',');
  nhomNu = NHOM_NU.join(',');
  neoNhom = neoNhom;
  mucHienTai = signal('');

  // Scent Concierge
  moChat = signal(false);
  thuNho = signal(false);
  dangTraLoi = signal(false);
  tinChat = signal<TinChat[]>([]);
  nhap = '';
  goiYChat = [
    ['Mùi hợp đi làm?', 'Mùi nào hợp đi làm?'], ['Phí giao hàng?', 'Phí giao hàng bao nhiêu?'],
    ['Chính sách đổi trả?', 'Đổi trả như thế nào?'], ['Hợp thời tiết hôm nay?', 'Thời tiết hôm nay hợp mùi nước hoa nào?'],
  ];

  ngOnInit() {
    this.gd.dungBo('khach-hang');
    this.capNhatTrang();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.capNhatTrang());
    this.xt.taiPhien().then(() => { this.gio.tai(); this.yt.tai().catch(() => undefined); });
  }
  private capNhatTrang() {
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    let body = (r.snapshot.data['body'] as string) ?? '';
    const buoc = Number(r.snapshot.params['buoc']);
    if (buoc) body += ' ' + (LOP_BUOC_QUIZ[buoc - 1] ?? '');
    this.gd.datBody(body);
    const url = this.router.url;
    this.mucHienTai.set(url.startsWith('/nhom-huong') ? 'nhom' : url.startsWith('/nuoc-hoa') ? 'nuoc-hoa' : url.startsWith('/scent-quiz') ? 'quiz'
      : url.startsWith('/thuong-hieu') ? 'thuong-hieu' : url.startsWith('/ve-scentory') ? 've' : '');
  }
  timKiem() {
    const q = this.tuKhoa.trim();
    this.router.navigate(['/nuoc-hoa'], { queryParams: q ? { q } : {} });
  }
  neo(n: string) { return n.toLowerCase().replace(/[^a-z]+/g, '-'); }

  // ---------- Concierge
  batChat() { this.moChat.update((v) => !v); this.thuNho.set(false); }
  lamMoi() { this.tinChat.set([]); this.tb.hien('Phiên tư vấn mới', 'Đã làm mới cuộc hội thoại với Scent Concierge.'); }
  async gui(cau?: string) {
    const noiDung = (cau ?? this.nhap).trim();
    if (!noiDung || this.dangTraLoi()) return;
    this.nhap = '';
    this.tinChat.update((a) => [...a, { tu: 'user', noiDung }]);
    this.dangTraLoi.set(true);
    try {
      if (/thời tiết|hôm nay/i.test(noiDung)) {
        const vt = await this.vt.lay();
        const w = await this.api.get<any>('/weather', vt);
        if (w) {
          const top = Object.entries(w.scores as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]).join(' và ');
          this.tinChat.update((a) => [...a, { tu: 'bot', noiDung: `Hiện ${Math.round(w.temperature)}°C, độ ẩm ${w.humidity}% (${w.label}). Nhóm hương hợp nhất lúc này: ${top}. ${w.hint ?? ''}`, link: '/nuoc-hoa' }]);
          return;
        }
      }
      const r = await this.api.post<{ answer: string; suggestEscalation: boolean; link?: string }>('/chatbot/messages', { message: noiDung });
      this.tinChat.update((a) => [...a, { tu: 'bot', noiDung: r.answer, link: r.suggestEscalation ? '/hop-thu' : r.link }]);
    } catch {
      this.tinChat.update((a) => [...a, { tu: 'bot', noiDung: 'Mình đang mất kết nối, bạn thử lại sau ít phút hoặc nhắn cho Scentory trong Hộp thư nhé.', link: '/hop-thu' }]);
    } finally {
      this.dangTraLoi.set(false);
    }
  }
  diToi(link?: string) { if (link) { this.moChat.set(false); this.router.navigateByUrl(link); } }
}
