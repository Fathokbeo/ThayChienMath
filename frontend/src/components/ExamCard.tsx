import { Link } from 'react-router-dom';
import { Clock, FileText } from 'lucide-react';
import { fileUrl } from '../lib/api';
import { fmtDay, gradeLabel } from '../lib/publicSite';

export type ExamItem = { id: number; title: string; grade?: string | null; thumbnail?: string | null; published_at?: string | null; created_at?: string };

// Một đề trong danh sách "Đề và chuyên môn": ảnh bìa bên trái, tên đề đậm + ngày đăng bên phải.
export default function ExamCard({ exam, compact }: { exam: ExamItem; compact?: boolean }) {
  const w = compact ? 70 : 92;
  return (
    <Link to={`/de-thi/${exam.id}`} className="exam-card">
      <div className="exam-card-thumb" style={{ width: w, height: Math.round(w * 1.32) }}>
        {exam.thumbnail
          ? <img src={fileUrl(`/uploads/exams/${exam.thumbnail}`)} alt="" loading="lazy" />
          : <FileText size={compact ? 24 : 30} color="#9CC7D2" />}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="exam-card-title" style={{ fontSize: compact ? '0.92rem' : '1.02rem' }}>{exam.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, fontSize: '0.82rem', color: '#86868B' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> {fmtDay(exam.published_at || exam.created_at)}</span>
          {exam.grade && <span className="badge badge-blue">{gradeLabel(exam.grade)}</span>}
        </div>
      </div>
    </Link>
  );
}
