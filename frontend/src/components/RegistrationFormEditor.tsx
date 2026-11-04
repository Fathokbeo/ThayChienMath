import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Copy, Eye, EyeOff, GripHorizontal, X, Circle, Square, Lock } from 'lucide-react';
import api from '../lib/api';
import { toast } from './Toast';
import Modal from './Modal';
import RegFieldInput, { RegFieldLabel, type RegValue } from './RegFieldInput';
import { CHOICE_TYPES, FIELD_TYPE_LABELS, toRegForm, type RegField, type RegForm, type RegFieldType } from '../lib/registrationForm';

const newKey = () => 'c_' + Math.random().toString(36).slice(2, 10);

// Gợi ý hiện trong ô trả lời mẫu (khi câu hỏi không được chọn để sửa) — giống Google Form
const ANSWER_HINT: Partial<Record<RegFieldType, string>> = {
  text: 'Văn bản câu trả lời ngắn', textarea: 'Văn bản câu trả lời dài', number: 'Số', date: 'Ngày / tháng / năm', tel: 'Số điện thoại',
};

function Switch({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={`gf-switch ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} disabled={disabled} className={on ? 'on' : ''} onClick={() => onChange(!on)}><i /></button>
    </label>
  );
}

// Biểu mẫu "Đăng ký học" soạn như Google Form: mỗi câu hỏi là 1 thẻ — bấm vào thẻ để sửa (tên câu, mô tả, loại câu,
// từng lựa chọn, bắt buộc), kéo tay nắm ở trên thẻ để đổi thứ tự. Họ tên học sinh + SĐT phụ huynh luôn có và bắt buộc.
export default function RegistrationFormEditor() {
  const [form, setForm] = useState<RegForm | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, RegValue>>({});
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // chỉ kéo được khi bấm giữ tay nắm (không cản bôi chữ trong ô)
  const optionRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusNext = useRef<string | null>(null);

  useEffect(() => { api.get('/admin/site/registration-form').then((r) => setForm(toRegForm(r.data))).catch(() => setForm({ intro: '', fields: [] })); }, []);
  // Rời trang khi chưa lưu → trình duyệt hỏi lại
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  // Sau khi thêm lựa chọn mới bằng Enter / "Thêm lựa chọn" → đặt con trỏ vào ô vừa thêm
  useEffect(() => {
    if (focusNext.current) { optionRefs.current[focusNext.current]?.focus(); focusNext.current = null; }
  });

  const update = (fn: (f: RegForm) => RegForm) => { setForm((cur) => (cur ? fn(cur) : cur)); setDirty(true); };
  const patch = (key: string, p: Partial<RegField>) => update((f) => ({ ...f, fields: f.fields.map((x) => (x.key === key ? { ...x, ...p } : x)) }));

  const insertAfter = (afterKey: string | null, field: RegField) => {
    update((f) => {
      const i = afterKey ? f.fields.findIndex((x) => x.key === afterKey) : -1;
      const next = [...f.fields];
      next.splice(i >= 0 ? i + 1 : next.length, 0, field);
      return { ...f, fields: next };
    });
    setActive(field.key);
  };
  const addQuestion = () => insertAfter(active, { key: newKey(), label: '', type: 'radio', required: false, enabled: true, description: '', placeholder: '', options: ['Lựa chọn 1'] });
  const duplicate = (q: RegField) => insertAfter(q.key, { ...q, key: newKey(), locked: false, label: `${q.label} (bản sao)`, options: [...(q.options || [])] });
  const removeQ = (q: RegField) => { update((f) => ({ ...f, fields: f.fields.filter((x) => x.key !== q.key) })); setActive(null); };

  const setOption = (q: RegField, i: number, v: string) => patch(q.key, { options: (q.options || []).map((o, j) => (j === i ? v : o)) });
  const addOption = (q: RegField, at?: number) => {
    const opts = [...(q.options || [])];
    const idx = at === undefined ? opts.length : at + 1;
    opts.splice(idx, 0, `Lựa chọn ${opts.length + 1}`);
    patch(q.key, { options: opts });
    focusNext.current = `${q.key}:${idx}`;
  };
  const removeOption = (q: RegField, i: number) => patch(q.key, { options: (q.options || []).filter((_, j) => j !== i) });
  const changeType = (q: RegField, type: RegFieldType) =>
    patch(q.key, { type, options: CHOICE_TYPES.includes(type) ? (q.options?.length ? q.options : ['Lựa chọn 1']) : q.options });

  const drop = (targetKey: string) => {
    if (!dragKey || dragKey === targetKey) return;
    update((f) => {
      const next = f.fields.filter((x) => x.key !== dragKey);
      const moving = f.fields.find((x) => x.key === dragKey)!;
      const to = next.findIndex((x) => x.key === targetKey);
      const from = f.fields.findIndex((x) => x.key === dragKey);
      next.splice(from < f.fields.findIndex((x) => x.key === targetKey) ? to + 1 : to, 0, moving);
      return { ...f, fields: next };
    });
  };

  const save = async () => {
    if (!form) return;
    const noName = form.fields.find((f) => !f.label.trim());
    if (noName) { setActive(noName.key); toast.error('Câu hỏi chưa có tiêu đề'); return; }
    const noOpt = form.fields.find((f) => CHOICE_TYPES.includes(f.type) && !(f.options || []).some((o) => o.trim()));
    if (noOpt) { setActive(noOpt.key); toast.error(`Câu "${noOpt.label}" cần ít nhất 1 lựa chọn`); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/admin/site/registration-form', form);
      setForm(toRegForm(data)); setDirty(false);
      toast.success('Đã lưu biểu mẫu đăng ký');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi lưu biểu mẫu');
    } finally { setSaving(false); }
  };

  if (form === null) return <div style={{ color: '#86868B' }}>Đang tải...</div>;

  return (
    <div className="gf-wrap">
      {/* Thẻ đầu biểu mẫu: tên + lời giới thiệu hiện ở đầu form đăng ký */}
      <div className="gf-card gf-head">
        <div className="gf-title">Biểu mẫu đăng ký học</div>
        <textarea className="gf-line" rows={2} value={form.intro} maxLength={1000}
          onChange={(e) => update((f) => ({ ...f, intro: e.target.value }))}
          placeholder="Mô tả biểu mẫu (hiện ở đầu form đăng ký — vd: Phụ huynh vui lòng điền đầy đủ để trung tâm xếp lớp phù hợp)" />
        <div style={{ fontSize: '0.78rem', color: '#86868B', marginTop: 8 }}>
          Phần chọn <b>ca thi thử đầu vào</b> tự hiện sau các câu hỏi, theo các ca ở tab Ca thi thử.
        </div>
      </div>

      {form.fields.map((q) => {
        const isActive = active === q.key;
        const custom = q.key.startsWith('c_');
        const hidden = q.enabled === false;
        return (
          <div key={q.key}
            className={`gf-card gf-q ${isActive ? 'is-active' : ''} ${hidden ? 'is-hidden' : ''} ${dragKey === q.key ? 'is-dragging' : ''}`}
            draggable={armed === q.key}
            onDragStart={() => setDragKey(q.key)}
            onDragEnd={() => { setDragKey(null); setArmed(null); }}
            onDragOver={(e) => { if (dragKey) e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); drop(q.key); }}
            onClick={() => setActive(q.key)}>
            <div className="gf-handle" title="Kéo để đổi thứ tự" onMouseDown={() => setArmed(q.key)} onMouseUp={() => setArmed(null)} onTouchStart={() => setArmed(q.key)}>
              <GripHorizontal size={18} />
            </div>

            {isActive ? (
              <>
                <div className="gf-row">
                  <input className="gf-line gf-qtitle" value={q.label} maxLength={120} autoFocus={!q.label}
                    onChange={(e) => patch(q.key, { label: e.target.value })} placeholder="Câu hỏi" />
                  {custom ? (
                    <select className="input gf-type" value={q.type} onChange={(e) => changeType(q, e.target.value as RegFieldType)}>
                      {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  ) : (
                    <span className="gf-fixed-type"><Lock size={12} /> {q.type === 'tel' ? 'Số điện thoại' : FIELD_TYPE_LABELS[q.type as Exclude<RegFieldType, 'tel'>]}</span>
                  )}
                </div>
                <input className="gf-line gf-desc" value={q.description || ''} maxLength={300}
                  onChange={(e) => patch(q.key, { description: e.target.value })} placeholder="Mô tả (không bắt buộc)" />

                {CHOICE_TYPES.includes(q.type) ? (
                  <div className="gf-options">
                    {(q.options || []).map((o, i) => (
                      <div key={i} className="gf-option">
                        {q.type === 'radio' ? <Circle size={18} /> : q.type === 'checkbox' ? <Square size={18} /> : <span className="gf-num">{i + 1}.</span>}
                        <input className="gf-line" value={o} maxLength={80}
                          ref={(el) => { optionRefs.current[`${q.key}:${i}`] = el; }}
                          onChange={(e) => setOption(q, i, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(q, i); } }} />
                        {(q.options || []).length > 1 && (
                          <button type="button" className="gf-icon" title="Xóa lựa chọn" onClick={() => removeOption(q, i)}><X size={18} /></button>
                        )}
                      </div>
                    ))}
                    <div className="gf-option gf-add-option" onClick={() => addOption(q)}>
                      {q.type === 'radio' ? <Circle size={18} /> : q.type === 'checkbox' ? <Square size={18} /> : <span className="gf-num">{(q.options || []).length + 1}.</span>}
                      <span>Thêm lựa chọn</span>
                    </div>
                  </div>
                ) : (
                  <div className="gf-answer">
                    <input className="gf-line" value={q.placeholder || ''} maxLength={120} disabled={q.type === 'date'}
                      onChange={(e) => patch(q.key, { placeholder: e.target.value })}
                      placeholder={q.type === 'date' ? ANSWER_HINT.date : `${ANSWER_HINT[q.type]} — gõ để đặt chữ gợi ý trong ô`} />
                  </div>
                )}

                <div className="gf-footer">
                  {q.locked ? (
                    <span style={{ fontSize: '0.8rem', color: '#86868B', marginRight: 'auto' }}>Câu có sẵn, luôn hiện và bắt buộc (trung tâm cần để gọi lại)</span>
                  ) : <span style={{ marginRight: 'auto' }} />}
                  {custom && <button type="button" className="gf-icon" title="Nhân bản" onClick={(e) => { e.stopPropagation(); duplicate(q); }}><Copy size={18} /></button>}
                  {!q.locked && (
                    <button type="button" className="gf-icon" title={hidden ? 'Đang ẩn — bấm để hiện trong form' : 'Ẩn câu này khỏi form'}
                      onClick={() => patch(q.key, { enabled: hidden })}>{hidden ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                  )}
                  {custom && <button type="button" className="gf-icon" title="Xóa câu hỏi" onClick={(e) => { e.stopPropagation(); removeQ(q); }}><Trash2 size={18} /></button>}
                  <span className="gf-divider" />
                  <Switch label="Bắt buộc" on={q.required} disabled={q.locked || hidden} onChange={(v) => patch(q.key, { required: v })} />
                </div>
              </>
            ) : (
              <div className="gf-preview">
                <div style={{ fontWeight: 600, fontSize: '0.98rem' }}>
                  <RegFieldLabel f={q} />
                </div>
                {hidden && <span className="badge badge-gray" style={{ alignSelf: 'flex-start' }}>Đang ẩn khỏi form</span>}
                {CHOICE_TYPES.includes(q.type) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#515154', fontSize: '0.9rem' }}>
                    {(q.options || []).map((o, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {q.type === 'radio' ? <Circle size={16} color="#AEAEB2" /> : q.type === 'checkbox' ? <Square size={16} color="#AEAEB2" /> : <span className="gf-num">{i + 1}.</span>} {o}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="gf-sample">{q.placeholder || ANSWER_HINT[q.type]}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="gf-add" onClick={addQuestion}><Plus size={18} /> Thêm câu hỏi</button>

      {/* Thanh lưu luôn ở dưới màn hình */}
      <div className="gf-savebar">
        <span style={{ fontSize: '0.86rem', color: dirty ? '#B8673E' : '#86868B' }}>{dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</span>
        <button type="button" className="btn btn-ghost" onClick={() => { setPreviewValues({}); setPreview(true); }}><Eye size={15} /> Xem trước</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}</button>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} title="Xem trước: Đăng ký học">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {form.intro && <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#515154', lineHeight: 1.55 }}>{form.intro}</div>}
          {form.fields.filter((f) => f.enabled !== false).map((f) => (
            <div key={f.key} className="form-field">
              <RegFieldLabel f={f} />
              <RegFieldInput f={f} value={previewValues[f.key]} onChange={(v) => setPreviewValues((p) => ({ ...p, [f.key]: v }))} />
            </div>
          ))}
          <div style={{ fontSize: '0.8rem', color: '#86868B' }}>(Bản xem trước — không gửi đi được)</div>
        </div>
      </Modal>
    </div>
  );
}
