import { createUrl, revokeUrl } from '../services/storage/blobUrls';

export function downloadBlob(blob, filename) {
  const url = createUrl(blob, 'download');
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => revokeUrl(url), 30000);
}

export async function downloadZip(files, zipName = 'pane-and-pdf.zip', onProgress) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => onProgress?.(m.percent / 100));
  downloadBlob(blob, zipName);
}
