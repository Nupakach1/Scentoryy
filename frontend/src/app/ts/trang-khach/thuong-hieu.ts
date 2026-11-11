import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../dich-vu/api.service';
import { ThuongHieu } from '../dich-vu/kieu';

/** Thư mục nhà chế tác tham khảo (không kinh doanh) cho tra cứu A–Z; thương hiệu đang bán lấy từ API. */
const THAM_KHAO = ['Acqua di Parma', 'Aesop', 'Amouage', 'Armani Privé', 'Atelier Cologne', 'BDK Parfums', 'Bon No. 9', 'By Kilian',
  'Carner Barcelona', 'Chanel Les Exclusifs', 'Clive Christian', 'Comme des Garçons', 'Escentric Molecules', 'Frederic Malle', 'Guerlain',
  'Hermès', 'Initio', 'Jo Malone London', 'Juliette Has a Gun', 'Kayali', 'Maison Francis Kurkdjian', 'Memo Paris', 'Nishane', 'Ormonde Jayne',
  'Parfums de Marly', 'Penhaligon\'s', 'Roja Parfums', 'Serge Lutens', 'Tom Ford Private Blend', 'Xerjoff', 'Zoologist'];

/** Danh sách thương hiệu — UC-CAT-004 (FR-CAT-BRD-001): tìm kiếm, chuyển nhanh, tra cứu A–Z. */
@Component({
  selector: 'app-thuong-hieu',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: '../../html/trang-khach/thuong-hieu.html',
})
export class ThuongHieuTrang implements OnInit {
  private api = inject(ApiService);
  ds = signal<ThuongHieu[]>([]);
  tuKhoa = signal('');
  chu = signal('');
  readonly bangChu = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  loc = computed(() => {
    const k = this.boDau(this.tuKhoa().trim());
    return k ? this.ds().filter((b) => this.boDau(`${b.name} ${b.origin} ${b.style} ${b.description}`).includes(k)) : this.ds();
  });
  tatCaTen = computed(() => {
    const ban = new Map(this.ds().map((b) => [b.name, b.slug]));
    const ten = [...new Set([...THAM_KHAO, ...ban.keys()])].sort((a, b) => a.localeCompare(b));
    return ten.map((t) => ({ ten: t, slug: ban.get(t) ?? null }));
  });
  nhomChu = computed(() => {
    const g = new Map<string, Array<{ ten: string; slug: string | null }>>();
    for (const x of this.tatCaTen()) { const c = x.ten[0].toUpperCase(); g.set(c, [...(g.get(c) ?? []), x]); }
    return [...g.entries()].filter(([c]) => !this.chu() || c === this.chu()).map(([c, ds]) => ({ c, ds }));
  });
  coChu = computed(() => new Set(this.tatCaTen().map((x) => x.ten[0].toUpperCase())));

  async ngOnInit() { this.ds.set(await this.api.get<ThuongHieu[]>('/brands').catch(() => [])); }
  boDau(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }
}
