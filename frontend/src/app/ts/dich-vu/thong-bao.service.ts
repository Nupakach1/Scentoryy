import { Injectable, signal } from '@angular/core';

export interface ThongBao { id: number; title: string; message: string; type: 'success' | 'error' | 'info' | 'warning'; link?: string; linkText?: string; visible: boolean }

/** Toast `.scentory-toast` theo giao diện customer-ui. */
@Injectable({ providedIn: 'root' })
export class ThongBaoService {
  ds = signal<ThongBao[]>([]);
  private n = 0;
  hien(title: string, message = '', type: ThongBao['type'] = 'info', link?: string, linkText?: string) {
    const t: ThongBao = { id: ++this.n, title, message, type, link, linkText, visible: false };
    this.ds.update((a) => [...a, t]);
    setTimeout(() => this.ds.update((a) => a.map((x) => (x.id === t.id ? { ...x, visible: true } : x))), 20);
    setTimeout(() => this.dong(t.id), 4200);
  }
  thanhCong(title: string, message = '') { this.hien(title, message, 'success'); }
  loi(title: string, message = '') { this.hien(title, message, 'error'); }
  dong(id: number) {
    this.ds.update((a) => a.map((x) => (x.id === id ? { ...x, visible: false } : x)));
    setTimeout(() => this.ds.update((a) => a.filter((x) => x.id !== id)), 320);
  }
}
