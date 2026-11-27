import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, X, FileText, ArrowUpRight, Clock } from 'lucide-react';
import api, { fileUrl } from '../lib/api';
import { examHref, gradeLabel } from '../lib/publicSite';
import type { ExamItem } from './ExamCard';

// Ô tìm đề trên thanh trên cùng của trang công khai.
//   variant="bar"  (máy tính): ô tìm kiếm luôn hiện, gõ tới đâu hiện kết quả tới đó trong khung thả xuống ngay dưới ô.
//   variant="icon" (điện thoại): nút kính lúp → mở trang tìm kiếm phủ toàn màn hình (ô nhập + nút Hủy kiểu iPhone).
// Tìm không phân biệt dấu ("giua ky" ra "giữa kỳ"), khớp cả tên đề, lớp ("lop 9") và loại đề ("hsg").

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const MAX_SHOWN = 6;
const RECENT_KEY = 'exam-search-recent';

// Danh sách đề + lớp tải một lần cho cả trang (mở lại ô tìm kiếm không gọi lại máy chủ)
let cache: Promise<{ exams: ExamItem[]; grades: string[] }> | null = null;
function loadData() {
  if (!cache) {
    cache = Promise.all([
      api.get('/public/exams').then((r) => r.data as ExamItem[]).catch(() => []),
      api.get('/public/exam-meta').then((r) => (r.data?.grades || []) as string[]).catch(() => []),
    ]).then(([exams, grades]) => ({ exams, grades }));
    cache.then((d) => { if (!d.exams.length) cache = null; }); // lỗi mạng → lần sau thử lại
  }
  return cache;
}

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x: unknown) => typeof x === 'string').slice(0, 5); } catch { return []; }
}
function pushRecent(q: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => fold(x) !== fold(q))].slice(0, 5))); } catch { /* chế độ ẩn danh */ }
}

// Tô đậm phần khớp trong tên đề. fold() giữ nguyên số ký tự của chuỗi dạng NFC nên vị trí khớp dùng lại được cho chuỗi gốc.
function highlight(text: string, words: string[]): ReactNode {
  const src = text.normalize('NFC');
  const f = fold(src);
  const marks = new Array(src.length).fill(false);
  words.forEach((w) => { let i = f.indexOf(w); while (w && i >= 0) { for (let k = i; k < i + w.length; k++) marks[k] = true; i = f.indexOf(w, i + w.length); } });
  const out: ReactNode[] = [];
  let i = 0;
  while (i < src.length) {
    let j = i; while (j < src.length && marks[j] === marks[i]) j++;
    out.push(marks[i] ? <mark key={i} className="xs-hit">{src.slice(i, j)}</mark> : src.slice(i, j));
    i = j;
  }
  return out;
}

function useResults(q: string, exams: ExamItem[]) {
  return useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return { words, list: [] as ExamItem[] };
    const scored = exams.map((e, idx) => {
      const title = fold(e.title || '');
      const hay = `${title} ${fold(gradeLabel(e.grade))} ${fold(e.category || '')}`;
      if (!words.every((w) => (/^\d+$/.test(w) ? new RegExp(`(^|\\D)${w}(\\D|$)`).test(hay) : hay.includes(w)))) return null; // số khớp nguyên số
      // Ưu tiên: cả cụm khớp liền trong tên đề → từ khớp ở tên đề sớm → đề mới hơn (danh sách đã xếp mới trước)
      const phrase = title.includes(words.join(' ')) ? 0 : 1;
      const firstPos = Math.min(...words.map((w) => { const p = title.indexOf(w); return p < 0 ? 999 : p; }));
      return { e, key: phrase * 100000 + Math.min(firstPos, 999) * 100 + idx };
    }).filter(Boolean) as { e: ExamItem; key: number }[];
    scored.sort((a, b) => a.key - b.key);
    return { words, list: scored.map((s) => s.e) };
  }, [q, exams]);
}

// Nội dung khung kết quả, dùng chung cho máy tính (thả xuống) và điện thoại (toàn màn hình)
function Results({ q, words, list, grades, active, onPick, onSearchAll, onRecent, onClearRecent }: {
  q: string; words: string[]; list: ExamItem[]; grades: string[]; active: number;
  onPick: () => void; onSearchAll: () => void; onRecent: (q: string) => void; onClearRecent: () => void;
}) {
  const recent = readRecent();
  const chips = grades.length > 0 && (
    <div className="xs-chips">
      {grades.map((g) => <Link key={g} to={examHref(g)} className="xs-chip" onClick={onPick}>{gradeLabel(g)}</Link>)}
    </div>
  );
  if (!words.length) {
    return (
      <>
        {recent.length > 0 && (
          <div className="xs-sec">
            <div className="xs-sec-head"><span>Tìm gần đây</span><button type="button" onClick={onClearRecent}>Xóa</button></div>
            {recent.map((r) => (
              <button key={r} type="button" className="xs-recent" onClick={() => onRecent(r)}><Clock size={15} /> {r}</button>
            ))}
          </div>
        )}
        <div className="xs-sec">
          <div className="xs-sec-head"><span>Xem đề theo lớp</span></div>
          {chips}
        </div>
        <div className="xs-tip">Gõ tên đề, trường, kỳ thi — vd <b>giữa kỳ lớp 9</b>, <b>Trưng Vương</b>, <b>HSG</b></div>
      </>
    );
  }
  if (!list.length) {
    return (
      <div className="xs-empty">
        <div className="xs-empty-title">Không có đề nào khớp “{q.trim()}”</div>
        <div className="xs-empty-sub">Thử từ khóa ngắn hơn, hoặc xem đề theo lớp:</div>
        {chips}
      </div>
    );
  }
  return (
    <>
      <div className="xs-sec-head xs-pad"><span>Đề thi</span><span className="xs-count">{list.length} kết quả</span></div>
      <ul className="xs-list" role="listbox" aria-label="Kết quả tìm đề">
        {list.slice(0, MAX_SHOWN).map((e, i) => (
          <li key={e.id} role="option" aria-selected={i === active}>
            <Link to={`/de-thi/${e.id}`} className={`xs-item ${i === active ? 'active' : ''}`} onClick={onPick}>
              <span className="xs-thumb">
                {e.thumbnail ? <img src={fileUrl(`/uploads/exams/${e.thumbnail}`)} alt="" loading="lazy" /> : <FileText size={18} color="#9CC7D2" />}
              </span>
              <span className="xs-text">
                <span className="xs-title">{highlight(e.title, words)}</span>
                <span className="xs-meta">{[gradeLabel(e.grade), e.category].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" className={`xs-all ${active === Math.min(list.length, MAX_SHOWN) ? 'active' : ''}`} onClick={onSearchAll}>
        <Search size={15} /> Xem tất cả {list.length} đề cho “{q.trim()}” <ArrowUpRight size={15} style={{ marginLeft: 'auto' }} />
      </button>
    </>
  );
}

export default function ExamSearch({ variant }: { variant: 'bar' | 'icon' }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(-1);
  const [data, setData] = useState<{ exams: ExamItem[]; grades: string[] }>({ exams: [], grades: [] });
  const [, bump] = useState(0); // vẽ lại sau khi xóa "Tìm gần đây"
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { words, list } = useResults(q, data.exams);
  const shownCount = Math.min(list.length, MAX_SHOWN);

  const openSearch = () => { setOpen(true); loadData().then(setData); };
  const close = () => { setOpen(false); setActive(-1); };

  // Đổi trang → đóng khung tìm kiếm
  useEffect(() => { close(); }, [pathname, search]);
  useEffect(() => { setActive(-1); }, [q]);

  // Máy tính: bấm ra ngoài ô → đóng. Điện thoại: khóa cuộn trang nền khi đang mở trang tìm kiếm
  useEffect(() => {
    if (!open) return;
    if (variant === 'icon') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 30);
      return () => { document.body.style.overflow = prev; };
    }
    const onDown = (e: PointerEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) close(); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, variant]);

  // Phím "/" ở bất kỳ đâu trên trang → nhảy vào ô tìm đề (máy tính)
  useEffect(() => {
    if (variant !== 'bar') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault(); inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant]);

  const searchAll = (text = q) => {
    const t = text.trim();
    if (!t) return;
    pushRecent(t);
    inputRef.current?.blur();
    navigate(`/de-thi?q=${encodeURIComponent(t)}`);
    close();
  };
  const onPick = () => { if (q.trim()) pushRecent(q.trim()); close(); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { if (q) setQ(''); else { close(); inputRef.current?.blur(); } return; }
    if (!words.length || !list.length) { if (e.key === 'Enter') { e.preventDefault(); searchAll(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % (shownCount + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? shownCount : a - 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < shownCount) { onPick(); navigate(`/de-thi/${list[active].id}`); }
      else searchAll();
    }
  };

  // Trang kho đề đã có ô tìm riêng ngay trong trang → không hiện thêm ô thứ hai trên thanh
  if (pathname === '/de-thi') return null;

  const field = (
    <div className={`xs-field ${variant === 'icon' ? 'xs-field-lg' : ''}`}>
      <Search size={variant === 'icon' ? 18 : 16} className="xs-glass" />
      <input
        ref={inputRef} type="search" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
        value={q} onChange={(e) => { setQ(e.target.value); if (!open) openSearch(); }}
        onFocus={openSearch} onKeyDown={onKeyDown}
        placeholder="Tìm đề thi, tài liệu…" aria-label="Tìm đề thi"
        role="combobox" aria-expanded={open} aria-autocomplete="list"
      />
      {q ? (
        <button type="button" className="xs-clear" aria-label="Xóa chữ đã gõ" onClick={() => { setQ(''); inputRef.current?.focus(); }}><X size={13} strokeWidth={2.6} /></button>
      ) : variant === 'bar' && <kbd className="xs-kbd" aria-hidden>/</kbd>}
    </div>
  );

  const results = (
    <Results q={q} words={words} list={list} grades={data.grades} active={active}
      onPick={onPick} onSearchAll={() => searchAll()} onRecent={(r) => { setQ(r); inputRef.current?.focus(); }}
      onClearRecent={() => { try { localStorage.removeItem(RECENT_KEY); } catch { /* bỏ qua */ } bump((n) => n + 1); }} />
  );

  if (variant === 'icon') {
    return (
      <>
        <button type="button" className="pub-btn xs-icon-btn" aria-label="Tìm đề thi" title="Tìm đề thi" onClick={openSearch}>
          <Search size={21} />
        </button>
        {open && (
          <div className="xs-sheet" role="dialog" aria-modal="true" aria-label="Tìm đề thi">
            <div className="xs-sheet-bar">
              {field}
              <button type="button" className="xs-cancel" onClick={() => { setQ(''); close(); }}>Hủy</button>
            </div>
            <div className="xs-sheet-body">{results}</div>
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={boxRef} className={`xs-bar ${open ? 'open' : ''}`}>
      {field}
      {open && <div className="xs-panel">{results}</div>}
    </div>
  );
}
