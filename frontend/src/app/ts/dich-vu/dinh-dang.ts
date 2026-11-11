import { Pipe, PipeTransform } from '@angular/core';

/** 5900000 → "5.900.000đ" */
@Pipe({ name: 'tien', standalone: true })
export class TienPipe implements PipeTransform {
  transform(v: number | null | undefined, kieu: 'd' | 'vnd' = 'd'): string {
    if (v == null || isNaN(Number(v))) return '—';
    const s = Math.round(Number(v)).toLocaleString('vi-VN');
    return kieu === 'vnd' ? `${s} ₫` : `${s}đ`;
  }
}

/** ISO → "10/11/2026" hoặc kèm giờ */
@Pipe({ name: 'ngay', standalone: true })
export class NgayPipe implements PipeTransform {
  transform(v: string | Date | null | undefined, gio = false): string {
    if (!v) return '—';
    const d = new Date(v);
    const s = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return gio ? `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${s}` : s;
  }
}

/** 8 nhóm hương Michael Edwards — thứ tự như menu của giao diện gốc. */
export const NHOM_HUONG = ['Woody', 'Aromatic', 'Floral', 'Fresh/Citrus', 'Fougère', 'Oriental/Amber', 'Chypre', 'Gourmand'] as const;
/** Nhóm hương đặc trưng theo phong cách (khớp Scent Quiz) — dùng cho mục Nước hoa nam / nữ. */
export const NHOM_NAM = ['Woody', 'Fougère', 'Oriental/Amber'];
export const NHOM_NU = ['Floral', 'Gourmand', 'Chypre'];
export const tenNhomVi: Record<string, string> = {
  Woody: 'Gỗ ấm áp & trầm lắng', Aromatic: 'Thảo mộc xanh mát', Floral: 'Hoa cỏ tinh khiết', 'Fresh/Citrus': 'Cam chanh tươi mát',
  Fougère: 'Oải hương & dương xỉ', 'Oriental/Amber': 'Hổ phách & gia vị', Chypre: 'Chypre thanh lịch', Gourmand: 'Ngọt ngào kiểu bánh kẹo',
};
/** Neo của nhóm trên trang Nhóm hương (giống giao diện gốc: fresh-citrus, foug-re, oriental-amber). */
export const neoNhom = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
export const anhSP = (p: { imageUrl?: string | null; sku?: string } | null | undefined) => p?.imageUrl || '/hinh-anh/trang-tri/atelier.webp';
export const anhSP2 = (p: { galleryUrls?: string[]; imageUrl?: string | null } | null | undefined) => p?.galleryUrls?.[0] || p?.imageUrl || '/hinh-anh/trang-tri/botanical.webp';
const ANH_NHOM: Record<string, string> = {
  Woody: 'woody', Aromatic: 'aromatic', Floral: 'floral', 'Fresh/Citrus': 'citrus',
  Fougère: 'fougere', 'Oriental/Amber': 'oriental', Chypre: 'chypre', Gourmand: 'gourmand',
};
export const anhNhom = (f: string | null | undefined) => `/hinh-anh/nhom-huong/${ANH_NHOM[f ?? ''] ?? 'woody'}.webp`;
/** Màu từng nhóm — lấy đúng bảng màu Vòng tròn khứu giác của giao diện gốc. */
export const MAU_NHOM: Record<string, string> = {
  Floral: '#c9979b', Woody: '#7b5b45', 'Fresh/Citrus': '#d4b46f', Aromatic: '#a3b088',
  Fougère: '#56715d', Gourmand: '#a5675f', 'Oriental/Amber': '#c18f5a', Chypre: '#8a94a0',
};
export const NHAN_QUIZ: Record<string, string> = {
  feminine: 'Nữ tính', masculine: 'Nam tính', warm_opulent: 'Ấm áp & sâu lắng', fresh_clean: 'Tươi mát & rực rỡ',
  night_party: 'Đêm tiệc & sang trọng', day_energy: 'Ngày mới & tự do', mindful_relax: 'Thư thái & tĩnh tại',
  bold: 'Táo bạo, tỏa xa', soft: 'Dịu dàng, tinh khôi', scent_shifter: 'Thích đổi mùi theo tâm trạng', daily_spritzer: 'Mùi hương chữ ký mỗi ngày',
};
