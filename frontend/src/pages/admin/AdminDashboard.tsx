import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Users, BookOpen, School, ClipboardList, FileCheck, GraduationCap, LayoutTemplate, Image, UserCog, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TeachingOverview from '../../components/TeachingOverview';
import { PageHeader, SectionHeader, greeting, todayLabel } from '../../components/ui';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data));
  }, []);

  const cards = stats ? [
    { label: 'Học sinh', value: stats.totalStudents, icon: Users, color: '#1F5C68', link: '/admin/users?role=student' },
    { label: 'Giáo viên', value: stats.totalTeachers, icon: GraduationCap, color: '#2F6F82', link: '/admin/users?role=teacher' },
    { label: 'Khóa học', value: stats.totalCourses, icon: BookOpen, color: '#3A7D5C', link: '/admin/courses' },
    { label: 'Lớp học', value: stats.totalClasses, icon: School, color: '#B8673E', link: '/admin/classes' },
    { label: 'Bài tập', value: stats.totalHomework, icon: ClipboardList, color: '#6E5A94', link: '' },
    { label: 'Bài nộp', value: stats.totalSubmissions, icon: FileCheck, color: '#2E6B60', link: '' },
  ] : [];

  const shortcuts = [
    { to: '/admin/users', icon: Users, title: 'Quản lý tài khoản', sub: 'Tạo, sửa, khóa tài khoản giáo viên và học sinh' },
    { to: '/admin/courses', icon: BookOpen, title: 'Khóa học', sub: 'Khóa học, lớp học và giáo viên phụ trách' },
    { to: '/teacher/assistants', icon: UserCog, title: 'Trợ giảng', sub: 'Thông tin liên hệ và lịch làm việc' },
    { to: '/admin/content', icon: LayoutTemplate, title: 'Nội dung trang giới thiệu', sub: 'Học sinh tiêu biểu, đội ngũ, thành tích, liên hệ' },
    { to: '/admin/ads', icon: Image, title: 'Quảng cáo', sub: 'Ảnh băng chuyền ở trang chủ' },
  ];

  return (
    <div>
      <PageHeader eyebrow={todayLabel()} title={`${greeting()}, ${user?.full_name}`} subtitle="Toàn cảnh trung tâm và những việc cần xử lý." />

      <div className="stat-grid" style={{ marginBottom: '2.25rem' }}>
        {cards.map(({ label, value, icon: Icon, color, link }) => {
          const inner = (
            <div className="stat-card" style={{ height: '100%' }}>
              <div className="stat-icon"><Icon style={{ color }} /></div>
              <div>
                <div className="stat-value">{value ?? '—'}</div>
                <div className="stat-label" style={{ color }}>{label}</div>
              </div>
            </div>
          );
          return link ? <Link key={label} to={link} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</Link> : <div key={label}>{inner}</div>;
        })}
      </div>

      {/* Danh sách lớp (trang admin không hiện "Hôm nay" / "Sắp đến hạn") */}
      <TeachingOverview showDeadlines={false} />

      <SectionHeader title="Quản trị" />
      <div className="list">
        {shortcuts.map(({ to, icon: Icon, title, sub }) => (
          <Link key={to} to={to} className="list-row">
            <span style={{ width: 36, height: 36, borderRadius: 10, background: '#E6F0F2', color: '#1F5C68', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} />
            </span>
            <div className="list-row-main">
              <div className="list-row-title">{title}</div>
              <div className="list-row-sub">{sub}</div>
            </div>
            <ChevronRight size={18} color="#C7C7CC" />
          </Link>
        ))}
      </div>
    </div>
  );
}
