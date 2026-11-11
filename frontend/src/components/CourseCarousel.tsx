import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, ClipboardCheck, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { gradeLabel } from '../lib/publicSite';

export type PublicCourse = {
  id: number; title: string; description?: string | null; thumbnail?: string | null; price?: string | null;
  open_registration?: number; student_count?: number; match?: number; fit_grades?: string[];
};

// Khóa học dạng băng chuyền: kéo/vuốt ngang hoặc bấm mũi tên trái/phải, mỗi lần trượt 1 thẻ.
// Khóa phù hợp với đề khách hay xem (match > 0) có nhãn "Phù hợp với bạn".
export default function CourseCarousel({ courses, onRegister, personalized }: { courses: PublicCourse[]; onRegister: (c: PublicCourse) => void; personalized?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = track.current; if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(() => { update(); const el = track.current; el?.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    return () => { el?.removeEventListener('scroll', update); window.removeEventListener('resize', update); }; }, [courses]);

  const slide = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.course-slide');
    el.scrollBy({ left: dir * ((card?.offsetWidth || 300) + 18), behavior: 'smooth' });
  };

  return (
    <div className="course-carousel">
      {!edge.start && <button type="button" className="course-nav prev" aria-label="Khóa trước" onClick={() => slide(-1)}><ChevronLeft size={22} /></button>}
      {!edge.end && <button type="button" className="course-nav next" aria-label="Khóa tiếp" onClick={() => slide(1)}><ChevronRight size={22} /></button>}
      <div ref={track} className="course-track">
        {courses.map((c) => (
          <div key={c.id} className="course-slide">
            <Link to={`/courses/${c.id}`} style={{ display: 'block', position: 'relative' }}>
              {c.thumbnail ? (
                <img src={fileUrl(`/uploads/courses/${c.thumbnail}`)} alt={c.title} style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ aspectRatio: '16 / 10', background: 'linear-gradient(135deg, #1F5C68, #2F6F82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={36} color="rgba(255,255,255,0.7)" />
                </div>
              )}
              {personalized && !!c.match && c.match >= 6 && <span className="course-fit"><Sparkles size={12} /> Phù hợp với bạn</span>}
            </Link>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#1D1D1F' }}>{c.title}</h3>
              {!!c.fit_grades?.length && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {c.fit_grades.map((g) => <span key={g} className="badge badge-green" style={{ fontSize: '0.7rem' }}>Dành cho {gradeLabel(g).toLowerCase()}</span>)}
                </div>
              )}
              {c.description && <p className="clamp-3" style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#6E6E73', lineHeight: 1.5 }}>{c.description}</p>}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
                <span style={{ fontSize: '0.8rem', color: '#86868B' }}>Học phí</span>
                <span style={{ fontWeight: 800, fontSize: '1.08rem', color: c.price ? '#B8673E' : '#86868B' }}>{c.price || 'Liên hệ'}</span>
              </div>
              {!!c.student_count && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3A7D5C', fontWeight: 600, fontSize: '0.82rem', marginTop: 6 }}>
                  <Users size={14} /> {c.student_count} học sinh đang học
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: c.open_registration ? '1fr 1fr' : '1fr', gap: 8, marginTop: 12 }}>
                <Link to={`/courses/${c.id}`} className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>Chi tiết</Link>
                {!!c.open_registration && (
                  <button type="button" className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }} onClick={() => onRegister(c)}>
                    <ClipboardCheck size={14} /> Đăng ký
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
