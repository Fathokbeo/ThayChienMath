import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AdCarousel from '../components/AdCarousel';
import PublicLayout from '../components/PublicLayout';
import { useAuth } from '../contexts/AuthContext';
import CourseRegisterModal from '../components/CourseRegisterModal';
import ExamCard, { type ExamItem } from '../components/ExamCard';
import { NewsFront, type NewsItem } from '../components/NewsCard';
import ExamMenuBar, { type ExamMeta } from '../components/ExamMenuBar';
import CourseCarousel from '../components/CourseCarousel';
import { interestParam } from '../lib/interest';
import api from '../lib/api';
import { PAGE_MAX } from '../lib/layout';
import { examHref, homeTitlesFrom } from '../lib/publicSite';
import useIsMobile from '../lib/useIsMobile';
import { BRAND_DEFAULT } from '../lib/brand';
import { BookOpen, ChevronRight, GraduationCap, Newspaper, Sparkles, Smartphone, LineChart, FileStack } from 'lucide-react';

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

export default function Home() {
  const { user } = useAuth();
  const { hash } = useLocation();
  const isMobile = useIsMobile();
  const [ads, setAds] = useState([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [examMeta, setExamMeta] = useState<ExamMeta | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [ready, setReady] = useState(false);
  const [interest] = useState(interestParam);
  const [registering, setRegistering] = useState<any>(null); // khóa đang mở form đăng ký

  useEffect(() => {
    api.get('/public/ads').then((r) => setAds(r.data)).catch(() => {});
    api.get('/public/settings').then((r) => setSettings(r.data)).catch(() => {});
    Promise.all([
      // Các lớp khách đã xem đề (theo số lần xem) → khóa học hợp nhất lên đầu băng chuyền (xếp ở máy chủ theo nhãn đã lưu)
      api.get('/public/courses', { params: interest }).then((r) => setCourses(r.data)).catch(() => {}),
      api.get('/public/news').then((r) => setNews(r.data)).catch(() => {}),
      // Lấy đủ danh sách để đếm số đề cho ô số liệu; mục Đề và chuyên môn chỉ hiện 6 đề mới nhất
      api.get('/public/exams').then((r) => setExams(r.data)).catch(() => {}),
      api.get('/public/exam-meta').then((r) => setExamMeta(r.data)).catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);

  const titles = homeTitlesFrom(settings);

  // Vào trang kèm #khoa-hoc, #tin-tuc... thì cuộn tới đúng mục sau khi nội dung đã tải
  useEffect(() => {
    if (!ready || !hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => scrollToSection(id), 80);
    return () => clearTimeout(t);
  }, [ready, hash]);

  return (
    <PublicLayout>
      {/* Mở đầu: tiêu đề lớn ở giữa + 2 nút; ảnh quảng cáo (nếu có) ngay bên dưới */}
      <section style={{ background: '#fff', textAlign: 'center', padding: isMobile ? '2.75rem 16px 2.25rem' : '4.5rem 22px 3.5rem' }}>
        <img src="/logo.png" alt={settings.hero_title || BRAND_DEFAULT} style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto' }} />
        <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4rem)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '18px auto 14px', maxWidth: 900, color: '#1D1D1F' }}>
          {settings.hero_title || BRAND_DEFAULT}
        </h1>
        <p style={{ color: '#6E6E73', fontSize: 'clamp(1.02rem, 2.2vw, 1.35rem)', maxWidth: 640, margin: '0 auto', lineHeight: 1.45 }}>
          {settings.hero_subtitle || 'Học Toán vững vàng — tự tin chinh phục mọi kỳ thi'}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          {/* Nút theo người xem: khách / chưa đăng nhập → Đăng ký ngay (xuống mục khóa học); học sinh → Vào học;
              phụ huynh → xem kết quả của con; giáo viên, admin → vào trang quản lý (không cần nút đăng ký học) */}
          {!user || user.role === 'guest' ? (
            <>
              <a href="#khoa-hoc" className="btn btn-primary btn-lg" onClick={(e) => { e.preventDefault(); scrollToSection('khoa-hoc'); }}>Đăng ký ngay <ChevronRight size={18} /></a>
              {!user && <Link to="/login" className="btn btn-outline btn-lg">Đăng nhập</Link>}
            </>
          ) : (
            <Link to={`/${user.role}`} className="btn btn-primary btn-lg">
              {user.role === 'student' ? 'Vào học' : user.role === 'parent' ? 'Xem kết quả học tập của con' : 'Vào trang quản lý'} <ChevronRight size={18} />
            </Link>
          )}
        </div>
      </section>
      {ads.length > 0 && (
        <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.5rem 16px 0' : '2rem 22px 0' }}>
          <AdCarousel ads={ads} />
        </section>
      )}

      {/* 1. Đề và chuyên môn — thanh menu lớp → loại đề + 6 đề mới nhất */}
      <Section id="de-thi" title={titles.exams} subtitle={titles.examsSub} icon={FileStack} color="#1F5C68" alt>
        {examMeta && examMeta.menu.length > 0 && <ExamMenuBar meta={examMeta} hrefFor={examHref} />}
        {exams.length === 0 ? <Empty text="Chưa có đề nào" /> : (
          <div className="exam-list" style={{ background: '#F5F5F7', ...(isMobile ? {} : { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }) }}>
            {exams.slice(0, 6).map((e) => <ExamCard key={e.id} exam={e} />)}
          </div>
        )}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/de-thi" className="btn btn-outline">Xem tất cả đề <ChevronRight size={16} /></Link>
        </div>
      </Section>

      {/* 2. Tin tức — 4 bài mới nhất kiểu trang báo */}
      <Section id="tin-tuc" title={titles.news} subtitle={titles.newsSub} icon={Newspaper} color="#2F6F82">
        {news.length === 0 ? <Empty text="Chưa có bài viết nào" /> : (
          <>
            <NewsFront posts={news.slice(0, 4)} isMobile={isMobile} />
            {news.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Link to="/tin-tuc" className="btn btn-outline">Xem tất cả tin <ChevronRight size={16} /></Link>
              </div>
            )}
          </>
        )}
      </Section>

      {/* 3. Khóa học — học phí + nút đăng ký (khách không cần tài khoản) */}
      <Section id="khoa-hoc" title={titles.courses} subtitle={titles.coursesSub} icon={BookOpen} color="#3A7D5C" alt>
        {courses.length === 0 ? <Empty text="Chưa có khóa học nào" /> : (
          <CourseCarousel courses={courses} onRegister={setRegistering} personalized={!!interest.interest} />
        )}
      </Section>

      {/* Features */}
      <section style={{ background: '#fff', padding: isMobile ? '2.75rem 16px' : '4.5rem 22px' }}>
        <div style={{ maxWidth: PAGE_MAX, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ color: '#1D1D1F', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.6vw, 2.5rem)', letterSpacing: '-0.03em', margin: isMobile ? '0 0 1.5rem' : '0 0 2.5rem' }}>Vì sao chọn {settings.hero_title || BRAND_DEFAULT}?</h2>
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
