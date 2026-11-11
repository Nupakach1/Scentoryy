# Đưa Scentory lên Vercel (có link chạy trực tiếp)

Kết quả: một địa chỉ dạng `https://scentory-xxx.vercel.app` mở được trên mọi máy, không cần cài gì. Dữ liệu dùng chung CSDL MongoDB Atlas của nhóm.

Dự án đã có sẵn cấu hình (`vercel.json`, `api/index.ts`), không cần sửa code. Chỉ cần làm 4 bước dưới đây, mất khoảng 15 phút.

## Bước 1 — Đưa mã nguồn lên GitHub

1. Tạo tài khoản tại github.com (nếu chưa có) → **New repository** → đặt tên `scentory`, chọn **Private** → **Create repository**.
2. Cách dễ nhất: cài **GitHub Desktop** → *File → Add local repository* → chọn thư mục `Scentory2` → *Create a repository* nếu được hỏi → **Commit to main** → **Publish repository** (bỏ chọn *Keep this code private* nếu muốn công khai).

   Hoặc dùng lệnh trong thư mục `Scentory2`:
   ```
   git init
   git add .
   git commit -m "Scentory 2.2"
   git branch -M main
   git remote add origin https://github.com/<tên-bạn>/scentory.git
   git push -u origin main
   ```
3. Kiểm tra trên GitHub: **không** được thấy tệp `backend/.env`, thư mục `node_modules`. (Tệp `.gitignore` đã chặn sẵn.)

## Bước 2 — Cho phép Vercel kết nối MongoDB Atlas

Vercel chạy trên nhiều máy chủ có IP thay đổi, nên Atlas phải mở cho mọi IP:

Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`) → **Confirm**.

(Mật khẩu CSDL vẫn bảo vệ dữ liệu; nhớ giữ kín chuỗi `MONGODB_URI`.)

## Bước 3 — Tạo dự án trên Vercel

1. Vào vercel.com → **Sign Up / Log in with GitHub**.
2. **Add New… → Project** → chọn repository `scentory` → **Import**.
3. Màn hình cấu hình:
   - **Framework Preset**: `Other`
   - **Root Directory**: để nguyên `./`
   - **Build and Output Settings**: để nguyên (Vercel tự đọc từ `vercel.json`).
4. Mở mục **Environment Variables**, thêm 3 biến (chép giá trị từ tệp `backend/.env`):

   | Name | Value |
   | :--- | :--- |
   | `MONGODB_URI` | chuỗi `mongodb+srv://...` trong `.env` |
   | `JWT_SECRET` | chuỗi `JWT_SECRET` trong `.env` (dài ≥ 32 ký tự) |
   | `NODE_ENV` | `production` |

   Nếu nhóm đã cấu hình gửi email OTP thì thêm `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` như trong `.env`.
5. Bấm **Deploy** và đợi 2–4 phút. Xong sẽ có nút **Visit** và địa chỉ `https://<tên>.vercel.app`.

## Bước 4 — Kiểm tra

- `https://<tên>.vercel.app/api/v1/health` → phải thấy `"status":"ok"` và `"db":"connected"`.
- `https://<tên>.vercel.app` → trang chủ, có sản phẩm.
- `https://<tên>.vercel.app/admin/dang-nhap` → `admin@scentory.vn` / `Admin@12345`.

Muốn đổi tên miền dễ nhớ: Vercel → Project → **Settings → Domains** → sửa thành ví dụ `scentory-nhom5.vercel.app`.

## Cập nhật về sau

Mỗi lần sửa code: commit và push lên GitHub (GitHub Desktop: **Commit** → **Push origin**). Vercel tự build và cập nhật link sau vài phút.

## Khác biệt so với chạy trên máy

| Tính năng | Trên máy (`2-chay-web.bat`) | Trên Vercel |
| :--- | :--- | :--- |
| Tin nhắn, số đếm trên menu quản trị | Hiện ngay lập tức | Tự cập nhật sau tối đa 10 giây (hộp thư) / 30 giây (số đếm menu) — Vercel không hỗ trợ kết nối thời gian thực |
| Mã OTP quên mật khẩu (khi chưa cấu hình email) | In ra cửa sổ đen | Xem ở Vercel → Project → **Logs** |
| Ảnh minh chứng đổi trả | Tối đa 10 MB | Tối đa khoảng 4 MB (giới hạn của Vercel) |
| Lần mở đầu tiên sau thời gian dài không dùng | Nhanh | Chậm 2–5 giây (máy chủ "thức dậy") |

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| :--- | :--- |
| `/api/v1/health` báo lỗi 500 hoặc *timed out* | Chưa mở `0.0.0.0/0` trên Atlas, hoặc sai `MONGODB_URI`. Sửa xong vào **Deployments → … → Redeploy**. |
| Báo thiếu `JWT_SECRET` / `MONGODB_URI` | Chưa thêm biến môi trường. Vào **Settings → Environment Variables**, thêm rồi **Redeploy**. |
| Đăng nhập xong vẫn bị đăng xuất | Kiểm tra `NODE_ENV` = `production` và đang mở bằng `https://`. |
| Build thất bại | Mở **Deployments → bản lỗi → Build Logs**, chụp phần chữ đỏ gửi nhóm. |
| Trang trắng khi tải lại một trang con | Kiểm tra tệp `vercel.json` có trên GitHub. |
