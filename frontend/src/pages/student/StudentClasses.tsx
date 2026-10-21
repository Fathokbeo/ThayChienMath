import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { School, Trophy, ChevronRight } from 'lucide-react';
import { PageHeader, EmptyState } from '../../components/ui';

// Màu huy hiệu xếp hạng: top 1 vàng, 2 bạc, 3 đồng, còn lại tím
function rankStyle(rank: number): { background: string; color: string } {
  if (rank === 1) return { background: '#FFF8E1', color: '#C68A00' };
  if (rank === 2) return { background: '#F2F2F4', color: '#6E6E73' };
  if (rank === 3) return { background: '#FBEAE4', color: '#B04A2A' };
  return { background: '#F0ECF7', color: '#6E5A94' };
}

export default function StudentClasses() {
  const [classes, setClasses] = useState<any[] | null>(null);

  useEffect(() => {
    api.get('/student/my-classes').then((r) => setClasses(r.data));
  }, []);

  return (
    <div>
      <PageHeader title="Lớp học của tôi" subtitle={classes ? `${classes.length} lớp đang theo học` : ' '} />

      {classes && classes.length === 0 ? (
        <EmptyState icon={<School size={34} />} title="Bạn chưa được thêm vào lớp học nào" text="Hãy liên hệ thầy cô để được thêm vào lớp." />
      ) : (
        <div className="list">
          {(classes || []).map((c) => (
            <Link key={c.id} to={`/student/classes/${c.id}`} className="list-row" style={{ padding: '16px 18px' }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#E6F0F2', color: '#1F5C68', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: '0.85rem' }}>
                {c.title?.slice(0, 4)}
              </span>
              <div className="list-row-main">
                <div className="list-row-title">{c.title}{c.course_title && <span style={{ color: '#86868B', fontWeight: 500 }}> · {c.course_title}</span>}</div>
                <div className="list-row-sub">GV: {c.teacher_name} · {c.lesson_count} bài giảng · {c.submitted_count}/{c.homework_count} bài đã nộp</div>
              </div>
              {/* Điểm TB + xếp hạng tháng này trong lớp (reset theo tháng; quá hạn chưa nộp tính 0 điểm) */}
              {c.my_rank ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span className="hide-mobile" style={{ fontSize: '0.84rem', color: '#B8673E', fontWeight: 600 }}>TB {c.my_avg ?? '—'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: 99, ...rankStyle(c.my_rank) }}>
                    <Trophy size={13} /> {c.my_rank}/{c.rank_total}
                  </span>
                </div>
              ) : (
                <span className="hide-mobile" style={{ fontSize: '0.8rem', color: '#AEAEB2' }}>Chưa có điểm tháng này</span>
              )}
              <ChevronRight size={18} color="#C7C7CC" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
