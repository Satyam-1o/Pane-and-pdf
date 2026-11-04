import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Lock } from 'lucide-react';
import { APP_NAME } from '../config/app';
import { getUsage } from '../services/storage/storageService';
import { formatBytes } from '../lib/format';
import ToolsMenu from './ToolsMenu';

function StorageBadge() {
  const [u, setU] = useState(null);
  const { pathname } = useLocation();
  useEffect(() => { getUsage().then(setU); }, [pathname]);
  return <Link to="/library" className="hidden rounded-ui border border-line bg-surface px-3 py-2 text-[13px] hover:bg-surface-2 sm:block">Library{u ? ` · ${formatBytes(u.usage)} used` : ''}</Link>;
}

export default function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:px-10">
      <Link to="/" className="flex items-center gap-2"><FileText className="text-brand" size={26} /><span className="font-display text-[22px] font-bold">{APP_NAME}</span></Link>
      <span className="flex-1" />
      <span className="hidden items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-[13px] font-medium text-brand lg:flex"><Lock size={14} /> Files never leave this device</span>
      <ToolsMenu />
      <StorageBadge />
    </header>
  );
}
