import { useCallback, useEffect, useState } from 'react';
import { Trash2, ShieldCheck } from 'lucide-react';
import { Button, Card } from '../ui';
import { clearAllDocuments, getUsage, requestPersistence } from '../services/storage/storageService';
import { clearTemp } from '../services/storage/opfs';
import { formatBytes } from '../lib/format';

export default function StoragePanel({ refreshKey, onCleared }) {
  const [u, setU] = useState(null);
  const load = useCallback(() => getUsage().then(setU), []);
  useEffect(() => { load(); }, [load, refreshKey]);
  if (!u) return null;
  const pct = u.quota ? (u.usage / u.quota) * 100 : 0;
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium">Browser storage</h2>
        <span className="text-sm text-muted">{formatBytes(u.usage)}{u.quota ? ` of ${formatBytes(u.quota)}` : ''}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <p className="text-sm text-muted">Files stay on this device. Browsers may clear site data when disk space is low{u.persisted ? ' — this site is marked persistent.' : '.'}</p>
      <div className="flex flex-wrap gap-2">
        {!u.persisted && <Button size="sm" onClick={async () => { await requestPersistence(); load(); }}><ShieldCheck size={14} /> Keep my files</Button>}
        <Button size="sm" variant="danger" disabled={!u.docCount} onClick={async () => {
          if (!window.confirm('Delete every document and its history from this browser?')) return;
          await clearAllDocuments(); await clearTemp(); await load(); onCleared?.();
        }}><Trash2 size={14} /> Clear all documents</Button>
      </div>
    </Card>
  );
}
