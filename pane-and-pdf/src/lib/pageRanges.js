/** "1-3, 5, 8-9" -> [[0,1,2],[4],[7,8]] (zero-based). Throws a readable Error on bad input. */
export function parseRanges(text, total) {
  const groups = [];
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw new Error(`"${part}" is not a valid page or range.`);
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < a || b > total) throw new Error(`Range "${part}" is outside 1–${total}.`);
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  if (!groups.length) throw new Error('Enter at least one page or range.');
  return groups;
}
