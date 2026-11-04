// Runs all pdf-lib work off the main thread. No network access is used here.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const FONTS = {
  sans: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
  serif: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
  mono: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'],
};
const progress = (id, value) => self.postMessage({ id, type: 'progress', value });

async function load(buffer) {
  try { return await PDFDocument.load(buffer, { updateMetadata: false }); }
  catch (e) { throw new Error(/encrypt/i.test(e.message) ? 'This PDF is password protected.' : 'This file is corrupted or not a valid PDF.'); }
}
const hex = (h = '#000000') => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

const tasks = {
  async merge({ buffers }, p) {
    const out = await PDFDocument.create();
    for (const [i, buf] of buffers.entries()) {
      const src = await load(buf);
      (await out.copyPages(src, src.getPageIndices())).forEach((pg) => out.addPage(pg));
      p((i + 1) / buffers.length);
    }
    return out.save();
  },

  async split({ buffer, groups }, p) {
    const src = await load(buffer); const results = [];
    for (const [i, idx] of groups.entries()) {
      const doc = await PDFDocument.create();
      (await doc.copyPages(src, idx)).forEach((pg) => doc.addPage(pg));
      results.push(await doc.save()); p((i + 1) / groups.length);
    }
    return results;
  },

  async organize({ buffer, pages }, p) {
    const src = await load(buffer); const out = await PDFDocument.create();
    const firsts = [...new Set(pages.map((x) => x.index))];
    const batch = await out.copyPages(src, firsts);
    const byIndex = new Map(firsts.map((v, i) => [v, batch[i]])); const used = new Set();
    for (const [i, spec] of pages.entries()) {
      let page;
      if (!used.has(spec.index)) { page = byIndex.get(spec.index); used.add(spec.index); }
      else [page] = await out.copyPages(src, [spec.index]); // duplicates need an independent copy
      if (spec.rotate) page.setRotation(degrees((page.getRotation().angle + spec.rotate + 360) % 360));
      out.addPage(page); p((i + 1) / pages.length);
    }
    return out.save();
  },

  async imagesToPdf({ images, mode }, p) {
    const out = await PDFDocument.create();
    for (const [i, im] of images.entries()) {
      const img = im.type === 'png' ? await out.embedPng(im.buffer) : await out.embedJpg(im.buffer);
      let pw, ph, x = 0, y = 0, w, h;
      if (mode === 'exact') { pw = im.pageWidth; ph = im.pageHeight; w = pw; h = ph; }
      else if (mode === 'fit') { const k = Math.min(1, 1190 / Math.max(img.width, img.height)); pw = w = img.width * k; ph = h = img.height * k; }
      else { // A4, image contained with a margin, orientation follows the image
        const land = img.width > img.height; pw = land ? 841.89 : 595.28; ph = land ? 595.28 : 841.89;
        const m = 24, k = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
        w = img.width * k; h = img.height * k; x = (pw - w) / 2; y = (ph - h) / 2;
      }
      out.addPage([pw, ph]).drawImage(img, { x, y, width: w, height: h });
      p((i + 1) / images.length);
    }
    return out.save();
  },

  // items use coordinates normalised 0..1 from the TOP-LEFT of the page as displayed (after rotation).
  // types: text | edit (cover original text + draw replacement) | rect | highlight | ink
  async annotate({ buffer, items }, p) {
    const doc = await load(buffer); const pages = doc.getPages(); const cache = new Map();
    const getFont = async (it) => {
      const key = `${it.family || 'sans'}|${!!it.bold}|${!!it.italic}`;
      if (!cache.has(key)) {
        const names = FONTS[it.family] || FONTS.sans;
        cache.set(key, await doc.embedFont(StandardFonts[names[it.bold ? (it.italic ? 3 : 1) : (it.italic ? 2 : 0)]]));
      }
      return cache.get(key);
    };
    for (const [n, it] of items.entries()) {
      const page = pages[it.page]; if (!page) continue;
      const { width: W, height: H } = page.getSize(); const r = page.getRotation().angle % 360;
      const map = (u, v) => (r === 90 ? { x: v * W, y: u * H } : r === 180 ? { x: W - u * W, y: v * H } : r === 270 ? { x: W - v * W, y: H - u * H } : { x: u * W, y: H - v * H });
      const dispW = r % 180 ? H : W;
      const rect = (x, y, w, h) => { const a = map(x, y), b = map(x + w, y + h); return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }; };
      const write = async (u, v) => { const q = map(u, v); page.drawText(it.text, { x: q.x, y: q.y, size: it.size, font: await getFont(it), color: hex(it.color), rotate: degrees(r) }); };
      try {
        if (it.type === 'text' && it.text) await write(it.x, it.y);
        else if (it.type === 'edit') {
          page.drawRectangle({ ...rect(it.x, it.y, it.w, it.h), color: hex(it.bg) }); // hides the original text
          if (it.text) {
            const tw = (await getFont(it)).widthOfTextAtSize(it.text, it.size) / dispW;
            const u = it.align === 'center' ? it.x + (it.w - tw) / 2 : it.align === 'right' ? it.x + it.w - tw : it.x;
            await write(u, it.by);
          }
        } else if (it.type === 'highlight') page.drawRectangle({ ...rect(it.x, it.y, it.w, it.h), color: hex(it.color), opacity: 0.35 });
        else if (it.type === 'rect') page.drawRectangle({ ...rect(it.x, it.y, it.w, it.h), borderColor: hex(it.color), borderWidth: 1.5 });
        else if (it.type === 'ink') {
          for (let i = 1; i < it.points.length; i++) page.drawLine({ start: map(...it.points[i - 1]), end: map(...it.points[i]), thickness: 1.8, color: hex(it.color) });
        }
      } catch (e) {
        throw new Error(/WinAnsi|encode/i.test(e.message) ? `"${(it.text || '').slice(0, 30)}" has characters the built-in fonts can't draw (Latin letters, digits and common punctuation only).` : e.message);
      }
      p((n + 1) / items.length);
    }
    return doc.save();
  },

  async optimize({ buffer }, p) {
    const doc = await load(buffer); p(0.5);
    return doc.save({ useObjectStreams: true });
  },
};

self.onmessage = async ({ data: { id, task, payload } }) => {
  try {
    const result = await tasks[task](payload, (v) => progress(id, v));
    const transfer = Array.isArray(result) ? result.map((r) => r.buffer) : [result.buffer];
    self.postMessage({ id, type: 'done', result }, transfer);
  } catch (e) {
    self.postMessage({ id, type: 'error', message: e?.message || 'Processing failed.' });
  }
};
