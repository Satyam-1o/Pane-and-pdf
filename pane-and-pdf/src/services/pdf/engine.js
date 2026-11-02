// Main-thread client for the PDF Web Worker. Every PDF mutation goes through here.
let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('../../workers/pdf.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id); if (!p) return;
    if (data.type === 'progress') return p.onProgress?.(data.value);
    pending.delete(data.id);
    data.type === 'error' ? p.reject(new Error(data.message)) : p.resolve(data.result);
  };
  worker.onerror = () => {
    pending.forEach((p) => p.reject(new Error('The processing worker crashed (the file may be too large for this device).')));
    pending.clear(); worker.terminate(); worker = null;
  };
  return worker;
}

function run(task, payload, { onProgress, transfer = [] } = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, task, payload }, transfer);
  });
}

const asPdf = (bytes) => new Blob([bytes], { type: 'application/pdf' });
const buffers = (blobs) => Promise.all(blobs.map((b) => b.arrayBuffer()));

export const pdfOps = {
  async merge(blobs, o) { const b = await buffers(blobs); return asPdf(await run('merge', { buffers: b }, { ...o, transfer: b })); },
  /** groups: array of zero-based page index arrays -> array of PDF blobs */
  async split(blob, groups, o) { const [b] = await buffers([blob]); return (await run('split', { buffer: b, groups }, { ...o, transfer: [b] })).map(asPdf); },
  /** pages: [{ index, rotate }] in final order (omit = delete, repeat = duplicate) */
  async organize(blob, pages, o) { const [b] = await buffers([blob]); return asPdf(await run('organize', { buffer: b, pages }, { ...o, transfer: [b] })); },
  /** images: [{ buffer, type:'jpg'|'png', pageWidth?, pageHeight? }], mode: 'a4' | 'fit' | 'exact' */
  async imagesToPdf(images, mode, o) { return asPdf(await run('imagesToPdf', { images, mode }, { ...o, transfer: images.map((i) => i.buffer) })); },
  /** items: annotation objects (see pages/Annotate.jsx) */
  async annotate(blob, items, o) { const [b] = await buffers([blob]); return asPdf(await run('annotate', { buffer: b, items }, { ...o, transfer: [b] })); },
  async optimize(blob, o) { const [b] = await buffers([blob]); return asPdf(await run('optimize', { buffer: b }, { ...o, transfer: [b] })); },
};
