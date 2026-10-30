import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AdCarousel from '../components/AdCarousel';
import PublicLayout from '../components/PublicLayout';
import { useAuth } from '../contexts/AuthContext';
import FacebookIcon from '../components/FacebookIcon';
import CourseRegisterModal from '../components/CourseRegisterModal';
import ExamCard, { type ExamItem } from '../components/ExamCard';
import api, { fileUrl } from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { gradeLabel } from '../lib/publicSite';
import useIsMobile from '../lib/useIsMobile';
import { BookOpen, ChevronRight, ChevronDown, Users, GraduationCap, Award, UserCircle, Phone, Sparkles, Smartphone, LineChart, FileStack, ClipboardCheck } from 'lucide-react';

/* Mỗi ô thống kê ở trên = lối tắt cuộn xuống 1 khối nội dung ngay trên trang chủ (không mở trang khác). */
const SECTIONS = [
  { id: 'khoa-hoc', nav: 'Đăng ký học', statLabel: 'Học sinh', statKey: 'stats_students', statFallback: '500+', icon: Users, color: '#1F5C68' },
  { id: 'giao-vien', nav: 'Đội ngũ giáo viên', statLabel: 'Giáo viên', statKey: 'stats_teachers', statFallback: '20+', icon: GraduationCap, color: '#2F6F82' },
  { id: 'khoa-hoc', nav: 'Xem khóa học', statLabel: 'Khóa học', statKey: 'stats_courses', statFallback: '15+', icon: BookOpen, color: '#3A7D5C' },
  { id: 'de-thi', nav: 'Đề & chuyên môn', statLabel: 'Năm kinh nghiệm', statKey: 'stats_years', statFallback: '10+', icon: Award, color: '#B8673E' },
];

const SCROLL_OFFSET = 86; // chừa chỗ cho thanh điều hướng dính ở trên

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
  window.scrollTo({ top, behavior: 'smooth' });
  history.replaceState(null, '', `#${id}`);
}

function Section({ id, title, subtitle, icon: Icon, color, alt, children }: any) {
  const isMobile = useIsMobile();
  return (
    <section id={id} style={{ background: alt ? 'white' : 'transparent', scrollMarginTop: SCROLL_OFFSET, padding: isMobile ? '2.5rem 16px' : '4rem 22px' }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ marginBottom: isMobile ? '1.4rem' : '2.25rem', textAlign: 'center' }}>
          <Icon size={26} color={color} style={{ margin: '0 auto 10px' }} />
          <h2 style={{ margin: 0, fontSize: 'clamp(1.6rem, 3.6vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F' }}>{title}</h2>
          {subtitle && <p style={{ margin: '8px auto 0', color: '#6E6E73', fontSize: isMobile ? '0.95rem' : '1.08rem', maxWidth: 620 }}>{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', color: '#86868B', padding: '2.5rem', background: '#FAFAFC', border: '1px dashed #DCDCE1', borderRadius: 12 }}>{text}</div>;
}

function StaffGrid({ list }: { list: any[] }) {
  // Điện thoại: 2 cột, ảnh thấp hơn — 1 cột ảnh cao 220px thì mỗi người chiếm gần nửa màn hình
  const isMobile = useIsMobile();
  const imgH = isMobile ? 150 : 220;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? 12 : 20 }}>
      {list.map((s) => (
        <div key={s.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          {s.image ? (
            <img src={fileUrl(`/uploads/staff/${s.image}`)} alt={s.name} style={{ width: '100%', height: imgH, objectFit: 'cover' }} />
          ) : (
            <div style={{ height: imgH, background: 'linear-gradient(135deg, #E6F0F3, #CDE1E7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle size={isMobile ? 44 : 56} color="#2F6F82" />
            </div>
          )}
          <div style={{ padding: isMobile ? '0.75rem 0.6rem' : '1rem' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: '#1D1D1F' }}>{s.name}</h3>
            {s.role_title && <div style={{ color: '#2F6F82', fontWeight: 600, fontSize: '0.88rem', marginBottom: 6 }}>{s.role_title}</div>}
            {s.description && <p style={{ margin: 0, fontSize: '0.83rem', color: '#6E6E73', lineHeight: 1.5 }}>{s.description}</p>}
            {(s.phone || s.facebook_url) && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {s.phone && (
                  <a href={`tel:${String(s.phone).replace(/[^+\d]/g, '')}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: '#E5F1EA', color: '#3A7D5C', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>
                    <Phone size={13} /> {s.phone}
                  </a>
                )}
                {s.facebook_url && (
                  <a href={s.facebook_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: '#E6F0F3', color: '#2F6F82', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none' }}>
                    <FacebookIcon size={13} /> Facebook
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const isMobile = useIsMobile();
  const [ads, setAds] = useState([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [ready, setReady] = useState(false);
  const [registering, setRegistering] = useState<any>(null); // khóa đang mở form đăng ký

  useEffect(() => {
    api.get('/public/ads').then((r) => setAds(r.data)).catch(() => {});
    api.get('/public/settings').then((r) => setSettings(r.data)).catch(() => {});
    Promise.all([
      api.get('/public/courses').then((r) => setCourses(r.data)).catch(() => {}),
      api.get('/public/staff').then((r) => setStaff(r.data)).catch(() => {}),
      api.get('/public/exams', { params: { limit: 6 } }).then((r) => setExams(r.data)).catch(() => {}),
      api.get('/public/exam-grades').then((r) => setGrades(r.data)).catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);

  // Vào trang kèm #khoa-hoc, #giao-vien... thì cuộn tới đúng mục sau khi nội dung đã tải
  useEffect(() => {
    if (!ready || !hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => scrollToSection(id), 80);
    return () => clearTimeout(t);
  }, [ready, hash]);

  const teachers = staff.filter((s) => s.staff_type !== 'assistant');

  return (
    <PublicLayout>
      {/* Mở đầu: tiêu đề lớn ở giữa + 2 nút; ảnh quảng cáo (nếu có) ngay bên dưới */}
      <section style={{ background: '#fff', textAlign: 'center', padding: isMobile ? '2.75rem 16px 2.25rem' : '4.5rem 22px 3.5rem' }}>
        <img src="/logo.png" alt="Thầy Chiến Math" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto' }} />
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '18px auto 14px', maxWidth: 900, color: '#1D1D1F' }}>
          {settings.hero_title || 'Thầy Chiến Math'}
        </h1>
        <p style={{ color: '#6E6E73', fontSize: 'clamp(1.02rem, 2.2vw, 1.35rem)', maxWidth: 640, margin: '0 auto', lineHeight: 1.45 }}>
          {settings.hero_subtitle || 'Học Toán vững vàng — tự tin chinh phục mọi kỳ thi'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          {user
            ? <Link to={`/${user.role}`} className="btn btn-primary btn-lg">{user.role === 'student' ? 'Vào học' : 'Vào trang quản lý'} <ChevronRight size={18} /></Link>
            : <Link to="/login" className="btn btn-primary btn-lg">Đăng nhập để học <ChevronRight size={18} /></Link>}
          <a href="#khoa-hoc" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollToSection('khoa-hoc'); }}>Đăng ký học</a>
        </div>
      </section>
      {ads.length > 0 && (
        <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.5rem 16px 0' : '2rem 22px 0' }}>
          <AdCarousel ads={ads} />
        </section>
      )}

      {/* Thống kê — mỗi ô là lối tắt cuộn xuống mục tương ứng bên dưới. Điện thoại: lưới 2×2 cho gọn */}
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.5rem 16px 0' : '2.5rem 22px 0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: isMobile ? 10 : 12 }}>
          {SECTIONS.map(({ id, nav, statLabel, statKey, statFallback, icon: Icon, color }) => (
            <a key={statLabel} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToSection(id); }}
              style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                background: 'white', borderRadius: 18, height: '100%', padding: isMobile ? '0.95rem 1rem' : '1.25rem 1.25rem 1.1rem',
                display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 600, fontSize: isMobile ? '0.8rem' : '0.86rem' }}>
                  <Icon size={isMobile ? 15 : 17} color={color} /> {statLabel}
                </div>
                <div style={{ fontSize: isMobile ? '1.7rem' : '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F', margin: isMobile ? '4px 0 4px' : '6px 0 8px' }}>{settings[statKey] || statFallback}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#1F5C68', fontSize: isMobile ? '0.78rem' : '0.86rem', fontWeight: 500, marginTop: 'auto' }}>
                  {nav} <ChevronDown size={14} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 1. Khóa học — học phí + nút đăng ký (khách không cần tài khoản) */}
      <Section id="khoa-hoc" title="Các khóa học" subtitle="Chọn khóa học phù hợp và đăng ký thi thử đầu vào" icon={BookOpen} color="#3A7D5C">
        {courses.length === 0 ? <Empty text="Chưa có khóa học nào" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: isMobile ? 14 : 20 }}>
            {courses.map((c: any) => (
              <div key={c.id} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
                <Link to={`/courses/${c.id}`} style={{ display: 'block' }}>
                  {c.thumbnail ? (
                    <img src={fileUrl(`/uploads/courses/${c.thumbnail}`)} alt={c.title} style={{ width: '100%', height: isMobile ? 140 : 160, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ height: isMobile ? 110 : 160, background: 'linear-gradient(135deg, #1F5C68, #2F6F82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={36} color="rgba(255,255,255,0.7)" />
                    </div>
                  )}
                </Link>
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: '#1D1D1F' }}>{c.title}</h3>
                  {c.description && <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#6E6E73', lineHeight: 1.5 }}>{c.description}</p>}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: '#86868B' }}>Học phí</span>
                    <span style={{ fontWeight: 800, fontSize: '1.08rem', color: c.price ? '#B8673E' : '#86868B' }}>{c.price || 'Liên hệ'}</span>
                  </div>
                  {c.student_count > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3A7D5C', fontWeight: 600, fontSize: '0.82rem', marginTop: 6 }}>
                      <Users size={14} /> {c.student_count} học sinh đang học
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: c.open_registration ? '1fr 1fr' : '1fr', gap: 8, marginTop: 12 }}>
                    <Link to={`/courses/${c.id}`} className="btn btn-outline btn-sm" style={{ justifyContent: 'center' }}>Chi tiết</Link>
                    {!!c.open_registration && (
                      <button type="button" className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }} onClick={() => setRegistering(c)}>
                        <ClipboardCheck size={14} /> Đăng ký
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Đề và chuyên môn — vài đề mới nhất + lối tắt lọc theo lớp */}
      <Section id="de-thi" title="Đề và chuyên môn" subtitle="Đề kiểm tra, đề khảo sát, đề thi chọn lọc theo từng khối lớp" icon={FileStack} color="#1F5C68" alt>
        {grades.length > 0 && (
          <div className="grade-chips" style={{ justifyContent: isMobile ? 'flex-start' : 'center', marginBottom: 14 }}>
            {grades.map((g) => <Link key={g} to={`/de-thi?lop=${encodeURIComponent(g)}`} className="ph-chip" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>{gradeLabel(g)}</Link>)}
          </div>
        )}
        {exams.length === 0 ? <Empty text="Chưa có đề nào" /> : (
          <div className="exam-list" style={{ background: '#F5F5F7', ...(isMobile ? {} : { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }) }}>
            {exams.map((e) => <ExamCard key={e.id} exam={e} />)}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/de-thi" className="btn btn-outline">Xem tất cả đề <ChevronRight size={16} /></Link>
        </div>
      </Section>

      {/* 3. Đội ngũ giáo viên (tính năng trợ giảng đã bỏ — mục này chỉ hiện giáo viên) */}
      <Section id="giao-vien" title="Đội ngũ Giáo viên" subtitle="Tận tâm, giàu kinh nghiệm, đồng hành cùng học sinh" icon={GraduationCap} color="#2F6F82">
        {teachers.length === 0 ? <Empty text="Chưa có thông tin đội ngũ" /> : <StaffGrid list={teachers} />}
      </Section>

      {/* Features */}
      <section style={{ background: '#fff', padding: isMobile ? '2.75rem 16px' : '4.5rem 22px' }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#1D1D1F', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.6vw, 2.5rem)', letterSpacing: '-0.03em', margin: isMobile ? '0 0 1.5rem' : '0 0 2.5rem' }}>Vì sao chọn Thầy Chiến Math?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(210px, 1fr))', gap: isMobile ? 22 : 32 }}>
            {[
              { icon: GraduationCap, title: 'Giáo viên giỏi', desc: 'Đội ngũ giáo viên giàu kinh nghiệm, nhiệt tình' },
              { icon: Sparkles, title: 'Chấm bài bằng AI', desc: 'Hệ thống AI tự động chấm bài và đưa ra nhận xét' },
              { icon: Smartphone, title: 'Học mọi lúc', desc: 'Xem bài giảng, nộp bài online tiện lợi' },
              { icon: LineChart, title: 'Theo dõi tiến độ', desc: 'Học sinh và phụ huynh dễ dàng theo dõi kết quả' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon size={isMobile ? 28 : 34} color="#1F5C68" strokeWidth={1.6} style={{ margin: '0 auto 12px' }} />
                <div style={{ color: '#1D1D1F', fontWeight: 700, fontSize: isMobile ? '1rem' : '1.1rem', marginBottom: 6 }}>{title}</div>
                <div style={{ color: '#6E6E73', fontSize: isMobile ? '0.86rem' : '0.95rem', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CourseRegisterModal course={registering} onClose={() => setRegistering(null)} />
    </PublicLayout>
  );
}
