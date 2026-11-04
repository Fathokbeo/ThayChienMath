import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import api from '../lib/api';
import { toast } from './Toast';
import { FIELD_TYPE_LABELS, type RegField, type RegFieldType } from '../lib/registrationForm';

const newKey = () => 'c_' + Math.random().toString(36).slice(2, 10);

// Admin chỉnh các ô khách phải điền khi bấm "Đăng ký" ở trang chủ: đổi tên ô, bật/tắt, bắt buộc hay không,
// đổi thứ tự, thêm ô mới (chữ, số, ngày, chọn trong danh sách...). Họ tên học sinh + SĐT phụ huynh luôn có.
export default function RegistrationFormEditor() {
  const [fields, setFields] = useState<RegField[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/admin/site/registration-form').then((r) => setFields(r.data)).catch(() => setFields([])); }, []);

  const patch = (i: number, p: Partial<RegField>) => setFields((list) => list!.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) => setFields((list) => {
    const next = [...list!]; const j = i + d;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (i: number) => setFields((list) => list!.filter((_, j) => j !== i));
  const add = () => setFields((list) => [...list!, { key: newKey(), label: '', type: 'text', required: false, enabled: true, placeholder: '', options: [] }]);

  const save = async () => {
    const bad = fields!.find((f) => !f.label.trim());
    if (bad) { toast.error('Ô nào cũng cần có tên'); return; }
    const emptySelect = fields!.find((f) => f.type === 'select' && !(f.options || []).some((o) => o.trim()));
    if (emptySelect) { toast.error(`Ô "${emptySelect.label}" cần ít nhất 1 lựa chọn`); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/admin/site/registration-form', { fields });
      setFields(data);
      toast.success('Đã lưu biểu mẫu đăng ký');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi lưu biểu mẫu');
    } finally { setSaving(false); }
  };

  if (fields === null) return <div style={{ color: '#86868B' }}>Đang tải...</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ margin: '0 0 14px', color: '#6E6E73', fontSize: '0.88rem', lineHeight: 1.55 }}>
        Các ô khách điền khi bấm <b>Đăng ký</b> ở trang chủ. <b>Họ tên học sinh</b> và <b>SĐT phụ huynh</b> luôn có và bắt buộc
        (để trung tâm gọi lại). Phần chọn ca thi thử đầu vào hiện theo các ca ở tab <b>Ca thi thử</b>.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fields.map((f, i) => {
          const custom = f.key.startsWith('c_');
          return (
            <div key={f.key} className="card" style={{ padding: '0.85rem 1rem', opacity: f.enabled === false ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Lên trên" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" title="Xuống dưới" disabled={i === fields.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                </div>
                <div style={{ flex: '1 1 420px', minWidth: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 8 }}>
                  <label className="form-field"><span>Tên ô{f.locked ? ' (luôn có, bắt buộc)' : ''}</span>
                    <input className="input" value={f.label} maxLength={120} onChange={(e) => patch(i, { label: e.target.value })} placeholder="vd Năm sinh của học sinh" /></label>
                  <label className="form-field"><span>Loại ô</span>
                    {custom ? (
                      <select className="input" value={f.type} onChange={(e) => patch(i, { type: e.target.value as RegFieldType })}>
                        {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <input className="input" disabled value={f.type === 'tel' ? 'Số điện thoại' : FIELD_TYPE_LABELS[f.type as Exclude<RegFieldType, 'tel'>]} />
                    )}</label>
                  {f.type === 'select' ? (
                    <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Các lựa chọn (mỗi dòng 1 lựa chọn)</span>
                      <textarea className="input" rows={3} value={(f.options || []).join('\n')} onChange={(e) => patch(i, { options: e.target.value.split('\n') })} placeholder={'vd\nCa sáng\nCa chiều\nCa tối'} /></label>
                  ) : f.type !== 'date' && (
                    <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Gợi ý trong ô (không bắt buộc)</span>
                      <input className="input" value={f.placeholder || ''} maxLength={120} onChange={(e) => patch(i, { placeholder: e.target.value })} /></label>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.86rem', paddingTop: 22, minWidth: 120 }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: f.locked ? 'not-allowed' : 'pointer' }}>
                    <input type="checkbox" checked={f.enabled !== false} disabled={f.locked} onChange={(e) => patch(i, { enabled: e.target.checked })} /> Hiện ô này
                  </label>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: f.locked ? 'not-allowed' : 'pointer' }}>
                    <input type="checkbox" checked={f.required} disabled={f.locked || f.enabled === false} onChange={(e) => patch(i, { required: e.target.checked })} /> Bắt buộc
                  </label>
                  {custom && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#B04A2A', justifyContent: 'flex-start', padding: '4px 0' }} onClick={() => remove(i)}>
                      <Trash2 size={14} /> Xóa ô
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={add}><Plus size={15} /> Thêm ô</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}</button>
      </div>
    </div>
  );
}
