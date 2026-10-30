// Số liệu cho trang PHỤ HUYNH: tiến độ, điểm, thứ hạng, nhận xét, thông báo hoạt động của con.
// Cùng quy tắc với xếp hạng lớp (services/classRanking): tính theo THÁNG (hạn nộp, không có hạn thì ngày tạo),
// bài quá hạn chưa có điểm = 0, nộp nhiều lần lấy điểm cao nhất. Nhận xét + chi tiết từng câu chỉ hiện từ
// "Thời gian xem đáp án" (giống học sinh) để con không lấy được đáp án sớm qua tài khoản phụ huynh.
const { classRanking, classMonths, ymOf, isOverdue } = require('./classRanking');
const { parseBest } = require('./bestAttempt');

const round1 = (n) => Math.round(n * 10) / 10;
// "12A1" → "lớp 12A1"; tên đã có chữ "Lớp" ("Lớp 6 — Kiểm tra HK2") thì giữ nguyên, tránh "lớp Lớp 6"
const classLabel = (t) => (/^lớp/i.test(String(t || '').trim()) ? t : `lớp ${t}`);
const DAY = 86400000;

// CURRENT_TIMESTAMP của SQLite ("YYYY-MM-DD HH:MM:SS", giờ UTC) → ISO để so sánh cùng kiểu với các mốc khác
const sqliteToIso = (v) => {
  const str = String(v);
  const d = new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Tất cả bài tập của con ở các lớp đang hoạt động (classId: chỉ 1 lớp), kèm trạng thái và điểm hiệu lực.
function childHomework(db, studentId, nowIso, classId) {
  const rows = db.prepare(`
    SELECT h.id, h.class_id, h.title, h.due_date, h.created_at, h.answer_visible_date, h.max_score, h.exam_type,
           h.pdf_file, h.answer_file, h.solution_video_url, cl.title class_title,
           s.id submission_id, s.submitted_at, s.graded_at, s.score, s.feedback, s.grading_details, s.grading_status,
           s.graded_by_ai, s.submit_count, s.files, s.file_path, s.best_attempt, s.submitted_by
    FROM homework h JOIN classes cl ON cl.id=h.class_id AND cl.active=1
    JOIN class_students cs ON cs.class_id=cl.id AND cs.student_id=?
    LEFT JOIN submissions s ON s.homework_id=h.id AND s.student_id=?
    ${classId ? 'WHERE h.class_id=?' : ''}
  `).all(studentId, studentId, ...(classId ? [classId] : []));

  return rows.map((r) => {
    // Lần nộp mới đang chờ chấm → tạm lấy kết quả lần có điểm cao nhất trước đó
    const best = r.score === null ? parseBest(r.best_attempt) : null;
    const score = best ? best.score : r.score;
    const feedback = best ? best.feedback : r.feedback;
    const details = best ? best.grading_details : r.grading_details;
    const gradedAt = best ? best.graded_at : r.graded_at;
    const max = r.max_score > 0 ? r.max_score : 10;
    const submitted = !!r.submission_id;
    const overdue = isOverdue(r.due_date, nowIso);
    const status = score !== null && score !== undefined ? 'graded'
      : submitted ? (['pending', 'grading'].includes(r.grading_status) ? 'grading' : 'waiting')
        : overdue ? 'missed' : 'todo';
    const canSee = !!r.answer_visible_date && nowIso >= r.answer_visible_date;
    let files = [];
    try { files = r.files ? JSON.parse(r.files) : (r.file_path ? [r.file_path] : []); } catch { files = r.file_path ? [r.file_path] : []; }
    return {
      id: r.id, class_id: r.class_id, class_title: r.class_title, title: r.title, exam_type: r.exam_type,
      due_date: r.due_date, created_at: r.created_at, answer_visible_date: r.answer_visible_date, max_score: max,
      pdf_file: r.pdf_file, answer_file: canSee ? r.answer_file : null, solution_video_url: canSee ? r.solution_video_url : null,
      status, submitted_at: r.submitted_at, graded_at: gradedAt, submit_count: r.submit_count || 0,
      graded_by_ai: !!r.graded_by_ai, files: submitted ? files : [], by_teacher: !!r.submitted_by,
      score: score ?? null, score10: score !== null && score !== undefined ? round1(Math.max(0, Math.min(1, score / max)) * 10) : null,
      can_see_feedback: canSee,
      feedback: canSee ? feedback : null,
      grading_details: canSee ? details : null,
      month: ymOf(r.due_date || r.created_at),
      _details: details, // dùng nội bộ để tổng hợp điểm mạnh/yếu (không gửi ra ngoài)
      _ratio: score !== null && score !== undefined ? Math.max(0, Math.min(1, score / max)) : null, // chưa làm tròn → TB khớp xếp hạng
    };
  });
}

// Điểm TB (thang 10) của 1 tháng theo đúng quy tắc xếp hạng: có điểm → tỉ lệ; quá hạn chưa có điểm → 0.
function monthAverage(hws, ym, nowIso) {
  let sum = 0, counted = 0;
  for (const h of hws) {
    if (h.month !== ym) continue;
    if (h._ratio !== null) { sum += h._ratio; counted++; }
    else if (isOverdue(h.due_date, nowIso)) counted++;
  }
  return counted ? round1((sum / counted) * 10) : null;
}

const prevYm = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

// Điểm TB của cả lớp cho từng bài (thang 10, chỉ tính bài đã có điểm) — để phụ huynh so con với mặt bằng lớp.
function classAvgByHomework(db, classIds) {
  if (!classIds.length) return new Map();
  const rows = db.prepare(`
    SELECT s.homework_id, COALESCE(s.score, s.best_score) score, h.max_score
    FROM submissions s JOIN homework h ON h.id=s.homework_id
    WHERE h.class_id IN (${classIds.map(() => '?').join(',')}) AND COALESCE(s.score, s.best_score) IS NOT NULL
  `).all(...classIds);
  const acc = new Map();
  rows.forEach((r) => {
    const max = r.max_score > 0 ? r.max_score : 10;
    const a = acc.get(r.homework_id) || { sum: 0, n: 0 };
    a.sum += Math.max(0, Math.min(1, r.score / max)) * 10; a.n++;
    acc.set(r.homework_id, a);
  });
  return new Map([...acc].map(([k, a]) => [k, round1(a.sum / a.n)]));
}

// Phần của đề mà 1 câu thuộc về (đọc từ tên câu AI/giáo viên ghi)
function partOf(question) {
  const q = String(question || '');
  if (/^(tn\b|trắc nghiệm)/i.test(q)) return 'Trắc nghiệm';
  if (/đúng\s*\/\s*sai|^đs\b/i.test(q)) return 'Đúng/Sai';
  if (/trả lời ngắn|^tln\b/i.test(q)) return 'Trả lời ngắn';
  return 'Tự luận';
}

const NOT_DONE_RE = /không làm|chưa làm|bỏ trống|để trống|bỏ qua/i;
const MISSING_STEP_RE = /thiếu|sơ sài|chưa đầy đủ|chưa chặt chẽ/i;
const CALC_RE = /tính (toán )?sai|sai dấu|nhầm|tính nhầm/i;

// Tổng hợp điểm mạnh / điểm cần cải thiện từ chi tiết chấm các bài gần đây (chỉ bài đã mở nhận xét).
function strengthsAndIssues(hws) {
  const parts = new Map();
  let notDone = 0, missingStep = 0, calc = 0;
  hws.filter((h) => h.can_see_feedback && h._details).forEach((h) => {
    let details = [];
    try { details = typeof h._details === 'string' ? JSON.parse(h._details) : h._details; } catch { /* bỏ qua */ }
    (Array.isArray(details) ? details : []).forEach((d) => {
      const p = partOf(d.question);
      const ratio = d.max_points > 0 && typeof d.points === 'number' ? d.points / d.max_points
        : d.status === 'correct' ? 1 : d.status === 'partial' ? 0.5 : 0;
      const a = parts.get(p) || { sum: 0, n: 0 };
      a.sum += ratio; a.n++; parts.set(p, a);
      if (d.status !== 'correct') {
        const c = String(d.comment || '');
        if (NOT_DONE_RE.test(c)) notDone++;
        else if (MISSING_STEP_RE.test(c)) missingStep++;
        else if (CALC_RE.test(c)) calc++;
      }
    });
  });
  const strengths = [], issues = [];
  for (const [p, a] of parts) {
    if (a.n < 3) continue;
    const r = a.sum / a.n;
    if (r >= 0.8) strengths.push(`làm tốt phần ${p} (đúng ${Math.round(r * 100)}%)`);
    else if (r < 0.6) issues.push(`phần ${p} còn mất nhiều điểm (đúng ${Math.round(r * 100)}%)`);
  }
  if (notDone >= 2) issues.push(`còn bỏ trống ${notDone} câu`);
  if (missingStep >= 2) issues.push('trình bày lời giải còn thiếu bước');
  if (calc >= 2) issues.push('hay tính toán nhầm / sai dấu');
  return { strengths, issues };
}

// Nhận xét tổng quát tự động (tiếng Việt, vài câu ngắn) từ số liệu của con.
function buildSummary({ name, month, prevAvg, classes, strengths, issues }) {
  const s = [];
  const mm = Number(month.ym.split('-')[1]);
  if (month.due === 0) s.push(`Tháng ${mm} chưa có bài tập nào đến hạn.`);
  else {
    s.push(`Tháng ${mm}, ${name} đã nộp ${month.submitted_due}/${month.due} bài đến hạn${month.missed ? ` (${month.missed} bài không nộp bị tính 0 điểm)` : ' — đầy đủ, đúng hạn'}.`);
  }
  if (month.avg !== null) {
    const trend = prevAvg === null ? '' : month.avg > prevAvg ? `, tăng ${round1(month.avg - prevAvg)} so với tháng trước` : month.avg < prevAvg ? `, giảm ${round1(prevAvg - month.avg)} so với tháng trước` : ', giữ nguyên so với tháng trước';
    const level = month.avg >= 8 ? 'Kết quả tốt' : month.avg >= 6.5 ? 'Kết quả khá' : month.avg >= 5 ? 'Kết quả trung bình' : 'Kết quả cần cố gắng nhiều hơn';
    s.push(`${level}: điểm trung bình ${String(month.avg).replace('.', ',')}/10${trend}.`);
  }
  const ranked = classes.filter((c) => c.my_rank);
  if (ranked.length) s.push(`Thứ hạng tháng này: ${ranked.map((c) => `hạng ${c.my_rank}/${c.rank_total} ${classLabel(c.title)}`).join('; ')}.`);
  if (strengths.length) s.push(`Điểm mạnh: ${strengths.join(', ')}.`);
  if (issues.length) s.push(`Cần chú ý: ${issues.join('; ')}.`);
  return s;
}

// Thông báo hoạt động: con nộp bài, bài có điểm, bài lỡ hạn, bài mới được giao (30 ngày gần nhất).
function activityFeed(hws, nowIso, seenAt) {
  const since = new Date(Date.parse(nowIso) - 30 * DAY).toISOString();
  // Chưa từng mở thông báo → coi các hoạt động trong 3 ngày gần nhất là "mới"
  const newSince = seenAt || new Date(Date.parse(nowIso) - 3 * DAY).toISOString();
  const ev = [];
  for (const h of hws) {
    const base = { homework_id: h.id, class_id: h.class_id, class_title: h.class_title, title: h.title };
    if (h.created_at) ev.push({ ...base, type: 'assigned', at: sqliteToIso(h.created_at), due_date: h.due_date });
    if (h.submitted_at) ev.push({ ...base, type: 'submitted', at: h.submitted_at, submit_count: h.submit_count, by_teacher: h.by_teacher });
    if (h.status === 'graded' && h.graded_at) ev.push({ ...base, type: 'graded', at: h.graded_at, score: h.score, max_score: h.max_score, score10: h.score10 });
    if (h.status === 'missed') ev.push({ ...base, type: 'missed', at: h.due_date });
  }
  const list = ev.filter((e) => e.at && e.at >= since && e.at <= nowIso)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 40)
    .map((e) => ({ ...e, is_new: e.at > newSince }));
  return { list, unread: list.filter((e) => e.is_new).length };
}

// Điểm TB + hạng tháng hiện tại của con trong mỗi lớp
function childClasses(db, studentId) {
  return db.prepare(`
    SELECT cl.id, cl.title, co.title course_title, u.full_name teacher_name,
      (SELECT COUNT(*) FROM homework h WHERE h.class_id=cl.id) homework_count,
      (SELECT COUNT(*) FROM submissions s JOIN homework h2 ON s.homework_id=h2.id WHERE h2.class_id=cl.id AND s.student_id=?) submitted_count
    FROM class_students cs JOIN classes cl ON cs.class_id=cl.id
    LEFT JOIN courses co ON cl.course_id=co.id LEFT JOIN users u ON cl.teacher_id=u.id
    WHERE cs.student_id=? AND cl.active=1 ORDER BY cl.created_at DESC
  `).all(studentId, studentId).map((c) => {
    const ranking = classRanking(db, c.id);
    const mine = ranking.get(studentId) || {};
    const avgs = [...ranking.values()].map((v) => v.avg).filter((v) => v !== null);
    return {
      ...c, my_avg: mine.avg ?? null, my_rank: mine.rank ?? null, rank_total: mine.total ?? 0,
      class_avg: avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null,
    };
  });
}

const strip = (h) => { const { _details, _ratio, ...rest } = h; return rest; }; // eslint-disable-line no-unused-vars

// Toàn bộ số liệu trang Tổng quan phụ huynh cho 1 con.
function childOverview(db, student, parent) {
  const now = new Date().toISOString();
  const ym = ymOf(now);
  const hws = childHomework(db, student.id, now);
  const classes = childClasses(db, student.id);
  const clsAvg = classAvgByHomework(db, classes.map((c) => c.id));

  const inMonth = hws.filter((h) => h.month === ym);
  const dueSoFar = inMonth.filter((h) => isOverdue(h.due_date, now) || h.status !== 'todo');
  const month = {
    ym,
    avg: monthAverage(hws, ym, now),
    due: dueSoFar.length,
    submitted_due: dueSoFar.filter((h) => h.status !== 'missed').length,
    missed: inMonth.filter((h) => h.status === 'missed').length,
    graded: inMonth.filter((h) => h.status === 'graded').length,
    waiting: hws.filter((h) => h.status === 'grading' || h.status === 'waiting').length,
  };
  const prevAvg = monthAverage(hws, prevYm(ym), now);

  // Bài sắp đến hạn con CHƯA nộp (gần nhất trước); bài không đặt hạn xếp cuối
  const upcoming = hws.filter((h) => h.status === 'todo')
    .sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1)
    .slice(0, 12).map(strip);

  // Cần chú ý: lỡ hạn (14 ngày), sắp hết hạn trong 48 giờ mà chưa nộp, điểm thấp gần đây (< 5)
  const t = Date.parse(now);
  const attention = [
    ...hws.filter((h) => h.status === 'missed' && t - Date.parse(h.due_date) <= 14 * DAY)
      .map((h) => ({ type: 'missed', homework_id: h.id, class_id: h.class_id, class_title: h.class_title, title: h.title, at: h.due_date })),
    ...hws.filter((h) => h.status === 'todo' && h.due_date && Date.parse(h.due_date) - t <= 2 * DAY)
      .map((h) => ({ type: 'due_soon', homework_id: h.id, class_id: h.class_id, class_title: h.class_title, title: h.title, at: h.due_date })),
    ...hws.filter((h) => h.status === 'graded' && h.score10 < 5 && h.graded_at && t - Date.parse(h.graded_at) <= 14 * DAY)
      .map((h) => ({ type: 'low_score', homework_id: h.id, class_id: h.class_id, class_title: h.class_title, title: h.title, at: h.graded_at, score: h.score, max_score: h.max_score })),
  ];

  // Biểu đồ: 12 bài có điểm gần nhất (theo hạn nộp / lúc nộp), so với điểm TB lớp của bài đó
  const graded = hws.filter((h) => h.status === 'graded');
  const when = (h) => h.due_date || h.submitted_at || h.created_at || '';
  const trend = graded.sort((a, b) => (when(a) < when(b) ? -1 : 1)).slice(-12)
    .map((h) => ({ homework_id: h.id, title: h.title, class_title: h.class_title, at: when(h), score10: h.score10, class_avg10: clsAvg.get(h.id) ?? null }));

  // Điểm TB 6 tháng gần nhất có bài tập
  const months = [...new Set(hws.map((h) => h.month).filter(Boolean))].filter((m) => m <= ym).sort().slice(-6);
  const monthly = months.map((m) => ({
    month: m, avg: monthAverage(hws, m, now),
    ranks: classes.map((c) => { const r = classRanking(db, c.id, null, m).get(student.id) || {}; return { class_id: c.id, class_title: c.title, rank: r.rank ?? null, total: r.total ?? 0 }; }),
  }));

  // Phân bố điểm các bài đã chấm (thang 10)
  const bands = { gioi: 0, kha: 0, tb: 0, yeu: 0 };
  graded.forEach((h) => { const s = h.score10; if (s >= 8) bands.gioi++; else if (s >= 6.5) bands.kha++; else if (s >= 5) bands.tb++; else bands.yeu++; });

  // Nhận xét gần đây của thầy cô / AI (bài đã mở nhận xét)
  const recentFeedback = hws.filter((h) => h.status === 'graded' && h.feedback)
    .sort((a, b) => ((a.graded_at || '') < (b.graded_at || '') ? 1 : -1)).slice(0, 5)
    .map(({ id, class_id, class_title, title, score, max_score, score10, feedback, graded_at }) => ({ id, class_id, class_title, title, score, max_score, score10, feedback, graded_at }));

  const recent60 = hws.filter((h) => h.graded_at && t - Date.parse(h.graded_at) <= 60 * DAY);
  const { strengths, issues } = strengthsAndIssues(recent60);
  const summary = buildSummary({ name: 'con', month, prevAvg, classes, strengths, issues });
  const teacherComments = teacherCommentsFor(db, student.id);

  const activity = activityFeed(hws, now, parent.notif_seen_at);

  return {
    student: { id: student.id, full_name: student.full_name, username: student.username },
    month: { ...month, prev_avg: prevAvg }, classes, attention, upcoming, trend, monthly, bands,
    summary, strengths, issues, teacher_comments: teacherComments, recent_feedback: recentFeedback,
    activity: activity.list, unread: activity.unread,
  };
}

function teacherCommentsFor(db, studentId, classId) {
  return db.prepare(`
    SELECT sc.class_id, cl.title class_title, sc.comment, sc.updated_at, u.full_name author
    FROM student_comments sc JOIN classes cl ON cl.id=sc.class_id AND cl.active=1
    LEFT JOIN users u ON u.id=sc.updated_by
    WHERE sc.student_id=? ${classId ? 'AND sc.class_id=?' : ''} ORDER BY sc.updated_at DESC
  `).all(studentId, ...(classId ? [classId] : [])).map((c) => ({ ...c, updated_at: sqliteToIso(c.updated_at) }));
}

// Chi tiết 1 lớp của con: hạng + điểm TB các tháng, toàn bộ bài tập với điểm/nhận xét, liên hệ thầy cô.
function childClassDetail(db, student, classId) {
  const now = new Date().toISOString();
  const cls = db.prepare(`
    SELECT cl.id, cl.title, cl.description, co.title course_title, u.full_name teacher_name
    FROM classes cl LEFT JOIN courses co ON cl.course_id=co.id LEFT JOIN users u ON cl.teacher_id=u.id
    WHERE cl.id=? AND cl.active=1
  `).get(classId);
  if (!cls) return null;
  const hws = childHomework(db, student.id, now, classId);
  const clsAvg = classAvgByHomework(db, [Number(classId)]);
  const summary = childClasses(db, student.id).find((c) => c.id === Number(classId)) || {};

  const history = classMonths(db, classId).slice(0, 6).map((m) => {
    const ranking = classRanking(db, classId, null, m);
    const mine = ranking.get(student.id) || {};
    const avgs = [...ranking.values()].map((v) => v.avg).filter((v) => v !== null);
    return { month: m, avg: mine.avg ?? null, rank: mine.rank ?? null, total: mine.total ?? 0, class_avg: avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null };
  });

  const order = (h) => h.due_date || h.created_at || '';
  const homework = hws.sort((a, b) => (order(a) < order(b) ? 1 : -1)).map((h) => ({ ...strip(h), class_avg10: clsAvg.get(h.id) ?? null }));
  // SĐT liên hệ cho phụ huynh: admin đặt ở "Nội dung trang"; chưa đặt thì dùng SĐT liên hệ chung của trang
  const setting = (k) => (db.prepare('SELECT value FROM site_settings WHERE key=?').get(k)?.value || '').trim();
  const contact_phone = setting('parent_contact_phone') || setting('contact_phone');

  return {
    ...cls, my_avg: summary.my_avg ?? null, my_rank: summary.my_rank ?? null, rank_total: summary.rank_total ?? 0,
    class_avg: summary.class_avg ?? null, history, homework, contact_phone,
    teacher_comment: teacherCommentsFor(db, student.id, classId)[0] || null,
    student: { id: student.id, full_name: student.full_name },
  };
}

module.exports = { childOverview, childClassDetail, childClasses, activityFeed, childHomework };
