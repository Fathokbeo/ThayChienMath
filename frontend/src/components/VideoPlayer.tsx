import { Component, type ReactNode } from 'react';
import ReactPlayer from 'react-player';
import { fileUrl } from '../lib/api';

interface Props {
  url: string;
  type: 'youtube' | 'local' | 'url';
}

// Mã video YouTube (11 ký tự) từ các dạng link: youtu.be/ID, watch?v=ID, embed/ID, shorts/ID, live/ID
export function youtubeId(url: string) {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})(?![\w-])/.exec(url.trim());
  return m ? m[1] : null;
}

// Link đã đủ để phát chưa — đang gõ dở (vd "https://youtu.be/") thì chưa dựng trình phát,
// vì trình phát YouTube nhận mã sai sẽ báo lỗi liên tục và làm treo trang
export function isPlayableVideo(url: string, type: string) {
  if (!url?.trim()) return false;
  if (type === 'youtube') return !!youtubeId(url);
  if (type === 'local') return true;
  return /^https?:\/\/[^\s/]+\.[^\s]+$/.test(url.trim());
}

function getVideoUrl(url: string, type: string) {
  if (type === 'local') return fileUrl(`/uploads/videos/${url}`);
  return url.trim();
}

const Notice = ({ text }: { text: string }) => (
  <div style={{ borderRadius: 12, background: '#F2F2F4', color: '#6E6E73', fontSize: '0.85rem', padding: '0.9rem 1rem' }}>{text}</div>
);

// Lỗi bên trong trình phát (link hỏng, video bị chặn...) chỉ ảnh hưởng khung video, không làm trắng cả trang
class PlayerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Notice text="Không phát được video này. Kiểm tra lại link video." /> : this.props.children; }
}

export default function VideoPlayer({ url, type }: Props) {
  if (!isPlayableVideo(url, type)) {
    return <Notice text={type === 'youtube' ? 'Link YouTube chưa đúng — dán link dạng https://youtube.com/watch?v=... hoặc https://youtu.be/...' : 'Link video chưa đúng.'} />;
  }
  const src = getVideoUrl(url, type);

  return (
    <PlayerBoundary key={src}>
      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
        <ReactPlayer
          src={src}
          width="100%"
          height="100%"
          controls
          style={{ display: 'block' }}
        />
      </div>
    </PlayerBoundary>
  );
}
