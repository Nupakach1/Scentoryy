import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../dich-vu/api.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { QuizService } from '../dich-vu/quiz.service';
import { ViTriService } from '../dich-vu/vi-tri.service';
import { KetQuaMatch, SanPham, TieuChi } from '../dich-vu/kieu';
import { TheSanPham } from '../dung-chung/the-san-pham';
import { anhSP2 } from '../dich-vu/dinh-dang';

interface Facet { value: string; count: number }

/**
 * Danh mục nước hoa — UC-CAT-001 (FR-CAT-SRCH-001, FR-CAT-FLT-001/002, FR-CAT-SORT-001),
 * điểm Scent Match trên thẻ khi có hồ sơ (UC-MTCH-001, BR-MTCH-004).
 */
@Component({
  selector: 'app-danh-sach-san-pham',
  standalone: true,
  imports: [RouterLink, FormsModule, TheSanPham],
  templateUrl: '../../html/trang-khach/danh-sach-san-pham.html',
})
export class DanhSachSanPham implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  xt = inject(XacThucService);
  private quiz = inject(QuizService);
  private vt = inject(ViTriService);
  anh2 = anhSP2;

  uuDai = !!this.route.snapshot.data['uuDai'];
  sanPham = signal<SanPham[]>([]);
  tong = signal(0);
  trang = signal(1);
  soTrang = signal(1);
  dangTai = signal(true);
  loi = signal('');
  facets = signal<{ families: Facet[]; brands: Facet[]; concentrations: Facet[] }>({ families: [], brands: [], concentrations: [] });
  diem = signal<Map<string, { s: number; tc: TieuChi[] }>>(new Map());
  coHoSo = signal(false);
  marquee = signal<SanPham[]>([]);

  q = '';
  brands = new Set<string>();
  families = new Set<string>();
  concentrations = new Set<string>();
  gia = '';
  giaTu: number | null = null;
  giaDen: number | null = null;
  loiGia = '';
  sort = 'name';

  chips = computed(() => {
    this.sanPham();
    const c: Array<{ loai: string; gt: string; nhan: string }> = [];
    if (this.q) c.push({ loai: 'q', gt: this.q, nhan: `Từ khóa: “${this.q}”` });
    this.brands.forEach((b) => c.push({ loai: 'brand', gt: b, nhan: b }));
    this.families.forEach((b) => c.push({ loai: 'family', gt: b, nhan: b }));
    this.concentrations.forEach((b) => c.push({ loai: 'conc', gt: b, nhan: b }));
    if (this.giaTu != null || this.giaDen != null) c.push({ loai: 'gia', gt: '', nhan: `${(this.giaTu ?? 0).toLocaleString('vi-VN')}đ – ${this.giaDen != null ? this.giaDen.toLocaleString('vi-VN') + 'đ' : '∞'}` });
    return c;
  });

  async ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    this.q = qp.get('q') ?? '';
    qp.get('family')?.split(',').forEach((f) => this.families.add(f));
    qp.get('brand')?.split(',').forEach((f) => this.brands.add(f));
    if (this.uuDai) this.sort = 'bestseller';
    this.route.queryParamMap.subscribe((m) => {
      const q = m.get('q') ?? '';
      if (q !== this.q) { this.q = q; this.tai(1); }
    });
    await this.xt.taiPhien();
    this.coHoSo.set(!!this.xt.nguoiDung()?.hasScentProfile);
    if (this.coHoSo()) this.sort = 'match';
    this.api.get<SanPham[]>('/products', { sort: 'bestseller', limit: 14 }).then((d) => this.marquee.set(d)).catch(() => undefined);
    await this.tai(1);
  }

  private boLoc() {
    return {
      q: this.q || undefined,
      brand: [...this.brands].join(',') || undefined,
      family: [...this.families].join(',') || undefined,
      concentration: [...this.concentrations].join(',') || undefined,
      minPrice: this.giaTu ?? undefined,
      maxPrice: this.giaDen ?? undefined,
    };
  }

  async tai(trang = this.trang()) {
    this.dangTai.set(true);
    this.loi.set('');
    try {
      const limit = 12;
      if (this.sort === 'match' && this.coHoSo()) {
        const vt = await this.vt.lay();
        const r = await this.api.getFull<KetQuaMatch[]>('/match/products', { ...this.boLoc(), ...vt });
        this.diem.set(new Map(r.data.map((x) => [x.product.id, { s: x.matchScore, tc: x.breakdown }])));
        this.tong.set(r.data.length);
        this.soTrang.set(Math.max(1, Math.ceil(r.data.length / limit)));
        this.trang.set(Math.min(trang, this.soTrang()));
        this.sanPham.set(r.data.slice((this.trang() - 1) * limit, this.trang() * limit).map((x) => x.product));
        if (!this.facets().brands.length) {
          const f = await this.api.getFull<SanPham[]>('/products', { limit: 1 });
          this.facets.set(f.meta?.['facets']);
        }
      } else {
        const r = await this.api.getFull<SanPham[]>('/products', { ...this.boLoc(), sort: this.sort, page: trang, limit });
        this.sanPham.set(r.data);
        this.tong.set(r.meta?.['total'] ?? r.data.length);
        this.trang.set(r.meta?.['page'] ?? trang);
        this.soTrang.set(Math.max(1, r.meta?.['pages'] ?? 1));
        this.facets.set(r.meta?.['facets']);
        if (this.coHoSo() && !this.diem().size) {
          const vt = await this.vt.lay();
          const m = await this.api.get<KetQuaMatch[]>('/match/products', vt).catch(() => []);
          this.diem.set(new Map(m.map((x) => [x.product.id, { s: x.matchScore, tc: x.breakdown }])));
        }
      }
    } catch (e) {
      this.loi.set((e as Error).message);
    } finally {
      this.dangTai.set(false);
    }
  }

  bat(tap: Set<string>, v: string, on: boolean) { on ? tap.add(v) : tap.delete(v); this.tai(1); }
  chonGia(v: string) {
    this.gia = v;
    [this.giaTu, this.giaDen] = v === 'duoi-4' ? [null, 4_000_000] : v === '4-7' ? [4_000_000, 7_000_000] : v === 'tren-7' ? [7_000_000, null] : [null, null];
    this.tai(1);
  }
  apDungGia(tu: string, den: string) {
    const a = tu ? Number(tu) : null, b = den ? Number(den) : null;
    if ((a != null && a < 0) || (b != null && b < 0) || (a != null && b != null && a > b)) { this.loiGia = 'Khoảng giá không hợp lệ: “Từ” phải nhỏ hơn hoặc bằng “Đến”.'; return; }
    this.loiGia = ''; this.gia = 'tuy-chinh'; this.giaTu = a; this.giaDen = b; this.tai(1);
  }
  boChip(c: { loai: string; gt: string }) {
    if (c.loai === 'q') { this.q = ''; this.router.navigate([], { queryParams: {} }); }
    if (c.loai === 'brand') this.brands.delete(c.gt);
    if (c.loai === 'family') this.families.delete(c.gt);
    if (c.loai === 'conc') this.concentrations.delete(c.gt);
    if (c.loai === 'gia') { this.gia = ''; this.giaTu = this.giaDen = null; }
    this.tai(1);
  }
  lamMoi() {
    this.q = ''; this.brands.clear(); this.families.clear(); this.concentrations.clear(); this.gia = ''; this.giaTu = this.giaDen = null; this.loiGia = '';
    this.router.navigate([], { queryParams: {} });
    this.tai(1);
  }
  doiSort() { this.tai(1); }
  diemCua(id: string) { return this.diem().get(id)?.s ?? null; }
  tcCua(id: string) { return this.diem().get(id)?.tc ?? null; }
  trangSo() { return Array.from({ length: this.soTrang() }, (_, i) => i + 1); }
}
