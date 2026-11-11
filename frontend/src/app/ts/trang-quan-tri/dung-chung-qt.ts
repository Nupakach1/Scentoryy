/** Nhãn & màu trạng thái dùng chung ở phân hệ quản trị. */
export const MAU_DON: Record<string, string> = { PROCESSING: 'nhan-vang', SHIPPING: 'nhan-xanh', DELIVERED: 'nhan-luc', CANCELLED: 'nhan-do' };
export const MAU_TT: Record<string, string> = { PENDING: 'nhan-vang', PAID: 'nhan-luc', FAILED: 'nhan-do', REFUNDED: 'nhan-xam' };
export const MAU_DT: Record<string, string> = { PENDING: 'nhan-vang', APPROVED: 'nhan-xanh', REJECTED: 'nhan-do', COMPLETED: 'nhan-luc' };
/** FSM đơn phía quản trị (BR-ORD-002). */
export const CHUYEN_DON: Record<string, string[]> = { PROCESSING: ['SHIPPING', 'CANCELLED'], SHIPPING: ['DELIVERED', 'CANCELLED'], DELIVERED: [], CANCELLED: [] };
/** FSM đổi trả (BR-RET-004). */
export const CHUYEN_DT: Record<string, string[]> = { PENDING: ['APPROVED', 'REJECTED'], APPROVED: ['COMPLETED'], REJECTED: [], COMPLETED: [] };
