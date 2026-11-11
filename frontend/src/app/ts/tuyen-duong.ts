import { Routes } from '@angular/router';
import { canAdmin, canDangNhap, canDangNhapHopThoai } from './dich-vu/bao-ve';
import { KhungKhach } from './bo-cuc/khung-khach';
import { KhungQuanTri } from './bo-cuc/khung-quan-tri';

/**
 * Bản đồ trang — khớp docs/scentory/ui/sitemap.md. `data.body` là body class của màn hình gốc
 * trong customer-ui (CSS định danh theo body class), `data.uc` là use case tương ứng.
 */
type Nap = () => Promise<any>;
const p = (path: string, nap: Nap, body: string, uc: string, extra: object = {}) => ({ path, data: { body, uc }, loadComponent: nap, ...extra });

export const tuyenDuong: Routes = [
  {
    path: 'admin',
    children: [
      { path: 'dang-nhap', data: { uc: 'UC-AUTH-004' }, loadComponent: () => import('./trang-quan-tri/dang-nhap-quan-tri').then((m) => m.DangNhapQuanTri) },
      {
        path: '', component: KhungQuanTri, canActivate: [canAdmin],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
          { path: 'tong-quan', loadComponent: () => import('./trang-quan-tri/tong-quan').then((m) => m.TongQuan) },
          { path: 'san-pham', loadComponent: () => import('./trang-quan-tri/san-pham').then((m) => m.QuanLySanPham) },
          { path: 'don-hang', loadComponent: () => import('./trang-quan-tri/don-hang').then((m) => m.QuanLyDonHang) },
          { path: 'don-hang/:id', loadComponent: () => import('./trang-quan-tri/chi-tiet-don-hang').then((m) => m.ChiTietDonHangQT) },
          { path: 'doi-tra', loadComponent: () => import('./trang-quan-tri/doi-tra').then((m) => m.QuanLyDoiTra) },
          { path: 'khach-hang', loadComponent: () => import('./trang-quan-tri/khach-hang').then((m) => m.QuanLyKhachHang) },
          { path: 'hop-thu', loadComponent: () => import('./trang-quan-tri/hop-thu').then((m) => m.HopThuQuanTri) },
          { path: 'danh-gia-goi-y', loadComponent: () => import('./trang-quan-tri/danh-gia-goi-y').then((m) => m.DanhGiaGoiY) },
        ],
      },
    ],
  },
  {
    path: '', component: KhungKhach,
    children: [
      p('', () => import('./trang-khach/trang-chu').then((m) => m.TrangChu), 'home-rebuild', 'UC-CAT-001', { pathMatch: 'full' }),
      p('nuoc-hoa', () => import('./trang-khach/danh-sach-san-pham').then((m) => m.DanhSachSanPham), 'catalog-rebuild', 'UC-CAT-001'),
      p('uu-dai', () => import('./trang-khach/danh-sach-san-pham').then((m) => m.DanhSachSanPham), 'catalog-rebuild', 'UC-CAT-001', { data: { body: 'catalog-rebuild', uc: 'UC-CAT-001', uuDai: true } }),
      p('nuoc-hoa/:sku', () => import('./trang-khach/chi-tiet-san-pham').then((m) => m.ChiTietSanPham), 'detail-rebuild', 'UC-CAT-002'),
      p('nhom-huong', () => import('./trang-khach/nhom-huong').then((m) => m.NhomHuongTrang), 'families-page', 'UC-CAT-003'),
      p('thuong-hieu', () => import('./trang-khach/thuong-hieu').then((m) => m.ThuongHieuTrang), 'brand-rebuild brand-list-page', 'UC-CAT-003'),
      p('thuong-hieu/:slug', () => import('./trang-khach/chi-tiet-thuong-hieu').then((m) => m.ChiTietThuongHieu), 'brand-detail-page', 'UC-CAT-003'),
      p('ve-scentory', () => import('./trang-khach/gioi-thieu').then((m) => m.GioiThieu), 'about-rebuild', 'UC-CAT-003'),
      p('scent-quiz/buoc/:buoc', () => import('./trang-khach/scent-quiz').then((m) => m.ScentQuiz), 'quiz-rebuild', 'UC-QUIZ-001', { canActivate: [canDangNhapHopThoai] }),
      p('scent-quiz/phan-tich', () => import('./trang-khach/phan-tich').then((m) => m.PhanTich), 'quiz-rebuild analysis-page', 'UC-QUIZ-001', { canActivate: [canDangNhapHopThoai] }),
      p('scent-quiz/ho-so', () => import('./trang-khach/ho-so-mui-huong').then((m) => m.HoSoMuiHuong), 'quiz-rebuild profile-page', 'UC-QUIZ-001', { canActivate: [canDangNhapHopThoai] }),
      p('scent-quiz/goi-y', () => import('./trang-khach/goi-y').then((m) => m.GoiY), 'quiz-rebuild recommendations-page', 'UC-MTCH-001', { canActivate: [canDangNhapHopThoai] }),
      { path: 'scent-quiz', pathMatch: 'full', redirectTo: 'scent-quiz/buoc/1' },
      p('gio-hang', () => import('./trang-khach/gio-hang').then((m) => m.GioHangTrang), 'cart-page', 'UC-CART-001', { canActivate: [canDangNhapHopThoai] }),
      p('thanh-toan', () => import('./trang-khach/thanh-toan').then((m) => m.ThanhToan), 'transaction-page checkout-page', 'UC-ORD-001', { canActivate: [canDangNhap] }),
      p('dang-nhap', () => import('./trang-khach/dang-nhap').then((m) => m.DangNhap), 'auth-form-page', 'UC-AUTH-002'),
      p('dang-ky', () => import('./trang-khach/dang-ky').then((m) => m.DangKy), 'auth-form-page', 'UC-AUTH-001'),
      p('quen-mat-khau', () => import('./trang-khach/quen-mat-khau').then((m) => m.QuenMatKhau), 'password-page', 'UC-AUTH-003'),
      p('tai-khoan/don-hang', () => import('./trang-khach/don-hang-cua-toi').then((m) => m.DonHangCuaToi), 'transaction-page account-page', 'UC-ORD-002', { canActivate: [canDangNhap] }),
      p('tai-khoan/don-hang/:id', () => import('./trang-khach/chi-tiet-don').then((m) => m.ChiTietDon), 'order-detail-page', 'UC-ORD-002', { canActivate: [canDangNhap] }),
      p('tai-khoan/doi-tra/:id', () => import('./trang-khach/doi-tra').then((m) => m.DoiTra), 'transaction-page return-page', 'UC-RET-001', { canActivate: [canDangNhap] }),
      p('tai-khoan/so-dia-chi', () => import('./trang-khach/so-dia-chi').then((m) => m.SoDiaChi), 'transaction-page account-page address-book-page', 'UC-ACC-002', { canActivate: [canDangNhap] }),
      p('yeu-thich', () => import('./trang-khach/yeu-thich').then((m) => m.YeuThich), 'catalog-rebuild wishlist-page', 'UC-ACC-001', { canActivate: [canDangNhap] }),
      p('hop-thu', () => import('./trang-khach/hop-thu').then((m) => m.HopThu), 'transaction-page inbox-page', 'UC-MSG-001', { canActivate: [canDangNhap] }),
      p('**', () => import('./trang-khach/khong-tim-thay').then((m) => m.KhongTimThay), 'error-404-page', '—'),
    ],
  },
];
