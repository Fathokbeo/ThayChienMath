/**
 * Test tài khoản phụ huynh: tự tạo cùng học sinh, đăng nhập theo mục (Giáo viên / Học sinh / Phụ huynh),
 * trang tổng quan + chi tiết lớp của con, nhận xét giáo viên, quyền xem file, xóa học sinh → xóa phụ huynh.
 * Run: node test-parent.js   (server must be running on :5100)
 */
const BASE = process.env.API_BASE || 'http://localhost:5100/api';
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}  →  ${detail}`); } };

async function req(method, url, { token, json, form } = {}) {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`; let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(BASE + url, { method, headers, body }); const t = await r.text();
  let data; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data };
}
const login = (username, password, portal) => req('POST', '/auth/login', { json: { username, password, portal } });

(async () => {
  const ts = Date.now();
  const admin = (await login('admin', 'admin123', 'teacher')).data.token;
  ok('Admin đăng nhập ở mục Giáo viên', !!admin);

  const gv = `gvp_${ts}`;
  await req('POST', '/admin/users', { token: admin, json: { username: gv, password: '123456', full_name: 'GV Phụ huynh', role: 'teacher' } });
  const tt = (await login(gv, '123456', 'teacher')).data.token;
  const course = (await req('POST', '/teacher/courses', { token: tt, json: { title: 'KH test PH' } })).data.id;
  const cls = (await req('POST', `/teacher/courses/${course}/classes`, { token: tt, json: { title: 'Lớp test PH' } })).data.id;

  // HS có SĐT phụ huynh → mật khẩu PH = SĐT; HS không có SĐT → mật khẩu PH = mật khẩu con
  const hsA = `hsa_${ts}`, hsB = `hsb_${ts}`;
  const idA = (await req('POST', `/teacher/classes/${cls}/students`, { token: tt, json: { username: hsA, password: 'matkhauA', full_name: 'Nguyễn Văn An', parent_phone: '0912 345 678' } })).data.student_id;
  const idB = (await req('POST', `/teacher/classes/${cls}/students`, { token: tt, json: { username: hsB, password: 'matkhauB', full_name: 'Trần Thị Bình' } })).data.student_id;

  const detail = (await req('GET', `/teacher/classes/${cls}`, { token: tt })).data;
  const rowA = detail.students.find((s) => s.id === idA);
  const rowB = detail.students.find((s) => s.id === idB);
  ok('Tự tạo tài khoản PH khi tạo HS', rowA?.parent_username === `${hsA}_ph` && rowB?.parent_username === `${hsB}_ph`, JSON.stringify(rowA));
  ok('Mật khẩu PH mặc định = SĐT (chỉ chữ số)', rowA?.parent_password === '0912345678', rowA?.parent_password);
  ok('Không có SĐT → mật khẩu PH = mật khẩu con', rowB?.parent_password === 'matkhauB', rowB?.parent_password);

  // Đăng nhập theo mục
  let r = await login(hsA, '0912345678', 'parent');
  ok('PH đăng nhập bằng tên đăng nhập của con', r.status === 200 && r.data.user.role === 'parent', JSON.stringify(r.data));
  const ph = r.data.token;
  r = await login(`${hsA}_ph`, '0912345678', 'parent');
  ok('PH đăng nhập bằng tên tài khoản _ph', r.status === 200 && r.data.user.role === 'parent');
  r = await login(hsA, 'matkhauA', 'parent');
  ok('Mục PH + mật khẩu của con (khác mật khẩu PH) → sai', r.status === 401);
  r = await login(hsA, 'matkhauA', 'teacher');
  ok('HS chọn nhầm mục Giáo viên → báo đúng mục', r.status === 403 && /Học sinh/.test(r.data.message), JSON.stringify(r.data));
  r = await login(hsA, 'matkhauA', 'student');
  ok('HS đăng nhập mục Học sinh', r.status === 200 && r.data.user.role === 'student');
  const stA = r.data.token;
  r = await login(`${hsA}_ph`, '0912345678', 'student');
  ok('Tài khoản PH ở mục Học sinh → báo chọn mục Phụ huynh', r.status === 403 && /Phụ huynh/.test(r.data.message));
  r = await login(hsA, 'matkhauA');
  ok('Không gửi mục (API cũ) vẫn đăng nhập được', r.status === 200);

  // Bài tập: 1 bài đã quá hạn (đã nộp + chấm tay), 1 bài quá hạn không nộp, 1 bài sắp đến hạn
  const fd = (o) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f; };
  const soon = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 3600000).toISOString();
  const hw1 = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Bài 1 (nộp)', max_score: '10', due_date: soon, answer_visible_date: past }) })).data.id;
  const sub = new FormData(); sub.append('files', new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' }), 'bai.pdf');
  const s1 = (await req('POST', `/homework/${hw1}/submit`, { token: stA, form: sub })).data.submission;
  await req('PUT', `/submissions/${s1.id}/grade`, { token: tt, json: { score: 8.5, feedback: 'Con làm tốt, cần trình bày rõ hơn.' } });
  await req('PUT', `/homework/${hw1}`, { token: tt, form: fd({ due_date: past }) });
  await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Bài 2 (bỏ lỡ)', max_score: '10', due_date: past }) });
  await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Bài 3 (sắp hạn)', max_score: '10', due_date: soon }) });

  // Nhận xét tổng quát của giáo viên
  r = await req('PUT', `/teacher/classes/${cls}/students/${idA}/comment`, { token: tt, json: { comment: 'An chăm chỉ, cần luyện thêm hình học.' } });
  ok('GV lưu nhận xét tổng quát', r.status === 200);

  // Trang phụ huynh
  const kids = (await req('GET', '/parent/children', { token: ph })).data;
  ok('PH thấy đúng 1 con', Array.isArray(kids) && kids.length === 1 && kids[0].id === idA, JSON.stringify(kids));
  const ov = (await req('GET', `/parent/children/${idA}/overview`, { token: ph })).data;
  ok('Tổng quan: điểm TB tháng (8,5 và 0 → 4,3)', ov.month?.avg === 4.3, JSON.stringify(ov.month));
  ok('Tổng quan: 1 bài lỡ hạn, nộp 1/2 bài đến hạn', ov.month?.missed === 1 && ov.month?.submitted_due === 1 && ov.month?.due === 2, JSON.stringify(ov.month));
  ok('Bài sắp đến hạn chưa nộp', ov.upcoming?.length === 1 && ov.upcoming[0].title === 'Bài 3 (sắp hạn)');
  ok('Cần chú ý: lỡ hạn + sắp hết hạn', ov.attention?.some((a) => a.type === 'missed') && ov.attention?.some((a) => a.type === 'due_soon'), JSON.stringify(ov.attention));
  ok('Thông báo có: con nộp bài, bài có điểm', ov.activity?.some((e) => e.type === 'submitted') && ov.activity?.some((e) => e.type === 'graded'));
  ok('Nhận xét tổng quát tự động', Array.isArray(ov.summary) && ov.summary.length >= 2 && /1\/2 bài/.test(ov.summary.join(' ')), JSON.stringify(ov.summary));
  ok('Nhận xét của giáo viên', ov.teacher_comments?.[0]?.comment === 'An chăm chỉ, cần luyện thêm hình học.');
  ok('Thứ hạng của con trong lớp', ov.classes?.[0]?.my_rank === 1 && ov.classes?.[0]?.rank_total === 2, JSON.stringify(ov.classes));
  ok('Nhận xét bài tập (đã mở)', ov.recent_feedback?.[0]?.feedback === 'Con làm tốt, cần trình bày rõ hơn.');

  const cd = (await req('GET', `/parent/children/${idA}/classes/${cls}`, { token: ph })).data;
  ok('Chi tiết lớp: 3 bài với trạng thái', cd.homework?.length === 3 && ['graded', 'missed', 'todo'].every((st) => cd.homework.some((h) => h.status === st)), JSON.stringify(cd.homework?.map((h) => h.status)));
  ok('Chi tiết lớp: không lộ tên bạn khác', !JSON.stringify(cd).includes('Trần Thị Bình'));

  // Quyền: PH không xem được con người khác, không nộp bài
  r = await req('GET', `/parent/children/${idB}/overview`, { token: ph });
  ok('PH không xem được học sinh khác', r.status === 403);
  r = await req('POST', `/homework/${hw1}/submit`, { token: ph, form: sub });
  ok('PH không nộp bài được', r.status === 403);
  r = await req('GET', '/student/overview', { token: ph });
  ok('PH không vào được API học sinh', r.status === 403);
  r = await req('GET', `/homework/${hw1}`, { token: ph });
  ok('PH không gọi được API bài tập (lộ điểm cả lớp)', r.status === 403, String(r.status));

  // Thông báo: đánh dấu đã xem
  await req('POST', '/parent/notifications/seen', { token: ph });
  const kids2 = (await req('GET', '/parent/children', { token: ph })).data;
  ok('Đánh dấu đã xem → hết thông báo mới', kids2[0].unread === 0, JSON.stringify(kids2));

  // GV đặt lại mật khẩu phụ huynh
  r = await req('PUT', `/teacher/students/${idA}/parent-password`, { token: tt, json: { password: 'phmoi123' } });
  ok('GV đặt lại mật khẩu PH', r.status === 200 && (await login(hsA, 'phmoi123', 'parent')).status === 200);

  // Xóa lớp (xóa học sinh chỉ thuộc lớp này) → tài khoản phụ huynh bị xóa theo
  await req('DELETE', `/teacher/courses/${course}`, { token: tt });
  const users = (await req('GET', '/admin/users', { token: admin })).data;
  ok('Xóa học sinh → xóa luôn tài khoản phụ huynh', !users.some((u) => u.username === `${hsA}_ph` || u.username === `${hsB}_ph`));
  const gvId = users.find((u) => u.username === gv)?.id;
  if (gvId) await req('DELETE', `/admin/users/${gvId}`, { token: admin });

  console.log(`\n${pass} đạt, ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
