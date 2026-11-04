// Canvas rendering helpers (PDF.js -> canvas -> Blob).
const inflight = new WeakMap();

/** Render a page into `canvas` (or a new one). Resolves null if cancelled via `signal`. */
export async function renderPage(pdf, pageNumber, { scale = 1, rotation = 0, canvas, signal, hiDpi = true } = {}) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const c = canvas || document.createElement('canvas');
  const prev = inflight.get(c);
  if (prev) { prev.cancel(); await prev.promise.catch(() => {}); }
  const dpr = canvas && hiDpi ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  c.width = Math.floor(viewport.width * dpr); c.height = Math.floor(viewport.height * dpr);
  c.style.width = `${viewport.width}px`; c.style.height = `${viewport.height}px`;
  const task = page.render({ canvasContext: c.getContext('2d'), viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
  inflight.set(c, task);
  const onAbort = () => task.cancel();
  signal?.addEventListener('abort', onAbort);
  try { await task.promise; }
  catch (e) { if (e?.name === 'RenderingCancelledException') return null; throw e; }
  finally { signal?.removeEventListener('abort', onAbort); if (inflight.get(c) === task) inflight.delete(c); page.cleanup(); }
  return { canvas: c, width: viewport.width, height: viewport.height };
}

export const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image (page may be too large).'))), type, quality));

export function releaseCanvas(canvas) { canvas.width = 0; canvas.height = 0; }
