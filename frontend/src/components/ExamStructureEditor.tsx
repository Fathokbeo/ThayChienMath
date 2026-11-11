import { useEffect, useState } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Trash2, Plus, Settings2 } from 'lucide-react';
import api from '../lib/api';
import { toast } from './Toast';
import { gradeLabel } from '../lib/publicSite';
import type { ExamMeta, ExamMenuGroup } from './ExamMenuBar';

const splitList = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];

// Khung "Cấu trúc kho đề" ở trang Đề thi (admin): danh sách lớp, danh sách loại đề, và các mục của thanh menu
// (mỗi mục gồm 1 hay nhiều lớp; vd "Toán 10" = lớp 10, "Toán THCS" = lớp 6–9). Mặc định thu gọn.
export default function ExamStructureEditor({ meta, onSaved }: { meta: ExamMeta; onSaved: (m: ExamMeta) => void }) {
  const [open, setOpen] = useState(false);
  const [gradesText, setGradesText] = useState('');
  const [catsText, setCatsText] = useState('');
  const [menu, setMenu] = useState<ExamMenuGroup[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGradesText(meta.grades.join(', '));
    setCatsText(meta.categories.join(', '));
    setMenu(meta.menu.map((m) => ({ ...m, grades: [...m.grades] })));
  }, [meta]);

  const grades = splitList(gradesText);
  const inOther = (g: string, idx: number) => menu.some((m, j) => j !== idx && m.grades.includes(g));
  const patch = (i: number, p: Partial<ExamMenuGroup>) => setMenu((l) => l.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const move = (i: number, d: -1 | 1) => setMenu((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggleGrade = (i: number, g: string) => patch(i, { grades: menu[i].grades.includes(g) ? menu[i].grades.filter((x) => x !== g) : [...menu[i].grades, g] });

  const save = async () => {
    if (!grades.length) { toast.error('Cần ít nhất 1 lớp'); return; }
    setSaving(true);
    try {
      const { data } = await api.put('/admin/site/exam-meta', { grades, categories: splitList(catsText), menu: menu.filter((m) => m.grades.length) });
      toast.success('Đã lưu cấu trúc kho đề');
      onSaved(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Lỗi lưu');
    } finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '0.85rem 1.1rem', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <Settings2 size={17} color="#1F5C68" />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, color: '#1D1D1F' }}>Cấu trúc kho đề</span>
          <span style={{ display: 'block', fontSize: '0.8rem', color: '#86868B' }}>Danh sách lớp, loại đề và các mục trên thanh menu đề ở trang chủ</span>
        </span>
        <ChevronDown size={18} color="#86868B" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="form-field"><span>Các lớp (cách nhau bằng dấu phẩy, vd: 6, 7, 8, 9, 10, Thi vào 10, HSA)</span>
            <input className="input" value={gradesText} onChange={(e) => setGradesText(e.target.value)} /></label>
          <label className="form-field"><span>Các loại đề (cách nhau bằng dấu phẩy) — hiện trong danh sách thả xuống của mỗi lớp</span>
            <input className="input" value={catsText} onChange={(e) => setCatsText(e.target.value)} placeholder="Tài liệu, Đề cương, Đề giữa HK1, Đề HK1, Đề giữa HK2, Đề HK2, Đề khảo sát, Đề HSG" /></label>

          <div className="form-field">
            <span>Các mục trên thanh menu (mục có 1 lớp → thả xuống các loại đề; mục nhiều lớp → thả xuống các lớp)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {menu.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', border: '1px solid #E5E5EA', borderRadius: 12, padding: '8px 10px' }}>
                  <input className="input" value={m.label} maxLength={40} onChange={(e) => patch(i, { label: e.target.value })} style={{ flex: '0 1 200px', minHeight: 38 }} placeholder="Tên mục, vd Toán 10" />
                  <div style={{ flex: '1 1 260px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 38 }}>
                    {grades.map((g) => {
                      const on = m.grades.includes(g);
                      const taken = !on && inOther(g, i);
                      return (
                        <button key={g} type="button" disabled={taken} onClick={() => toggleGrade(i, g)} title={taken ? 'Lớp này đã nằm trong mục khác' : ''}
                          className={`ph-chip ${on ? 'active' : ''}`} style={{ padding: '4px 10px', fontSize: '0.8rem', opacity: taken ? 0.35 : 1 }}>{gradeLabel(g)}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={i === 0} onClick={() => move(i, -1)} title="Lên"><ArrowUp size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" disabled={i === menu.length - 1} onClick={() => move(i, 1)} title="Xuống"><ArrowDown size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setMenu((l) => l.filter((_, j) => j !== i))} title="Xóa mục"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setMenu((l) => [...l, { label: '', grades: [] }])}><Plus size={14} /> Thêm mục</button>
              <div style={{ fontSize: '0.78rem', color: '#86868B' }}>Lớp nào chưa nằm trong mục nào sẽ tự thành một mục riêng ở cuối thanh menu.</div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu trúc'}</button>
        </div>
      )}
    </div>
  );
}
