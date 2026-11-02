import { useState } from 'react';
import { Alert, Button, Card, PageHeader, ProgressBar, Spinner } from '../ui';
import DocPicker from '../components/DocPicker';
import { useLibrary } from '../hooks/useLibrary';
import { useTask } from '../hooks/useTask';
import { loadPdf } from '../services/pdf/pdfjs';
import { canvasToBlob, releaseCanvas, renderPage } from '../services/pdf/render';
import { getDocumentBlob } from '../services/storage/storageService';
import { downloadBlob, downloadZip } from '../lib/download';
import { baseName } from '../lib/format';

export default function PdfToImages() {
  const { docs, refresh } = useLibrary();
  const [id, setId] = useState('');
  const [format, setFormat] = useState('png');
  const [dpi, setDpi] = useState(150);
  const { busy, progress, error, run } = useTask();
  const doc = docs.find((d) => d.id === id);

  const convert = () => run(async (p) => {
    const pdf = await loadPdf(await getDocumentBlob(id));
    try {
      const files = [], ext = format === 'png' ? 'png' : 'jpg', stem = baseName(doc.name);
      for (let n = 1; n <= pdf.numPages; n++) {
        const r = await renderPage(pdf, n, { scale: dpi / 72, hiDpi: false });
        if (format === 'jpg') { // JPEG has no alpha: paint white behind the page
          const ctx = r.canvas.getContext('2d'); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, r.canvas.width, r.canvas.height);
        }
        files.push({ name: `${stem}-page-${String(n).padStart(3, '0')}.${ext}`, blob: await canvasToBlob(r.canvas, format === 'png' ? 'image/png' : 'image/jpeg', 0.92) });
        releaseCanvas(r.canvas); p(n / pdf.numPages);
      }
      files.length === 1 ? downloadBlob(files[0].blob, files[0].name) : await downloadZip(files, `${stem}-images.zip`);
    } finally { pdf.destroy(); }
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="PDF to Images" description="Render every page to PNG or JPG. Multi-page results download as a ZIP." />
      <Card className="space-y-4">
        <DocPicker docs={docs} value={id} onChange={setId} onImported={refresh} />
        <div className="flex flex-wrap gap-4">
          <label className="text-sm">Format<select value={format} onChange={(e) => setFormat(e.target.value)} className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2"><option value="png">PNG (lossless)</option><option value="jpg">JPG (smaller)</option></select></label>
          <label className="text-sm">Resolution<select value={dpi} onChange={(e) => setDpi(+e.target.value)} className="mt-1 block rounded-ui border border-line bg-surface px-3 py-2"><option value={96}>96 dpi (screen)</option><option value={150}>150 dpi</option><option value={300}>300 dpi (print)</option></select></label>
        </div>
        <Button variant="primary" disabled={!id || busy} onClick={convert}>{busy && <Spinner />} Convert and download</Button>
        {busy && <ProgressBar value={progress} label="Rendering pages" />}
        {error && <Alert>{error}</Alert>}
      </Card>
    </div>
  );
}
