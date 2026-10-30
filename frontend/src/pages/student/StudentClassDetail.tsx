import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import api, { fileUrl } from '../../lib/api';
import { buildContentSections } from '../../lib/classContent';
import VideoPlayer from '../../components/VideoPlayer';
import Modal from '../../components/Modal';
import GradingDetails from '../../components/GradingDetails';
import FileViewer from '../../components/FileViewer';
import SubmitHomeworkView from '../../components/SubmitHomeworkView';
import { type StudentAnswers } from '../../components/PartsSolver';
import useIsMobile from '../../lib/useIsMobile';
import { toast } from '../../components/Toast';
import { parsePartsConfig, hasObjectiveParts, hasEssay, emptyStudentAnswers, PART_LABELS, PART_ORDER, type PartKey, parseHsaConfig, emptyHsaStudentAnswers, type HsaConfig, formatRemainingMs, formatDeadlineRemaining } from '../../lib/homeworkParts';
import { parseAttachments, isViewableFile } from '../../lib/attachments';
import RankingBoard from '../../components/RankingBoard';
import {
  ChevronLeft, Play, ClipboardList, BookOpen, Upload, CheckCircle, Clock, Eye, Bot, Lock, FileText, Layers, Video,
  ChevronDown, ChevronRight, ChevronUp, Trophy, Star, Paperclip, Download, Timer
} from 'lucide-react';

// Khóa lưu tạm đáp án đang làm dở của 1 bài, để không mất khi lỡ thoát ra giữa chừng.
const draftKey = (hwId: number) => `homework_draft_${hwId}`;

// Danh sách URL các file đã nộp (hỗ trợ cũ: 1 file, mới: nhiều file dạng JSON)
function submittedFileUrls(hw: any): string[] {
  let names: string[] = [];
  if (hw.submitted_files) { try { const a = JSON.parse(hw.submitted_files); if (Array.isArray(a)) names = a; } catch { /* ignore */ } }
  if (names.length === 0 && hw.submitted_file) names = [hw.submitted_file];
  return names.map((n: string) => fileUrl(`/uploads/submissions/${n}`));
}

export default function StudentClassDetail() {
  const { id } = useParams();
  const [cls, setCls] = useState<any>(null);
  // ?tab=todo|ranking: mở thẳng tab đó (vd từ "Việc cần làm" ở trang Tổng quan)
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'content' | 'todo' | 'ranking'>(
    initialTab === 'todo' || initialTab === 'ranking' ? initialTab : 'content');
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  // Danh sách bài giảng/bài tập nào (theo key "<chương>-lessons"/"-homework") đang được bung ra trong 1 chương —
  // mặc định thu gọn, chỉ hiện khi bấm mở.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewLessonModal, setViewLessonModal] = useState(false);
  const [viewingLesson, setViewingLesson] = useState<any>(null);
  const [solutionVideo, setSolutionVideo] = useState<{ title: string; url: string } | null>(null);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState<any>(null);
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswers>({ multiple_choice: [], true_false: [], short_answer: [] });
  const [hsaAnswers, setHsaAnswers] = useState<string[]>([]);
  // Hạn "hết giờ" của lượt làm bài HSA hiện tại (epoch ms) — null = không giới hạn / bài không phải HSA
  const [examDeadline, setExamDeadline] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewFiles, setViewFiles] = useState<string[] | null>(null);
  // Bài tập nào đang mở "Chi tiết" điểm (nhận xét + kết quả từng câu); mặc định ẩn hết
  const [openGradeDetails, setOpenGradeDetails] = useState<Set<number>>(new Set());
  // Đồng hồ dùng để đếm ngược thời gian còn lại NGOÀI danh sách bài tập (lượt làm HSA đang dở, chưa nộp,
  // học sinh đã thoát ra khỏi giao diện làm bài) — chỉ chạy khi thật sự có lượt làm đang dở.
  const [outsideTick, setOutsideTick] = useState(() => Date.now());
  const isMobile = useIsMobile();

  useEffect(() => { fetchClass(); }, [id]);

  // Bài chưa phân chương hiện thẳng ngoài, không có khung chương để bấm mở — mở sẵn 2 mục cho dễ thấy.
  useEffect(() => {
    if (!cls) return;
    setExpandedSections((prev) => new Set(prev).add('orphan-lessons').add('orphan-homework'));
  }, [cls?.id]);

  // Tự làm mới khi có bài vừa nộp đang được AI chấm nền, để cập nhật điểm
  useEffect(() => {
    const pending = cls?.homework?.some((hw: any) => hw.submission_id && (hw.score === null || hw.showing_best) && (hw.grading_status === 'pending' || hw.grading_status === 'grading'));
    if (!pending) return;
    const t = setInterval(fetchClass, 8000);
    return () => clearInterval(t);
  }, [cls]);

  useEffect(() => {
    const needsTick = cls?.homework?.some((hw: any) => (hw.attempt_started_at && hw.time_limit_minutes) || (hw.can_submit && hw.due_date));
    if (!needsTick) return;
    setOutsideTick(Date.now());
    const t = setInterval(() => setOutsideTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cls]);

  // Khi mở lớp: lớp chưa dùng chương thì mở sẵn nhóm "Chưa phân chương", còn lại để thu gọn
  useEffect(() => {
    if (cls) setExpandedChapters(new Set((cls.chapters?.length || 0) === 0 ? ['orphan'] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls?.id]);

  // Mở từ Tìm nhanh / trang Tổng quan: ?lesson=ID / ?hw=ID → bung đúng chương & mục, cuộn tới bài và tô viền vài giây;
  // bài giảng có video/tài liệu thì mở luôn để xem. Thêm:
  //   &chi-tiet=1 (từ "Kết quả mới") → mở sẵn nhận xét & kết quả từng câu của bài đó
  //   &tab=todo   (từ "Việc cần làm") → giữ tab Việc cần làm (bài đã hiện sẵn ở đó), chỉ cuộn tới bài
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!cls) return;
    const lessonId = Number(searchParams.get('lesson')) || 0;
    const hwId = Number(searchParams.get('hw')) || 0;
    const target = lessonId ? (cls.lessons || []).find((l: any) => l.id === lessonId)
      : hwId ? (cls.homework || []).find((h: any) => h.id === hwId) : null;
    if (!target) return;
    if (hwId && searchParams.get('chi-tiet') === '1' && target.can_see_answer) {
      setOpenGradeDetails((prev) => new Set(prev).add(target.id));
    }
    // Cùng điều kiện lọc với danh sách todoHomework bên dưới
    if (hwId && searchParams.get('tab') === 'todo' && target.due_date && target.can_submit && !target.submission_id) {
      setFocusId(`hw-${target.id}`);
      return;
    }
    const inChapter = target.chapter_id && (cls.chapters || []).some((c: any) => c.id === target.chapter_id);
    const groupKey = inChapter ? String(target.chapter_id) : 'orphan';
    setActiveTab('content');
    setExpandedChapters((prev) => new Set(prev).add(groupKey));
    setExpandedSections((prev) => new Set(prev).add(`${groupKey}-${lessonId ? 'lessons' : 'homework'}`));
    setFocusId(`${lessonId ? 'lesson' : 'hw'}-${target.id}`);
    if (lessonId && (target.video_url || target.attachments)) { setViewingLesson(target); setViewLessonModal(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls?.id, searchParams]);
  useEffect(() => {
    if (!focusId) return;
    // Cuộn đầu thẻ lên ngay dưới thanh trên cùng (scrollMarginTop) — thẻ đã mở nhận xét thường dài hơn màn hình,
    // căn giữa sẽ che mất tên bài và điểm.
    const t1 = setTimeout(() => document.getElementById(focusId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    const t2 = setTimeout(() => setFocusId(null), 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focusId]);
  const focusRing = (key: string): React.CSSProperties => ({
    scrollMarginTop: 'calc(var(--tc-nav-h) + var(--sa-top) + 12px)',
    transition: 'box-shadow 0.3s',
    ...(focusId === key ? { boxShadow: '0 0 0 2px #1F5C68' } : {}),
  });

  const fetchClass = async () => {
    const { data } = await api.get(`/student/my-classes/${id}`);
    setCls(data);
  };

  const openSubmit = (hw: any) => {
    setSubmitting(hw);
    setSubmitFiles([]);
    // Đáp án đã nộp trước đó (nếu nộp lại) — dùng chung cho cả 2 kiểu bài, hình dạng khác nhau theo exam_type
    let prev: any = null;
    if (hw.structured_answers) { try { prev = JSON.parse(hw.structured_answers); } catch { /* ignore */ } }
    // Ưu tiên đáp án đang làm dở lưu tạm trên máy (nếu có) — tránh mất bài khi lỡ thoát ra
    let draft: any = null;
    const draftRaw = localStorage.getItem(draftKey(hw.id));
    if (draftRaw) { try { draft = JSON.parse(draftRaw); } catch { /* ignore */ } }

    if (hw.exam_type === 'hsa') {
      const cfg = parseHsaConfig(hw.hsa_config);
      const empty = emptyHsaStudentAnswers(cfg);
      setHsaAnswers((Array.isArray(draft?.hsa) && draft.hsa) || (Array.isArray(prev?.hsa) && prev.hsa) || empty);
    } else {
      const cfg = parsePartsConfig(hw.parts_config);
      const empty = emptyStudentAnswers(cfg);
      setStudentAnswers({
        multiple_choice: draft?.multiple_choice || prev?.multiple_choice || empty.multiple_choice,
        true_false: draft?.true_false || prev?.true_false || empty.true_false,
        short_answer: draft?.short_answer || prev?.short_answer || empty.short_answer,
      });
    }
    setSubmitModal(true);
  };

  // Bấm "Làm bài" (chỉ bài HSA): ghi/nhận thời điểm bắt đầu ở server rồi tính hạn "hết giờ" =
  // started_at + thời gian làm bài. Gọi lại nhiều lần (vd tải lại trang) khi lượt làm chưa nộp sẽ
  // nhận đúng started_at cũ (không làm mới đồng hồ đếm ngược).
  const startExam = async (hw: any) => {
    try {
      const { data } = await api.post(`/homework/${hw.id}/start`);
      setExamDeadline(data.time_limit_minutes ? new Date(data.started_at).getTime() + data.time_limit_minutes * 60000 : null);
      openSubmit(hw);
      // Cập nhật lại danh sách bài tập để ghi nhận lượt làm mới (attempt_started_at) ngay lập tức —
      // nếu không, lỡ thoát ra mà chưa nộp thì nút ngoài danh sách vẫn hiện "Làm lại" như cũ (dữ liệu cũ
      // từ lần tải trang trước, chưa biết đã có lượt làm đang dở) thay vì "Tiếp tục làm bài".
      fetchClass();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể bắt đầu làm bài');
      fetchClass();
    }
  };

  // Tự lưu tạm đáp án đang điền để không mất khi lỡ thoát ra giữa chừng
  useEffect(() => {
    if (!submitModal || !submitting) return;
    const draft = submitting.exam_type === 'hsa' ? { hsa: hsaAnswers } : studentAnswers;
    localStorage.setItem(draftKey(submitting.id), JSON.stringify(draft));
  }, [studentAnswers, hsaAnswers, submitModal, submitting]);

  // Thêm file vào danh sách (gộp với file đã chọn, loại trùng tên+kích thước)
  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setSubmitFiles((prev) => {
      const merged = [...prev];
      arr.forEach((f) => { if (!merged.some((x) => x.name === f.name && x.size === f.size)) merged.push(f); });
      return merged.slice(0, 20);
    });
  };

  const removeFile = (idx: number) => setSubmitFiles((prev) => prev.filter((_, i) => i !== idx));

  const doSubmit = async () => {
    const isHsa = submitting?.exam_type === 'hsa';
    const cfg = isHsa ? null : parsePartsConfig(submitting?.parts_config);
    const objective = isHsa ? true : hasObjectiveParts(cfg);
    // Phải có bài làm: đáp án objective đã điền HOẶC ít nhất một file (cho phần tự luận / bài cũ)
    if (!isHsa && submitFiles.length === 0 && !objective) { toast.error('Chọn ít nhất một file bài làm'); return; }
    setLoading(true);
    try {
      const body = new FormData();
      submitFiles.forEach((f) => body.append('files', f));
      if (isHsa) body.append('structured_answers', JSON.stringify({ hsa: hsaAnswers }));
      else if (objective) body.append('structured_answers', JSON.stringify(studentAnswers));
      const { data } = await api.post(`/homework/${submitting.id}/submit`, body);
      toast.success(data.message);
      localStorage.removeItem(draftKey(submitting.id));
      setSubmitModal(false);
      fetchClass();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi nộp bài');
    } finally {
      setLoading(false);
    }
  };

  if (!cls) return <div style={{ padding: '2rem', textAlign: 'center', color: '#86868B' }}>Đang tải...</div>;

  const chapters: any[] = cls.chapters || [];

  // Nội dung lớp gom theo chương: Đại số → Hình học → các phần "Khác" do giáo viên đặt tên.
  // Phần nào không có chương thì không hiện. Bài chưa gán chương: học sinh KHÔNG thấy khung
  // "Chưa phân chương" như bên giáo viên, mà thấy thẳng bài giảng & bài tập ở cuối trang.
  const lessonsAll: any[] = cls.lessons || [];
  const homeworkAll: any[] = cls.homework || [];
  const { sections: contentSections, orphan: orphanGroup } = buildContentSections(chapters, lessonsAll, homeworkAll);
  // Bài tập cần làm: có hạn nộp, còn hạn/còn lượt và học sinh CHƯA nộp — hạn gần nhất lên đầu
  const todoHomework = homeworkAll
    .filter((hw) => hw.due_date && hw.can_submit && !hw.submission_id)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const toggleChapter = (key: string) => setExpandedChapters((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const toggleSection = (key: string) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const renderLessonCard = (l: any, i: number) => {
    const atts = parseAttachments(l.attachments);
    const docCount = atts.filter((a) => a.kind !== 'answer').length;
    const ansCount = atts.filter((a) => a.kind === 'answer').length;
    return (
      <div key={l.id} id={`lesson-${l.id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.25rem', ...focusRing(`lesson-${l.id}`) }}>
        <div style={{ width: 36, height: 36, background: '#E6F0F3', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: '#2F6F82', fontSize: '0.9rem' }}>{i + 1}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{l.title}</div>
          {l.description && <div style={{ fontSize: '0.8rem', color: '#6E6E73', marginTop: 2 }}>{l.description}</div>}
          {(l.video_url || atts.length > 0) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {l.video_url && <span className="badge badge-blue"><Play size={10} style={{ marginRight: 3 }} />Video</span>}
              {docCount > 0 && <span className="badge badge-orange"><Paperclip size={10} style={{ marginRight: 3 }} />Tài liệu ×{docCount}</span>}
              {ansCount > 0 && <span className="badge badge-green"><FileText size={10} style={{ marginRight: 3 }} />Đáp án BT ×{ansCount}</span>}
            </div>
          )}
        </div>
        {(l.video_url || atts.length > 0) ? (
          <button className="btn btn-primary btn-sm" onClick={() => { setViewingLesson(l); setViewLessonModal(true); }}>
            <Play size={13} /> Xem bài
          </button>
        ) : <span style={{ fontSize: '0.78rem', color: '#C7C7CC' }}>Chưa có nội dung</span>}
      </div>
    );
  };

  const renderHomeworkCard = (hw: any, i: number) => {
    const isSubmitted = !!hw.submission_id;
    const hasGrade = hw.score !== null;
    const canSubmit = hw.can_submit;
    const isOverdue = hw.due_date ? new Date() > new Date(hw.due_date) : false;
    // attempts_left: null/undefined = không giới hạn số lần nộp
    const hasAttemptLimit = hw.attempts_left !== null && hw.attempts_left !== undefined;
    const attemptsExhausted = hasAttemptLimit && hw.attempts_left <= 0;
    const submittedUrls = isSubmitted ? submittedFileUrls(hw) : [];
    // Nút phụ: xem đề, bài đã nộp, đáp án, video chữa (nút chính Nộp bài / Làm bài vẽ riêng bên dưới)
    const secondaryActions = [
      hw.pdf_file && { key: 'de', cls: 'btn-ghost', icon: <FileText size={13} />, label: 'Xem đề', onClick: () => setViewFiles([fileUrl(`/uploads/homework/${hw.pdf_file}`)]) },
      submittedUrls.length > 0 && { key: 'nop', cls: 'btn-ghost', icon: <Eye size={13} />, label: `Bài đã nộp (${submittedUrls.length})`, onClick: () => setViewFiles(submittedUrls) },
      !!hw.can_see_answer && !!hw.answer_file && { key: 'da', cls: 'btn-success', icon: <Eye size={13} />, label: 'Đáp án', onClick: () => setViewFiles([fileUrl(`/uploads/homework/${hw.answer_file}`)]) },
      !!hw.can_see_answer && !!hw.solution_video_url && { key: 'video', cls: 'btn-secondary', icon: <Video size={13} />, label: 'Video chữa', onClick: () => setSolutionVideo({ title: hw.title, url: hw.solution_video_url }) },
    ].filter(Boolean) as { key: string; cls: string; icon: React.ReactNode; label: string; onClick: () => void }[];

    return (
      <div key={hw.id} id={`hw-${hw.id}`} className="card" style={{ padding: isMobile ? '0.95rem' : '1.25rem', ...focusRing(`hw-${hw.id}`) }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0, width: isMobile ? '100%' : 'auto' }}>
          {/* Ô biểu tượng trạng thái: điện thoại bỏ đi cho rộng chỗ (trạng thái đã có nhãn "Đã nộp"/"Hết hạn") */}
          {!isMobile && (
            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isSubmitted ? '#E5F1EA' : '#EFEBF5' }}>
              {isSubmitted ? <CheckCircle size={18} color="#3A7D5C" /> : <ClipboardList size={18} color="#6E5A94" />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: '0.72rem', color: '#6E5A94', background: '#EFEBF5', borderRadius: 6, padding: '2px 7px', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, minWidth: 0, lineHeight: 1.35 }}>{hw.title}</span>
              {isSubmitted && <span className="badge badge-green">Đã nộp</span>}
              {!canSubmit && !isSubmitted && <span className="badge badge-gray">Hết hạn</span>}
              {!canSubmit && isSubmitted && !isOverdue && attemptsExhausted && <span className="badge badge-gray">Hết lượt nộp</span>}
            </div>
            {hw.description && <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#6E6E73', lineHeight: 1.5 }}>{hw.description}</p>}

            <div style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#6E6E73' }}>
              <span>Thang điểm: {hw.max_score}</span>
              {hw.due_date && (
                <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} /> Hạn nộp: {new Date(hw.due_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
              {hasAttemptLimit && <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Upload size={11} /> Lượt nộp: {hw.max_attempts - hw.attempts_left}/{hw.max_attempts}</span>}
            </div>
            {hw.exam_type === 'hsa' ? (() => {
              const cfg = parseHsaConfig(hw.hsa_config);
              if (!cfg) return null;
              const mcCount = cfg.questions.filter((q) => q.kind === 'multiple_choice').length;
              const saCount = cfg.questions.length - mcCount;
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span className="badge badge-purple">HSA</span>
                  {mcCount > 0 && <span className="badge badge-purple">Trắc nghiệm ×{mcCount}</span>}
                  {saCount > 0 && <span className="badge badge-purple">Trả lời ngắn ×{saCount}</span>}
                </div>
              );
            })() : (() => {
              const cfg = parsePartsConfig(hw.parts_config);
              if (!cfg) return null;
              const active = PART_ORDER.filter((k: PartKey) => (k === 'essay' ? cfg.essay.enabled : (cfg as any)[k].enabled));
              if (active.length === 0) return null;
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {active.map((k) => {
                    const count = k === 'essay' ? null : (cfg as any)[k].count;
                    return <span key={k} className="badge badge-purple">{PART_LABELS[k]}{count ? ` ×${count}` : ''}</span>;
                  })}
                </div>
              );
            })()}

            {/* Grade display */}
            {hasGrade && (
              <div style={{ marginTop: 12, background: '#F7F7F9', borderRadius: 12, padding: '0.75rem 0.9rem' }}>
                {/* Nhãn + AI chấm ở trên, điểm to bên dưới — gọn trên điện thoại, không phải ép nhiều thứ vào 1 hàng */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#6E6E73' }}>
                  Điểm đạt được
                  {/* !! ép cờ 0/1 từ CSDL về true/false — không thì số 0 bị in ra màn hình */}
                  {!!hw.graded_by_ai && <span className="badge badge-purple" style={{ marginLeft: 'auto' }}><Bot size={10} style={{ marginRight: 4 }} />AI chấm</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: '1.7rem', letterSpacing: '-0.02em', color: hw.score / hw.max_score >= 0.8 ? '#3A7D5C' : hw.score / hw.max_score >= 0.5 ? '#B8673E' : '#B04A2A' }}>{hw.score}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#86868B' }}>/{hw.max_score}</span>
                </div>
                {/* Mở/đóng nhận xét & kết quả từng câu: một dòng riêng ở đáy ô điểm, bấm dễ bằng ngón tay */}
                {!!hw.can_see_answer && !!(hw.feedback || hw.grading_details) && (
                  <button type="button" onClick={() => setOpenGradeDetails((prev) => {
                    const next = new Set(prev);
                    if (next.has(hw.id)) next.delete(hw.id); else next.add(hw.id);
                    return next;
                  })}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%', marginTop: 8, padding: '8px 0 2px', border: 'none', borderTop: '1px solid #E8E8ED', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.84rem', fontWeight: 600, color: '#1F5C68' }}>
                    {openGradeDetails.has(hw.id) ? <>Ẩn nhận xét <ChevronUp size={15} /></> : <>Xem nhận xét &amp; từng câu <ChevronDown size={15} /></>}
                  </button>
                )}
                {/* Nhận xét + chi tiết sai câu nào: chỉ hiện sau khi mở đáp án (theo "Thời gian xem đáp án")
                    VÀ học sinh bấm nút "Chi tiết" — mặc định ẩn cho gọn */}
                {hw.can_see_answer ? (
                  openGradeDetails.has(hw.id) && (
                  <>
                    {hw.feedback && (
                      <div style={{ fontSize: '0.83rem', color: '#515154', lineHeight: 1.6, borderTop: '1px solid #E8E8ED', paddingTop: 8, marginTop: 8 }}>
                        <strong>Nhận xét:</strong> {hw.feedback}
                      </div>
                    )}
                    <GradingDetails details={hw.grading_details} />
                  </>
                  )
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#86868B', borderTop: '1px solid #E8E8ED', paddingTop: 8, marginTop: 8 }}>
                    <Lock size={12} />
                    Nhận xét &amp; chi tiết từng câu sẽ hiển thị cùng lúc với đáp án
                    {hw.answer_visible_date ? ` (lúc ${new Date(hw.answer_visible_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })})` : ''}.
                  </div>
                )}
              </div>
            )}

            {/* Nộp lại, lần mới đang chờ chấm → đang hiện điểm cao nhất của lần trước */}
            {!!hw.showing_best && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#2F6F82' }}>
                Đang hiện điểm cao nhất các lần nộp trước — lần nộp mới đang chờ chấm, chỉ thay nếu điểm cao hơn.
              </div>
            )}

            {/* Đã nộp nhưng chưa có điểm: cho biết hệ thống đang chấm tự động */}
            {isSubmitted && !hasGrade && (hw.grading_status === 'pending' || hw.grading_status === 'grading') && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#2F6F82', background: '#E6F0F3', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                <Bot size={15} /> Đã nhận bài — hệ thống đang tự động chấm, kết quả sẽ hiển thị sau ít phút.
              </div>
            )}
            {isSubmitted && !hasGrade && hw.grading_status === 'failed' && (
              <div style={{ marginTop: 12, fontSize: '0.82rem', color: '#6E6E73', background: '#F2F2F4', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                Đã nhận bài. Giáo viên sẽ chấm và trả điểm sớm.
              </div>
            )}
            {/* Quá hạn mà chưa nộp → tính 0 điểm vào điểm trung bình */}
            {!isSubmitted && !canSubmit && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: '#B04A2A', background: '#F8E6DF', borderRadius: 8, padding: '0.6rem 0.8rem' }}>
                <Lock size={14} /> Quá hạn, không nộp bài — tính <strong>0 điểm</strong> vào điểm trung bình.
              </div>
            )}
          </div>
          </div>

          {/* Actions — máy tính: cột nút bên phải. Điện thoại (.hw-actions-m): lưới 2 cột đều nhau, nút chính
              (Nộp bài / Làm bài) lên đầu rộng cả hàng; số nút phụ lẻ thì nút cuối rộng cả hàng cho cân */}
          <div className={isMobile ? 'hw-actions-m' : undefined}
            style={isMobile ? undefined : { display: 'flex', flexDirection: 'column', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
            {secondaryActions.map((a, k) => (
              <button key={a.key} className={`btn ${a.cls} btn-sm${isMobile && secondaryActions.length % 2 === 1 && k === secondaryActions.length - 1 ? ' hw-wide' : ''}`} onClick={a.onClick}>
                {a.icon} {a.label}
              </button>
            ))}
            {!hw.can_see_answer && hw.answer_visible_date && (
              <span className="hw-wide" style={{ fontSize: '0.72rem', color: '#86868B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <Lock size={11} /> Đáp án mở lúc {new Date(hw.answer_visible_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </span>
            )}
            {canSubmit ? (
              <div className="hw-primary" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {hw.exam_type === 'hsa' ? (
                  <button className="btn btn-primary btn-sm" onClick={() => startExam(hw)}>
                    <Timer size={13} /> {hw.attempt_started_at ? 'Tiếp tục làm bài' : isSubmitted ? 'Làm lại' : 'Làm bài'}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => { setExamDeadline(null); openSubmit(hw); }}>
                    <Upload size={13} /> {isSubmitted ? 'Nộp lại' : 'Nộp bài'}
                  </button>
                )}
                {hw.due_date && (() => {
                  const deadlineRemainMs = new Date(hw.due_date).getTime() - outsideTick;
                  const isDeadlineLow = deadlineRemainMs <= 60 * 60 * 1000;
                  return (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isDeadlineLow ? '#B04A2A' : '#B8673E', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Timer size={11} /> {deadlineRemainMs > 0 ? `Còn ${formatDeadlineRemaining(deadlineRemainMs)}` : 'Đã hết hạn'}
                    </span>
                  );
                })()}
                {hasAttemptLimit && (
                  <span style={{ fontSize: '0.72rem', color: '#86868B' }}>Giới hạn (còn {hw.attempts_left} lần nộp)</span>
                )}
                {hw.exam_type === 'hsa' && hw.time_limit_minutes && (
                  hw.attempt_started_at ? (() => {
                    const remainMs = new Date(hw.attempt_started_at).getTime() + hw.time_limit_minutes * 60000 - outsideTick;
                    const low = remainMs <= 5 * 60 * 1000;
                    return (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: low ? '#B04A2A' : '#B8673E', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Timer size={11} /> {remainMs > 0 ? `Còn ${formatRemainingMs(remainMs)}` : 'Đã hết giờ'}
                      </span>
                    );
                  })() : (
                    <span style={{ fontSize: '0.72rem', color: '#86868B' }}>Thời gian làm bài: {hw.time_limit_minutes} phút</span>
                  )
                )}
              </div>
            ) : !isSubmitted ? (
              !isMobile && <span style={{ fontSize: '0.78rem', color: '#B04A2A' }}>Hết hạn</span> // điện thoại: đã có nhãn "Hết hạn" cạnh tên bài
            ) : !isOverdue && attemptsExhausted && (
              <span className="hw-wide" style={{ fontSize: '0.78rem', color: '#B04A2A', textAlign: 'center' }}>Đã hết lượt nộp lại (tối đa {hw.max_attempts} lần)</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Một chương dạng accordion: bấm để mở/đóng, mở ra mới thấy bài giảng & bài tập
  // Ruột một nhóm: danh sách bài giảng & bài tập. standalone = hiện thẳng (bài chưa phân chương),
  // không nằm trong khung chương nên không cần đường kẻ trên và có đệm trên đầy đủ.
  const renderGroupBody = (group: any, standalone = false) => {
    const lc = group.lessons.length, hc = group.homework.length;
    const lessonsKey = `${group.key}-lessons`, hwKey = `${group.key}-homework`;
    const lessonsOpen = expandedSections.has(lessonsKey), hwOpen = expandedSections.has(hwKey);
    return (
      // Điện thoại: lề trong mỏng hơn để thẻ bài tập lồng bên trong không bị hẹp
      <div style={{ padding: standalone ? (isMobile ? '0.85rem' : '1.25rem') : (isMobile ? '0 0.7rem 0.85rem' : '0 1.25rem 1.25rem'), display: 'flex', flexDirection: 'column', gap: 16, borderTop: standalone ? 'none' : '1px solid #EDEDF0' }}>
        <div style={{ marginTop: standalone ? 0 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: lc > 0 ? 'pointer' : 'default' }} onClick={() => lc > 0 && toggleSection(lessonsKey)}>
            {lc > 0 && (lessonsOpen ? <ChevronDown size={14} color="#A1A1A6" /> : <ChevronRight size={14} color="#A1A1A6" />)}
            <BookOpen size={14} color="#2F6F82" /><span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Bài giảng ({lc})</span>
          </div>
          {lc === 0 ? <div style={{ fontSize: '0.8rem', color: '#A1A1A6' }}>Chưa có bài giảng</div> : lessonsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{group.lessons.map((l: any, i: number) => renderLessonCard(l, i))}</div>
          )}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: hc > 0 ? 'pointer' : 'default' }} onClick={() => hc > 0 && toggleSection(hwKey)}>
            {hc > 0 && (hwOpen ? <ChevronDown size={14} color="#A1A1A6" /> : <ChevronRight size={14} color="#A1A1A6" />)}
            <ClipboardList size={14} color="#6E5A94" /><span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Bài tập ({hc})</span>
          </div>
          {hc === 0 ? <div style={{ fontSize: '0.8rem', color: '#A1A1A6' }}>Chưa có bài tập</div> : hwOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{group.homework.map((hw: any, i: number) => renderHomeworkCard(hw, i))}</div>
          )}
        </div>
      </div>
    );
  };

  const renderChapterAccordion = (group: any, idx: number) => {
    const open = expandedChapters.has(group.key);
    const lc = group.lessons.length, hc = group.homework.length;
    return (
      <div key={group.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div onClick={() => toggleChapter(group.key)} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12, padding: isMobile ? '0.9rem 0.95rem' : '1rem 1.25rem', cursor: 'pointer' }}>
          {open ? <ChevronDown size={18} color="#6E6E73" /> : <ChevronRight size={18} color="#6E6E73" />}
          <div style={{ width: 36, height: 36, background: '#E6F0F3', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontWeight: 700, color: '#2F6F82', fontSize: '0.9rem' }}>{idx + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1D1D1F' }}>{group.chapter.title}</div>
            <div style={{ fontSize: '0.78rem', color: '#6E6E73', marginTop: 2 }}>{lc} bài giảng · {hc} bài tập</div>
          </div>
        </div>
        {open && renderGroupBody(group)}
      </div>
    );
  };

  // Cấu hình các phần của bài đang nộp (cho modal làm bài)
  const isHsaSubmit = submitting?.exam_type === 'hsa';
  const hsaCfg: HsaConfig | null = isHsaSubmit ? parseHsaConfig(submitting?.hsa_config) : null;
  const submitCfg = isHsaSubmit ? null : parsePartsConfig(submitting?.parts_config);
  const submitObjective = isHsaSubmit ? true : hasObjectiveParts(submitCfg);
  const submitEssay = isHsaSubmit ? false : (hasEssay(submitCfg) || !submitCfg); // bài cũ (không cfg) coi như chỉ tự luận
  const canDoSubmit = isHsaSubmit ? true : (submitObjective || submitFiles.length > 0);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1.5rem' }}>
        <Link to="/student" style={{ color: '#6E6E73', textDecoration: 'none', marginTop: 4 }}>
          <ChevronLeft size={18} />
        </Link>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {cls.course_title && <span className="badge badge-blue">{cls.course_title}</span>}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>{cls.title}</h1>
          <p style={{ color: '#6E6E73', margin: '4px 0 0', fontSize: '0.88rem' }}>Giáo viên: <strong>{cls.teacher_name}</strong></p>
        </div>
      </div>

      {/* Điểm TB + xếp hạng THÁNG NÀY (reset theo tháng; bài quá hạn chưa nộp tính 0 điểm) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#FBEEE6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={20} color="#B8673E" />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#B8673E', lineHeight: 1.1 }}>{cls.my_avg ?? '—'}<span style={{ fontSize: '0.8rem', color: '#AEAEB2', fontWeight: 600 }}>/10</span></div>
            <div style={{ fontSize: '0.76rem', color: '#6E6E73' }}>Điểm TB tháng này</div>
          </div>
        </div>
        <div className="card" style={{ flex: '1 1 180px', display: 'flex', alignItems: 'center', gap: 12, padding: '0.9rem 1.1rem' }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: '#EFEBF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={20} color="#6E5A94" />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6E5A94', lineHeight: 1.1 }}>
              {cls.my_rank ? <>Hạng {cls.my_rank}<span style={{ fontSize: '0.8rem', color: '#AEAEB2', fontWeight: 600 }}>/{cls.rank_total}</span></> : '—'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#6E6E73' }}>Xếp hạng tháng này</div>
          </div>
        </div>
      </div>

      {/* Tabs: Nội dung / Bài tập cần làm / Xếp hạng */}
      <div style={{ display: 'flex', gap: 4, background: '#F2F2F4', padding: 4, borderRadius: 10, marginBottom: '1.25rem', width: isMobile ? '100%' : 'fit-content', flexWrap: 'wrap' }}>
        {[
          { key: 'content' as const, label: 'Nội dung', icon: Layers },
          { key: 'todo' as const, label: `Bài tập cần làm (${todoHomework.length})`, icon: ClipboardList },
          { key: 'ranking' as const, label: 'Xếp hạng', icon: Trophy },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} className="btn"
            style={{ background: activeTab === key ? 'white' : 'transparent', boxShadow: activeTab === key ? '0 2px 6px rgba(0,0,0,0.08)' : 'none', color: activeTab === key ? '#1F5C68' : '#6E6E73', border: 'none', gap: 6 }}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Danh sách chương → mở chương ra mới thấy bài giảng & bài tập. Đại số trước, Hình học sau. */}
      {activeTab === 'content' && (
        contentSections.length === 0 && !orphanGroup ? (
          <div style={{ textAlign: 'center', color: '#86868B', padding: '2rem', background: 'white', borderRadius: 12 }}>Chưa có nội dung</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {contentSections.map((sec) => (
              <div key={sec.key}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1D1D1F', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: sec.color, display: 'inline-block' }} /> {sec.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sec.groups.map((g, i) => renderChapterAccordion(g, i))}
                </div>
              </div>
            ))}
            {/* Bài chưa phân chương: hiện thẳng bài giảng & bài tập, không có khung "Chưa phân chương" */}
            {orphanGroup && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {renderGroupBody(orphanGroup, true)}
              </div>
            )}
          </div>
        )
      )}

      {/* Bài tập cần làm: chỉ bài có hạn & chưa nộp, nộp bài ngay tại đây (dùng chung thẻ bài tập) */}
      {activeTab === 'todo' && (
        todoHomework.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#86868B', padding: '2rem', background: 'white', borderRadius: 12 }}>
            <CheckCircle size={36} color="#3A7D5C" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div>Không có bài tập nào cần nộp</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todoHomework.map((hw, i) => renderHomeworkCard(hw, i))}
          </div>
        )
      )}

      {/* Xếp hạng cả lớp theo tháng (giống giáo viên, ẩn tên đăng nhập của các bạn, tô dòng của mình) */}
      {activeTab === 'ranking' && <RankingBoard url={`/student/my-classes/${id}/ranking`} />}

      {/* View Lesson Modal */}
      <Modal open={viewLessonModal} onClose={() => setViewLessonModal(false)} title={viewingLesson?.title || ''} size="xl">
        {viewingLesson?.video_url && <VideoPlayer url={viewingLesson.video_url} type={viewingLesson.video_type} />}
        {viewingLesson?.description && <p style={{ color: '#515154', marginTop: 12, lineHeight: 1.6 }}>{viewingLesson.description}</p>}
        {viewingLesson && parseAttachments(viewingLesson.attachments).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Paperclip size={14} /> Tài liệu đính kèm
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {parseAttachments(viewingLesson.attachments).map((a) => (
                <div key={a.file} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', background: '#FAFAFC', border: '1px solid #E8E8ED', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  <FileText size={15} color={a.kind === 'answer' ? '#3A7D5C' : '#B8673E'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name} <span className={`badge ${a.kind === 'answer' ? 'badge-green' : 'badge-orange'}`} style={{ marginLeft: 6 }}>{a.kind === 'answer' ? 'Đáp án BT trên lớp' : 'Tài liệu bài giảng'}</span>
                  </span>
                  {isViewableFile(a.file) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setViewFiles([fileUrl(`/uploads/lessons/${a.file}`)])}><Eye size={13} /> Xem</button>
                  )}
                  <a className="btn btn-ghost btn-sm" href={fileUrl(`/uploads/lessons/${a.file}`)} download={a.name}><Download size={13} /> Tải về</a>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Solution Video Modal */}
      <Modal open={!!solutionVideo} onClose={() => setSolutionVideo(null)} title={solutionVideo ? `Video chữa: ${solutionVideo.title}` : ''} size="xl">
        {solutionVideo && <VideoPlayer url={solutionVideo.url} type="youtube" />}
      </Modal>

      {/* Submit Homework — toàn màn hình, chia đôi đề/bài làm trên máy tính */}
      <SubmitHomeworkView
        open={submitModal}
        onClose={() => setSubmitModal(false)}
        title={`Làm bài: ${submitting?.title || ''}`}
        pdfUrl={submitting?.pdf_file ? fileUrl(`/uploads/homework/${submitting.pdf_file}`) : null}
        submitObjective={submitObjective}
        submitEssay={submitEssay}
        cfg={submitCfg}
        studentAnswers={studentAnswers}
        onAnswersChange={setStudentAnswers}
        examType={submitting?.exam_type === 'hsa' ? 'hsa' : 'thpt'}
        hsaCfg={hsaCfg}
        hsaAnswers={hsaAnswers}
        onHsaAnswersChange={setHsaAnswers}
        submitFiles={submitFiles}
        onAddFiles={addFiles}
        onRemoveFile={removeFile}
        loading={loading}
        canDoSubmit={canDoSubmit}
        onSubmit={doSubmit}
        examDeadline={examDeadline}
        dueDate={submitting?.due_date || null}
      />

      {/* File Viewer */}
      {viewFiles && <FileViewer files={viewFiles} onClose={() => setViewFiles(null)} />}
    </div>
  );
}
