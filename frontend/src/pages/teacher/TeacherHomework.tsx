import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Search, ChevronRight, Plus, Bot, Layers } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState, urgencyColor } from '../../components/ui';
import { parsePartsConfig, PART_LABELS, PART_ORDER } from '../../lib/homeworkParts';
import useIsMobile from '../../lib/useIsMobile';

type Cls = { id: number; title: string; course_title: string | null; student_count: number };
type Hw = {
  id: number; class_id: number; title: string; due_date: string | null; created_at: string; max_score: number | null;
  exam_type: string | null; parts_config: string | null; chapter_title: string | null;
  submitted: number; to_grade: number; ai_pending: number; avg_score: number | null;
};
type Status = 'all' | 'open' | 'closed' | 'grade';

const STATUS: { id: Status; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'open', label: 'Còn hạn' },
  { id: 'closed', label: 'Đã hết hạn' },
  { id: 'grade', label: 'Chờ chấm' },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const hm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// Loại bài ngắn gọn: HSA / các phần (Trắc nghiệm · Tự luận …) / Tự luận (bài cũ không cấu hình phần)
function kindLabel(h: Hw) {
  if (h.exam_type === 'hsa') return 'HSA';
  const cfg = parsePartsConfig(h.parts_config);
  if (!cfg) return 'Tự luận';
  return PART_ORDER.filter((k) => cfg[k].enabled).map((k) => PART_LABELS[k]).join(' · ');
}

// Mục "Bài tập" của giáo viên — chia theo lớp, gọn cả khi dạy nhiều lớp:
//  - Máy tính: cột trái là danh sách lớp (tìm lớp, số bài, số bài chờ chấm), cột phải là bài tập của lớp đang chọn.
//  - Điện thoại: chọn lớp bằng ô thả xuống.
//  - "Tất cả lớp": 1 danh sách chung (sắp theo hạn nộp), mỗi bài ghi tên lớp.
// Lớp, bộ lọc nhớ trên link (?lop=…&loc=…). Bấm 1 bài → mở thẳng trang bài đó (bài nộp, chấm điểm).
export default function TeacherHomework() {
  const isMobile = useIsMobile(860);
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{ classes: Cls[]; homework: Hw[] } | null>(null);
  const [q, setQ] = useState('');
  const [classQ, setClassQ] = useState('');
  const classId = Number(params.get('lop')) || 0;
  const status = (params.get('loc') as Status) || 'all';
  const now = Date.now();

  useEffect(() => { api.get('/teacher/homework').then((r) => setData(r.data)).catch(() => setData({ classes: [], homework: [] })); }, []);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const isOpen = (h: Hw) => !h.due_date || new Date(h.due_date).getTime() > now;
  const shown = useMemo(() => {
    if (!data) return [];
    const term = fold(q.trim());
    return data.homework.filter((h) => (!classId || h.class_id === classId)
      && (status === 'all' || (status === 'open' ? isOpen(h) : status === 'closed' ? !isOpen(h) : h.to_grade > 0))
      && (!term || fold(`${h.title} ${h.chapter_title || ''}`).includes(term)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, classId, status, q]);

  if (!data) return <div style={{ color: '#86868B', padding: '3rem 0', textAlign: 'center' }}>Đang tải...</div>;

  const stats = new Map<number, { n: number; grade: number }>();
  data.homework.forEach((h) => {
    const s = stats.get(h.class_id) || { n: 0, grade: 0 };
    s.n++; s.grade += h.to_grade; stats.set(h.class_id, s);
  });
  const totalToGrade = data.homework.reduce((s, h) => s + h.to_grade, 0);
  const current = data.classes.find((c) => c.id === classId) || null;
  const classById = new Map(data.classes.map((c) => [c.id, c]));
  const classTerm = fold(classQ.trim());
  const classList = data.classes.filter((c) => !classTerm || fold(`${c.title} ${c.course_title || ''}`).includes(classTerm));

  if (data.classes.length === 0) {
    return (
      <div className="fade-in">
        <PageHeader eyebrow="Bài tập" title="Bài tập theo lớp" />
        <EmptyState icon={<ClipboardList size={32} />} title="Chưa có lớp nào" text="Vào Khóa học để tạo lớp, sau đó giao bài tập trong từng chương của lớp." />
      </div>
    );
  }

  // ── Cột trái: danh sách lớp ──
  const classPicker = isMobile ? (
    <select className="input" value={classId || ''} onChange={(e) => setParam('lop', e.target.value)} style={{ marginBottom: 12, fontWeight: 600 }}>
      <option value="">Tất cả lớp ({data.homework.length} bài)</option>
      {data.classes.map((c) => {
        const s = stats.get(c.id);
        return <option key={c.id} value={c.id}>{c.title} — {s?.n || 0} bài{s?.grade ? ` · ${s.grade} chờ chấm` : ''}</option>;
      })}
    </select>
  ) : (
    <aside className="hw-side">
      {data.classes.length > 6 && (
        <label className="hw-search" style={{ marginBottom: 8 }}>
          <Search size={14} />
          <input value={classQ} onChange={(e) => setClassQ(e.target.value)} placeholder="Tìm lớp…" />
        </label>
      )}
      <div className="hw-side-list">
        <button type="button" className={`hw-side-item ${!classId ? 'active' : ''}`} onClick={() => setParam('lop', '')}>
          <Layers size={16} style={{ flexShrink: 0 }} />
          <span className="hw-side-name">Tất cả lớp</span>
          <span className="hw-side-count">{data.homework.length}</span>
        </button>
        {classList.map((c) => {
          const s = stats.get(c.id);
          return (
            <button key={c.id} type="button" className={`hw-side-item ${classId === c.id ? 'active' : ''}`} onClick={() => setParam('lop', String(c.id))}>
              <span className="hw-side-name">
                {c.title}
                {c.course_title && <small>{c.course_title}</small>}
              </span>
              {!!s?.grade && <span className="hw-side-grade" title={`${s.grade} bài nộp chờ chấm`}>{s.grade}</span>}
              <span className="hw-side-count">{s?.n || 0}</span>
            </button>
          );
        })}
        {classList.length === 0 && <div style={{ fontSize: '0.82rem', color: '#86868B', padding: '8px 10px' }}>Không có lớp nào khớp.</div>}
      </div>
    </aside>
  );

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Bài tập" title="Bài tập theo lớp"
        subtitle={`${data.homework.length} bài tập · ${data.classes.length} lớp${totalToGrade ? ` · ${totalToGrade} bài nộp chờ chấm` : ''}`} />

      <div className={isMobile ? '' : 'hw-layout'}>
        {classPicker}

        <div style={{ minWidth: 0 }}>
          {/* Tiêu đề lớp đang xem + lọc + tìm */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              {current ? current.title : 'Tất cả lớp'}
              <span style={{ color: '#86868B', fontWeight: 500, marginLeft: 8 }}>{shown.length}</span>
              {current && <span style={{ color: '#86868B', fontWeight: 500, fontSize: '0.8rem', marginLeft: 8 }}>{current.student_count} học sinh</span>}
            </h2>
            {current && (
              <Link to={`/teacher/classes/${current.id}`} className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <Plus size={14} /> Giao bài cho lớp này
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <div className="segmented">
              {STATUS.map((s) => (
                <button key={s.id} type="button" className={status === s.id ? 'active' : ''} onClick={() => setParam('loc', s.id === 'all' ? '' : s.id)}>{s.label}</button>
              ))}
            </div>
            <label className="hw-search">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm bài tập, chương…" />
            </label>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={<ClipboardList size={30} />}
              title={q || status !== 'all' ? 'Không có bài nào khớp bộ lọc' : current ? 'Lớp này chưa có bài tập' : 'Chưa có bài tập nào'}
              text={q || status !== 'all' ? undefined : 'Mở lớp → chọn chương → thêm bài tập.'} />
          ) : (
            <div className="list">
              {shown.map((h) => {
                const c = classById.get(h.class_id);
                const total = c?.student_count || 0;
                const left = h.due_date ? new Date(h.due_date).getTime() - now : null;
                const passed = left !== null && left <= 0;
                const pct = total > 0 ? Math.min(100, Math.round((h.submitted / total) * 100)) : 0;
                return (
                  <Link key={h.id} to={`/teacher/homework/${h.id}`} className="list-row hw-row">
                    <span className="hw-due">
                      {h.due_date ? (
                        <>
                          <span style={{ fontWeight: 700, fontSize: '0.98rem', color: passed ? '#86868B' : urgencyColor(left!) }}>{dayMonth(h.due_date)}</span>
                          <span style={{ fontSize: '0.7rem', color: '#86868B' }}>{passed ? 'đã hết hạn' : hm(h.due_date)}</span>
                        </>
                      ) : <span style={{ fontSize: '0.72rem', color: '#86868B' }}>không<br />hạn nộp</span>}
                    </span>
                    <div className="list-row-main">
                      <div className="list-row-title">{h.title}</div>
                      <div className="list-row-sub">
                        {!current && c && <span className="hw-class-tag">{c.title}</span>}
                        {[h.chapter_title, kindLabel(h), h.max_score ? `thang ${h.max_score}` : null].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="hw-stats">
                      <div className="hw-progress" title={`${h.submitted}/${total} học sinh đã nộp`}>
                        <span>{h.submitted}/{total} đã nộp</span>
                        <span className="hw-bar"><span style={{ width: `${pct}%` }} /></span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {h.to_grade > 0 && <span className="badge badge-orange">{h.to_grade} chờ chấm</span>}
                        {h.ai_pending > 0 && <span className="badge badge-blue"><Bot size={11} style={{ marginRight: 3 }} />AI đang chấm {h.ai_pending}</span>}
                        {h.avg_score != null && <span className="badge badge-gray">TB {String(h.avg_score).replace('.', ',')}</span>}
                      </div>
                    </div>
                    <ChevronRight size={18} color="#C7C7CC" style={{ flexShrink: 0 }} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
