export const vietnamDate = (epoch: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(epoch);
export const vietnamTime = (value: string | number): string => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
export const longDate = (epoch: number): string => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(epoch);
export const shortDate = (value: string): string => value.slice(0, 10).split('-').reverse().join('/');
export const dateTimeInput = (epoch: number): string => `${vietnamDate(epoch)}T${vietnamTime(epoch)}`;
export const labels: Record<string, string> = {
  ACCEPTED: 'Đã ghi nhận', IGNORED: 'Bỏ qua', REJECTED: 'Không ghi nhận', PENDING_REVIEW: 'Chờ xác minh',
  ACTIVE: 'Đang làm việc', INACTIVE: 'Ngừng hoạt động', OPEN: 'Chờ HR xác minh', VERIFIED: 'Đã xác minh',
  PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', CANCELLED: 'Đã hủy', CONFIRMED: 'Đã xác nhận', PLANNED: 'Dự kiến', SCHEDULED: 'Đã xếp ca',
  IN: 'Vào', OUT: 'Ra', ADD_EVENT: 'Bổ sung lượt', REPLACE_EVENT: 'Sửa lượt chấm', VOID_EVENT: 'Hủy lượt chấm', PRESENCE: 'Xác minh hiện diện',
  NO_SCHEDULE: 'Chưa có lịch ca cho ngày này', SUPPORT_UNASSIGNED: 'Cảnh báo phân công support — cần HR xác minh',
  MISSING_PREVIOUS_OUT: 'Thiếu lượt ra tại cơ sở trước', LOCKED_SCHEDULE_LATE_DATA: 'Ngày công đã khóa — giữ nguyên kết quả đã chốt',
  COOLDOWN: 'Quét lại quá sớm', BACKDATED_SCAN: 'Giờ chấm lùi trước lượt đã có', NO_FACE: 'Không tìm thấy khuôn mặt',
  UNREGISTERED: 'Khuôn mặt chưa đăng ký', EMPLOYEE_INACTIVE: 'Nhân viên không trong thời gian làm việc', FACILITY_INACTIVE: 'Cơ sở ngừng hoạt động',
  QR_INVALID: 'QR không hợp lệ', QR_WRONG_FACILITY: 'QR sai cơ sở', QR_REVOKED: 'QR đã thu hồi', QR_MISSING: 'Chưa có QR', GPS_OUT_OF_RANGE: 'Vị trí ngoài khu vực', QR_EXPIRED: 'QR đã hết hạn', QR_ALREADY_USED: 'QR đã được sử dụng', GPS_UNAVAILABLE: 'Thiếu bằng chứng vị trí', OK: 'Hợp lệ',
};
export const label = (value: string): string => labels[value] ?? value;
