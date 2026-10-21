import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Bot, PenLine, CalendarClock, Inbox } from 'lucide-react';
import api from '../lib/api';
import { formatDeadlineRemaining } from '../lib/homeworkParts';
import { SectionHeader, urgencyColor, scoreTone, EmptyState } from './ui';
import useIsMobile from '../lib/useIsMobile';

// Tổng quan "thông minh" cho giáo viên (và admin): việc cần xử lý trước — bài cần chấm tay, hạn nộp sắp tới
// kèm tỉ lệ đã nộp, bài vừa nộp. Mỗi dòng bấm thẳng vào trang chấm / chi tiết bài tập.
export default function TeachingOverview() {
  const isMobile = useIsMobile();
  const [ov, setOv] = useState<any>(null);
  const now = Date.now();

  useEffect(() => { api.get('/teacher/overview').then((r) => setOv(r.data)).catch(() => setOv({ to_grade: [], upcoming: [], recent: [], ai_pending: 0 })); }, []);
  if (!ov) return null;

  const toGrade: any[] = ov.to_grade || [];
  const upcoming: any[] = ov.upcoming || [];
  const recent: any[] = ov.recent || [];
  // Gom bài cần chấm theo bài tập để danh sách gọn
  const byHw = new Map<number, { homework_id: number; homework_title: string; class_title: string; count: number; failed: number; oldest: string }>();
  toGrade.forEach((s) => {
    const g = byHw.get(s.homework_id) || { homework_id: s.homework_id, homework_title: s.homework_title, class_title: s.class_title, count: 0, failed: 0, oldest: s.submitted_at };
    g.count++; if (s.grading_status === 'failed') g.failed++;
    if (s.submitted_at < g.oldest) g.oldest = s.submitted_at;
    byHw.set(s.homework_id, g);
  });
  const groups = [...byHw.values()];

  return (
    <div style={{ marginBottom: '2.25rem' }}>
      {ov.ai_pending > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E7F1F4', color: '#2F6F82', borderRadius: 14, padding: '0.75rem 1rem', marginBottom: 18, fontSize: '0.92rem' }}>
          <Bot size={18} /> AI đang chấm <strong>{ov.ai_pending}</strong> bài nộp — điểm sẽ tự cập nhật.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        <section>
          <SectionHeader title="Cần chấm" count={toGrade.length} />
          {groups.length === 0 ? (
            <EmptyState icon={<PenLine size={30} />} title="Không có bài nào chờ chấm tay" text="Bài có đáp án sẽ được chấm tự động." />
          ) : (
            <div className="list">
              {groups.map((g) => (
                <Link key={g.homework_id} to={`/teacher/homework/${g.homework_id}`} className="list-row">
                  <span style={{ minWidth: 34, height: 34, borderRadius: 10, background: '#FCF0E8', color: '#B8673E', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{g.count}</span>
                  <div className="list-row-main">
                    <div className="list-row-title">{g.homework_title}</div>
                    <div className="list-row-sub">
                      {g.class_title} · nộp sớm nhất {new Date(g.oldest).toLocaleDateString('vi-VN')}
                      {g.failed > 0 && <span style={{ color: '#B04A2A' }}> · {g.failed} bài AI chấm lỗi</span>}
                    </div>
                  </div>
                  <span className="link" style={{ fontSize: '0.86rem' }}>Chấm</span>
                  <ChevronRight size={18} color="#C7C7CC" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Sắp đến hạn" count={upcoming.length} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={30} />} title="Không có bài nào sắp đến hạn" />
          ) : (
            <div className="list">
              {upcoming.map((h) => {
                const left = new Date(h.due_date).getTime() - now;
                const pct = h.total > 0 ? Math.round((h.submitted / h.total) * 100) : 0;
                return (
                  <Link key={h.id} to={`/teacher/homework/${h.id}`} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-sub">{h.class_title} · <span style={{ color: urgencyColor(left), fontWeight: 600 }}>còn {formatDeadlineRemaining(left)}</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#EDEDF0', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#1F5C68', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#6E6E73', whiteSpace: 'nowrap' }}>{h.submitted}/{h.total} đã nộp</span>
                      </div>
                    </div>
                    <ChevronRight size={18} color="#C7C7CC" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {recent.length > 0 && (
        <section style={{ marginTop: '2.25rem' }}>
          <SectionHeader title="Mới nộp" />
          <div className="list">
            {recent.map((s) => {
              const tone = s.score !== null ? scoreTone(s.score, s.max_score) : null;
              return (
                <Link key={s.submission_id} to={`/teacher/homework/${s.homework_id}`} className="list-row">
                  <span className="avatar" style={{ background: '#E8F3EC', color: '#3A7D5C' }}>{s.full_name?.[0]}</span>
                  <div className="list-row-main">
                    <div className="list-row-title">{s.full_name}</div>
                    <div className="list-row-sub">{s.homework_title} · {s.class_title} · {new Date(s.submitted_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
                  </div>
                  {tone ? (
                    <span style={{ background: tone.bg, color: tone.color, fontWeight: 700, fontSize: '0.85rem', padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>{s.score}/{s.max_score}</span>
                  ) : s.grading_status === 'pending' || s.grading_status === 'grading' ? (
                    <span className="badge badge-blue"><Bot size={12} style={{ marginRight: 4 }} />Đang chấm</span>
                  ) : (
                    <span className="badge badge-orange"><Inbox size={12} style={{ marginRight: 4 }} />Chờ chấm</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
