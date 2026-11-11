import { Component, ElementRef, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { ThoiGianThucService } from '../dich-vu/thoi-gian-thuc.service';
import { TinNhan } from '../dich-vu/kieu';
import { NgayPipe } from '../dich-vu/dinh-dang';

interface HoiThoai { userId: string; fullName: string; email: string; lastMessage: string; lastAt: string; unread: number }

/** Hộp thư quản trị — UC-MSG-002 (FR-MSG-ADM-001..002): danh sách hội thoại theo khách, trả lời realtime. */
@Component({ selector: 'app-hop-thu-quan-tri', standalone: true, imports: [FormsModule, NgayPipe], templateUrl: '../../html/trang-quan-tri/hop-thu.html' })
export class HopThuQuanTri implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private tb = inject(ThongBaoService);
  private rt = inject(ThoiGianThucService);
  khung = viewChild<ElementRef<HTMLDivElement>>('khung');
  ds = signal<HoiThoai[]>([]);
  chon = signal<HoiThoai | null>(null);
  tin = signal<TinNhan[]>([]);
  noiDung = '';
  private sub?: Subscription;
  private hen?: ReturnType<typeof setInterval>;

  async ngOnInit() {
    await this.taiDs();
    this.sub = this.rt.tinMoi.subscribe((m) => {
      const c = this.chon();
      const khach = m.to ?? m.from;
      if (c && khach === c.userId && !this.tin().some((x) => x.id === m.id)) { this.tin.update((a) => [...a, m]); this.cuon(); }
      this.taiDs();
    });
    // Dự phòng khi không có realtime (bản Vercel): tải lại danh sách và hội thoại đang mở mỗi 10 giây
    this.hen = setInterval(async () => {
      if (this.rt.dangKetNoi()) return;
      this.taiDs();
      const c = this.chon(); if (!c) return;
      const moi = await this.api.get<TinNhan[]>('/messages', { with: c.userId }).catch(() => null);
      if (moi && moi.length !== this.tin().length) { this.tin.set(moi); this.cuon(); this.rt.lamMoiSo.next(); }
    }, 10_000);
  }
  ngOnDestroy() { this.sub?.unsubscribe(); clearInterval(this.hen); }
  async taiDs() { this.ds.set(await this.api.get<HoiThoai[]>('/admin/conversations').catch(() => [])); }
  async mo(c: HoiThoai) {
    this.chon.set(c);
    this.tin.set(await this.api.get<TinNhan[]>('/messages', { with: c.userId }));
    this.cuon(); this.taiDs(); this.rt.lamMoiSo.next();
  }
  cuaKhach(m: TinNhan) { return m.to === null; }
  private cuon() { setTimeout(() => { const k = this.khung()?.nativeElement; if (k) k.scrollTop = k.scrollHeight; }); }
  async gui() {
    const c = this.chon(); const nd = this.noiDung.trim();
    if (!c || !nd) return;
    try {
      const m = await this.api.post<TinNhan>('/messages', { content: nd, to: c.userId });
      if (!this.tin().some((x) => x.id === m.id)) this.tin.update((a) => [...a, m]);
      this.noiDung = ''; this.cuon();
    } catch (e) { this.tb.loi('Không gửi được', (e as LoiUngDung).message); }
  }
}
