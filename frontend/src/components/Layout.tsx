import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import TabBar from './TabBar';
import CommandPalette from './CommandPalette';

// Khung app: điều hướng ngang trên cùng + nội dung căn giữa; điện thoại có thêm thanh điều hướng dưới đáy.
export default function Layout() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <TopNav />
      <main className="content-area">
        <Outlet />
      </main>
      <TabBar />
      <CommandPalette />
    </div>
  );
}
