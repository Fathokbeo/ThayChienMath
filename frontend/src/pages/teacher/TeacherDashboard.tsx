import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import TeachingOverview from '../../components/TeachingOverview';
import TeacherCourses from './TeacherCourses';
import { PageHeader, greeting, todayLabel } from '../../components/ui';

// Trang "Tổng quát" của giáo viên: bài đến hạn hôm nay, hạn sắp tới, danh sách lớp, và khóa học ở cuối trang.
// Trang riêng "Khóa học" (/teacher/courses) có thêm ô tìm khóa học.
export default function TeacherDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);

  useEffect(() => { api.get('/teacher/my-courses').then((r) => setCourses(r.data)); }, []);

  const totalClasses = courses.reduce((s, c) => s + (c.class_count || 0), 0);
  const totalStudents = courses.reduce((s, c) => s + (c.student_count || 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow={`Tổng quát · ${todayLabel()}`}
        title={`${greeting()}, ${user?.full_name}`}
        subtitle={`${courses.length} khóa học · ${totalClasses} lớp · ${totalStudents} học sinh`}
      />
      <TeachingOverview />
      <TeacherCourses embedded />
    </div>
  );
}
