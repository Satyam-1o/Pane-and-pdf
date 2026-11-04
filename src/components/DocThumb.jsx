import { useEffect, useState } from 'react';
import PdfPage from './PdfPage';
import { usePdfDocument } from '../hooks/usePdfDocument';
import { getDocumentBlob } from '../services/storage/storageService';

/** First-page preview of a stored document. */
export default function DocThumb({ id }) {
  const [blob, setBlob] = useState(null);
  useEffect(() => { let dead = false; getDocumentBlob(id).then((b) => !dead && setBlob(b)).catch(() => {}); return () => { dead = true; }; }, [id]);
  const { pdf } = usePdfDocument(blob);
  return <div className="flex h-40 items-start justify-center overflow-hidden rounded-ui border border-line bg-white">{pdf && <PdfPage pdf={pdf} pageNumber={1} scale={0.3} eager />}</div>;
}
