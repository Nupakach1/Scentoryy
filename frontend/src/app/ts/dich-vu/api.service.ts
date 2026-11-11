import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LoiApi, PhanHoi } from './kieu';

/** Lỗi mang mã ERR chuẩn (docs/scentory/srs/error-matrix.md). */
export class LoiUngDung extends Error {
  constructor(public code: string, message: string, public details: LoiApi['details'] = []) { super(message); }
  truong(ten: string) { return this.details?.find((d) => d.field === ten)?.message; }
}

/** Gọi REST /api/v1, bóc khuôn {success, data, error, meta}. Cookie phiên đi kèm (withCredentials). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private goc = '/api/v1';

  private async goi<T>(p: Promise<PhanHoi<T>>): Promise<{ data: T; meta: Record<string, any> | null }> {
    try {
      const r = await p;
      return { data: r.data, meta: r.meta };
    } catch (e) {
      const he = e as HttpErrorResponse;
      const err = he.error?.error as LoiApi | undefined;
      if (err?.code) throw new LoiUngDung(err.code, err.message, err.details);
      throw new LoiUngDung('ERR-SYS-500-01', he.status === 0 ? 'Không kết nối được máy chủ. Vui lòng thử lại.' : 'Hệ thống đang bận, vui lòng thử lại sau.');
    }
  }
  private params(q?: Record<string, any>) {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q ?? {})) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    return p;
  }
  getFull<T>(url: string, q?: Record<string, any>) {
    return this.goi(firstValueFrom(this.http.get<PhanHoi<T>>(this.goc + url, { params: this.params(q), withCredentials: true })));
  }
  async get<T>(url: string, q?: Record<string, any>): Promise<T> { return (await this.getFull<T>(url, q)).data; }
  async post<T>(url: string, body: unknown = {}): Promise<T> {
    return (await this.goi(firstValueFrom(this.http.post<PhanHoi<T>>(this.goc + url, body, { withCredentials: true })))).data;
  }
  postFull<T>(url: string, body: unknown = {}) { return this.goi(firstValueFrom(this.http.post<PhanHoi<T>>(this.goc + url, body, { withCredentials: true }))); }
  async put<T>(url: string, body: unknown = {}): Promise<T> {
    return (await this.goi(firstValueFrom(this.http.put<PhanHoi<T>>(this.goc + url, body, { withCredentials: true })))).data;
  }
  async patch<T>(url: string, body: unknown = {}): Promise<T> {
    return (await this.goi(firstValueFrom(this.http.patch<PhanHoi<T>>(this.goc + url, body, { withCredentials: true })))).data;
  }
  async delete<T>(url: string): Promise<T> {
    return (await this.goi(firstValueFrom(this.http.delete<PhanHoi<T>>(this.goc + url, { withCredentials: true })))).data;
  }
  async taiTep(file: File): Promise<{ id: string; url: string }> {
    const f = new FormData(); f.append('file', file);
    return (await this.goi(firstValueFrom(this.http.post<PhanHoi<{ id: string; url: string }>>(this.goc + '/uploads', f, { withCredentials: true })))).data;
  }
}
