import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PenSquare, Eye, EyeOff, Trash2, Newspaper, ExternalLink } from 'lucide-react';
import api, { fileUrl } from '../lib/api';
import { toast } from './Toast';
import { fmtDay } from '../lib/publicSite';

type Row = { id: number; title: string; summary: string | null; image: string | null; published_at: string | null; created_at: string; active: number };

// Tab "Tin tức" ở trang Nội dung trang: danh sách bài (mới nhất trước) + nút viết bài → trang soạn bài riêng
export default function NewsAdminList() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = () => api.get('/admin/content/news').then((r) => setRows(r.data)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const toggle = async (r: Row) => {
    const fd = new FormData(); fd.append('active', r.active ? '0' : '1');
    await api.put(`/admin/content/news/${r.id}`, fd);
    load();
  };
  const remove = async (r: Row) => {
    if (!confirm(`Xóa bài "${r.title}"? Ảnh bìa và ảnh trong bài cũng bị xóa.`)) return;
    await api.delete(`/admin/content/news/${r.id}`);
    toast.success('Đã xóa bài');
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Link to="/tin-tuc" target="_blank" className="btn btn-ghost btn-sm"><ExternalLink size={14} /> Xem trang Tin tức</Link>
        <Link to="/admin/news/new" className="btn btn-primary"><PenSquare size={16} /> Viết bài mới</Link>
      </div>
      {rows === null ? <div style={{ color: '#86868B' }}>Đang tải...</div> : rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#86868B', padding: '2.5rem', background: 'white', borderRadius: 12 }}>
          <Newspaper size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div>Chưa có bài viết nào. Bấm <b>Viết bài mới</b> để đăng tin đầu tiên.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ padding: '0.75rem', display: 'flex', gap: 14, alignItems: 'center', opacity: r.active ? 1 : 0.55 }}>
              <Link to={`/admin/news/${r.id}`} style={{ flexShrink: 0 }}>
                {r.image
                  ? <img src={fileUrl(`/uploads/news/${r.image}`)} alt="" style={{ width: 120, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                  : <div style={{ width: 120, height: 72, borderRadius: 8, background: '#E6F0F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Newspaper size={22} color="#2F6F82" /></div>}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link to={`/admin/news/${r.id}`} style={{ fontWeight: 700, color: '#1D1D1F', textDecoration: 'none' }}>{r.title}</Link>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: '#86868B', marginTop: 4 }}>
                  <span>{fmtDay(r.published_at || r.created_at)}</span>
                  {!r.active && <span className="badge badge-gray">Đang ẩn</span>}
                </div>
                {r.summary && <div style={{ fontSize: '0.84rem', color: '#6E6E73', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary}</div>}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <Link to={`/admin/news/${r.id}`} className="btn btn-ghost btn-sm btn-icon" title="Sửa bài"><PenSquare size={15} /></Link>
                <button className="btn btn-ghost btn-sm btn-icon" title={r.active ? 'Ẩn bài' : 'Hiện lại'} onClick={() => toggle(r)}>{r.active ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Xóa" onClick={() => remove(r)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
