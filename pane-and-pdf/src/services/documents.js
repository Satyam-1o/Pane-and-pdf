// Import/validate PDFs into the local library.
import { loadPdf } from './pdf/pdfjs';
import { saveDocument } from './storage/storageService';
import { LIMITS } from '../config/app';

export async function importPdfFiles(files, onProgress) {
  const saved = [], errors = [];
  for (const [i, file] of files.entries()) {
    try {
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('Not a PDF file.');
      if (file.size > LIMITS.warnFileMB * 1048576) throw new Error(`Larger than ${LIMITS.warnFileMB} MB — this may exceed your browser's memory.`);
      const pdf = await loadPdf(file); const pageCount = pdf.numPages; pdf.destroy();
      saved.push(await saveDocument(file, { name: file.name, pageCount, origin: 'upload' }));
    } catch (e) { errors.push(`${file.name}: ${e.message}`); }
    onProgress?.((i + 1) / files.length);
  }
  return { saved, errors };
}

export async function saveResultPdf(blob, name, origin) {
  const pdf = await loadPdf(blob); const pageCount = pdf.numPages; pdf.destroy();
  return saveDocument(blob, { name, pageCount, origin });
}
