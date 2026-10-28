import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

// points / max_points: điểm đạt & điểm tối đa của ý theo barem (AI chấm tự luận trả về; dữ liệu cũ có thể không có)
interface Detail { question: string; status: 'correct' | 'wrong' | 'partial'; comment: string; points?: number; max_points?: number; }

const fmtPts = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const STYLE: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
  correct: { bg: '#E5F1EA', color: '#3A7D5C', label: 'Đúng', Icon: CheckCircle2 },
  wrong:   { bg: '#F8E6DF', color: '#B04A2A', label: 'Sai', Icon: XCircle },
  partial: { bg: '#FBEEE6', color: '#B8673E', label: 'Đúng một phần', Icon: MinusCircle },
};

export default function GradingDetails({ details }: { details: string | Detail[] | null | undefined }) {
  let list: Detail[] = [];
  if (Array.isArray(details)) list = details;
  else if (typeof details === 'string' && details.trim()) {
    try { const p = JSON.parse(details); if (Array.isArray(p)) list = p; } catch { /* ignore */ }
  }
  if (list.length === 0) return null;

  const counts = list.reduce((a, d) => { a[d.status] = (a[d.status] || 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.83rem', color: '#1D1D1F' }}>Chi tiết từng câu:</strong>
        {counts.correct > 0 && <span style={{ fontSize: '0.74rem', color: '#3A7D5C', fontWeight: 600 }}>✓ {counts.correct} đúng</span>}
        {counts.partial > 0 && <span style={{ fontSize: '0.74rem', color: '#B8673E', fontWeight: 600 }}>~ {counts.partial} một phần</span>}
        {counts.wrong > 0 && <span style={{ fontSize: '0.74rem', color: '#B04A2A', fontWeight: 600 }}>✗ {counts.wrong} sai</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((d, i) => {
          const st = STYLE[d.status] || STYLE.partial;
          const Icon = st.Icon;
          return (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '0.5rem 0.7rem', background: st.bg, borderRadius: 8, alignItems: 'flex-start' }}>
              <Icon size={16} color={st.color} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1D1D1F' }}>{d.question || `Câu ${i + 1}`}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: st.color, background: 'white', padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap' }}>{st.label}</span>
                  {typeof d.points === 'number' && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>
                      {fmtPts(d.points)}{typeof d.max_points === 'number' ? `/${fmtPts(d.max_points)}` : ''}đ
                    </span>
                  )}
                </div>
                {d.comment && <div style={{ fontSize: '0.8rem', color: '#515154', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-line' }}>{d.comment}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
