import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Alert, Button, Card, Dropzone, PageHeader, ProgressBar, Spinner } from '../ui';
import ResultPanel from '../components/ResultPanel';
import { useTask } from '../hooks/useTask';
import { normalizeImage } from '../services/pdf/images';
import { pdfOps } from '../services/pdf/engine';
import { saveResultPdf } from '../services/documents';
import { createUrl, revokeOwner } from '../services/storage/blobUrls';

export default function ImagesToPdf() {
  const [items, setItems] = useState([]); // [{ key, file, url }]
  const [mode, setMode] = useState('a4');
  const [name, setName] = useState('images.pdf');
  const [result, setResult] = useState(null);
  const { busy, progress, error, run } = useTask();
  const key = useRef(0);
  useEffect(() => () => revokeOwner('images-to-pdf'), []);

  const add = (files) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    setItems((cur) => [...cur, ...imgs.map((file) => ({ key: ++key.current, file, url: createUrl(file, 'images-to-pdf') }))]);
  };
  const loc = useLocation(); const seeded = useRef(false);
  useEffect(() => { const f = loc.state?.files; if (f?.length && !seeded.current) { seeded.current = true; add(f); } }, []); // files dropped on Home
  const move = (i, d) => setItems((c) => { const n = [...c]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });

  const convert = () => run(async (p) => {
    setResult(null);
    const images = [];
    for (const [i, it] of items.entries()) { images.push(await normalizeImage(it.file)); p((i + 1) / items.length / 2); }
    const blob = await pdfOps.imagesToPdf(images, mode, { onProgress: (v) => p(0.5 + v / 2) });
    const fileName = name.endsWith('.pdf') ? name : `${name}.pdf`;
    const meta = await saveResultPdf(blob, fileName, 'images-to-pdf');
    setResult({ name: fileName, blob, id: meta.id });
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Images to PDF" description="Combine JPG, PNG, WebP and other images into one PDF, in the order shown." />
      <Dropzone accept="image/*" title="Drop images here" onFiles={add} disabled={busy} />
      {items.length > 0 && (
        <Card className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {items.map((it, i) => (
              <li key={it.key} className="rounded-ui border border-line p-2">
                <img src={it.url} alt="" className="h-32 w-full rounded object-contain bg-surface-2" />
                <div className="mt-2 flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{i + 1}. {it.file.name}</span>
                  <Button size="icon" variant="ghost" disabled={i === 0} aria-label="Move earlier" onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                  <Button size="icon" variant="ghost" disabled={i === items.length - 1} aria-label="Move later" onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
                  <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => { setItems((c) => c.filter((x) => x.key !== it.key)); }}><X size={14} /></Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">Page size<select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2">
              <option value="a4">A4 with margin</option><option value="fit">Match each image</option></select></label>
            <label className="text-sm">File name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2" /></label>
            <Button variant="primary" disabled={busy} onClick={convert}>{busy ? <Spinner /> : null} Create PDF</Button>
          </div>
          {busy && <ProgressBar value={progress} label="Converting" />}
        </Card>
      )}
      {error && <Alert>{error}</Alert>}
      {result && <ResultPanel title="PDF created and saved to your Library" items={[result]} />}
    </div>
  );
}
