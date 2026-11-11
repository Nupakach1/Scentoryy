import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, LoiUngDung } from '../dich-vu/api.service';
import { XacThucService } from '../dich-vu/xac-thuc.service';
import { GioHangService } from '../dich-vu/gio-hang.service';
import { ThongBaoService } from '../dich-vu/thong-bao.service';
import { DiaChi, DonHang, SanPham } from '../dich-vu/kieu';
import { TienPipe, anhSP } from '../dich-vu/dinh-dang';

interface Voucher { code: string; title: string; description: string; type: string; value: number; minOrderAmount: number; maxDiscountAmount: number | null }
interface Dong { product: SanPham; quantity: number; lineTotal: number }

/**
 * Thanh toán — UC-ORD-001: thông tin nhận hàng (FR-ORD-CHKT-001), giao hàng STANDARD/EXPRESS (BR-PRIC-001),
 * voucher (FR-ORD-CHKT-003, BR-PROMO-001), thanh toán COD / QR 15 phút (BR-PAY-002) / Thẻ Luhn (BR-PAY-003).
 */
@Component({ selector: 'app-thanh-toan', standalone: true, imports: [RouterLink, FormsModule, TienPipe], templateUrl: '../../html/trang-khach/thanh-toan.html' })
export class ThanhToan implements OnInit, OnDestroy {
  private api = inject(ApiService);
  xt = inject(XacThucService);
  private gio = inject(GioHangService);
  private tb = inject(ThongBaoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  anh = anhSP;

  dong = signal<Dong[]>([]);
  muaNgay = signal<{ productId: string; quantity: number } | null>(null);
  soDiaChi = signal<DiaChi[]>([]);
  chonDiaChi = signal<string>('moi');
  f = { fullName: '', phone: '', addressLine: '', ward: '', district: '', city: 'TP. Hồ Chí Minh', note: '' };
  luuDiaChi = true;
  giao = signal<'STANDARD' | 'EXPRESS'>('STANDARD');
  tt = signal<'COD' | 'QR' | 'CARD'>('COD');
  the = { number: '', holder: '', expiry: '', cvv: '' };
  dsVoucher = signal<Voucher[]>([]);
  maNhap = '';
  voucher = signal<{ code: string; discount: number } | null>(null);
  loiTruong = signal<Record<string, string>>({});
  dangGui = signal(false);
  donQR = signal<DonHang | null>(null);
  conLai = signal(0);
  private hen?: ReturnType<typeof setInterval>;
  readonly thanhPho = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Khánh Hòa'];

  tamTinh = computed(() => this.dong().reduce((s, d) => s + d.lineTotal, 0));
  phiShip = computed(() => (this.giao() === 'EXPRESS' ? 50000 : 0));
  giam = computed(() => this.voucher()?.discount ?? 0);
  tong = computed(() => Math.max(0, this.tamTinh() + this.phiShip() - this.giam()));

  async ngOnInit() {
    await this.xt.taiPhien();
    const u = this.xt.nguoiDung();
    if (u) { this.f.fullName = u.fullName; this.f.phone = u.phoneNumber ?? ''; }
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('muaNgay')) {
      const p = await this.api.get<SanPham>(`/products/${qp.get('muaNgay')}`);
      const sl = Math.max(1, Math.min(10, Number(qp.get('sl')) || 1));
      this.muaNgay.set({ productId: p.id, quantity: sl });
      this.dong.set([{ product: p, quantity: sl, lineTotal: p.price * sl }]);
    } else {
      await this.gio.tai();
      this.dong.set(this.gio.dongDaChon());
      if (!this.dong().length) { this.tb.hien('Chưa có sản phẩm', 'Hãy chọn sản phẩm trong giỏ trước khi thanh toán.'); this.router.navigate(['/gio-hang']); return; }
    }
    this.api.get<Voucher[]>('/vouchers').then((v) => this.dsVoucher.set(v)).catch(() => undefined);
    const dc = await this.api.get<DiaChi[]>('/addresses').catch(() => []);
    this.soDiaChi.set(dc);
    const md = dc.find((d) => d.isDefault) ?? dc[0];
    if (md) this.dungDiaChi(md.id);
  }
  ngOnDestroy() { clearInterval(this.hen); }

  dungDiaChi(id: string) {
    this.chonDiaChi.set(id);
    const d = this.soDiaChi().find((x) => x.id === id);
    if (d) Object.assign(this.f, { fullName: d.fullName, phone: d.phone, addressLine: d.address, ward: d.ward, district: d.district, city: d.city });
    else Object.assign(this.f, { addressLine: '', ward: '', district: '' });
  }
  hopLeVoucher(v: Voucher) {
    if (this.tamTinh() < v.minOrderAmount) return false;
    if (v.type === 'SHIPPING' && this.phiShip() === 0) return false;
    return true;
  }
  async apDung(code = this.maNhap) {
    code = code.trim().toUpperCase();
    if (!code) return;
    try {
      const r = await this.api.post<{ code: string; discount: number }>('/vouchers/validate', { code, subtotal: this.tamTinh(), deliveryMethod: this.giao() });
      this.voucher.set({ code: r.code, discount: r.discount }); this.maNhap = r.code;
      this.tb.thanhCong('Đã áp dụng mã', `${r.code}: giảm ${r.discount.toLocaleString('vi-VN')}đ`);
    } catch (e) { this.voucher.set(null); this.tb.loi('Mã không hợp lệ', (e as LoiUngDung).message); }
  }
  async doiGiao(g: 'STANDARD' | 'EXPRESS') {
    this.giao.set(g);
    const v = this.voucher();
    if (v) { this.voucher.set(null); await this.apDung(v.code); }
  }
  dinhDangThe(v: string) { this.the.number = v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); }

  private kiemTra(): boolean {
    const l: Record<string, string> = {};
    if (this.f.fullName.trim().length < 2) l['fullName'] = 'Nhập họ tên (tối thiểu 2 ký tự).';
    if (!/^\+?\d{9,15}$/.test(this.f.phone.replace(/\s/g, ''))) l['phone'] = 'Số điện thoại 9–15 chữ số.';
    if (this.f.addressLine.trim().length < 3) l['addressLine'] = 'Nhập số nhà, tên đường.';
    if (!this.f.ward.trim()) l['ward'] = 'Nhập phường/xã.';
    if (!this.f.district.trim()) l['district'] = 'Nhập quận/huyện.';
    if (this.tt() === 'CARD') {
      if (this.the.number.replace(/\s/g, '').length !== 16) l['card.number'] = 'Số thẻ gồm 16 chữ số.';
      if (!this.the.holder.trim()) l['card.holder'] = 'Nhập tên chủ thẻ.';
      if (!/^\d{2}\/\d{2}$/.test(this.the.expiry)) l['card.expiry'] = 'Định dạng MM/YY.';
      if (!/^\d{3}$/.test(this.the.cvv)) l['card.cvv'] = 'CVV gồm 3 chữ số.';
    }
    this.loiTruong.set(l);
    return !Object.keys(l).length;
  }

  async datHang() {
    if (this.dangGui() || !this.kiemTra()) { if (Object.keys(this.loiTruong()).length) this.tb.loi('Thông tin chưa hợp lệ', 'Vui lòng kiểm tra các trường được đánh dấu.'); return; }
    this.dangGui.set(true);
    const body: any = {
      recipient: { fullName: this.f.fullName.trim(), phone: this.f.phone.replace(/\s/g, ''), addressLine: this.f.addressLine.trim(), ward: this.f.ward.trim(), district: this.f.district.trim(), city: this.f.city.trim(), note: this.f.note.trim() || undefined },
      deliveryMethod: this.giao(), paymentMethod: this.tt(), voucherCode: this.voucher()?.code ?? null,
    };
    if (this.muaNgay()) body.buyNow = this.muaNgay(); else body.itemIds = this.dong().map((d: any) => d.id);
    if (this.tt() === 'CARD') body.card = { ...this.the, number: this.the.number.replace(/\s/g, '') };
    try {
      const don = await this.api.post<DonHang>('/orders', body);
      if (this.chonDiaChi() === 'moi' && this.luuDiaChi) {
        this.api.post('/addresses', { label: 'Nhà riêng', fullName: body.recipient.fullName, phone: body.recipient.phone, address: body.recipient.addressLine, ward: body.recipient.ward, district: body.recipient.district, city: body.recipient.city, isDefault: !this.soDiaChi().length }).catch(() => undefined);
      }
      this.gio.tai().catch(() => undefined);
      if (don.paymentMethod === 'QR' && don.paymentStatus === 'PENDING') { this.moQR(don); return; }
      this.tb.thanhCong('Đặt hàng thành công', `Mã đơn ${don.orderCode}`);
      this.router.navigate(['/tai-khoan/don-hang', don.id], { queryParams: { moi: 1 } });
    } catch (e) {
      const loi = e as LoiUngDung;
      const l: Record<string, string> = {};
      for (const d of loi.details ?? []) l[d.field.replace(/^recipient\./, '')] = d.message;
      this.loiTruong.set(l);
      this.tb.loi('Không đặt được hàng', loi.message);
    } finally { this.dangGui.set(false); }
  }
  private moQR(don: DonHang) {
    this.donQR.set(don);
    const tick = () => { const s = Math.max(0, Math.floor((new Date(don.paymentExpiresAt!).getTime() - Date.now()) / 1000)); this.conLai.set(s); if (!s) clearInterval(this.hen); };
    tick(); this.hen = setInterval(tick, 1000);
  }
  dongHo() { const s = this.conLai(); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  async xacNhanQR() {
    const don = this.donQR(); if (!don) return;
    try {
      await this.api.post(`/orders/${don.id}/payments/qr/confirm`, {});
      this.tb.thanhCong('Đã ghi nhận thanh toán', `Đơn ${don.orderCode} đã thanh toán.`);
      this.router.navigate(['/tai-khoan/don-hang', don.id], { queryParams: { moi: 1 } });
    } catch (e) { this.tb.loi('Không xác nhận được', (e as LoiUngDung).message); this.router.navigate(['/tai-khoan/don-hang', don.id]); }
  }
  async dangXuat() { await this.xt.dangXuat(); this.router.navigate(['/dang-nhap'], { queryParams: { next: '/thanh-toan' } }); }
}
