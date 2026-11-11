import { Injectable } from '@angular/core';

/** Tọa độ trình duyệt cho tiêu chí thời tiết (BR-MTCH-003); từ chối → máy chủ dùng TP.HCM. */
@Injectable({ providedIn: 'root' })
export class ViTriService {
  private kq: Promise<{ lat?: number; lon?: number }> | null = null;
  lay(): Promise<{ lat?: number; lon?: number }> {
    this.kq ??= new Promise((ok) => {
      if (!navigator.geolocation) return ok({});
      const t = setTimeout(() => ok({}), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(t); ok({ lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }); },
        () => { clearTimeout(t); ok({}); },
        { maximumAge: 15 * 60_000, timeout: 3500 }
      );
    });
    return this.kq;
  }
}
