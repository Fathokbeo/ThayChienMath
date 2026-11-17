import { fileUrl } from './api';

// Video của bài tin tức: link YouTube / Vimeo hoặc tên file video đã tải lên (uploads/news)
export type NewsVideo =
  | { kind: 'youtube'; id: string; embed: string; thumb: string }
  | { kind: 'vimeo'; id: string; embed: string; thumb: null }
  | { kind: 'file'; src: string; thumb: null };

const YT_RE = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})(?![\w-])/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d{5,12})/;
const FILE_RE = /^[\w-]+\.(mp4|webm|mov)$/;

export function parseNewsVideo(v?: string | null): NewsVideo | null {
  const s = String(v || '').trim();
  if (!s) return null;
  if (FILE_RE.test(s)) return { kind: 'file', src: fileUrl(`/uploads/news/${s}`), thumb: null };
  const yt = YT_RE.exec(s)?.[1];
  if (yt) return { kind: 'youtube', id: yt, embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`, thumb: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` };
  const vm = VIMEO_RE.exec(s)?.[1];
  if (vm) return { kind: 'vimeo', id: vm, embed: `https://player.vimeo.com/video/${vm}`, thumb: null };
  return null;
}

// Link dán vào trình soạn thảo → địa chỉ nhúng (iframe) của YouTube / Vimeo; link lạ → null
export function embedUrlFromLink(link: string) {
  const v = parseNewsVideo(link);
  return v && v.kind !== 'file' ? v.embed : null;
}
