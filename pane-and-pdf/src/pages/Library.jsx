import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, LayoutGrid, Pencil, Trash2, FileText } from 'lucide-react';
import { Alert, Button, Card, Dropzone, EmptyState, PageHeader, ProgressBar } from '../ui';
import StoragePanel from '../components/StoragePanel';
import { useLibrary } from '../hooks/useLibrary';
import { useTask } from '../hooks/useTask';
import { importPdfFiles } from '../services/documents';
import { deleteDocument, getDocumentBlob } from '../services/storage/storageService';
import { downloadBlob } from '../lib/download';
import { formatBytes, formatDate } from '../lib/format';

export default function Library() {
  const { docs, loading, error, refresh } = useLibrary();
  const { busy, progress, run } = useTask();
  const [problems, setProblems] = useState([]);
  const [tick, setTick] = useState(0);
  const reload = async () => { await refresh(); setTick((t) => t + 1); };

  const upload = (files) => run(async (p) => {
    const { errors } = await importPdfFiles(files, p);
    setProblems(errors); await reload();
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Library" description="PDFs you add stay in this browser and are still here after a refresh." />
      {error && <Alert>{error.message}</Alert>}
      {problems.map((p) => <Alert key={p}>{p}</Alert>)}
      <Dropzone accept="application/pdf,.pdf" title="Drop PDFs to add them" hint="Opened and saved locally — nothing is sent anywhere." onFiles={upload} disabled={busy} />
      {busy && <ProgressBar value={progress} label="Adding" />}
      <StoragePanel refreshKey={tick} onCleared={reload} />
      {!loading && !docs.length && <EmptyState title="No documents yet">Add a PDF above, or build one from images.</EmptyState>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <li key={d.id}>
            <Card className="space-y-3">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="truncate font-medium" title={d.name}>{d.name}</p>
                  <p className="text-sm text-muted">{d.pageCount ?? '?'} pages · {formatBytes(d.size)} · {formatDate(d.updatedAt)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/view/${d.id}`}><Button size="sm"><Eye size={14} /> View</Button></Link>
                <Link to={`/organize/${d.id}`}><Button size="sm"><LayoutGrid size={14} /> Organize</Button></Link>
                <Link to={`/annotate/${d.id}`}><Button size="sm"><Pencil size={14} /> Annotate</Button></Link>
                <Button size="sm" onClick={async () => downloadBlob(await getDocumentBlob(d.id), d.name)}><Download size={14} /> Download</Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={async () => { if (window.confirm(`Delete "${d.name}" from this browser?`)) { await deleteDocument(d.id); reload(); } }}><Trash2 size={14} /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
