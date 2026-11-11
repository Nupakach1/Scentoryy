import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DiaChi } from '../dich-vu/kieu';
import { ThanhTaiKhoan } from '../dung-chung/thanh-tai-khoan';

const RONG = { label: '', fullName: '', phone: '', address: '', ward: '', district: '', city: '', isDefault: false };

/** Sổ địa chỉ — UC-ACC-002 (FR-ACC-ADR-001..004): thêm/sửa/xóa, một địa chỉ mặc định duy nhất (BR-ACC-003). */
@Component({ selector: 'app-so-dia-chi', standalone: true, imports: [FormsModule, ThanhTaiKhoan], templateUrl: '../../html/trang-khach/so-dia-chi.html' })
export class SoDiaChi implements OnInit {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  ds = signal<DiaChi[]>([]);
  dangTai = signal(true);
  moForm = signal(false);
  suaId = signal<string | null>(null);
  f = { ...RONG };
  loi = signal('');

  async ngOnInit() { await this.tai(); }
  async tai() { try { this.ds.set(await this.api.get<DiaChi[]>('/addresses')); } finally { this.dangTai.set(false); } }
  mo(d?: DiaChi) {
    this.suaId.set(d?.id ?? null);
    this.f = d ? { label: d.label, fullName: d.fullName, phone: d.phone, address: d.address, ward: d.ward, district: d.district, city: d.city, isDefault: d.isDefault } : { ...RONG, isDefault: !this.ds().length };
    this.loi.set(''); this.moForm.set(true);
  }
  async luu() {
    const f = this.f;
    if (!f.fullName.trim() || !f.phone.trim() || !f.label.trim() || !f.address.trim() || !f.ward.trim() || !f.district.trim() || !f.city.trim()) { this.loi.set('Vui lòng điền đủ các trường bắt buộc.'); return; }
    if (!/^\+?\d{9,15}$/.test(f.phone.replace(/\s/g, ''))) { this.loi.set('Số điện thoại 9–15 chữ số.'); return; }
    const body = { ...f, phone: f.phone.replace(/\s/g, '') };
    try {
      if (this.suaId()) await this.api.patch(`/addresses/${this.suaId()}`, body); else await this.api.post('/addresses', body);
      this.tb.thanhCong(this.suaId() ? 'Đã cập nhật địa chỉ' : 'Đã thêm địa chỉ', f.label);
      this.moForm.set(false); await this.tai();
    } catch (e) { this.loi.set((e as LoiUngDung).message); }
  }
  async xoa(d: DiaChi) {
    if (!confirm(`Xóa địa chỉ “${d.label}”?`)) return;
    try { await this.api.delete(`/addresses/${d.id}`); this.tb.hien('Đã xóa địa chỉ', d.label); await this.tai(); }
    catch (e) { this.tb.loi('Không xóa được', (e as LoiUngDung).message); }
  }
  async macDinh(d: DiaChi) {
    try { await this.api.patch(`/addresses/${d.id}`, { isDefault: true }); await this.tai(); }
    catch (e) { this.tb.loi('Không cập nhật được', (e as LoiUngDung).message); }
  }
}
