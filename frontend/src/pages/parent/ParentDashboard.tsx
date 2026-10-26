import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Clock, TrendingDown, TrendingUp, Minus, ChevronRight, Trophy, MessageSquareQuote,
  Timer, PartyPopper, Bell, School, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import useIsMobile from '../../lib/useIsMobile';
import { PageHeader, SectionHeader, EmptyState, todayLabel, urgencyColor, scoreTone } from '../../components/ui';
import { formatDeadlineRemaining } from '../../lib/homeworkParts';
import ScoreTrendChart from '../../components/ScoreTrendChart';
import { useChildren, withChild, classLabel, fmtScore, fmtDate, activityText, type Activity } from '../../lib/parent';

// Trang chủ phụ huynh: đọc từ trên xuống theo mức ưu tiên — 3 con số chính, việc cần chú ý, nhận xét tổng
// quát, bài sắp đến hạn, biểu đồ điểm, thông báo mới, nhận xét bài tập, rồi tới từng lớp. Chỉ xem, không thao tác.
export default function ParentDashboard() {
  const isMobile = useIsMobile();
  const { children, current, select } = useChildren();
  const [ov, setOv] = useState<any>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!current) return;
    setOv(null);
    api.get(`/parent/children/${current.id}/overview`).then((r) => setOv(r.data));
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  if (children && children.length === 0) {
    return <EmptyState icon={<School size={34} />} title="Tài khoản chưa được liên kết với học sinh nào" text="Vui lòng liên hệ thầy cô để được hỗ trợ." />;
  }
  if (!current) return null;

  const name = current.full_name;
  const m = ov?.month;
  const delta = m && m.avg !== null && m.prev_avg !== null ? Math.round((m.avg - m.prev_avg) * 10) / 10 : null;
  const ranked = (ov?.classes || []).filter((c: any) => c.my_rank);
  const cid = current.id;

  const status = !ov ? ' ' : ov.attention.length > 0
    ? `Có ${ov.attention.length} việc cần anh/chị chú ý.`
    : ov.upcoming.length > 0 ? `Con có ${ov.upcoming.length} bài đang chờ làm, chưa có gì đáng lo.` : 'Con đã làm hết bài được giao. Mọi thứ đều ổn!';

  return (
    <div>
      <PageHeader eyebrow={todayLabel()} title={`Kết quả học tập của ${name}`} subtitle={status} />

      {/* Nhiều con → chọn con */}
      {children && children.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '-0.75rem 0 1.5rem' }}>
          {children.map((c) => (
            <button key={c.id} className={`ph-chip ${c.id === cid ? 'active' : ''}`} onClick={() => select(c.id)}>
              {c.full_name}{c.unread > 0 && <span className="ph-badge">{c.unread}</span>}
            </button>
          ))}
        </div>
      )}

      {!ov ? <div style={{ color: '#86868B' }}>Đang tải…</div> : (
        <>
          {/* 3 con số chính */}
          <div className="ph-hero" style={{ marginBottom: '2rem' }}>
            <div>
              <div className="ph-hero-label">Điểm TB tháng này</div>
              <div className="ph-hero-value" style={{ color: m.avg === null ? '#AEAEB2' : scoreTone(m.avg, 10).color }}>
                {fmtScore(m.avg)}<span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/10</span>
              </div>
              <div className="ph-hero-sub"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {delta === null ? 'Chưa có tháng trước để so sánh'
                  : delta > 0 ? <><TrendingUp size={14} color="#3A7D5C" /> Tăng {fmtScore(delta)} so với tháng trước</>
                    : delta < 0 ? <><TrendingDown size={14} color="#B04A2A" /> Giảm {fmtScore(-delta)} so với tháng trước</>
                      : <><Minus size={14} /> Bằng tháng trước</>}
              </span></div>
            </div>
            <div>
              <div className="ph-hero-label">Thứ hạng trong lớp</div>
              <div className="ph-hero-value" style={{ color: '#6E5A94' }}>
                {ranked.length ? <>{ranked[0].my_rank}<span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/{ranked[0].rank_total}</span></> : '—'}
              </div>
              <div className="ph-hero-sub">{ranked.length ? `${classLabel(ranked[0].title)}${ranked.length > 1 ? ` · và ${ranked.length - 1} lớp khác bên dưới` : ''}` : 'Chưa đủ bài để xếp hạng'}</div>
            </div>
            <div>
              <div className="ph-hero-label">Nộp bài tháng này</div>
              <div className="ph-hero-value" style={{ color: m.missed ? '#B04A2A' : '#1D1D1F' }}>
                {m.submitted_due}<span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/{m.due} bài</span>
              </div>
              <div className="ph-hero-sub">{m.missed ? `${m.missed} bài không nộp (0 điểm)` : m.due ? 'Nộp đủ, đúng hạn' : 'Chưa có bài đến hạn'}</div>
            </div>
          </div>

          {/* Cần chú ý */}
          {ov.attention.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <SectionHeader title="Cần chú ý" count={ov.attention.length} />
              <div className="list">
                {ov.attention.map((a: any, i: number) => {
                  const cfg = a.type === 'missed' ? { icon: AlertTriangle, color: '#B04A2A', text: `Không nộp bài · hạn ${fmtDate(a.at)} · tính 0 điểm` }
                    : a.type === 'due_soon' ? { icon: Clock, color: '#C2703F', text: `Chưa nộp · còn ${formatDeadlineRemaining(new Date(a.at).getTime() - now)}` }
                      : { icon: TrendingDown, color: '#B04A2A', text: `Điểm thấp: ${fmtScore(a.score)}/${a.max_score}` };
                  const Icon = cfg.icon;
                  return (
                    <Link key={i} to={withChild(`/parent/lop/${a.class_id}?bai=${a.homework_id}`, cid)} className="list-row">
                      <Icon size={20} color={cfg.color} style={{ flexShrink: 0 }} />
                      <div className="list-row-main">
                        <div className="list-row-title">{a.title}</div>
                        <div className="list-row-sub" style={{ color: cfg.color, fontWeight: 500 }}>{cfg.text}</div>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: '#86868B', whiteSpace: 'nowrap' }}>{a.class_title}</span>
                      <ChevronRight size={18} color="#C7C7CC" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(0,1.25fr) minmax(0,1fr)', gap: 28, alignItems: 'start', marginBottom: '2rem' }}>
            {/* Nhận xét tổng quát */}
            <section>
              <SectionHeader title="Nhận xét tổng quát" />
              <div className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ov.teacher_comments.map((c: any) => (
                  <div key={c.class_id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#86868B', marginBottom: 6 }}>
                      <MessageSquareQuote size={14} color="#1F5C68" /> {c.author || 'Giáo viên'} · {classLabel(c.class_title, true)} · {fmtDate(c.updated_at, false)}
                    </div>
                    <p className="ph-quote">{c.comment}</p>
                  </div>
                ))}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#86868B', marginBottom: 6 }}>
                    <Sparkles size={14} color="#B8673E" /> Tổng hợp tự động từ điểm và bài làm của con
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.92rem', lineHeight: 1.55, color: '#1D1D1F' }}>
                    {ov.summary.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>
            </section>

            {/* Sắp đến hạn */}
            <section>
              <SectionHeader title="Bài sắp đến hạn" count={ov.upcoming.length} />
              {ov.upcoming.length === 0 ? (
                <EmptyState icon={<PartyPopper size={30} />} title="Không còn bài nào chờ làm" />
              ) : (
                <div className="list">
                  {ov.upcoming.slice(0, 6).map((h: any) => {
                    const left = h.due_date ? new Date(h.due_date).getTime() - now : null;
                    const tone = left === null ? '#86868B' : urgencyColor(left);
                    return (
                      <Link key={h.id} to={withChild(`/parent/lop/${h.class_id}?bai=${h.id}`, cid)} className="list-row">
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: tone, flexShrink: 0 }} />
                        <div className="list-row-main">
                          <div className="list-row-title">{h.title}</div>
                          <div className="list-row-sub">{h.class_title}{h.due_date ? ` · Hạn ${fmtDate(h.due_date)}` : ' · Không đặt hạn'}</div>
                        </div>
                        {left !== null && (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: tone, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                            <Timer size={14} /> {formatDeadlineRemaining(left)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Điểm số */}
          <section style={{ marginBottom: '2rem' }}>
            <SectionHeader title="Điểm số các bài gần đây" />
            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
              <ScoreTrendChart points={ov.trend} />
              {ov.trend.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8, marginTop: 14, borderTop: '1px solid #EDEDF0', paddingTop: 12 }}>
                  {[
                    { k: 'gioi', label: 'Giỏi', range: '≥ 8' }, { k: 'kha', label: 'Khá', range: '6,5–8' },
                    { k: 'tb', label: 'Trung bình', range: '5–6,5' }, { k: 'yeu', label: 'Yếu', range: '< 5' },
                  ].map(({ k, label, range }) => (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1D1D1F' }}>{ov.bands[k]}</div>
                      <div style={{ fontSize: '0.76rem', color: '#6E6E73' }}>bài {label}</div>
                      <div style={{ fontSize: '0.7rem', color: '#AEAEB2' }}>{range} điểm</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 28, alignItems: 'start', marginBottom: '2rem' }}>
            {/* Thông báo hoạt động */}
            <section>
              <SectionHeader title="Thông báo mới" count={ov.unread || undefined}
                action={<Link to={withChild('/parent/thong-bao', cid)} className="link">Tất cả <ChevronRight size={15} /></Link>} />
              {ov.activity.length === 0 ? <EmptyState icon={<Bell size={30} />} title="Chưa có hoạt động nào trong 30 ngày qua" /> : (
                <div className="list">
                  {ov.activity.slice(0, 6).map((e: Activity, i: number) => (
                    <Link key={i} to={withChild(`/parent/lop/${e.class_id}?bai=${e.homework_id}`, cid)} className="list-row">
                      {e.is_new ? <span className="ph-dot" title="Mới" /> : <span style={{ width: 8 }} />}
                      <div className="list-row-main">
                        <div className="list-row-title" style={{ fontWeight: e.is_new ? 700 : 600 }}>{activityText(e)}</div>
                        <div className="list-row-sub">{e.title} · {e.class_title}</div>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#86868B', whiteSpace: 'nowrap' }}>{fmtDate(e.at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Nhận xét bài tập gần đây */}
            <section>
              <SectionHeader title="Nhận xét bài tập gần đây" />
              {ov.recent_feedback.length === 0 ? (
                <EmptyState title="Chưa có nhận xét" text="Nhận xét hiện sau khi bài được chấm và tới giờ mở đáp án." />
              ) : (
                <div className="list">
                  {ov.recent_feedback.slice(0, 3).map((f: any) => {
                    const tone = scoreTone(f.score, f.max_score);
                    return (
                      <Link key={f.id} to={withChild(`/parent/lop/${f.class_id}?bai=${f.id}`, cid)} className="list-row" style={{ alignItems: 'flex-start' }}>
                        <div className="list-row-main">
                          <div className="list-row-title">{f.title}</div>
                          <div style={{ fontSize: '0.86rem', color: '#515154', lineHeight: 1.5, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.feedback}</div>
                        </div>
                        <span style={{ background: tone.bg, color: tone.color, fontWeight: 700, fontSize: '0.86rem', padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                          {fmtScore(f.score)}/{f.max_score}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Các lớp */}
          <section>
            <SectionHeader title="Lớp học của con" count={ov.classes.length} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {ov.classes.map((c: any) => (
                <Link key={c.id} to={withChild(`/parent/lop/${c.id}`, cid)} className="card" style={{ padding: '1.1rem 1.25rem', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {c.course_title && <div style={{ fontSize: '0.78rem', color: '#86868B', fontWeight: 500 }}>{c.course_title}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '2px 0 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.12rem', letterSpacing: '-0.02em' }}>{c.title}</div>
                    <ChevronRight size={18} color="#C7C7CC" />
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#86868B' }}>Điểm TB tháng</div>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{fmtScore(c.my_avg)}<span style={{ color: '#AEAEB2', fontSize: '0.8rem', fontWeight: 500 }}> · lớp {fmtScore(c.class_avg)}</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#86868B' }}>Xếp hạng</div>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#6E5A94', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {c.my_rank ? <><Trophy size={14} /> {c.my_rank}<span style={{ color: '#AEAEB2', fontSize: '0.8rem', fontWeight: 500 }}>/{c.rank_total}</span></> : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: '#86868B' }}>Đã nộp</div>
                      <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{c.submitted_count}<span style={{ color: '#AEAEB2', fontSize: '0.8rem', fontWeight: 500 }}>/{c.homework_count} bài</span></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#86868B', marginTop: 10 }}>Giáo viên: {c.teacher_name || '—'}</div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
