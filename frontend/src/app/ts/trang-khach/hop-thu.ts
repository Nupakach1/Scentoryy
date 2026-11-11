import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ThoiGianThucService } from '../dich-vu/thoi-gian-thuc.service';
import { DonHang, TinNhan } from '../dich-vu/kieu';
import { ThanhTaiKhoan } from '../dung-chung/thanh-tai-khoan';

/** Hộp thư với Shop — UC-MSG-001 (FR-MSG-INB-001..003): lưu CSDL rồi đẩy realtime, ≤ 1000 ký tự, ≤ 10 tin/10 giây (BR-MSG-001). */
@Component({ selector: 'app-hop-thu', standalone: true, imports: [RouterLink, FormsModule, ThanhTaiKhoan], templateUrl: '../../html/trang-khach/hop-thu.html' })
export class HopThu implements OnInit, OnDestroy {
  private api = inject(ApiService);
  xt = inject(XacThucService);
  private tb = inject(ThongBaoService);
  private rt = inject(ThoiGianThucService);
  private route = inject(ActivatedRoute);
  khung = viewChild<ElementRef<HTMLDivElement>>('khung');
  ds = signal<TinNhan[]>([]);
  donGanNhat = signal<DonHang | null>(null);
  dinhKem = signal<DonHang | null>(null);
  noiDung = '';
  dang = signal(false);
  private sub?: Subscription;
  private hen?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    await this.xt.taiPhien();
    this.ds.set(await this.api.get<TinNhan[]>('/messages').catch(() => []));
    this.cuon();
    this.rt.ketNoi();
    this.sub = this.rt.tinMoi.subscribe((m) => { if (!this.ds().some((x) => x.id === m.id)) { this.ds.update((a) => [...a, m]); this.cuon(); } });
    // Dự phòng khi không có realtime (bản Vercel): tải lại tin mỗi 10 giây
    this.hen = setInterval(() => { if (!this.rt.dangKetNoi()) this.taiLaiTin(); }, 10_000);
    const dsDon = await this.api.get<DonHang[]>('/orders', { limit: 20 }).catch(() => []);
    this.donGanNhat.set(dsDon[0] ?? null);
    const ma = this.route.snapshot.queryParamMap.get('don');
    if (ma) this.dinhKem.set(dsDon.find((d) => d.orderCode === ma) ?? null);
  }
  ngOnDestroy() { this.sub?.unsubscribe(); clearInterval(this.hen); }
  private async taiLaiTin() {
    const moi = await this.api.get<TinNhan[]>('/messages').catch(() => null);
    if (moi && moi.length !== this.ds().length) { this.ds.set(moi); this.cuon(); }
  }
  cuaToi(m: TinNhan) { return m.from === this.xt.nguoiDung()?.id; }
  gio(m: TinNhan) { return new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date(m.createdAt).toLocaleDateString('vi-VN'); }
  private cuon() { setTimeout(() => { const k = this.khung()?.nativeElement; if (k) k.scrollTop = k.scrollHeight; }); }
  async gui() {
    const c = this.noiDung.trim();
    if (!c) return;
    if (c.length > 1000) { this.tb.loi('Tin nhắn quá dài', 'Tối đa 1000 ký tự.'); return; }
    this.dang.set(true);
    try {
      const m = await this.api.post<TinNhan>('/messages', { content: c, orderId: this.dinhKem()?.id });
      if (!this.ds().some((x) => x.id === m.id)) this.ds.update((a) => [...a, m]);
      this.noiDung = ''; this.dinhKem.set(null); this.cuon();
    } catch (e) { this.tb.loi('Không gửi được', (e as LoiUngDung).message); }
    finally { this.dang.set(false); }
  }
}
