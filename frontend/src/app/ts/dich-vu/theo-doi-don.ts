import { DonHang } from './kieu';

/** Bốn mốc theo dõi đơn hiển thị cho khách (ánh xạ FSM đơn hàng BR-ORD-002). */
export function mocDon(d: DonHang) {
  const t = (s: string) => d.timeline?.find((x) => x.status === s)?.at ?? null;
  const ngay = (v: string | null) => (v ? new Date(v).toLocaleDateString('vi-VN') : null);
  const buoc = d.status === 'PROCESSING' ? 1 : d.status === 'SHIPPING' ? 2 : d.status === 'DELIVERED' ? 4 : -1;
  const ds = [
    { ten: 'Đã tiếp nhận', phu: ngay(d.createdAt) ?? '' },
    { ten: 'Chuẩn bị & Niêm phong', phu: buoc > 1 ? ngay(t('SHIPPING')) ?? 'Hoàn tất' : 'Có thể hủy trực tuyến' },
    { ten: 'Đang vận chuyển', phu: buoc > 2 ? 'Đã vận chuyển' : buoc === 2 ? 'Đơn vị vận chuyển đang giao' : d.deliveryMethod === 'EXPRESS' ? 'Hỏa tốc trong ngày' : 'Dự kiến 2–4 ngày' },
    { ten: 'Giao hàng thành công', phu: buoc === 4 ? ngay(d.deliveredAt) ?? 'Đã nhận hàng' : 'Chờ hoàn tất' },
  ];
  return {
    phanTram: buoc === 4 ? 100 : buoc === 2 ? 50 : buoc === 1 ? 100 / 6 : 0,
    moc: ds.map((m, i) => ({ ...m, trangThai: buoc === -1 ? (i === 0 ? 'is-done' : '') : i < buoc || buoc === 4 ? 'is-done' : i === buoc ? 'is-current' : '' })),
  };
}
export function conHanDoiTra(d: DonHang) {
  if (d.status !== 'DELIVERED' || !d.deliveredAt) return 0;
  const con = 7 - Math.floor((Date.now() - new Date(d.deliveredAt).getTime()) / 86400000);
  return Math.max(0, con);
}
