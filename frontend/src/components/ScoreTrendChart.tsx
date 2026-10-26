import { useEffect, useRef, useState } from 'react';
import { fmtScore, fmtDate } from '../lib/parent';

// Điểm các bài gần đây của con (thang 10) so với điểm TB cả lớp ở cùng bài.
// Dạng "nhấn mạnh": đường của con màu nhấn, TB lớp màu xám nét đứt làm nền so sánh. Một trục duy nhất 0–10.
// Rê chuột / chạm để xem từng bài; có nút xem dạng bảng.
type Point = { homework_id: number; title: string; class_title: string; at: string; score10: number; class_avg10: number | null };

const ACCENT = '#00849F';
const MUTED = '#A1A1A6';
const H = 220, PAD = { l: 30, r: 54, t: 14, b: 26 };

export default function ScoreTrendChart({ points }: { points: Point[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, [asTable]);

  if (points.length === 0) return <div className="list-empty">Chưa có bài nào được chấm điểm.</div>;
  // Mới có 1 bài: 1 điểm trên biểu đồ không nói lên xu hướng → ghi thẳng con số
  if (points.length === 1) {
    const p = points[0];
    return (
      <div style={{ fontSize: '0.92rem', color: '#515154', lineHeight: 1.6 }}>
        Mới có 1 bài được chấm: <strong>{p.title}</strong> — con đạt <strong style={{ color: '#1D1D1F' }}>{fmtScore(p.score10)}/10</strong>
        {p.class_avg10 !== null && <>, TB cả lớp {fmtScore(p.class_avg10)}</>}. Biểu đồ xu hướng hiện khi có từ 2 bài trở lên.
      </div>
    );
  }

  const iw = Math.max(10, w - PAD.l - PAD.r), ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / 10) * ih;
  const path = (vals: (number | null)[]) => vals.reduce((d, v, i) => (v === null ? d : `${d}${d && vals[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`), '');
  const last = points.length - 1;
  let lastAvgIdx = -1;
  points.forEach((p, i) => { if (p.class_avg10 !== null) lastAvgIdx = i; });

  const onMove = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;
  // Nhãn trực tiếp ở cuối 2 đường: tách nhau nếu quá gần
  let yCon = y(points[last].score10), yAvg = lastAvgIdx >= 0 ? y(points[lastAvgIdx].class_avg10!) : null;
  if (yAvg !== null && Math.abs(yCon - yAvg) < 14) { if (yCon <= yAvg) { yCon -= 7; yAvg += 7; } else { yCon += 7; yAvg -= 7; } }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: '0.82rem', color: '#515154' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={ACCENT} strokeWidth="2" /></svg> Điểm của con</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={MUTED} strokeWidth="2" strokeDasharray="4 3" /></svg> Điểm TB cả lớp</span>
        <button className="link" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', color: '#1F5C68', fontWeight: 600 }}
          onClick={() => setAsTable((v) => !v)}>{asTable ? 'Xem biểu đồ' : 'Xem dạng bảng'}</button>
      </div>

      {asTable ? (
        <div className="table-wrap" style={{ background: '#fff', borderRadius: 14 }}>
          <table>
            <thead><tr><th>Bài tập</th><th>Lớp</th><th>Điểm của con</th><th>TB lớp</th></tr></thead>
            <tbody>
              {points.slice().reverse().map((p) => (
                <tr key={p.homework_id}><td>{p.title}</td><td>{p.class_title}</td><td><strong>{fmtScore(p.score10)}</strong></td><td>{fmtScore(p.class_avg10)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} style={{ position: 'relative', touchAction: 'pan-y' }}
          onMouseMove={(e) => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => onMove(e.touches[0].clientX)} onTouchMove={(e) => onMove(e.touches[0].clientX)}>
          <svg width={w} height={H} role="img" aria-label={`Điểm ${points.length} bài gần nhất của con so với điểm trung bình lớp`} style={{ display: 'block' }}>
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={y(v)} y2={y(v)} stroke="#EDEDF0" strokeWidth="1" />
                <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#86868B">{v}</text>
              </g>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="#D2D2D7" strokeWidth="1" />}
            <path d={path(points.map((p) => p.class_avg10))} fill="none" stroke={MUTED} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
            <path d={path(points.map((p) => p.score10))} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle key={p.homework_id} cx={x(i)} cy={y(p.score10)} r={hover === i ? 5.5 : 4} fill={ACCENT} stroke="#fff" strokeWidth="2" />
            ))}
            <text x={x(last) + 9} y={yCon + 4} fontSize="12" fontWeight="700" fill="#1D1D1F">{fmtScore(points[last].score10)}</text>
            {yAvg !== null && <text x={x(last) + 9} y={yAvg + 4} fontSize="11" fill="#6E6E73">TB {fmtScore(points[lastAvgIdx].class_avg10)}</text>}
            <text x={PAD.l} y={H - 6} fontSize="11" fill="#86868B">{fmtDate(points[0].at, false)}</text>
            {points.length > 1 && <text x={PAD.l + iw} y={H - 6} fontSize="11" fill="#86868B" textAnchor="end">{fmtDate(points[last].at, false)}</text>}
          </svg>
          {hp && (
            <div style={{
              position: 'absolute', top: 6, left: Math.min(Math.max(x(hover!) - 110, 0), Math.max(0, w - 220)), width: 220,
              background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '10px 12px', fontSize: '0.82rem', pointerEvents: 'none',
            }}>
              <div style={{ fontWeight: 700, color: '#1D1D1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hp.title}</div>
              <div style={{ color: '#86868B', marginBottom: 6 }}>{hp.class_title} · {fmtDate(hp.at, false)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Điểm của con</span><strong>{fmtScore(hp.score10)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6E6E73' }}><span>TB cả lớp</span><span>{fmtScore(hp.class_avg10)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
