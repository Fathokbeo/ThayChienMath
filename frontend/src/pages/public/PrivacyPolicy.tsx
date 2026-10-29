import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import api from '../../lib/api';
import useIsMobile from '../../lib/useIsMobile';

// Chính sách bảo mật cho website edugrade.vn và app Android (Google Play bắt buộc có URL công khai).
// Nội dung phải khớp đúng những gì app làm — sửa tính năng liên quan dữ liệu thì cập nhật trang này.
const UPDATED = '30/10/2026';

function H({ id, children }: { id?: string; children: ReactNode }) {
  return <h2 id={id} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '1.75rem 0 0.6rem', scrollMarginTop: 80 }}>{children}</h2>;
}

export default function PrivacyPolicy() {
  const isMobile = useIsMobile();
  const [s, setS] = useState<any>({});
  useEffect(() => { api.get('/public/settings').then((r) => setS(r.data)).catch(() => {}); }, []);

  const contact = (
    <ul>
      {s.contact_phone && <li>Điện thoại: <a href={`tel:${String(s.contact_phone).replace(/[^+\d]/g, '')}`}>{s.contact_phone}</a></li>}
      {s.contact_email && <li>Email: <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
      {s.contact_address && <li>Địa chỉ: {s.contact_address}</li>}
      {!s.contact_phone && !s.contact_email && <li>Thông tin liên hệ ở mục <a href="/#contact">Liên hệ</a> cuối trang chủ.</li>}
    </ul>
  );

  return (
    <PublicLayout>
      <article className="policy" style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '1.75rem 16px 3rem' : '3rem 22px 4rem', lineHeight: 1.7, color: '#3A3A3C' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1F5C68', fontWeight: 600 }}><ShieldCheck size={18} /> Quyền riêng tư</div>
        <h1 style={{ margin: '6px 0 4px', fontSize: 'clamp(1.6rem, 3.6vw, 2.2rem)', fontWeight: 700, letterSpacing: '-0.02em', color: '#1D1D1F' }}>Chính sách bảo mật</h1>
        <p style={{ margin: 0, color: '#86868B' }}>Cập nhật lần cuối: {UPDATED}</p>

        <p>Chính sách này áp dụng cho website <strong>edugrade.vn</strong> và ứng dụng Android <strong>Thầy Chiến Math</strong> (mã ứng dụng <code>vn.thaychienmath.app</code>), do trung tâm <strong>Thầy Chiến Math</strong> vận hành (sau đây gọi là “trung tâm”). Chúng tôi chỉ thu thập dữ liệu cần thiết để dạy học, chấm bài và tư vấn tuyển sinh; <strong>không bán dữ liệu, không hiển thị quảng cáo và không dùng công cụ theo dõi của bên thứ ba</strong>.</p>

        <H>1. Dữ liệu chúng tôi thu thập</H>
        <ul>
          <li><strong>Tài khoản</strong> (do trung tâm tạo, người dùng không tự đăng ký): họ tên, tên đăng nhập, mật khẩu, số điện thoại phụ huynh, lớp học đang tham gia.</li>
          <li><strong>Dữ liệu học tập</strong>: bài làm nộp lên (ảnh chụp, file PDF), câu trả lời trắc nghiệm, điểm số, nhận xét, thời gian nộp bài.</li>
          <li><strong>Đơn đăng ký học</strong> (khách gửi ở trang chủ, không cần tài khoản): họ tên học sinh, số điện thoại phụ huynh, trường, lớp, điểm tổng kết môn Toán học kỳ gần nhất, ca thi thử đầu vào đã chọn, ghi chú; kèm địa chỉ IP để chặn gửi đơn rác.</li>
          <li><strong>Dữ liệu kỹ thuật</strong>: mã phiên đăng nhập và bản nháp bài làm lưu trên chính thiết bị của bạn (bộ nhớ trình duyệt/ứng dụng); nhật ký máy chủ thông thường (thời gian truy cập, địa chỉ IP) để vận hành và bảo mật.</li>
        </ul>
        <p>Chúng tôi <strong>không</strong> thu thập vị trí, danh bạ, tin nhắn hay dữ liệu khác trên thiết bị.</p>

        <H>2. Quyền ứng dụng sử dụng</H>
        <ul>
          <li><strong>Máy ảnh</strong>: chỉ khi bạn bấm chụp ảnh bài làm để nộp.</li>
          <li><strong>Ảnh và tệp</strong>: chỉ khi bạn chọn ảnh/PDF để nộp bài, hoặc lưu/chia sẻ file báo cáo (PDF nhận xét, Excel bảng điểm).</li>
          <li><strong>Internet</strong>: để kết nối với máy chủ của trung tâm.</li>
        </ul>

        <H>3. Mục đích sử dụng</H>
        <ul>
          <li>Tổ chức lớp học: bài giảng, bài tập, nộp bài, chấm và trả điểm.</li>
          <li>Cho học sinh và phụ huynh theo dõi kết quả học tập; cho giáo viên theo dõi lớp.</li>
          <li>Liên hệ tư vấn và xếp lịch thi thử đầu vào cho người gửi đơn đăng ký học.</li>
        </ul>

        <H>4. Chấm bài bằng trí tuệ nhân tạo (AI)</H>
        <p>Để chấm bài tự động và viết nhận xét, ảnh/PDF bài làm cùng đề bài và đáp án được gửi qua kết nối mã hóa tới dịch vụ AI của <strong>Google (Gemini)</strong> và/hoặc <strong>Anthropic (Claude)</strong>. Chúng tôi chỉ gửi nội dung bài làm cần chấm — <strong>không gửi kèm số điện thoại hay thông tin liên hệ</strong>. Các nhà cung cấp này xử lý dữ liệu theo điều khoản dịch vụ API của họ. Giáo viên có thể xem lại và sửa điểm do AI chấm.</p>

        <H>5. Ai được xem dữ liệu</H>
        <ul>
          <li>Học sinh: bài làm và kết quả của chính mình.</li>
          <li>Phụ huynh: kết quả học tập của con.</li>
          <li>Giáo viên, trợ giảng: học sinh trong lớp mình phụ trách.</li>
          <li>Quản trị viên của trung tâm: toàn bộ dữ liệu để vận hành.</li>
        </ul>
        <p>Chúng tôi không chia sẻ dữ liệu cho bên nào khác, trừ nhà cung cấp AI ở mục 4, nhà cung cấp máy chủ lưu trữ dữ liệu, hoặc khi pháp luật yêu cầu.</p>

        <H>6. Lưu trữ và bảo mật</H>
        <ul>
          <li>Dữ liệu lưu trên máy chủ đặt tại Việt Nam; mọi kết nối dùng HTTPS (mã hóa).</li>
          <li>Đề, bài làm và tài liệu lớp học chỉ người có quyền trong lớp mới mở được.</li>
          <li>Để giáo viên cấp lại mật khẩu khi học sinh quên, <strong>mật khẩu tài khoản học sinh/phụ huynh do trung tâm tạo được lưu lại và quản trị viên xem được</strong>; mật khẩu quản trị không lưu dạng này. Vì vậy, vui lòng không dùng lại mật khẩu này cho dịch vụ khác.</li>
          <li>Dữ liệu được sao lưu tự động hằng ngày; bản sao lưu giữ tối đa 14 ngày.</li>
        </ul>

        <H>7. Thời gian lưu giữ</H>
        <ul>
          <li>Tài khoản và dữ liệu học tập: trong thời gian học sinh theo học, đến khi trung tâm xóa tài khoản hoặc khi có yêu cầu xóa (mục 9).</li>
          <li>Đơn đăng ký học: đến khi hoàn tất tư vấn, hoặc xóa ngay khi có yêu cầu.</li>
        </ul>

        <H>8. Trẻ em</H>
        <p>Người dùng chính là học sinh THCS. Tài khoản học sinh do trung tâm tạo khi phụ huynh đăng ký cho con theo học; phụ huynh có quyền xem kết quả, yêu cầu sửa hoặc xóa dữ liệu của con bất kỳ lúc nào.</p>

        <H id="xoa-du-lieu">9. Quyền của bạn và yêu cầu xóa tài khoản, dữ liệu</H>
        <p>Học sinh, phụ huynh hoặc người đã gửi đơn đăng ký có thể yêu cầu <strong>xem, sửa, hoặc xóa</strong> tài khoản và dữ liệu bằng cách liên hệ trung tâm (thông tin ở mục 11), nêu rõ tên đăng nhập hoặc họ tên học sinh và số điện thoại phụ huynh. Chúng tôi xác minh và xử lý trong vòng <strong>7 ngày làm việc</strong>. Khi xóa tài khoản, bài làm, điểm số và nhận xét của tài khoản đó bị xóa khỏi hệ thống; bản sao lưu cũ tự hết hạn sau 14 ngày.</p>

        <H>10. Thay đổi chính sách</H>
        <p>Khi chính sách thay đổi, chúng tôi cập nhật trang này và ngày “Cập nhật lần cuối” ở đầu trang.</p>

        <H>11. Liên hệ</H>
        <p>Trung tâm Thầy Chiến Math</p>
        {contact}
      </article>
    </PublicLayout>
  );
}
