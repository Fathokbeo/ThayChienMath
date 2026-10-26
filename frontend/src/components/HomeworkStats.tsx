import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, BarChart3, ListChecks, AlertTriangle } from 'lucide-react';
import { computeHomeworkStats, PART_SHORT, type QuestionStat, type ErrorStat } from '../lib/homeworkStats';

// Tab "Thống kê" ở trang chi tiết bài tập (CHỈ giáo viên/admin): phổ điểm, tỉ lệ điểm đạt theo câu,
// lỗi sai phổ biến. Bấm cột phổ điểm → danh sách HS trong khoảng đó; bấm 1 câu / 1 loại lỗi → chi tiết.

const ACCENT = '#00849F';
const fmt = (n: number | null, d = 2) => (n === null ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: d }));
const pct = (r: number) => `${Math.round(r * 100)}%`;
// Mức của 1 câu theo tỉ lệ điểm đạt (luôn kèm chữ, không chỉ dùng màu)
const level = (r: number) => (r >= 0.8 ? { text: 'Tốt', color: '#3A7D5C' } : r >= 0.5 ? { text: 'Trung bình', color: '#B8673E' } : { text: 'Yếu', color: '#B04A2A' });

function Card({ icon, title, sub, action, children }: { icon: React.ReactNode; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>
          {sub && <div style={{ fontSize: '0.8rem', color: '#86868B', marginTop: 3 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── Phổ điểm: cột theo từng khoảng 1 điểm (thang 10), vạch nét đứt = điểm TB ──
function Histogram({ bins, avg10, onPick, picked }: { bins: { from: number; to: number; count: number; names: string[] }[]; avg10: number | null; onPick: (i: number | null) => void; picked: number | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const H = 200, P = { l: 28, r: 8, t: 18, b: 28 };
  const iw = Math.max(10, w - P.l - P.r), ih = H - P.t - P.b;
  const maxC = Math.max(1, ...bins.map((b) => b.count));
  const step = maxC <= 5 ? 1 : Math.ceil(maxC / 4);
  const ticks = Array.from({ length: Math.floor(maxC / step) + 1 }, (_, i) => i * step);
  const top = Math.max(maxC, ticks[ticks.length - 1]);
  const bw = iw / bins.length;
  const y = (c: number) => P.t + ih - (c / top) * ih;
  const hb = hover !== null ? bins[hover] : null;

  return (
    <div ref={wrap} style={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem', color: '#515154', marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: ACCENT }} /> Số học sinh</span>
        {avg10 !== null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="14" height="12"><line x1="7" y1="0" x2="7" y2="12" stroke="#1D1D1F" strokeWidth="1.5" strokeDasharray="3 2" /></svg> Điểm TB {fmt(avg10, 1)}</span>}
      </div>
      <svg width={w} height={H} role="img" aria-label="Phổ điểm: số học sinh theo từng khoảng điểm" style={{ display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={P.l + iw} y1={y(t)} y2={y(t)} stroke="#EDEDF0" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#86868B">{t}</text>
          </g>
        ))}
        {bins.map((b, i) => {
          const x = P.l + i * bw;
          const h = (b.count / top) * ih;
          const dim = picked !== null && picked !== i;
          return (
            <g key={i} style={{ cursor: b.count ? 'pointer' : 'default' }} onMouseEnter={() => setHover(i)} onClick={() => b.count && onPick(picked === i ? null : i)}>
              <rect x={x} y={P.t} width={bw} height={ih} fill="transparent" />
              {b.count > 0 && (
                <path d={`M${x + 2},${P.t + ih} V${P.t + ih - h + 4} Q${x + 2},${P.t + ih - h} ${x + 6},${P.t + ih - h} H${x + bw - 6} Q${x + bw - 2},${P.t + ih - h} ${x + bw - 2},${P.t + ih - h + 4} V${P.t + ih} Z`}
                  fill={ACCENT} opacity={dim ? 0.3 : hover === i ? 0.85 : 1} />
              )}
            </g>
          );
        })}
        {avg10 !== null && (
          <line x1={P.l + (avg10 / 10) * iw} x2={P.l + (avg10 / 10) * iw} y1={P.t - 4} y2={P.t + ih} stroke="#1D1D1F" strokeWidth="1.5" strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
        )}
        {/* Số học sinh trên đầu cột — vẽ sau vạch TB để không bị đè */}
        {bins.map((b, i) => b.count > 0 && (
          <text key={i} x={P.l + i * bw + bw / 2} y={P.t + ih - (b.count / top) * ih - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1D1D1F" stroke="#fff" strokeWidth="3" paintOrder="stroke" style={{ pointerEvents: 'none' }}>{b.count}</text>
        ))}
        {/* Mốc điểm ở ranh giới các cột (màn hình hẹp chỉ hiện mốc chẵn) */}
        {Array.from({ length: 11 }, (_, i) => i).filter((i) => bw >= 28 || i % 2 === 0).map((i) => (
          <text key={i} x={P.l + i * bw} y={H - 10} textAnchor="middle" fontSize="11" fill="#86868B">{i}</text>
        ))}
      </svg>
      {hb && hb.count > 0 && (
        <div style={{ position: 'absolute', top: 0, left: Math.min(Math.max(P.l + hover! * bw + bw / 2 - 110, 0), Math.max(0, w - 220)), width: 220, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: '9px 12px', fontSize: '0.8rem', pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ fontWeight: 700 }}>Từ {hb.from} đến {hb.to === 10 ? '10' : `dưới ${hb.to}`} điểm: {hb.count} HS</div>
          <div style={{ color: '#6E6E73', marginTop: 3, lineHeight: 1.45 }}>{hb.names.slice(0, 8).join(', ')}{hb.names.length > 8 ? '…' : ''}</div>
          <div style={{ color: '#AEAEB2', marginTop: 3 }}>Bấm để xem danh sách</div>
        </div>
      )}
    </div>
  );
}

function QuestionRow({ q, open, onToggle }: { q: QuestionStat; open: boolean; onToggle: () => void }) {
  const lv = level(q.ratio);
  return (
    <div style={{ borderTop: '1px solid #EDEDF0' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ display: 'grid', gridTemplateColumns: '16px minmax(64px, 110px) minmax(0, 1fr) 92px', alignItems: 'center', gap: 10, width: '100%', padding: '10px 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        {open ? <ChevronDown size={14} color="#86868B" /> : <ChevronRight size={14} color="#86868B" />}
        <span style={{ fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6E6E73', background: '#F2F2F4', borderRadius: 6, padding: '1px 5px', marginRight: 5 }}>{PART_SHORT[q.part]}</span>{q.label}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ height: 10, background: '#F2F2F4', borderRadius: 99, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.max(2, q.ratio * 100)}%`, background: lv.color, borderRadius: 99 }} />
          </span>
          <span style={{ fontSize: '0.74rem', color: '#86868B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Đúng {q.correct} · Một phần {q.partial} · Sai {q.wrong}{q.blank ? ` · Bỏ trống ${q.blank}` : ''} <span style={{ color: '#AEAEB2' }}>/ {q.n} HS</span>
          </span>
        </span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1D1D1F' }}>{pct(q.ratio)}</span>
          <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: lv.color }}>{lv.text}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 4px 12px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.part === 'TN' && q.picks.length > 0 && (
            <div style={{ fontSize: '0.84rem', color: '#515154' }}>
              {q.answer && <>Đáp án đúng <strong>{q.answer}</strong> · </>}Phương án sai hay chọn: {q.picks.map((p) => <strong key={p.option} style={{ marginRight: 8 }}>{p.option} ({p.count} HS)</strong>)}
            </div>
          )}
          {q.marks.length === 0 ? <div style={{ fontSize: '0.84rem', color: '#3A7D5C' }}>Tất cả học sinh làm đúng câu này.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.marks.map((m, i) => (
                <div key={i} style={{ fontSize: '0.83rem', lineHeight: 1.5, background: '#FAFAFC', borderRadius: 8, padding: '6px 10px' }}>
                  <strong>{m.name}</strong>
                  <span style={{ color: m.status === 'partial' ? '#B8673E' : '#B04A2A', fontWeight: 600 }}> · {m.status === 'partial' ? 'Đúng một phần' : m.status === 'blank' ? 'Bỏ trống' : 'Sai'}</span>
                  {typeof m.points === 'number' && m.max ? <span style={{ color: '#86868B' }}> · {fmt(m.points)}/{fmt(m.max)}đ</span> : null}
                  <div style={{ color: '#515154' }}>{m.comment}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorRow({ e, total, open, onToggle }: { e: ErrorStat; total: number; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderTop: '1px solid #EDEDF0' }}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        style={{ display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto', alignItems: 'center', gap: 10, width: '100%', padding: '11px 2px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        {open ? <ChevronDown size={14} color="#86868B" /> : <ChevronRight size={14} color="#86868B" />}
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{e.label}</span>
          <span style={{ height: 8, background: '#F2F2F4', borderRadius: 99, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(e.count / total) * 100}%`, background: ACCENT, borderRadius: 99 }} />
          </span>
          <span style={{ fontSize: '0.76rem', color: '#86868B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Hay gặp ở: {e.questions.slice(0, 5).map((q) => `${q.label} (${q.count})`).join(', ')}
          </span>
        </span>
        <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{e.count} lỗi</span>
          <span style={{ display: 'block', fontSize: '0.74rem', color: '#6E6E73' }}>{e.students} HS mắc</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 4px 12px 28px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: '0.78rem', color: '#86868B' }}>Ví dụ tiêu biểu (trích từ lời chấm):</div>
          {e.samples.map((s, i) => (
            <div key={i} style={{ fontSize: '0.83rem', lineHeight: 1.5, background: '#FAFAFC', borderRadius: 8, padding: '6px 10px' }}>
              <strong>{s.question}</strong> <span style={{ color: '#86868B' }}>· {s.name}</span>
              <div style={{ color: '#515154' }}>{s.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeworkStats({ hw, roster }: { hw: any; roster: any[] }) {
  const st = useMemo(() => computeHomeworkStats(hw, roster), [hw, roster]);
  const [picked, setPicked] = useState<number | null>(null);
  const [sortHard, setSortHard] = useState(false);
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [openE, setOpenE] = useState<string | null>(null);
  const totalErrors = st.errors.reduce((a, e) => a + e.count, 0);
  const questions = sortHard ? [...st.questions].sort((a, b) => a.ratio - b.ratio) : st.questions;

  const kpis = [
    { label: 'Điểm trung bình', value: fmt(st.avg), sub: `thang ${fmt(st.max)} điểm` },
    { label: 'Trung vị', value: fmt(st.median), sub: 'một nửa lớp đạt từ mức này' },
    { label: 'Cao nhất / thấp nhất', value: st.top === null ? '—' : `${fmt(st.top)} / ${fmt(st.low)}`, sub: `${st.graded} bài có điểm` },
    { label: `Đạt từ ${fmt(st.max / 2)} điểm`, value: st.graded ? pct(st.passCount / st.graded) : '—', sub: `${st.passCount}/${st.graded} học sinh` },
  ];
  const notes = [
    st.pending ? `${st.pending} bài đang chờ chấm` : '',
    st.missingOverdue ? `${st.missingOverdue} HS không nộp (0 điểm) không tính vào thống kê` : '',
    st.notYet ? `${st.notYet} HS chưa nộp` : '',
  ].filter(Boolean).join(' · ');

  if (st.graded === 0) {
    return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#86868B' }}>Chưa có bài nào được chấm điểm — thống kê sẽ hiện khi có kết quả.{notes ? ` (${notes})` : ''}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: '0.95rem 1.1rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6E6E73' }}>{k.label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F', marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: '0.76rem', color: '#86868B', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      {notes && <div style={{ fontSize: '0.8rem', color: '#86868B', marginTop: -6 }}>{notes}</div>}

      <Card icon={<BarChart3 size={18} color={ACCENT} />} title="Phổ điểm" sub={`Số học sinh theo từng khoảng điểm${st.max !== 10 ? ' (đã quy về thang 10)' : ''}. Bấm vào cột để xem tên.`}>
        <Histogram bins={st.bins} avg10={st.avg === null ? null : (st.avg / st.max) * 10} picked={picked} onPick={setPicked} />
        {picked !== null && (
          <div style={{ marginTop: 10, fontSize: '0.86rem', background: '#F5F5F7', borderRadius: 10, padding: '8px 12px' }}>
            <strong>{st.bins[picked].from}–{st.bins[picked].to} điểm ({st.bins[picked].count} HS):</strong> {st.bins[picked].names.join(', ')}
          </div>
        )}
      </Card>

      <Card icon={<ListChecks size={18} color={ACCENT} />} title="Tỉ lệ điểm đạt theo câu"
        sub={st.questions.length ? `Trung bình % số điểm cả lớp đạt được ở mỗi câu, từ ${st.withDetails} bài có chấm chi tiết. Bấm vào câu để xem ai sai, sai thế nào.` : undefined}
        action={st.questions.length > 1 && (
          <div style={{ display: 'flex', gap: 4, background: '#F2F2F4', padding: 3, borderRadius: 9 }}>
            {[{ k: false, t: 'Thứ tự đề' }, { k: true, t: 'Câu khó trước' }].map(({ k, t }) => (
              <button key={t} className="btn btn-sm" onClick={() => setSortHard(k)}
                style={{ border: 'none', background: sortHard === k ? '#fff' : 'transparent', color: sortHard === k ? '#1F5C68' : '#6E6E73', boxShadow: sortHard === k ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{t}</button>
            ))}
          </div>
        )}>
        {st.questions.length === 0 ? (
          <div style={{ color: '#86868B', fontSize: '0.88rem' }}>Các bài được chấm tay, chưa có điểm chi tiết từng câu.</div>
        ) : (
          <div style={{ borderBottom: '1px solid #EDEDF0' }}>
            {questions.map((q) => <QuestionRow key={q.key} q={q} open={openQ === q.key} onToggle={() => setOpenQ(openQ === q.key ? null : q.key)} />)}
          </div>
        )}
      </Card>

      <Card icon={<AlertTriangle size={18} color={ACCENT} />} title="Lỗi sai phổ biến"
        sub={totalErrors ? `${totalErrors} lỗi ở các câu chưa trọn điểm, xếp loại theo lời chấm. Bấm để xem ví dụ.` : undefined}>
        {st.errors.length === 0 ? (
          <div style={{ color: '#86868B', fontSize: '0.88rem' }}>{st.questions.length ? 'Không có lỗi sai nào — cả lớp làm đúng hết.' : 'Chưa có chi tiết chấm từng câu để thống kê lỗi.'}</div>
        ) : (
          <div style={{ borderBottom: '1px solid #EDEDF0' }}>
            {st.errors.map((e) => <ErrorRow key={e.kind} e={e} total={totalErrors} open={openE === e.kind} onToggle={() => setOpenE(openE === e.kind ? null : e.kind)} />)}
          </div>
        )}
      </Card>
    </div>
  );
}
