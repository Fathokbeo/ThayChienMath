import {
  LayoutDashboard, Users, BookOpen, GraduationCap, Image, School, LayoutTemplate, UserCog, Bell,
  type LucideIcon,
} from 'lucide-react';

// Menu theo vai trò — dùng chung cho thanh bên (máy tính) và thanh tab dưới đáy (điện thoại).
// short: nhãn ngắn cho thanh tab.
export type NavItem = { to: string; icon: LucideIcon; label: string; short: string };

const ADMIN: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tổng quan', short: 'Tổng quan' },
  { to: '/admin/users', icon: Users, label: 'Quản lý tài khoản', short: 'Tài khoản' },
  { to: '/admin/courses', icon: BookOpen, label: 'Khóa học', short: 'Khóa học' },
  { to: '/admin/classes', icon: School, label: 'Lớp học', short: 'Lớp học' },
  { to: '/teacher/assistants', icon: UserCog, label: 'Trợ giảng', short: 'Trợ giảng' },
  { to: '/admin/content', icon: LayoutTemplate, label: 'Nội dung trang', short: 'Nội dung' },
  { to: '/admin/ads', icon: Image, label: 'Quảng cáo', short: 'Quảng cáo' },
];

const TEACHER: NavItem[] = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Tổng quát', short: 'Tổng quát' },
  { to: '/teacher/courses', icon: BookOpen, label: 'Khóa học', short: 'Khóa học' },
  { to: '/teacher/students', icon: GraduationCap, label: 'Học sinh', short: 'Học sinh' },
  { to: '/teacher/assistants', icon: UserCog, label: 'Trợ giảng', short: 'Trợ giảng' },
];

const STUDENT: NavItem[] = [
  { to: '/student', icon: LayoutDashboard, label: 'Tổng quan', short: 'Tổng quan' },
  { to: '/student/classes', icon: School, label: 'Lớp học của tôi', short: 'Lớp học' },
];

const PARENT: NavItem[] = [
  { to: '/parent', icon: LayoutDashboard, label: 'Tổng quan', short: 'Tổng quan' },
  { to: '/parent/thong-bao', icon: Bell, label: 'Thông báo', short: 'Thông báo' },
];

export function navItemsFor(role?: string): NavItem[] {
  return role === 'admin' ? ADMIN : role === 'teacher' ? TEACHER : role === 'parent' ? PARENT : STUDENT;
}

// "/admin", "/teacher", "/student" chỉ sáng khi đúng trang đó (không sáng ở trang con)
export const navEnd = (to: string) => to.split('/').length <= 2;

export const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh' };

// Dòng phụ dưới họ tên trong menu tài khoản. Phụ huynh đăng nhập bằng tên đăng nhập CỦA CON
// (tài khoản nội bộ "<tên con>_ph") nên hiện tên của con cho khỏi lạ.
export function accountSubtitle(user: { role: string; username: string }) {
  if (user.role === 'parent') return `${ROLE_LABEL.parent} · đăng nhập bằng ${user.username.replace(/_ph\d*$/, '')}`;
  return `${ROLE_LABEL[user.role]} · ${user.username}`;
}

// Nhãn nút "vào hệ thống" ở trang công khai, theo vai trò
export const ENTER_LABEL: Record<string, string> = {
  admin: 'Vào trang quản trị', teacher: 'Vào trang giáo viên', student: 'Vào học', parent: 'Xem kết quả học tập của con',
};

// Màu ảnh đại diện theo vai trò: [nền nhạt, màu chữ]
export function roleColors(role?: string): [string, string] {
  if (role === 'admin') return ['#EFEBF5', '#6E5A94'];
  if (role === 'teacher') return ['#E6F0F3', '#2F6F82'];
  if (role === 'parent') return ['#FCF0E8', '#B8673E'];
  return ['#E5F1EA', '#3A7D5C'];
}
