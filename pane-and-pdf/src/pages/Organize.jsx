import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Download, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { Alert, Button, PageHeader, ProgressBar, Spinner } from '../ui';
import PdfPage from '../components/PdfPage';
import PickDocument from '../components/PickDocument';
import { usePdfDocument, useStoredDocument } from '../hooks/usePdfDocument';
import { useTask } from '../hooks/useTask';
import { pdfOps } from '../services/pdf/engine';
import { deletePref, replaceDocumentBlob } from '../services/storage/storageService';
import { saveResultPdf } from '../services/documents';
import { downloadBlob } from '../lib/download';

export default function Organize() {
  const { id } = useParams();
  return id ? <Editor key={id} id={id} /> : <PickDocument title="Organize pages" description="Rotate, delete, duplicate and reorder pages." toolPath="/organize" />;
}

function Editor({ id }) {
  const nav = useNavigate();
  const { meta, blob, error: storeErr } = useStoredDocument(id);
  const { pdf, error: pdfErr } = usePdfDocument(blob);
  const [pages, setPages] = useState([]); // [{ key, index, rotate }]
  const [drag, setDrag] = useState(null);
  const [done, setDone] = useState(null);
  const { busy, progress, error, run } = useTask();
  const keys = useRef(0);
  useEffect(() => { if (pdf) setPages(Array.from({ length: pdf.numPages }, (_, i) => ({ key: ++keys.current, index: i, rotate: 0 }))); }, [pdf]);

  const edit = (i, fn) => setPages((c) => fn([...c]));
  const swap = (i, d) => edit(i, (n) => { [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const drop = (to) => { if (drag === null || drag === to) return; edit(0, (n) => { const [m] = n.splice(drag, 1); n.splice(to, 0, m); return n; }); setDrag(null); };

  const build = async (p) => pdfOps.organize(blob, pages.map(({ index, rotate }) => ({ index, rotate })), { onProgress: p });
  const saveOver = () => run(async (p) => {
    if (!pages.length) throw new Error('A PDF needs at least one page.');
    const out = await build(p); await replaceDocumentBlob(id, out, { label: 'Organize pages', pageCount: pages.length });
    await Promise.all([deletePref(`annot:${id}`), deletePref(`annot-base:${id}`)]); // page layout changed: old editable annotations no longer apply
    nav(`/view/${id}`);
  });
  const saveCopy = () => run(async (p) => {
    if (!pages.length) throw new Error('A PDF needs at least one page.');
    const out = await build(p); const name = meta.name.replace(/\.pdf$/i, '') + '-organized.pdf';
    const m = await saveResultPdf(out, name, 'organize'); setDone({ id: m.id });
    downloadBlob(out, name);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader title={`Organize: ${meta?.name || ''}`} description="Drag thumbnails to reorder. Saving over the original keeps the previous version in history."
        actions={<><Link to="/library"><Button><ArrowLeft size={16} /> Library</Button></Link>
          <Button disabled={busy || !pages.length} onClick={saveCopy}><Download size={16} /> Save as copy</Button>
          <Button variant="primary" disabled={busy || !pages.length} onClick={saveOver}>{busy && <Spinner />} Save changes</Button></>} />
      {(storeErr || pdfErr) && <Alert>{(storeErr || pdfErr).message}</Alert>}
      {error && <Alert>{error}</Alert>}
      {busy && <ProgressBar value={progress} label="Applying changes" />}
      {done && <Alert tone="ok">Copy saved to your Library and downloaded.</Alert>}
      {pdf && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {pages.map((pg, i) => (
            <li key={pg.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)}
              className={`rounded-ui border border-line bg-surface p-2 ${drag === i ? 'opacity-40' : ''}`}>
              <div className="flex h-44 items-center justify-center overflow-hidden bg-surface-2">
                <PdfPage pdf={pdf} pageNumber={pg.index + 1} scale={0.3} rotation={pg.rotate} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted">{i + 1}</span>
                <div className="flex">
                  <Button size="icon" variant="ghost" aria-label="Move earlier" disabled={i === 0} onClick={() => swap(i, -1)}><ArrowLeft size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Move later" disabled={i === pages.length - 1} onClick={() => swap(i, 1)}><ArrowRight size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Rotate left" onClick={() => edit(i, (n) => { n[i] = { ...n[i], rotate: (n[i].rotate + 270) % 360 }; return n; })}><RotateCcw size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Rotate right" onClick={() => edit(i, (n) => { n[i] = { ...n[i], rotate: (n[i].rotate + 90) % 360 }; return n; })}><RotateCw size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Duplicate" onClick={() => edit(i, (n) => { n.splice(i + 1, 0, { ...n[i], key: ++keys.current }); return n; })}><Copy size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete page" onClick={() => edit(i, (n) => { n.splice(i, 1); return n; })}><Trash2 size={14} /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
