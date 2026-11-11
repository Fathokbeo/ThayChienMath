import { useEffect, useState } from 'react';
import { Bot, Pencil } from 'lucide-react';
import api from '../lib/api';
import { toast } from './Toast';

type Report = {
  month: string; cost: number; budget: number; graded_submissions: number;
  byModel: { model: string; calls: number; cost: number }[];
  claude_configured: boolean; claude_active: boolean;
  models: { grade: string; check: string; review: string };
};

const usd = (n: number) => `$${(n || 0).toFixed(2)}`;
const MODEL_LABEL: Record<string, string> = {
  'claude-opus-5-5': 'Opus 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-haiku-5-5': 'Haiku 5.5',
};

// Trang Tổng quan admin: tiền chấm bài bằng Claude tháng này so với trần ngân sách (chạm trần → tự chấm bằng Gemini)
export default function AiUsageCard() {
  const [r, setR] = useState<Report | null>(null);
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState('');
  const load = () => api.get('/admin/ai-usage').then((res) => setR(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!r) return null;

  const pct = r.budget > 0 ? Math.min(100, (r.cost / r.budget) * 100) : 100;
  const perSub = r.graded_submissions ? r.cost / r.graded_submissions : null;
  const status = !r.claude_configured
    ? { text: 'Chưa có khóa API Claude — đang chấm bằng Gemini', color: '#86868B' }
    : r.claude_active
      ? { text: `Đang chấm bằng Claude: ${MODEL_LABEL[r.models.grade] || r.models.grade} chấm, ${MODEL_LABEL[r.models.check] || r.models.check} đối chiếu, ${MODEL_LABEL[r.models.review] || r.models.review} phân xử`, color: '#3A7D5C' }
      : { text: 'Đã chạm trần ngân sách tháng — đang tự chấm bằng Gemini tới hết tháng', color: '#B04A2A' };

  const saveBudget = async () => {
    try {
      await api.put('/admin/ai-usage/budget', { budget });
      toast.success('Đã lưu trần ngân sách');
      setEditing(false); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Lỗi'); }
  };

  return (
    <div className="card" style={{ padding: '1rem 1.15rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: '#F0ECF7', color: '#6E5A94', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={19} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>Chi phí AI chấm bài tháng {r.month.split('-').reverse().join('/')}</div>
          <div style={{ fontSize: '0.82rem', color: status.color }}>{status.text}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{usd(r.cost)} <span style={{ fontSize: '0.9rem', color: '#86868B', fontWeight: 500 }}>/ {usd(r.budget)}</span></div>
          {!editing ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setBudget(String(r.budget)); setEditing(true); }}><Pencil size={13} /> Đổi trần</button>
          ) : (
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              $<input className="input" type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: 90, minHeight: 34 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={saveBudget}>Lưu</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Hủy</button>
            </span>
          )}
        </div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: '#EDEDF0', margin: '12px 0 8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? '#B04A2A' : pct >= 70 ? '#D0864F' : '#3A7D5C' }} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: '0.82rem', color: '#6E6E73' }}>
        <span>{r.graded_submissions} bài AI chấm{perSub != null ? ` · ~${usd(perSub)}/bài` : ''}</span>
        {r.byModel.map((m) => <span key={m.model}>{MODEL_LABEL[m.model] || m.model}: {m.calls} lượt · {usd(m.cost)}</span>)}
      </div>
    </div>
  );
}
