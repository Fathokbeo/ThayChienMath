// Một ô của biểu mẫu "Đăng ký học" (admin tùy chỉnh ở trang Đăng ký học → Biểu mẫu). Xem backend
// services/registrationForm.js: ô có sẵn (key cố định) + ô admin tự thêm (key "c_...").
export type RegFieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'tel';
export type RegField = {
  key: string; label: string; type: RegFieldType; required: boolean; placeholder?: string; options?: string[];
  enabled?: boolean; locked?: boolean; // chỉ có ở bản admin
};

export const FIELD_TYPE_LABELS: Record<Exclude<RegFieldType, 'tel'>, string> = {
  text: 'Chữ ngắn', textarea: 'Đoạn văn', number: 'Số', select: 'Chọn 1 trong danh sách', date: 'Ngày',
};

// Ô có sẵn — dùng khi chưa tải được cấu hình từ máy chủ
export const DEFAULT_REG_FIELDS: RegField[] = [
  { key: 'student_name', label: 'Họ tên học sinh', type: 'text', required: true },
  { key: 'parent_phone', label: 'Số điện thoại phụ huynh', type: 'tel', required: true, placeholder: 'vd 0912 345 678' },
  { key: 'school', label: 'Trường đang học', type: 'text', required: true, placeholder: 'vd THCS Trưng Vương' },
  { key: 'class_name', label: 'Lớp', type: 'text', required: true, placeholder: 'vd 8A1' },
  { key: 'last_score', label: 'Điểm tổng kết môn Toán học kỳ gần nhất', type: 'number', required: true, placeholder: 'vd 8.5' },
  { key: 'note', label: 'Ghi chú', type: 'textarea', required: false },
];
