import { useEffect, useState } from 'react';
import { Bot, Pencil, KeyRound, Trash2, ChevronDown } from 'lucide-react';
import api from '../lib/api';
import { toast } from './Toast';

type Row = { calls: number; cost: number };
type Report = {
  month: string; cost: number; budget: number; graded_submissions: number;
  byModel: (Row & { model: string; batch_calls?: number })[];
  byLabel: (Row & { label: string })[];
  byDay: (Row & { day: string })[];
  history: (Row & { month: string })[];
  claude_configured: boolean; claude_active: boolean; batch_mode: boolean;
  key: { source: 'admin' | 'env' | null; valid: boolean; hint: string | null };
  models: Record<string, string>;
  model_options: { id: string; label: string; note: string; price?: [number, number] }[];
  model_groups: { id: string; label: string; hint: string; default: string }[];
};

const usd = (n: number) => `$${(n || 0).toFixed(2)}`;
const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5',
};
const TASK_LABEL: Record<string, string> = {
  grade: 'Chấm chính', check: 'Chấm đối chiếu', attempted: 'Kiểm tra ý bỏ trống', review: 'Phân xử khi lệch',
  rubric: 'Lập khung barem', extract: 'Đọc đáp án', overview: 'Tóm tắt đề', tagging: 'Gắn nhãn khóa học',
  grading: 'Chấm bài', 'rubric-items': 'Lập khung barem', 'course-tags': 'Gắn nhãn khóa học',
};
const monthLabel = (m: string) => m.split('-').reverse().join('/');
const section: React.CSSProperties = { marginTop: 12, paddingTop: 12, borderTop: '1px solid #EDEDF0' };
const h4: React.CSSProperties = { margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 700 };
const muted: React.CSSProperties = { fontSize: '0.8rem', color: '#6E6E73' };

// Trang Tổng quan admin — mọi cài đặt AI chấm bài ở một chỗ:
//  khóa API Claude (dán vào là chạy, không cần sửa file trên máy chủ) · trần ngân sách tháng · model cho từng việc ·
//  mức sử dụng (theo model / việc / ngày / tháng) · chế độ lô (Batch API, rẻ 50%).
export default function AiUsageCard() {
  const [r, setR] = useState<Report | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budget, setBudget] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [open, setOpen] = useState(false);
  const load = () => api.get('/admin/ai-usage').then((res) => setR(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => { if (r && !r.key.valid) setOpen(true); }, [r?.key.valid]); // chưa có khóa → mở sẵn phần cài đặt
  if (!r) return null;

  const pct = r.budget > 0 ? Math.min(100, (r.cost / r.budget) * 100) : 100;
  const perSub = r.graded_submissions ? r.cost / r.graded_submissions : null;
  const name = (id: string) => MODEL_LABEL[id] || id;
  const status = !r.claude_configured
    ? { text: 'Chưa có khóa API Claude — AI chưa chấm bài, bài nộp đang chờ', color: '#B04A2A' }
    : r.claude_active
      ? { text: `Đang chấm bằng Claude: ${name(r.models.grade)} chấm, ${name(r.models.check)} đối chiếu, ${name(r.models.review)} phân xử`, color: '#3A7D5C' }
      : { text: 'Đã chạm trần ngân sách tháng — AI tạm dừng, bài nộp chờ tới khi tăng trần hoặc sang tháng mới', color: '#B04A2A' };
  const err = (e: any) => toast.error(e.response?.data?.message || 'Lỗi');

  const saveBudget = async () => {
    try { await api.put('/admin/ai-usage/budget', { budget }); toast.success('Đã lưu trần ngân sách'); setEditingBudget(false); load(); } catch (e) { err(e); }
  };
  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    try {
      await api.put('/admin/ai-usage/key', { key: keyInput.trim() });
      toast.success('Khóa hợp lệ — đã bật AI chấm bài');
      setKeyInput(''); setEditingKey(false); load();
    } catch (e) { err(e); } finally { setSavingKey(false); }
  };
  const removeKey = async () => {
    if (!window.confirm('Xóa khóa API Claude đã cài trên web? AI sẽ dừng chấm (trừ khi máy chủ có khóa trong file .env).')) return;
    try { await api.delete('/admin/ai-usage/key'); toast.success('Đã xóa khóa'); load(); } catch (e) { err(e); }
  };
  const setModel = async (group: string, model: string) => {
    try { await api.put('/admin/ai-usage/models', { [group]: model }); toast.success('Đã đổi model'); load(); } catch (e) { err(e); }
  };
  const toggleBatch = async () => {
    try {
      await api.put('/admin/ai-usage/batch', { enabled: !r.batch_mode });
      toast.success(!r.batch_mode ? 'Đã bật chấm theo lô (rẻ 50%)' : 'Đã tắt chấm theo lô — chấm ngay, giá gốc');
      load();
    } catch (e) { err(e); }
  };
  const maxDay = Math.max(0.0001, ...r.byDay.map((d) => d.cost));

  return (
    <div className="card" style={{ padding: '1rem 1.15rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: '#F0ECF7', color: '#6E5A94', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={19} /></span>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>Chi phí AI chấm bài tháng {monthLabel(r.month)}</div>
          <div style={{ fontSize: '0.82rem', color: status.color }}>{status.text}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{usd(r.cost)} <span style={{ fontSize: '0.9rem', color: '#86868B', fontWeight: 500 }}>/ {usd(r.budget)}</span></div>
          {!editingBudget ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBudget(String(r.budget)); setEditingBudget(true); }}><Pencil size={13} /> Đổi trần</button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              $<input className="input" type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: 90, minHeight: 34 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={saveBudget}>Lưu</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingBudget(false)}>Hủy</button>
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#EDEDF0', margin: '12px 0 8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? '#B04A2A' : pct >= 70 ? '#D0864F' : '#3A7D5C' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', ...muted }}>
        <span>{r.graded_submissions} bài AI chấm{perSub != null ? ` · ~${usd(perSub)}/bài` : ''}</span>
        <span>Chạm trần thì AI tự dừng, không tiêu quá số tiền này.</span>
      </div>

      {/* ── Khóa API ── */}
      <div style={section}>
        <h4 style={{ ...h4, display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={15} /> Khóa API Claude</h4>
        {r.key.valid && !editingKey ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.88rem' }}>
            <code style={{ background: '#F5F5F7', padding: '3px 8px', borderRadius: 6 }}>{r.key.hint}</code>
            <span style={muted}>{r.key.source === 'admin' ? 'cài trên web' : 'trong file .env của máy chủ'}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingKey(true)}><Pencil size={13} /> Đổi khóa</button>
            {r.key.source === 'admin' && <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#B04A2A' }} onClick={removeKey}><Trash2 size={13} /> Xóa</button>}
          </div>
        ) : (
          <>
            {r.key.hint && !r.key.valid && <div style={{ ...muted, color: '#B04A2A', marginBottom: 6 }}>Khóa hiện tại ({r.key.hint}) không phải khóa API nên không dùng được.</div>}
            <form onSubmit={(e) => { e.preventDefault(); saveKey(); }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-api03-…"
                value={keyInput} onChange={(e) => setKeyInput(e.target.value)} style={{ flex: '1 1 260px', minWidth: 0, fontFamily: 'monospace' }} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingKey || !keyInput.trim()}>{savingKey ? 'Đang kiểm tra…' : 'Lưu & kiểm tra'}</button>
              {editingKey && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditingKey(false); setKeyInput(''); }}>Hủy</button>}
            </form>
            <div style={{ ...muted, marginTop: 6, lineHeight: 1.5 }}>
              Tạo khóa ở <b>console.anthropic.com</b> → Settings → <b>API Keys</b> → Create Key (khóa bắt đầu bằng <code>sk-ant-api03-</code>),
              nạp tiền ở mục <b>Billing</b>. Mã đăng nhập claude.ai (<code>sk-ant-usr-…</code>) không dùng được.
              Khóa được kiểm tra với Anthropic trước khi lưu và không bao giờ hiện lại đầy đủ.
            </div>
          </>
        )}
      </div>

      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10, paddingLeft: 0 }} onClick={() => setOpen(!open)}>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        {open ? 'Ẩn' : 'Xem'} model, mức sử dụng & chế độ lô
      </button>

      {open && (
        <>
          {/* ── Model cho từng việc ── */}
          <div style={section}>
            <h4 style={{ ...h4, marginBottom: 2 }}>Model cho từng việc</h4>
            <div style={{ ...muted, marginBottom: 8 }}>Giá ghi theo USD cho mỗi 1 triệu token vào / ra (chấm theo lô được giảm 50%). Đổi model có hiệu lực ngay với bài chấm tiếp theo.</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {r.model_groups.map((g) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{g.label}</div>
                    <div style={muted}>{g.hint}</div>
                  </div>
                  <select className="input" value={r.models[g.id]} onChange={(e) => setModel(g.id, e.target.value)} style={{ flex: '0 1 390px', minWidth: 0, minHeight: 36 }}>
                    {r.model_options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label} · {o.note}{o.price ? ` · $${o.price[0]}/$${o.price[1]}` : ''}{o.id === g.default ? ' (mặc định)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* ── Mức sử dụng ── */}
          <div style={section}>
            <h4 style={h4}>Mức sử dụng tháng {monthLabel(r.month)}</h4>
            {!r.byModel.length ? <div style={muted}>Chưa có lượt gọi AI nào trong tháng.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
                <UsageList title="Theo model" rows={r.byModel.map((m) => ({ key: m.model, name: name(m.model), extra: m.batch_calls ? `${m.batch_calls} theo lô` : '', ...m }))} />
                <UsageList title="Theo việc" rows={r.byLabel.map((l) => ({ key: l.label, name: TASK_LABEL[l.label] || l.label, extra: '', ...l }))} />
              </div>
            )}
            {!!r.byDay.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...muted, marginBottom: 4 }}>Theo ngày</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
                  {r.byDay.map((d) => (
                    <div key={d.day} title={`${d.day.split('-').reverse().join('/')}: ${usd(d.cost)} · ${d.calls} lượt`}
                      style={{ flex: '1 1 0', maxWidth: 22, height: `${Math.max(4, (d.cost / maxDay) * 100)}%`, background: '#6E5A94', borderRadius: 3, opacity: 0.85 }} />
                  ))}
                </div>
              </div>
            )}
            {r.history.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 10, ...muted }}>
                <span>Các tháng trước:</span>
                {r.history.filter((h) => h.month !== r.month).map((h) => <span key={h.month}>{monthLabel(h.month)}: <b>{usd(h.cost)}</b></span>)}
              </div>
            )}
          </div>

          {/* ── Chế độ lô ── */}
          <label style={{ ...section, display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={r.batch_mode} onChange={toggleBatch} style={{ marginTop: 3 }} />
            <span>
              <b>Chấm theo lô — rẻ 50%</b>
              <span style={{ display: 'block', color: '#6E6E73' }}>
                Gom bài nộp gửi Claude theo lô: điểm có sau vài phút (lâu nhất vài giờ) thay vì ~1–2 phút. Độ chính xác không đổi.
                Giáo viên bấm "Chấm lại" thì vẫn chấm ngay.
              </span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

function UsageList({ title, rows }: { title: string; rows: { key: string; name: string; extra: string; calls: number; cost: number }[] }) {
  const max = Math.max(0.0001, ...rows.map((x) => x.cost));
  return (
    <div>
      <div style={{ ...muted, marginBottom: 4 }}>{title}</div>
      {rows.map((x) => (
        <div key={x.key} style={{ marginBottom: 6, fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{x.name} <span style={muted}>· {x.calls} lượt{x.extra ? ` (${x.extra})` : ''}</span></span>
            <b>{usd(x.cost)}</b>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: '#EDEDF0', marginTop: 3 }}>
            <div style={{ width: `${(x.cost / max) * 100}%`, height: '100%', borderRadius: 99, background: '#6E5A94' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
