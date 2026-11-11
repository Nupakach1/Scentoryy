import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MAU_NHOM, neoNhom } from '../dich-vu/dinh-dang';
import { ApiService } from '../dich-vu/api.service';
import { NhomHuong, SanPham } from '../dich-vu/kieu';


/** Bản đồ nhóm hương — UC-CAT-003 (FR-CAT-FAM-001): tỷ trọng lượt bán, số tác phẩm, mẫu nổi bật. */
@Component({
  selector: 'app-nhom-huong',
  standalone: true,
  imports: [RouterLink],
  templateUrl: '../../html/trang-khach/nhom-huong.html',
})
export class NhomHuongTrang implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private khungVong = viewChild<ElementRef<HTMLElement>>('khungVong');
  private quanSat?: IntersectionObserver;
  /** Vòng tròn đã cuộn tới → cung và thanh tỷ lệ vẽ dần (giống giao diện gốc). */
  hienVong = signal(false);
  /** Nhóm đang được rê chuột trên cung / dòng chú thích. */
  dangChon = signal<NhomHuong | null>(null);
  doiTam = signal(false);
  nhom = signal<NhomHuong[]>([]);
  noiBat = signal<Record<string, string>>({});
  tongSP = signal(0);
  soThuongHieu = signal(0);
  dang = signal(0);
  private hen?: ReturnType<typeof setInterval>;

  xepHang = computed(() => [...this.nhom()].sort((a, b) => b.soldCount - a.soldCount || b.productCount - a.productCount));
  tongBan = computed(() => this.nhom().reduce((s, f) => s + (f.soldCount || 0), 0) || 1);
  /** Cung SVG bo tròn, có khe hở — cùng công thức scent-wheel.js gốc (R 122, nét 16, khe 3,2°). */
  cung = computed(() => {
    const R = 122, C = 2 * Math.PI * R, KHE = 3.2, BO = (16 / C) * 360;
    let goc = 0;
    return this.xepHang().map((f, i) => {
      const quet = (f.soldCount / this.tongBan()) * 360;
      const len = (Math.max(0.6, quet - KHE - BO) / 360) * C;
      const a = { f, mau: this.mau(f), len, dash: `${len} ${C}`, off: -((goc + (KHE + BO) / 2) / 360) * C, delay: i * 90 };
      goc += quet;
      return a;
    });
  });

  async ngOnInit() {
    const [ds, sp, br] = await Promise.all([
      this.api.get<NhomHuong[]>('/scent-families'),
      this.api.getFull<SanPham[]>('/products', { sort: 'bestseller', limit: 100 }),
      this.api.get<unknown[]>('/brands').catch(() => []),
    ]);
    this.nhom.set(ds);
    this.tongSP.set(sp.meta?.['total'] ?? sp.data.length);
    this.soThuongHieu.set(br.length);
    const nb: Record<string, string> = {};
    for (const p of sp.data) nb[p.family] ??= p.name;
    this.noiBat.set(nb);
    this.hen = setInterval(() => this.dang.update((i) => (i + 1) % Math.max(1, this.nhom().length)), 3500);
    // Đến từ menu "Nhóm hương" (#woody, #chypre…) → cuộn tới đúng thẻ sau khi dữ liệu đã hiện
    const neo = this.route.snapshot.fragment;
    if (neo) setTimeout(() => document.getElementById(neo)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }
  ngAfterViewInit() {
    const el = this.khungVong()?.nativeElement;
    if (!el || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { this.hienVong.set(true); return; }
    this.quanSat = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { this.hienVong.set(true); this.quanSat?.disconnect(); } }, { threshold: 0.3 });
    this.quanSat.observe(el);
  }
  ngOnDestroy() { clearInterval(this.hen); this.quanSat?.disconnect(); }
  /** Rê chuột vào cung / dòng chú thích: làm nổi nhóm đó, đổi chữ ở tâm vòng (hiệu ứng mờ–hiện 120ms như bản gốc). */
  chon(f: NhomHuong | null) {
    if (this.dangChon() === f) return;
    this.doiTam.set(true);
    setTimeout(() => { this.dangChon.set(f); this.doiTam.set(false); }, 120);
  }
  pct(f: NhomHuong) { return ((f.soldCount / this.tongBan()) * 100).toFixed(1).replace('.', ','); }
  rong(f: NhomHuong) { return (f.soldCount / (this.xepHang()[0]?.soldCount || 1)) * 100 + '%'; }
  mau(f: NhomHuong) { return MAU_NHOM[f.name] ?? '#a9824a'; }
  hang(f: NhomHuong) { const i = this.xepHang().indexOf(f); return i === 0 ? 'BÁN CHẠY NHẤT' : i < 3 ? `TOP ${i + 1}` : ''; }
  neo(f: NhomHuong) { return neoNhom(f.name); }
  hai(n: number) { return String(n).padStart(2, '0'); }
  cuonToi(f: NhomHuong) { document.getElementById(this.neo(f))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
