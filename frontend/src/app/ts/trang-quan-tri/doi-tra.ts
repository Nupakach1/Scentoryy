import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ThoiGianThucService } from '../dich-vu/thoi-gian-thuc.service';
import { NHAN_DOI_TRA, YeuCauDoiTra } from '../dich-vu/kieu';
import { TienPipe, NgayPipe } from '../dich-vu/dinh-dang';
import { CHUYEN_DT, MAU_DT } from './dung-chung-qt';

/** Xử lý đổi trả — UC-RET-002 (FR-RET-ADM-001..002): duyệt/từ chối (bắt buộc phản hồi), hoàn tất → hoàn kho nếu còn seal, hoàn tiền (BR-RET-004). */
@Component({ selector: 'app-quan-ly-doi-tra', standalone: true, imports: [RouterLink, FormsModule, TienPipe, NgayPipe], templateUrl: '../../html/trang-quan-tri/doi-tra.html' })
export class QuanLyDoiTra implements OnInit {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  private rt = inject(ThoiGianThucService);
  nhan = NHAN_DOI_TRA; mau = MAU_DT; chuyen = CHUYEN_DT;
  ds = signal<YeuCauDoiTra[]>([]);
  tt = signal('PENDING');
  chon = signal<YeuCauDoiTra | null>(null);
  den = signal(''); phanHoi = '';
  loi = signal('');
  ngOnInit() { this.tai(); }
  async tai() { this.ds.set(await this.api.get<YeuCauDoiTra[]>('/admin/returns', { status: this.tt() || undefined }).catch(() => [])); }
  mo(r: YeuCauDoiTra) { this.chon.set(r); this.den.set(''); this.phanHoi = r.adminResponse ?? ''; this.loi.set(''); }
  async luu() {
    const r = this.chon(); if (!r || !this.den()) return;
    if (this.den() === 'REJECTED' && !this.phanHoi.trim()) { this.loi.set('Vui lòng nhập phản hồi khi từ chối.'); return; }
    try {
      await this.api.patch(`/admin/returns/${r.id}`, { status: this.den(), adminResponse: this.phanHoi.trim() || undefined });
      this.tb.thanhCong('Đã cập nhật yêu cầu', `${r.orderCode} → ${this.nhan[this.den()]}`);
      this.chon.set(null); this.tai(); this.rt.lamMoiSo.next();
    } catch (e) { this.loi.set((e as LoiUngDung).message); }
  }
}
