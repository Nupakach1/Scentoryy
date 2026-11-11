# SCENTORY — Website nước hoa niche cá nhân hóa

Đồ án môn Phát triển Web. Scentory bán nước hoa niche chính hãng, lập **hồ sơ mùi hương** bằng Scent Quiz 7 câu / 8 bước
và gợi ý sản phẩm bằng thuật toán **Scent Match** (5 tiêu chí: nhóm hương 30%, dịp dùng 25%, độ tỏa 20%, ngân sách 15% — tùy chọn, thời tiết 10%).

| Thành phần | Công nghệ |
| :--- | :--- |
| Giao diện | Angular 18 (standalone, signals), CSS gốc của bản thiết kế customer-ui |
| API | Node.js 20 · Express 5 · TypeScript strict · Zod · JWT cookie httpOnly |
| CSDL | MongoDB Atlas · Mongoose 9 (17 collection) · GridFS (minh chứng đổi trả) |
| Thời gian thực | Socket.IO (hộp thư khách ↔ quản trị) |

## Cấu trúc thư mục

Thư mục này chỉ chứa những gì cần để chạy website và đưa lên GitHub / Vercel.
Báo cáo, hồ sơ BA, sơ đồ, ảnh màn hình, công cụ sinh tài liệu và bộ test tự động nằm ở gói riêng **Scentory_BaoCao**.

```
Scentory2/
├── README.md · CHANGELOG.md · HUONG-DAN-CHAY.md · TRIEN-KHAI-VERCEL.md · .gitignore · vercel.json
├── api/index.ts                 Điểm vào serverless (Vercel) dùng chung Express app
├── bat/                         Windows: cài đặt lần đầu, cài cho thành viên khác, chạy web, chạy giả lập
├── backend/                     REST API /api/v1
│   ├── src/
│   │   ├── cau-hinh/            env, hằng số nghiệp vụ, mã lỗi, Scent Match, thời tiết
│   │   ├── csdl/                kết nối MongoDB (có cache cho serverless)
│   │   ├── mo-hinh/             17 Mongoose model
│   │   ├── dinh-tuyen/          router: auth, catalog, personalization, account, cart, orders, aftersales, messages, admin
│   │   ├── trung-gian/          xác thực/phân quyền, xử lý lỗi, upload
│   │   ├── dich-vu/             nghiệp vụ: quizMapping, scentMatch, payment, orderService, behavior, chatbot, evaluation…
│   │   ├── thoi-gian-thuc/      Socket.IO
│   │   ├── tien-ich/            khuôn phản hồi, phân trang, mật khẩu
│   │   └── kich-ban/            seed danh mục, seed dữ liệu minh họa, evaluate, reset mật khẩu admin
│   ├── du-lieu/san-pham/        dữ liệu nguồn 37 sản phẩm / 6 thương hiệu / 8 nhóm hương
│   └── gia-lap/                 máy chủ giả lập không cần CSDL (bat/3, cổng 3100)
└── frontend/                    Angular
    └── src/
        ├── app/ts/ · app/html/  dich-vu/, bo-cuc/, dung-chung/, trang-khach/ (23 trang), trang-quan-tri/ (9 trang)
        ├── css/khach-hang/ · css/quan-tri/   hai bundle CSS theo phân hệ
        ├── font-chu/            Plus Jakarta Sans lưu cục bộ
        └── hinh-anh/            ảnh WebP: san-pham, thuong-hieu, nhom-huong, banner, logo, icon, trang-tri
```

## Chạy dự án

> Hướng dẫn: **[Chạy trên máy](HUONG-DAN-CHAY.md)** · **[Đưa lên Vercel](TRIEN-KHAI-VERCEL.md)**.

1. Lấy tệp `backend/.env` từ trưởng nhóm (hoặc sao chép `.env.example` và điền chuỗi MongoDB Atlas + `JWT_SECRET`). **Không commit `.env`.**
2. Windows: chạy `bat/1b-cai-dat-thanh-vien-khac.bat` (người quản lý CSDL dùng `1-cai-dat-lan-dau.bat`), sau đó `bat/2-chay-web.bat` → http://localhost:3000.
3. Thủ công:
   ```bash
   cd backend && npm install && npm run dev          # API + phục vụ bản build Angular tại :3000
   cd frontend && npm install && npx ng build        # hoặc: npx ng serve (cổng 4200, proxy /api → :3000)
   ```
4. Không có CSDL? `cd backend && npm run gia-lap` → http://localhost:3100 (dữ liệu trong bộ nhớ, dùng lại hàm nghiệp vụ thật).

Tài khoản minh họa: quản trị `admin@scentory.vn / Admin@12345` (cổng `/admin/dang-nhap`); khách `nga@scentory.vn`, `long@scentory.vn`, `phuong@scentory.vn` / `Scentory123`.

## Lệnh hữu ích (backend)

| Lệnh | Tác dụng |
| :--- | :--- |
| `npm run seed` | Nạp/cập nhật danh mục (upsert, an toàn chạy lại) + tài khoản admin |
| `npm run seed:demo -- --xac-nhan` | Nạp dữ liệu minh họa — **xóa đơn hàng cũ**, chỉ người quản lý CSDL chạy |
| `npm run evaluate` | Đánh giá ngoại tuyến Scent Match (Precision@3, HitRate@3, NDCG@3, coverage, độ ổn định) |
| `npm run lint` · `npm run build` | ESLint · biên dịch TypeScript |
