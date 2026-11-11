/**
 * Ma trận mã lỗi — SINH TỰ ĐỘNG từ docs (tools/ba/ba_data.py, rule OpenBA 03 + 11).
 * Không sửa tay: chạy `python3 tools/ba/gen_ma_loi.py` sau khi đổi ma trận lỗi.
 */
export interface ErrorDef { http: number; key: string; message: string; severity: "Critical" | "High" | "Medium" | "Low" }

export const ERRORS = {
  "ERR-VAL-422-01": { http: 422, key: "error.validation.invalid", message: "Thông tin chưa hợp lệ, vui lòng kiểm tra các trường được đánh dấu.", severity: "Medium" },
  "ERR-VAL-400-01": { http: 400, key: "error.validation.json", message: "Yêu cầu không hợp lệ.", severity: "Low" },
  "ERR-SYS-404-01": { http: 404, key: "error.system.notFound", message: "Không tìm thấy tài nguyên.", severity: "Low" },
  "ERR-SYS-500-01": { http: 500, key: "error.system.internal", message: "Hệ thống đang bận, vui lòng thử lại sau.", severity: "Critical" },
  "ERR-AUTH-401-01": { http: 401, key: "error.auth.invalidCredentials", message: "Email hoặc mật khẩu không chính xác.", severity: "High" },
  "ERR-AUTH-401-02": { http: 401, key: "error.auth.unauthenticated", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", severity: "High" },
  "ERR-AUTH-403-01": { http: 403, key: "error.auth.forbidden", message: "Bạn không có quyền thực hiện thao tác này.", severity: "High" },
  "ERR-AUTH-403-02": { http: 403, key: "error.auth.notAdmin", message: "Tài khoản không có quyền quản trị.", severity: "High" },
  "ERR-AUTH-409-01": { http: 409, key: "error.auth.duplicate", message: "Email hoặc số điện thoại đã được sử dụng.", severity: "Medium" },
  "ERR-AUTH-422-01": { http: 422, key: "error.auth.weakPassword", message: "Mật khẩu cần 8–64 ký tự, gồm chữ cái và chữ số.", severity: "Medium" },
  "ERR-AUTH-400-01": { http: 400, key: "error.auth.invalidOtp", message: "Mã OTP không hợp lệ hoặc đã hết hạn.", severity: "Medium" },
  "ERR-AUTH-400-02": { http: 400, key: "error.auth.invalidResetToken", message: "Phiên đặt lại mật khẩu đã hết hạn.", severity: "Medium" },
  "ERR-AUTH-429-01": { http: 429, key: "error.auth.tooManyRequests", message: "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.", severity: "Medium" },
  "ERR-CAT-404-01": { http: 404, key: "error.catalog.notFound", message: "Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.", severity: "Medium" },
  "ERR-QUIZ-422-01": { http: 422, key: "error.quiz.invalidAnswers", message: "Vui lòng hoàn thành đầy đủ các câu hỏi.", severity: "Medium" },
  "ERR-MTCH-409-01": { http: 409, key: "error.match.profileIncomplete", message: "Hãy làm Scent Quiz để nhận gợi ý dành riêng cho bạn.", severity: "Low" },
  "ERR-MTCH-503-01": { http: 503, key: "warn.match.weatherUnavailable", message: "Chưa lấy được thời tiết, điểm phù hợp tạm tính không gồm tiêu chí thời tiết.", severity: "Low" },
  "ERR-ACC-404-01": { http: 404, key: "error.account.addressNotFound", message: "Không tìm thấy địa chỉ.", severity: "Low" },
  "ERR-ACC-409-01": { http: 409, key: "error.account.addressLimit", message: "Bạn chỉ có thể lưu tối đa 5 địa chỉ.", severity: "Medium" },
  "ERR-CART-404-01": { http: 404, key: "error.cart.itemNotFound", message: "Sản phẩm không còn trong giỏ hàng.", severity: "Low" },
  "ERR-CART-409-01": { http: 409, key: "error.cart.quantityExceeded", message: "Số lượng vượt quá tồn kho hiện có.", severity: "Medium" },
  "ERR-ORD-400-01": { http: 400, key: "error.order.emptyCart", message: "Giỏ hàng của bạn đang trống.", severity: "Medium" },
  "ERR-ORD-409-01": { http: 409, key: "error.order.outOfStock", message: "Một số sản phẩm không đủ tồn kho.", severity: "High" },
  "ERR-ORD-404-01": { http: 404, key: "error.order.notFound", message: "Không tìm thấy đơn hàng.", severity: "Medium" },
  "ERR-ORD-409-02": { http: 409, key: "error.order.cannotCancel", message: "Đơn hàng đang giao nên không thể hủy trực tuyến.", severity: "Medium" },
  "ERR-ORD-409-03": { http: 409, key: "error.order.invalidTransition", message: "Không thể chuyển đơn sang trạng thái này.", severity: "Medium" },
  "ERR-ORD-422-01": { http: 422, key: "error.order.trackingRequired", message: "Vui lòng nhập mã vận đơn.", severity: "Medium" },
  "ERR-PRM-422-01": { http: 422, key: "error.promo.invalidVoucher", message: "Mã giảm giá không hợp lệ hoặc chưa đủ điều kiện.", severity: "Low" },
  "ERR-PAY-422-01": { http: 422, key: "error.payment.invalidCard", message: "Thông tin thẻ không hợp lệ.", severity: "Medium" },
  "ERR-PAY-409-01": { http: 409, key: "error.payment.qrExpired", message: "Phiên thanh toán đã hết hạn, đơn hàng đã được hủy.", severity: "High" },
  "ERR-PAY-409-02": { http: 409, key: "error.payment.unpaid", message: "Đơn chưa được thanh toán, chưa thể giao.", severity: "Medium" },
  "ERR-RET-409-01": { http: 409, key: "error.return.expired", message: "Đơn hàng đã quá hạn 7 ngày đổi trả.", severity: "Medium" },
  "ERR-RET-409-02": { http: 409, key: "error.return.duplicate", message: "Đơn hàng này đã có yêu cầu đổi trả.", severity: "Low" },
  "ERR-RET-409-03": { http: 409, key: "error.return.notDelivered", message: "Chỉ đơn đã giao mới được đổi trả.", severity: "Medium" },
  "ERR-RET-422-01": { http: 422, key: "error.return.invalidEvidence", message: "Tệp minh chứng phải là JPG/PNG/MP4 và không quá 10 MB.", severity: "Medium" },
  "ERR-RET-409-04": { http: 409, key: "error.return.invalidTransition", message: "Không thể chuyển yêu cầu sang trạng thái này.", severity: "Medium" },
  "ERR-REV-403-01": { http: 403, key: "error.review.notPurchased", message: "Bạn chỉ có thể đánh giá sản phẩm đã mua và đã nhận.", severity: "Medium" },
  "ERR-REV-409-01": { http: 409, key: "error.review.duplicate", message: "Bạn đã đánh giá sản phẩm này.", severity: "Low" },
  "ERR-MSG-422-01": { http: 422, key: "error.message.invalidContent", message: "Nội dung tin nhắn từ 1 đến 1000 ký tự.", severity: "Low" },
  "ERR-MSG-429-01": { http: 429, key: "error.message.rateLimited", message: "Bạn gửi tin quá nhanh, vui lòng chờ giây lát.", severity: "Low" },
  "ERR-PRD-409-01": { http: 409, key: "error.product.duplicate", message: "Tên hoặc mã sản phẩm đã tồn tại.", severity: "Medium" },
  "ERR-USR-404-01": { http: 404, key: "error.user.notFound", message: "Không tìm thấy tài khoản.", severity: "Low" },
  "ERR-USR-409-01": { http: 409, key: "error.user.cannotLock", message: "Không thể khóa tài khoản này.", severity: "Medium" },
  "ERR-USR-422-01": { http: 422, key: "error.user.reasonRequired", message: "Vui lòng nhập lý do khóa tài khoản.", severity: "Medium" },
} as const satisfies Record<string, ErrorDef>;

export type ErrorCode = keyof typeof ERRORS;
