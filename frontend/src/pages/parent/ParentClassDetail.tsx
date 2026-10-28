import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronRight, Lock, Eye, FileCheck2, Bot, Phone, MessageSquareQuote, UserCog } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import { PageHeader, SectionHeader, EmptyState, scoreTone } from '../../components/ui';
import GradingDetails from '../../components/GradingDetails';
import FileViewer from '../../components/FileViewer';
import FacebookIcon from '../../components/FacebookIcon';
import { useChildren, withChild, classLabel, fmtScore, fmtDate, monthLabel, STATUS } from '../../lib/parent';

type Filter = 'all' | 'todo' | 'graded' | 'missed';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'todo', label: 'Chưa nộp' }, { key: 'graded', label: 'Đã có điểm' }, { key: 'missed', label: 'Không nộp' },
];

// Một lớp của con: điểm + hạng tháng này, nhận xét của thầy cô, từng bài tập (bấm để xem nhận xét và
// chi tiết từng câu), điểm/hạng các tháng trước, liên hệ trợ giảng.
export default function ParentClassDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { current } = useChildren();
  const [cls, setCls] = useState<any>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [viewFiles, setViewFiles] = useState<string[] | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const focusId = Number(params.get('bai')) || null;

  useEffect(() => {
    if (!current) return;
    api.get(`/parent/children/${current.id}/classes/${id}`).then((r) => {
      setCls(r.data);
      if (focusId) setOpen(new Set([focusId]));
    }).catch(() => setCls(false));
  }, [current?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mở từ thông báo / "Cần chú ý" → cuộn tới đúng bài
  useEffect(() => { if (cls && focusId) setTimeout(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200); }, [cls, focusId]);

  if (cls === false) return <EmptyState title="Không xem được lớp này" />;
  if (!cls || !current) return <div style={{ color: '#86868B' }}>Đang tải…</div>;

  const hws: any[] = cls.homework;
  const counts = { all: hws.length, todo: hws.filter((h) => h.status === 'todo').length, graded: hws.filter((h) => h.status === 'graded').length, missed: hws.filter((h) => h.status === 'missed').length };
  const visible = filter === 'all' ? hws : hws.filter((h) => h.status === filter);
  const submitted = hws.filter((h) => !['todo', 'missed'].includes(h.status)).length;
  const toggle = (hid: number) => setOpen((prev) => { const n = new Set(prev); if (n.has(hid)) n.delete(hid); else n.add(hid); return n; });

  return (
    <div>
      <Link to={withChild('/parent', current.id)} className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 10, fontSize: '0.9rem' }}>
        <ChevronLeft size={16} /> Tổng quan
      </Link>
      <PageHeader eyebrow={cls.course_title} title={classLabel(cls.title)} subtitle={`Giáo viên: ${cls.teacher_name || '—'} · Kết quả của ${current.full_name}`} />

      <div className="ph-hero" style={{ marginBottom: '2rem' }}>
        <div>
          <div className="ph-hero-label">Điểm TB tháng này</div>
          <div className="ph-hero-value">{fmtScore(cls.my_avg)}<span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/10</span></div>
          <div className="ph-hero-sub">TB cả lớp: {fmtScore(cls.class_avg)}</div>
        </div>
        <div>
          <div className="ph-hero-label">Thứ hạng tháng này</div>
          <div className="ph-hero-value" style={{ color: '#6E5A94' }}>{cls.my_rank ?? '—'}{cls.my_rank && <span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/{cls.rank_total}</span>}</div>
          <div className="ph-hero-sub">Xếp hạng tính lại từ đầu mỗi tháng</div>
        </div>
        <div>
          <div className="ph-hero-label">Đã nộp</div>
          <div className="ph-hero-value" style={{ color: counts.missed ? '#B04A2A' : '#1D1D1F' }}>{submitted}<span style={{ fontSize: '0.95rem', color: '#AEAEB2', fontWeight: 500 }}>/{hws.length} bài</span></div>
          <div className="ph-hero-sub">{counts.missed ? `${counts.missed} bài không nộp (0 điểm)` : 'Chưa bỏ lỡ bài nào'}</div>
        </div>
      </div>

      {cls.teacher_comment && (
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeader title="Nhận xét của thầy cô" />
          <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#86868B', marginBottom: 6 }}>
              <MessageSquareQuote size={14} color="#1F5C68" /> {cls.teacher_comment.author || 'Giáo viên'} · {fmtDate(cls.teacher_comment.updated_at, false)}
            </div>
            <p className="ph-quote">{cls.teacher_comment.comment}</p>
          </div>
        </section>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <SectionHeader title="Bài tập" count={hws.length} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {FILTERS.map(({ key, label }) => (
            <button key={key} className={`ph-chip ${filter === key ? 'active' : ''}`} style={{ padding: '5px 12px', fontSize: '0.84rem' }} onClick={() => setFilter(key)}>
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        {visible.length === 0 ? <EmptyState title="Không có bài nào trong mục này" /> : (
          <div className="list">
            {visible.map((h) => {
              const st = STATUS[h.status];
              const isOpen = open.has(h.id);
              const tone = h.score !== null ? scoreTone(h.score, h.max_score) : null;
              return (
                <div key={h.id} ref={h.id === focusId ? focusRef : undefined} className="list-row"
                  style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0, ...(h.id === focusId ? { boxShadow: 'inset 3px 0 0 #1F5C68' } : {}) }}>
                  <button type="button" onClick={() => toggle(h.id)} aria-expanded={isOpen}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                    {isOpen ? <ChevronDown size={16} color="#86868B" /> : <ChevronRight size={16} color="#86868B" />}
                    <div className="list-row-main">
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-sub">
                        {h.due_date ? `Hạn ${fmtDate(h.due_date)}` : 'Không đặt hạn'}
                        {h.submitted_at ? ` · Nộp ${fmtDate(h.submitted_at)}` : ''}
                      </div>
                    </div>
                    {tone ? (
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ background: tone.bg, color: tone.color, fontWeight: 700, fontSize: '0.88rem', padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>{fmtScore(h.score)}/{h.max_score}</span>
                        {h.class_avg10 !== null && <span style={{ display: 'block', fontSize: '0.72rem', color: '#86868B', marginTop: 3 }}>TB lớp {fmtScore(h.class_avg10)}</span>}
                      </span>
                    ) : <span className="ph-status" style={{ color: st.color, background: st.bg }}>{st.label}</span>}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 18px 16px 46px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {h.status === 'graded' && (
                        h.can_see_feedback ? (
                          <>
                            {h.feedback && <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#1D1D1F' }}><strong>Nhận xét:</strong> {h.feedback}</div>}
                            <GradingDetails details={h.grading_details} />
                            {h.graded_by_ai && <div style={{ fontSize: '0.76rem', color: '#6E5A94', display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={12} /> Chấm tự động bằng AI, thầy cô có thể điều chỉnh</div>}
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#86868B' }}>
                            <Lock size={13} /> Nhận xét và chi tiết từng câu hiển thị cùng lúc với đáp án{h.answer_visible_date ? ` (từ ${fmtDate(h.answer_visible_date)})` : ''}.
                          </div>
                        )
                      )}
                      {h.status === 'todo' && <div style={{ fontSize: '0.86rem', color: '#B8673E' }}>Con chưa nộp bài này{h.due_date ? `, hạn ${fmtDate(h.due_date)}` : ''}.</div>}
                      {h.status === 'missed' && <div style={{ fontSize: '0.86rem', color: '#B04A2A' }}>Đã quá hạn mà con không nộp — bài này tính 0 điểm vào điểm trung bình.</div>}
                      {(h.status === 'grading' || h.status === 'waiting') && <div style={{ fontSize: '0.86rem', color: '#2F6F82' }}>Con đã nộp bài, đang chờ chấm.</div>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {h.pdf_file && <button className="btn btn-ghost btn-sm" onClick={() => setViewFiles([fileUrl(`/uploads/homework/${h.pdf_file}`)])}><Eye size={13} /> Xem đề</button>}
                        {h.files.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setViewFiles(h.files.map((f: string) => fileUrl(`/uploads/submissions/${f}`)))}><Eye size={13} /> Bài làm của con{h.files.length > 1 ? ` (${h.files.length})` : ''}</button>}
                        {h.answer_file && <button className="btn btn-success btn-sm" onClick={() => setViewFiles([fileUrl(`/uploads/homework/${h.answer_file}`)])}><FileCheck2 size={13} /> Đáp án</button>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {cls.history.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <SectionHeader title="Kết quả các tháng" />
          <div className="table-wrap" style={{ background: '#fff', borderRadius: 18 }}>
            <table>
              <thead><tr><th>Tháng</th><th>Điểm TB của con</th><th>TB cả lớp</th><th>Thứ hạng</th></tr></thead>
              <tbody>
                {cls.history.map((r: any) => (
                  <tr key={r.month}>
                    <td>{monthLabel(r.month)}</td>
                    <td><strong>{fmtScore(r.avg)}</strong></td>
                    <td style={{ color: '#6E6E73' }}>{fmtScore(r.class_avg)}</td>
                    <td style={{ color: '#6E5A94', fontWeight: 600 }}>{r.rank ? `${r.rank}/${r.total}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cls.assistants.length > 0 && (
        <section>
          <SectionHeader title="Liên hệ trợ giảng" />
          <div className="list">
            {cls.assistants.map((a: any) => (
              <div key={a.id} className="list-row">
                {a.photo
                  ? <img src={fileUrl(`/uploads/assistants/${a.photo}`)} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                  : <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#EFEBF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCog size={18} color="#6E5A94" /></span>}
                <div className="list-row-main">
                  <div className="list-row-title">{a.full_name}</div>
                  <div className="list-row-sub">Trợ giảng {classLabel(cls.title, true)}</div>
                </div>
                {a.phone && <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="btn btn-secondary btn-sm"><Phone size={13} /> {a.phone}</a>}
                {a.facebook_url && <a href={a.facebook_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon" title="Facebook"><FacebookIcon size={15} /></a>}
              </div>
            ))}
          </div>
        </section>
      )}

      {viewFiles && <FileViewer files={viewFiles} onClose={() => setViewFiles(null)} />}
    </div>
  );
}
