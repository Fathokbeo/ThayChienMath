import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, CheckCircle2, AlertTriangle, ClipboardList, Bell } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader, EmptyState } from '../../components/ui';
import { useChildren, withChild, fmtDate, activityText, type Activity } from '../../lib/parent';

const ICON = {
  submitted: { icon: Send, color: '#2F6F82' },
  graded: { icon: CheckCircle2, color: '#3A7D5C' },
  missed: { icon: AlertTriangle, color: '#B04A2A' },
  assigned: { icon: ClipboardList, color: '#6E5A94' },
};

const dayLabel = (iso: string) => {
  const d = new Date(iso); const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
};

// Thông báo hoạt động của con trong 30 ngày: nộp bài, có điểm, không nộp đúng hạn, được giao bài mới.
// Mở trang = đánh dấu đã xem (chấm đỏ "mới" vẫn hiện trong lần xem này để phụ huynh biết mục nào mới).
export default function ParentNotifications() {
  const { children, current, select, reload } = useChildren();
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (!current) return;
    setItems(null);
    api.get(`/parent/children/${current.id}/overview`).then((r) => {
      setItems(r.data.activity);
      api.post('/parent/notifications/seen').then(() => reload()).catch(() => {});
    });
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const groups: { day: string; list: Activity[] }[] = [];
  (items || []).forEach((e) => {
    const day = dayLabel(e.at);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.list.push(e); else groups.push({ day, list: [e] });
  });

  return (
    <div>
      <PageHeader title="Thông báo" subtitle={`Hoạt động học tập của ${current.full_name} trong 30 ngày gần đây`} />
      {children && children.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '-0.75rem 0 1.5rem' }}>
          {children.map((c) => (
            <button key={c.id} className={`ph-chip ${c.id === current.id ? 'active' : ''}`} onClick={() => select(c.id)}>
              {c.full_name}{c.unread > 0 && <span className="ph-badge">{c.unread}</span>}
            </button>
          ))}
        </div>
      )}
      {!items ? <div style={{ color: '#86868B' }}>Đang tải…</div> : items.length === 0 ? (
        <EmptyState icon={<Bell size={32} />} title="Chưa có hoạt động nào" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {groups.map((g) => (
            <section key={g.day}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6E6E73', margin: '0 4px 8px', textTransform: 'capitalize' }}>{g.day}</div>
              <div className="list">
                {g.list.map((e, i) => {
                  const { icon: Icon, color } = ICON[e.type];
                  return (
                    <Link key={i} to={withChild(`/parent/lop/${e.class_id}?bai=${e.homework_id}`, current.id)} className="list-row">
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={17} color={color} />
                      </span>
                      <div className="list-row-main">
                        <div className="list-row-title" style={{ fontWeight: e.is_new ? 700 : 600 }}>{activityText(e)}</div>
                        <div className="list-row-sub">{e.title} · {e.class_title}</div>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#86868B', whiteSpace: 'nowrap' }}>{fmtDate(e.at).split(' ')[0]}</span>
                      {e.is_new && <span className="ph-dot" title="Mới" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
