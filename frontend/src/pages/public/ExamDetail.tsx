import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Clock, Download, ZoomIn, ZoomOut } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import PdfCanvasViewer from '../../components/PdfCanvasViewer';
import ExamCard, { type ExamItem } from '../../components/ExamCard';
import api, { fileUrl } from '../../lib/api';
import { PAGE_MAX } from '../../lib/layout';
import { fmtDay, gradeLabel } from '../../lib/publicSite';
import useIsMobile from '../../lib/useIsMobile';

type Exam = ExamItem & { description?: string | null; pdf_file?: string | null; related: ExamItem[] };

// Chi tiết 1 đề: mô tả + xem PDF ngay trên trang (pdf.js, không phụ thuộc trình xem PDF của trình duyệt/app)
export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const [exam, setExam] = useState<Exam | null>(null);
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setExam(null); setMissing(false); setZoom(1);
    api.get(`/public/exams/${id}`).then((r) => setExam(r.data)).catch(() => setMissing(true));
    window.scrollTo(0, 0);
  }, [id]);

  const pdf = exam?.pdf_file ? fileUrl(`/uploads/exams/${exam.pdf_file}`) : null;

  return (
    <PublicLayout>
      <section style={{ maxWidth: PAGE_MAX, margin: '0 auto', padding: isMobile ? '1.25rem 16px 2.5rem' : '2.5rem 22px' }}>
        <Link to="/de-thi" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginBottom: 12 }}>
          <ChevronLeft size={16} /> Đề và chuyên môn
        </Link>

        {missing ? (
          <div style={{ color: '#86868B', padding: '3rem 1rem', textAlign: 'center', background: '#fff', borderRadius: 18 }}>Không tìm thấy đề này (có thể đã bị gỡ).</div>
        ) : !exam ? (
          <div style={{ color: '#86868B', padding: '3rem 0', textAlign: 'center' }}>Đang tải...</div>
        ) : (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(1.4rem, 3.2vw, 2.1rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 }}>{exam.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: '#86868B', fontSize: '0.88rem', marginBottom: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={14} /> {fmtDay(exam.published_at || exam.created_at)}</span>
              {exam.grade && <Link to={`/de-thi?lop=${encodeURIComponent(exam.grade)}`} className="badge badge-blue" style={{ textDecoration: 'none' }}>{gradeLabel(exam.grade)}</Link>}
              {pdf && (
                <a href={pdf} target="_blank" rel="noreferrer" download className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
                  <Download size={14} /> Tải đề (PDF)
                </a>
              )}
            </div>
            {exam.description && (
              <div style={{ background: '#fff', borderRadius: 16, padding: '1rem 1.15rem', marginBottom: 16, whiteSpace: 'pre-wrap', lineHeight: 1.65, color: '#3A3A3C' }}>{exam.description}</div>
            )}

            {pdf ? (
              <div style={{ position: 'relative', height: isMobile ? '78vh' : '85vh', background: '#26343A', borderRadius: 16, overflow: 'hidden' }}>
                <PdfCanvasViewer url={pdf} zoom={zoom} />
                <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 4, background: 'rgba(32,32,40,0.72)', borderRadius: 99, padding: 3 }}>
                  <button type="button" className="zoom-pill-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} aria-label="Thu nhỏ"><ZoomOut size={17} /></button>
                  <button type="button" className="zoom-pill-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} aria-label="Phóng to"><ZoomIn size={17} /></button>
                </div>
              </div>
            ) : exam.thumbnail ? (
              <img src={fileUrl(`/uploads/exams/${exam.thumbnail}`)} alt={exam.title} style={{ width: '100%', maxWidth: 720, borderRadius: 12, display: 'block', margin: '0 auto' }} />
            ) : null}

            {exam.related.length > 0 && (
              <>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '2rem 0 0.75rem' }}>Đề cùng {gradeLabel(exam.grade).toLowerCase() || 'chuyên mục'}</h2>
                <div className="exam-list">{exam.related.map((e) => <ExamCard key={e.id} exam={e} compact />)}</div>
              </>
            )}
          </>
        )}
      </section>
    </PublicLayout>
  );
}
