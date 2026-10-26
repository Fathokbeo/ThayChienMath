import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Bot, CalendarCheck, CalendarClock, School } from 'lucide-react';
import api from '../lib/api';
import { formatDeadlineRemaining } from '../lib/homeworkParts';
import { SectionHeader, urgencyColor, EmptyState } from './ui';
import useIsMobile from '../lib/useIsMobile';

// Tổng quan "thông minh" cho giáo viên (và admin): bài đến hạn HÔM NAY, hạn nộp từ ngày mai kèm tỉ lệ đã nộp,
// danh sách lớp học kèm số liệu. Mỗi dòng bấm thẳng vào trang bài tập / lớp.
// showDeadlines=false (trang admin): bỏ 2 mục "Hôm nay" và "Sắp đến hạn", chỉ còn danh sách lớp.
export default function TeachingOverview({ showDeadlines = true }: { showDeadlines?: boolean }) {
  const isMobile = useIsMobile();
  const [ov, setOv] = useState<any>(null);
  const now = Date.now();

  useEffect(() => {
    // "Hôm nay" theo giờ máy người dùng
    const from = new Date(); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setHours(23, 59, 59, 999);
    api.get('/teacher/overview', { params: { from: from.toISOString(), to: to.toISOString() } })
      .then((r) => setOv(r.data))
      .catch(() => setOv({ today: [], upcoming: [], classes: [], ai_pending: 0 }));
  }, []);
  if (!ov) return null;

  const today: any[] = ov.today || [];
  const upcoming: any[] = ov.upcoming || [];
  const classes: any[] = ov.classes || [];
  const hm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ marginBottom: '2.25rem' }}>
      {ov.ai_pending > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E7F1F4', color: '#2F6F82', borderRadius: 14, padding: '0.75rem 1rem', marginBottom: 18, fontSize: '0.92rem' }}>
          <Bot size={18} /> AI đang chấm <strong>{ov.ai_pending}</strong> bài nộp — điểm sẽ tự cập nhật.
        </div>
      )}

      {showDeadlines && (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        <section>
          <SectionHeader title="Hôm nay" count={today.length}
            action={<span style={{ fontSize: '0.85rem', color: '#86868B' }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>} />
          {today.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={30} />} title="Hôm nay không có bài nào đến hạn" text="Bài có hạn nộp trong ngày sẽ hiện ở đây." />
          ) : (
            <div className="list">
              {today.map((h) => {
                const left = new Date(h.due_date).getTime() - now;
                const passed = left <= 0;
                const pct = h.total > 0 ? Math.round((h.submitted / h.total) * 100) : 0;
                return (
                  <Link key={h.id} to={`/teacher/homework/${h.id}`} className="list-row">
                    <span style={{ width: 52, flexShrink: 0, textAlign: 'center' }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '1rem', color: passed ? '#86868B' : urgencyColor(left) }}>{hm(h.due_date)}</span>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#86868B' }}>hạn nộp</span>
                    </span>
                    <div className="list-row-main">
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-sub">
                        {h.class_title} · {passed
                          ? <span style={{ color: '#86868B' }}>đã hết hạn</span>
                          : <span style={{ color: urgencyColor(left), fontWeight: 600 }}>còn {formatDeadlineRemaining(left)}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#EDEDF0', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: passed ? '#86868B' : '#1F5C68', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: '0.78rem', color: '#6E6E73', whiteSpace: 'nowrap' }}>{h.submitted}/{h.total} đã nộp</span>
                      </div>
                    </div>
                    {h.to_grade > 0 && <span className="badge badge-orange" style={{ whiteSpace: 'nowrap' }}>{h.to_grade} chờ chấm</span>}
                    <ChevronRight size={18} color="#C7C7CC" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Sắp đến hạn" count={upcoming.length} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarClock size={30} />} title="Không có bài nào sắp đến hạn" text="Các bài có hạn từ ngày mai trở đi." />
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
      )}

      {/* Lớp học đang dạy: bấm để vào lớp */}
      <section style={{ marginTop: showDeadlines ? '2.25rem' : 0 }}>
        <SectionHeader title="Lớp học" count={classes.length} />
        {classes.length === 0 ? (
          <EmptyState icon={<School size={30} />} title="Chưa có lớp nào" text="Vào một khóa học để tạo lớp." />
        ) : (
          <div className="list">
            {classes.map((c) => {
              const left = c.next_due ? new Date(c.next_due).getTime() - now : null;
              return (
                <Link key={c.id} to={`/teacher/classes/${c.id}`} className="list-row">
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: '#E6F0F2', color: '#1F5C68', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem' }}>
                    {c.title?.slice(0, 4)}
                  </span>
                  <div className="list-row-main">
                    <div className="list-row-title">{c.title}{c.course_title && <span style={{ color: '#86868B', fontWeight: 500 }}> · {c.course_title}</span>}</div>
                    <div className="list-row-sub">
                      {c.student_count} học sinh · {c.homework_count} bài tập
                      {c.class_avg !== null && <> · TB tháng <strong style={{ color: '#B8673E' }}>{c.class_avg}</strong></>}
                      {left !== null && <> · hạn gần nhất <span style={{ color: urgencyColor(left), fontWeight: 600 }}>còn {formatDeadlineRemaining(left)}</span></>}
                    </div>
                  </div>
                  {c.to_grade > 0 && <span className="badge badge-orange" style={{ whiteSpace: 'nowrap' }}>{c.to_grade} chờ chấm</span>}
                  <ChevronRight size={18} color="#C7C7CC" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
