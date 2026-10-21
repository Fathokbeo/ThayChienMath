import type { ReactNode } from 'react';

// Thành phần giao diện dùng chung kiểu Apple: tiêu đề trang lớn, tiêu đề mục kèm liên kết bên phải.

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: '1.75rem' }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <h1 style={{ margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ margin: '8px 0 0', color: '#6E6E73', fontSize: '1.02rem', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, count, action }: { title: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 2px 10px' }}>
      <h2 className="section-title" style={{ margin: 0 }}>
        {title}{typeof count === 'number' && <span style={{ color: '#86868B', fontWeight: 500, marginLeft: 8 }}>{count}</span>}
      </h2>
      {action}
    </div>
  );
}

// "Chào buổi sáng/chiều/tối" theo giờ máy người dùng
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 13) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// Tên gọi = chữ cuối của họ tên Việt ("Nguyễn Bảo Anh" → "Anh")
export const givenName = (full?: string) => (full || '').trim().split(/\s+/).pop() || '';

export const todayLabel = (d = new Date()) =>
  d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });

// Màu theo độ gấp của hạn nộp: < 24h đỏ gạch, < 3 ngày cam đào, còn lại teal
export function urgencyColor(ms: number) {
  if (ms < 24 * 3600e3) return '#B04A2A';
  if (ms < 72 * 3600e3) return '#C2703F';
  return '#1F5C68';
}

// Màu điểm theo tỉ lệ trên thang: ≥ 80% xanh lá, ≥ 50% cam, còn lại đỏ gạch
export function scoreTone(score: number, max: number) {
  const r = max > 0 ? score / max : 0;
  if (r >= 0.8) return { color: '#3A7D5C', bg: '#E8F3EC' };
  if (r >= 0.5) return { color: '#B8673E', bg: '#FCF0E8' };
  return { color: '#B04A2A', bg: '#FBEAE4' };
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '2.5rem 1.5rem', textAlign: 'center' }}>
      {icon && <div style={{ color: '#AEAEB2', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>{icon}</div>}
      <div style={{ fontWeight: 600, fontSize: '1.02rem' }}>{title}</div>
      {text && <div style={{ color: '#6E6E73', fontSize: '0.9rem', marginTop: 4 }}>{text}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}
