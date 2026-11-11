import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, FileStack, ChevronRight } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import ExamCard, { type ExamItem } from '../../components/ExamCard';
import ExamMenuBar, { type ExamMeta } from '../../components/ExamMenuBar';
import api from '../../lib/api';
import { PAGE_MAX } from '../../lib/layout';
import { gradeLabel, examHref, useHomeTitles } from '../../lib/publicSite';
import useIsMobile from '../../lib/useIsMobile';

// Trang "Đề và chuyên môn": thanh menu lớp → loại đề (?lop=8&loai=Đề HK1), tìm theo tên (?q=...).
export default function ExamList() {
  const isMobile = useIsMobile();
  const titles = useHomeTitles();
  const [params, setParams] = useSearchParams();
  const grade = params.get('lop') || '';
  const category = params.get('loai') || '';
  const q = params.get('q') || '';
  const [meta, setMeta] = useState<ExamMeta | null>(null);
  const [exams, setExams] = useState<ExamItem[] | null>(null);
  const [typing, setTyping] = useState(q);

  useEffect(() => { api.get('/public/exam-meta').then((r) => setMeta(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    setExams(null);
    api.get('/public/exams', { params: { grade: grade || undefined, category: category || undefined, q: q || undefined } })
      .then((r) => setExams(r.data)).catch(() => setExams([]));
  }, [grade, category, q]);

  // Gõ xong 0,3 giây mới tìm — không gọi máy chủ theo từng phím
  useEffect(() => {
    const t = setTimeout(() => {
      if (typing.trim() === q) return;
      const next = new URLSearchParams(params);
      if (typing.trim()) next.set('q', typing.trim()); else next.delete('q');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [typing]);

  const counts = meta?.counts[grade] || {};
  const gradeTotal = Object.values(counts).reduce((s, n) => s + n, 0);
  const cats = meta ? meta.categories.filter((c) => counts[c]) : [];

  return (
    <PublicLayout>
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.75rem 16px 2.5rem' : '3rem 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1F5C68', fontWeight: 600, fontSize: '0.9rem' }}>
          <FileStack size={18} /> {titles.exams}
        </div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 'clamp(1.6rem, 3.6vw, 2.3rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>
          {grade ? <>{gradeLabel(grade)}{category && <><ChevronRight size={22} style={{ verticalAlign: -3, color: '#AEAEB2' }} />{category}</>}</> : 'Kho đề'}
        </h1>
        <p style={{ margin: '0 0 1.25rem', color: '#6E6E73' }}>{titles.examsSub}</p>

        {meta && <ExamMenuBar meta={meta} activeGrade={grade} activeCategory={category} hrefFor={examHref} />}

        {/* Đang xem 1 lớp: các loại đề của lớp đó để lọc nhanh */}
        {grade && cats.length > 0 && (
          <div className="grade-chips" style={{ marginBottom: 14 }}>
            <a href={examHref(grade)} onClick={(e) => { e.preventDefault(); setParams(new URLSearchParams({ lop: grade }), { replace: true }); }}
              className={`ph-chip ${!category ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Tất cả ({gradeTotal})</a>
            {cats.map((c) => (
              <a key={c} href={examHref(grade, c)} onClick={(e) => { e.preventDefault(); setParams(new URLSearchParams({ lop: grade, loai: c }), { replace: true }); }}
                className={`ph-chip ${category === c ? 'active' : ''}`} style={{ textDecoration: 'none' }}>{c} ({counts[c]})</a>
            ))}
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={17} color="#86868B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input" value={typing} onChange={(e) => setTyping(e.target.value)} placeholder="Tìm đề theo tên, trường, kỳ thi..." style={{ paddingLeft: 40 }} />
        </div>

        {exams === null ? (
          <div style={{ color: '#86868B', padding: '2rem 0', textAlign: 'center' }}>Đang tải...</div>
        ) : exams.length === 0 ? (
          <div style={{ color: '#86868B', padding: '2.5rem 1rem', textAlign: 'center', background: '#fff', borderRadius: 18 }}>
            {q || grade ? 'Không tìm thấy đề phù hợp.' : 'Chưa có đề nào.'}
          </div>
        ) : (
          <div className="exam-list" style={isMobile ? undefined : { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 32 }}>
            {exams.map((e) => <ExamCard key={e.id} exam={e} />)}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
