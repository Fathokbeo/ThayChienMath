import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PublicLayout from '../../components/PublicLayout';
import api, { fileUrl } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../components/Toast';
import { BookOpen, Users, GraduationCap, LogIn, Lock, ClipboardCheck } from 'lucide-react';
import CourseRegisterModal from '../../components/CourseRegisterModal';
import useIsMobile from '../../lib/useIsMobile';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotEnrolled(false);

    const loadPublic = () => {
      api.get(`/public/courses/${id}`)
        .then((r) => { if (!cancelled) setCourse(r.data); })
        .catch(() => { if (!cancelled) { toast.error('Không tìm thấy khóa học'); navigate('/'); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    if (user?.role === 'student') {
      // Học sinh đã có trong khóa học thì vào thẳng khóa học, không cần xem bản công khai
      api.get(`/student/my-courses/${id}`)
        .then(() => { if (!cancelled) navigate(`/student/courses/${id}`, { replace: true }); })
        .catch(() => { if (!cancelled) { setNotEnrolled(true); loadPublic(); } });
    } else {
      loadPublic();
    }

    return () => { cancelled = true; };
  }, [id, user?.role]);

  if (loading) return (
    <PublicLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#86868B' }}>Đang tải...</div>
    </PublicLayout>
  );

  if (!course) return null;

  const classes: any[] = course.classes || [];

  return (
    <PublicLayout>
      {/* Đầu trang: có ảnh khóa học (giống thẻ ở trang chủ) thì hiện ảnh cạnh thông tin, điện thoại thì ảnh ở trên */}
      <div style={{ background: 'linear-gradient(135deg, #1D1D1F, #1F5C68)', padding: isMobile ? '1.5rem 16px 2rem' : '2.75rem 1.25rem', color: 'white' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: isMobile ? 20 : 36,
          flexDirection: isMobile || !course.thumbnail ? 'column' : 'row', textAlign: isMobile || !course.thumbnail ? 'center' : 'left',
        }}>
          {course.thumbnail ? (
            <img src={fileUrl(`/uploads/courses/${course.thumbnail}`)} alt={course.title}
              style={{ width: isMobile ? '100%' : 400, maxWidth: '100%', aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.35)', flexShrink: 0, display: 'block' }} />
          ) : (
            <BookOpen size={40} />
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 800 }}>{course.title}</h1>
            {course.description && <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.85)' }}>{course.description}</p>}
            <div style={{ marginTop: 14, fontSize: '1.05rem' }}>
              Học phí: <strong style={{ fontSize: '1.2rem' }}>{course.price || 'Liên hệ'}</strong>
            </div>
            {!!course.open_registration && (
              <button type="button" className="btn btn-lg" onClick={() => setRegistering(true)}
                style={{ marginTop: 16, background: '#fff', color: '#1F5C68', fontWeight: 700 }}>
                <ClipboardCheck size={18} /> Đăng ký học & thi thử đầu vào
              </button>
            )}
          </div>
        </div>
      </div>
      <CourseRegisterModal course={registering ? course : null} onClose={() => setRegistering(false)} />

      <section style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 16px 2.5rem' }}>
        {notEnrolled && (
          <div style={{ background: '#FBEEE6', border: '1px solid #F5D7C3', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#B8673E', fontSize: '0.9rem' }}>
            Bạn chưa có trong lớp học nào của khóa này. Vui lòng liên hệ trung tâm để được đăng ký.
          </div>
        )}
        {!user && (
          <div style={{ background: '#E6F0F3', border: '1px solid #CDE1E7', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ color: '#2F6F82', fontSize: '0.9rem' }}>Đăng nhập để vào học nếu bạn đã có tài khoản trong khóa này.</span>
            <Link to="/login" className="btn btn-primary btn-sm" style={{ gap: 6, whiteSpace: 'nowrap' }}><LogIn size={14} /> Đăng nhập</Link>
          </div>
        )}

        {classes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#86868B', padding: '3rem', background: 'white', borderRadius: 12 }}>Chưa có lớp học nào cho khóa này</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {classes.map((cls) => (
              <div key={cls.id} style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '1.25rem 1.5rem' }}>
                <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 800, color: '#1D1D1F' }}>{cls.title}</h3>
                <div style={{ display: 'flex', gap: 20, fontSize: '0.85rem', color: '#6E6E73', marginBottom: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GraduationCap size={15} color="#2F6F82" /> GV phụ trách: <strong>{cls.teacher_name || 'Chưa cập nhật'}</strong>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={15} color="#3A7D5C" /> {cls.student_count} học sinh
                  </span>
                </div>
                <div style={{ borderTop: '1px solid #EDEDF0', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6E6E73', marginBottom: 8 }}>Nội dung học</div>
                  {cls.chapters.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#AEAEB2' }}>Chưa cập nhật nội dung</div>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {cls.chapters.map((ch: any) => (
                        <li key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: '#424245' }}>
                          <Lock size={12} color="#C7C7CC" /> {ch.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
