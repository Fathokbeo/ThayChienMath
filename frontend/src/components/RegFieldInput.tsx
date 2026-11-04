import type { RegField } from '../lib/registrationForm';

export type RegValue = string | string[];

// Ô trả lời của 1 câu hỏi trong biểu mẫu đăng ký (dùng ở form khách điền và ở "Xem trước" của admin)
export default function RegFieldInput({ f, value, onChange, disabled }: { f: RegField; value: RegValue | undefined; onChange: (v: RegValue) => void; disabled?: boolean }) {
  const text = typeof value === 'string' ? value : '';
  if (f.type === 'radio' || f.type === 'checkbox') {
    const picked = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(f.options || []).map((o) => {
          const on = picked.includes(o);
          return (
            <label key={o} className="reg-choice">
              <input type={f.type} name={f.key} value={o} checked={on} disabled={disabled}
                required={f.type === 'radio' && f.required}
                onChange={() => onChange(f.type === 'radio' ? o : on ? picked.filter((x) => x !== o) : [...picked, o])} />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
    );
  }
  const common = {
    className: 'input', value: text, required: f.required, disabled, placeholder: f.placeholder || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };
  if (f.type === 'textarea') return <textarea {...common} rows={3} maxLength={1000} />;
  if (f.type === 'select') {
    return (
      <select {...common}>
        <option value="">— Chọn —</option>
        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (f.type === 'date') return <input {...common} type="date" />;
  if (f.type === 'number') return <input {...common} inputMode="decimal" maxLength={20} />;
  if (f.type === 'tel') return <input {...common} inputMode="tel" autoComplete="tel" maxLength={20} />;
  return <input {...common} maxLength={f.key === 'class_name' ? 20 : 200} autoComplete={f.key === 'student_name' ? 'name' : undefined} />;
}

// Tiêu đề câu hỏi (+ dấu * nếu bắt buộc) và mô tả nhỏ bên dưới
export function RegFieldLabel({ f }: { f: RegField }) {
  return (
    <span style={{ display: 'block' }}>
      {f.label}{f.required && <span style={{ color: '#B04A2A' }}> *</span>}
      {f.description && <span style={{ display: 'block', fontWeight: 400, fontSize: '0.8rem', color: '#86868B', marginTop: 2 }}>{f.description}</span>}
    </span>
  );
}
