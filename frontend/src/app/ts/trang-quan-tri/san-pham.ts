import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { SanPham } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

const NHOM = ['Woody', 'Aromatic', 'Floral', 'Fresh/Citrus', 'Fougère', 'Oriental/Amber', 'Chypre', 'Gourmand'];
const RONG = { sku: '', name: '', brand: '', price: 0, stock: 0, concentration: 'Eau de Parfum', volume: 50, family: NHOM[0], topNotes: '', middleNotes: '', baseNotes: '',
  projection: 'Vừa', longevity: 'Lâu', occasion: '', description: '', imageUrl: '', isActive: true };

/** Quản lý sản phẩm — UC-PRD-001 (FR-PRD-CRUD-001..004): tên/SKU duy nhất (BR-ADM-002), ngừng bán = xóa mềm (BR-ADM-001). */
@Component({ selector: 'app-quan-ly-san-pham', standalone: true, imports: [FormsModule, TienPipe, KeyValuePipe], templateUrl: '../../html/trang-quan-tri/san-pham.html' })
export class QuanLySanPham implements OnInit {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  anh = anhSP;
  nhom = NHOM;
  ds = signal<SanPham[]>([]);
  q = ''; tt = '';
  form = signal(false);
  sua = signal<SanPham | null>(null);
  f: any = { ...RONG };
  loiTruong = signal<Record<string, string>>({});
  ngung = signal<SanPham | null>(null);

  ngOnInit() { this.tai(); }
  async tai() { this.ds.set(await this.api.get<SanPham[]>('/admin/products', { q: this.q || undefined, status: this.tt || undefined }).catch(() => [])); }
  mo(p?: SanPham) {
    this.sua.set(p ?? null); this.loiTruong.set({});
    this.f = p ? { sku: p.sku, name: p.name, brand: p.brand, price: p.price, stock: p.stock, concentration: p.concentration, volume: p.volume, family: p.family,
      topNotes: p.topNotes, middleNotes: p.middleNotes, baseNotes: p.baseNotes, projection: p.projection, longevity: p.longevity, occasion: p.occasion,
      description: p.description ?? '', imageUrl: p.imageUrl ?? '', isActive: p.isActive } : { ...RONG };
    this.form.set(true);
  }
  async luu() {
    const body = { ...this.f, price: Number(this.f.price), stock: Number(this.f.stock), volume: Number(this.f.volume), description: this.f.description || null, imageUrl: this.f.imageUrl || null };
    try {
      if (this.sua()) await this.api.patch(`/admin/products/${this.sua()!.id}`, body); else await this.api.post('/admin/products', body);
      this.tb.thanhCong(this.sua() ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm', body.name);
      this.form.set(false); this.tai();
    } catch (e) {
      const x = e as LoiUngDung;
      this.loiTruong.set(Object.fromEntries((x.details ?? []).map((d) => [d.field, d.message])));
      this.tb.loi('Không lưu được', x.message);
    }
  }
  async xacNhanNgung() {
    const p = this.ngung(); if (!p) return;
    try { await this.api.delete(`/admin/products/${p.id}`); this.tb.thanhCong('Đã ngừng bán', p.name); this.ngung.set(null); this.tai(); }
    catch (e) { this.tb.loi('Không thực hiện được', (e as LoiUngDung).message); }
  }
  async moBan(p: SanPham) {
    try { await this.api.patch(`/admin/products/${p.id}`, { isActive: true }); this.tb.thanhCong('Đã mở bán lại', p.name); this.tai(); }
    catch (e) { this.tb.loi('Không thực hiện được', (e as LoiUngDung).message); }
  }
}
