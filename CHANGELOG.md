# Nhật ký thay đổi

Theo [Semantic Versioning](https://semver.org/lang/vi/) — rule OpenBA 19 (document-versioning).

## [2.3.0] — 2026-11-11

### Thay đổi (giao diện theo bản gốc customer-ui)
- **8 nhóm hương Michael Edwards** (Woody, Aromatic, Floral, Fresh/Citrus, Fougère, Oriental/Amber, Chypre, Gourmand) thay cho 6 nhóm gộp: dữ liệu sản phẩm lấy cột "Nhóm hương (Michael Edwards)", thẻ nhóm lấy nội dung trang gốc, Scent Match/quiz/thời tiết tính theo 8 nhóm. `npm run seed` xóa 6 nhóm cũ và chuyển hồ sơ mùi hương đã lưu sang 8 nhóm. Đánh giá ngoại tuyến: Precision@3 0,944 · HitRate@3 1 · NDCG@3 1 · độ phủ 0,324.
- Menu **Nhóm hương / Nước hoa / Thương hiệu** xổ xuống khi rê chuột (Nước hoa: Nam, Nữ, 6 thương hiệu).
- **Vòng tròn khứu giác**: cung vẽ dần khi cuộn tới, rê chuột làm nổi nhóm và đổi chữ ở tâm (port scent-wheel.js gốc).
- **Hộp thoại "Đăng nhập để …"** (giỏ hàng, yêu thích, Scent Quiz) thay cho chuyển thẳng sang trang đăng nhập; sản phẩm đang chọn tự vào giỏ sau khi đăng nhập/đăng ký.
- **Hộp thoại OTP giả lập** ở Quên mật khẩu khi chưa cấu hình email (điền tự động / sao chép / đếm ngược).
- Poster trang Đăng nhập, Đăng ký, Khôi phục mật khẩu theo đúng nội dung gốc từng bước; bỏ các dòng chú thích nhỏ ở chân poster; nhãn đầu poster đồng bộ phông, cỡ, màu, không nền.

### Sửa
- Route guard gọi `inject()` sau `await` khiến điều hướng lỗi về trang chủ.

## [2.2.1] — 2026-11-11

### Thêm
- `TRIEN-KHAI-VERCEL.md`: hướng dẫn đưa website lên Vercel (đã chạy thử `vercel build` thành công).
- Dự phòng khi không có kết nối realtime (bản Vercel serverless): hộp thư khách và quản trị tự tải lại mỗi 10 giây; Socket.IO chỉ thử kết nối lại 5 lần.

## [2.2.0] — 2026-11-11

### Thay đổi
- Trang quản trị dùng logo của trang khách (bản sáng trên thanh menu, bản tối trên thẻ đăng nhập).
- Nền trang đăng nhập quản trị đổi sang ảnh độ phân giải cao (`banner/nuoc-hoa.webp`, 1888px) — hết vỡ ảnh trên màn hình rộng.
- `bat/2-chay-web.bat`, `bat/3-chay-gia-lap-khong-csdl.bat`: kiểm tra `.env`, thư viện và bản build trước khi chạy; mở trình duyệt sau khi máy chủ sẵn sàng; giữ cửa sổ khi có lỗi.

### Tài liệu
- Hồ sơ BA: thêm FR-DASH-KPI-003 (huy hiệu menu), AC-04 của US-DASH-01, TC-DASH-004 (TC đánh giá Precision@3 đổi thành TC-DASH-005); API spec thêm `GET /admin/badges` và sự kiện `admin:badges`. Tổng: 64 FR, 76 AC, 76 TC, RTM 100%.
- Sơ đồ kiến trúc hệ thống và sơ đồ tuần tự đặt hàng cập nhật luồng số đếm quản trị; 14 ảnh màn hình quản trị chụp lại; Chương 3 và Chương 4 dựng lại.

## [2.1.0] — 2026-11-11

### Thêm
- Huy hiệu số đếm trên menu quản trị (kiểu ứng dụng nhắn tin): **Đơn hàng** = đơn chờ xử lý, **Đổi trả** = yêu cầu chờ duyệt, **Hộp thư** = tin chưa đọc. Cập nhật tức thì qua Socket.IO khi khách đặt đơn, hủy đơn, gửi yêu cầu đổi trả hoặc nhắn tin; tự giảm khi quản trị xử lý/đọc. API mới `GET /api/v1/admin/badges`.

## [2.0.1] — 2026-11-11

### Sửa
- Tên tệp dữ liệu sản phẩm đổi sang không dấu (`nhom-huong.json`, `tong-hop-sp.json`, `dior-privee.json`) — sửa lỗi seed `ENOENT` khi giải nén trên Windows.
- Font Plus Jakarta Sans lưu cục bộ trong `frontend/src/font-chu/`, dùng chung cho cả trang khách và trang quản trị (trước đây trang quản trị không nạp được font).
- Gỡ mã UC/BR và các dòng chú thích kỹ thuật khỏi giao diện người dùng; chụp lại ảnh màn hình quản trị 50–63.

## [2.0.0] — 2026-11-11

### Thay đổi lớn (MAJOR)
- Toàn bộ mã định danh chuyển sang chuẩn **OpenBA**: UC-[MODULE]-[SEQ], FR/BR/ERR, US/AC/TC, RTM 100% (bảng đổi mã cũ → mới trong `docs/scentory/cr/CR-001-dong-bo-giao-dien-moi.md`).
- Giao diện viết lại bằng **Angular 18**, giữ nguyên thiết kế customer-ui mới, nối API thật (thay HTML/JS thuần).
- API chuẩn hóa `/api/v1` với khuôn `{success, data, error, meta, timestamp}`; mã lỗi sinh tự động từ ma trận lỗi.

### Thêm
- Scent Quiz 7 câu / 8 bước, hồ sơ tạm cho khách vãng lai và đồng bộ khi đăng nhập (BR-QUIZ-004).
- Thanh toán COD / QR (hết hạn 15 phút) / Thẻ (Luhn); voucher SCENTORY10, WELCOME50, FREESHIP; giao tiêu chuẩn / hỏa tốc.
- Đổi trả có minh chứng (GridFS), đánh giá phản hồi độ tỏa thực tế, hộp thư realtime, chatbot theo luật, thời tiết Open-Meteo.
- Trang quản trị: tổng quan, sản phẩm, đơn hàng (FSM), đổi trả, khách hàng (khóa + thu hồi phiên), hộp thư, đánh giá gợi ý.
- 25 sơ đồ BPMN theo UC, 2 sơ đồ use case UML, máy chủ giả lập không CSDL, 60 ảnh màn hình.

## [1.0.0] — 2026-10-20
- Bản đặc tả và mã nguồn đầu tiên theo mã UC-KH/UC-AD, giao diện HTML/JS thuần.
