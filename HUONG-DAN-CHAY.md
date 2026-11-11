# Hướng dẫn chạy website Scentory

## 1. Cài đặt một lần

| Cần có | Ghi chú |
| :--- | :--- |
| **Node.js 20 trở lên** | Tải bản LTS tại nodejs.org. Kiểm tra bằng lệnh `node -v`. |
| **Tệp `backend/.env`** | Xin trưởng nhóm, chép vào thư mục `backend/` (ngang hàng `package.json`). Tên tệp phải đúng là `.env`, không phải `.env.txt`. **Không đưa tệp này lên GitHub.** |
| **Mạng được phép vào CSDL** | Trưởng nhóm thêm IP của bạn trên MongoDB Atlas (*Network Access*), hoặc mở cho mọi IP (`0.0.0.0/0`). |

## 2. Chạy trên Windows (cách nhanh nhất)

Giải nén dự án, mở thư mục `bat/` rồi bấm đúp vào tệp tương ứng:

| Bước | Tệp | Ai chạy |
| :--- | :--- | :--- |
| Cài lần đầu | `1b-cai-dat-thanh-vien-khac.bat` | **Thành viên** — chỉ cài thư viện và build giao diện, không đụng vào dữ liệu |
| Cài lần đầu | `1-cai-dat-lan-dau.bat` | **Chỉ trưởng nhóm**, chạy 1 lần — nạp sản phẩm vào CSDL dùng chung |
| Chạy web | `2-chay-web.bat` | Mọi người — trình duyệt tự mở **http://localhost:3000** |
| Chạy không cần CSDL | `3-chay-gia-lap-khong-csdl.bat` | Khi không có mạng hoặc chưa có `.env` — mở **http://localhost:3100** (dữ liệu mẫu, mất khi tắt) |

Sau khi bấm `2-chay-web.bat`, **giữ nguyên cửa sổ đen** — trình duyệt tự mở sau khoảng 8 giây. Đóng cửa sổ đen (hoặc bấm `Ctrl + C`) là tắt web. Nếu thiếu `.env`, chưa cài thư viện hoặc có lỗi, cửa sổ sẽ dừng lại và ghi rõ nguyên nhân.

## 3. Chạy bằng lệnh (macOS / Linux / Windows)

```bash
# Lần đầu
cd frontend && npm install && npx ng build && cd ..
cd backend  && npm install

# Mỗi lần chạy (trong thư mục backend)
npm run dev            # → http://localhost:3000
```

Khi sửa giao diện và muốn trang tự tải lại, mở thêm một cửa sổ thứ hai: `cd frontend && npx ng serve`, rồi vào **http://localhost:4200** (cửa sổ backend vẫn phải đang chạy).

## 4. Tài khoản dùng thử

| Vai trò | Đăng nhập tại | Email | Mật khẩu |
| :--- | :--- | :--- | :--- |
| Quản trị | `localhost:3000/admin/dang-nhap` (gõ trên thanh địa chỉ) | admin@scentory.vn | Admin@12345 |
| Khách hàng | `localhost:3000/dang-nhap` | nga@scentory.vn · long@scentory.vn · phuong@scentory.vn | Scentory123 |

- Thẻ thanh toán thử: `4111 1111 1111 1111`, tên chủ thẻ bất kỳ, hạn trong tương lai (ví dụ `12/28`), CVV `123`.
- Mã OTP khi quên mật khẩu: nếu chưa cấu hình email, mã được in ra **cửa sổ đang chạy backend**. Ở bản giả lập, mã luôn là `123456`.

## 5. Lưu ý quan trọng

- **Không chạy** `1-cai-dat-lan-dau.bat` hay lệnh `npm run seed:demo` nếu bạn không phải trưởng nhóm: lệnh này **xóa đơn hàng, tin nhắn, đổi trả** trên CSDL cả nhóm đang dùng chung.
- Sau khi kéo code mới về (`git pull`), chạy lại `1b-cai-dat-thanh-vien-khac.bat` (hoặc `npm install` + `npx ng build`) rồi mới chạy web.
- Khi trưởng nhóm cập nhật cấu trúc sản phẩm, chỉ cần một người chạy `npm run seed` trong `backend/`. Lệnh này an toàn khi chạy lại, không xóa đơn hàng.

## 6. Gặp lỗi?

| Hiện tượng | Cách xử lý |
| :--- | :--- |
| `'node' is not recognized` | Chưa cài Node.js, hoặc cần mở lại máy sau khi cài. |
| Trình duyệt báo *refused to connect* | Máy chủ chưa chạy hoặc cửa sổ đen đã bị đóng. Chạy lại `2-chay-web.bat` và giữ cửa sổ mở. |
| Bấm link trong cửa sổ đen không mở | Giữ phím `Ctrl` rồi bấm, hoặc gõ địa chỉ vào trình duyệt. |
| Đã chép `.env` mà vẫn báo thiếu | Windows ẩn đuôi tệp nên tệp thực ra là `.env.txt`. Mở cmd trong thư mục `backend` và gõ `ren .env.txt .env`. |
| Đăng nhập trang quản trị báo *không có quyền quản trị* | Đang dùng tài khoản khách. Dùng `admin@scentory.vn`. |
| Báo thiếu `MONGODB_URI` / `JWT_SECRET` | Chưa có `backend/.env`, hoặc tệp đặt sai thư mục. |
| Báo lỗi kết nối MongoDB / *timed out* | IP chưa được cho phép trên Atlas, hoặc mạng (wifi trường, VPN) chặn cổng 27017. Thử mạng khác hoặc dùng `3-chay-gia-lap-khong-csdl.bat`. |
| `EADDRINUSE: 3000` | Web đang chạy ở một cửa sổ khác. Đóng cửa sổ đó, hoặc đổi `PORT=3001` trong `.env`. |
| Vào localhost:3000 thấy trang trắng hoặc *Cannot GET* | Chưa build giao diện. Chạy `cd frontend && npx ng build`, rồi khởi động lại backend. |
| Sửa giao diện nhưng web không đổi | Bản ở cổng 3000 là bản đã build. Chạy lại `npx ng build`, hoặc dùng `npx ng serve` (cổng 4200). |
| Không có sản phẩm nào | CSDL chưa được nạp dữ liệu. Nhờ trưởng nhóm chạy `npm run seed`. |
