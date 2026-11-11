import { Injectable, NgZone, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { TinNhan } from './kieu';

/** Kết nối Socket.IO (cookie phiên httpOnly đi kèm) để nhận tin nhắn và số đếm quản trị theo thời gian thực. */
@Injectable({ providedIn: 'root' })
export class ThoiGianThucService {
  private zone = inject(NgZone);
  private socket: Socket | null = null;
  tinMoi = new Subject<TinNhan>();
  /** Phát khi số đếm trên menu quản trị cần tải lại (đơn mới, đổi trả mới, sau khi xử lý). */
  lamMoiSo = new Subject<void>();
  /** true khi đang có kết nối realtime; false (ví dụ bản triển khai serverless Vercel) → các trang tự tải lại định kỳ. */
  dangKetNoi = signal(false);
  ketNoi() {
    if (this.socket) return;
    this.socket = io({ withCredentials: true, transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
    this.socket.on('connect', () => this.zone.run(() => this.dangKetNoi.set(true)));
    this.socket.on('disconnect', () => this.zone.run(() => this.dangKetNoi.set(false)));
    this.socket.on('message:new', (m: TinNhan) => this.zone.run(() => this.tinMoi.next(m)));
    this.socket.on('admin:badges', () => this.zone.run(() => this.lamMoiSo.next()));
  }
  ngat() { this.socket?.disconnect(); this.socket = null; this.dangKetNoi.set(false); }
}
