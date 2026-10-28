import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AdCarousel from '../components/AdCarousel';
import PublicLayout from '../components/PublicLayout';
import { useAuth } from '../contexts/AuthContext';
import FacebookIcon from '../components/FacebookIcon';
import api, { fileUrl } from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { BookOpen, ChevronRight, ChevronDown, Trophy, Users, GraduationCap, Award, Calendar, UserCircle, Phone, Sparkles, Smartphone, LineChart } from 'lucide-react';

/* Mỗi mục = 1 ô thống kê ở trên + 1 khối nội dung ngay trên trang chủ.
   Bấm vào ô thống kê sẽ cuộn xuống đúng khối đó (không mở trang khác). */
const SECTIONS = [
  { id: 'hoc-sinh', nav: 'Học sinh tiêu biểu', statLabel: 'Học sinh', statKey: 'stats_students', statFallback: '500+', icon: Trophy, color: '#1F5C68', bg: '#E4EFF1' },
  { id: 'giao-vien', nav: 'Đội ngũ giáo viên', statLabel: 'Giáo viên', statKey: 'stats_teachers', statFallback: '20+', icon: GraduationCap, color: '#2F6F82', bg: '#E6F0F3' },
  { id: 'khoa-hoc', nav: 'Khóa học tiêu biểu', statLabel: 'Khóa học', statKey: 'stats_courses', statFallback: '15+', icon: BookOpen, color: '#3A7D5C', bg: '#E5F1EA' },
  { id: 'kinh-nghiem', nav: 'Kinh nghiệm', statLabel: 'Năm kinh nghiệm', statKey: 'stats_years', statFallback: '10+', icon: Users, color: '#B8673E', bg: '#FBEEE6' },
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
  return (
    <section id={id} style={{ background: alt ? 'white' : 'transparent', scrollMarginTop: SCROLL_OFFSET, padding: '4rem 22px' }}>
      <div style={{ maxWidth: PAGE_MAX, margin: '0 auto' }}>
        <div style={{ marginBottom: '2.25rem', textAlign: 'center' }}>
          <Icon size={26} color={color} style={{ margin: '0 auto 10px' }} />
          <h2 style={{ margin: 0, fontSize: 'clamp(1.7rem, 3.6vw, 2.5rem)', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F' }}>{title}</h2>
          {subtitle && <p style={{ margin: '10px auto 0', color: '#6E6E73', fontSize: '1.08rem', maxWidth: 620 }}>{subtitle}</p>}
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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
      {list.map((s) => (
        <div key={s.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          {s.image ? (
            <img src={fileUrl(`/uploads/staff/${s.image}`)} alt={s.name} style={{ width: '100%', height: 220, objectFit: 'cover' }} />
          ) : (
            <div style={{ height: 220, background: 'linear-gradient(135deg, #E6F0F3, #CDE1E7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle size={56} color="#2F6F82" />
            </div>
          )}
          <div style={{ padding: '1rem' }}>
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
  const [ads, setAds] = useState([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.get('/public/ads').then((r) => setAds(r.data)).catch(() => {});
    api.get('/public/settings').then((r) => setSettings(r.data)).catch(() => {});
    Promise.all([
      api.get('/public/courses').then((r) => setCourses(r.data)).catch(() => {}),
      api.get('/public/featured-students').then((r) => setStudents(r.data)).catch(() => {}),
      api.get('/public/staff').then((r) => setStaff(r.data)).catch(() => {}),
      api.get('/public/achievements').then((r) => setAchievements(r.data)).catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);

  // Vào trang kèm #hoc-sinh, #giao-vien... thì cuộn tới đúng mục sau khi nội dung đã tải
  useEffect(() => {
    if (!ready || !hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => scrollToSection(id), 80);
    return () => clearTimeout(t);
  }, [ready, hash]);

  const teachers = staff.filter((s) => s.staff_type !== 'assistant');
  const assistants = staff.filter((s) => s.staff_type === 'assistant');

  return (
    <PublicLayout>
      {/* Mở đầu: tiêu đề lớn ở giữa + 2 nút; ảnh quảng cáo (nếu có) ngay bên dưới */}
      <section style={{ background: '#fff', textAlign: 'center', padding: '4.5rem 22px 3.5rem' }}>
        <img src="/logo.svg" alt="Thầy Chiến Math" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto' }} />
        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '18px auto 14px', maxWidth: 900, color: '#1D1D1F' }}>
          {settings.hero_title || 'Thầy Chiến Math'}
        </h1>
        <p style={{ color: '#6E6E73', fontSize: 'clamp(1.05rem, 2.2vw, 1.35rem)', maxWidth: 640, margin: '0 auto', lineHeight: 1.45 }}>
          {settings.hero_subtitle || 'Học Toán vững vàng — tự tin chinh phục mọi kỳ thi'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          {user
            ? <Link to={`/${user.role}`} className="btn btn-primary btn-lg">{user.role === 'student' ? 'Vào học' : 'Vào trang quản lý'} <ChevronRight size={18} /></Link>
            : <Link to="/login" className="btn btn-primary btn-lg">Đăng nhập để học <ChevronRight size={18} /></Link>}
          <a href="#khoa-hoc" className="btn btn-outline btn-lg" onClick={(e) => { e.preventDefault(); scrollToSection('khoa-hoc'); }}>Xem khóa học</a>
        </div>
      </section>
      {ads.length > 0 && (
        <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: '2rem 22px 0' }}>
          <AdCarousel ads={ads} />
        </section>
      )}

      {/* Thống kê — mỗi ô là lối tắt cuộn xuống mục tương ứng bên dưới */}
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: '2.5rem 22px 0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {SECTIONS.map(({ id, nav, statLabel, statKey, statFallback, icon: Icon, color }) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToSection(id); }}
              style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                background: 'white', borderRadius: 18, height: '100%', padding: '1.25rem 1.25rem 1.1rem',
                display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 600, fontSize: '0.86rem' }}>
                  <Icon size={17} color={color} /> {statLabel}
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#1D1D1F', margin: '6px 0 8px' }}>{settings[statKey] || statFallback}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#1F5C68', fontSize: '0.86rem', fontWeight: 500, marginTop: 'auto' }}>
                  {nav} <ChevronDown size={15} />
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 1. Học sinh tiêu biểu */}
      <Section id="hoc-sinh" title="Học sinh tiêu biểu" subtitle="Những gương mặt xuất sắc đạt điểm cao trong các kỳ thi" icon={Trophy} color="#1F5C68">
        {students.length === 0 ? <Empty text="Chưa có thông tin học sinh tiêu biểu" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
            {students.map((s) => (
              <div key={s.id} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                {s.image ? (
                  <img src={fileUrl(`/uploads/featured_students/${s.image}`)} alt={s.name} style={{ width: '100%', height: 240, objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 240, background: 'linear-gradient(135deg, #E4EFF1, #CFE2E6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={48} color="#1F5C68" />
                  </div>
                )}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 800, color: '#1D1D1F' }}>{s.name}</h3>
                  {s.exam && <span className="badge badge-red" style={{ marginBottom: 8 }}>{s.exam}</span>}
                  {s.achievement && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1F5C68', fontWeight: 700, fontSize: '0.95rem', margin: '8px 0' }}>
                      <Award size={16} /> {s.achievement}
                    </div>
                  )}
                  {s.description && <p style={{ margin: 0, fontSize: '0.85rem', color: '#6E6E73', lineHeight: 1.5 }}>{s.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2. Đội ngũ giáo viên & trợ giảng */}
      <Section id="giao-vien" title="Đội ngũ Giáo viên & Trợ giảng" subtitle="Tận tâm, giàu kinh nghiệm, đồng hành cùng học sinh" icon={GraduationCap} color="#2F6F82" alt>
        {staff.length === 0 ? <Empty text="Chưa có thông tin đội ngũ" /> : (
          <>
            {teachers.length > 0 && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1D1D1F', margin: '0 0 1rem' }}>Giáo viên</h3>
                <StaffGrid list={teachers} />
              </>
            )}
            {assistants.length > 0 && (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1D1D1F', margin: '2rem 0 1rem' }}>Trợ giảng</h3>
                <StaffGrid list={assistants} />
              </>
            )}
          </>
        )}
      </Section>

      {/* 3. Khóa học tiêu biểu = chính danh sách khóa học của trung tâm */}
      <Section id="khoa-hoc" title="Các khóa học" subtitle="Các khóa học đang mở tại trung tâm" icon={BookOpen} color="#3A7D5C">
        {courses.length === 0 ? <Empty text="Chưa có khóa học nào" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {courses.map((c: any) => (
              <div key={c.id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}>
                {c.thumbnail ? (
                  <img src={fileUrl(`/uploads/courses/${c.thumbnail}`)} alt={c.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: 160, background: 'linear-gradient(135deg, #1F5C68, #2F6F82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={40} color="rgba(255,255,255,0.7)" />
                  </div>
                )}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#1D1D1F' }}>{c.title}</h3>
                  {c.student_count > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3A7D5C', fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
                      <Users size={15} /> {c.student_count} học sinh
                    </div>
                  )}
                  {c.description && <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#6E6E73', lineHeight: 1.5 }}>{c.description}</p>}
                  <Link to={`/courses/${c.id}`} style={{ color: '#1F5C68', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Xem chi tiết <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 4. Kinh nghiệm & Thành tích */}
      <Section id="kinh-nghiem" title="Kinh nghiệm & Thành tích" subtitle="Hành trình phát triển của trung tâm qua các năm" icon={Award} color="#B8673E" alt>
        {achievements.length === 0 ? <Empty text="Chưa có thông tin thành tích" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {achievements.map((a, i) => (
              <div key={a.id} style={{
                background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                border: '1px solid #EDEDF0',
                display: 'flex', flexDirection: i % 2 === 0 ? 'row' : 'row-reverse', flexWrap: 'wrap',
              }}>
                {a.image && (
                  <img src={fileUrl(`/uploads/achievements/${a.image}`)} alt={a.title} style={{ width: 320, maxWidth: '100%', height: 220, objectFit: 'cover', flex: '1 1 280px' }} />
                )}
                <div style={{ padding: '1.5rem', flex: '1 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {a.year && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#B8673E', fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>
                      <Calendar size={18} /> {a.year}
                    </div>
                  )}
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800, color: '#1D1D1F' }}>{a.title}</h3>
                  {a.description && <p style={{ margin: 0, fontSize: '0.9rem', color: '#6E6E73', lineHeight: 1.6 }}>{a.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Features */}
      <section style={{ background: '#fff', padding: '4.5rem 22px' }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#1D1D1F', fontWeight: 700, fontSize: 'clamp(1.7rem, 3.6vw, 2.5rem)', letterSpacing: '-0.03em', margin: '0 0 2.5rem' }}>Vì sao chọn Thầy Chiến Math?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 32 }}>
            {[
              { icon: GraduationCap, title: 'Giáo viên giỏi', desc: 'Đội ngũ giáo viên giàu kinh nghiệm, nhiệt tình' },
              { icon: Sparkles, title: 'Chấm bài bằng AI', desc: 'Hệ thống AI tự động chấm bài và đưa ra nhận xét' },
              { icon: Smartphone, title: 'Học mọi lúc', desc: 'Xem bài giảng, nộp bài online tiện lợi' },
              { icon: LineChart, title: 'Theo dõi tiến độ', desc: 'Học sinh và phụ huynh dễ dàng theo dõi kết quả' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon size={34} color="#1F5C68" strokeWidth={1.6} style={{ margin: '0 auto 14px' }} />
                <div style={{ color: '#1D1D1F', fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>{title}</div>
                <div style={{ color: '#6E6E73', fontSize: '0.95rem', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
