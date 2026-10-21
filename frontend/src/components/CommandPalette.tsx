import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, School, BookOpen, Home, CornerDownLeft, PlayCircle, ClipboardList, type LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { navItemsFor } from '../lib/navigation';

// Tìm nhanh (Ctrl/⌘+K): gõ tên trang, lớp, khóa học, bài giảng hoặc bài tập rồi Enter để mở ngay.
// Bài giảng / bài tập chỉ hiện khi đã gõ từ khóa (để danh sách mặc định gọn).
// Tìm không phân biệt dấu ("toan 12" khớp "Toán 12").

const OPEN_EVENT = 'tc-open-palette';
export const openPalette = () => window.dispatchEvent(new Event(OPEN_EVENT));

type Item = { id: string; group: string; label: string; sub?: string; to: string; icon: LucideIcon };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<{ classes: Item[]; courses: Item[]; lessons: Item[]; homework: Item[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(OPEN_EVENT, onOpen); window.removeEventListener('keydown', onKey); };
  }, []);

  // Tải danh sách lớp & khóa học của người dùng lần đầu mở
  useEffect(() => {
    if (!open || !user) return;
    setQ(''); setSel(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    if (data) return;
    const role = user.role;
    const classUrl = role === 'student' ? '/student/my-classes' : '/teacher/classes';
    const courseUrl = role === 'student' ? '/student/my-courses' : role === 'teacher' ? '/teacher/my-courses' : '/admin/courses';
    const indexUrl = role === 'student' ? '/student/search-index' : '/teacher/search-index';
    const base = role === 'student' ? '/student/classes' : '/teacher/classes';
    Promise.all([
      api.get(classUrl).catch(() => ({ data: [] })),
      api.get(courseUrl).catch(() => ({ data: [] })),
      api.get(indexUrl).catch(() => ({ data: { lessons: [], homework: [] } })),
    ]).then(([c, co, idx]) => {
      const where = (x: any) => [x.class_title, x.chapter_title].filter(Boolean).join(' · ');
      setData({
        lessons: (idx.data?.lessons || []).map((x: any) => ({
          id: `l${x.id}`, group: 'Bài giảng', label: x.title, sub: where(x), icon: PlayCircle,
          to: `${base}/${x.class_id}?lesson=${x.id}`,
        })),
        homework: (idx.data?.homework || []).map((x: any) => ({
          id: `h${x.id}`, group: 'Bài tập', label: x.title, sub: where(x), icon: ClipboardList,
          to: role === 'student' ? `${base}/${x.class_id}?hw=${x.id}` : `/teacher/homework/${x.id}`,
        })),
        classes: (c.data || []).map((x: any) => ({
          id: `c${x.id}`, group: 'Lớp học', label: x.title, sub: x.course_title || '', icon: School,
          to: role === 'student' ? `/student/classes/${x.id}` : `/teacher/classes/${x.id}`,
        })),
        courses: (co.data || []).map((x: any) => ({
          id: `k${x.id}`, group: 'Khóa học', label: x.title, sub: '', icon: BookOpen,
          to: role === 'student' ? `/student/courses/${x.id}` : role === 'teacher' ? `/teacher/courses/${x.id}` : `/admin/courses/${x.id}`,
        })),
      });
    });
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    if (!user) return [];
    const pages: Item[] = [
      ...navItemsFor(user.role).map((n) => ({ id: `p${n.to}`, group: 'Trang', label: n.label, to: n.to, icon: n.icon })),
      { id: 'home', group: 'Trang', label: 'Trang chủ', to: '/', icon: Home },
    ];
    const base = [...pages, ...(data?.classes || []), ...(data?.courses || [])];
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return base.slice(0, 40);
    const all = [...base, ...(data?.lessons || []), ...(data?.homework || [])];
    return all.filter((it) => { const hay = fold(`${it.label} ${it.sub || ''}`); return words.every((w) => hay.includes(w)); }).slice(0, 60);
  }, [q, data, user]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('.palette-item.selected')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open || !user) return null;

  const go = (it?: Item) => { if (!it) return; setOpen(false); navigate(it.to); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[sel]); }
  };

  let lastGroup = '';
  return (
    <div className="palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette" role="dialog" aria-label="Tìm nhanh">
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: 17, top: '50%', transform: 'translateY(-50%)', color: '#86868B' }} />
          <input ref={inputRef} className="palette-input" placeholder="Tìm trang, lớp, khóa học, bài giảng, bài tập…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} />
        </div>
        <div className="palette-results" ref={listRef}>
          {items.length === 0 && <div className="list-empty">Không tìm thấy kết quả</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            const Icon = it.icon;
            return (
              <div key={it.id}>
                {head && <div className="palette-group">{head}</div>}
                <div className={`palette-item ${i === sel ? 'selected' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
                  <Icon size={18} color={i === sel ? '#fff' : '#6E6E73'} />
                  <span style={{ fontWeight: 500 }}>{it.label}</span>
                  {it.sub ? <span className="palette-sub">{it.sub}</span> : i === sel ? <CornerDownLeft size={15} style={{ marginLeft: 'auto' }} /> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '8px 16px', fontSize: '0.76rem', color: '#86868B', display: 'flex', gap: 14 }}>
          <span>↑↓ chọn</span><span>Enter mở</span><span>Esc đóng</span>
        </div>
      </div>
    </div>
  );
}
