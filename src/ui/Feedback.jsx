import { Loader2, AlertTriangle } from 'lucide-react';

export function Spinner({ className = '' }) { return <Loader2 className={`animate-spin ${className}`} size={18} aria-hidden />; }

export function Alert({ tone = 'danger', children }) {
  const tones = { danger: 'border-danger/40 bg-danger/10 text-danger', ok: 'border-ok/40 bg-ok/10 text-ok', info: 'border-line bg-surface-2 text-fg' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-2 rounded-ui border px-3 py-2 text-sm ${tones[tone]}`}>
      {tone === 'danger' && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

export function ProgressBar({ value = 0, label }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      {label && <div className="mb-1 text-sm text-muted">{label} — {pct}%</div>}
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-ui border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}
