import { Outlet } from 'react-router-dom';
import PrivacyNotice from './PrivacyNotice';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-10"><Outlet /></main>
      <footer className="border-t border-line px-4 py-4 text-muted md:px-10"><PrivacyNotice /></footer>
    </div>
  );
}
