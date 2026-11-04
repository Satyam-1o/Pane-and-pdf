import { useEffect, useState } from 'react';
import { loadPdf } from '../services/pdf/pdfjs';
import { getDocumentBlob, getDocumentMeta } from '../services/storage/storageService';

/** Load a PDF.js document from a Blob; destroys it on change/unmount. */
export function usePdfDocument(blob) {
  const [state, set] = useState({ pdf: null, loading: !!blob, error: null });
  useEffect(() => {
    if (!blob) { set({ pdf: null, loading: false, error: null }); return undefined; }
    let dead = false, doc = null;
    set((s) => ({ ...s, loading: true }));
    loadPdf(blob).then((p) => { if (dead) { p.destroy(); return; } doc = p; set({ pdf: p, loading: false, error: null }); })
      .catch((e) => { if (!dead) set({ pdf: null, loading: false, error: e }); });
    return () => { dead = true; doc?.destroy(); };
  }, [blob]);
  return state;
}

/** Load metadata + Blob of a stored document by id. */
export function useStoredDocument(id) {
  const [state, set] = useState({ meta: null, blob: null, loading: true, error: null });
  useEffect(() => {
    let dead = false;
    set({ meta: null, blob: null, loading: true, error: null });
    Promise.all([getDocumentMeta(id), getDocumentBlob(id)])
      .then(([meta, blob]) => { if (!dead) set({ meta, blob, loading: false, error: meta && blob ? null : new Error('Document not found in this browser.') }); })
      .catch((error) => !dead && set({ meta: null, blob: null, loading: false, error }));
    return () => { dead = true; };
  }, [id]);
  return state;
}
