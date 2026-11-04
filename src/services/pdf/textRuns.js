// Finds the text already inside a PDF page (PDF.js text layer) and returns clickable "runs"
// with position, size and a best-guess font style. Coordinates are fractions (0..1) of the displayed page.
import * as pdfjs from 'pdfjs-dist';

const BOLD = /bold|black|heavy|semibold|demi/i;
const ITALIC = /italic|oblique/i;
const MONO = /mono|courier|consolas|menlo|typewriter/i;
const SERIF = /serif|times|georgia|garamond|minion|cambria|palatino|bookman|century/i;

function styleOf(page, content, fontName) {
  let nm = '';
  try { if (page.commonObjs.has(fontName)) nm = page.commonObjs.get(fontName)?.name || ''; } catch { /* font not resolved */ }
  const s = `${nm} ${content.styles?.[fontName]?.fontFamily || ''}`;
  return { bold: BOLD.test(s), italic: ITALIC.test(s), family: MONO.test(s) ? 'mono' : SERIF.test(s) && !/sans/i.test(s) ? 'serif' : 'sans' };
}

/** Call after the page has been rendered (fonts are resolved then). Rotated pages/text are skipped. */
export async function getTextRuns(pdf, pageNumber, scale) {
  const page = await pdf.getPage(pageNumber);
  if (page.rotate % 360 !== 0) return [];
  const viewport = page.getViewport({ scale });
  const content = await page.getTextContent();
  const raw = [];
  for (const it of content.items) {
    if (!('str' in it) || !it.str.trim()) continue;
    const t = pdfjs.Util.transform(viewport.transform, it.transform);
    const size = Math.hypot(t[0], t[1]);
    if (!size || Math.abs(t[1]) > size * 0.02) continue; // rotated text is not supported
    raw.push({ str: it.str, x: t[4], base: t[5], w: it.width * scale, size, fontName: it.fontName });
  }
  const merged = []; // join neighbouring pieces on the same line into one editable run
  for (const r of raw) {
    const p = merged[merged.length - 1];
    const gap = p ? r.x - (p.x + p.w) : 0;
    if (p && Math.abs(r.base - p.base) < p.size * 0.25 && gap < p.size * 0.6 && gap > -p.size * 0.3) {
      p.str += (gap > p.size * 0.15 && !p.str.endsWith(' ') && !r.str.startsWith(' ') ? ' ' : '') + r.str;
      p.w = r.x + r.w - p.x; p.size = Math.max(p.size, r.size);
    } else merged.push({ ...r });
  }
  const W = viewport.width, H = viewport.height;
  return merged.map((m, i) => ({
    key: `${pageNumber}:${i}:${m.str.slice(0, 12)}`,
    str: m.str.trim(),
    size: m.size / scale,                 // font size in PDF points
    x: (m.x - 1) / W, w: (m.w + 2) / W,   // cover box
    y: (m.base - m.size * 0.95) / H, h: (m.size * 1.25) / H,
    by: m.base / H,                       // baseline
    ...styleOf(page, content, m.fontName),
  }));
}
