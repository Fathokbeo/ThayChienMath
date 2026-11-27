import {
  LayoutDashboard, Users, BookOpen, GraduationCap, Image, School, LayoutTemplate, Newspaper, CreditCard, Bell, ClipboardCheck, ClipboardList, FileStack,
  type LucideIcon,
} from 'lucide-react';

// Menu theo vai trò — dùng chung cho thanh bên (máy tính) và thanh tab dưới đáy (điện thoại).
// short: nhãn ngắn cho thanh tab.
// match: các đường dẫn khác cũng làm mục này sáng lên (mục gộp nhiều trang, chuyển qua lại bằng tab con)
export type NavItem = { to: string; icon: LucideIcon; label: string; short: string; match?: string[] };

// Quản trị gộp còn 5 mục: lớp học xem trong từng khóa học; đề, tin tức, quảng cáo, thông tin trang gộp vào "Trang web"
const ADMIN: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tổng quan', short: 'Tổng quan' },
  { to: '/admin/registrations', icon: ClipboardCheck, label: 'Đăng ký học', short: 'Đăng ký' },
  { to: '/admin/courses', icon: BookOpen, label: 'Khóa học', short: 'Khóa học' },
  { to: '/admin/exams', icon: LayoutTemplate, label: 'Trang web', short: 'Trang web', match: ['/admin/exams', '/admin/content', '/admin/news', '/admin/ads', '/admin/info', '/admin/payments'] },
  { to: '/admin/users', icon: Users, label: 'Tài khoản', short: 'Tài khoản' },
];

// Tab con của các mục gộp — hiện ngay dưới thanh trên cùng khi đang ở một trong các trang của nhóm
export type NavTab = { to: string; icon: LucideIcon; label: string; short?: string; match?: string[] };
export const ADMIN_GROUPS: NavTab[][] = [
  [
    { to: '/admin/exams', icon: FileStack, label: 'Đề thi' },
    { to: '/admin/content', icon: Newspaper, label: 'Tin tức', match: ['/admin/content', '/admin/news'] },
    { to: '/admin/ads', icon: Image, label: 'Ảnh quảng cáo', short: 'Quảng cáo' },
    { to: '/admin/info', icon: LayoutTemplate, label: 'Thông tin trang', short: 'Thông tin' },
    { to: '/admin/payments', icon: CreditCard, label: 'Thanh toán & VIP', short: 'Thanh toán' },
  ],
];

const startsWithPath = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + '/');

// Mục / tab có đang mở không (mục tổng quan "/admin" chỉ sáng đúng trang đó)
export function isNavActive(item: { to: string; match?: string[] }, pathname: string) {
  if (item.match) return item.match.some((m) => startsWithPath(pathname, m));
  return navEnd(item.to) ? pathname === item.to : startsWithPath(pathname, item.to);
}

// Nhóm tab con của trang đang mở (chỉ trang quản trị)
export function adminGroupFor(pathname: string) {
  return ADMIN_GROUPS.find((g) => g.some((t) => isNavActive(t, pathname))) || null;
}

// Mọi trang để tìm nhanh (Ctrl+K): mục chính + từng tab con
export function navPagesFor(role?: string) {
  const items: { to: string; icon: LucideIcon; label: string }[] = navItemsFor(role).filter((n) => !n.match);
  if (role === 'admin') ADMIN_GROUPS.flat().forEach((t) => items.push(t));
  return items;
}

const TEACHER: NavItem[] = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Tổng quát', short: 'Tổng quát' },
  { to: '/teacher/homework', icon: ClipboardList, label: 'Bài tập', short: 'Bài tập' },
  { to: '/teacher/courses', icon: BookOpen, label: 'Khóa học', short: 'Khóa học' },
  { to: '/teacher/students', icon: GraduationCap, label: 'Học sinh', short: 'Học sinh' },
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

export const ROLE_LABEL: Record<string, string> = { admin: 'Quản trị viên', teacher: 'Giáo viên', student: 'Học sinh', parent: 'Phụ huynh', guest: 'Khách' };

// Dòng phụ dưới họ tên trong menu tài khoản. Phụ huynh đăng nhập bằng tên đăng nhập CỦA CON
// (tài khoản nội bộ "<tên con>_ph") nên hiện tên của con cho khỏi lạ.
export function accountSubtitle(user: { role: string; username: string }) {
  if (user.role === 'parent') return `${ROLE_LABEL.parent} · đăng nhập bằng ${user.username.replace(/_ph\d*$/, '')}`;
  if (user.role === 'guest') return `Tài khoản khách · ${user.username}`;
  return `${ROLE_LABEL[user.role]} · ${user.username}`;
}

// Nhãn nút "vào hệ thống" ở trang công khai, theo vai trò
export const ENTER_LABEL: Record<string, string> = {
  admin: 'Vào trang quản trị', teacher: 'Vào trang giáo viên', student: 'Vào học', parent: 'Xem kết quả học tập của con', guest: 'Tài khoản của tôi',
};

// Màu ảnh đại diện theo vai trò: [nền nhạt, màu chữ]
export function roleColors(role?: string): [string, string] {
  if (role === 'admin') return ['#EFEBF5', '#6E5A94'];
  if (role === 'teacher') return ['#E6F0F3', '#2F6F82'];
  if (role === 'parent') return ['#FCF0E8', '#B8673E'];
  if (role === 'guest') return ['#F0F0F3', '#515154'];
  return ['#E5F1EA', '#3A7D5C'];
}

// ?next=/de-thi/5 → đăng nhập xong quay lại đúng trang đó (chỉ nhận đường dẫn trong web, không nhận link ngoài)
export const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : null);
