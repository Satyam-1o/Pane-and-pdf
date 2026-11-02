import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; // bundled, served from our own origin
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function toPdfError(e) {
  const n = e?.name;
  if (n === 'PasswordException') return new Error('This PDF is password protected. Remove the password first.');
  if (['InvalidPDFException', 'MissingPDFException', 'FormatError'].includes(n)) return new Error('This file is corrupted or not a valid PDF.');
  return e instanceof Error ? e : new Error(String(e));
}

export async function loadPdf(blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  try { return await pdfjs.getDocument({ data, isEvalSupported: false }).promise; }
  catch (e) { throw toPdfError(e); }
}
