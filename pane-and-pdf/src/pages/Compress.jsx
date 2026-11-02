import { useState } from 'react';
import { Alert, Button, Card, PageHeader, ProgressBar, Spinner } from '../ui';
import DocPicker from '../components/DocPicker';
import ResultPanel from '../components/ResultPanel';
import { useLibrary } from '../hooks/useLibrary';
import { useTask } from '../hooks/useTask';
import { loadPdf } from '../services/pdf/pdfjs';
import { canvasToBlob, releaseCanvas, renderPage } from '../services/pdf/render';
import { pdfOps } from '../services/pdf/engine';
import { getDocumentBlob } from '../services/storage/storageService';
import { saveResultPdf } from '../services/documents';
import { baseName, formatBytes } from '../lib/format';

export default function Compress() {
  const { docs, refresh } = useLibrary();
  const [id, setId] = useState('');
  const [mode, setMode] = useState('structure');
  const [quality, setQuality] = useState(0.7);
  const [dpi, setDpi] = useState(110);
  const [result, setResult] = useState(null);
  const { busy, progress, error, run } = useTask();
  const doc = docs.find((d) => d.id === id);

  const compress = () => run(async (p) => {
    setResult(null);
    const src = await getDocumentBlob(id);
    let out;
    if (mode === 'structure') out = await pdfOps.optimize(src, { onProgress: p });
    else { // rasterise each page to JPEG; text is no longer selectable
      const pdf = await loadPdf(src); const images = [];
      try {
        for (let n = 1; n <= pdf.numPages; n++) {
          const base = await (await pdf.getPage(n)).getViewport({ scale: 1 });
          const r = await renderPage(pdf, n, { scale: dpi / 72, hiDpi: false });
          const ctx = r.canvas.getContext('2d'); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);
          const jpg = await canvasToBlob(r.canvas, 'image/jpeg', quality); releaseCanvas(r.canvas);
          images.push({ buffer: await jpg.arrayBuffer(), type: 'jpg', pageWidth: base.width, pageHeight: base.height }); p((n / pdf.numPages) * 0.8);
        }
      } finally { pdf.destroy(); }
      out = await pdfOps.imagesToPdf(images, 'exact', { onProgress: (v) => p(0.8 + v * 0.2) });
    }
    const name = `${baseName(doc.name)}-compressed.pdf`; const meta = await saveResultPdf(out, name, 'compress');
    setResult({ name, blob: out, id: meta.id, before: src.size }); refresh();
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Compress" description="Make a smaller copy. Your original stays in the Library." />
      <Card className="space-y-4">
        <DocPicker docs={docs} value={id} onChange={(v) => { setId(v); setResult(null); }} onImported={refresh} />
        <div className="space-y-2 text-sm">
          <label className="flex gap-2"><input type="radio" checked={mode === 'structure'} onChange={() => setMode('structure')} /><span><b>Optimize structure</b> — keeps text selectable and quality unchanged; savings are usually small.</span></label>
          <label className="flex gap-2"><input type="radio" checked={mode === 'images'} onChange={() => setMode('images')} /><span><b>Reduce quality</b> — turns pages into compressed images; much smaller, but text can no longer be selected or searched.</span></label>
        </div>
        {mode === 'images' && (
          <div className="flex flex-wrap gap-6 text-sm">
            <label>JPEG quality {Math.round(quality * 100)}%<input type="range" min="0.3" max="0.95" step="0.05" value={quality} onChange={(e) => setQuality(+e.target.value)} className="block" /></label>
            <label>Resolution {dpi} dpi<input type="range" min="72" max="200" step="2" value={dpi} onChange={(e) => setDpi(+e.target.value)} className="block" /></label>
          </div>
        )}
        <Button variant="primary" disabled={!id || busy} onClick={compress}>{busy && <Spinner />} Compress</Button>
        {busy && <ProgressBar value={progress} label="Compressing" />}
        {error && <Alert>{error}</Alert>}
      </Card>
      {result && <ResultPanel title="Compressed copy saved to your Library" items={[result]}>
        <p className="mt-1 text-fg">{formatBytes(result.before)} → {formatBytes(result.blob.size)}{result.blob.size >= result.before ? ' (no reduction — try “Reduce quality”)' : ''}</p></ResultPanel>}
    </div>
  );
}
