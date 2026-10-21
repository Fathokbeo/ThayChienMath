import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { Users, BookOpen, School, ClipboardList, TrendingUp, FileCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/stats').then((r) => setStats(r.data));
  }, []);

  const cards = stats ? [
    { label: 'Học sinh', value: stats.totalStudents, icon: Users, color: '#1F5C68', bg: '#E4EFF1', link: '/admin/users?role=student' },
    { label: 'Giáo viên', value: stats.totalTeachers, icon: Users, color: '#2F6F82', bg: '#E6F0F3', link: '/admin/users?role=teacher' },
    { label: 'Khóa học', value: stats.totalCourses, icon: BookOpen, color: '#3A7D5C', bg: '#E5F1EA', link: '/admin/courses' },
    { label: 'Lớp học', value: stats.totalClasses, icon: School, color: '#B8673E', bg: '#FBEEE6', link: '/admin/classes' },
    { label: 'Bài tập', value: stats.totalHomework, icon: ClipboardList, color: '#6E5A94', bg: '#EFEBF5', link: '#' },
    { label: 'Bài nộp', value: stats.totalSubmissions, icon: FileCheck, color: '#2E6B60', bg: '#E2EFEC', link: '#' },
  ] : [];

  return (
    <div className="fade-in">
      <h1 className="page-title">Tổng quan</h1>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        {cards.map(({ label, value, icon: Icon, color, bg, link }) => (
          <Link key={label} to={link} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ transition: 'transform 0.2s', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
            >
              <div className="stat-icon" style={{ background: bg }}>
                <Icon size={22} style={{ color }} />
              </div>
              <div>
                <div className="stat-value" style={{ color }}>{value ?? '—'}</div>
                <div className="stat-label">{label}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="card">
        <h2 className="section-title">Thao tác nhanh</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/admin/users" className="btn btn-primary">
            <Users size={16} /> Quản lý tài khoản
          </Link>
          <Link to="/admin/courses" className="btn btn-secondary">
            <BookOpen size={16} /> Quản lý khóa học
          </Link>
          <Link to="/admin/ads" className="btn btn-success">
            <TrendingUp size={16} /> Quản lý quảng cáo
          </Link>
        </div>
      </div>
    </div>
  );
}
