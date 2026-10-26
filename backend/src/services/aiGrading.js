const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { parsePartsConfig, partEnabled, describeAnswerKey, describeStudentAnswers } = require('./homeworkParts');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

function fileToBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}

function buildInlinePart(filePath) {
  return {
    inlineData: {
      data: fileToBase64(filePath),
      mimeType: getMimeType(filePath),
    },
  };
}

// Free tier: các model Flash "xịn" chỉ có 20 request/NGÀY mỗi model (5 req/phút),
// còn Flash Lite 3.x có tới 500 request/ngày (15 req/phút). Gemini Pro free tier = 0, không dùng được.
// Lượt chấm chính dùng Flash xịn (chính xác nhất); lượt đối chiếu + rà soát dùng Lite (quota lớn).
const STRONG_MODELS = [
  // Model mới nhất đứng đầu; đang quá tải (503) thì tự bị tạm bỏ qua vài phút (xem modelCooldown)
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  // Hết sạch quota Flash xịn thì rơi xuống Lite thay vì fail
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];
const LITE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  // Lite hết quota (hiếm) thì mượn Flash xịn — đủ cả 4 model để tối đa khả năng chấm được (không dừng giữa chừng)
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
];
// Trích đáp án từ file là việc dễ (đọc bảng đáp án) → dùng Lite để dành quota Flash xịn cho chấm bài
const EXTRACT_MODELS = LITE_MODELS;

// Chấm bài: nhiệt độ THẤP để điểm ổn định giữa các lần chấm (trước đây 0.7 → điểm dao động).
// Các model Gemini 2.5+/3.x là model "suy nghĩ": token suy nghĩ tính CHUNG vào maxOutputTokens → giới hạn thấp
// (trước đây 4096) làm câu trả lời bị CẮT CỤT → JSON hỏng → lượt chấm thất bại. Nới rộng để đủ chỗ.
const GENERATION_CONFIG = {
  temperature: 0.2,
  maxOutputTokens: 32768,
  responseMimeType: 'application/json',
};

// Đọc đáp án từ file: cần CHÍNH XÁC, ổn định → nhiệt độ thấp.
const EXTRACT_CONFIG = {
  temperature: 0.1,
  maxOutputTokens: 16384,
  responseMimeType: 'application/json',
};

// ── Tối ưu dùng model: nhớ model đang hết quota / lỗi để TẠM BỎ QUA, không gọi thử lại mỗi lần ──────
// Hết quota (429) → nghỉ 30 phút; model không tồn tại (404) → nghỉ 6 giờ; quá tải/mạng (503) → nghỉ 2 phút.
const modelCooldown = new Map(); // modelName -> thời điểm (ms) được dùng lại
// Thống kê để theo dõi/đo đạc (không ảnh hưởng chấm bài)
const aiStats = { calls: 0, failed: 0, skippedCooldown: 0, reviewsSkipped: 0, byModel: {} };

// Mô tả lỗi kèm MÃ HTTP (thư viện thường chỉ in "Error fetching from …", che mất 429/503/404)
function errorText(err) {
  const status = err && (err.status || (err.response && err.response.status));
  return `${status ? `[${status}${err.statusText ? ' ' + err.statusText : ''}] ` : ''}${String(err && err.message)}`;
}

function cooldownFor(err) {
  const t = errorText(err);
  if (/\[429|quota|RESOURCE_EXHAUSTED/i.test(t)) return 30 * 60e3;
  if (/\[404|not found/i.test(t)) return 6 * 3600e3;
  return 2 * 60e3; // quá tải (503) / lỗi mạng: nghỉ ngắn
}

// Lỗi có nên thử model tiếp theo không: hết quota (429), quá tải (503), model bị gỡ (404), lỗi mạng,
// hoặc câu trả lời không đọc được (JSON hỏng — model khác có thể trả đúng).
function isRetryableModelError(err) {
  if (err && err.isParseError) return true;
  const t = errorText(err);
  return /\[(429|500|502|503|504|404)|quota|RESOURCE_EXHAUSTED|overloaded|UNAVAILABLE|not found|fetch failed|Error fetching|ECONNRESET|ETIMEDOUT/i.test(t);
}

function parseError(msg) {
  const e = new Error(msg);
  e.isParseError = true;
  return e;
}

// Đọc JSON từ câu trả lời của AI, tự sửa lỗi nhẹ hay gặp: dấu \ của công thức (vd \frac) không hợp lệ trong
// JSON, dấu phẩy thừa trước ] hoặc }. Hỏng hẳn (vd bị cắt cụt) → ném lỗi "parse" để thử model khác.
// Lệnh LaTeX bắt đầu bằng b/f/n/r/t TRÙNG với ký tự thoát hợp lệ của JSON (\f, \t…) nên JSON.parse KHÔNG báo lỗi
// mà lặng lẽ biến "\frac" thành ký tự điều khiển + "rac" → nhân đôi dấu \ của các lệnh này trước khi đọc.
const LATEX_LIKE_ESCAPES = /\\(?=(?:frac|tfrac|dfrac|forall|times|theta|tan|text|textbf|triangle|top|to|beta|binom|bar|boxed|bigg?|right|rightarrow|rho|rangle|neq|nabla|notin)(?![a-zA-Z]))/g;

function parseJsonLoose(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw parseError('AI không trả về định dạng JSON hợp lệ');
  const raw = m[0].replace(LATEX_LIKE_ESCAPES, '\\\\');
  try { return JSON.parse(raw); } catch { /* thử sửa bên dưới */ }
  const fixed = raw
    .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\')
    .replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(fixed); } catch (e) { throw parseError(`JSON không hợp lệ: ${e.message}`); }
}

// Gọi lần lượt các model (bỏ qua model đang "nghỉ"); hết model khả dụng thì vẫn thử các model đang nghỉ
// như phương án cuối để không bỏ dở việc chấm. parse(text) chuẩn hóa kết quả; ném lỗi nếu không hợp lệ.
async function generateWithFallback(models, generationConfig, parts, parse, label) {
  const now = Date.now();
  const ready = models.filter((m) => (modelCooldown.get(m) || 0) <= now);
  const resting = models.filter((m) => !ready.includes(m));
  aiStats.skippedCooldown += resting.length && ready.length ? resting.length : 0;
  let lastErr;
  for (const modelName of [...ready, ...resting]) {
    try {
      aiStats.calls++;
      aiStats.byModel[modelName] = (aiStats.byModel[modelName] || 0) + 1;
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
      const result = await model.generateContent(parts);
      const out = parse(result.response.text().trim());
      modelCooldown.delete(modelName);
      return { out, modelName };
    } catch (err) {
      lastErr = err;
      aiStats.failed++;
      if (!isRetryableModelError(err)) throw err;
      // JSON hỏng không phải lỗi của model → không bắt model "nghỉ", chỉ chuyển sang model khác
      if (!err.isParseError) modelCooldown.set(modelName, Date.now() + cooldownFor(err));
      console.warn(`[AI ${label}] ${modelName} không khả dụng (${errorText(err).slice(0, 140)}) → thử model tiếp theo`);
    }
  }
  throw lastErr;
}

// Hai kết quả chấm coi là "khớp" (không cần lượt rà soát thứ 3) khi tổng điểm lệch rất ít VÀ
// các câu chung tên có cùng đánh giá đúng/sai/một phần.
function resultsAgree(r1, r2, maxScore) {
  const tol = Math.max(0.25, maxScore * 0.025);
  if (Math.abs(r1.score - r2.score) > tol) return false;
  const st2 = new Map(r2.details.map((d) => [d.question.toLowerCase(), d.status]));
  let compared = 0, diff = 0;
  r1.details.forEach((d) => {
    const s = st2.get(d.question.toLowerCase());
    if (s) { compared++; if (s !== d.status) diff++; }
  });
  return compared === 0 || diff / compared <= 0.1;
}

// ── BAREM CÓ CẤU TRÚC: đọc file đáp án 1 lần → danh sách ý chấm + điểm tối đa từng ý (cache theo file) ──
// Đo trên 12 bài thật (đề KT HK2 Toán 6, so với điểm GV chấm tay): AI tự đặt điểm tối đa sai (ý 0,5đ thành 1đ),
// cho điểm cả ý học sinh không làm, chấm bài vẽ hình quá dễ → điểm cao hơn GV trung bình 0,5đ. Cố định khung
// ý + điểm tối đa từ barem rồi ép mọi lượt chấm theo đúng khung đó (hệ thống tự kiểm, không tin con số AI tự đặt).
const rubricCache = new Map(); // `${file}:${mtime}:${maxScore}` → items

async function extractRubricItems(answerFilePath, maxScore) {
  const prompt = `Đây là FILE ĐỀ + HƯỚNG DẪN CHẤM (barem) của một bài kiểm tra môn Toán, thang ${maxScore} điểm.
NHIỆM VỤ: lập DANH SÁCH Ý CHẤM — mỗi phần tử là một ĐƠN VỊ CHO ĐIỂM nhỏ nhất theo barem, kèm điểm tối đa.
Quy tắc:
- Trắc nghiệm: mỗi câu 1 ý, tên "TN câu <n>", criteria = "Đáp án đúng: <chữ cái>".
- Tự luận: mỗi ý nhỏ của đề 1 phần tử, tên "Tự luận câu <số bài>.<ý>" (vd "Tự luận câu I.1", "Tự luận câu III.2a"); bài không chia ý thì "Tự luận câu <số bài>".
- Bài VẼ HÌNH / bài barem chấm theo TỪNG YÊU CẦU (vd "mỗi ý vẽ đúng được 0,25 điểm"): tách MỖI yêu cầu thành 1 phần tử riêng, tên "Tự luận câu <số bài>.<thứ tự>" (vd "Tự luận câu IV.1"), criteria ghi rõ yêu cầu đó.
- criteria: tóm tắt NGẮN các bước được điểm theo barem (kèm điểm từng bước) và đáp số đúng; ghi cả các ghi chú trừ điểm của barem liên quan ý đó.
- max_points lấy ĐÚNG theo barem. TỔNG max_points của mọi phần tử PHẢI bằng ${maxScore}.
Chỉ trả về JSON THUẦN: {"items": [{"question": "...", "max_points": <số>, "criteria": "..."}]}
Viết công thức dạng chữ thường (vd 3/4, x^2), KHÔNG dùng LaTeX và KHÔNG dùng dấu \\ trong JSON.`;
  const { out, modelName } = await generateWithFallback(STRONG_MODELS, EXTRACT_CONFIG, [prompt, buildInlinePart(answerFilePath)], (text) => {
    const items = (parseJsonLoose(text).items || [])
      .map((it) => ({ question: String(it.question || '').trim().slice(0, 100), max_points: round2(parseFloat(it.max_points)), criteria: String(it.criteria || '').slice(0, 600) }))
      .filter((it) => it.question && isFinite(it.max_points) && it.max_points > 0);
    const total = round2(items.reduce((s, it) => s + it.max_points, 0));
    const names = new Set(items.map((it) => normQ(it.question)));
    // Tổng không khớp thang điểm / trùng tên ý → barem đọc sai, thử model khác
    if (!items.length || Math.abs(total - maxScore) > 0.01 || names.size !== items.length) {
      throw parseError(`barem đọc được tổng ${total}/${maxScore}, ${items.length} ý`);
    }
    return items;
  }, 'rubric-items');
  console.log(`[aiGrading] Đã lập barem có cấu trúc (${modelName}): ${out.length} ý, tổng ${maxScore}đ`);
  return out;
}

// Lỗi (không đọc được barem hợp lệ) → null: chấm theo cách cũ, lần sau thử lại (không cache lỗi)
async function getRubricItems(answerFilePath, maxScore) {
  const key = `${answerFilePath}:${fs.statSync(answerFilePath).mtimeMs}:${maxScore}`;
  if (rubricCache.has(key)) return rubricCache.get(key);
  try {
    const items = await extractRubricItems(answerFilePath, maxScore);
    rubricCache.set(key, items);
    return items;
  } catch (err) {
    console.error(`[aiGrading] không lập được barem có cấu trúc (${err.message}) → chấm theo barem tự do`);
    return null;
  }
}

const normQ = (q) => String(q || '').toLowerCase().normalize('NFC').replace(/\s+/g, '').replace(/[–—:]/g, '-');
const NO_WORK_RE = /^\s*(không\s*(làm|có|thấy|trình\s*bày|tìm\s*thấy)|bỏ\s*trống|để\s*trống|trống|chưa\s*làm|n\/a|none)\b/i;

// Ép kết quả AI về đúng khung barem: đúng danh sách ý, điểm ≤ điểm tối đa, ý không có bài làm = 0,
// ý AI bỏ sót = 0 (ghi chú). Khớp quá ít ý → coi như trả lời hỏng để thử model khác.
function conformToRubric(parsed, items) {
  const byName = new Map(parsed.details.map((d) => [normQ(d.question), d]));
  let matched = 0;
  const details = items.map((it) => {
    const d = byName.get(normQ(it.question));
    if (!d) return { question: it.question, status: 'wrong', points: 0, max_points: it.max_points, comment: 'Không tìm thấy bài làm cho ý này.' };
    matched++;
    let pts = Math.min(it.max_points, Math.max(0, d.points != null ? d.points : (d.status === 'correct' ? it.max_points : 0)));
    let comment = d.comment;
    if (NO_WORK_RE.test(d.student_work || '') && pts > 0) { pts = 0; comment = `Không có bài làm cho ý này (0đ). ${comment}`.slice(0, 900); }
    pts = round2(pts);
    return { question: it.question, status: pts >= it.max_points ? 'correct' : pts <= 0 ? 'wrong' : 'partial', points: pts, max_points: it.max_points, comment };
  });
  if (matched < Math.ceil(items.length * 0.6)) throw parseError(`kết quả chỉ khớp ${matched}/${items.length} ý của barem`);
  parsed.details = details;
  parsed.score = round2(details.reduce((s, d) => s + d.points, 0));
  return parsed;
}

// ── LƯỢT CHÉP BÀI ĐỘC LẬP: chỉ đưa BÀI LÀM (không kèm đáp án) để xác định học sinh có làm từng ý không ──
// Đo trên bài thật: khi đọc chung với file đáp án, AI hay lấy LỜI GIẢI trong đáp án làm bài của học sinh → cho
// trọn điểm cả bài học sinh bỏ trống (vd 1 em không làm Bài V vẫn được 1đ). Lượt này không thấy đáp án nên không
// thể nhầm; ý nó xác định "không làm" bị ép về 0 điểm ở mọi lượt chấm.
async function detectAttempted(subPaths, items) {
  const prompt = `Đây CHỈ là BÀI LÀM viết tay của học sinh (ảnh/PDF, có thể nhiều trang, thứ tự trang có thể lộn xộn). KHÔNG có đề, KHÔNG có đáp án.
Với MỖI ý trong danh sách dưới đây, xác định học sinh CÓ trình bày bài làm cho ý đó trong các trang này hay không, và chép NGẮN GỌN kết quả/đáp số cuối cùng học sinh viết.
- "done": true nếu có bài làm (kể cả làm sai, làm dở); false nếu KHÔNG tìm thấy bất kỳ nội dung nào của ý đó (bỏ trống, không có trang nào viết ý đó).
- Trắc nghiệm: done = true nếu học sinh có ghi chữ cái đáp án cho câu đó.
- Vẽ hình: done = true nếu có hình vẽ tương ứng.
Danh sách ý:
${items.map((it) => `- "${it.question}": ${it.criteria.slice(0, 120)}`).join('\n')}
Chỉ trả về JSON THUẦN: {"items": [{"question": "<đúng tên ý>", "done": true|false, "work": "<kết quả học sinh viết, hoặc rỗng>"}]}
Không dùng LaTeX, không dùng dấu \\ trong JSON.`;
  const { out, modelName } = await generateWithFallback(LITE_MODELS, EXTRACT_CONFIG, [prompt, ...subPaths.map(buildInlinePart)], (text) => {
    const rows = (parseJsonLoose(text).items || []).filter((r) => r && r.question);
    if (rows.length < Math.ceil(items.length * 0.6)) throw parseError(`lượt chép bài chỉ có ${rows.length}/${items.length} ý`);
    return new Map(rows.map((r) => [normQ(r.question), r.done !== false]));
  }, 'attempted');
  const missing = items.filter((it) => out.get(normQ(it.question)) === false).map((it) => it.question);
  console.log(`[AI grading] lượt chép bài (${modelName}): học sinh không làm ${missing.length} ý${missing.length ? ` (${missing.join(', ')})` : ''}`);
  return out;
}

// Ý mà lượt chép bài độc lập xác định "không làm" → 0 điểm (chấm lại tổng)
function zeroNotAttempted(result, attempted) {
  if (!result || !attempted) return result;
  result.details = result.details.map((d) => (attempted.get(normQ(d.question)) === false && d.points > 0
    ? { ...d, points: 0, status: 'wrong', comment: `Học sinh không làm ý này (0đ). ${d.comment}`.slice(0, 900) }
    : d));
  result.score = round2(result.details.reduce((s, d) => s + (d.points || 0), 0));
  return result;
}

// Gộp 2 kết quả CÙNG khung barem: mỗi ý lấy lượt có điểm thấp hơn (kèm nhận xét của lượt đó); nhận xét chung
// lấy của lượt 1 (model mạnh). Ý hai lượt chấm khác nhau được ghi chú để giáo viên dễ soát lại.
function mergeConservative(r1, r2) {
  const by2 = new Map(r2.details.map((d) => [normQ(d.question), d]));
  const details = r1.details.map((d1) => {
    const d2 = by2.get(normQ(d1.question));
    if (!d2 || d2.points >= d1.points) return d1;
    return { ...d2, comment: `${d2.comment} (Hai lượt chấm khác nhau: ${d1.points}đ / ${d2.points}đ — lấy mức thấp hơn.)`.slice(0, 900) };
  });
  return { ...r1, details, score: round2(details.reduce((s, d) => s + d.points, 0)) };
}

async function gradeSubmission(answerFilePath, submissionFilePaths, maxScore = 10, gradingNote = '', opts = {}) {
  const { partsConfig = null, scope = null, studentAnswers = null } = opts;
  const cfg = parsePartsConfig(partsConfig);

  // Phần nào AI cần chấm (scope do hàng đợi truyền vào). Bài cũ (không cfg) → chấm toàn bộ kiểu tự luận.
  const gradePart = (k) => {
    if (!cfg) return false;
    if (k === 'essay') return scope ? !!scope.essay : partEnabled(cfg, 'essay');
    return partEnabled(cfg, k) && (scope ? !!scope[k] : true);
  };
  const objOnly = { multiple_choice: gradePart('multiple_choice'), true_false: gradePart('true_false'), short_answer: gradePart('short_answer') };
  const gradeObjective = objOnly.multiple_choice || objOnly.true_false || objOnly.short_answer;
  const gradeEssay = cfg ? gradePart('essay') : true; // bài cũ: chấm toàn bộ như tự luận

  // File đáp án (PDF) — thường gồm đề + hướng dẫn chấm/barem; có thể không có nếu chỉ chấm phần objective
  const hasAnswerFile = !!answerFilePath && fs.existsSync(answerFilePath);
  const rubricItems = !cfg && hasAnswerFile ? await getRubricItems(answerFilePath, maxScore) : null;
  const rubricBlock = rubricItems
    ? `\nDANH SÁCH Ý CHẤM (lập từ barem — BẮT BUỘC: "details" có ĐÚNG ${rubricItems.length} dòng theo đúng thứ tự, ĐÚNG tên "question" và ĐÚNG "max_points" dưới đây; không thêm, không gộp, không đổi tên):\n${rubricItems.map((it) => `- "${it.question}" (tối đa ${it.max_points}đ): ${it.criteria}`).join('\n')}\n`
    : '';

  // Đáp án học sinh đã điền ở giao diện (cho phần khách quan) — dùng thay cho việc dò trong ảnh.
  const studentText = (cfg && gradeObjective && studentAnswers) ? describeStudentAnswers(cfg, studentAnswers) : '';

  // Học sinh có thể nộp nhiều file (nhiều ảnh / PDF) — chuẩn hóa về mảng
  const subPaths = (Array.isArray(submissionFilePaths) ? submissionFilePaths : [submissionFilePaths]).filter(Boolean);
  for (const p of subPaths) {
    if (!fs.existsSync(p)) throw new Error('File bài nộp không tồn tại');
  }
  // Phải có ÍT NHẤT một nguồn bài làm: ảnh, hoặc đáp án học sinh đã điền sẵn.
  if (subPaths.length === 0 && !studentText) throw new Error('Không có bài làm để AI chấm');

  const noteBlock = gradingNote && gradingNote.trim()
    ? `\nHƯỚNG DẪN CHẤM CỦA GIÁO VIÊN (BẮT BUỘC tuân theo — chấm phần nào, chấm theo kiểu gì, chia điểm thế nào):\n"""${gradingNote.trim()}"""\n`
    : '';

  // Khối đáp án (key) của các phần objective AI phụ trách
  const answerKeyBlock = gradeObjective
    ? `\nĐÁP ÁN CÁC PHẦN (key chính thức — dùng để so chấm):\n${describeAnswerKey(cfg, objOnly)}\n`
    : '';

  // Mô tả các tài liệu đính kèm theo thứ tự để AI biết đâu là đáp án, đâu là bài làm
  const docLines = [];
  if (hasAnswerFile) docLines.push('- Tài liệu đầu tiên (PDF): ĐỀ BÀI / ĐÁP ÁN / BAREM (hướng dẫn chấm) chính thức — dùng để lấy đáp án đúng và BAREM ĐIỂM TỪNG BƯỚC cho MỌI phần. TUYỆT ĐỐI không coi lời giải trong tài liệu này là bài làm của học sinh.');
  if (subPaths.length > 1) docLines.push(`- ${subPaths.length} tài liệu tiếp theo: BÀI LÀM CỦA HỌC SINH (nhiều ảnh/trang) — xem xét TẤT CẢ như một bài liền mạch.`);
  else if (subPaths.length === 1) docLines.push('- Tài liệu tiếp theo: BÀI LÀM CỦA HỌC SINH (ảnh/PDF, có thể nhiều trang).');
  else docLines.push('- (Không có ảnh bài làm — học sinh điền đáp án khách quan ở giao diện, xem mục ĐÁP ÁN HỌC SINH ĐÃ ĐIỀN.)');
  const docBlock = `\nCÁC TÀI LIỆU ĐÍNH KÈM:\n${docLines.join('\n')}\n`;

  // Đáp án học sinh đã điền sẵn ở giao diện (nếu có) — dùng làm bài làm cho phần khách quan.
  const studentBlock = studentText
    ? `\nĐÁP ÁN HỌC SINH ĐÃ ĐIỀN Ở GIAO DIỆN (dùng CHÍNH cái này làm bài làm của học sinh cho các phần khách quan, KHÔNG cần dò trong ảnh):\n${studentText}\n`
    : '';

  // Phạm vi chấm (chỉ những phần được giao)
  const scopeNames = [];
  if (objOnly.multiple_choice) scopeNames.push('TRẮC NGHIỆM');
  if (objOnly.true_false) scopeNames.push('ĐÚNG/SAI');
  if (objOnly.short_answer) scopeNames.push('TRẢ LỜI NGẮN');
  if (gradeEssay) scopeNames.push('TỰ LUẬN');
  const scopeBlock = cfg
    ? `\nCHỈ CHẤM CÁC PHẦN SAU (các phần khác đã được hệ thống tự chấm, BỎ QUA): ${scopeNames.join(', ') || '(không có)'}\n`
    : '\nCHẤM TOÀN BỘ BÀI LÀM (mọi phần có trong đề, kể cả trắc nghiệm nếu có), đúng theo thang điểm của đề/barem.\n';

  // Luật chấm riêng cho từng phần được giao
  const ruleLines = [];
  if (objOnly.multiple_choice) ruleLines.push('- TRẮC NGHIỆM: mỗi câu so với đáp án đúng (A/B/C/D); đúng hay sai theo từng câu, không có điểm một phần.');
  if (objOnly.true_false) {
    const tfEven = !!(cfg && cfg.true_false && cfg.true_false.tfMode === 'even');
    ruleLines.push(tfEven
      ? '- ĐÚNG/SAI (mỗi câu 4 ý a,b,c,d): chia ĐỀU — mỗi ý đúng = 25% điểm câu (đúng 1 ý = 0.25, 2 ý = 0.5, 3 ý = 0.75, cả 4 ý = 1.0; TỈ LỆ trên điểm câu, quy đổi sang điểm thực tế).'
      : '- ĐÚNG/SAI (mỗi câu 4 ý a,b,c,d): chấm theo CHUẨN THPT — trong 1 câu: đúng 1 ý = 0.1, đúng 2 ý = 0.25, đúng 3 ý = 0.5, đúng cả 4 ý = 1.0 (TỈ LỆ trên điểm câu, quy đổi sang điểm thực tế).');
  }
  if (objOnly.short_answer) ruleLines.push('- TRẢ LỜI NGẮN: khớp LINH HOẠT, chấp nhận biến thể tương đương về mặt toán học (vd "1/2" = "0,5" = "0.5"; "2" = "2,0"; bỏ qua khác biệt khoảng trắng, dấu phẩy/chấm thập phân, hoa/thường).');
  if (gradeEssay) ruleLines.push(
    '- TỰ LUẬN — CHẤM BÁM SÁT BAREM (bắt buộc tuân thủ):\n'
    + '  1. Chấm theo TỪNG BƯỚC của barem: chỉ cho điểm một bước khi học sinh làm ĐÚNG BẢN CHẤT TOÁN HỌC của bước đó; điểm mỗi bước đúng bằng điểm barem ghi cho bước đó (vd 0,25đ). Không có barem chi tiết thì tự chia bước hợp lý, mỗi bước 0,25đ.\n'
    + '  2. LỖI LOGIC & DÂY CHUYỀN: sai ở bước nào thì KHÔNG cho điểm bước đó. Các bước sau tính đúng nhưng dựa trên kết quả sai của bước trước: ghi chú rõ trong nhận xét câu; nếu barem không nói rõ thì MẶC ĐỊNH KHÔNG cho điểm phần kết quả bị ảnh hưởng.\n'
    + '  3. ĐIỀU KIỆN XÁC ĐỊNH: luôn kiểm tra học sinh có đặt ĐKXĐ (khi cần) và có đối chiếu điều kiện ở bước kết luận không; thiếu thì trừ NGHIÊM NGẶT theo barem.\n'
    + '  4. CÁCH GIẢI KHÁC: học sinh giải khác barem nhưng đúng logic và ra cùng kết quả → chia lại điểm tương đương barem gốc và ghi rõ "Học sinh giải theo cách khác hợp lệ". Cách giải khác phải dùng kiến thức ĐÚNG LỚP ĐANG HỌC (xác định lớp từ đề); dùng kiến thức lớp trên để làm bài lớp dưới thì KHÔNG chấp nhận.\n'
    + '  5. Áp dụng ĐÚNG các ghi chú trừ điểm riêng trong barem (vd "thiếu 1 trường hợp trừ 0,25", "thừa/thiếu giá trị trừ 0,25", "không đánh dấu các đoạn bằng nhau trừ tối đa 0,25"…).\n'
    + '  6. KHÔNG LÀM = 0 ĐIỂM: chỉ cho điểm một ý khi THẤY RÕ bài làm của chính ý đó trong ảnh (ghi vào "student_work"). Không tìm thấy, bỏ trống, chỉ chép lại đề → 0 điểm. KHÔNG được suy ra bài làm của ý này từ ý khác hay từ đáp án.\n'
    + '  7. BÀI VẼ HÌNH: chấm TỪNG yêu cầu dựng hình; chỉ cho điểm yêu cầu khi hình vẽ thể hiện ĐÚNG và RÕ: đúng tên điểm, điểm nằm đúng tia/đường/đoạn được yêu cầu, đúng phía (vd "tia đối" phải ở phía bên kia), đúng quan hệ (trung điểm, bằng nhau, thẳng hàng, nằm giữa), độ dài/góc phù hợp số đo đề cho (so tỉ lệ các đoạn trên hình; vd OA = 4cm và OB = 3cm thì OA phải dài hơn OB rõ rệt). Thiếu tên điểm, sai vị trí, sai tỉ lệ rõ, hình bị gạch bỏ → 0 điểm cho yêu cầu đó. Nghi ngờ thì KHÔNG cho điểm. Áp dụng đúng ghi chú trừ điểm của barem (vd không đánh dấu các đoạn bằng nhau).\n'
    + '  8. TRẮC NGHIỆM CÓ TẨY SỬA: lấy đáp án CUỐI CÙNG học sinh để lại; chữ bị gạch/viết đè không rõ đáp án nào hoặc khoanh nhiều đáp án → coi là SAI.\n'
    + '  9. Khi barem KHÔNG quy định khác: bài đại (đại số, giải tích, xác suất…) chỉ ghi đáp số, không có lời giải/các bước → tối đa 50% điểm câu; bài hình tính toán/chứng minh: thiếu hình vẽ minh họa → tối đa 50%, chỉ có hình vẽ không có lời giải → tối đa 25% (vi phạm nhiều mức thì lấy mức trần THẤP NHẤT). Bài yêu cầu VẼ HÌNH thì chấm theo từng ý vẽ của barem.'
  );
  const objectiveRules = ruleLines.length ? `\nQUY TẮC CHẤM TỪNG PHẦN:\n${ruleLines.join('\n')}\n` : '';

  // Hướng dẫn AI lấy bài làm khách quan từ đâu: từ đáp án đã điền sẵn, hay tự dò trong ảnh.
  const imageScanNote = gradeObjective
    ? (studentText
        ? '\nLƯU Ý: Học sinh ĐÃ điền sẵn đáp án các phần khách quan ở giao diện (mục ĐÁP ÁN HỌC SINH ĐÃ ĐIỀN). Hãy dùng CHÍNH các đáp án đó để chấm. Câu nào chưa có đáp án đúng sẵn (ghi "ĐỌC TỪ FILE ĐÁP ÁN") thì TÌM đáp án đúng trong FILE ĐÁP ÁN (PDF) rồi so chấm.\n'
        : '\nLƯU Ý: Học sinh KHÔNG điền đáp án ở giao diện cho các phần khách quan cần chấm — hãy TỰ DÒ bài làm các phần đó ngay trong ẢNH rồi so với đáp án để chấm. Câu nào chưa có đáp án đúng sẵn thì TÌM trong FILE ĐÁP ÁN.\n')
    : '';

  // promptBody: vai trò + ngữ cảnh + quy tắc (dùng chung cho mọi lượt). jsonFormatBlock tách riêng
  // để có thể chèn thêm reviewBlock (kết quả 2 lượt đầu) vào GIỮA cho lượt rà soát.
  const promptBody = `VAI TRÒ: Bạn là một giáo viên Toán xuất sắc, giàu kinh nghiệm giảng dạy và chấm thi cấp THCS/THPT, tư duy logic chặt chẽ, am hiểu cách trình bày bài giải tự luận, luôn chấm CÔNG TÂM và BÁM SÁT BAREM hướng dẫn chấm.
NHIỆM VỤ: Chấm bài làm môn Toán của học sinh trên thang ${maxScore} điểm. Việc chấm điểm phải dựa TRỰC TIẾP và CHÍNH XÁC vào barem điểm từng bước (trong file đáp án / hướng dẫn chấm).
${docBlock}${scopeBlock}${rubricBlock}${answerKeyBlock}${studentBlock}${noteBlock}${objectiveRules}${imageScanNote}
CÁCH ĐỌC BÀI LÀM (ảnh, nếu có):
- Thứ tự các trang/ảnh có thể KHÔNG đúng thứ tự thực tế. Tự xác định thứ tự đọc dựa vào số bài/câu và tính liên tục của lời giải.
- Bài làm là chữ viết tay (có thể xấu, mờ, nghiêng, tẩy xóa). Đọc thật kỹ TỪNG dòng; dựa vào ngữ cảnh toán học để nhận diện đúng con số, ký hiệu, phân số, lũy thừa, dấu. Nội dung bị gạch bỏ thì coi như học sinh đã xóa.
- Chỉ coi là sai khi thực sự sai; không suy diễn có lợi cho học sinh khi lập luận mập mờ.

CÁCH TRẢ KẾT QUẢ:
- Mỗi Ý NHỎ của đề (vd Bài I.1, Bài I.2, Bài III.2a…) là MỘT dòng trong "details"; câu trắc nghiệm có thể gộp mỗi câu một dòng. Đặt tên dòng tự luận dạng "Tự luận câu <số bài>.<ý>" (vd "Tự luận câu I.1", "Tự luận câu III.2a"), trắc nghiệm dạng "TN câu <n>".
- "comment" của mỗi dòng = BẢNG CHẤM THU GỌN theo barem: liệt kê từng bước "<bước barem>: Đúng/Sai/Thiếu (+điểm)", nêu RÕ lý do trừ điểm (sai ở đâu, thiếu bước nào, lỗi dây chuyền, thiếu ĐKXĐ…). Ngắn gọn, tiếng Việt.
- "student_work" = chép NGẮN GỌN bài làm/đáp số học sinh viết cho ý đó (vd "x = -6", "chọn B", "vẽ A trên Oy, I trung điểm AB"); không có bài làm thì ghi đúng "KHÔNG LÀM".
- "points" = điểm đạt được của ý đó, "max_points" = điểm tối đa của ý theo barem. "score" PHẢI bằng tổng "points" (không vượt quá ${maxScore}).
- "status": "correct" nếu đạt điểm tối đa của ý, "wrong" nếu 0 điểm, "partial" nếu đạt một phần.
- "feedback" = NHẬN XÉT CỦA GIÁO VIÊN gồm 3 phần ngắn: "Điểm tốt: …", "Lỗi sai/Lỗ hổng kiến thức: …", "Lời khuyên: …".
- Viết công thức dạng chữ thường (vd 3/4, x^2, căn(2), góc xOy), KHÔNG dùng LaTeX và KHÔNG dùng dấu \ (gạch chéo ngược) trong JSON.`;

  const jsonFormatBlock = `

Trả về JSON đúng định dạng sau (chỉ JSON, không kèm chữ nào khác):
{
  "score": <tổng điểm, từ 0 đến ${maxScore}>,
  "feedback": "<Điểm tốt: … Lỗi sai/Lỗ hổng kiến thức: … Lời khuyên: …>",
  "details": [
    {"question": "<vd: TN câu 1 / Tự luận câu II.2>", "student_work": "<bài làm của HS cho ý này hoặc KHÔNG LÀM>", "status": "correct|wrong|partial", "points": <điểm đạt>, "max_points": <điểm tối đa của ý>, "comment": "<bảng chấm thu gọn theo barem>"}
  ]
}`;

  const buildParts = (promptText) => [
    promptText,
    ...(hasAnswerFile ? [buildInlinePart(answerFilePath)] : []),
    ...subPaths.map(buildInlinePart),
  ];

  // Mô tả 1 kết quả chấm trước đó để đưa vào prompt rà soát.
  const describeResult = (label, r) => `${label} — điểm: ${r.score}/${maxScore}\nNhận xét: ${r.feedback}\nChi tiết từng ý:\n${r.details.map((d) => `  • ${d.question}: ${d.status}${d.points != null ? ` (${d.points}/${d.max_points ?? '?'}đ)` : ''} — ${d.comment}`).join('\n') || '  (không có)'}`;

  // ── QUY TRÌNH CHẤM (tối ưu số lượt gọi AI) ───────────────────────────
  // Lượt 1 (model mạnh) và lượt 2 (model nhẹ) chấm ĐỘC LẬP và chạy SONG SONG (giảm một nửa thời gian chờ).
  // Hai lượt KHỚP nhau (tổng điểm lệch rất ít, các ý cùng đánh giá) → chốt luôn kết quả lượt 1, BỎ lượt 3.
  // Lệch nhau → lượt 3 RÀ SOÁT cả hai (kèm xem lại bài làm gốc) rồi chốt điểm cuối, ưu tiên lượt 1.
  const basePrompt = promptBody + jsonFormatBlock;
  const baseParts = buildParts(basePrompt);

  const [s1, s2, s3] = await Promise.allSettled([
    callModelOnce(baseParts, maxScore, STRONG_MODELS, rubricItems),
    callModelOnce(baseParts, maxScore, LITE_MODELS, rubricItems),
    rubricItems && subPaths.length ? detectAttempted(subPaths, rubricItems) : Promise.resolve(null),
  ]);
  const attempted = s3.status === 'fulfilled' ? s3.value : null;
  if (s3.status === 'rejected') console.error(`[AI grading] lượt chép bài lỗi: ${s3.reason && s3.reason.message} → bỏ qua bước kiểm tra ý không làm`);
  const result1 = zeroNotAttempted(s1.status === 'fulfilled' ? s1.value : null, attempted);
  const result2 = zeroNotAttempted(s2.status === 'fulfilled' ? s2.value : null, attempted);
  if (!result1) console.error(`[AI grading] lượt 1 (model mạnh) lỗi: ${s1.reason && s1.reason.message}`);
  if (!result2) console.error(`[AI grading] lượt 2 (model nhẹ) lỗi: ${s2.reason && s2.reason.message}`);

  if (!result1 && !result2) {
    throw new Error('Chấm bài thất bại (cả 2 lượt chấm đầu đều lỗi)');
  }
  // Chỉ 1 trong 2 lượt đầu thành công → không đủ dữ liệu để rà soát, dùng luôn kết quả đó.
  if (!result1 || !result2) {
    const only = result1 || result2;
    console.log(`[AI grading] chỉ 1/2 lượt đầu thành công → dùng điểm ${only.score}, bỏ qua lượt rà soát`);
    return only;
  }
  aiStats.lastPasses = [result1, result2]; // để đo đạc độ chính xác (không ảnh hưởng chấm bài)
  if (resultsAgree(result1, result2, maxScore)) {
    aiStats.reviewsSkipped++;
    console.log(`[AI grading] lượt 1=${result1.score}, lượt 2=${result2.score} → khớp nhau, chốt điểm lượt 1 (bỏ lượt rà soát)`);
    return result1;
  }
  // Có barem có cấu trúc (2 lượt cùng khung ý) → mỗi ý lấy điểm THẤP HƠN của 2 lượt độc lập. Đo trên bài thật:
  // sai lệch của AI chủ yếu là cho điểm dễ dãi ngẫu nhiên (mỗi lượt dễ dãi ở chỗ khác nhau, nhất là bài vẽ hình),
  // lấy mức thấp hơn khử được phần lớn sai lệch đó (MAE 0,5 → ~0,3) mà không cần gọi thêm lượt rà soát.
  if (rubricItems) {
    const final = mergeConservative(result1, result2);
    console.log(`[AI grading] lượt 1=${result1.score}, lượt 2=${result2.score} → lệch nhau, mỗi ý lấy điểm thấp hơn = ${final.score}`);
    return final;
  }

  const reviewBlock = `

HAI LƯỢT CHẤM ĐỘC LẬP ĐÃ THỰC HIỆN TRƯỚC ĐÓ (để bạn đối chiếu, KHÔNG được chép nguyên mà không tự kiểm tra lại với bài làm và barem):

${describeResult('LƯỢT 1 (model mạnh — ƯU TIÊN hơn khi có bất đồng)', result1)}

${describeResult('LƯỢT 2 (model nhẹ — tham khảo thêm)', result2)}

NHIỆM VỤ CỦA BẠN — ĐÂY LÀ LƯỢT CHẤM CUỐI, CHỐT ĐIỂM CHÍNH THỨC CỦA HỌC SINH:
- Tự xem lại bài làm (ảnh/PDF) và barem, rà soát lại TỪNG ý theo ĐÚNG các quy tắc ở trên (chấm từng bước barem, lỗi dây chuyền, ĐKXĐ, cách giải khác hợp lệ, ghi chú trừ điểm của barem).
- Ý nào hai lượt đồng thuận → giữ nguyên, trừ khi bạn tự phát hiện cả hai đều sai so với barem.
- Ý nào bất đồng → tự chấm lại ý đó theo barem; ưu tiên LƯỢT 1 nếu cả hai cách đều hợp lý; chỉ theo LƯỢT 2 khi LƯỢT 1 thực sự sai barem.
- Kết quả bạn trả về là điểm CHÍNH THỨC, CUỐI CÙNG — hãy quyết đoán, nhất quán, đúng barem.`;

  const reviewParts = buildParts(promptBody + reviewBlock + jsonFormatBlock);

  try {
    // Lượt chốt điểm quyết định điểm cuối → dùng model MẠNH (trước đây dùng Lite: đo thấy hay giữ điểm dễ dãi)
    const final = await callModelOnce(reviewParts, maxScore, STRONG_MODELS, rubricItems);
    console.log(`[AI grading] lượt 1=${result1.score}, lượt 2=${result2.score} → lượt 3 (rà soát, chốt điểm cuối) = ${final.score}`);
    return final;
  } catch (err) {
    console.error(`[AI grading] lượt 3 (rà soát) lỗi: ${err.message} → dùng kết quả lượt 1 (model mạnh) làm điểm cuối`);
    return result1;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

// Gọi AI 1 lần để chấm (tự chuyển model khi hết quota/quá tải). Trả về { score, feedback, details } đã chuẩn hóa.
// Khi mọi dòng chi tiết có "points" → tổng điểm = tổng points (tránh AI cộng nhầm).
async function callModelOnce(parts, maxScore, models, rubricItems = null) {
  const { out, modelName } = await generateWithFallback(models, GENERATION_CONFIG, parts, (text) => {
    const parsed = parseJsonLoose(text);
    if (!Array.isArray(parsed.details)) parsed.details = [];
    parsed.details = parsed.details
      .filter((d) => d && (d.question || d.comment))
      .map((d) => {
        const row = {
          question: String(d.question || '').slice(0, 100),
          student_work: String(d.student_work || '').slice(0, 300),
          status: ['correct', 'wrong', 'partial'].includes(d.status) ? d.status : 'partial',
          comment: String(d.comment || '').slice(0, 900),
        };
        const pts = parseFloat(d.points);
        const max = parseFloat(d.max_points);
        if (isFinite(pts)) row.points = Math.max(0, round2(pts));
        if (isFinite(max)) row.max_points = Math.max(0, round2(max));
        return row;
      });
    const withPts = parsed.details.filter((d) => d.points != null);
    let score = parseFloat(parsed.score) || 0;
    if (parsed.details.length && withPts.length === parsed.details.length) score = withPts.reduce((s, d) => s + d.points, 0);
    parsed.score = Math.max(0, Math.min(maxScore, round2(score)));
    parsed.feedback = String(parsed.feedback || '');
    if (rubricItems) conformToRubric(parsed, rubricItems);
    // student_work chỉ dùng để kiểm tra "không làm = 0", không lưu vào kết quả
    parsed.details.forEach((d) => { delete d.student_work; });
    return parsed;
  }, 'grading');
  console.log(`[AI grading] chấm bằng ${modelName} → ${out.score} điểm`);
  return out;
}

// ── Đọc FILE ĐÁP ÁN để trích đáp án (key) các câu objective giáo viên để trống ──────────
// cfg: parts_config đã parse. missing: { multiple_choice:[idx], true_false:[idx], short_answer:[idx] }
// Trả về { multiple_choice:['A',...], true_false:[['T','F','T','F'],...], short_answer:['12',...] }
// theo thứ tự câu 1..n (chỉ các phần có câu để trống). Lỗi → ném để nơi gọi tự xử lý.
async function extractAnswerKey(answerFilePath, cfg, missing) {
  if (!answerFilePath || !fs.existsSync(answerFilePath)) throw new Error('Không có file đáp án để AI đọc');

  const wants = [];
  if (partEnabled(cfg, 'multiple_choice') && missing.multiple_choice && missing.multiple_choice.length) {
    wants.push(`- "multiple_choice": mảng ${cfg.multiple_choice.count} phần tử, mỗi phần tử là 1 chữ "A"/"B"/"C"/"D" — đáp án đúng của câu 1..${cfg.multiple_choice.count} (đúng thứ tự).`);
  }
  if (partEnabled(cfg, 'true_false') && missing.true_false && missing.true_false.length) {
    wants.push(`- "true_false": mảng ${cfg.true_false.count} phần tử, mỗi phần tử là mảng 4 giá trị "T"(Đúng)/"F"(Sai) cho 4 ý a,b,c,d của câu đó (đúng thứ tự câu 1..${cfg.true_false.count}).`);
  }
  if (partEnabled(cfg, 'short_answer') && missing.short_answer && missing.short_answer.length) {
    wants.push(`- "short_answer": mảng ${cfg.short_answer.count} phần tử, mỗi phần tử là đáp án ngắn (chuỗi) của câu 1..${cfg.short_answer.count} (đúng thứ tự).`);
  }
  if (wants.length === 0) return {};

  const prompt = `Đây là FILE ĐÁP ÁN (có thể là bảng đáp án, hoặc bài giải đầy đủ) của một đề kiểm tra.
Hãy ĐỌC THẬT KỸ toàn bộ tài liệu và TRÍCH ra ĐÁP ÁN ĐÚNG CUỐI CÙNG của các phần khách quan sau.
Chỉ trả về JSON THUẦN (không kèm giải thích, không markdown), gồm ĐÚNG các khóa dưới đây:
${wants.join('\n')}

Yêu cầu BẮT BUỘC:
- Đáp án có thể nằm trong bảng tô đậm, ô đáp án, dòng "Đáp án:", hoặc suy ra từ lời giải — hãy tìm cho ra.
- Giữ ĐÚNG THỨ TỰ câu: phần tử thứ 0 = câu 1, thứ 1 = câu 2, ...
- Trắc nghiệm: mỗi câu chỉ 1 chữ in hoa "A"/"B"/"C"/"D".
- Đúng/Sai: mỗi câu là mảng 4 phần tử cho ý a,b,c,d; dùng "T" nếu ý đó ĐÚNG, "F" nếu ý đó SAI.
- Trả lời ngắn: ghi đúng đáp án (số/biểu thức) như trong file.
- Câu nào THỰC SỰ không tìm thấy đáp án thì để null tại vị trí đó (đừng đoán bừa).`;

  const { out, modelName } = await generateWithFallback(EXTRACT_MODELS, EXTRACT_CONFIG, [prompt, buildInlinePart(answerFilePath)], (text) => {
    return normalizeExtractedKey(parseJsonLoose(text), cfg);
  }, 'extract');
  const cnt = (a) => (Array.isArray(a) ? a.filter((x) => x != null).length : 0);
  console.log(`[aiGrading] Trích đáp án từ file (${modelName}): TN=${cnt(out.multiple_choice)} ĐS=${cnt(out.true_false)} TLN=${cnt(out.short_answer)}`);
  return out;
}

// ── Tạo "quy chuẩn nhận xét" (rubric) — ĐỌC FILE ĐÁP ÁN ĐÚNG 1 LẦN khi giáo viên tạo/cập nhật đáp án
// bài tập (xem routes/homework.js). Chỉ cần 1 câu mô tả khái quát chủ đề/nội dung của đề, lưu lại
// dưới dạng text (KHÔNG hiển thị trên web) để lúc chấm tự động từng bài nộp KHÔNG cần gọi AI nữa mà
// vẫn ghép được vào mẫu nhận xét theo thang điểm (xem homeworkScoring.composeAutoFeedback).
async function generateFeedbackRubric(answerFilePath) {
  if (!answerFilePath || !fs.existsSync(answerFilePath)) return null;

  const prompt = `Đây là FILE ĐÁP ÁN (bảng đáp án hoặc bài giải đầy đủ) của một đề bài tập.
NHIỆM VỤ: đọc khái quát toàn bộ tài liệu và cho biết chủ đề/nội dung/dạng bài CHÍNH của cả đề, viết ĐÚNG 1 CÂU NGẮN GỌN (dưới 25 từ, tiếng Việt). Câu này sẽ được dùng để tự động nhắc học sinh kiểu "cần cẩn thận hơn khi làm các dạng bài về ...", nên hãy viết sao cho ghép được sau cụm đó (ví dụ: "phương trình bậc hai và định lý Vi-ét", "hình học tọa độ trong mặt phẳng").

Chỉ trả về JSON THUẦN (không kèm giải thích, không markdown): {"overview": "<câu mô tả>"}`;

  const { out, modelName } = await generateWithFallback(LITE_MODELS, EXTRACT_CONFIG, [prompt, buildInlinePart(answerFilePath)], (text) => {
    return String(parseJsonLoose(text).overview || '').trim().slice(0, 150);
  }, 'rubric');
  console.log(`[aiGrading] Đã tạo quy chuẩn nhận xét (${modelName}): "${out}"`);
  return out ? { overview: out } : null;
}

// Chuẩn hóa kết quả AI trả về → đúng kiểu mong đợi cho từng phần.
function normalizeExtractedKey(parsed, cfg) {
  const out = {};
  if (partEnabled(cfg, 'multiple_choice') && Array.isArray(parsed.multiple_choice)) {
    out.multiple_choice = parsed.multiple_choice.map((v) => {
      const c = String(v == null ? '' : v).trim().toUpperCase().charAt(0);
      return /[ABCD]/.test(c) ? c : null;
    });
  }
  if (partEnabled(cfg, 'true_false') && Array.isArray(parsed.true_false)) {
    out.true_false = parsed.true_false.map((row) => {
      if (!Array.isArray(row)) return null;
      const r = row.slice(0, 4).map((v) => (String(v == null ? '' : v).trim().toUpperCase().startsWith('T') ? 'T' : (String(v).trim().toUpperCase().startsWith('F') ? 'F' : null)));
      return r.length === 4 && r.every((x) => x) ? r : null;
    });
  }
  if (partEnabled(cfg, 'short_answer') && Array.isArray(parsed.short_answer)) {
    out.short_answer = parsed.short_answer.map((v) => (v == null ? null : String(v).trim()));
  }
  return out;
}

module.exports = { gradeSubmission, extractAnswerKey, generateFeedbackRubric, aiStats, resultsAgree, parseJsonLoose, conformToRubric };
