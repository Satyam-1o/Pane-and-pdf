import { Download, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, Button } from '../ui';
import { downloadBlob, downloadZip } from '../lib/download';
import { formatBytes } from '../lib/format';

/** Shown after an operation: summary, download, and link to the saved library copy. */
export default function ResultPanel({ title = 'Done', items = [], children }) {
  return (
    <Alert tone="ok">
      <p className="font-medium">{title}</p>
      {children}
      <ul className="mt-2 space-y-1.5">
        {items.map((it) => (
          <li key={it.name} className="flex flex-wrap items-center gap-2 text-fg">
            <span className="min-w-0 flex-1 truncate">{it.name} · {formatBytes(it.blob.size)}</span>
            {it.id && <Link to={`/view/${it.id}`}><Button size="sm"><Eye size={14} /> View</Button></Link>}
            <Button size="sm" variant="primary" onClick={() => downloadBlob(it.blob, it.name)}><Download size={14} /> Download</Button>
          </li>
        ))}
      </ul>
      {items.length > 1 && <Button size="sm" className="mt-2" onClick={() => downloadZip(items, 'pane-and-pdf-files.zip')}><Download size={14} /> Download all (ZIP)</Button>}
    </Alert>
  );
}
