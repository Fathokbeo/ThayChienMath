import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, FileText, FolderOpen, Star, ClipboardCheck, GraduationCap, Copy, BookOpen, Layers } from 'lucide-react';
import { gradeLabel } from '../lib/publicSite';
import useIsMobile from '../lib/useIsMobile';

export type ExamMenuGroup = { label: string; grades: string[] };
export type ExamMeta = { grades: string[]; categories: string[]; menu: ExamMenuGroup[]; counts: Record<string, Record<string, number>> };

// Biểu tượng theo tên loại đề (đoán theo từ khóa, giống các trang kho đề quen thuộc)
function CategoryIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const I = /tài liệu/.test(n) ? FolderOpen : /cương/.test(n) ? FileText : /giữa/.test(n) ? Star : /hk|học kỳ|học kì/.test(n) ? Star
    : /khảo sát|thi thử/.test(n) ? ClipboardCheck : /hsg|giỏi/.test(n) ? GraduationCap : /giáo án/.test(n) ? Copy : /sgk|sbt|sách/.test(n) ? BookOpen : FileText;
  return <I size={15} fill={/^(?!.*giữa).*(hk|học k)/.test(n) ? 'currentColor' : 'none'} />;
}

const total = (c?: Record<string, number>) => Object.values(c || {}).reduce((s, n) => s + n, 0);

type Props = {
  meta: ExamMeta;
  activeGrade?: string;
  activeCategory?: string;
  // Trang công khai: đường dẫn; trang quản trị: hàm chọn (không đổi trang)
  hrefFor?: (grade: string, category?: string) => string;
  onPick?: (grade: string, category?: string) => void;
  showEmpty?: boolean; // quản trị: hiện cả loại chưa có đề (để biết còn thiếu gì)
};

// Thanh menu đề: mỗi mục (vd "Toán 10", "THCS") bấm/rê chuột thì thả xuống danh sách — mục 1 lớp → các loại đề
// của lớp đó; mục nhiều lớp → các lớp. Điện thoại: thanh cuộn ngang, danh sách thả xuống chiếm cả chiều ngang.
export default function ExamMenuBar({ meta, activeGrade, activeCategory, hrefFor, onPick, showEmpty }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState<number | null>(null);
  const [dropLeft, setDropLeft] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open === null) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openAt = (i: number, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current);
    const wrap = wrapRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setDropLeft(Math.max(0, Math.min(r.left - wrap.left, wrap.width - 300)));
    setOpen(i);
  };
  const closeSoon = () => { closeTimer.current = window.setTimeout(() => setOpen(null), 180); };

  const Item = ({ grade, category, children }: { grade: string; category?: string; children: React.ReactNode }) => {
    const active = activeGrade === grade && (activeCategory || '') === (category || '');
    const cls = `exam-menu-link ${active ? 'active' : ''}`;
    const done = () => setOpen(null);
    return hrefFor
      ? <Link to={hrefFor(grade, category)} className={cls} onClick={done}>{children}</Link>
      : <button type="button" className={cls} onClick={() => { onPick?.(grade, category); done(); }}>{children}</button>;
  };
  const Count = ({ n }: { n: number }) => <span className="exam-menu-count">{n}</span>;

  const group = open !== null ? meta.menu[open] : null;
  const dropdown = group && (
    <div className="exam-menu-drop" style={isMobile ? { left: 0, right: 0 } : { left: dropLeft }}
      onMouseEnter={() => window.clearTimeout(closeTimer.current)} onMouseLeave={isMobile ? undefined : closeSoon}>
      {group.grades.length === 1 ? (() => {
        const g = group.grades[0];
        const c = meta.counts[g] || {};
        const cats = meta.categories.filter((cat) => showEmpty || c[cat]);
        return (
          <>
            <Item grade={g}><Layers size={15} /> Tất cả đề {group.label} <Count n={total(c)} /></Item>
            {cats.map((cat) => <Item key={cat} grade={g} category={cat}><CategoryIcon name={cat} /> {cat} <Count n={c[cat] || 0} /></Item>)}
            {!!c[''] && showEmpty && <Item grade={g} category="__none"><FileText size={15} /> Chưa phân loại <Count n={c['']} /></Item>}
            {!cats.length && !showEmpty && total(c) === 0 && <div className="exam-menu-empty">Chưa có đề</div>}
          </>
        );
      })() : group.grades.map((g) => (
        <Item key={g} grade={g}><GraduationCap size={15} /> {gradeLabel(g)} <Count n={total(meta.counts[g])} /></Item>
      ))}
    </div>
  );

  return (
    <div ref={wrapRef} className="exam-menu">
      <nav className="exam-menu-bar" aria-label="Chọn lớp và loại đề">
        {meta.menu.map((m, i) => {
          const active = !!activeGrade && m.grades.includes(activeGrade);
          return (
            <button key={m.label + i} type="button" className={`exam-menu-top ${active ? 'active' : ''} ${open === i ? 'open' : ''}`}
              aria-expanded={open === i}
              onClick={(e) => (open === i ? setOpen(null) : openAt(i, e.currentTarget))}
              onMouseEnter={isMobile ? undefined : (e) => openAt(i, e.currentTarget)}
              onMouseLeave={isMobile ? undefined : closeSoon}>
              <BookOpen size={15} /> {m.label} <ChevronDown size={14} className="exam-menu-chev" />
            </button>
          );
        })}
      </nav>
      {dropdown}
    </div>
  );
}
