import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { Alert, Button, PageHeader, Spinner } from '../ui';
import PdfPage from '../components/PdfPage';
import { usePdfDocument, useStoredDocument } from '../hooks/usePdfDocument';

export default function Viewer() {
  const { id } = useParams();
  const { meta, blob, error: storeErr } = useStoredDocument(id);
  const { pdf, loading, error } = usePdfDocument(blob);
  const [scale, setScale] = useState(1.2);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={meta?.name || 'Viewer'}
        actions={<>
          <Link to="/library"><Button><ArrowLeft size={16} /> Library</Button></Link>
          <Button aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}><ZoomOut size={16} /></Button>
          <Button aria-label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.2))}><ZoomIn size={16} /></Button>
        </>}
      />
      {(storeErr || error) && <Alert>{(storeErr || error).message}</Alert>}
      {loading && <Spinner />}
      {pdf && (
        <div className="flex flex-col items-center gap-4 overflow-x-auto pb-8">
          {Array.from({ length: pdf.numPages }, (_, i) => <PdfPage key={i} pdf={pdf} pageNumber={i + 1} scale={scale} />)}
        </div>
      )}
    </div>
  );
}
