import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronRight, Star, ClipboardCheck, CheckCircle2, School, Timer, Trophy, PartyPopper, BookOpen, Play } from 'lucide-react';
import { formatDeadlineRemaining } from '../../lib/homeworkParts';
import { PageHeader, SectionHeader, greeting, givenName, todayLabel, urgencyColor, scoreTone, EmptyState } from '../../components/ui';
import useIsMobile from '../../lib/useIsMobile';

// Trang chủ học sinh "thông minh": đưa ngay việc cần làm ở mọi lớp lên đầu (hạn gần nhất trước, đếm ngược),
// điểm vừa có, tình hình từng lớp; bấm là tới đúng chỗ.
export default function StudentDashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [ov, setOv] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    api.get('/student/overview').then((r) => setOv(r.data));
    api.get('/student/stats').then((r) => setStats(r.data));
    api.get('/student/my-courses').then((r) => setCourses(r.data));
    const t = setInterval(() => setNow(Date.now()), 30000); // đồng hồ đếm ngược hạn nộp
    return () => clearInterval(t);
  }, []);

  const todo: any[] = ov?.todo || [];
  const recent: any[] = ov?.recent || [];
  const classes: any[] = ov?.classes || [];
  const next = todo[0];
  const subtitle = !ov ? ' ' : todo.length === 0
    ? 'Bạn đã nộp hết bài tập đang mở. Tuyệt vời!'
    : `Bạn có ${todo.length} bài cần nộp — bài gần nhất còn ${formatDeadlineRemaining(new Date(next.due_date).getTime() - now)}.`;

  return (
    <div>
      <PageHeader eyebrow={todayLabel()} title={`${greeting()}, ${givenName(user?.full_name)}`} subtitle={subtitle} />

      {/* Số liệu nhanh */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: '2.25rem' }}>
          {[
            { label: 'Điểm TB tháng', value: stats.avgScore ?? '—', icon: Star, color: '#B8673E' },
            { label: 'Bài đã nộp', value: stats.submittedCount, icon: ClipboardCheck, color: '#2F6F82' },
            { label: 'Bài đã chấm', value: stats.gradedCount, icon: CheckCircle2, color: '#3A7D5C' },
            { label: 'Lớp học', value: stats.classCount, icon: School, color: '#1F5C68' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon"><Icon style={{ color }} /></div>
              <div>
                <div className="stat-value" style={{ color: '#1D1D1F' }}>{value}</div>
                <div className="stat-label" style={{ color }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        {/* Việc cần làm */}
        <section>
          <SectionHeader title="Việc cần làm" count={todo.length} />
          {ov && todo.length === 0 ? (
            <EmptyState icon={<PartyPopper size={34} />} title="Không còn bài nào cần nộp" text="Bài tập mới sẽ tự hiện ở đây khi thầy cô giao." />
          ) : (
            <div className="list">
              {todo.map((h) => {
                const left = new Date(h.due_date).getTime() - now;
                const tone = urgencyColor(left);
                return (
                  <Link key={h.id} to={`/student/classes/${h.class_id}?tab=todo`} className="list-row">
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: tone, flexShrink: 0 }} />
                    <div className="list-row-main">
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-sub">
                        {h.class_title} · Hạn {new Date(h.due_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        {h.exam_type === 'hsa' && h.time_limit_minutes ? ` · ${h.time_limit_minutes} phút` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: tone, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <Timer size={14} /> {formatDeadlineRemaining(left)}
                    </span>
                    <ChevronRight size={18} color="#C7C7CC" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Kết quả mới */}
        <section>
          <SectionHeader title="Kết quả mới" />
          {ov && recent.length === 0 ? (
            <EmptyState title="Chưa có bài nào được chấm" text="Điểm sẽ hiện ở đây ngay khi bài được chấm." />
          ) : (
            <div className="list">
              {recent.map((r) => {
                const tone = scoreTone(r.score, r.max_score);
                return (
                  <Link key={`${r.homework_id}`} to={`/student/classes/${r.class_id}`} className="list-row">
                    <div className="list-row-main">
                      <div className="list-row-title">{r.title}</div>
                      <div className="list-row-sub">{r.class_title}</div>
                    </div>
                    <span style={{ background: tone.bg, color: tone.color, fontWeight: 700, fontSize: '0.88rem', padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                      {r.score}/{r.max_score}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Lớp của tôi */}
      <section style={{ marginTop: '2.25rem' }}>
        <SectionHeader title="Lớp của tôi" action={<Link to="/student/classes" className="link">Tất cả <ChevronRight size={15} /></Link>} />
        {ov && classes.length === 0 ? (
          <EmptyState icon={<School size={34} />} title="Bạn chưa được thêm vào lớp nào" text="Hãy liên hệ thầy cô để được thêm vào lớp." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
            {classes.map((c) => (
              <div key={c.id} className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', flexDirection: 'column' }}>
                {c.course_title && <div style={{ fontSize: '0.78rem', color: '#86868B', fontWeight: 500 }}>{c.course_title}</div>}
                <div style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.02em', margin: '2px 0 12px' }}>{c.title}</div>
                <div style={{ display: 'flex', gap: 18 }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: '#86868B' }}>Điểm TB tháng</div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#B8673E' }}>{c.my_avg ?? '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.74rem', color: '#86868B' }}>Xếp hạng</div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#6E5A94', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.my_rank ? <><Trophy size={15} /> {c.my_rank}<span style={{ color: '#AEAEB2', fontSize: '0.85rem', fontWeight: 500 }}>/{c.rank_total}</span></> : '—'}
                    </div>
                  </div>
                </div>
                <Link to={`/student/classes/${c.id}`} className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}>
                  <Play size={15} /> Vào học
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Khóa học */}
      {courses.length > 0 && (
        <section style={{ marginTop: '2.25rem' }}>
          <SectionHeader title="Khóa học" />
          <div className="list">
            {courses.map((co) => (
              <Link key={co.id} to={`/student/courses/${co.id}`} className="list-row">
                <span style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F0F2', color: '#1F5C68', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={18} />
                </span>
                <div className="list-row-main">
                  <div className="list-row-title">{co.title}</div>
                  <div className="list-row-sub">{co.class_count || 0} lớp của bạn{co.description ? ` · ${co.description}` : ''}</div>
                </div>
                <ChevronRight size={18} color="#C7C7CC" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
