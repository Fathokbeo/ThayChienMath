// Test: giáo viên NỘP HỘ học sinh (bài thu trên lớp) — chạy khi server đang chạy với dữ liệu demo: node test-proxy-submit.js
const fs = require('fs');
const path = require('path');
const BASE = process.env.API_BASE || 'http://localhost:5100/api';
let pass = 0, fail = 0;
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n} → ${d}`); } };

async function req(method, url, { token, json, form } = {}) {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`;
  let body; if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); } if (form) body = form;
  const r = await fetch(BASE + url, { method, headers, body });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data };
}
const login = async (u, p, portal) => (await req('POST', '/auth/login', { json: { username: u, password: p, portal } })).data.token;
const pdf = path.join(__dirname, 'demo/files/bai-lop6-c.pdf');
const form = (n = 1) => { const f = new FormData(); for (let i = 0; i < n; i++) f.append('files', new File([fs.readFileSync(pdf)], `trang-${i + 1}.pdf`, { type: 'application/pdf' })); return f; };

(async () => {
  console.log('\n═══ TEST NỘP HỘ HỌC SINH ═══\n');
  const tt = await login('thaychien', '123456', 'teacher');
  const admin = await login('admin', 'admin123', 'teacher');
  const classes = (await req('GET', '/teacher/classes', { token: tt })).data;
  const c6 = classes.find((c) => c.title === 'Lớp 6A'); const c9 = classes.find((c) => c.title === 'Lớp 9A');
  const cls6 = (await req('GET', `/teacher/classes/${c6.id}`, { token: tt })).data;
  const open = cls6.homework.find((h) => h.title.startsWith('Nộp thử'));
  const past = cls6.homework.find((h) => h.title.startsWith('Kiểm tra học kì II'));
  const hw = (await req('GET', `/homework/${open.id}`, { token: tt })).data;
  const target = hw.roster.find((s) => !s.submission_id);
  const other9 = (await req('GET', `/teacher/classes/${c9.id}`, { token: tt })).data.students[0];

  // 1. Giáo viên nộp hộ 1 em chưa nộp
  let r = await req('POST', `/homework/${open.id}/students/${target.student_id}/submit`, { token: tt, form: form(2) });
  ok('Giáo viên nộp hộ → 200', r.status === 200, JSON.stringify(r.data).slice(0, 150));
  ok('Thông báo "Đã nộp bài hộ học sinh"', /nộp bài hộ/.test(r.data.message), r.data.message);
  ok('Bài nộp ghi người nộp hộ (submitted_by = giáo viên)', r.data.submission?.submitted_by != null);
  ok('Lưu đủ 2 file, chờ AI chấm', JSON.parse(r.data.submission.files).length === 2 && ['pending', 'grading'].includes(r.data.submission.grading_status), r.data.submission?.grading_status);
  let roster = (await req('GET', `/homework/${open.id}`, { token: tt })).data.roster;
  ok('Danh sách lớp hiện em đó đã nộp + submitted_by', roster.some((s) => s.student_id === target.student_id && s.submission_id && s.submitted_by));

  // 2. Học sinh thấy bài đã được nộp hộ
  const st = await login(target.username, '123456', 'student');
  r = await req('GET', `/homework/${open.id}`, { token: st });
  ok('Học sinh thấy bài của mình đã có bài nộp', !!r.data.submission, JSON.stringify(r.data.submission).slice(0, 80));

  // 3. Phụ huynh nhận thông báo "thầy cô nộp hộ"
  const ph = await login(target.username, '123456', 'parent');
  const kid = (await req('GET', '/parent/children', { token: ph })).data[0];
  const ov = (await req('GET', `/parent/children/${kid.id}/overview`, { token: ph })).data;
  const feed = ov.activity || ov.activities || ov.feed || [];
  ok('Phụ huynh: hoạt động nộp bài có cờ by_teacher', JSON.stringify(ov).includes('"by_teacher":true'), Object.keys(ov).join(','));

  // 4. Bài đã quá hạn vẫn nộp hộ được (bài thu trên lớp)
  const pastHw = (await req('GET', `/homework/${past.id}`, { token: tt })).data;
  r = await req('POST', `/homework/${past.id}/students/${pastHw.roster[0].student_id}/submit`, { token: tt, form: form(1) });
  ok('Bài đã quá hạn: giáo viên vẫn nộp hộ được', r.status === 200, JSON.stringify(r.data).slice(0, 120));
  ok('Nộp lại hộ: số lần nộp tăng thêm 1', r.data.submission?.submit_count === (pastHw.roster[0].submit_count || 0) + 1, r.data.submission?.submit_count);

  // 5. Chặn sai quyền / sai dữ liệu
  r = await req('POST', `/homework/${open.id}/students/${target.student_id}/submit`, { token: st, form: form(1) });
  ok('Học sinh không gọi được API nộp hộ (403)', r.status === 403, r.status);
  r = await req('POST', `/homework/${open.id}/students/${other9.id}/submit`, { token: tt, form: form(1) });
  ok('Học sinh lớp khác → 400', r.status === 400, `${r.status} ${JSON.stringify(r.data)}`);
  r = await req('POST', `/homework/${open.id}/students/${target.student_id}/submit`, { token: tt, form: new FormData() });
  ok('Không có file → 400', r.status === 400, r.status);
  r = await req('POST', `/homework/${open.id}/students/${target.student_id}/submit`, { token: admin, form: form(1) });
  ok('Admin nộp hộ được', r.status === 200, r.status);
  // Giáo viên khác (không dạy lớp) → 403
  const uname = `gvkhac${Date.now() % 100000}`;
  await req('POST', '/admin/users', { token: admin, json: { username: uname, password: '123456', full_name: 'GV khác', role: 'teacher' } });
  const other = await login(uname, '123456', 'teacher');
  r = await req('POST', `/homework/${open.id}/students/${target.student_id}/submit`, { token: other, form: form(1) });
  ok('Giáo viên không dạy lớp → 403', r.status === 403, r.status);

  // 6. Học sinh tự nộp vẫn bị chặn khi quá hạn (không ảnh hưởng luồng cũ)
  const st2 = await login(pastHw.roster[1].username, '123456', 'student');
  r = await req('POST', `/homework/${past.id}/submit`, { token: st2, form: form(1) });
  ok('Học sinh tự nộp bài quá hạn vẫn bị chặn (400)', r.status === 400 && /quá hạn/.test(r.data.message), `${r.status} ${r.data.message}`);
  r = await req('POST', `/homework/${open.id}/submit`, { token: st2, form: form(1) });
  ok('Học sinh tự nộp bài còn hạn vẫn được (submitted_by trống)', r.status === 200 && r.data.submission?.submitted_by == null, `${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);

  console.log(`\n═══ ${pass + fail} test | ✅ ${pass} PASS | ❌ ${fail} FAIL ═══\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
