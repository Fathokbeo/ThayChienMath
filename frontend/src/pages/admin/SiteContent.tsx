import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { setBrandName } from '../../lib/brand';
import { toast } from '../../components/Toast';
import NewsAdminList from '../../components/NewsAdminList';

const SETTING_FIELDS = [
  { key: 'hero_title', label: 'Tên thương hiệu / Tiêu đề trang chủ (hiện cả ở thanh trên cùng, trang đăng nhập, tab trình duyệt)', area: 'Trang chủ' },
  { key: 'hero_subtitle', label: 'Khẩu hiệu (subtitle)', area: 'Trang chủ' },
  { key: 'contact_address', label: 'Địa chỉ', area: 'Liên hệ' },
  { key: 'contact_phone', label: 'Điện thoại', area: 'Liên hệ' },
  { key: 'contact_email', label: 'Email', area: 'Liên hệ' },
  { key: 'contact_hours', label: 'Giờ học', area: 'Liên hệ' },
  { key: 'contact_facebook', label: 'Link Facebook', area: 'Liên hệ' },
  { key: 'home_exams_title', label: 'Mục 1 — tên (mặc định: Đề và chuyên môn)', area: 'Tên các mục trang chủ' },
  { key: 'home_exams_subtitle', label: 'Mục 1 — dòng mô tả', area: 'Tên các mục trang chủ' },
  { key: 'home_news_title', label: 'Mục 2 — tên (mặc định: Tin tức)', area: 'Tên các mục trang chủ' },
  { key: 'home_news_subtitle', label: 'Mục 2 — dòng mô tả', area: 'Tên các mục trang chủ' },
  { key: 'home_courses_title', label: 'Mục 3 — tên (mặc định: Các khóa học)', area: 'Tên các mục trang chủ' },
  { key: 'home_courses_subtitle', label: 'Mục 3 — dòng mô tả', area: 'Tên các mục trang chủ' },
  { key: 'parent_contact_phone', label: 'SĐT liên hệ (hiện ở trang lớp học của phụ huynh; để trống thì dùng số Điện thoại ở trên)', area: 'Phụ huynh' },
];

function SettingsForm() {
  const [s, setS] = useState<any>({});
  const [loading, setLoading] = useState(false);
  useEffect(() => { api.get('/admin/content/settings').then((r) => setS(r.data)); }, []);

  const save = async () => {
    setLoading(true);
    try {
      await api.put('/admin/content/settings', s);
      if (s.hero_title !== undefined) setBrandName(s.hero_title || '');
      toast.success('Đã lưu thông tin');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi');
    } finally { setLoading(false); }
  };

  const areas = ['Trang chủ', 'Tên các mục trang chủ', 'Liên hệ', 'Phụ huynh'];
  return (
    <div style={{ maxWidth: 640 }}>
      {areas.map((area) => (
        <div key={area} style={{ background: 'white', borderRadius: 12, padding: '1.25rem', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: '#1D1D1F' }}>{area}</h3>
          {SETTING_FIELDS.filter((f) => f.area === area).map((f) => (
            <div className="form-group" key={f.key}>
              <label className="label">{f.label}</label>
              <input className="input" value={s[f.key] || ''} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
            </div>
          ))}
        </div>
      ))}
      <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu thông tin'}</button>
    </div>
  );
}

// "Học sinh tiêu biểu", "Kinh nghiệm & Thành tích" và "Giáo viên" đã bỏ khỏi trang chủ (thay bằng Khóa học,
// Đề và chuyên môn, Tin tức) nên không còn tab ở đây; dữ liệu cũ vẫn giữ trong database.
// Mục "Trang web" của quản trị: tab Tin tức (trang này) và tab Thông tin trang (SiteInfo) — chuyển bằng tab con ở trên
export function SiteInfo() {
  return (
    <div className="fade-in">
      <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Thông tin trang</h1>
      <p style={{ margin: '0 0 1.25rem', color: '#6E6E73', fontSize: '0.86rem' }}>Tên trung tâm, khẩu hiệu, thông tin liên hệ hiện trên trang chủ và chân trang.</p>
      <SettingsForm />
    </div>
  );
}

export default function SiteContent() {
  return (
    <div className="fade-in">
      <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Tin tức</h1>
      <p style={{ margin: '0 0 1.25rem', color: '#6E6E73', fontSize: '0.86rem' }}>Bài viết hiện ở trang chủ và trang Tin tức.</p>
      <NewsAdminList />
    </div>
  );
}
