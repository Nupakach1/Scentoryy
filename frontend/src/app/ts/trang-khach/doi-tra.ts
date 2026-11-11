import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DonHang, YeuCauDoiTra } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';
import { conHanDoiTra } from '../dich-vu/theo-doi-don';
import { ThanhTaiKhoan } from '../dung-chung/thanh-tai-khoan';

const LY_DO = ['Sản phẩm bị lỗi / hư hỏng', 'Không đúng sản phẩm đã đặt', 'Không còn nhu cầu sử dụng', 'Lý do khác'];
const MIME = ['image/jpeg', 'image/png', 'video/mp4'];

/**
 * Yêu cầu đổi trả — UC-RET-001 (FR-RET-REQ-001): đơn DELIVERED trong 7 ngày (BR-RET-001), mỗi đơn một yêu cầu (BR-RET-002),
 * bắt buộc minh chứng JPG/PNG/MP4 ≤ 10 MB (BR-RET-003); hoàn tiền = đơn giá × số lượng trả.
 */
@Component({ selector: 'app-doi-tra', standalone: true, imports: [RouterLink, FormsModule, TienPipe, ThanhTaiKhoan], templateUrl: '../../html/trang-khach/doi-tra.html' })
export class DoiTra {
  id = input.required<string>();
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  private router = inject(Router);
  anh = anhSP;
  lyDo = LY_DO;
  d = signal<DonHang | null>(null);
  loi = signal('');
  buoc = signal(1);
  loai = signal<'EXCHANGE' | 'REFUND'>('EXCHANGE');
  chon = signal<Record<string, number>>({});
  ly = signal(LY_DO[0]);
  moTa = '';
  conSeal = signal(true);
  tep = signal<{ ten: string; url: string } | null>(null);
  dangTai = signal(false);
  dangGui = signal(false);
  ketQua = signal<YeuCauDoiTra | null>(null);

  hoanTien = computed(() => (this.d()?.items ?? []).reduce((s, i) => s + (this.chon()[i.productId] ?? 0) * i.unitPrice, 0));
  soChon = computed(() => Object.values(this.chon()).filter((v) => v > 0).length);
  conHan = computed(() => (this.d() ? conHanDoiTra(this.d()!) : 0));

  constructor() {
    effect(() => {
      const id = this.id();
      this.api.get<DonHang>(`/orders/${id}`).then((d) => {
        this.d.set(d);
        if (d.status !== 'DELIVERED') this.loi.set('Chỉ đơn đã giao mới được đổi trả.');
        else if (!conHanDoiTra(d)) this.loi.set('Đơn hàng đã quá thời hạn đổi trả 7 ngày kể từ ngày nhận.');
        else if (d.returnRequest) { this.ketQua.set(d.returnRequest); this.buoc.set(3); }
        this.chon.set(Object.fromEntries((d.items ?? []).map((i) => [i.productId, i.quantity])));
      }).catch((e: LoiUngDung) => this.loi.set(e.message));
    }, { allowSignalWrites: true });
  }
  datSL(pid: string, v: number) { this.chon.update((c) => ({ ...c, [pid]: v })); }
  dsSL(n: number) { return Array.from({ length: n + 1 }, (_, i) => i); }
  async chonTep(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (!MIME.includes(f.type)) { this.tb.loi('Định dạng không hỗ trợ', 'Chỉ nhận JPG, PNG hoặc MP4.'); return; }
    if (f.size > 10 * 1024 * 1024) { this.tb.loi('Tệp quá lớn', 'Dung lượng tối đa 10 MB.'); return; }
    this.dangTai.set(true);
    try { const r = await this.api.taiTep(f); this.tep.set({ ten: f.name, url: r.url }); }
    catch (e) { this.tb.loi('Tải tệp thất bại', (e as LoiUngDung).message); }
    finally { this.dangTai.set(false); }
  }
  tiep() {
    if (this.buoc() === 1) {
      if (!this.soChon()) { this.tb.loi('Chưa chọn sản phẩm', 'Chọn ít nhất một sản phẩm và số lượng cần đổi trả.'); return; }
      this.buoc.set(2); return;
    }
    if (!this.tep()) { this.tb.loi('Thiếu minh chứng', 'Vui lòng tải ảnh hoặc video minh chứng (bắt buộc).'); return; }
    if (this.ly() === 'Lý do khác' && !this.moTa.trim()) { this.tb.loi('Thiếu mô tả', 'Hãy mô tả lý do khi chọn “Lý do khác”.'); return; }
    this.gui();
  }
  async gui() {
    this.dangGui.set(true);
    try {
      const r = await this.api.post<YeuCauDoiTra>('/returns', {
        orderId: this.id(), requestType: this.loai(), reason: this.ly(), description: this.moTa.trim() || undefined, isIntactSeal: this.conSeal(), evidenceUrl: this.tep()!.url,
        items: Object.entries(this.chon()).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity })),
      });
      this.ketQua.set(r); this.buoc.set(3);
      this.tb.thanhCong('Đã gửi yêu cầu đổi trả', 'Scentory sẽ phản hồi trong 1–2 ngày làm việc.');
    } catch (e) { this.tb.loi('Không gửi được yêu cầu', (e as LoiUngDung).message); }
    finally { this.dangGui.set(false); }
  }
}
