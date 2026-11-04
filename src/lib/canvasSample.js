// Reads the rendered page pixels around a text box to guess the background and text colors.
export const toHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function sampleBoxColors(canvas, box /* css px: x,y,w,h */) {
  try {
    const k = canvas.width / (parseFloat(canvas.style.width) || canvas.width);
    const x0 = Math.max(0, Math.floor((box.x - 2) * k)), y0 = Math.max(0, Math.floor((box.y - 2) * k));
    const x1 = Math.min(canvas.width, Math.ceil((box.x + box.w + 2) * k)), y1 = Math.min(canvas.height, Math.ceil((box.y + box.h + 2) * k));
    const w = x1 - x0, h = y1 - y0;
    if (w < 3 || h < 3) throw new Error('empty');
    const d = canvas.getContext('2d').getImageData(x0, y0, w, h).data;
    const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    const buckets = new Map();
    const add = (c) => { const q = `${c[0] >> 4},${c[1] >> 4},${c[2] >> 4}`; const b = buckets.get(q) || { n: 0, c }; b.n++; buckets.set(q, b); };
    for (let x = 0; x < w; x++) { add(at(x, 0)); add(at(x, h - 1)); }
    for (let y = 1; y < h - 1; y++) { add(at(0, y)); add(at(w - 1, y)); }
    const bg = [...buckets.values()].sort((a, b) => b.n - a.n)[0].c;   // most common edge color = background
    let best = bg, far = -1;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const c = at(x, y), dist = (c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2;
      if (dist > far) { far = dist; best = c; }                        // most different pixel = text color
    }
    if (far < 900) best = bg[0] + bg[1] + bg[2] > 380 ? [17, 24, 39] : [255, 255, 255];
    return { bg: toHex(bg), fg: toHex(best) };
  } catch { return { bg: '#ffffff', fg: '#111827' }; }
}
