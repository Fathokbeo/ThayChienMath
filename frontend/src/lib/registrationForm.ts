// Một câu hỏi của biểu mẫu "Đăng ký học" (admin soạn kiểu Google Form ở trang Đăng ký học → Biểu mẫu).
// Xem backend services/registrationForm.js: câu có sẵn (key cố định) + câu admin tự thêm (key "c_...").
export type RegFieldType = 'text' | 'textarea' | 'number' | 'radio' | 'checkbox' | 'select' | 'date' | 'tel';
export type RegField = {
  key: string; label: string; type: RegFieldType; required: boolean; description?: string; placeholder?: string; options?: string[];
  enabled?: boolean; locked?: boolean; // chỉ có ở bản admin
};
export type RegForm = { intro: string; fields: RegField[] };

// Tên các loại câu hỏi giống Google Form (loại 'tel' chỉ dùng cho ô SĐT có sẵn)
export const FIELD_TYPE_LABELS: Record<Exclude<RegFieldType, 'tel'>, string> = {
  text: 'Trả lời ngắn', textarea: 'Đoạn', radio: 'Trắc nghiệm', checkbox: 'Hộp kiểm', select: 'Menu thả xuống', date: 'Ngày', number: 'Số',
};
export const CHOICE_TYPES: RegFieldType[] = ['radio', 'checkbox', 'select'];

// Câu có sẵn — dùng khi chưa tải được cấu hình từ máy chủ
export const DEFAULT_REG_FIELDS: RegField[] = [
  { key: 'student_name', label: 'Họ tên học sinh', type: 'text', required: true },
  { key: 'parent_phone', label: 'Số điện thoại phụ huynh', type: 'tel', required: true, placeholder: 'vd 0912 345 678' },
  { key: 'school', label: 'Trường đang học', type: 'text', required: true, placeholder: 'vd THCS Trưng Vương' },
  { key: 'class_name', label: 'Lớp', type: 'text', required: true, placeholder: 'vd 8A1' },
  { key: 'last_score', label: 'Điểm tổng kết môn Toán học kỳ gần nhất', type: 'number', required: true, placeholder: 'vd 8.5' },
  { key: 'note', label: 'Ghi chú', type: 'textarea', required: false },
];

// Máy chủ cũ trả mảng câu hỏi, bản mới trả { intro, fields }
export const toRegForm = (data: any): RegForm => (Array.isArray(data) ? { intro: '', fields: data } : { intro: data?.intro || '', fields: data?.fields || DEFAULT_REG_FIELDS });
