import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { TOOLS } from '../config/tools';
import { Button } from '../ui';

export default function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const ref = useRef(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}><LayoutGrid size={16} /> Tools</Button>
      {open && (
        <nav aria-label="Tools" className="absolute right-0 z-30 mt-2 w-72 rounded-ui border border-line bg-surface p-1 shadow-lg">
          {TOOLS.map(({ to, title, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-ui px-3 py-2.5 text-sm hover:bg-surface-2"><Icon size={16} className="text-brand" />{title}</Link>
          ))}
        </nav>
      )}
    </div>
  );
}
