// Biểu mẫu "Đăng ký học" ở trang công khai — admin soạn như Google Form (các câu hỏi khách phải trả lời).
// Lưu ở site_settings.registration_form (JSON {intro, fields}; bản cũ chỉ là mảng fields). Gồm:
//  - Ô có sẵn (cột riêng trong bảng course_registrations): họ tên học sinh, SĐT phụ huynh (luôn bắt buộc, không tắt
//    được — trung tâm cần để gọi lại), trường, lớp, điểm Toán kỳ trước, ghi chú (đổi tên / bật tắt / bắt buộc được).
//  - Ô admin tự thêm (key "c_..."): lưu vào cột extra dạng [{label, value}] — giữ cả tên ô lúc gửi, nên đổi tên
//    hay xóa ô sau này thì đơn cũ vẫn đọc được.
// Ca thi thử đầu vào vẫn chọn riêng theo các ca admin mở (không nằm trong danh sách ô này).

// radio = trắc nghiệm (chọn 1), checkbox = hộp kiểm (chọn nhiều), select = menu thả xuống (chọn 1)
const FIELD_TYPES = ['text', 'textarea', 'number', 'radio', 'checkbox', 'select', 'date', 'tel'];
const CHOICE_TYPES = ['radio', 'checkbox', 'select'];

const BUILTIN = [
  { key: 'student_name', label: 'Họ tên học sinh', type: 'text', required: true, enabled: true, locked: true },
  { key: 'parent_phone', label: 'Số điện thoại phụ huynh', type: 'tel', required: true, enabled: true, locked: true, placeholder: 'vd 0912 345 678' },
  { key: 'school', label: 'Trường đang học', type: 'text', required: true, enabled: true, placeholder: 'vd THCS Trưng Vương' },
  { key: 'class_name', label: 'Lớp', type: 'text', required: true, enabled: true, placeholder: 'vd 8A1' },
  { key: 'last_score', label: 'Điểm tổng kết môn Toán học kỳ gần nhất', type: 'number', required: true, enabled: true, placeholder: 'vd 8.5' },
  { key: 'note', label: 'Ghi chú', type: 'textarea', required: false, enabled: true },
];
const BUILTIN_KEYS = new Set(BUILTIN.map((f) => f.key));

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Làm sạch cấu hình admin gửi lên / đọc từ database. Luôn trả về đủ các ô có sẵn (ô thiếu thì thêm lại ở cuối).
function normalizeFields(raw) {
  const out = []; const seen = new Set();
  for (const f of Array.isArray(raw) ? raw : []) {
    const key = String(f?.key || '');
    if (seen.has(key)) continue;
    const base = BUILTIN.find((b) => b.key === key);
    if (base) {
      seen.add(key);
      out.push({
        ...base,
        label: str(f.label, 120) || base.label,
        description: str(f.description, 300),
        placeholder: str(f.placeholder, 120),
        required: base.locked ? true : !!f.required,
        enabled: base.locked ? true : f.enabled !== false,
      });
    } else if (/^c_[a-z0-9]{1,24}$/.test(key) && str(f.label, 120)) {
      seen.add(key);
      const type = FIELD_TYPES.includes(f.type) && f.type !== 'tel' ? f.type : 'text';
      const options = CHOICE_TYPES.includes(type)
        ? [...new Set((Array.isArray(f.options) ? f.options : []).map((o) => str(o, 80)).filter(Boolean))].slice(0, 30) : [];
      if (CHOICE_TYPES.includes(type) && !options.length) continue; // câu chọn mà không có lựa chọn nào → bỏ
      out.push({ key, label: str(f.label, 120), type, required: !!f.required, enabled: f.enabled !== false,
        description: str(f.description, 300), placeholder: str(f.placeholder, 120), options });
    }
    if (out.length >= 30) break;
  }
  for (const b of BUILTIN) if (!seen.has(b.key)) out.push({ ...b, description: '', placeholder: b.placeholder || '' });
  return out;
}

const normalizeForm = (raw) => ({
  intro: String((Array.isArray(raw) ? '' : raw?.intro) ?? '').trim().slice(0, 1000),
  fields: normalizeFields(Array.isArray(raw) ? raw : raw?.fields),
});

// { intro: lời giới thiệu đầu biểu mẫu, fields: các câu hỏi }
function getForm(db) {
  const row = db.prepare("SELECT value FROM site_settings WHERE key='registration_form'").get();
  if (!row) return normalizeForm(BUILTIN);
  try { return normalizeForm(JSON.parse(row.value)); } catch { return normalizeForm(BUILTIN); }
}
const getFormFields = (db) => getForm(db).fields;

function saveForm(db, raw) {
  const form = normalizeForm(raw);
  db.prepare("INSERT INTO site_settings (key,value) VALUES ('registration_form',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(JSON.stringify(form));
  return form;
}

// Kiểm tra đơn khách gửi theo biểu mẫu hiện tại. Trả về { error } hoặc { values } (đủ cột để INSERT).
function validateSubmission(fields, body) {
  const values = { student_name: '', parent_phone: '', school: '', class_name: '', last_score: null, note: null, extra: [] };
  for (const f of fields) {
    if (!f.enabled) continue;
    const raw = body?.[f.key];
    if (f.type === 'checkbox') {
      const picked = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((o) => str(o, 80));
      if (picked.some((o) => !f.options.includes(o))) return { error: `Lựa chọn ở "${f.label}" không hợp lệ` };
      const chosen = f.options.filter((o) => picked.includes(o)); // giữ đúng thứ tự admin đặt
      if (!chosen.length) {
        if (f.required) return { error: `Vui lòng chọn ${f.label.toLowerCase()}` };
        continue;
      }
      values.extra.push({ label: f.label, value: chosen.join(', ') });
      continue;
    }
    const text = f.type === 'textarea' ? String(raw ?? '').trim().slice(0, 1000) : str(raw, 200);
    if (!text) {
      if (f.required) return { error: `Vui lòng điền ${f.label.toLowerCase()}` };
      continue;
    }
    if (f.key === 'parent_phone') {
      const phone = text.replace(/[\s.()-]/g, '');
      if (!/^(0|\+84)\d{9,10}$/.test(phone)) return { error: 'Số điện thoại phụ huynh không hợp lệ' };
      values.parent_phone = phone;
      continue;
    }
    if (f.key === 'last_score') {
      const score = Number(text.replace(',', '.'));
      if (!Number.isFinite(score) || score < 0 || score > 10) return { error: `${f.label} phải là số từ 0 đến 10` };
      values.last_score = score;
      continue;
    }
    if (f.type === 'number' && !Number.isFinite(Number(text.replace(',', '.')))) return { error: `${f.label} phải là số` };
    if ((f.type === 'select' || f.type === 'radio') && !f.options.includes(text)) return { error: `Vui lòng chọn ${f.label.toLowerCase()}` };
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `${f.label} không hợp lệ` };
    if (BUILTIN_KEYS.has(f.key)) {
      const max = { student_name: 80, school: 120, class_name: 20, note: 500 }[f.key];
      values[f.key] = text.slice(0, max);
    } else {
      values.extra.push({ label: f.label, value: text });
    }
  }
  return { values };
}

module.exports = { BUILTIN, FIELD_TYPES, getForm, getFormFields, saveForm, validateSubmission };
