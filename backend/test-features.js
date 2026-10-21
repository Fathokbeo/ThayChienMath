/**
 * Test các tính năng mới: nộp nhiều lần lấy điểm CAO NHẤT, dữ liệu tab "Bài tập cần làm",
 * file đề/đáp án (tên gốc, thay, xóa), xếp hạng lớp cho học sinh, chặn người ngoài lớp.
 * Tự tạo dữ liệu riêng nên chạy lại được nhiều lần.
 * Run: node test-features.js   (server phải chạy trên :5100, hoặc đặt API_BASE)
 */
const fs = require('fs');
const path = require('path');
const BASE = process.env.API_BASE || 'http://localhost:5100/api';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? `  → ${extra}` : ''}`); };
async function req(method, url, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const r = await fetch(BASE + url, { method, headers, body });
  const t = await r.text(); let data; try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, ok: r.ok, data };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fd = (obj) => { const f = new FormData(); Object.entries(obj).forEach(([k, v]) => f.append(k, v)); return f; };
const pdf = (name) => new File([Buffer.from('%PDF-1.4 x')], name, { type: 'application/pdf' });
const HW_DIR = path.join(__dirname, 'uploads/homework');
const login = async (u, p) => (await req('POST', '/auth/login', { json: { username: u, password: p } })).data;

(async () => {
  console.log('\n═══ TEST TÍNH NĂNG MỚI (điểm cao nhất, bài cần làm, file bài tập, xếp hạng) ═══\n');
  const admin = (await login('admin', 'admin123')).token;
  const u = 'tf' + Date.now();
  await req('POST', '/admin/users', { token: admin, json: { username: u, password: '123456', full_name: 'GV Test', role: 'teacher' } });
  const tt = (await login(u, '123456')).token;
  const course = (await req('POST', '/teacher/courses', { token: tt, json: { title: 'K' } })).data.id;
  const cls = (await req('POST', `/teacher/courses/${course}/classes`, { token: tt, json: { title: 'L' } })).data.id;
  const mkStudent = async (suffix, name) => {
    const id = (await req('POST', '/teacher/students', { token: tt, json: { username: `${u}${suffix}`, password: '123456', full_name: name } })).data.id;
    await req('POST', `/teacher/classes/${cls}/students`, { token: tt, json: { student_id: id } });
    return { id, token: (await login(`${u}${suffix}`, '123456')).token };
  };
  const A = await mkStudent('a', 'Nguyễn Văn An');
  const B = await mkStudent('b', 'Trần Thị Bình');
  const st = A.token;

  // ── 1. Tab "Bài tập cần làm" + nộp nhiều lần lấy điểm cao nhất ──
  console.log('── 1. Bài tập cần làm & điểm cao nhất ──');
  const future = new Date(Date.now() + 86400000).toISOString();
  const parts = JSON.stringify({ multiple_choice: { enabled: true, count: 4, answers: ['A', 'B', 'C', 'D'], points: [1, 1, 1, 1] } });
  const hw = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'TN', max_score: '10', due_date: future, parts_config: parts }) })).data.id;
  const hwManual = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Tự luận tay', max_score: '10', due_date: future }) })).data.id;
  await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Không hạn', max_score: '10' }) });

  let c = (await req('GET', `/student/my-classes/${cls}`, { token: st })).data;
  const todo = () => c.homework.filter((h) => h.due_date && h.can_submit && !h.submission_id).map((h) => h.title);
  ok('Bài cần làm ban đầu = 2 bài có hạn', JSON.stringify(todo()) === JSON.stringify(['TN', 'Tự luận tay']), JSON.stringify(todo()));

  const submit = (id, mc) => req('POST', `/homework/${id}/submit`, { token: st, form: fd({ structured_answers: JSON.stringify({ multiple_choice: mc, true_false: [], short_answer: [] }) }) });
  const scoreOf = async (id) => {
    for (let i = 0; i < 40; i++) {
      const s = (await req('GET', `/homework/${id}`, { token: tt })).data.roster.find((x) => x.student_id === A.id);
      if (s.grading_status === 'done' || s.grading_status === null) return s;
      await sleep(300);
    }
  };
  await submit(hw, ['A', 'B', 'C', 'X']);
  ok('Lần 1 = 7,5', (await scoreOf(hw)).score === 7.5);
  await submit(hw, ['A', 'X', 'X', 'X']);
  let s = await scoreOf(hw);
  ok('Lần 2 thấp hơn → giữ 7,5', s.score === 7.5, `score=${s.score}`);
  const sa = JSON.parse(s.structured_answers);
  ok('Bài làm khôi phục về lần 1', sa.multiple_choice[3] === 'X' && sa.multiple_choice[1] === 'B');
  ok('Đếm 2 lần nộp', s.submit_count === 2);
  await submit(hw, ['A', 'B', 'C', 'D']);
  s = await scoreOf(hw);
  ok('Lần 3 cao hơn → 10', s.score === 10, `score=${s.score}`);
  ok('Dọn sạch bản lưu lần cũ', s.best_score === null);

  const essay = (id) => { const f = new FormData(); f.append('files', new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' }), 'bai.pdf'); return req('POST', `/homework/${id}/submit`, { token: st, form: f }); };
  let r = await essay(hwManual);
  const subId = r.data.submission.id;
  await req('PUT', `/submissions/${subId}/grade`, { token: tt, json: { score: 8, feedback: 'Tốt' } });
  await essay(hwManual);
  c = (await req('GET', `/student/my-classes/${cls}`, { token: st })).data;
  const h = c.homework.find((x) => x.id === hwManual);
  ok('Lần mới chờ chấm → HS vẫn thấy điểm 8', h.score === 8 && h.showing_best === true, `score=${h.score}`);
  ok('Không lộ dữ liệu nội bộ ra học sinh', !('best_attempt' in h));
  r = await req('PUT', `/submissions/${subId}/grade`, { token: tt, json: { score: 5, feedback: 'Kém' } });
  ok('GV chấm 5 < 8 → báo giữ lần trước', /cao hơn/.test(r.data.message), r.data.message);
  s = (await req('GET', `/homework/${hwManual}`, { token: tt })).data.roster.find((x) => x.student_id === A.id);
  ok('Điểm chính thức = 8, nhận xét lần cũ', s.score === 8 && s.feedback === 'Tốt', `score=${s.score}`);
  c = (await req('GET', `/student/my-classes/${cls}`, { token: st })).data;
  ok('Bài cần làm sau khi nộp hết = 0', todo().length === 0, JSON.stringify(todo()));

  // ── 2. File đề / đáp án bài tập ──
  console.log('\n── 2. File đề / đáp án bài tập ──');
  let f = new FormData(); f.append('title', 'BT file'); f.append('pdf_file', pdf('ĐỀ HÌNH HỌC_CHƯƠNG II.pdf')); f.append('answer_file', pdf('ĐÁP ÁN BTVN.pdf'));
  const hwF = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: f })).data.id;
  const findHw = async () => (await req('GET', `/teacher/classes/${cls}`, { token: tt })).data.homework.find((x) => x.id === hwF);
  let hf = await findHw();
  ok('Lưu đúng tên file tiếng Việt', hf.pdf_name === 'ĐỀ HÌNH HỌC_CHƯƠNG II.pdf' && hf.answer_name === 'ĐÁP ÁN BTVN.pdf', `${hf.pdf_name} | ${hf.answer_name}`);
  const oldPdf = hf.pdf_file;
  f = new FormData(); f.append('pdf_file', pdf('Đề mới.pdf'));
  await req('PUT', `/homework/${hwF}`, { token: tt, form: f });
  hf = await findHw();
  ok('Thay file đề: tên mới + xóa file cũ', hf.pdf_name === 'Đề mới.pdf' && !fs.existsSync(path.join(HW_DIR, oldPdf)) && fs.existsSync(path.join(HW_DIR, hf.pdf_file)));
  const ans = hf.answer_file;
  r = await req('DELETE', `/homework/${hwF}/files/answer`, { token: tt });
  hf = await findHw();
  ok('Xóa file đáp án', r.ok && hf.answer_file === null && hf.answer_name === null && !fs.existsSync(path.join(HW_DIR, ans)));
  ok('File đề vẫn còn', !!hf.pdf_file);
  r = await req('DELETE', `/homework/${hwF}/files/abc`, { token: tt });
  ok('Loại file sai → 400', r.status === 400);
  r = await req('DELETE', `/homework/${hwF}/files/pdf`, { token: st });
  ok('Học sinh không được xóa file (403)', r.status === 403);

  // ── 3. Xếp hạng lớp cho học sinh ──
  console.log('\n── 3. Xếp hạng lớp cho học sinh ──');
  r = await req('GET', `/student/my-classes/${cls}/ranking`, { token: st });
  ok('HS xem được bảng xếp hạng lớp', r.status === 200 && r.data.students.length === 2, `status=${r.status}`);
  ok('Ẩn tên đăng nhập các bạn', r.data.students.every((x) => !('username' in x)));
  const me = r.data.students.filter((x) => x.is_me);
  ok('Đánh dấu đúng 1 dòng của mình', me.length === 1 && me[0].id === A.id);
  ok('Người có điểm đứng hạng 1', r.data.students[0].id === A.id && r.data.students[0].rank === 1, `top=${r.data.students[0].full_name}`);
  r = await req('GET', `/student/my-classes/${cls}/ranking?month=2020-01`, { token: st });
  ok('Xem lại tháng khác', r.status === 200 && r.data.month === '2020-01');
  await req('POST', '/admin/users', { token: admin, json: { username: `${u}out`, password: '123456', full_name: 'Ngoài lớp', role: 'student' } });
  const out = (await login(`${u}out`, '123456')).token;
  r = await req('GET', `/student/my-classes/${cls}/ranking`, { token: out });
  ok('HS ngoài lớp bị chặn (403)', r.status === 403);
  r = await req('GET', `/teacher/classes/${cls}/ranking`, { token: tt });
  ok('GV vẫn thấy tên đăng nhập', r.status === 200 && r.data.students.every((x) => 'username' in x));

  // ── 4. Tổng quan thông minh (việc cần làm / bài cần chấm) ──
  console.log('\n── 4. Tổng quan thông minh ──');
  const hwNew = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Bài mới tuần này', max_score: '10', due_date: future }) })).data.id;
  r = await req('GET', '/student/overview', { token: B.token });
  ok('HS chưa nộp thấy bài trong "Việc cần làm"', r.status === 200 && r.data.todo.some((x) => x.id === hwNew), JSON.stringify(r.data.todo.map((x) => x.title)));
  ok('Việc cần làm sắp theo hạn gần nhất', r.data.todo.every((x, i, a) => i === 0 || a[i - 1].due_date <= x.due_date));
  ok('Có tình hình từng lớp', r.data.classes.length === 1 && r.data.classes[0].id === cls);
  r = await req('GET', '/student/overview', { token: st });
  ok('HS đã nộp hết → không còn bài cũ trong việc cần làm', !r.data.todo.some((x) => x.id === hw || x.id === hwManual));
  ok('Kết quả mới có điểm bài TN = 10', r.data.recent.some((x) => x.homework_id === hw && x.score === 10));
  const f2 = new FormData(); f2.append('files', new Blob([Buffer.from('%PDF-1.4 b')], { type: 'application/pdf' }), 'b.pdf');
  await req('POST', `/homework/${hwNew}/submit`, { token: B.token, form: f2 });
  r = await req('GET', '/teacher/overview', { token: tt });
  ok('GV thấy bài cần chấm tay', r.status === 200 && r.data.to_grade.some((x) => x.homework_id === hwNew), JSON.stringify(r.data.to_grade.map((x) => x.homework_title)));
  const up = r.data.upcoming.find((x) => x.id === hwNew);
  ok('Hạn sắp tới kèm số đã nộp / sĩ số', up && up.submitted === 1 && up.total === 2, JSON.stringify(up));
  // "Hôm nay": bài hạn trong ngày (đã qua giờ + sắp tới); bài từ ngày mai không lẫn vào
  const t0 = Date.now();
  const dayQ = `?from=${new Date(t0 - 3 * 3600e3).toISOString()}&to=${new Date(t0 + 3 * 3600e3).toISOString()}`;
  const hwSoon = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Hạn trong 1 giờ', max_score: '10', due_date: new Date(t0 + 3600e3).toISOString() }) })).data.id;
  const hwPassed = (await req('POST', `/classes/${cls}/homework`, { token: tt, form: fd({ title: 'Vừa hết hạn sáng nay', max_score: '10', due_date: new Date(t0 - 3600e3).toISOString() }) })).data.id;
  const rd = await req('GET', '/teacher/overview' + dayQ, { token: tt });
  ok('Hôm nay có bài sắp đến hạn trong ngày', rd.data.today.some((x) => x.id === hwSoon), JSON.stringify(rd.data.today.map((x) => x.title)));
  ok('Hôm nay có bài đã hết hạn trong ngày', rd.data.today.some((x) => x.id === hwPassed));
  ok('Bài hạn ngày mai không nằm trong Hôm nay', !rd.data.today.some((x) => x.id === hwNew));
  ok('Sắp đến hạn chỉ còn bài sau hôm nay', rd.data.upcoming.some((x) => x.id === hwNew) && !rd.data.upcoming.some((x) => x.id === hwSoon));
  const cRow = r.data.classes.find((x) => x.id === cls);
  ok('Danh sách lớp kèm sĩ số / số bài / bài chờ chấm', cRow && cRow.student_count === 2 && cRow.homework_count >= 4 && cRow.to_grade === 1, JSON.stringify(cRow));
  void hwPassed;
  ok('Có điểm TB lớp tháng này', cRow && typeof cRow.class_avg === 'number', `class_avg=${cRow?.class_avg}`);
  r = await req('GET', '/teacher/overview', { token: out });
  ok('Học sinh không gọi được tổng quan giáo viên (403)', r.status === 403);

  // ── 5. Tìm nhanh: bài giảng & bài tập ──
  console.log('\n── 5. Tìm nhanh bài giảng & bài tập ──');
  const lessonId = (await req('POST', `/teacher/classes/${cls}/lessons`, { token: tt, json: { title: 'Bài giảng: Cực trị hàm số' } })).id;
  r = await req('GET', '/student/search-index', { token: st });
  ok('HS tìm được bài giảng trong lớp', r.status === 200 && r.data.lessons.some((x) => x.title === 'Bài giảng: Cực trị hàm số' && x.class_id === cls));
  ok('HS tìm được bài tập trong lớp', r.data.homework.some((x) => x.id === hw && x.class_title === 'L'));
  r = await req('GET', '/student/search-index', { token: out });
  ok('HS ngoài lớp không thấy bài của lớp', r.status === 200 && !r.data.lessons.some((x) => x.class_id === cls) && !r.data.homework.some((x) => x.class_id === cls));
  r = await req('GET', '/teacher/search-index', { token: tt });
  ok('GV tìm được bài giảng & bài tập lớp mình', r.status === 200 && r.data.lessons.length >= 1 && r.data.homework.some((x) => x.id === hwNew));
  void lessonId;

  console.log(`\n═══ ${pass + fail} test | ✅ ${pass} PASS | ❌ ${fail} FAIL ═══\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
