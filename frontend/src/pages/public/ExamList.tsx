import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, FileStack } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import ExamCard, { type ExamItem } from '../../components/ExamCard';
import api from '../../lib/api';
import { PAGE_MAX } from '../../lib/layout';
import { gradeLabel } from '../../lib/publicSite';
import useIsMobile from '../../lib/useIsMobile';

// Trang "Đề và chuyên môn": tất cả đề công khai, lọc theo lớp (?lop=8) và tìm theo tên (?q=...).
export default function ExamList() {
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const grade = params.get('lop') || '';
  const q = params.get('q') || '';
  const [grades, setGrades] = useState<string[]>([]);
  const [exams, setExams] = useState<ExamItem[] | null>(null);
  const [typing, setTyping] = useState(q);

  useEffect(() => { api.get('/public/exam-grades').then((r) => setGrades(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    setExams(null);
    api.get('/public/exams', { params: { grade: grade || undefined, q: q || undefined } })
      .then((r) => setExams(r.data)).catch(() => setExams([]));
  }, [grade, q]);

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

  const pickGrade = (g: string) => {
    const next = new URLSearchParams(params);
    if (g) next.set('lop', g); else next.delete('lop');
    setParams(next, { replace: true });
  };

  return (
    <PublicLayout>
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.75rem 16px 2.5rem' : '3rem 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1F5C68', fontWeight: 600, fontSize: '0.9rem' }}>
          <FileStack size={18} /> Đề và chuyên môn
        </div>
        <h1 style={{ margin: '6px 0 6px', fontSize: 'clamp(1.6rem, 3.6vw, 2.3rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>Kho đề Toán THCS</h1>
        <p style={{ margin: '0 0 1.25rem', color: '#6E6E73' }}>Đề kiểm tra, đề khảo sát, đề thi chọn lọc — bấm vào đề để xem chi tiết.</p>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={17} color="#86868B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input" value={typing} onChange={(e) => setTyping(e.target.value)} placeholder="Tìm đề theo tên, trường, kỳ thi..." style={{ paddingLeft: 40 }} />
        </div>
        <div className="grade-chips" style={{ marginBottom: 16 }}>
          <button type="button" className={`ph-chip ${grade === '' ? 'active' : ''}`} onClick={() => pickGrade('')}>Tất cả</button>
          {grades.map((g) => (
            <button key={g} type="button" className={`ph-chip ${grade === g ? 'active' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => pickGrade(g)}>{gradeLabel(g)}</button>
          ))}
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
