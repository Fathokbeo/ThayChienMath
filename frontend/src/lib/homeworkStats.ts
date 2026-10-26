import { parseDetails, questionLabel, errorTagOf, NOT_DONE_RE, NO_KEY_RE, ERROR_TAGS, type Detail, type ErrorTag } from './feedbackSummary';
import { parsePartsConfig } from './homeworkParts';

// Thống kê 1 bài tập cho giáo viên (tab "Thống kê" ở trang chi tiết bài tập):
// phổ điểm, tỉ lệ điểm đạt theo từng câu, lỗi sai phổ biến — tính từ chi tiết chấm từng câu
// (AI hoặc máy chấm phần trắc nghiệm) của các bài đã có điểm. Lần nộp mới đang chờ chấm thì dùng điểm
// cao nhất lần trước nhưng KHÔNG có chi tiết từng câu → chỉ góp vào phổ điểm.

type Part = 'TN' | 'DS' | 'TLN' | 'TL' | 'HSA';
export const PART_SHORT: Record<Part, string> = { TN: 'TN', DS: 'Đ/S', TLN: 'TLN', TL: 'TL', HSA: 'Câu' };

function partOf(q: string, isHsa: boolean): Part {
  if (isHsa) return 'HSA';
  if (/^(tn\b|trắc nghiệm)/i.test(q)) return 'TN';
  if (/đúng\s*\/\s*sai|^đs\b/i.test(q)) return 'DS';
  if (/trả lời ngắn|^tln\b/i.test(q)) return 'TLN';
  return 'TL';
}

// Thứ tự câu trong đề: theo phần (TN → Đ/S → TLN → TL), rồi số câu tự nhiên, hiểu cả số La Mã
// ("I.1" < "I.3" < "II.1" < "III.2b" < "IV" < "V.1"; "2a" < "2c" < "3.2" < "4.1" < "4.2c").
const PART_RANK: Record<Part, number> = { TN: 0, DS: 1, TLN: 2, TL: 3, HSA: 0 };
const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };
const romanToInt = (r: string) => [...r].reduce((acc, ch, i, a) => (ROMAN[ch] < (ROMAN[a[i + 1]] || 0) ? acc - ROMAN[ch] : acc + ROMAN[ch]), 0);
function labelKey(label: string): (number | string)[] {
  return label.split(/[.,\s–-]+/).filter(Boolean).flatMap((tok) => {
    if (/^[IVX]+$/.test(tok)) return [romanToInt(tok), ''];
    const m = tok.match(/^(\d+)([a-zđ]*)$/i);
    return m ? [Number(m[1]), m[2].toLowerCase()] : [Number.MAX_SAFE_INTEGER, tok.toLowerCase()];
  });
}
function compareLabels(a: string, b: string) {
  const ka = labelKey(a), kb = labelKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i], y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

// Điểm đạt của 1 câu (0..1): có điểm từng câu thì lấy theo điểm, không thì theo trạng thái
const ratioOf = (d: Detail) => (typeof d.points === 'number' && (d.max_points ?? 0) > 0
  ? Math.max(0, Math.min(1, d.points / d.max_points!))
  : d.status === 'correct' ? 1 : d.status === 'partial' ? 0.5 : 0);

export type StudentMark = { name: string; status: string; comment: string; ratio: number; points?: number; max?: number; pick?: string };
export type QuestionStat = {
  key: string; part: Part; label: string; n: number; ratio: number; maxPoints: number | null;
  correct: number; partial: number; wrong: number; blank: number;
  answer: string | null; picks: { option: string; count: number }[]; marks: StudentMark[];
};
export type ErrorKind = ErrorTag | 'ND' | 'OBJ' | 'OTHER';
export const ERROR_LABEL: Record<ErrorKind, string> = {
  ...Object.fromEntries(ERROR_TAGS.map((t) => [t.key, `Lỗi ${t.label}`])) as Record<ErrorTag, string>,
  ND: 'Bỏ trống, chưa làm được', OBJ: 'Chọn / điền sai đáp án', OTHER: 'Làm sai (chưa rõ nguyên nhân)',
};
export type ErrorStat = { kind: ErrorKind; label: string; count: number; students: number; questions: { label: string; count: number }[]; samples: { name: string; question: string; text: string }[] };
export type Bin = { from: number; to: number; count: number; names: string[] };
export type HwStats = {
  max: number; rosterSize: number; graded: number; pending: number; missingOverdue: number; notYet: number;
  avg: number | null; median: number | null; top: number | null; low: number | null; passCount: number;
  bins: Bin[]; questions: QuestionStat[]; errors: ErrorStat[]; withDetails: number;
};

// AI đôi khi gộp nhiều câu thành 1 dòng ("TN câu 1 đến 8"). Đúng hết → tách thành từng câu (chia đều điểm);
// có sai → giữ nguyên 1 dòng "1–8" (không biết sai câu nào).
const RANGE_RE = /câu\s*(\d+)\s*(?:đến|tới|-|–|—)\s*(\d+)/i;
function expandRanges(details: Detail[]): (Detail & { _label?: string })[] {
  return details.flatMap((d) => {
    const q = String(d.question || '');
    const m = q.match(RANGE_RE);
    if (!m) return [d];
    const a = Number(m[1]), b = Number(m[2]);
    if (!(b > a) || b - a > 60) return [d];
    if (d.status !== 'correct') return [{ ...d, _label: `${a}–${b}` }];
    const n = b - a + 1;
    return Array.from({ length: n }, (_, i) => ({
      ...d, question: q.replace(RANGE_RE, `câu ${a + i}`),
      points: typeof d.points === 'number' ? d.points / n : d.points,
      max_points: typeof d.max_points === 'number' ? d.max_points / n : d.max_points,
    }));
  });
}

// "Giải |y^2+1| = 2 biến đổi sai ...: Sai (-0.5đ)" → "Giải |y^2+1| = 2 biến đổi sai ..."
const cleanStep = (t: string) => t.replace(/\(\s*[+-]?\s*[\d.,]+\s*đ?\s*\)/gi, '').replace(/:\s*(sai|đúng một phần|chưa đúng)\s*$/i, '').replace(/\s+/g, ' ').trim();
// Các bước bị trừ điểm trong lời giải thích nhiều bước (ngăn bởi ";")
const failedSteps = (comment: string) => comment.split(/;\s*/).filter((seg) => /\bsai\b|thiếu|chưa|nhầm|bỏ sót|\(-\s*\d/i.test(seg) && !/:\s*đúng\s*\(/i.test(seg));

export function computeHomeworkStats(hw: any, roster: any[]): HwStats {
  const max = hw.max_score > 0 ? hw.max_score : 10;
  const isHsa = hw.exam_type === 'hsa';
  const cfg = parsePartsConfig(hw.parts_config);
  const overdue = hw.due_date ? new Date() > new Date(hw.due_date) : false;

  // ── Phổ điểm (quy về thang 10, mỗi cột 1 điểm) ──
  const scored = roster.filter((s) => s.submission_id && (s.score ?? s.best_score) !== null && (s.score ?? s.best_score) !== undefined)
    .map((s) => ({ name: s.full_name as string, score: Number(s.score ?? s.best_score) }));
  const r10 = scored.map((x) => Math.max(0, Math.min(10, (x.score / max) * 10)));
  const bins: Bin[] = Array.from({ length: 10 }, (_, i) => ({ from: i, to: i + 1, count: 0, names: [] }));
  scored.forEach((x, i) => { const b = bins[Math.min(9, Math.floor(r10[i]))]; b.count++; b.names.push(x.name); });
  const sorted = scored.map((x) => x.score).sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;

  // ── Theo câu + lỗi sai ──
  const keys: string[] = [];
  const qmap = new Map<string, QuestionStat & { _sum: number; _picks: Map<string, number> }>();
  const emap = new Map<ErrorKind, { count: number; students: Set<string>; q: Map<string, number>; samples: Map<string, { name: string; question: string; text: string; n: number }> }>();
  let withDetails = 0;

  const addError = (kind: ErrorKind, name: string, qLabel: string, text: string) => {
    const e = emap.get(kind) || { count: 0, students: new Set<string>(), q: new Map<string, number>(), samples: new Map() };
    e.count++; e.students.add(name); e.q.set(qLabel, (e.q.get(qLabel) || 0) + 1);
    const t = cleanStep(text).slice(0, 160);
    if (t) { const k = t.toLowerCase(); const prev = e.samples.get(k); if (prev) prev.n++; else e.samples.set(k, { name, question: qLabel, text: t, n: 1 }); }
    emap.set(kind, e);
  };

  roster.forEach((s) => {
    if (!s.submission_id) return;
    const details = expandRanges(parseDetails(s.grading_details).filter((d) => !NO_KEY_RE.test(String(d.comment || ''))));
    if (details.length === 0) return;
    withDetails++;
    let structured: any = null;
    try { structured = s.structured_answers ? JSON.parse(s.structured_answers) : null; } catch { /* bỏ qua */ }
    let prevKey: string | null = null;

    details.forEach((d) => {
      const q = String(d.question || '').trim();
      const part = partOf(q, isHsa);
      const label = d._label ?? questionLabel(q);
      const key = `${part}|${label.toLowerCase()}`;
      // Giữ đúng thứ tự câu của đề khi gộp nhiều học sinh (câu mới chèn ngay sau câu đứng trước nó)
      if (!qmap.has(key)) {
        keys.splice(prevKey ? keys.indexOf(prevKey) + 1 : keys.length, 0, key);
        const idx = parseInt(label) - 1;
        const answer = part === 'TN' && cfg?.multiple_choice?.answers?.[idx] ? String(cfg.multiple_choice.answers[idx]) : null;
        qmap.set(key, { key, part, label, n: 0, ratio: 0, maxPoints: null, correct: 0, partial: 0, wrong: 0, blank: 0, answer, picks: [], marks: [], _sum: 0, _picks: new Map() });
      }
      prevKey = key;
      const st = qmap.get(key)!;
      const comment = String(d.comment || '');
      const ratio = ratioOf(d);
      st.n++; st._sum += ratio;
      if (typeof d.max_points === 'number' && d.max_points > 0) st.maxPoints = Math.max(st.maxPoints ?? 0, d.max_points);
      const blank = d.status !== 'correct' && NOT_DONE_RE.test(comment);
      if (d.status === 'correct') st.correct++; else if (blank) st.blank++; else if (d.status === 'partial') st.partial++; else st.wrong++;

      // Trắc nghiệm sai: học sinh chọn phương án nào (từ phần làm trên web, hoặc đọc từ lời giải thích)
      let pick: string | undefined;
      if (part === 'TN' && d.status !== 'correct' && !blank) {
        const idx = parseInt(label) - 1;
        const fromWeb = structured?.multiple_choice?.[idx];
        pick = (typeof fromWeb === 'string' && /^[A-D]$/i.test(fromWeb) ? fromWeb : comment.match(/chọn\s*(?:đáp án\s*)?([A-D])\b/i)?.[1])?.toUpperCase();
        if (pick) st._picks.set(pick, (st._picks.get(pick) || 0) + 1);
        if (!st.answer) st.answer = comment.match(/đáp án\s*(?:đúng\s*)?(?:là\s*)?([A-D])\b/i)?.[1]?.toUpperCase() || null;
      }
      if (ratio < 1) st.marks.push({ name: s.full_name, status: blank ? 'blank' : d.status || 'wrong', comment, ratio, points: d.points, max: d.max_points, pick });

      // Lỗi sai: mỗi câu chưa trọn điểm tính 1 lỗi, xếp loại theo bước bị trừ điểm (nếu có) hoặc cả lời giải thích
      if (ratio >= 1) return;
      const qText = `${PART_SHORT[part]} ${label}`;
      if (blank) { addError('ND', s.full_name, qText, comment); return; }
      if (part !== 'TL') { addError('OBJ', s.full_name, qText, comment); return; }
      const steps = failedSteps(comment);
      const hit = steps.map((seg) => ({ seg, tag: errorTagOf(seg) })).find((x) => x.tag);
      const tag = hit?.tag ?? errorTagOf(comment) ?? (d.status === 'partial' ? 'TB' : 'OTHER');
      addError(tag, s.full_name, qText, hit?.seg ?? steps[0] ?? comment);
    });
  });

  const order = new Map(keys.map((k, i) => [k, i]));
  keys.sort((a, b) => {
    const qa = qmap.get(a)!, qb = qmap.get(b)!;
    return PART_RANK[qa.part] - PART_RANK[qb.part] || compareLabels(qa.label, qb.label) || order.get(a)! - order.get(b)!;
  });
  const questions: QuestionStat[] = keys.map((k) => {
    const { _sum, _picks, ...st } = qmap.get(k)!;
    return { ...st, ratio: st.n ? _sum / st.n : 0, picks: [..._picks].map(([option, count]) => ({ option, count })).sort((a, b) => b.count - a.count) };
  });
  const errors: ErrorStat[] = [...emap].map(([kind, e]) => ({
    kind, label: ERROR_LABEL[kind], count: e.count, students: e.students.size,
    questions: [...e.q].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    samples: [...e.samples.values()].sort((a, b) => b.n - a.n).slice(0, 4).map(({ name, question, text }) => ({ name, question, text })),
  })).sort((a, b) => b.count - a.count);

  const submittedNoScore = roster.filter((s) => s.submission_id && (s.score ?? s.best_score) === null).length;
  const notSubmitted = roster.filter((s) => !s.submission_id).length;
  return {
    max, rosterSize: roster.length, graded: scored.length, pending: submittedNoScore,
    missingOverdue: overdue ? notSubmitted : 0, notYet: overdue ? 0 : notSubmitted,
    avg: scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : null,
    median, top: sorted.length ? sorted[sorted.length - 1] : null, low: sorted.length ? sorted[0] : null,
    passCount: scored.filter((x) => x.score / max >= 0.5).length,
    bins, questions, errors, withDetails,
  };
}
